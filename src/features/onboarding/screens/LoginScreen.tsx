// Login Screen - Comprehensive authentication with GOCHUJANG design
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
  Alert,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SvgXml} from 'react-native-svg';
import {RootStackParamList} from '@/shared/types';
import {authService} from '@/shared/services/firebase';
import {biometricService, BiometricStatus} from '@/shared/services/biometric';
import {useAuth, useToast} from '@/shared/contexts';
import {Icon} from '@/shared/components';
import Logo from '@/shared/components/Logo';


// Gochujang Warm Design Colors
const GOCHUJANG = {
  background: '#FFFFFF', // White
  cardBg: '#FFFFFF',
  primaryAccent: '#669BBC', // Blue Marble
  secondaryAccent: '#FDF0D5', // Varden Cream
  highlightAccent: '#F5E6C3', // Warm Beige
  textPrimary: '#780000', // Gochujang Red
  textSecondary: '#003049', // Cosmos Blue
  textMuted: '#669BBC', // Blue Marble
  primary: '#C1121F', // Crimson Blaze
  success: '#22C55E',
  error: '#C1121F', // Crimson Blaze
  border: '#F5E6C3',
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
  const {signInWithGoogle, signInWithApple, signInWithFacebook} = useAuth();
  const {showToast} = useToast();

  // Form state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | 'facebook' | null>(
    null,
  );
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricStatus, setBiometricStatus] = useState<BiometricStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
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

  // Validate phone number
  const validatePhoneNumber = (value: string): boolean => {
    if (!value.trim()) {
      setPhoneError('Le numéro de téléphone est requis');
      return false;
    }
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(value.replace(/\s/g, ''))) {
      setPhoneError('Format de numéro invalide');
      return false;
    }
    setPhoneError(null);
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
    const isPhoneValid = validatePhoneNumber(phoneNumber);
    const isPasswordValid = validatePassword(password);

    if (!isPhoneValid || !isPasswordValid) {
      triggerShake();
      return;
    }

    setLoading(true);
    try {
      await authService.signInWithPhone(phoneNumber.trim(), password);
      setSuccessMessage('Connexion réussie!');
    } catch (err: any) {
      const errorMessage = getErrorMessage(err.code || '');
      setError(errorMessage);
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  // Handle forgot password - redirect to contact support
  const handleForgotPassword = () => {
    Alert.alert(
      'Mot de passe oublié',
      'Pour réinitialiser votre mot de passe, veuillez contacter notre support.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Contacter le support', onPress: () => navigation.navigate('Contact') }
      ]
    );
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

  // Handle Facebook sign in
  const handleFacebookSignIn = async () => {
    setSocialLoading('facebook');
    setError(null);
    try {
      await signInWithFacebook();
    } catch (err: any) {
      setError(err?.message || 'Échec de la connexion Facebook');
    } finally {
      setSocialLoading(null);
    }
  };

  // Check biometric availability on mount
  useEffect(() => {
    const checkBiometric = async () => {
      const status = await biometricService.getStatus();
      setBiometricStatus(status);
    };
    checkBiometric();
  }, []);

  // Handle biometric login
  const handleBiometricLogin = async () => {
    setBiometricLoading(true);
    setError(null);
    try {
      const result = await biometricService.login();
      if (result.success && result.credentials) {
        // Auto-fill phone and show success
        setPhoneNumber(result.credentials.phoneNumber || result.credentials.email || '');
        setSuccessMessage('Connexion biométrique réussie!');
        showToast('Connexion biométrique réussie!', 'success', 2000);
        // Navigate to main app
        setTimeout(() => {
          navigation.navigate('MainTab' as never);
        }, 2000);
      } else {
        setError(result.error || 'Authentification échouée');
      }
    } catch (err: any) {
      setError(err?.message || 'Échec de la connexion biométrique');
    } finally {
      setBiometricLoading(false);
    }
  };

  // Clear field errors on change
  const handlePhoneChange = (value: string) => {
    setPhoneNumber(value);
    if (phoneError) {
      setPhoneError(null);
    }
    if (error) {
      setError(null);
    }
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (passwordError) {
      setPasswordError(null);
    }
    if (error) {
      setError(null);
    }
  };

  const isLoading = loading || socialLoading !== null;

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFFFFF"
      />

      {/* Header */}
      <View style={styles.header}>
        <View style={{width: 70}} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {paddingBottom: insets.bottom + 24},
          ]}
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
                <Logo size={80} pulseOnLoad />
              </View>
              <Text style={styles.appName}>GoShopperAI</Text>
              <Text style={styles.tagline}>
                Scannez vos reçus, économisez plus
              </Text>
            </View>

            {/* Success Message */}
            {successMessage && (
              <View style={styles.successBanner}>
                <Icon name="check-circle" size="sm" color={GOCHUJANG.success} />
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
            )}

            {/* Error Message */}
            {error && (
              <Animated.View
                style={[
                  styles.errorBanner,
                  {transform: [{translateX: shakeAnimation}]},
                ]}>
                <Icon name="alert-triangle" size="sm" color={GOCHUJANG.error} />
                <Text style={styles.errorText}>{error}</Text>
              </Animated.View>
            )}

            {/* Login Card */}
            <View style={styles.loginCard}>
              {/* Phone Number Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Numéro de téléphone</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    !!phoneError && styles.inputError,
                    isLoading && styles.inputDisabled,
                  ]}>
                  <Icon name="phone" size="sm" color={GOCHUJANG.textMuted} />
                  <TextInput
                    style={styles.input}
                    placeholder="+243 xxx xxx xxx"
                    placeholderTextColor={GOCHUJANG.textMuted}
                    value={phoneNumber}
                    onChangeText={handlePhoneChange}
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                    returnKeyType="next"
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                  />
                </View>
                {phoneError && (
                  <Text style={styles.fieldError}>{phoneError}</Text>
                )}
              </View>

              {/* Password Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Mot de passe</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    !!passwordError && styles.inputError,
                    isLoading && styles.inputDisabled,
                  ]}>
                  <Icon name="lock" size="sm" color={GOCHUJANG.textMuted} />
                  <TextInput
                    ref={passwordInputRef}
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor={GOCHUJANG.textMuted}
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
                      name={showPassword ? 'eye' : 'eye-off'}
                      size="sm"
                      color={GOCHUJANG.textMuted}
                    />
                  </TouchableOpacity>
                </View>
                {passwordError && (
                  <Text style={styles.fieldError}>{passwordError}</Text>
                )}
              </View>

              {/* Forgot Password */}
              <TouchableOpacity
                onPress={handleForgotPassword}
                disabled={isLoading}
                style={styles.forgotPasswordButton}>
                <Text style={styles.forgotPasswordText}>
                  Mot de passe oublié?
                </Text>
              </TouchableOpacity>

              {/* Login Button */}
              <TouchableOpacity
                style={[styles.loginButton, isLoading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={isLoading}
                activeOpacity={0.8}>
                {loading ? (
                  <ActivityIndicator color={GOCHUJANG.white} size="small" />
                ) : (
                  <>
                    <Text style={styles.loginButtonText}>Se connecter</Text>
                    <Icon name="arrow-right" size="sm" color={GOCHUJANG.white} />
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
                    style={[
                      styles.socialButton,
                      styles.singleSocialButton,
                      isLoading && styles.buttonDisabled,
                    ]}
                    onPress={handleGoogleSignIn}
                    disabled={isLoading}
                    activeOpacity={0.7}>
                    {socialLoading === 'google' ? (
                      <ActivityIndicator
                        size="small"
                        color={GOCHUJANG.textPrimary}
                      />
                    ) : (
                      <>
                        <Text style={styles.googleIcon}>G</Text>
                        <Text style={styles.socialButtonText}>
                          Continuer avec Google
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {/* Apple Sign-In - iOS only */}
                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={[
                      styles.socialButton,
                      styles.appleButton,
                      styles.singleSocialButton,
                      isLoading && styles.buttonDisabled,
                    ]}
                    onPress={handleAppleSignIn}
                    disabled={isLoading}
                    activeOpacity={0.7}>
                    {socialLoading === 'apple' ? (
                      <ActivityIndicator size="small" color={GOCHUJANG.white} />
                    ) : (
                      <>
                        <Icon name="apple" size="sm" color={GOCHUJANG.white} />
                        <Text
                          style={[
                            styles.socialButtonText,
                            styles.appleButtonText,
                          ]}>
                          Continuer avec Apple
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {/* Facebook Sign-In - All platforms */}
                <TouchableOpacity
                  style={[
                    styles.socialButton,
                    styles.facebookButton,
                    styles.singleSocialButton,
                    isLoading && styles.buttonDisabled,
                  ]}
                  onPress={handleFacebookSignIn}
                  disabled={isLoading}
                  activeOpacity={0.7}>
                  {socialLoading === 'facebook' ? (
                    <ActivityIndicator size="small" color={GOCHUJANG.white} />
                  ) : (
                    <>
                      <Text style={styles.facebookIcon}>f</Text>
                      <Text
                        style={[
                          styles.socialButtonText,
                          styles.facebookButtonText,
                        ]}>
                        Continuer avec Facebook
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Biometric Login Button */}
              {biometricStatus?.isAvailable && biometricStatus?.isEnabled && (
                <>
                  <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>ou</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.biometricButton,
                      isLoading && styles.buttonDisabled,
                    ]}
                    onPress={handleBiometricLogin}
                    disabled={isLoading || biometricLoading}
                    activeOpacity={0.7}>
                    {biometricLoading ? (
                      <ActivityIndicator size="small" color={GOCHUJANG.primary} />
                    ) : (
                      <>
                        <Icon
                          name={biometricService.getBiometryIcon(biometricStatus.biometryType)}
                          size="md"
                          color={GOCHUJANG.primary}
                        />
                        <Text style={styles.biometricButtonText}>
                          Connexion avec {biometricService.getBiometryDisplayName(biometricStatus.biometryType)}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Register Link */}
            <View style={styles.registerRow}>
              <Text style={styles.registerText}>
                Vous n'avez pas de compte?
              </Text>
              <TouchableOpacity
                onPress={() => navigation.push('Register')}
                disabled={isLoading}>
                <Text style={styles.registerLink}> Créer un compte</Text>
              </TouchableOpacity>
            </View>

            {/* Terms */}
            <Text style={styles.termsText}>
              En vous connectant, vous acceptez nos{' '}
              <Text
                style={styles.termsLink}
                onPress={() => navigation.push('TermsOfService')}>
                Conditions d'utilisation
              </Text>{' '}
              et notre{' '}
              <Text
                style={styles.termsLink}
                onPress={() => navigation.push('PrivacyPolicy')}>
                Politique de confidentialité
              </Text>
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
    backgroundColor: GOCHUJANG.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
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
    color: GOCHUJANG.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: GOCHUJANG.textSecondary,
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
    color: GOCHUJANG.success,
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
    color: GOCHUJANG.error,
    fontSize: 14,
    fontWeight: '500',
  },

  // Login Card
  loginCard: {
    backgroundColor: GOCHUJANG.cardBg,
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
    color: GOCHUJANG.textPrimary,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GOCHUJANG.background,
    borderWidth: 1.5,
    borderColor: GOCHUJANG.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    gap: 10,
  },
  inputError: {
    borderColor: GOCHUJANG.error,
    backgroundColor: '#FEF2F2',
  },
  inputDisabled: {
    opacity: 0.6,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: GOCHUJANG.textPrimary,
  },
  eyeButton: {
    padding: 4,
  },
  fieldError: {
    color: GOCHUJANG.error,
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
    color: GOCHUJANG.primary,
    fontWeight: '600',
  },

  // Login Button
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GOCHUJANG.textPrimary,
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
    color: GOCHUJANG.white,
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
    backgroundColor: GOCHUJANG.border,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 13,
    color: GOCHUJANG.textMuted,
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
    backgroundColor: GOCHUJANG.cardBg,
    borderWidth: 1.5,
    borderColor: GOCHUJANG.border,
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
    color: GOCHUJANG.textPrimary,
  },
  appleButton: {
    backgroundColor: GOCHUJANG.textPrimary,
    borderColor: GOCHUJANG.textPrimary,
  },
  appleButtonText: {
    color: GOCHUJANG.white,
  },
  facebookButton: {
    backgroundColor: '#1877F2',
    borderColor: '#1877F2',
  },
  facebookButtonText: {
    color: GOCHUJANG.white,
  },
  facebookIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: GOCHUJANG.white,
  },

  // Biometric Button
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GOCHUJANG.cardBg,
    borderWidth: 2,
    borderColor: GOCHUJANG.primary,
    borderRadius: 14,
    paddingVertical: 16,
    gap: 12,
  },
  biometricButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: GOCHUJANG.primary,
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
    color: GOCHUJANG.textSecondary,
  },
  registerLink: {
    fontSize: 14,
    fontWeight: '700',
    color: GOCHUJANG.primary,
  },

  // Terms
  termsText: {
    fontSize: 13,
    color: GOCHUJANG.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  termsLink: {
    color: GOCHUJANG.primary,
    fontWeight: '600',
  },
});


