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
  Modal,
  FlatList,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SvgXml} from 'react-native-svg';
import {RootStackParamList} from '@/shared/types';
import {authService} from '@/shared/services/firebase';
import {biometricService, BiometricStatus} from '@/shared/services/biometric';
import {useAuth, useToast} from '@/shared/contexts';
import {Icon, Button, BiometricModal, triggerBiometricPrompt} from '@/shared/components';
import Logo from '@/shared/components/Logo';
//Login Screen imports
import {PhoneService} from '@/shared/services/phone';
import {countryCodeList} from '@/shared/constants/countries';
import {loginSecurityService} from '@/shared/services/security/loginSecurity';
import {passwordService} from '@/shared/services/password';
import {CapsLockIndicator} from '@/shared/components';


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
  border: '#FDB913', // Yellow outline
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
  const {signInWithGoogle, signInWithApple, signInWithFacebook, setPhoneUser} = useAuth();
  const {showToast} = useToast();

  // Form state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(countryCodeList[0]); // Default to RDC
  const [showCountryModal, setShowCountryModal] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | 'facebook' | null>(
    null,
  );
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricStatus, setBiometricStatus] = useState<BiometricStatus | null>(null);
  const [showBiometricModal, setShowBiometricModal] = useState(false);
  const [biometricPromptData, setBiometricPromptData] = useState<{
    userId: string;
    credentials: {
      email?: string;
      phoneNumber?: string;
      password?: string;
    };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [securityStatus, setSecurityStatus] = useState({
    locked: false,
    remainingAttempts: 5,
    lockTimeRemaining: 0,
  });

  // Refs
  const passwordInputRef = useRef<TextInput>(null);
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Debug: Track showBiometricModal state changes
  useEffect(() => {
    console.log('🔐 [LoginScreen] showBiometricModal state changed:', showBiometricModal);
  }, [showBiometricModal]);

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

  // Handle phone number input
  const handlePhoneChange = async (text: string) => {
    // Clean the input and format it
    let cleanText = text.replace(/[^0-9]/g, '');
    
    // Remove leading zero if present (handle 088 -> 88 case)
    if (cleanText.startsWith('0')) {
      cleanText = cleanText.substring(1);
    }
    
    // Limit to 9 digits maximum
    if (cleanText.length > 9) {
      cleanText = cleanText.substring(0, 9);
    }
    
    setPhoneNumber(cleanText);
    
    // Clear error when user starts typing
    if (phoneError) {
      setPhoneError(null);
    }

    // Check security status for this phone number
    if (cleanText.length >= 8) { // Only check when we have a reasonable phone number
      const formattedPhone = PhoneService.formatPhoneNumber(selectedCountry.code, cleanText);
      const security = await loginSecurityService.getSecurityStatus(formattedPhone);
      setSecurityStatus({
        locked: security.locked,
        remainingAttempts: security.remainingAttempts,
        lockTimeRemaining: security.remainingLockTime || 0,
      });
    }
  };

  // Handle password input
  const handlePasswordChange = (text: string) => {
    // Sanitize password input
    const sanitized = passwordService.sanitizePassword(text);
    setPassword(sanitized);
    
    // Clear error when user starts typing
    if (passwordError) {
      setPasswordError(null);
    }
  };

  // Validate phone number
  const validatePhoneNumber = (value: string): boolean => {
    if (!value.trim()) {
      setPhoneError('Le numéro de téléphone est requis');
      return false;
    }
    
    try {
      const validation = PhoneService.validatePhoneNumber(PhoneService.formatPhoneNumber(selectedCountry.code, value));
      if (!validation) {
        setPhoneError('Format de numéro invalide');
        return false;
      }
      setPhoneError(null);
      return true;
    } catch (error) {
      setPhoneError('Format de numéro invalide');
      return false;
    }
  };

  // Validate password
  const validatePassword = (value: string): boolean => {
    if (!value) {
      setPasswordError('Le mot de passe est requis');
      return false;
    }
    
    // Edge case: Check trimmed password (user entered only spaces)
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      setPasswordError('Le mot de passe ne peut pas contenir uniquement des espaces');
      return false;
    }
    
    if (trimmedValue.length < 6) {
      setPasswordError('Le mot de passe doit contenir au moins 6 caractères');
      return false;
    }
    setPasswordError(null);
    return true;
  };

  // Handle login with comprehensive security
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

    const formattedPhone = PhoneService.formatPhoneNumber(selectedCountry.code, phoneNumber);

    // Check if account is locked
    const lockStatus = await loginSecurityService.isAccountLocked(formattedPhone);
    if (lockStatus.locked) {
      const timeRemaining = loginSecurityService.formatRemainingTime(lockStatus.remainingTime || 0);
      const errorMsg = `Compte temporairement bloqué. Réessayez dans ${timeRemaining}.`;
      showToast(errorMsg, 'error', 5000);
      triggerShake();
      return;
    }

    // Check if we should delay login (rate limiting)
    const delayInfo = await loginSecurityService.shouldDelayLogin(formattedPhone);
    if (delayInfo.delay) {
      const errorMsg = `Trop de tentatives. Patientez ${delayInfo.seconds} secondes.`;
      showToast(errorMsg, 'warning', 5000);
      triggerShake();
      return;
    }

    setLoading(true);
    try {
      const userCredential = await authService.signInWithPhone(formattedPhone, password);
      
      // Record successful login
      await loginSecurityService.recordAttempt(formattedPhone, true);
      
      showToast('Connexion réussie!', 'success', 3000);

      // Check if biometric is available but not enabled
      const biometricStatus = await biometricService.getStatus();
      const isSetupComplete = await biometricService.isSetupComplete();
      
      console.log('🔐 Biometric check:', {
        isAvailable: biometricStatus.isAvailable,
        isEnabled: biometricStatus.isEnabled,
        isSetupComplete,
        biometryType: biometricStatus.biometryType,
      });
      
      if (biometricStatus.isAvailable && !biometricStatus.isEnabled && !isSetupComplete) {
        console.log('🔐 Showing biometric prompt BEFORE navigation...');
        // Show biometric prompt BEFORE setting user (which triggers navigation)
        // Pass userCredential to be set after modal is dismissed
        showBiometricPrompt(userCredential.uid, {
          phoneNumber: formattedPhone,
          password: password,
        }, userCredential);
        // Don't set user here - it will be set after biometric modal is dismissed
      } else {
        console.log('🔐 Not showing biometric prompt, navigating directly:', {
          available: biometricStatus.isAvailable,
          enabled: biometricStatus.isEnabled,
          setupComplete: isSetupComplete,
        });
        // Set user in AuthContext (this triggers navigation to main app)
        setPhoneUser(userCredential);
        console.log('✅ User logged in and set in AuthContext:', userCredential.uid);
      }
    } catch (err: any) {
      // Record failed login attempt
      await loginSecurityService.recordAttempt(formattedPhone, false);
      
      // Handle specific error messages
      let errorMessage = '';
      
      // Check if it's our custom error message
      if (err.message) {
        if (err.message.includes('Aucun compte trouvé')) {
          errorMessage = 'Aucun compte trouvé avec ce numéro de téléphone';
        } else if (err.message.includes('Mot de passe incorrect')) {
          errorMessage = 'Mot de passe incorrect';
        } else {
          errorMessage = err.message;
        }
      } else {
        errorMessage = getErrorMessage(err.code || '');
      }
      
      triggerShake();

      // Update security status after failed attempt
      const security = await loginSecurityService.getSecurityStatus(formattedPhone);
      setSecurityStatus({
        locked: security.locked,
        remainingAttempts: security.remainingAttempts,
        lockTimeRemaining: security.remainingLockTime || 0,
      });

      // Combine error message with remaining attempts warning in single toast
      if (security.remainingAttempts <= 2 && security.remainingAttempts > 0) {
        const combinedMessage = `${errorMessage}. Attention: ${security.remainingAttempts} tentatives restantes avant blocage.`;
        showToast(combinedMessage, 'error', 6000);
      } else {
        showToast(errorMessage, 'error', 5000);
      }
    } finally {
      setLoading(false);
    }
  };

  // Biometric modal handlers
  const showBiometricPrompt = (userId: string, credentials: {
    email?: string;
    phoneNumber?: string;
    password?: string;
  }, userCredential?: any) => {
    console.log('🔐 [showBiometricPrompt] Setting modal state to true', {userId, hasCredentials: !!credentials});
    setBiometricPromptData({userId, credentials});
    // Store the user credential to set after modal is dismissed
    pendingUserCredentialRef.current = userCredential || null;
    setShowBiometricModal(true);
    console.log('🔐 [showBiometricPrompt] Modal state set, biometryType:', biometricStatus?.biometryType);
  };

  // Ref to store pending user credential (to set after biometric modal)
  const pendingUserCredentialRef = useRef<any>(null);

  const handleBiometricAccept = async () => {
    if (!biometricPromptData) return;

    setShowBiometricModal(false);
    
    const credentials = biometricPromptData.credentials;
    // Ensure password exists before enabling biometric
    if (!credentials.password) {
      showToast('Informations de connexion incomplètes', 'error', 3000);
      if (pendingUserCredentialRef.current) {
        setPhoneUser(pendingUserCredentialRef.current);
        pendingUserCredentialRef.current = null;
      }
      setBiometricPromptData(null);
      return;
    }
    
    const result = await biometricService.enable(
      biometricPromptData.userId,
      {
        ...credentials,
        password: credentials.password,
      },
    );
    
    if (result.success) {
      showToast('Connexion biométrique activée!', 'success', 3000);
      const updatedStatus = await biometricService.getStatus();
      setBiometricStatus(updatedStatus);
    } else {
      showToast(
        result.error || 'Échec de l\'activation',
        'error',
        3000,
      );
    }
    
    // Now set the user to trigger navigation (after modal is handled)
    if (pendingUserCredentialRef.current) {
      setPhoneUser(pendingUserCredentialRef.current);
      pendingUserCredentialRef.current = null;
    }
    
    setBiometricPromptData(null);
  };

  const handleBiometricDecline = async () => {
    setShowBiometricModal(false);
    await biometricService.markSetupComplete();
    
    // Now set the user to trigger navigation (after modal is handled)
    if (pendingUserCredentialRef.current) {
      setPhoneUser(pendingUserCredentialRef.current);
      pendingUserCredentialRef.current = null;
    }
    
    setBiometricPromptData(null);
  };

  // Handle forgot password - navigate to forgot password flow
  const handleForgotPassword = () => {
    navigation.navigate('ForgotPassword');
  };

  // Check if form is valid for submission
  const isFormValid = () => {
    return phoneNumber.trim().length > 0 && password.length >= 6;
  };

  // Handle Google sign in
  const handleGoogleSignIn = async () => {
    setSocialLoading('google');
    setError(null);
    try {
      const userCredential = await signInWithGoogle();
      console.log('[LoginScreen] Google sign in result:', {
        userId: userCredential?.uid,
        email: userCredential?.email,
      });
      
      // Note: Biometric auth is NOT supported for social logins
      // because we cannot store/re-use OAuth tokens automatically
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
      const userCredential = await signInWithApple();
      // Note: Biometric auth is NOT supported for social logins
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
      const userCredential = await signInWithFacebook();
      // Note: Biometric auth is NOT supported for social logins
    } catch (err: any) {
      setError(err?.message || 'Échec de la connexion Facebook');
    } finally {
      setSocialLoading(null);
    }
  };

  // Check biometric availability on mount and when screen focuses
  useEffect(() => {
    const checkBiometric = async () => {
      const status = await biometricService.getStatus();
      setBiometricStatus(status);
    };
    checkBiometric();
  }, []);

  // Refresh biometric status when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      const refreshBiometric = async () => {
        const status = await biometricService.getStatus();
        setBiometricStatus(status);
      };
      refreshBiometric();
    }, [])
  );

  // Handle biometric login
  const handleBiometricLogin = async () => {
    setBiometricLoading(true);
    setError(null);
    try {
      const result = await biometricService.login();
      if (result.success && result.credentials) {
        const {phoneNumber: storedPhone, email: storedEmail, password: storedPassword} = result.credentials;
        
        // For social logins (no password stored), re-authenticate using Firebase
        if (!storedPassword) {
          // Clear invalid biometric setup
          await biometricService.disable();
          // Refresh biometric status
          const status = await biometricService.getStatus();
          setBiometricStatus(status);
          throw new Error(
            'Données biométriques incomplètes. Veuillez vous reconnecter avec votre mot de passe.',
          );
        }
        
        // For phone/email + password logins
        if (storedPhone && storedPassword) {
          // Perform actual authentication with stored credentials
          try {
            const userCredential = await authService.signInWithPhone(storedPhone, storedPassword);
            // Set user in AuthContext to trigger navigation
            setPhoneUser(userCredential);
            showToast('Connexion biométrique réussie!', 'success', 2000);
          } catch (authError: any) {
            // If auth fails, credentials might be outdated
            await biometricService.disable();
            const status = await biometricService.getStatus();
            setBiometricStatus(status);
            throw new Error(
              'Informations expirées. Veuillez vous reconnecter avec votre mot de passe.',
            );
          }
        } else if (storedEmail && storedPassword) {
          // Email + password login
          try {
            const userCredential = await authService.signInWithEmail(storedEmail, storedPassword);
            // Set user in AuthContext to trigger navigation
            setPhoneUser(userCredential);
            showToast('Connexion biométrique réussie!', 'success', 2000);
          } catch (authError: any) {
            // If auth fails, credentials might be outdated
            await biometricService.disable();
            const status = await biometricService.getStatus();
            setBiometricStatus(status);
            throw new Error(
              'Informations expirées. Veuillez vous reconnecter avec votre mot de passe.',
            );
          }
        } else {
          // Clear invalid biometric setup
          await biometricService.disable();
          const status = await biometricService.getStatus();
          setBiometricStatus(status);
          throw new Error('Informations de connexion incomplètes. Veuillez vous reconnecter.');
        }
      } else {
        throw new Error(result.error || 'Authentification échouée');
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Échec de la connexion biométrique';
      setError(errorMsg);
      showToast(errorMsg, 'error', 5000);
    } finally {
      setBiometricLoading(false);
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
              <Text style={styles.appName}>Goshopper</Text>
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

            {/* Login Card */}
            <View style={styles.loginCard}>
              {/* Phone Number Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Numéro de téléphone</Text>
                
                <View style={styles.phoneRow}>
                  {/* Country Code Selector */}
                  <TouchableOpacity
                    style={[styles.countrySelector, isLoading && styles.inputDisabled]}
                    onPress={() => !isLoading && setShowCountryModal(true)}
                    disabled={isLoading}
                  >
                    <Text style={styles.flagEmoji}>{selectedCountry.flag}</Text>
                    <Text style={styles.countryCode}>{selectedCountry.code}</Text>
                    <Icon name="chevron-down" size="xs" color={GOCHUJANG.textMuted} />
                  </TouchableOpacity>

                  {/* Phone Input */}
                  <View
                    style={[
                      styles.phoneInputWrapper,
                      !!phoneError && styles.inputError,
                      isLoading && styles.inputDisabled,
                    ]}>
                    <TextInput
                      style={styles.phoneInput}
                      placeholder={selectedCountry.code === '+243' ? '123456789' : '123456789'}
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
                </View>
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
                
                {/* Security Status */}
                {securityStatus.locked && (
                  <View style={styles.securityWarning}>
                    <Icon name="shield-off" size="xs" color={GOCHUJANG.error} />
                    <Text style={styles.securityWarningText}>
                      Compte temporairement bloqué
                    </Text>
                  </View>
                )}
                
                {!securityStatus.locked && securityStatus.remainingAttempts <= 2 && (
                  <View style={styles.securityInfo}>
                    <Icon name="alert-triangle" size="xs" color="#ffa502" />
                    <Text style={styles.securityInfoText}>
                      {securityStatus.remainingAttempts} tentatives restantes
                    </Text>
                  </View>
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
              <Button
                title="Se connecter"
                onPress={handleLogin}
                disabled={isLoading || !isFormValid() || securityStatus.locked}
                loading={loading}
                icon={<Icon name="arrow-right" size="md" color="white" />}
                iconPosition="right"
                fullWidth
              />

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
                      styles.googleButton,
                      styles.singleSocialButton,
                      isLoading && styles.buttonDisabled,
                    ]}
                    onPress={handleGoogleSignIn}
                    disabled={isLoading}
                    activeOpacity={0.7}>
                    {socialLoading === 'google' ? (
                      <ActivityIndicator
                        size="small"
                        color="#4285F4"
                      />
                    ) : (
                      <>
                        <Icon name="logo-google" size="sm" color="#4285F4" />
                        <Text style={styles.googleButtonText}>
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
                        <Icon name="logo-apple" size="sm" color={GOCHUJANG.white} />
                        <Text style={styles.appleButtonText}>
                          Continuer avec Apple
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {/* Facebook Sign-In - Temporarily disabled
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
                      <Icon name="logo-facebook" size="sm" color={GOCHUJANG.white} />
                      <Text style={styles.facebookButtonText}>
                        Continuer avec Facebook
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                */}
              </View>

              {/* Biometric Login Button */}
              {biometricStatus?.isAvailable && biometricStatus?.isEnabled && (
                <>
                  <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>ou</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  <Button
                    variant="outline"
                    title="Connexion biométrique"
                    onPress={handleBiometricLogin}
                    disabled={isLoading || biometricLoading}
                    loading={biometricLoading}
                    icon={<Icon name="fingerprint" size="sm" color={GOCHUJANG.textPrimary} />}
                    iconPosition="left"
                  />
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

            {/* Footer */}
            <View style={styles.guestFooter}>
              <Text style={styles.footerText}>
                Se connecter c'est{' '}
                <Text style={styles.footerHighlight}>gratuit, rapide et sécurisé</Text>
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Country Selection Modal */}
      <Modal
        visible={showCountryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCountryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sélectionner le pays</Text>
              <TouchableOpacity
                onPress={() => setShowCountryModal(false)}
                style={styles.closeButton}
              >
                <Icon name="x" size="md" color={GOCHUJANG.textMuted} />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={countryCodeList}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.countryItem,
                    selectedCountry.code === item.code && styles.selectedCountryItem
                  ]}
                  onPress={() => {
                    setSelectedCountry(item);
                    setShowCountryModal(false);
                    // Reset security status when country changes (different formatted phone)
                    setSecurityStatus({
                      locked: false,
                      remainingAttempts: 5,
                      lockTimeRemaining: 0,
                    });
                  }}
                >
                  <Text style={styles.countryFlag}>{item.flag}</Text>
                  <Text style={styles.countryName}>{item.name}</Text>
                  <Text style={styles.countryCodeText}>{item.code}</Text>
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>

      {/* Biometric Modal */}
      <BiometricModal
        visible={showBiometricModal}
        biometryType={biometricStatus?.biometryType || null}
        onAccept={handleBiometricAccept}
        onDecline={handleBiometricDecline}
      />
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
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
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
    paddingVertical: 8,
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

  // Phone Row - country and phone on same line
  phoneRow: {
    flexDirection: 'row',
    gap: 12,
  },

  // Country Selector
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GOCHUJANG.background,
    borderWidth: 1.5,
    borderColor: GOCHUJANG.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  flagEmoji: {
    fontSize: 20,
  },
  countryCode: {
    fontSize: 16,
    color: GOCHUJANG.textPrimary,
    fontWeight: '500',
  },
  
  // Phone Input
  phoneInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GOCHUJANG.background,
    borderWidth: 1.5,
    borderColor: GOCHUJANG.border,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  phoneInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 16,
    color: GOCHUJANG.textPrimary,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: GOCHUJANG.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: GOCHUJANG.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  selectedCountryItem: {
    backgroundColor: GOCHUJANG.secondaryAccent,
  },
  countryFlag: {
    fontSize: 24,
    width: 30,
  },
  countryName: {
    flex: 1,
    fontSize: 16,
    color: GOCHUJANG.textPrimary,
  },
  countryCodeText: {
    fontSize: 14,
    color: GOCHUJANG.textMuted,
    fontWeight: '500',
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
    gap: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  singleSocialButton: {
    flex: 0,
    width: '100%',
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DADCE0',
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3C4043',
  },
  appleButton: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  appleButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: GOCHUJANG.white,
  },
  facebookButton: {
    backgroundColor: '#1877F2',
    borderColor: '#1877F2',
  },
  facebookButtonText: {
    fontSize: 15,
    fontWeight: '600',
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

  // Guest Footer
  guestFooter: {
    alignItems: 'center',
    paddingVertical: 20,
    marginTop: 8,
  },
  footerText: {
    fontSize: 14,
    color: GOCHUJANG.textSecondary,
    textAlign: 'center',
  },
  footerHighlight: {
    fontWeight: '700',
    color: GOCHUJANG.primary,
  },

  // Security Indicators
  securityWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
    gap: 6,
  },
  securityWarningText: {
    fontSize: 12,
    color: GOCHUJANG.error,
    flex: 1,
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
    gap: 6,
  },
  securityInfoText: {
    fontSize: 12,
    color: '#ffa502',
    flex: 1,
  },
});


