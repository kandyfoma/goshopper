// Login Screen - Comprehensive authentication with full features
import React, {useState, useRef, useEffect} from 'react';
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
  Animated,
  Keyboard,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '@/shared/types';
import {authService} from '@/shared/services/firebase';
import {Colors, Typography, Spacing, BorderRadius, Shadows} from '@/shared/theme/theme';
import {Icon} from '@/shared/components';

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

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Refs
  const passwordInputRef = useRef<TextInput>(null);
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Fade in animation on mount
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
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

    console.log('🔐 Login attempt with:', email);
    setLoading(true);

    try {
      const user = await authService.signInWithEmail(email.trim(), password);
      console.log('✅ Login successful, user:', user?.uid);

      setSuccessMessage('Connexion réussie! Redirection...');

      // The AuthContext will handle navigation automatically
      // But if it doesn't happen within 3 seconds, show an error
      setTimeout(() => {
        setLoading(false);
      }, 3000);
    } catch (err: any) {
      console.error('❌ Login error:', err);
      console.error('Error code:', err.code);
      console.error('Error message:', err.message);

      const errorMessage = getErrorMessage(err.code || '');
      setError(errorMessage);
      triggerShake();
      setLoading(false);
    }
  };

  // Handle forgot password
  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setEmailError('Entrez votre email pour réinitialiser le mot de passe');
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
      setSuccessMessage(
        'Email de réinitialisation envoyé! Vérifiez votre boîte de réception.',
      );
    } catch (err: any) {
      console.error('Password reset error:', err);
      setError(getErrorMessage(err.code || ''));
    } finally {
      setLoading(false);
    }
  };

  // Handle social sign in (placeholder)
  const handleGoogleSignIn = async () => {
    setError('La connexion Google sera disponible prochainement');
  };

  const handleAppleSignIn = async () => {
    setError('La connexion Apple sera disponible prochainement');
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

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Animated.View style={[styles.content, {opacity: fadeAnim}]}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <Icon name="cart" size="2xl" color={Colors.text.primary} variant="filled" />
              </View>
              <Text style={styles.title}>GoShopperAI</Text>
              <Text style={styles.subtitle}>
                Scannez vos reçus, économisez plus
              </Text>
            </View>

            {/* Success Message */}
            {successMessage && (
              <View style={styles.successBanner}>
                <Icon name="check-circle" size="md" color={Colors.status.success} />
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
                <Icon name="alert-circle" size="md" color={Colors.status.error} />
                <Text style={styles.errorText}>{error}</Text>
              </Animated.View>
            )}

            {/* Form */}
            <Animated.View
              style={[
                styles.form,
                {transform: [{translateX: shakeAnimation}]},
              ]}>
              {/* Email Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    emailError ? styles.inputError : null,
                    loading ? styles.inputDisabled : null,
                  ]}>
                  <Icon name="mail" size="md" color={Colors.text.secondary} />
                  <TextInput
                    style={styles.input}
                    placeholder="votre@email.com"
                    placeholderTextColor={Colors.text.tertiary}
                    value={email}
                    onChangeText={handleEmailChange}
                    onBlur={() => email && validateEmail(email)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    editable={!loading}
                    returnKeyType="next"
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                  />
                </View>
                {emailError && (
                  <Text style={styles.fieldError}>{emailError}</Text>
                )}
              </View>

              {/* Password Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Mot de passe</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    passwordError ? styles.inputError : null,
                    loading ? styles.inputDisabled : null,
                  ]}>
                  <Icon name="lock" size="md" color={Colors.text.secondary} />
                  <TextInput
                    ref={passwordInputRef}
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor={Colors.text.tertiary}
                    value={password}
                    onChangeText={handlePasswordChange}
                    onBlur={() => password && validatePassword(password)}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoComplete="password"
                    editable={!loading}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                    disabled={loading}>
                    <Icon 
                      name={showPassword ? 'eye' : 'eye-off'} 
                      size="md" 
                      color={Colors.text.secondary} 
                    />
                  </TouchableOpacity>
                </View>
                {passwordError && (
                  <Text style={styles.fieldError}>{passwordError}</Text>
                )}
              </View>

              {/* Remember Me & Forgot Password */}
              <View style={styles.optionsRow}>
                <TouchableOpacity
                  style={styles.rememberMe}
                  onPress={() => setRememberMe(!rememberMe)}
                  disabled={loading}>
                  <View
                    style={[
                      styles.checkbox,
                      rememberMe && styles.checkboxChecked,
                    ]}>
                    {rememberMe && <Icon name="check" size="sm" color={Colors.white} />}
                  </View>
                  <Text style={styles.rememberMeText}>Se souvenir de moi</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleForgotPassword}
                  disabled={loading}>
                  <Text style={styles.forgotPassword}>
                    Mot de passe oublié?
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Login Button */}
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.primaryButton,
                  loading && styles.buttonDisabled,
                ]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.8}>
                {loading ? (
                  <View style={styles.loadingContent}>
                    <ActivityIndicator color={Colors.white} size="small" />
                    <Text style={styles.loadingText}>
                      Connexion en cours...
                    </Text>
                  </View>
                ) : (
                  <View style={styles.buttonInner}>
                    <Text style={styles.buttonText}>Se connecter</Text>
                    <Icon name="arrow-right" size="md" color={Colors.white} />
                  </View>
                )}
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>ou continuer avec</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Social Buttons */}
              <View style={styles.socialButtons}>
                <TouchableOpacity
                  style={[
                    styles.socialButton,
                    loading && styles.buttonDisabled,
                  ]}
                  onPress={handleGoogleSignIn}
                  disabled={loading}
                  activeOpacity={0.7}>
                  <Text style={styles.socialIcon}>G</Text>
                  <Text style={styles.socialButtonText}>Google</Text>
                </TouchableOpacity>

                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={[
                      styles.socialButton,
                      styles.appleButton,
                      loading && styles.buttonDisabled,
                    ]}
                    onPress={handleAppleSignIn}
                    disabled={loading}
                    activeOpacity={0.7}>
                    <Icon name="apple" size="md" color={Colors.white} />
                    <Text style={[styles.socialButtonText, styles.appleText]}>
                      Apple
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Vous n'avez pas de compte?</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Register')}
                disabled={loading}>
                <Text style={styles.linkText}> Créer un compte</Text>
              </TouchableOpacity>
            </View>

            {/* Terms */}
            <Text style={styles.terms}>
              En vous connectant, vous acceptez nos{' '}
              <Text style={styles.termsLink}>Conditions d'utilisation</Text> et
              notre{' '}
              <Text style={styles.termsLink}>Politique de confidentialité</Text>
            </Text>
          </Animated.View>
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
  },
  content: {
    flex: 1,
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
    backgroundColor: Colors.card.blue,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    ...Shadows.md,
  },
  title: {
    fontSize: Typography.fontSize['3xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card.green,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  successText: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.medium,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  errorText: {
    flex: 1,
    color: Colors.status.error,
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.medium,
  },
  form: {
    marginBottom: Spacing.xl,
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
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.base,
    gap: Spacing.md,
  },
  inputError: {
    borderColor: Colors.status.error,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  inputDisabled: {
    backgroundColor: Colors.background.secondary,
    opacity: 0.7,
  },
  input: {
    flex: 1,
    paddingVertical: Spacing.base,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.primary,
  },
  eyeButton: {
    padding: Spacing.sm,
  },
  fieldError: {
    color: Colors.status.error,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    marginTop: Spacing.xs,
    marginLeft: Spacing.xs,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  rememberMe: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: Colors.border.medium,
    borderRadius: BorderRadius.md,
    marginRight: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  rememberMeText: {
    color: Colors.text.secondary,
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.regular,
  },
  forgotPassword: {
    color: Colors.accent,
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.semiBold,
  },
  button: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  primaryButton: {
    backgroundColor: Colors.text.primary,
    ...Shadows.md,
  },
  buttonDisabled: {
    opacity: 0.7,
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
  loadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.white,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.semiBold,
    marginLeft: Spacing.sm,
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
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.base,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border.light,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  socialIcon: {
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
  appleText: {
    color: Colors.white,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  footerText: {
    color: Colors.text.secondary,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
  },
  linkText: {
    color: Colors.accent,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bold,
  },
  terms: {
    textAlign: 'center',
    color: Colors.text.tertiary,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    marginTop: Spacing.xl,
    lineHeight: 20,
  },
  termsLink: {
    color: Colors.accent,
    fontFamily: Typography.fontFamily.medium,
  },
});
