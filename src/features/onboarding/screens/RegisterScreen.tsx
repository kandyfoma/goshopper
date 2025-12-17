// Register Screen - Email/password registration
import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '@/shared/types';
import {authService} from '@/shared/services/firebase';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {Icon} from '@/shared/components';
import {useAuth} from '@/shared/contexts';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function RegisterScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {signInWithGoogle, signInWithApple, signInWithFacebook} = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [showVerification, setShowVerification] = useState(false);
  const [verificationId, setVerificationId] = useState('');
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | 'facebook' | null>(
    null,
  );

  const handleRegister = async () => {
    if (!phoneNumber || !password || !confirmPassword) {
      Alert.alert('Erreur', 'Veuillez saisir un numéro de téléphone et un mot de passe');
      return;
    }

    // Validate phone number format (basic validation)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber.replace(/\s/g, ''))) {
      Alert.alert('Erreur', 'Veuillez saisir un numéro de téléphone valide');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }

    if (password.length < 6) {
      Alert.alert(
        'Erreur',
        'Le mot de passe doit contenir au moins 6 caractères',
      );
      return;
    }

    setLoading(true);
    try {
      // Start phone verification
      const confirmation = await authService.signUpWithPhoneNumber(phoneNumber, email);
      setVerificationId(confirmation.verificationId);
      setShowVerification(true);
      Alert.alert('Code envoyé', 'Un code de vérification a été envoyé à votre téléphone');
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Inscription échouée');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      Alert.alert('Erreur', 'Veuillez saisir le code de vérification à 6 chiffres');
      return;
    }

    setLoading(true);
    try {
      await authService.confirmPhoneVerification(verificationId, verificationCode, password, email);
      Alert.alert('Succès', 'Votre compte a été créé avec succès !');
      // Navigation will be handled by AuthContext
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Code de vérification invalide');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setLoading(true);
    try {
      console.log('🔄 Resending OTP to:', phoneNumber);
      const confirmation = await authService.resendOTP(phoneNumber);
      setVerificationId(confirmation.verificationId);
      Alert.alert('Code renvoyé', 'Un nouveau code de vérification a été envoyé');
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Échec de renvoi du code');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setSocialLoading('google');
    try {
      await signInWithGoogle();
    } catch (err: any) {
      Alert.alert('Erreur', err?.message || 'Échec de la connexion Google');
    } finally {
      setSocialLoading(null);
    }
  };

  const handleAppleSignIn = async () => {
    setSocialLoading('apple');
    try {
      await signInWithApple();
    } catch (err: any) {
      Alert.alert('Erreur', err?.message || 'Échec de la connexion Apple');
    } finally {
      setSocialLoading(null);
    }
  };

  const handleFacebookSignIn = async () => {
    setSocialLoading('facebook');
    try {
      await signInWithFacebook();
    } catch (err: any) {
      Alert.alert('Erreur', err?.message || 'Échec de la connexion Facebook');
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Icon
                name="user-plus"
                size="2xl"
                color={Colors.text.primary}
                variant="filled"
              />
            </View>
            <Text style={styles.title}>Créer un compte</Text>
            <Text style={styles.subtitle}>
              Commencez à économiser aujourd'hui
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Numéro de téléphone *</Text>
              <View style={styles.inputWrapper}>
                <Icon name="phone" size="md" color={Colors.text.secondary} />
                <TextInput
                  style={styles.input}
                  placeholder="+243 xxx xxx xxx"
                  placeholderTextColor={Colors.text.tertiary}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading && !showVerification}
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email (optionnel)</Text>
              <View style={styles.inputWrapper}>
                <Icon name="mail" size="md" color={Colors.text.secondary} />
                <TextInput
                  style={styles.input}
                  placeholder="votre@email.com"
                  placeholderTextColor={Colors.text.tertiary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading && !showVerification}
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Mot de passe</Text>
              <View style={styles.inputWrapper}>
                <Icon name="lock" size="md" color={Colors.text.secondary} />
                <TextInput
                  style={styles.input}
                  placeholder="Au moins 6 caractères"
                  placeholderTextColor={Colors.text.tertiary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  editable={!loading}
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirmer le mot de passe</Text>
              <View style={styles.inputWrapper}>
                <Icon name="lock" size="md" color={Colors.text.secondary} />
                <TextInput
                  style={styles.input}
                  placeholder="Répétez le mot de passe"
                  placeholderTextColor={Colors.text.tertiary}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  editable={!loading}
                />
              </View>
            </View>

            {showVerification && (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Code de vérification</Text>
                <View style={styles.inputWrapper}>
                  <Icon name="key" size="md" color={Colors.text.secondary} />
                  <TextInput
                    style={styles.input}
                    placeholder="Code à 6 chiffres"
                    placeholderTextColor={Colors.text.tertiary}
                    value={verificationCode}
                    onChangeText={setVerificationCode}
                    keyboardType="number-pad"
                    maxLength={6}
                    editable={!loading}
                  />
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={showVerification ? handleVerifyCode : handleRegister}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <View style={styles.buttonInner}>
                  <Text style={styles.buttonText}>
                    {showVerification ? 'Vérifier le code' : 'S\'inscrire'}
                  </Text>
                  <Icon name="arrow-right" size="md" color={Colors.white} />
                </View>
              )}
            </TouchableOpacity>

            {showVerification && (
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={handleResendOTP}
                disabled={loading}>
                <View style={styles.buttonInner}>
                  <Icon name="refresh-cw" size="md" color={Colors.primary} />
                  <Text style={styles.secondaryButtonText}>
                    Renvoyer le code
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social buttons */}
            <TouchableOpacity
              style={[styles.button, styles.socialButton]}
              onPress={handleGoogleSignIn}
              disabled={loading || socialLoading !== null}>
              {socialLoading === 'google' ? (
                <ActivityIndicator color={Colors.text.primary} />
              ) : (
                <>
                  <Text style={styles.googleIcon}>G</Text>
                  <Text style={styles.socialButtonText}>
                    Continuer avec Google
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[styles.button, styles.socialButton, styles.appleButton]}
                onPress={handleAppleSignIn}
                disabled={loading || socialLoading !== null}>
                {socialLoading === 'apple' ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <>
                    <Icon name="apple" size="md" color={Colors.white} />
                    <Text
                      style={[styles.socialButtonText, styles.appleButtonText]}>
                      Continuer avec Apple
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.button, styles.socialButton, styles.facebookButton]}
              onPress={handleFacebookSignIn}
              disabled={loading || socialLoading !== null}>
              {socialLoading === 'facebook' ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Text style={styles.facebookIcon}>f</Text>
                  <Text
                    style={[styles.socialButtonText, styles.facebookButtonText]}>
                    Continuer avec Facebook
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Vous avez déjà un compte ?</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              disabled={loading}>
              <Text style={styles.linkText}>Se connecter</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

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
    padding: Spacing.xl,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius['2xl'],
    backgroundColor: Colors.card.cream,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    ...Shadows.md,
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
  },
  form: {
    marginBottom: Spacing['2xl'],
  },
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border.light,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.base,
    backgroundColor: Colors.white,
    gap: Spacing.md,
  },
  input: {
    flex: 1,
    paddingVertical: Spacing.base,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.primary,
  },
  button: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  primaryButton: {
    backgroundColor: Colors.text.primary,
    ...Shadows.md,
  },
  secondaryButton: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  buttonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border.light,
  },
  dividerText: {
    marginHorizontal: Spacing.base,
    color: Colors.text.tertiary,
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.regular,
  },
  socialButton: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border.light,
    borderRadius: BorderRadius.xl,
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  googleIcon: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: '#4285F4',
  },
  socialButtonText: {
    color: Colors.text.primary,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.semiBold,
  },
  appleButton: {
    backgroundColor: Colors.text.primary,
    borderColor: Colors.text.primary,
  },
  appleButtonText: {
    color: Colors.white,
  },
  facebookButton: {
    backgroundColor: '#1877F2',
    borderColor: '#1877F2',
  },
  facebookButtonText: {
    color: Colors.white,
  },
  facebookIcon: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.white,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  footerText: {
    color: Colors.text.secondary,
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.regular,
  },
  linkText: {
    color: Colors.accent,
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.bold,
  },
});

export default RegisterScreen;
