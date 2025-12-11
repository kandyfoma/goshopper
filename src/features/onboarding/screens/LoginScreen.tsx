// Login Screen - Comprehensive authentication with Urbanist design
import React, {useState, useRef, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Animated,
  Keyboard,
  StatusBar,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SvgXml} from 'react-native-svg';
import {RootStackParamList} from '@/shared/types';
import {authService} from '@/shared/services/firebase';
import {useAuth} from '@/shared/contexts';
import {Icon} from '@/shared/components';
import {logoUrbanistSvg} from '../../../../assets/logo-icon';

// Urbanist Design Colors
const URBANIST = {
  background: '#F6F5FA',    // Ghost White
  cardBg: '#FFFFFF',
  primaryAccent: '#D8DFE9', // Alice Blue
  secondaryAccent: '#CFDECA', // Honeydew
  highlightAccent: '#EFF0A3', // Vanilla
  textPrimary: '#212121',    // Eerie Black
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  primary: '#8B5CF6',
  success: '#10B981',
  error: '#EF4444',
  border: '#E5E7EB',
  white: '#FFFFFF',
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Firebase error messages in French
const getErrorMessage = (errorCode: string): string => {
  const errorMessages: Record<string, string> = {
    'auth/invalid-email': "L'adresse email est invalide.",
    'auth/user-disabled': 'Ce compte a été désactivé.',
    'auth/user-not-found': 'Aucun compte trouvé avec cet email.',
    'auth/wrong-password': 'Mot de passe incorrect.',
    'auth/invalid-credential': 'Email ou mot de passe incorrect.',
    'auth/too-many-requests': 'Trop de tentatives. Réessayez plus tard.',
    'auth/network-request-failed': 'Erreur réseau. Vérifiez votre connexion.',
    'auth/operation-not-allowed':
      "Cette méthode de connexion n'est pas activée.",
  };
  return (
    errorMessages[errorCode] || 'Une erreur est survenue. Veuillez réessayer.'
  );
};

export function LoginScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const {signInWithGoogle, signInWithApple} = useAuth();

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Refs
  const passwordInputRef = useRef<TextInput>(null);
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Animations on mount
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Shake animation for errors
  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnimation, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: -10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Validate email
  const validateEmail = (value: string): boolean => {
    if (!value.trim()) {
      setEmailError("L'email est requis");
      return false;
    }
    if (!EMAIL_REGEX.test(value)) {
      setEmailError("Format d'email invalide");
      return false;
    }
    setEmailError(null);
    return true;
  };

  // Validate password
  const validatePassword = (value: string): boolean => {
    if (!value) {
      setPasswordError('Le mot de passe est requis');
      return false;
    }
    if (value.length < 6) {
      setPasswordError('Le mot de passe doit contenir au moins 6 caractères');
      return false;
    }
    setPasswordError(null);
    return true;
  };

  // Handle login
  const handleLogin = async () => {
    Keyboard.dismiss();
    setError(null);
    setSuccessMessage(null);

    // Validate inputs
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (!isEmailValid || !isPasswordValid) {
      triggerShake();
      return;
    }

    setLoading(true);
    try {
      await authService.signInWithEmail(email.trim(), password);
      setSuccessMessage('Connexion réussie!');
    } catch (err: any) {
      const errorMessage = getErrorMessage(err.code || '');
      setError(errorMessage);
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  // Handle forgot password
  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setEmailError('Entrez votre email pour réinitialiser');
      triggerShake();
      return;
    }

    if (!EMAIL_REGEX.test(email)) {
      setEmailError("Format d'email invalide");
      triggerShake();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await authService.sendPasswordResetEmail(email.trim());
      setSuccessMessage('Email de réinitialisation envoyé!');
    } catch (err: any) {
      setError(getErrorMessage(err.code || ''));
    } finally {
      setLoading(false);
    }
  };

  // Handle Google sign in
  const handleGoogleSignIn = async () => {
    setSocialLoading('google');
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err?.message || 'Échec de la connexion Google');
    } finally {
      setSocialLoading(null);
    }
  };

  // Handle Apple sign in
  const handleAppleSignIn = async () => {
    setSocialLoading('apple');
    setError(null);
    try {
      await signInWithApple();
    } catch (err: any) {
      setError(err?.message || 'Échec de la connexion Apple');
    } finally {
      setSocialLoading(null);
    }
  };

  // Handle skip
  const handleSkip = () => {
    navigation.navigate('MainTab' as never);
  };

  // Clear field errors on change
  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (emailError) setEmailError(null);
    if (error) setError(null);
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (passwordError) setPasswordError(null);
    if (error) setError(null);
  };

  const isLoading = loading || socialLoading !== null;

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor={URBANIST.background} />

      {/* Header with Skip */}
      <View style={styles.header}>
        <View style={{width: 70}} />
        <TouchableOpacity
          onPress={handleSkip}
          style={styles.skipButton}
          activeOpacity={0.7}
          disabled={isLoading}>
          <Text style={styles.skipText}>Ignorer</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, {paddingBottom: insets.bottom + 24}]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          
          <Animated.View
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [{translateY: slideAnim}],
              },
            ]}>
            
            {/* Logo & Title */}
            <View style={styles.logoSection}>
              <View style={styles.logoWrapper}>
                <SvgXml xml={logoUrbanistSvg} width={80} height={80} />
              </View>
              <Text style={styles.appName}>GoShopperAI</Text>
              <Text style={styles.tagline}>Scannez vos reçus, économisez plus</Text>
            </View>

            {/* Success Message */}
            {successMessage && (
              <View style={styles.successBanner}>
                <Icon name="checkbox-circle-line" size="sm" color={URBANIST.success} />
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
            )}

            {/* Error Message */}
            {error && (
              <Animated.View
                style={[styles.errorBanner, {transform: [{translateX: shakeAnimation}]}]}>
                <Icon name="error-warning-line" size="sm" color={URBANIST.error} />
                <Text style={styles.errorText}>{error}</Text>
              </Animated.View>
            )}

            {/* Login Card */}
            <View style={styles.loginCard}>
              {/* Email Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <View style={[
                  styles.inputWrapper,
                  emailError && styles.inputError,
                  isLoading && styles.inputDisabled,
                ]}>
                  <Icon name="mail-line" size="sm" color={URBANIST.textMuted} />
                  <TextInput
                    style={styles.input}
                    placeholder="votre@email.com"
                    placeholderTextColor={URBANIST.textMuted}
                    value={email}
                    onChangeText={handleEmailChange}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                    returnKeyType="next"
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                  />
                </View>
                {emailError && <Text style={styles.fieldError}>{emailError}</Text>}
              </View>

              {/* Password Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Mot de passe</Text>
                <View style={[
                  styles.inputWrapper,
                  passwordError && styles.inputError,
                  isLoading && styles.inputDisabled,
                ]}>
                  <Icon name="lock-line" size="sm" color={URBANIST.textMuted} />
                  <TextInput
                    ref={passwordInputRef}
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor={URBANIST.textMuted}
                    value={password}
                    onChangeText={handlePasswordChange}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    editable={!isLoading}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                    disabled={isLoading}>
                    <Icon
                      name={showPassword ? 'eye-line' : 'eye-off-line'}
                      size="sm"
                      color={URBANIST.textMuted}
                    />
                  </TouchableOpacity>
                </View>
                {passwordError && <Text style={styles.fieldError}>{passwordError}</Text>}
              </View>

              {/* Forgot Password */}
              <TouchableOpacity
                onPress={handleForgotPassword}
                disabled={isLoading}
                style={styles.forgotPasswordButton}>
                <Text style={styles.forgotPasswordText}>Mot de passe oublié?</Text>
              </TouchableOpacity>

              {/* Login Button */}
              <TouchableOpacity
                style={[styles.loginButton, isLoading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={isLoading}
                activeOpacity={0.8}>
                {loading ? (
                  <ActivityIndicator color={URBANIST.white} size="small" />
                ) : (
                  <>
                    <Text style={styles.loginButtonText}>Se connecter</Text>
                    <Icon name="arrow-right-line" size="sm" color={URBANIST.white} />
                  </>
                )}
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>ou continuer avec</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Social Buttons - Platform specific */}
              <View style={styles.socialButtons}>
                {/* Google Sign-In - Android only */}
                {Platform.OS === 'android' && (
                  <TouchableOpacity
                    style={[styles.socialButton, styles.singleSocialButton, isLoading && styles.buttonDisabled]}
                    onPress={handleGoogleSignIn}
                    disabled={isLoading}
                    activeOpacity={0.7}>
                    {socialLoading === 'google' ? (
                      <ActivityIndicator size="small" color={URBANIST.textPrimary} />
                    ) : (
                      <>
                        <Text style={styles.googleIcon}>G</Text>
                        <Text style={styles.socialButtonText}>Continuer avec Google</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {/* Apple Sign-In - iOS only */}
                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={[styles.socialButton, styles.appleButton, styles.singleSocialButton, isLoading && styles.buttonDisabled]}
                    onPress={handleAppleSignIn}
                    disabled={isLoading}
                    activeOpacity={0.7}>
                    {socialLoading === 'apple' ? (
                      <ActivityIndicator size="small" color={URBANIST.white} />
                    ) : (
                      <>
                        <Icon name="apple-fill" size="sm" color={URBANIST.white} />
                        <Text style={[styles.socialButtonText, styles.appleButtonText]}>Continuer avec Apple</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Register Link */}
            <View style={styles.registerRow}>
              <Text style={styles.registerText}>Vous n'avez pas de compte?</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')} disabled={isLoading}>
                <Text style={styles.registerLink}> Créer un compte</Text>
              </TouchableOpacity>
            </View>

            {/* Terms */}
            <Text style={styles.termsText}>
              En vous connectant, vous acceptez nos{' '}
              <Text style={styles.termsLink}>Conditions d'utilisation</Text>
              {' '}et notre{' '}
              <Text style={styles.termsLink}>Politique de confidentialité</Text>
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: URBANIST.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: URBANIST.cardBg,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  skipText: {
    fontSize: 14,
    color: URBANIST.textSecondary,
    fontWeight: '600',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
  },

  // Logo Section
  logoSection: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 16,
  },
  logoWrapper: {
    width: 88,
    height: 88,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    color: URBANIST.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: URBANIST.textSecondary,
    textAlign: 'center',
  },

  // Banners
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  successText: {
    flex: 1,
    color: URBANIST.success,
    fontSize: 14,
    fontWeight: '500',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  errorText: {
    flex: 1,
    color: URBANIST.error,
    fontSize: 14,
    fontWeight: '500',
  },

  // Login Card
  loginCard: {
    backgroundColor: URBANIST.cardBg,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    marginBottom: 24,
  },

  // Input Groups
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: URBANIST.textPrimary,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: URBANIST.background,
    borderWidth: 1.5,
    borderColor: URBANIST.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    gap: 10,
  },
  inputError: {
    borderColor: URBANIST.error,
    backgroundColor: '#FEF2F2',
  },
  inputDisabled: {
    opacity: 0.6,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: URBANIST.textPrimary,
  },
  eyeButton: {
    padding: 4,
  },
  fieldError: {
    color: URBANIST.error,
    fontSize: 13,
    marginTop: 6,
    marginLeft: 4,
  },

  // Forgot Password
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: URBANIST.primary,
    fontWeight: '600',
  },

  // Login Button
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: URBANIST.textPrimary,
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: URBANIST.white,
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: URBANIST.border,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 13,
    color: URBANIST.textMuted,
  },

  // Social Buttons
  socialButtons: {
    flexDirection: 'column',
    gap: 12,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: URBANIST.cardBg,
    borderWidth: 1.5,
    borderColor: URBANIST.border,
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
  },
  singleSocialButton: {
    flex: 0,
    width: '100%',
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4285F4',
  },
  socialButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: URBANIST.textPrimary,
  },
  appleButton: {
    backgroundColor: URBANIST.textPrimary,
    borderColor: URBANIST.textPrimary,
  },
  appleButtonText: {
    color: URBANIST.white,
  },

  // Register Row
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  registerText: {
    fontSize: 14,
    color: URBANIST.textSecondary,
  },
  registerLink: {
    fontSize: 14,
    fontWeight: '700',
    color: URBANIST.primary,
  },

  // Terms
  termsText: {
    fontSize: 13,
    color: URBANIST.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  termsLink: {
    color: URBANIST.primary,
    fontWeight: '600',
  },
});
