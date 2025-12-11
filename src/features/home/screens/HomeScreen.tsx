// Home Screen - Main landing page optimized for ease of use
// Designed for Congolese housewives - simple, visual, large buttons
import React, {useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '@/shared/types';
import {useSubscription, useAuth, useUser} from '@/shared/contexts';
import {COLORS} from '@/shared/utils/constants';
import {analyticsService} from '@/shared/services';

const {width} = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {canScan, subscription, isTrialActive, trialDaysRemaining} = useSubscription();
  const {userProfile} = useUser();

  useEffect(() => {
    // Track screen view
    analyticsService.logScreenView('Home', 'HomeScreen');
  }, []);

  const handleScanPress = () => {
    if (!canScan) {
      analyticsService.logCustomEvent('scan_blocked_subscription');
      navigation.navigate('Subscription');
      return;
    }

    // Check if user has set their city
    if (!userProfile?.defaultCity) {
      analyticsService.logCustomEvent('scan_redirect_city_selection');
      navigation.navigate('CitySelection');
      return;
    }

    // User has city set, proceed to scanner
    analyticsService.logCustomEvent('scan_started');
    navigation.navigate('Scanner');
  };

  const isSubscribed = subscription?.isSubscribed;

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return {fr: 'Bonjour !', lingala: 'Mbote!'};
    if (hour < 18) return {fr: 'Bon après-midi !', lingala: 'Mbote!'};
    return {fr: 'Bonsoir !', lingala: 'Mbote na butu!'};
  };

  const greeting = getGreeting();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        
        {/* Greeting Header */}
        <View style={styles.header}>
          <View style={styles.greetingContainer}>
            <Text style={styles.greeting}>{greeting.fr}</Text>
            <Text style={styles.greetingLingala}>{greeting.lingala}</Text>
          </View>
          <View style={styles.logoContainer}>
            <Text style={styles.logo}>🛒</Text>
          </View>
        </View>

        {/* Trial/Subscription Status - Very visible */}
        {isTrialActive && (
          <View style={styles.statusCard}>
            <View style={styles.statusIconContainer}>
              <Text style={styles.statusIcon}>🎁</Text>
            </View>
            <View style={styles.statusTextContainer}>
              <Text style={styles.statusTitle}>Essai gratuit actif</Text>
              <Text style={styles.statusSubtitle}>
                {trialDaysRemaining > 0 
                  ? `${trialDaysRemaining} jours restants • Scans illimités`
                  : 'Dernière journée !'}
              </Text>
            </View>
          </View>
        )}

        {isSubscribed && (
          <View style={[styles.statusCard, styles.statusCardPremium]}>
            <View style={styles.statusIconContainer}>
              <Text style={styles.statusIcon}>⭐</Text>
            </View>
            <View style={styles.statusTextContainer}>
              <Text style={styles.statusTitle}>Abonné Premium</Text>
              <Text style={styles.statusSubtitle}>Scans illimités</Text>
            </View>
          </View>
        )}

        {/* MAIN SCAN BUTTON - Very large and prominent */}
        <TouchableOpacity
          style={[
            styles.mainScanButton,
            !canScan && styles.mainScanButtonDisabled,
          ]}
          onPress={handleScanPress}
          activeOpacity={0.8}>
          <View style={styles.scanButtonContent}>
            <Text style={styles.scanButtonIcon}>📸</Text>
            <Text style={styles.scanButtonTitle}>
              SCANNER
            </Text>
            <Text style={styles.scanButtonTitleLingala}>
              Zwa foto
            </Text>
            <Text style={styles.scanButtonSubtitle}>
              Appuyez ici pour prendre une photo
            </Text>
          </View>
          
          {/* Pulse animation hint */}
          <View style={styles.pulseRing} />
        </TouchableOpacity>

        {/* Simple 3-step guide */}
        <View style={styles.guideSection}>
          <Text style={styles.guideSectionTitle}>Comment utiliser ?</Text>
          
          <View style={styles.stepsContainer}>
            <View style={styles.stepCard}>
              <View style={[styles.stepNumber, {backgroundColor: '#10b981'}]}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={styles.stepIcon}>📷</Text>
              <Text style={styles.stepTitle}>Photo</Text>
              <Text style={styles.stepDesc}>Photographiez votre ticket</Text>
            </View>

            <View style={styles.stepArrow}>
              <Text style={styles.stepArrowText}>→</Text>
            </View>

            <View style={styles.stepCard}>
              <View style={[styles.stepNumber, {backgroundColor: '#6366f1'}]}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={styles.stepIcon}>🤖</Text>
              <Text style={styles.stepTitle}>Analyse</Text>
              <Text style={styles.stepDesc}>L'IA lit les prix</Text>
            </View>

            <View style={styles.stepArrow}>
              <Text style={styles.stepArrowText}>→</Text>
            </View>

            <View style={styles.stepCard}>
              <View style={[styles.stepNumber, {backgroundColor: '#f59e0b'}]}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={styles.stepIcon}>💰</Text>
              <Text style={styles.stepTitle}>Économies</Text>
              <Text style={styles.stepDesc}>Voyez les meilleurs prix</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions - Large touch targets */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => navigation.navigate('MultiPhotoScanner')}
            activeOpacity={0.7}>
            <Text style={styles.quickActionIcon}>📄</Text>
            <Text style={styles.quickActionTitle}>Longue facture</Text>
            <Text style={styles.quickActionSubtitle}>Mokanda molai</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => navigation.navigate('Main', {screen: 'History'} as any)}
            activeOpacity={0.7}>
            <Text style={styles.quickActionIcon}>📋</Text>
            <Text style={styles.quickActionTitle}>Mes factures</Text>
            <Text style={styles.quickActionSubtitle}>Voir l'historique</Text>
          </TouchableOpacity>
        </View>

        {/* More Quick Actions Row 2 */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => navigation.navigate('Main', {screen: 'Stats'} as any)}
            activeOpacity={0.7}>
            <Text style={styles.quickActionIcon}>📊</Text>
            <Text style={styles.quickActionTitle}>Mes dépenses</Text>
            <Text style={styles.quickActionSubtitle}>Voir les stats</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => navigation.navigate('Subscription')}
            activeOpacity={0.7}>
            <Text style={styles.quickActionIcon}>⭐</Text>
            <Text style={styles.quickActionTitle}>Premium</Text>
            <Text style={styles.quickActionSubtitle}>Plus de scans</Text>
          </TouchableOpacity>
        </View>

        {/* Phase 1.1 & 1.2 Features Row */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => navigation.navigate('PriceAlerts')}
            activeOpacity={0.7}>
            <Text style={styles.quickActionIcon}>🔔</Text>
            <Text style={styles.quickActionTitle}>Alertes Prix</Text>
            <Text style={styles.quickActionSubtitle}>Suivre les prix</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => navigation.navigate('ShoppingList')}
            activeOpacity={0.7}>
            <Text style={styles.quickActionIcon}>🛒</Text>
            <Text style={styles.quickActionTitle}>Liste Courses</Text>
            <Text style={styles.quickActionSubtitle}>Oyo ya kosomba</Text>
          </TouchableOpacity>
        </View>

        {/* More Phase 1.1 & 1.2 Features Row */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => navigation.navigate('AIAssistant')}
            activeOpacity={0.7}>
            <Text style={styles.quickActionIcon}>🤖</Text>
            <Text style={styles.quickActionTitle}>Assistant IA</Text>
            <Text style={styles.quickActionSubtitle}>Poser questions</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => navigation.navigate('Achievements')}
            activeOpacity={0.7}>
            <Text style={styles.quickActionIcon}>🏆</Text>
            <Text style={styles.quickActionTitle}>Mes Succès</Text>
            <Text style={styles.quickActionSubtitle}>Voir progrès</Text>
          </TouchableOpacity>
        </View>

        {/* Help/Support */}
        <TouchableOpacity style={styles.helpCard} activeOpacity={0.7}>
          <Text style={styles.helpIcon}>❓</Text>
          <View style={styles.helpTextContainer}>
            <Text style={styles.helpTitle}>Besoin d'aide ?</Text>
            <Text style={styles.helpSubtitle}>Appuyez ici pour voir le guide</Text>
          </View>
          <Text style={styles.helpArrow}>→</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0fdf4', // Light green background
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greetingContainer: {
    flex: 1,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.gray[900],
  },
  greetingLingala: {
    fontSize: 16,
    fontStyle: 'italic',
    color: COLORS.gray[500],
    marginTop: 2,
  },
  logoContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontSize: 36,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: COLORS.primary[300],
  },
  statusCardPremium: {
    backgroundColor: '#fef3c7',
    borderColor: '#fbbf24',
  },
  statusIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  statusIcon: {
    fontSize: 28,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.gray[900],
    marginBottom: 2,
  },
  statusSubtitle: {
    fontSize: 14,
    color: COLORS.gray[600],
  },
  mainScanButton: {
    backgroundColor: COLORS.primary[500],
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: COLORS.primary[600],
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  mainScanButtonDisabled: {
    backgroundColor: COLORS.gray[300],
    shadowColor: COLORS.gray[400],
  },
  scanButtonContent: {
    alignItems: 'center',
    zIndex: 1,
  },
  scanButtonIcon: {
    fontSize: 72,
    marginBottom: 16,
  },
  scanButtonTitle: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 4,
  },
  scanButtonTitleLingala: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 18,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  scanButtonSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    textAlign: 'center',
  },
  pulseRing: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 34,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  guideSection: {
    marginBottom: 24,
  },
  guideSectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.gray[900],
    marginBottom: 16,
    textAlign: 'center',
  },
  stepsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
  },
  stepNumber: {
    position: 'absolute',
    top: -10,
    left: -10,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  stepIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.gray[900],
    marginBottom: 4,
  },
  stepDesc: {
    fontSize: 11,
    color: COLORS.gray[500],
    textAlign: 'center',
  },
  stepArrow: {
    paddingHorizontal: 4,
  },
  stepArrowText: {
    fontSize: 20,
    color: COLORS.gray[300],
    fontWeight: 'bold',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.gray[900],
    marginBottom: 4,
  },
  quickActionSubtitle: {
    fontSize: 12,
    color: COLORS.gray[500],
  },
  helpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
  },
  helpIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  helpTextContainer: {
    flex: 1,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.gray[900],
    marginBottom: 2,
  },
  helpSubtitle: {
    fontSize: 13,
    color: COLORS.gray[500],
  },
  helpArrow: {
    fontSize: 20,
    color: COLORS.gray[400],
    fontWeight: 'bold',
  },
});

export default HomeScreen;
