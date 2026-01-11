// Reset Password Screen - Set new password after SMS OTP verification
import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '@/shared/types';
import {Button, Icon, PasswordStrengthIndicator, CapsLockIndicator} from '@/shared/components';
import {authService} from '@/shared/services/firebase';
import {passwordService} from '@/shared/services/password';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ResetPasswordRouteProp = RouteProp<RootStackParamList, 'ResetPassword'>;

const ResetPasswordScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ResetPasswordRouteProp>();
  const {phoneNumber, verificationToken} = route.params;
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({
    password: '',
    confirmPassword: '',
    general: ''
  });

  const getPasswordValidation = (pwd: string) => {
    const validation = passwordService.validatePassword(pwd);
    return {
      isValid: validation.isValid,
      message: validation.errors.join(' ')
    };
  };

  const validateConfirmPassword = (confirmPwd: string): string => {
    if (confirmPwd !== password) {
      return 'Les mots de passe ne correspondent pas';
    }
    return '';
  };

  const handlePasswordChange = (value: string) => {
    const sanitized = passwordService.sanitizePassword(value);
    setPassword(sanitized);
    setErrors(prev => ({
      ...prev,
      password: '',
      general: ''
    }));
  };

  const handleConfirmPasswordChange = (value: string) => {
    const sanitized = passwordService.sanitizePassword(value);
    setConfirmPassword(sanitized);
    setErrors(prev => ({
      ...prev,
      confirmPassword: '',
      general: ''
    }));
  };

  const handleResetPassword = async () => {
    // Validate inputs
    const passwordValidation = getPasswordValidation(password);
    const confirmPasswordError = validateConfirmPassword(confirmPassword);

    if (!passwordValidation.isValid || confirmPasswordError) {
      setErrors({
        password: passwordValidation.message,
        confirmPassword: confirmPasswordError,
        general: ''
      });
      return;
    }

    setLoading(true);
    setErrors({password: '', confirmPassword: '', general: ''});

    try {
      // In a real implementation, you would call your backend API
      // to reset the password using the phone number and verification token
      // For now, we'll simulate this with a delay
      
      // await authService.resetPasswordWithPhone(phoneNumber, password, verificationToken);
      
      // Simulate API call
      await new Promise<void>(resolve => setTimeout(() => resolve(), 1500));
      
      Alert.alert(
        'Succès!',
        'Votre mot de passe a été réinitialisé avec succès.',
        [
          {
            text: 'Se connecter',
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'SignIn' }],
              });
            },
          },
        ]
      );
      
    } catch (error: any) {
      console.error('Password reset error:', error);
      setErrors(prev => ({
        ...prev,
        general: error.message || 'Une erreur est survenue. Veuillez réessayer.'
      }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Icon name="arrow-left" size="md" color={Colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Nouveau mot de passe</Text>
          </View>

          <View style={styles.content}>
            <View style={styles.titleSection}>
              <Text style={styles.title}>Créer un nouveau mot de passe</Text>
              <Text style={styles.subtitle}>
                Créez un mot de passe sécurisé pour votre compte {phoneNumber}
              </Text>
            </View>

            <View style={styles.formSection}>
              {/* Password Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nouveau mot de passe</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[styles.input, errors.password ? styles.inputError : null]}
                    value={password}
                    onChangeText={handlePasswordChange}
                    placeholder="Entrez votre nouveau mot de passe"
                    placeholderTextColor={Colors.text.tertiary}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    onSubmitEditing={() => {
                      // Focus confirm password input if available
                    }}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Icon
                      name={showPassword ? "eye-off" : "eye"}
                      size="sm"
                      color={Colors.text.secondary}
                    />
                  </TouchableOpacity>
                </View>
                {errors.password ? (
                  <Text style={styles.errorText}>{errors.password}</Text>
                ) : null}
              </View>

              {/* Password Strength Indicator */}
              <PasswordStrengthIndicator 
                value={password}
                style={{ marginTop: 8 }}
              />

              {/* Caps Lock Indicator */}
              <CapsLockIndicator 
                value={password}
              />

              {/* Confirm Password Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirmer le mot de passe</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[styles.input, errors.confirmPassword ? styles.inputError : null]}
                    value={confirmPassword}
                    onChangeText={handleConfirmPasswordChange}
                    placeholder="Confirmez votre nouveau mot de passe"
                    placeholderTextColor={Colors.text.tertiary}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleResetPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <Icon
                      name={showConfirmPassword ? "eye-off" : "eye"}
                      size="sm"
                      color={Colors.text.secondary}
                    />
                  </TouchableOpacity>
                </View>
                {errors.confirmPassword ? (
                  <Text style={styles.errorText}>{errors.confirmPassword}</Text>
                ) : null}
              </View>

              {/* General Error */}
              {errors.general ? (
                <View style={styles.generalError}>
                  <Icon name="alert-triangle" size="sm" color={Colors.status.error} />
                  <Text style={styles.generalErrorText}>{errors.general}</Text>
                </View>
              ) : null}

              {/* Reset Button */}
              <Button
                title="Réinitialiser le mot de passe"
                variant="primary"
                onPress={handleResetPassword}
                disabled={loading || !password || !confirmPassword}
                loading={loading}
                style={styles.resetButton}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  backButton: {
    padding: Spacing.sm,
    marginRight: Spacing.md,
  },
  headerTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  titleSection: {
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    lineHeight: 22,
  },
  formSection: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    height: 52,
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingRight: 48,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  inputError: {
    borderColor: Colors.status.error,
    backgroundColor: Colors.status.errorLight,
  },
  eyeButton: {
    position: 'absolute',
    right: Spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 24,
    height: 24,
  },
  errorText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.status.error,
    marginTop: Spacing.xs,
  },
  generalError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.status.errorLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  generalErrorText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.status.error,
    flex: 1,
  },
  resetButton: {
    marginTop: Spacing.xl,
  },
});

export default ResetPasswordScreen;
