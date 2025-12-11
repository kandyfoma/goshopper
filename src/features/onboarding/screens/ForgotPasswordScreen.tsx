// Forgot Password Screen - Request password reset email
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

export function ForgotPasswordScreen() {
  const navigation = useNavigation<NavigationProp>();

  // Form state
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const shakeAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

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

  const handleResetPassword = async () => {
    Keyboard.dismiss();
    setError(null);
    setSuccessMessage(null);

    if (!validateEmail(email)) {
      triggerShake();
      return;
    }

    setLoading(true);

    try {
      await authService.sendPasswordResetEmail(email.trim());
      setEmailSent(true);
      setSuccessMessage(
        'Un email de réinitialisation a été envoyé ! Vérifiez votre boîte de réception.',
      );
    } catch (err: any) {
      console.error('Password reset error:', err);
      const errorMessages: Record<string, string> = {
        'auth/invalid-email': "L'adresse email est invalide.",
        'auth/user-not-found': 'Aucun compte trouvé avec cet email.',
        'auth/too-many-requests': 'Trop de tentatives. Réessayez plus tard.',
        'auth/network-request-failed': 'Erreur réseau. Vérifiez votre connexion.',
      };
      setError(
        errorMessages[err.code] || 'Une erreur est survenue. Veuillez réessayer.',
      );
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (emailError) setEmailError(null);
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
            {/* Back Button */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}>
              <Icon name="arrow-left" size="md" color={Colors.text.primary} />
            </TouchableOpacity>

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <Icon name="lock" size="2xl" color={Colors.white} />
              </View>
              <Text style={styles.title}>Mot de passe oublié ?</Text>
              <Text style={styles.subtitle}>
                Entrez votre email et nous vous enverrons un lien pour
                réinitialiser votre mot de passe.
              </Text>
            </View>

            {/* Success State */}
            {emailSent && successMessage ? (
              <View style={styles.successContainer}>
                <View style={styles.successIconContainer}>
                  <Icon name="check-circle" size="3xl" color={Colors.status.success} />
                </View>
                <Text style={styles.successTitle}>Email envoyé !</Text>
                <Text style={styles.successText}>{successMessage}</Text>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => navigation.navigate('Login')}
                  activeOpacity={0.8}>
                  <Text style={styles.buttonText}>Retour à la connexion</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
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
                        returnKeyType="done"
                        onSubmitEditing={handleResetPassword}
                      />
                    </View>
                    {emailError && (
                      <Text style={styles.fieldError}>{emailError}</Text>
                    )}
                  </View>

                  {/* Submit Button */}
                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      loading && styles.buttonDisabled,
                    ]}
                    onPress={handleResetPassword}
                    disabled={loading}
                    activeOpacity={0.8}>
                    {loading ? (
                      <View style={styles.loadingContent}>
                        <ActivityIndicator color={Colors.white} size="small" />
                        <Text style={styles.loadingText}>Envoi en cours...</Text>
                      </View>
                    ) : (
                      <View style={styles.buttonInner}>
                        <Text style={styles.buttonText}>Envoyer le lien</Text>
                        <Icon name="arrow-right" size="md" color={Colors.white} />
                      </View>
                    )}
                  </TouchableOpacity>
                </Animated.View>

                {/* Footer */}
                <View style={styles.footer}>
                  <Text style={styles.footerText}>Vous vous souvenez ?</Text>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Login')}
                    disabled={loading}>
                    <Text style={styles.linkText}> Se connecter</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
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
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.base,
    backgroundColor: Colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.base,
    ...Shadows.lg,
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.fontSize.base,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.lg,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: Spacing['2xl'],
  },
  successIconContainer: {
    marginBottom: Spacing.lg,
  },
  successTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.status.success,
    marginBottom: Spacing.sm,
  },
  successText: {
    fontSize: Typography.fontSize.base,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing['2xl'],
    paddingHorizontal: Spacing.lg,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.status.errorLight,
    borderRadius: BorderRadius.base,
    padding: Spacing.base,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.status.error,
    gap: Spacing.md,
  },
  errorText: {
    flex: 1,
    color: Colors.status.error,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
  },
  form: {
    marginBottom: Spacing.xl,
  },
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border.medium,
    borderRadius: BorderRadius.base,
    backgroundColor: Colors.background.primary,
    paddingHorizontal: Spacing.base,
    gap: Spacing.md,
  },
  inputError: {
    borderColor: Colors.status.error,
    backgroundColor: Colors.status.errorLight,
  },
  inputDisabled: {
    backgroundColor: Colors.background.secondary,
    opacity: 0.7,
  },
  input: {
    flex: 1,
    paddingVertical: Spacing.base,
    fontSize: Typography.fontSize.base,
    color: Colors.text.primary,
  },
  fieldError: {
    color: Colors.status.error,
    fontSize: Typography.fontSize.sm,
    marginTop: Spacing.xs,
    marginLeft: Spacing.xs,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.base,
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontWeight: Typography.fontWeight.bold,
  },
  loadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.white,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semiBold,
    marginLeft: Spacing.sm,
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
  },
  linkText: {
    color: Colors.accent,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
  },
});

export default ForgotPasswordScreen;
