// Forgot Password Screen - SMS OTP based password reset
import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '@/shared/types';
import {Button, Icon} from '@/shared/components';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
} from '@/shared/theme/theme';
import {TextInput, TouchableOpacity} from 'react-native-gesture-handler';
import {smsService} from '@/shared/services/sms';
import {PhoneService} from '@/shared/services/phone';
import {countryCodeList} from '@/shared/constants/countries';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const ForgotPasswordScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [selectedCountry, setSelectedCountry] = useState(countryCodeList[0]); // Default to RDC
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCountryModal, setShowCountryModal] = useState(false);

  const validatePhoneNumber = (phone: string): boolean => {
    if (!phone.trim()) return false;
    const formatted = PhoneService.formatPhoneNumber(selectedCountry.code, phone);
    return PhoneService.validatePhoneNumber(formatted);
  };

  const handleSendOTP = async () => {
    if (!phoneNumber.trim()) {
      setError('Veuillez saisir votre numéro de téléphone');
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      setError('Veuillez saisir un numéro de téléphone valide');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formattedPhone = PhoneService.formatPhoneNumber(selectedCountry.code, phoneNumber);
      
      // Check if phone exists in database
      const phoneExists = await PhoneService.checkPhoneExists(formattedPhone);
      
      if (!phoneExists) {
        setError('Ce numéro n\'existe pas. Veuillez vous inscrire.');
        setLoading(false);
        return;
      }
      
      const result = await smsService.sendOTP(formattedPhone);
      
      if (result.success) {
        // Navigate to OTP verification screen
        navigation.navigate('VerifyOtp', { phoneNumber: formattedPhone });
      } else {
        setError(result.error || 'Erreur lors de l\'envoi du code');
      }
    } catch (err) {
      console.error('Error in forgot password:', err);
      setError('Erreur réseau. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneChange = (value: string) => {
    // Clean the input and format it
    let cleanText = value.replace(/[^0-9]/g, '');
    
    // Remove leading zero if present (handle 088 -> 88 case)
    if (cleanText.startsWith('0')) {
      cleanText = cleanText.substring(1);
    }
    
    // Limit to 9 digits maximum
    if (cleanText.length > 9) {
      cleanText = cleanText.substring(0, 9);
    }
    
    setPhoneNumber(cleanText);
    if (error) {
      setError(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}>
              <Icon name="arrow-left" size="md" color={Colors.text.primary} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {/* Icon */}
            <View style={styles.iconContainer}>
              <Icon name="lock" size="3xl" color={Colors.accent} />
            </View>

            {/* Title */}
            <Text style={styles.title}>Mot de passe oublié</Text>
            <Text style={styles.subtitle}>
              Entrez votre numéro de téléphone pour recevoir un code de vérification
            </Text>

            {/* Phone Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Numéro de téléphone</Text>
              <View style={styles.phoneRow}>
                {/* Country Selector */}
                <TouchableOpacity
                  style={styles.countrySelector}
                  onPress={() => setShowCountryModal(true)}>
                  <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                  <Text style={styles.countryCode}>{selectedCountry.code}</Text>
                  <Icon name="chevron-down" size="sm" color={Colors.text.secondary} />
                </TouchableOpacity>

                {/* Phone Input */}
                <View style={[styles.phoneInputWrapper, !!error && styles.inputError]}>
                  <Icon name="phone" size="sm" color={Colors.text.secondary} />
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="88 123 4567"
                    placeholderTextColor={Colors.text.tertiary}
                    value={phoneNumber}
                    onChangeText={handlePhoneChange}
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
              </View>
              </View>
              {error && <Text style={styles.errorText}>{error}</Text>}
            </View>

            {/* Send OTP Button */}
            <Button
              title="Envoyer le code"
              onPress={handleSendOTP}
              disabled={loading || !phoneNumber.trim()}
              loading={loading}
              icon={<Icon name="arrow-right" size="md" color={Colors.white} />}
              iconPosition="right"
              fullWidth
            />

            {/* Back to Login */}
            <View style={styles.backToLogin}>
              <Text style={styles.backToLoginText}>
                Vous vous souvenez de votre mot de passe ?
              </Text>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={styles.backToLoginLink}> Se connecter</Text>
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={styles.guestFooter}>
              <Text style={styles.footerText}>
                Récupérer votre compte c'est{' '}
                <Text style={styles.footerHighlight}>gratuit, rapide et sécurisé</Text>
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Country Selection Modal */}
      <Modal
        visible={showCountryModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCountryModal(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sélectionner un pays</Text>
              <TouchableOpacity onPress={() => setShowCountryModal(false)}>
                <Icon name="x" size="md" color={Colors.text.primary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={countryCodeList}
              keyExtractor={(item) => item.code}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={styles.countryItem}
                  onPress={() => {
                    setSelectedCountry(item);
                    setShowCountryModal(false);
                  }}>
                  <Text style={styles.countryFlag}>{item.flag}</Text>
                  <Text style={styles.countryName}>{item.name}</Text>
                  <Text style={styles.countryCode}>{item.code}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
  },
  header: {
    paddingTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing['2xl'],
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius['2xl'],
    backgroundColor: Colors.card.blue,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing['2xl'],
    lineHeight: 22,
    paddingHorizontal: Spacing.sm,
    flexWrap: 'wrap',
  },
  inputContainer: {
    marginBottom: Spacing.xl,
  },
  inputLabel: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 12,
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: '#FDB913',
    gap: Spacing.xs,
  },
  countryFlag: {
    fontSize: 24,
  },
  countryCode: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
  },
  phoneInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.base,
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: '#FDB913',
    gap: Spacing.md,
  },
  phoneInput: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.primary,
    paddingVertical: Spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.base,
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: '#FDB913',
    gap: Spacing.md,
  },
  inputError: {
    borderColor: Colors.status.error,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  input: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.primary,
    paddingVertical: Spacing.sm,
  },
  errorText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.status.error,
    marginTop: Spacing.xs,
    marginLeft: Spacing.xs,
  },
  backToLogin: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.xl,
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
  },
  backToLoginText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  backToLoginLink: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.primary,
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    paddingTop: Spacing.xl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.base,
  },
  modalTitle: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.base,
    gap: Spacing.md,
  },
  countryName: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.primary,
  },

  // Guest Footer
  guestFooter: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    marginTop: Spacing.base,
    paddingHorizontal: Spacing.md,
  },
  footerText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    flexWrap: 'wrap',
  },
  footerHighlight: {
    fontFamily: Typography.fontFamily.bold,
    color: Colors.primary,
  },
});

export default ForgotPasswordScreen;
