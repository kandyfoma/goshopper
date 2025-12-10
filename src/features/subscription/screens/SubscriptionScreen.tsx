// Subscription Screen - Paywall with Moko Afrika and Stripe integration
import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import functions from '@react-native-firebase/functions';
import firestore from '@react-native-firebase/firestore';
import {useSubscription, useAuth} from '@/shared/contexts';
import {COLORS, SUBSCRIPTION_PLANS, TRIAL_DURATION_DAYS} from '@/shared/utils/constants';
import {formatCurrency} from '@/shared/utils/helpers';

type MobileMoneyProvider = 'mpesa' | 'orange' | 'airtel' | 'afrimoney';
type PaymentMethodType = 'mobile_money' | 'card';
type PlanId = 'free' | 'basic' | 'standard' | 'premium';

interface MobileMoneyOption {
  id: MobileMoneyProvider;
  name: string;
  icon: string;
  color: string;
}

const MOBILE_MONEY_OPTIONS: MobileMoneyOption[] = [
  {id: 'mpesa', name: 'M-Pesa', icon: '', color: '#4CAF50'},
  {id: 'orange', name: 'Orange Money', icon: '', color: '#FF6600'},
  {id: 'airtel', name: 'Airtel Money', icon: '', color: '#ED1C24'},
  {id: 'afrimoney', name: 'AfriMoney', icon: '', color: '#FFB300'},
];

