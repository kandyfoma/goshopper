// Reset Password Screen - Set new password (from email link)
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
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '@/shared/types';
import {authService} from '@/shared/services/firebase';
import {Colors, Typography, Spacing, BorderRadius, Shadows} from '@/shared/theme/theme';
import {Icon} from '@/shared/components';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ResetPasswordRouteProp = RouteProp<RootStackParamList, 'ResetPassword'>;

export function ResetPasswordScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ResetPasswordRouteProp>();
  const oobCode = (route.params as any)?.oobCode || '';

  // Form state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Error state
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Refs
  const confirmPasswordRef = useRef<TextInput>(null);
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

  const validateConfirmPassword = (value: string): boolean => {
    if (!value) {
      setConfirmPasswordError('Veuillez confirmer le mot de passe');
      return false;
    }
    if (value !== password) {
      setConfirmPasswordError('Les mots de passe ne correspondent pas');
      return false;
    }
    setConfirmPasswordError(null);
    return true;
  };

  const handleResetPassword = async () => {
    Keyboard.dismiss();
    setError(null);

    const isPasswordValid = validatePassword(password);
    const isConfirmValid = validateConfirmPassword(confirmPassword);

    if (!isPasswordValid || !isConfirmValid) {
      triggerShake();
      return;
    }

    if (!oobCode) {
      setError('Lien de réinitialisation invalide ou expiré.');
      return;
    }

    setLoading(true);

    try {
      await authService.confirmPasswordReset(oobCode, password);
      setSuccess(true);
    } catch (err: any) {
      console.error('Reset password error:', err);
      const errorMessages: Record<string, string> = {
        'auth/expired-action-code': 'Le lien a expiré. Demandez un nouveau lien.',
        'auth/invalid-action-code': 'Le lien est invalide ou a déjà été utilisé.',
        'auth/weak-password': 'Le mot de passe est trop faible.',
      };
      setError(
        errorMessages[err.code] || 'Une erreur est survenue. Veuillez réessayer.',
      );
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (passwordError) setPasswordError(null);
    if (error) setError(null);
  };

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);
    if (confirmPasswordError) setConfirmPasswordError(null);
    if (error) setError(null);
  };

  if (success) {
    return (
      <SafeAreaView style={styles.container}>
        <Animated.View style={[styles.successContainer, {opacity: fadeAnim}]}>
          <View style={styles.successIconContainer}>
            <Icon name="check-circle" size="3xl" color={Colors.status.success} />
          </View>
          <Text style={styles.successTitle}>Mot de passe réinitialisé !</Text>
          <Text style={styles.successText}>
            Votre mot de passe a été modifié avec succès. Vous pouvez maintenant
            vous connecter avec votre nouveau mot de passe.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.8}>
            <View style={styles.buttonInner}>
              <Text style={styles.buttonText}>Se connecter</Text>
              <Icon name="arrow-right" size="md" color={Colors.white} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    );
  }

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
              <View style={styles.iconContainer}>
                <Icon name="lock" size="2xl" color={Colors.white} />
              </View>
              <Text style={styles.title}>Nouveau mot de passe</Text>
              <Text style={styles.subtitle}>
                Choisissez un nouveau mot de passe sécurisé pour votre compte.
              </Text>
            </View>

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
              {/* New Password */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Nouveau mot de passe</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    passwordError ? styles.inputError : null,
                    loading ? styles.inputDisabled : null,
                  ]}>
                  <Icon name="lock" size="md" color={Colors.text.secondary} />
                  <TextInput
                    style={styles.input}
                    placeholder="Au moins 6 caractères"
                    placeholderTextColor={Colors.text.tertiary}
                    value={password}
                    onChangeText={handlePasswordChange}
                    onBlur={() => password && validatePassword(password)}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    editable={!loading}
                    returnKeyType="next"
                    onSubmitEditing={() => confirmPasswordRef.current?.focus()}
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

              {/* Confirm Password */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Confirmer le mot de passe</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    confirmPasswordError ? styles.inputError : null,
                    loading ? styles.inputDisabled : null,
                  ]}>
                  <Icon name="lock" size="md" color={Colors.text.secondary} />
                  <TextInput
                    ref={confirmPasswordRef}
                    style={styles.input}
                    placeholder="Répétez le mot de passe"
                    placeholderTextColor={Colors.text.tertiary}
                    value={confirmPassword}
                    onChangeText={handleConfirmPasswordChange}
                    onBlur={() =>
                      confirmPassword && validateConfirmPassword(confirmPassword)
                    }
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    editable={!loading}
                    returnKeyType="done"
                    onSubmitEditing={handleResetPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeButton}
                    disabled={loading}>
                    <Icon
                      name={showConfirmPassword ? 'eye' : 'eye-off'}
                      size="md"
                      color={Colors.text.secondary}
                    />
                  </TouchableOpacity>
                </View>
                {confirmPasswordError && (
                  <Text style={styles.fieldError}>{confirmPasswordError}</Text>
                )}
              </View>

              {/* Password Requirements */}
              <View style={styles.requirements}>
                <Text style={styles.requirementsTitle}>
                  Le mot de passe doit contenir :
                </Text>
                <View style={styles.requirementRow}>
                  <Icon
                    name={password.length >= 6 ? 'check-circle' : 'x-circle'}
                    size="sm"
                    color={
                      password.length >= 6
                        ? Colors.status.success
                        : Colors.text.tertiary
                    }
                  />
                  <Text
                    style={[
                      styles.requirementText,
                      password.length >= 6 && styles.requirementMet,
                    ]}>
                    Au moins 6 caractères
                  </Text>
                </View>
                <View style={styles.requirementRow}>
                  <Icon
                    name={
                      password === confirmPassword && password.length > 0
                        ? 'check-circle'
                        : 'x-circle'
                    }
                    size="sm"
                    color={
                      password === confirmPassword && password.length > 0
                        ? Colors.status.success
                        : Colors.text.tertiary
                    }
                  />
                  <Text
                    style={[
                      styles.requirementText,
                      password === confirmPassword &&
                        password.length > 0 &&
                        styles.requirementMet,
                    ]}>
                    Les mots de passe correspondent
                  </Text>
                </View>
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
                    <Text style={styles.loadingText}>
                      Réinitialisation...
                    </Text>
                  </View>
                ) : (
                  <View style={styles.buttonInner}>
                    <Text style={styles.buttonText}>Réinitialiser</Text>
                    <Icon name="arrow-right" size="md" color={Colors.white} />
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
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
    lineHeight: 22,
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
  eyeButton: {
    padding: Spacing.sm,
  },
  fieldError: {
    color: Colors.status.error,
    fontSize: Typography.fontSize.sm,
    marginTop: Spacing.xs,
    marginLeft: Spacing.xs,
  },
  requirements: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.base,
    padding: Spacing.base,
    marginBottom: Spacing.lg,
  },
  requirementsTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  requirementText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.tertiary,
  },
  requirementMet: {
    color: Colors.status.success,
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
});

export default ResetPasswordScreen;
