// Change Password Screen - Update password for logged-in users
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
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {Icon, Button} from '@/shared/components';
import {useToast} from '@/shared/contexts';
import {passwordService} from '@/shared/services/password';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Password sanitization helper
const sanitizePassword = (password: string): string => {
  // Remove any potential harmful characters and trim
  return password.replace(/[<>"'&]/g, '').trim();
};

export function ChangePasswordScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {showToast} = useToast();

  // Form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Error state
  const [currentPasswordError, setCurrentPasswordError] = useState<
    string | null
  >(null);
  const [newPasswordError, setNewPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<
    string | null
  >(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Refs
  const newPasswordRef = useRef<TextInput>(null);
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

  const validateCurrentPassword = (value: string): boolean => {
    if (!value) {
      setCurrentPasswordError('Le mot de passe actuel est requis');
      return false;
    }
    setCurrentPasswordError(null);
    return true;
  };

  const validateNewPassword = (value: string): boolean => {
    if (!value) {
      setNewPasswordError('Le nouveau mot de passe est requis');
      return false;
    }
    
    // Use comprehensive password validation
    const validation = passwordService.validatePassword(
      value,
      passwordService.getRequirements('change'),
      { phone: '', name: '' } // Could add user info from context
    );
    
    if (!validation.isValid) {
      setNewPasswordError(validation.errors?.[0] || 'Mot de passe invalide');
      return false;
    }
    
    if (value === currentPassword) {
      setNewPasswordError('Le nouveau mot de passe doit être différent');
      return false;
    }
    setNewPasswordError(null);
    return true;
  };

  const getPasswordValidation = (pwd: string) => {
    return passwordService.validatePassword(
      pwd,
      passwordService.getRequirements('change'),
      { phone: '', name: '' }
    );
  };

  const validateConfirmPassword = (value: string): boolean => {
    if (!value) {
      setConfirmPasswordError('Veuillez confirmer le mot de passe');
      return false;
    }
    if (value !== newPassword) {
      setConfirmPasswordError('Les mots de passe ne correspondent pas');
      return false;
    }
    setConfirmPasswordError(null);
    return true;
  };

  // Check if form is valid for submission
  const isFormValid = () => {
    if (!currentPassword || !newPassword || !confirmPassword) return false;
    
    const passwordValidation = passwordService.validatePassword(
      newPassword,
      passwordService.getRequirements('change')
    );
    
    return (
      passwordValidation.isValid &&
      passwordService.passwordsMatch(newPassword, confirmPassword) &&
      newPassword !== currentPassword
    );
  };

  const handleChangePassword = async () => {
    Keyboard.dismiss();
    setError(null);

    const isCurrentValid = validateCurrentPassword(currentPassword);
    const isNewValid = validateNewPassword(newPassword);
    const isConfirmValid = validateConfirmPassword(confirmPassword);

    if (!isCurrentValid || !isNewValid || !isConfirmValid) {
      triggerShake();
      return;
    }

    setLoading(true);

    try {
      await authService.updatePassword(currentPassword, newPassword);
      setSuccess(true);
    } catch (err: any) {
      console.error('Change password error:', err);
      const errorMessages: Record<string, string> = {
        'auth/wrong-password': 'Le mot de passe actuel est incorrect.',
        'auth/weak-password': 'Le nouveau mot de passe est trop faible.',
        'auth/requires-recent-login': 'Veuillez vous reconnecter et réessayer.',
        'auth/too-many-requests': 'Trop de tentatives. Réessayez plus tard.',
      };
      setError(
        errorMessages[err.code] ||
          'Une erreur est survenue. Veuillez réessayer.',
      );
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <SafeAreaView style={styles.container}>
        <Animated.View style={[styles.successContainer, {opacity: fadeAnim}]}>
          <View style={styles.successIconContainer}>
            <Icon
              name="check-circle"
              size="3xl"
              color={Colors.status.success}
            />
          </View>
          <Text style={styles.successTitle}>Mot de passe modifié !</Text>
          <Text style={styles.successText}>
            Votre mot de passe a été mis à jour avec succès. Utilisez votre
            nouveau mot de passe lors de votre prochaine connexion.
          </Text>
          <Button
            title="Retour aux paramètres"
            onPress={() => {
              showToast('Mot de passe modifié avec succès!', 'success', 2000);
              setTimeout(() => {
                navigation.goBack();
              }, 2000);
            }}
            variant="primary"
            size="lg"
            icon={<Icon name="arrow-right" size="sm" color={Colors.white} />}
            iconPosition="right"
            style={{marginTop: Spacing.lg}}
          />
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
              <Text style={styles.title}>Changer le mot de passe</Text>
              <Text style={styles.subtitle}>
                Mettez à jour votre mot de passe pour sécuriser votre compte.
              </Text>
            </View>

            {/* Error Message */}
            {error && (
              <Animated.View
                style={[
                  styles.errorBanner,
                  {transform: [{translateX: shakeAnimation}]},
                ]}>
                <Icon
                  name="alert-circle"
                  size="md"
                  color={Colors.status.error}
                />
                <Text style={styles.errorText}>{error}</Text>
              </Animated.View>
            )}

            {/* Form */}
            <Animated.View
              style={[
                styles.form,
                {transform: [{translateX: shakeAnimation}]},
              ]}>
              {/* Current Password */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Mot de passe actuel</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    currentPasswordError ? styles.inputError : null,
                    loading ? styles.inputDisabled : null,
                  ]}>
                  <Icon name="lock" size="md" color={Colors.text.secondary} />
                  <TextInput
                    style={styles.input}
                    placeholder="Entrez votre mot de passe actuel"
                    placeholderTextColor={Colors.text.tertiary}
                    value={currentPassword}
                    onChangeText={value => {
                      setCurrentPassword(value);
                      if (currentPasswordError) {
                        setCurrentPasswordError(null);
                      }
                      if (error) {
                        setError(null);
                      }
                    }}
                    secureTextEntry={!showCurrentPassword}
                    autoCapitalize="none"
                    editable={!loading}
                    returnKeyType="next"
                    onSubmitEditing={() => newPasswordRef.current?.focus()}
                  />
                  <TouchableOpacity
                    onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                    style={styles.eyeButton}
                    disabled={loading}>
                    <Icon
                      name={showCurrentPassword ? 'eye' : 'eye-off'}
                      size="md"
                      color={Colors.text.secondary}
                    />
                  </TouchableOpacity>
                </View>
                {currentPasswordError && (
                  <Text style={styles.fieldError}>{currentPasswordError}</Text>
                )}
              </View>

              {/* New Password */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Nouveau mot de passe</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    newPasswordError ? styles.inputError : null,
                    loading ? styles.inputDisabled : null,
                  ]}>
                  <Icon name="lock" size="md" color={Colors.text.secondary} />
                  <TextInput
                    ref={newPasswordRef}
                    style={styles.input}
                    placeholder="Au moins 6 caractères"
                    placeholderTextColor={Colors.text.tertiary}
                    value={newPassword}
                    onChangeText={value => {
                      const sanitized = sanitizePassword(value);
                      setNewPassword(sanitized);
                      if (newPasswordError) {
                        setNewPasswordError(null);
                      }
                      if (error) {
                        setError(null);
                      }
                    }}
                    secureTextEntry={!showNewPassword}
                    autoCapitalize="none"
                    editable={!loading}
                    returnKeyType="next"
                    onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                  />
                  <TouchableOpacity
                    onPress={() => setShowNewPassword(!showNewPassword)}
                    style={styles.eyeButton}
                    disabled={loading}>
                    <Icon
                      name={showNewPassword ? 'eye' : 'eye-off'}
                      size="md"
                      color={Colors.text.secondary}
                    />
                  </TouchableOpacity>
                </View>
                {newPasswordError && (
                  <Text style={styles.fieldError}>{newPasswordError}</Text>
                )}
              </View>

              {/* Confirm Password */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>
                  Confirmer le nouveau mot de passe
                </Text>
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
                    placeholder="Répétez le nouveau mot de passe"
                    placeholderTextColor={Colors.text.tertiary}
                    value={confirmPassword}
                    onChangeText={value => {
                      const sanitized = sanitizePassword(value);
                      setConfirmPassword(sanitized);
                      if (confirmPasswordError) {
                        setConfirmPasswordError(null);
                      }
                      if (error) {
                        setError(null);
                      }
                    }}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    editable={!loading}
                    returnKeyType="done"
                    onSubmitEditing={handleChangePassword}
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
                  Le nouveau mot de passe doit :
                </Text>
                <View style={styles.requirementRow}>
                  <Icon
                    name={newPassword.length >= 6 ? 'check-circle' : 'x-circle'}
                    size="sm"
                    color={
                      newPassword.length >= 6
                        ? Colors.status.success
                        : Colors.text.tertiary
                    }
                  />
                  <Text
                    style={[
                      styles.requirementText,
                      newPassword.length >= 6 && styles.requirementMet,
                    ]}>
                    Contenir au moins 6 caractères
                  </Text>
                </View>
                <View style={styles.requirementRow}>
                  <Icon
                    name={/\d/.test(newPassword) ? 'check-circle' : 'x-circle'}
                    size="sm"
                    color={
                      /\d/.test(newPassword)
                        ? Colors.status.success
                        : Colors.text.tertiary
                    }
                  />
                  <Text
                    style={[
                      styles.requirementText,
                      /\d/.test(newPassword) && styles.requirementMet,
                    ]}>
                    Contenir au moins un chiffre
                  </Text>
                </View>
                <View style={styles.requirementRow}>
                  <Icon
                    name={
                      newPassword !== currentPassword && newPassword.length > 0
                        ? 'check-circle'
                        : 'x-circle'
                    }
                    size="sm"
                    color={
                      newPassword !== currentPassword && newPassword.length > 0
                        ? Colors.status.success
                        : Colors.text.tertiary
                    }
                  />
                  <Text
                    style={[
                      styles.requirementText,
                      newPassword !== currentPassword &&
                        newPassword.length > 0 &&
                        styles.requirementMet,
                    ]}>
                    Être différent de l'ancien mot de passe
                  </Text>
                </View>
                <View style={styles.requirementRow}>
                  <Icon
                    name={
                      newPassword === confirmPassword && newPassword.length > 0
                        ? 'check-circle'
                        : 'x-circle'
                    }
                    size="sm"
                    color={
                      newPassword === confirmPassword && newPassword.length > 0
                        ? Colors.status.success
                        : Colors.text.tertiary
                    }
                  />
                  <Text
                    style={[
                      styles.requirementText,
                      newPassword === confirmPassword &&
                        newPassword.length > 0 &&
                        styles.requirementMet,
                    ]}>
                    Correspondre à la confirmation
                  </Text>
                </View>
              </View>

              {/* Submit Button */}
              <Button
                title="Changer le mot de passe"
                onPress={handleChangePassword}
                variant="primary"
                size="lg"
                loading={loading}
                disabled={loading || !isFormValid()}
                icon={<Icon name="check" size="sm" color={Colors.white} />}
                style={{marginTop: Spacing.lg}}
              />

              {/* Footer */}
              <View style={styles.guestFooter}>
                <Text style={styles.footerText}>
                  Changement de mot de passe{' '}
                  <Text style={styles.footerHighlight}>sécurisé et rapide</Text>
                </Text>
              </View>
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
    paddingVertical: Spacing.sm,
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

  // Guest Footer
  guestFooter: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    marginTop: Spacing.base,
  },
  footerText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  footerHighlight: {
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
  },
});

export default ChangePasswordScreen;