export function SubscriptionScreen() {
  const navigation = useNavigation();
  const {user} = useAuth();
  const {subscription, isTrialActive, trialDaysRemaining} = useSubscription();

  const [selectedPlan, setSelectedPlan] = useState<PlanId>('standard');
  const [paymentMethodType, setPaymentMethodType] = useState<PaymentMethodType>('mobile_money');
  const [selectedMobileMoney, setSelectedMobileMoney] = useState<MobileMoneyProvider | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [isInDRC, setIsInDRC] = useState<boolean | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);

  useEffect(() => {
    const checkUserLocation = async () => {
      if (!user?.uid) {
        setIsInDRC(true);
        setIsLoadingLocation(false);
        return;
      }
      try {
        const profileDoc = await firestore()
          .collection('artifacts').doc('goshopperai')
          .collection('users').doc(user.uid)
          .collection('profile').doc('main').get();
        if (profileDoc.exists) {
          const profile = profileDoc.data();
          const isInDRCValue = profile?.isInDRC !== undefined 
            ? profile.isInDRC 
            : (profile?.countryCode === 'CD' || true);
          setIsInDRC(isInDRCValue);
          if (profile?.phoneNumber) setPhoneNumber(profile.phoneNumber);
          if (profile?.email) setEmail(profile.email);
        } else {
          setIsInDRC(true);
        }
      } catch (error) {
        console.error('Error checking user location:', error);
        setIsInDRC(true);
      } finally {
        setIsLoadingLocation(false);
      }
    };
    checkUserLocation();
  }, [user?.uid]);

  useEffect(() => {
    if (isInDRC !== null) {
      setPaymentMethodType(isInDRC ? 'mobile_money' : 'card');
    }
  }, [isInDRC]);

  const isCurrentPlan = (planId: PlanId) => subscription?.planId === planId;

  const handleMobileMoneyPayment = async () => {
    if (!selectedMobileMoney) {
      Alert.alert('Mobile Money', 'Veuillez s�lectionner un op�rateur');
      return;
    }
    if (!phoneNumber || phoneNumber.length < 9) {
      Alert.alert('Num�ro de t�l�phone', 'Veuillez entrer un num�ro valide');
      return;
    }
    const plan = SUBSCRIPTION_PLANS[selectedPlan];
    Alert.alert(
      'Confirmer',
      `Souscrire � ${plan.name} pour ${formatCurrency(plan.price)}/mois?`,
      [
        {text: 'Annuler', style: 'cancel'},
        {
          text: 'Confirmer',
          onPress: async () => {
            setIsProcessing(true);
            try {
              const result = await functions().httpsCallable('initiateMokoPayment')({
                planId: selectedPlan, paymentMethod: selectedMobileMoney,
                amount: plan.price, currency: 'USD', phoneNumber,
              });
              const {status, message} = result.data as any;
              Alert.alert(status === 'success' ? 'Activ�!' : 'Initi�', message || 'V�rifiez votre t�l�phone',
                [{text: 'OK', onPress: () => navigation.goBack()}]);
            } catch (error: any) {
              Alert.alert('Erreur', error.message || 'R�essayez');
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  };

  const handleCardPayment = async () => {
    if (!email || !email.includes('@')) {
      Alert.alert('Email', isInDRC ? 'Entrez un email valide' : 'Enter a valid email');
      return;
    }
    const plan = SUBSCRIPTION_PLANS[selectedPlan];
    Alert.alert(
      isInDRC ? 'Confirmer' : 'Confirm',
      `Subscribe to ${plan.name} for ${formatCurrency(plan.price)}/month?`,
      [
        {text: isInDRC ? 'Annuler' : 'Cancel', style: 'cancel'},
        {
          text: isInDRC ? 'Continuer' : 'Continue',
          onPress: async () => {
            setIsProcessing(true);
            try {
              await functions().httpsCallable('createPaymentIntent')({
                planId: selectedPlan, currency: 'USD', email,
              });
              Alert.alert(isInDRC ? 'Paiement carte' : 'Card Payment',
                'Stripe SDK integration required', [{text: 'OK'}]);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Try again');
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  };

  const handleSubscribe = () => {
    paymentMethodType === 'mobile_money' ? handleMobileMoneyPayment() : handleCardPayment();
  };

  if (isLoadingLocation) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary[500]} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>GoShopper Pro</Text>
          <Text style={styles.headerSubtitle}>
            {isInDRC ? 'Fonctionnalit�s premium' : 'Premium features'}
          </Text>
        </View>

        {isTrialActive && (
          <View style={styles.trialCard}>
            <Text style={styles.trialIcon}></Text>
            <View style={styles.trialInfo}>
              <Text style={styles.trialTitle}>{isInDRC ? 'Essai gratuit' : 'Free Trial'}</Text>
              <Text style={styles.trialDesc}>{trialDaysRemaining} {isInDRC ? 'jours restants' : 'days left'}</Text>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>{isInDRC ? 'Choisir un plan' : 'Choose a Plan'}</Text>
        
        {Object.entries(SUBSCRIPTION_PLANS).filter(([id]) => id !== 'free').map(([id, plan]) => {
          const planId = id as PlanId;
          const isSelected = selectedPlan === planId;
          const isCurrent = isCurrentPlan(planId);
          return (
            <TouchableOpacity key={planId} style={[styles.planCard, isSelected && styles.planCardSelected]}
              onPress={() => setSelectedPlan(planId)} disabled={isCurrent}>
              <View style={styles.planHeader}>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planPrice}>{formatCurrency(plan.price)}/{isInDRC ? 'mois' : 'mo'}</Text>
              </View>
              <Text style={styles.featureText}>📸 {plan.scanLimit === -1 ? 'Unlimited' : plan.scanLimit} scans</Text>
              {isCurrent && <Text style={styles.currentText}> Current</Text>}
            </TouchableOpacity>
          );
        })}

        {selectedPlan !== 'free' && isInDRC && (
          <>
            <Text style={styles.sectionTitle}>Mode de paiement</Text>
            <View style={styles.paymentTypeSelector}>
              <TouchableOpacity style={[styles.paymentTypeButton, paymentMethodType === 'mobile_money' && styles.paymentTypeButtonSelected]}
                onPress={() => setPaymentMethodType('mobile_money')}>
                <Text> Mobile Money</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.paymentTypeButton, paymentMethodType === 'card' && styles.paymentTypeButtonSelected]}
                onPress={() => setPaymentMethodType('card')}>
                <Text> Visa/Card</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {selectedPlan !== 'free' && isInDRC && paymentMethodType === 'mobile_money' && (
          <>
            <Text style={styles.sectionTitle}>Op�rateur</Text>
            <View style={styles.mobileMoneyGrid}>
              {MOBILE_MONEY_OPTIONS.map((opt) => (
                <TouchableOpacity key={opt.id} style={[styles.mobileMoneyCard, selectedMobileMoney === opt.id && {borderColor: opt.color}]}
                  onPress={() => setSelectedMobileMoney(opt.id)}>
                  <Text style={styles.mobileMoneyIcon}>{opt.icon}</Text>
                  <Text>{opt.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>T�l�phone</Text>
              <View style={styles.phoneInputWrapper}>
                <Text style={styles.phonePrefix}>+243</Text>
                <TextInput style={styles.phoneInput} placeholder="812345678" keyboardType="phone-pad"
                  value={phoneNumber} onChangeText={setPhoneNumber} maxLength={12} />
              </View>
            </View>
          </>
        )}

        {selectedPlan !== 'free' && (!isInDRC || paymentMethodType === 'card') && (
          <>
            <Text style={styles.sectionTitle}>{isInDRC ? 'Paiement carte' : 'Card Payment'}</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput style={styles.textInput} placeholder="your@email.com" keyboardType="email-address"
                autoCapitalize="none" value={email} onChangeText={setEmail} />
            </View>
            <View style={styles.cardNotice}>
              <Text> {isInDRC ? 'Paiement s�curis� Stripe' : 'Secure Stripe payment'}</Text>
            </View>
          </>
        )}

        {selectedPlan !== 'free' && !isCurrentPlan(selectedPlan) && (
          <TouchableOpacity style={[styles.subscribeButton, isProcessing && styles.subscribeButtonDisabled]}
            onPress={handleSubscribe} disabled={isProcessing}>
            {isProcessing ? <ActivityIndicator color="#FFF" /> : (
              <Text style={styles.subscribeButtonText}>
                {isInDRC ? `S'abonner � ${SUBSCRIPTION_PLANS[selectedPlan].name}` : `Subscribe to ${SUBSCRIPTION_PLANS[selectedPlan].name}`}
              </Text>
            )}
          </TouchableOpacity>
        )}

        <Text style={styles.termsText}>
          {isInDRC ? 'Renouvellement automatique mensuel' : 'Auto-renews monthly'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F5F5F5'},
  scrollView: {flex: 1},
  scrollContent: {padding: 16, paddingBottom: 40},
  loadingContainer: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  loadingText: {marginTop: 12, fontSize: 16, color: COLORS.gray[600]},
  header: {alignItems: 'center', marginBottom: 24},
  headerTitle: {fontSize: 28, fontWeight: 'bold', color: COLORS.primary[600], marginBottom: 8},
  headerSubtitle: {fontSize: 16, color: COLORS.gray[600], textAlign: 'center'},
  trialCard: {flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5E9', padding: 16, borderRadius: 12, marginBottom: 24},
  trialIcon: {fontSize: 32, marginRight: 12},
  trialInfo: {flex: 1},
  trialTitle: {fontSize: 16, fontWeight: '600', color: COLORS.gray[800]},
  trialDesc: {fontSize: 14, color: COLORS.gray[600]},
  sectionTitle: {fontSize: 18, fontWeight: '600', color: COLORS.gray[800], marginBottom: 16, marginTop: 8},
  planCard: {backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 12, borderWidth: 2, borderColor: '#E0E0E0'},
  planCardSelected: {borderColor: COLORS.primary[500], backgroundColor: COLORS.primary[50]},
  planHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8},
  planName: {fontSize: 20, fontWeight: 'bold', color: COLORS.gray[800]},
  planPrice: {fontSize: 18, fontWeight: 'bold', color: COLORS.primary[600]},
  featureText: {fontSize: 14, color: COLORS.gray[600]},
  currentText: {color: COLORS.success, fontWeight: '600', marginTop: 8},
  paymentTypeSelector: {flexDirection: 'row', gap: 12, marginBottom: 16},
  paymentTypeButton: {flex: 1, alignItems: 'center', backgroundColor: '#FFF', padding: 16, borderRadius: 12, borderWidth: 2, borderColor: '#E0E0E0'},
  paymentTypeButtonSelected: {borderColor: COLORS.primary[500], backgroundColor: COLORS.primary[50]},
  mobileMoneyGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20},
  mobileMoneyCard: {width: '47%', backgroundColor: '#FFF', padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 2, borderColor: '#E0E0E0'},
  mobileMoneyIcon: {fontSize: 32, marginBottom: 8},
  inputContainer: {marginBottom: 16},
  inputLabel: {fontSize: 14, fontWeight: '600', color: COLORS.gray[700], marginBottom: 8},
  phoneInputWrapper: {flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E0E0E0'},
  phonePrefix: {paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#F5F5F5', fontSize: 16, color: COLORS.gray[600]},
  phoneInput: {flex: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: COLORS.gray[800]},
  textInput: {backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E0E0E0', paddingHorizontal: 16, paddingVertical: 14, fontSize: 16},
  cardNotice: {flexDirection: 'row', alignItems: 'center', backgroundColor: '#E3F2FD', padding: 16, borderRadius: 12, marginBottom: 16},
  subscribeButton: {backgroundColor: COLORS.primary[500], padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 8, marginBottom: 16},
  subscribeButtonDisabled: {backgroundColor: COLORS.gray[400]},
  subscribeButtonText: {color: '#FFF', fontSize: 18, fontWeight: '600'},
  termsText: {fontSize: 12, color: COLORS.gray[500], textAlign: 'center'},
});

export default SubscriptionScreen;
