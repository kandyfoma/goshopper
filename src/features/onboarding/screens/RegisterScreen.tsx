// Register Screen - 2-step phone registration
import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  NativeModules,
  NativeEventEmitter,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '@/shared/types';
import {authService} from '@/shared/services/firebase';
import {PhoneService} from '@/shared/services/phone';
import {smsService} from '@/shared/services';
import {countryCodeList, congoCities} from '@/shared/constants/countries';
import {
  COUNTRIES_CITIES,
  POPULAR_CITIES,
  searchCities,
  CountryData,
  CityData,
} from '@/shared/constants/cities';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
} from '@/shared/theme/theme';
import {Icon, Button, BiometricModal, BackButton} from '@/shared/components';
import {passwordService} from '@/shared/services/password';
import {useAuth, useToast} from '@/shared/contexts';
import {biometricService} from '@/shared/services/biometric';
import {getFCMToken} from '@/shared/services/notificationService';
import functions from '@react-native-firebase/functions';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RegistrationStep = 'step1' | 'step2' | 'step3';

export function RegisterScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {signInWithGoogle, signInWithApple, setPhoneUser, suppressAuthListener, enableAuthListener} = useAuth();
  const {showToast} = useToast();
  
  // Step management
  const [currentStep, setCurrentStep] = useState<RegistrationStep>('step1');
  
  // Step 1: Phone number and city
  const [selectedCountry, setSelectedCountry] = useState(countryCodeList[0]); // Default to RDC
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [phoneExists, setPhoneExists] = useState(false);
  const [checkingPhone, setCheckingPhone] = useState(false);
  
  // Step 2: OTP Verification
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [verificationToken, setVerificationToken] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpInputRefs = React.useRef<Array<TextInput | null>>([]);
  
  // Step 3: Password and terms
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  
  // Biometric modal state
  const [showBiometricModal, setShowBiometricModal] = useState(false);
  const [biometryType, setBiometryType] = useState<'TouchID' | 'FaceID' | 'Biometrics' | null>(null);
  const [biometricData, setBiometricData] = useState<{userId: string; phoneNumber: string; password: string} | null>(null);
  const [pendingUser, setPendingUser] = useState<any>(null); // Store user until biometric modal is handled
  
  // Modal states
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);
  const [selectedLocationCountry, setSelectedLocationCountry] = useState<CountryData | null>(null);
  const [showCountrySelector, setShowCountrySelector] = useState(true);
  const [citySearchQuery, setCitySearchQuery] = useState('');
  
  // Loading states
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);

  // Ref for phone check timeout (fix memory leak)
  const phoneCheckTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Phone number validation and checking
  const validatePhoneNumber = (phone: string): string => {
    if (!phone.trim()) {
      return 'Le numéro de téléphone est requis';
    }
    
    const formatted = PhoneService.formatPhoneNumber(selectedCountry.code, phone);
    if (!PhoneService.validatePhoneNumber(formatted)) {
      return 'Numéro de téléphone invalide';
    }
    
    return '';
  };

  const checkPhoneExists = async (phone: string) => {
    if (!phone.trim()) return;
    
    const formatted = PhoneService.formatPhoneNumber(selectedCountry.code, phone);
    const error = validatePhoneNumber(phone);
    if (error) return;
    
    setCheckingPhone(true);
    setNetworkError(null);
    try {
      const exists = await PhoneService.checkPhoneExists(formatted);
      setPhoneExists(exists);
    } catch (err: any) {
      console.error('Error checking phone:', err);
      // Show network error to user instead of silently failing
      setNetworkError('Impossible de vérifier le numéro. Vérifiez votre connexion.');
    } finally {
      setCheckingPhone(false);
    }
  };

  const handlePhoneChange = (text: string) => {
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
    setPhoneError('');
    setPhoneExists(false);
    setNetworkError(null);
    
    // Debounce phone checking (using ref to avoid memory leak)
    if (phoneCheckTimeoutRef.current) {
      clearTimeout(phoneCheckTimeoutRef.current);
    }
    phoneCheckTimeoutRef.current = setTimeout(() => {
      checkPhoneExists(cleanText);
    }, 800);
  };

  useEffect(() => {
    return () => {
      if (phoneCheckTimeoutRef.current) {
        clearTimeout(phoneCheckTimeoutRef.current);
      }
    };
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // SMS Retriever for Android auto-fill
  useEffect(() => {
    if (Platform.OS === 'android' && currentStep === 'step2') {
      const {SmsRetriever} = NativeModules;
      
      if (SmsRetriever && SmsRetriever.startSmsRetriever) {
        console.log('📱 Starting SMS Retriever...');
        
        SmsRetriever.startSmsRetriever()
          .then(() => {
            console.log('✅ SMS Retriever started');
            
            const eventEmitter = new NativeEventEmitter(SmsRetriever);
            const subscription = eventEmitter.addListener('com.google.android.gms.auth.api.phone.SMS_RETRIEVED', (event) => {
              console.log('📨 SMS received:', event.message);
              
              // Extract 6-digit OTP from SMS
              const otpMatch = event.message.match(/\b\d{6}\b/);
              if (otpMatch) {
                const code = otpMatch[0];
                console.log('🔢 OTP extracted:', code);
                
                // Auto-fill OTP
                const otpArray = code.split('');
                setOtp(otpArray);
                
                // Auto-verify after a short delay
                setTimeout(() => {
                  handleVerifyOtp(code);
                }, 300);
              }
            });
            
            return () => subscription.remove();
          })
          .catch((error: any) => {
            console.log('❌ SMS Retriever error:', error);
          });
      } else {
        console.log('⚠️ SMS Retriever not available');
      }
    }
  }, [currentStep]);

  // OTP handling functions
  const handleOtpChange = (value: string, index: number) => {
    if (!/^\d*$/.test(value)) return; // Only allow digits
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setOtpError('');
    
    // Auto-focus next input
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
    
    // Auto-submit when all 6 digits are entered
    if (newOtp.every(digit => digit !== '') && newOtp.join('').length === 6) {
      handleVerifyOtp(newOtp.join(''));
    }
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async (code?: string) => {
    const otpCode = code || otp.join('');
    
    if (otpCode.length !== 6) {
      setOtpError('Veuillez entrer les 6 chiffres');
      return;
    }
    
    setVerifyingOtp(true);
    setOtpError('');
    
    try {
      const formattedPhone = PhoneService.formatPhoneNumber(selectedCountry.code, phoneNumber);
      console.log('🔐 Verifying OTP:', otpCode);
      
      const result = await smsService.verifyOTP(formattedPhone, otpCode, sessionId);
      
      if (result.success && result.verified) {
        console.log('✅ OTP verified successfully');
        setVerificationToken(result.verificationToken || result.token || '');
        setCurrentStep('step3');
      } else {
        throw new Error(result.error || 'Code de vérification incorrect');
      }
    } catch (err: any) {
      console.error('❌ Error verifying OTP:', err);
      
      // Handle specific error cases with user-friendly messages
      const errorMessage = err.message || 'Code invalide';
      
      if (errorMessage.includes('already been verified') || errorMessage.includes('Session deja verifiee')) {
        showToast('Ce code a déjà été utilisé. Demandez un nouveau code.', 'warning');
        setOtpError('Session déjà vérifiée - demandez un nouveau code');
        // Clear the session to force resend
        setSessionId('');
        setCurrentStep('step1'); // Go back to phone input to get new code
      } else if (errorMessage.includes('expired') || errorMessage.includes('deadline-exceeded')) {
        showToast('Code expiré. Demandez un nouveau code.', 'warning');
        setOtpError('Code expiré');
        setCurrentStep('step1');
      } else {
        setOtpError(errorMessage);
        showToast('Code de vérification incorrect', 'error');
      }
      
      // Clear OTP inputs
      setOtp(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    
    setSendingOtp(true);
    setOtpError('');
    
    try {
      const formattedPhone = PhoneService.formatPhoneNumber(selectedCountry.code, phoneNumber);
      console.log('📱 Resending OTP to:', formattedPhone);
      
      const result = await smsService.resendOTP(formattedPhone, selectedCountry.alpha2, 'fr');
      
      if (result.success && result.sessionId) {
        console.log('✅ OTP resent, new session ID:', result.sessionId);
        setSessionId(result.sessionId);
        setResendCooldown(60);
        // Clear OTP inputs
        setOtp(['', '', '', '', '', '']);
        otpInputRefs.current[0]?.focus();
      } else {
        throw new Error(result.error || 'Échec du renvoi du code');
      }
    } catch (err: any) {
      console.error('❌ Error resending OTP:', err);
      showToast('Impossible de renvoyer le code', 'error');
    } finally {
      setSendingOtp(false);
    }
  };

  // Password validation with comprehensive edge cases
  const validatePassword = (pwd: string): string => {
    const validation = passwordService.validatePassword(
      pwd,
      passwordService.getRequirements('register'),
      { phone: phoneNumber, name: '' }
    );
    
    return validation.errors[0] || ''; // Return first error or empty string
  };

  const getPasswordValidation = (pwd: string) => {
    return passwordService.validatePassword(
      pwd,
      passwordService.getRequirements('register'),
      { phone: phoneNumber, name: '' }
    );
  };

  const handlePasswordChange = (text: string) => {
    // Sanitize password input
    const sanitized = passwordService.sanitizePassword(text);
    setPassword(sanitized);
    const error = validatePassword(sanitized);
    setPasswordError(error);
  };

  const handleConfirmPasswordChange = (text: string) => {
    const sanitized = passwordService.sanitizePassword(text);
    setConfirmPassword(sanitized);
    if (sanitized && !passwordService.passwordsMatch(password, sanitized)) {
      setConfirmPasswordError('Les mots de passe ne correspondent pas');
    } else {
      setConfirmPasswordError('');
    }
  };

  // Step 1 validation
  const isStep1Valid = (): boolean => {
    return (
      phoneNumber.trim() !== '' &&
      selectedCity !== '' &&
      !phoneError &&
      !phoneExists &&
      !checkingPhone &&
      !networkError // Block if there's a network error
    );
  };

  // Step 2 validation (OTP)
  const isStep2Valid = (): boolean => {
    return otp.every(digit => digit !== '') && otp.join('').length === 6;
  };

  // Step 3 validation (Password)
  const isStep3Valid = (): boolean => {
    return (
      password !== '' &&
      confirmPassword !== '' &&
      !passwordError &&
      !confirmPasswordError &&
      acceptedTerms
    );
  };

  const handleStep1Continue = async () => {
    // Clear previous errors
    setError(null);
    setNetworkError(null);
    
    const error = validatePhoneNumber(phoneNumber);
    if (error) {
      setPhoneError(error);
      return;
    }
    
    if (!selectedCity) {
      showToast('Veuillez selectionner votre ville', 'error');
      return;
    }
    
    if (phoneExists) {
      return; // User should see the error message already
    }
    
    // Check for network error before proceeding
    if (networkError) {
      showToast('Verifiez votre connexion internet', 'error');
      return;
    }
    
    // Send OTP
    setSendingOtp(true);
    setError(null);
    
    try {
      const formattedPhone = PhoneService.formatPhoneNumber(selectedCountry.code, phoneNumber);
      console.log('📱 Sending OTP to:', formattedPhone);
      
      const result = await smsService.sendOTP(formattedPhone, selectedCountry.alpha2, 'fr');
      
      if (result.success) {
        // Check if OTP was skipped for non-Congo numbers
        if (result.skipped) {
          console.log('⏭️ OTP skipped for non-Congo number, proceeding to password step');
          // Set a dummy verification token for non-Congo numbers
          setVerificationToken('non-congo-verified');
          setCurrentStep('step3'); // Skip OTP step, go directly to password
          showToast('Numéro international détecté - vérification OTP non requise', 'info', 3000);
        } else if (result.sessionId) {
          console.log('✅ OTP sent, session ID:', result.sessionId);
          setSessionId(result.sessionId);
          setCurrentStep('step2');
          
          // Show info for test numbers
          if (formattedPhone.includes('999999')) {
            showToast('Numéro de test détecté. Utilisez le code: 123456', 'info', 5000);
          }
          
          // Start resend cooldown
          setResendCooldown(60);
        } else {
          throw new Error('Invalid OTP response');
        }
      } else {
        throw new Error(result.error || 'Échec de l\'envoi du code');
      }
    } catch (err: any) {
      console.error('\u274c Error sending OTP:', err);
      
      // Handle daily limit error
      const errorMsg = err.message || '';
      if (errorMsg.includes('Limite quotidienne') || errorMsg.includes('3 codes')) {
        setError('Limite quotidienne atteinte. Reessayez demain.');
        showToast('Limite de 3 codes par jour atteinte', 'error', 5000);
      } else if (errorMsg.includes('attendre')) {
        setError(errorMsg);
        showToast(errorMsg, 'warning');
      } else {
        setError(err.message || 'Impossible d\'envoyer le code de verification');
        showToast('Erreur lors de l\'envoi du code', 'error');
      }
    } finally {
      setSendingOtp(false);
    }
  };

  const handleRegistration = async () => {
    if (!isStep3Valid()) return;
    
    if (!verificationToken) {
      setError("Veuillez d'abord vérifier votre numéro");
      setCurrentStep('step2');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const formattedPhone = PhoneService.formatPhoneNumber(selectedCountry.code, phoneNumber);
      
      console.log('📝 Creating user with verified phone:', formattedPhone);
      
      // Suppress auth listener during registration to prevent auto-navigation
      // This allows biometric modal to show before navigation
      suppressAuthListener();
      
      // Create user with verified phone number
      const user = await authService.createUserWithPhone({
        phoneNumber: formattedPhone,
        password,
        city: selectedCity,
        countryCode: selectedCountry.code,
        verificationToken, // Pass the verification token from OTP
      });
      
      console.log('✅ User created:', user.uid);
      
      // Send welcome notification (don't block on this)
      try {
        const fcmToken = await getFCMToken();
        console.log('📱 FCM Token:', fcmToken ? 'received' : 'null');
        
        const result = await functions().httpsCallable('sendWelcomeToNewUser')({
          userId: user.uid,
          fcmToken,
          language: 'fr',
        });
        console.log('✅ Welcome notification result:', result.data);
      } catch (notifErr) {
        console.log('❌ Welcome notification not sent:', notifErr);
      }
      
      // Check biometric availability and prompt user
      console.log('🔐 Checking biometric availability...');
      const {available, biometryType: availableBiometryType} = await biometricService.checkAvailability();
      console.log('🔐 Biometric check result:', {available, biometryType: availableBiometryType});
      
      if (available && availableBiometryType) {
        console.log('🔐 Biometric available, showing modal...');
        // Store user for later - DON'T call setPhoneUser yet (it would trigger navigation)
        setPendingUser(user);
        // Store user data for biometric setup
        setBiometricData({
          userId: user.uid,
          phoneNumber: formattedPhone,
          password: password,
        });
        setBiometryType(availableBiometryType);
        setShowBiometricModal(true);
      } else {
        console.log('🔐 Biometric NOT available, logging in user...');
        // Re-enable auth listener before setting user
        enableAuthListener();
        // Set user in AuthContext to log them in (this triggers navigation)
        setPhoneUser(user);
        console.log('✅ User set in AuthContext');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      setError(error.message || 'Erreur lors de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setSocialLoading('google');
    setError(null);
    try {
      console.log('🔍 [RegisterScreen] Starting Google sign-in...');
      // Suppress auth listener during sign-in
      suppressAuthListener();
      const userCredential = await signInWithGoogle();
      
      if (!userCredential) {
        console.log('❌ [RegisterScreen] No user credential returned');
        enableAuthListener();
        setSocialLoading(null);
        return;
      }

      console.log('[RegisterScreen] Google sign in result:', {
        email: userCredential.email,
        userId: userCredential.id,
      });

      // Check if user has phone number and if it's verified
      const hasPhone = !!userCredential.phoneNumber;
      const phoneVerified = userCredential.phoneVerified === true;

      console.log('[RegisterScreen] Google user profile:', {
        hasProfile: hasPhone,
        phoneNumber: userCredential.phoneNumber,
        phoneVerified: phoneVerified,
      });

      let needsPhoneNumber = false;
      let needsPhoneVerification = false;
      let phoneToVerify = '';

      if (!hasPhone) {
        // No phone number at all - need to collect it
        needsPhoneNumber = true;
        console.log('📱 [RegisterScreen] No phone number found - routing to ProfileSetup');
      } else if (!phoneVerified) {
        // Has phone but not verified
        needsPhoneVerification = true;
        phoneToVerify = userCredential.phoneNumber || '';
        console.log('📱 [RegisterScreen] Phone exists but not verified:', phoneToVerify);
      } else {
        // Has verified phone - complete sign-in
        console.log('✅ [RegisterScreen] Phone already verified - completing sign-in');
      }

      // If user needs to add phone number, enable listener and let RootNavigator show ProfileSetup
      if (needsPhoneNumber) {
        console.log('📱 [RegisterScreen] Enabling auth listener for ProfileSetup...');
        setSocialLoading(null);
        // Set the social user in auth context (will mark profile as incomplete)
        // This is handled by signInWithGoogle through the auth listener
        enableAuthListener();
        // RootNavigator will now redirect to ProfileSetup automatically
        return;
      }

      // If phone verification is needed, send OTP and navigate
      if (needsPhoneVerification && phoneToVerify) {
        try {
          const otpResult = await smsService.sendOTP(phoneToVerify);
          console.log('📱 [RegisterScreen] OTP result:', {
            success: otpResult.success,
            hasSessionId: !!otpResult.sessionId,
            skipped: otpResult.skipped,
          });

          // Check if OTP was skipped for non-Congo numbers
          if (otpResult.success && otpResult.skipped) {
            console.log('⏭️ OTP skipped for non-Congo number, completing sign-in');
            setSocialLoading(null);
            enableAuthListener();
            setSocialUser(userCredential);
            showToast('Numéro international détecté - vérification OTP non requise', 'info', 3000);
            return;
          }

          if (otpResult.success && otpResult.sessionId) {
            setSocialLoading(null);
            navigation.navigate('VerifyOtp', {
              phoneNumber: phoneToVerify,
              sessionId: otpResult.sessionId,
              fromSocial: 'google',
              socialUser: userCredential,
            });
            // Don't enable auth listener yet - wait for verification to complete
            return;
          } else {
            throw new Error(otpResult.message || 'Failed to send OTP');
          }
        } catch (otpError: any) {
          console.error('❌ [RegisterScreen] OTP send failed:', otpError);
          enableAuthListener();
          setError(otpError?.message || 'Échec de l\'envoi du code de vérification');
          setSocialLoading(null);
          return;
        }
      }

      // User has verified phone - complete sign-in
      console.log('✅ [RegisterScreen] Completing Google sign-in with verified phone');
      enableAuthListener();
      setSocialUser(userCredential);
      setSocialLoading(null);
      console.log('✅ Google sign-in completed, user set in context');
    } catch (err: any) {
      console.error('❌ [RegisterScreen] Google sign-in error:', err);
      enableAuthListener();
      setError(err?.message || 'Échec de la connexion Google');
      setSocialLoading(null);
    }
  };

  const handleAppleSignIn = async () => {
    setSocialLoading('apple');
    setError(null);
    try {
      console.log('🍎 [RegisterScreen] Starting Apple sign-in...');
      // Suppress auth listener during sign-in
      suppressAuthListener();
      const userCredential = await signInWithApple();
      
      if (!userCredential) {
        console.log('❌ [RegisterScreen] No user credential returned');
        enableAuthListener();
        setSocialLoading(null);
        return;
      }

      console.log('[RegisterScreen] Apple sign in result:', {
        email: userCredential.email,
        userId: userCredential.id,
      });

      // Check if user has phone number and if it's verified
      const hasPhone = !!userCredential.phoneNumber;
      const phoneVerified = userCredential.phoneVerified === true;

      console.log('[RegisterScreen] Apple user profile:', {
        hasProfile: hasPhone,
        phoneNumber: userCredential.phoneNumber,
        phoneVerified: phoneVerified,
      });

      let needsPhoneNumber = false;
      let needsPhoneVerification = false;
      let phoneToVerify = '';

      if (!hasPhone) {
        // No phone number at all - need to collect it
        needsPhoneNumber = true;
        console.log('📱 [RegisterScreen] No phone number found - routing to ProfileSetup');
      } else if (!phoneVerified) {
        // Has phone but not verified
        needsPhoneVerification = true;
        phoneToVerify = userCredential.phoneNumber || '';
        console.log('📱 [RegisterScreen] Phone exists but not verified:', phoneToVerify);
      } else {
        // Has verified phone - complete sign-in
        console.log('✅ [RegisterScreen] Phone already verified - completing sign-in');
      }

      // If user needs to add phone number, enable listener and let RootNavigator show ProfileSetup
      if (needsPhoneNumber) {
        console.log('📱 [RegisterScreen] Enabling auth listener for ProfileSetup...');
        setSocialLoading(null);
        // Set the social user in auth context (will mark profile as incomplete)
        enableAuthListener();
        // RootNavigator will now redirect to ProfileSetup automatically
        return;
      }

      // If phone verification is needed, send OTP and navigate
      if (needsPhoneVerification && phoneToVerify) {
        try {
          const otpResult = await smsService.sendOTP(phoneToVerify);
          console.log('📱 [RegisterScreen] OTP result:', {
            success: otpResult.success,
            hasSessionId: !!otpResult.sessionId,
            skipped: otpResult.skipped,
          });

          // Check if OTP was skipped for non-Congo numbers
          if (otpResult.success && otpResult.skipped) {
            console.log('⏭️ OTP skipped for non-Congo number, completing sign-in');
            setSocialLoading(null);
            enableAuthListener();
            setSocialUser(userCredential);
            showToast('Numéro international détecté - vérification OTP non requise', 'info', 3000);
            return;
          }

          if (otpResult.success && otpResult.sessionId) {
            setSocialLoading(null);
            navigation.navigate('VerifyOtp', {
              phoneNumber: phoneToVerify,
              sessionId: otpResult.sessionId,
              fromSocial: 'apple',
              socialUser: userCredential,
            });
            // Don't enable auth listener yet - wait for verification to complete
            return;
          } else {
            throw new Error(otpResult.message || 'Failed to send OTP');
          }
        } catch (otpError: any) {
          console.error('❌ [RegisterScreen] OTP send failed:', otpError);
          enableAuthListener();
          setError(otpError?.message || 'Échec de l\'envoi du code de vérification');
          setSocialLoading(null);
          return;
        }
      }

      // User has verified phone - complete sign-in
      console.log('✅ [RegisterScreen] Completing Apple sign-in with verified phone');
      enableAuthListener();
      setSocialUser(userCredential);
      setSocialLoading(null);
      console.log('✅ Apple sign-in completed, user set in context');
    } catch (err: any) {
      console.error('❌ [RegisterScreen] Apple sign-in error:', err);
      enableAuthListener();
      setError(err?.message || 'Échec de la connexion Apple');
      setSocialLoading(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        {/* Header - Fixed at top, outside ScrollView */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (currentStep === 'step3') {
                // Step 3: Go back to step 2
                setCurrentStep('step2');
                setPassword('');
                setConfirmPassword('');
                setPasswordError('');
                setConfirmPasswordError('');
              } else if (currentStep === 'step2') {
                // Step 2: Go back to step 1
                setCurrentStep('step1');
                setOtp(['', '', '', '', '', '']);
                setOtpError('');
              } else {
                // Step 1: Go back to previous screen
                navigation.goBack();
              }
            }}>
            <Icon name="arrow-left" size="md" color={Colors.text.primary} />
          </TouchableOpacity>
          
          <View style={styles.logoContainer}>
            <Icon
              name="user-plus"
              size="3xl"
              color={Colors.accent}
            />
          </View>
          <Text style={styles.title}>Créer un compte</Text>
          <Text style={styles.subtitle}>
            {currentStep === 'step1' 
              ? 'Commençons par vos informations de base'
              : currentStep === 'step2'
              ? 'Vérifiez votre numéro de téléphone'
              : 'Sécurisez votre compte'
            }
          </Text>
          
          {/* Progress indicator */}
          <View style={styles.progressContainer}>
            <View style={[styles.progressStep, currentStep === 'step1' && styles.progressStepActive]}>
              <Text style={[styles.progressStepText, currentStep === 'step1' && styles.progressStepTextActive]}>1</Text>
            </View>
            <View style={[styles.progressLine, (currentStep === 'step2' || currentStep === 'step3') && styles.progressLineActive]} />
            <View style={[styles.progressStep, currentStep === 'step2' && styles.progressStepActive]}>
              <Text style={[styles.progressStepText, currentStep === 'step2' && styles.progressStepTextActive]}>2</Text>
            </View>
            <View style={[styles.progressLine, currentStep === 'step3' && styles.progressLineActive]} />
            <View style={[styles.progressStep, currentStep === 'step3' && styles.progressStepActive]}>
              <Text style={[styles.progressStepText, currentStep === 'step3' && styles.progressStepTextActive]}>3</Text>
            </View>
          </View>
        </View>
        
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

          {/* Step 1: Phone and City */}
          {currentStep === 'step1' && (
            <View style={styles.form}>
              {/* Country Code and Phone Number */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Numéro de téléphone *</Text>
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
                  <View style={styles.phoneInputContainer}>
                    <TextInput
                      style={[styles.phoneInput, phoneError ? styles.inputError : null]}
                      placeholder="81 234 5678"
                      placeholderTextColor={Colors.text.tertiary}
                      value={phoneNumber}
                      onChangeText={handlePhoneChange}
                      keyboardType="phone-pad"
                      autoCorrect={false}
                      editable={!loading}
                    />
                  </View>
                </View>
                {checkingPhone && <Text style={styles.infoText}>Vérification du numéro...</Text>}
                {phoneExists && <Text style={styles.errorText}>Ce numéro est déjà utilisé</Text>}
                {networkError && <Text style={styles.errorText}>{networkError}</Text>}
              </View>

              {/* City Selection */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Ville *</Text>
                <TouchableOpacity 
                  style={[styles.inputWrapper, !selectedCity && styles.inputPlaceholder]}
                  onPress={() => setShowCityModal(true)}>
                  <Icon name="map-pin" size="md" color={Colors.text.secondary} />
                  <Text style={[
                    styles.input,
                    !selectedCity && styles.placeholderText
                  ]}>
                    {selectedCity || 'Sélectionnez votre ville'}
                  </Text>
                  <Icon name="chevron-down" size="sm" color={Colors.text.secondary} />
                </TouchableOpacity>
              </View>

              {/* Continue Button */}
              <Button
                variant="primary"
                title="Continuer"
                onPress={handleStep1Continue}
                disabled={!isStep1Valid() || sendingOtp}
                loading={sendingOtp}
                icon={<Icon name="arrow-right" size="sm" color={Colors.white} />}
                iconPosition="right"
              />

              {/* Social Login */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>ou</Text>
                <View style={styles.dividerLine} />
              </View>

              <Button
                variant="outline"
                title="Continuer avec Google"
                onPress={handleGoogleSignIn}
                loading={socialLoading === 'google'}
                icon={<Icon name="logo-google" size="sm" color="#4285F4" />}
                iconPosition="left"
              />
              
              {Platform.OS === 'ios' && (
                <Button
                  variant="outline"
                  title="Continuer avec Apple"
                  onPress={handleAppleSignIn}
                  loading={socialLoading === 'apple'}
                  icon={<Icon name="apple" size="sm" color={Colors.text.primary} />}
                  iconPosition="left"
                />
              )}
            </View>
          )}

          {/* Step 2: OTP Verification */}
          {currentStep === 'step2' && (
            <View style={styles.form}>
              {/* Phone Display */}
              <View style={styles.otpPhoneDisplay}>
                <Text style={styles.otpPhoneLabel}>Code envoyé au:</Text>
                <Text style={styles.otpPhoneNumber}>
                  {selectedCountry.code} {phoneNumber}
                </Text>
              </View>

              {/* OTP Input */}
              <View style={styles.otpContainer}>
                <Text style={styles.label}>Code de vérification *</Text>
                <View style={styles.otpInputsRow}>
                  {otp.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={ref => otpInputRefs.current[index] = ref}
                      style={[
                        styles.otpInput,
                        digit && styles.otpInputFilled,
                        otpError && styles.inputError
                      ]}
                      value={digit}
                      onChangeText={(value) => handleOtpChange(value, index)}
                      onKeyPress={(e) => handleOtpKeyPress(e, index)}
                      keyboardType="number-pad"
                      maxLength={1}
                      selectTextOnFocus
                      editable={!verifyingOtp}
                    />
                  ))}
                </View>
                {otpError && <Text style={styles.errorText}>{otpError}</Text>}
                
                {/* Info Text */}
                <Text style={styles.otpInfoText}>
                  {PhoneService.formatPhoneNumber(selectedCountry.code, phoneNumber).includes('999999')
                    ? '🧪 Numéro de test détecté - utilisez: 123456'
                    : 'Entrez le code à 6 chiffres reçu par SMS'}
                </Text>
              </View>

              {/* Resend Code */}
              <View style={styles.resendContainer}>
                {resendCooldown > 0 ? (
                  <Text style={styles.resendCooldownText}>
                    Renvoyer le code dans {resendCooldown}s
                  </Text>
                ) : (
                  <TouchableOpacity onPress={handleResendOtp} disabled={sendingOtp}>
                    <Text style={styles.resendText}>
                      {sendingOtp ? 'Envoi...' : 'Renvoyer le code'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Buttons */}
              <View style={styles.buttonGroup}>
                <Button
                  variant="primary"
                  title="Vérifier"
                  onPress={() => handleVerifyOtp()}
                  disabled={!isStep3Valid()}
                  loading={verifyingOtp}
                  icon={<Icon name="check-circle" size="sm" color={Colors.white} />}
                  iconPosition="right"
                />

                <Button
                  variant="outline"
                  title="Retour"
                  onPress={() => {
                    setCurrentStep('step1');
                    setOtp(['', '', '', '', '', '']);
                    setOtpError('');
                  }}
                  disabled={verifyingOtp}
                  icon={<Icon name="arrow-left" size="sm" color={Colors.text.primary} />}
                  iconPosition="left"
                />
              </View>
            </View>
          )}

          {/* Step 3: Password and Terms */}
          {currentStep === 'step3' && (
            <View style={styles.form}>
              {/* Password */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Mot de passe *</Text>
                <View style={[styles.passwordInputWrapper, passwordError ? styles.inputError : null]}>
                  <Icon name="lock-closed" size="md" color={Colors.text.secondary} />
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Au moins 6 caractères avec 1 chiffre"
                    placeholderTextColor={Colors.text.tertiary}
                    value={password}
                    onChangeText={handlePasswordChange}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                    <Icon
                      name={showPassword ? 'eye-off' : 'eye'}
                      size="md"
                      color={Colors.text.secondary}
                    />
                  </TouchableOpacity>
                </View>
                {passwordError && (
                  <View style={styles.errorContainer}>
                    <Icon name="alert-circle" size="sm" color={Colors.error} />
                    <Text style={styles.errorText}>{passwordError}</Text>
                  </View>
                )}
              </View>

              {/* Confirm Password */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Confirmer le mot de passe *</Text>
                <View style={[styles.passwordInputWrapper, confirmPasswordError ? styles.inputError : null]}>
                  <Icon name="shield-check" size="md" color={Colors.text.secondary} />
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Répétez votre mot de passe"
                    placeholderTextColor={Colors.text.tertiary}
                    value={confirmPassword}
                    onChangeText={handleConfirmPasswordChange}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                    <Icon
                      name={showConfirmPassword ? 'eye-off' : 'eye'}
                      size="md"
                      color={Colors.text.secondary}
                    />
                  </TouchableOpacity>
                </View>
                {confirmPasswordError && (
                  <View style={styles.errorContainer}>
                    <Icon name="alert-circle" size="sm" color={Colors.error} />
                    <Text style={styles.errorText}>{confirmPasswordError}</Text>
                  </View>
                )}
              </View>

              {/* Password Requirements */}
              <View style={styles.passwordRequirements}>
                <Text style={styles.requirementsTitle}>Exigences du mot de passe :</Text>
                <View style={styles.requirementItem}>
                  <Icon
                    name={password.length >= 6 ? "checkmark-circle" : "ellipse-outline"}
                    size="sm"
                    color={password.length >= 6 ? Colors.success : Colors.text.tertiary}
                  />
                  <Text style={[
                    styles.requirementText,
                    password.length >= 6 && styles.requirementMet
                  ]}>
                    Au moins 6 caractères
                  </Text>
                </View>
                <View style={styles.requirementItem}>
                  <Icon
                    name={/\d/.test(password) ? "checkmark-circle" : "ellipse-outline"}
                    size="sm"
                    color={/\d/.test(password) ? Colors.success : Colors.text.tertiary}
                  />
                  <Text style={[
                    styles.requirementText,
                    /\d/.test(password) && styles.requirementMet
                  ]}>
                    Au moins 1 chiffre
                  </Text>
                </View>
              </View>

              {/* Terms and Privacy */}
              <View style={styles.termsContainer}>
                <TouchableOpacity 
                  style={styles.termsRow}
                  onPress={() => setAcceptedTerms(!acceptedTerms)}
                  activeOpacity={0.7}
                  hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                  <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
                    {acceptedTerms && <Icon name="checkmark" size="sm" color={Colors.white} />}
                  </View>
                  <View style={styles.termsTextContainer}>
                    <Text style={styles.termsText}>
                      J'accepte les{' '}
                      <Text 
                        style={styles.termsLink}
                        onPress={(e) => {
                          e.stopPropagation();
                          navigation.navigate('TermsOfService' as any);
                        }}>
                        conditions d'utilisation
                      </Text>
                      {' '}et la{' '}
                      <Text 
                        style={styles.termsLink}
                        onPress={(e) => {
                          e.stopPropagation();
                          navigation.navigate('PrivacyPolicy' as any);
                        }}>
                        politique de confidentialité
                      </Text>
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Create Account Button */}
              <View style={styles.createAccountContainer}>
                <Button
                  variant="primary"
                  title="Créer mon compte"
                  onPress={handleRegistration}
                  disabled={!isStep3Valid()}
                  loading={loading}
                  icon={<Icon name="user-plus" size="sm" color={Colors.white} />}
                  iconPosition="right"
                  style={styles.createAccountButton}
                />
              </View>
            </View>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Vous avez déjà un compte ?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.linkText}>Se connecter</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Action Footer */}
          <View style={styles.guestFooter}>
            <Text style={styles.guestFooterText}>
              En vous inscrivant, c'est{' '}
              <Text style={styles.guestFooterHighlight}>gratuit, rapide et sécurisé</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Country Modal */}
      <Modal
        visible={showCountryModal}
        animationType="slide"
        presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Sélectionnez votre pays</Text>
            <TouchableOpacity onPress={() => setShowCountryModal(false)}>
              <Icon name="x" size="md" color={Colors.text.primary} />
            </TouchableOpacity>
          </View>
          <ScrollView 
            style={styles.modalContent}
            contentContainerStyle={styles.modalScrollContent}>
            {countryCodeList.map((country, index) => (
              <TouchableOpacity
                key={index}
                style={styles.countryItem}
                onPress={() => {
                  setSelectedCountry(country);
                  setShowCountryModal(false);
                }}>
                <Text style={styles.countryItemFlag}>{country.flag}</Text>
                <Text style={styles.countryItemName}>{country.name}</Text>
                <Text style={styles.countryItemCode}>{country.code}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* City Modal with hierarchical selection */}
      <Modal
        visible={showCityModal}
        animationType="slide"
        presentationStyle="fullScreen">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {showCountrySelector
                ? 'Sélectionnez votre pays'
                : selectedLocationCountry?.name || 'Sélectionnez votre ville'}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowCityModal(false);
                setShowCountrySelector(true);
                setCitySearchQuery('');
                setSelectedLocationCountry(null);
              }}>
              <Icon name="x" size="md" color={Colors.text.primary} />
            </TouchableOpacity>
          </View>

          {/* Search input */}
          <View style={styles.searchContainer}>
            <Icon name="search" size="md" color={Colors.text.tertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder={
                showCountrySelector
                  ? 'Rechercher un pays ou une ville...'
                  : 'Rechercher une ville...'
              }
              placeholderTextColor={Colors.text.tertiary}
              value={citySearchQuery}
              onChangeText={setCitySearchQuery}
              autoCapitalize="words"
            />
            {citySearchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setCitySearchQuery('')}>
                <Icon name="x-circle" size="md" color={Colors.text.tertiary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Back button for city selection - outside ScrollView to prevent overlap */}
          {!citySearchQuery.trim() && !showCountrySelector && selectedLocationCountry && (
            <TouchableOpacity
              style={styles.modalBackButton}
              onPress={() => {
                setShowCountrySelector(true);
                setSelectedLocationCountry(null);
                setCitySearchQuery('');
              }}>
              <Icon name="arrow-left" size="md" color={Colors.primary} />
              <Text style={styles.backButtonText}>Changer de pays</Text>
            </TouchableOpacity>
          )}

          <ScrollView 
            style={styles.modalContent}
            contentContainerStyle={styles.modalScrollContent}>
            {citySearchQuery.trim() ? (
              /* Global search results */
              searchCities(citySearchQuery).length === 0 ? (
                <View style={styles.emptyState}>
                  <Icon name="search" size="3xl" color={Colors.text.tertiary} />
                  <Text style={styles.emptyText}>Aucun résultat</Text>
                </View>
              ) : (
                searchCities(citySearchQuery).map(result => (
                  <TouchableOpacity
                    key={`${result.countryCode}-${result.name}`}
                    style={styles.cityItem}
                    onPress={() => {
                      setSelectedCity(result.name);
                      const country = COUNTRIES_CITIES.find(c => c.code === result.countryCode);
                      setSelectedLocationCountry(country || null);
                      setShowCityModal(false);
                      setShowCountrySelector(true);
                      setCitySearchQuery('');
                    }}>
                    <Text style={styles.countryItemFlag}>
                      {COUNTRIES_CITIES.find(c => c.code === result.countryCode)?.flag}
                    </Text>
                    <View style={{flex: 1}}>
                      <Text style={styles.cityItemName}>{result.name}</Text>
                      <Text style={styles.cityCountrySubtext}>{result.country}</Text>
                    </View>
                    {selectedCity === result.name && (
                      <Icon name="check-circle" size="md" color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                ))
              )
            ) : showCountrySelector ? (
              /* Country selection */
              <>
                {COUNTRIES_CITIES.filter(c => c.isPopular).map(country => (
                  <TouchableOpacity
                    key={country.code}
                    style={styles.countryItemLarge}
                    onPress={() => {
                      setSelectedLocationCountry(country);
                      setShowCountrySelector(false);
                      setCitySearchQuery('');
                    }}>
                    <Text style={styles.countryFlagLarge}>{country.flag}</Text>
                    <View style={{flex: 1}}>
                      <Text style={styles.countryItemName}>{country.name}</Text>
                      <Text style={styles.countryCityCount}>
                        {country.cities.length} ville{country.cities.length !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <Icon name="chevron-right" size="md" color={Colors.text.tertiary} />
                  </TouchableOpacity>
                ))}
                <View style={styles.sectionDivider}>
                  <Text style={styles.sectionTitle}>Tous les Pays</Text>
                </View>
                {COUNTRIES_CITIES.filter(c => !c.isPopular).map(country => (
                  <TouchableOpacity
                    key={country.code}
                    style={styles.countryItemLarge}
                    onPress={() => {
                      setSelectedLocationCountry(country);
                      setShowCountrySelector(false);
                      setCitySearchQuery('');
                    }}>
                    <Text style={styles.countryFlagLarge}>{country.flag}</Text>
                    <View style={{flex: 1}}>
                      <Text style={styles.countryItemName}>{country.name}</Text>
                      <Text style={styles.countryCityCount}>
                        {country.cities.length} ville{country.cities.length !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <Icon name="chevron-right" size="md" color={Colors.text.tertiary} />
                  </TouchableOpacity>
                ))}
              </>
            ) : (
              /* City selection for selected country */
              <>
                {selectedLocationCountry?.cities.map(city => (
                  <TouchableOpacity
                    key={city}
                    style={styles.cityItem}
                    onPress={() => {
                      setSelectedCity(city);
                      setShowCityModal(false);
                      setShowCountrySelector(true);
                      setCitySearchQuery('');
                    }}>
                    <Icon name="map-pin" size="sm" color={Colors.text.secondary} />
                    <Text style={styles.cityItemName}>{city}</Text>
                    {selectedCity === city && (
                      <Icon name="check-circle" size="md" color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Biometric Modal */}
      <BiometricModal
        visible={showBiometricModal}
        biometryType={biometryType}
        onAccept={async () => {
          try {
            if (biometricData) {
              await biometricService.enable(biometricData.userId, {
                phoneNumber: biometricData.phoneNumber,
                password: biometricData.password,
              });
              console.log('✅ Biometric enabled successfully');
            }
          } catch (error) {
            console.error('Failed to enable biometric:', error);
          } finally {
            setShowBiometricModal(false);
            setBiometricData(null);
            
            // Re-enable auth listener before setting user
            enableAuthListener();
            
            // Now set the user in AuthContext (this triggers navigation to Main)
            if (pendingUser) {
              setPhoneUser(pendingUser);
              setPendingUser(null);
              console.log('✅ User set in AuthContext after biometric setup');
            }
          }
        }}
        onDecline={() => {
          setShowBiometricModal(false);
          setBiometricData(null);
          
          // Re-enable auth listener before setting user
          enableAuthListener();
          
          // Now set the user in AuthContext (this triggers navigation to Main)
          if (pendingUser) {
            setPhoneUser(pendingUser);
            setPendingUser(null);
            console.log('✅ User set in AuthContext after declining biometric');
          }
        }}
      />
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
    paddingHorizontal: Spacing.lg,
  },
  header: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    marginBottom: Spacing['2xl'],
  },
  backButton: {
    position: 'absolute',
    top: Spacing.md,
    left: 0,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
    gap: Spacing.sm,
  },
  backButtonText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.primary,
  },
  logoContainer: {
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: Typography.fontSize.base,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  progressStep: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.border.light,
  },
  progressStepActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  progressStepText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.secondary,
  },
  progressStepTextActive: {
    color: Colors.white,
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: Colors.border.light,
    marginHorizontal: Spacing.md,
  },
  progressLineActive: {
    backgroundColor: Colors.accent,
  },
  form: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.base,
    minHeight: 44,
    borderWidth: 1.5,
    borderColor: '#FDB913',
  },
  inputPlaceholder: {
    borderColor: Colors.border.medium,
  },
  input: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    color: Colors.text.primary,
    marginLeft: Spacing.sm,
  },
  placeholderText: {
    color: Colors.text.tertiary,
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
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderWidth: 1.5,
    borderColor: '#FDB913',
  },
  countryFlag: {
    fontSize: Typography.fontSize.lg,
    marginRight: Spacing.xs,
    opacity: 1,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  countryCode: {
    fontSize: Typography.fontSize.base,
    color: Colors.text.primary,
    marginRight: Spacing.sm,
  },
  // Phone Input Container
  phoneInputContainer: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    borderColor: '#FDB913',
  },
  phoneInput: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    color: Colors.text.primary,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  inputError: {
    borderColor: Colors.status.error,
  },
  errorContainer: {
    backgroundColor: Colors.status.errorLight,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  errorText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.status.error,
    marginTop: Spacing.xs,
  },
  infoText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
  },
  eyeButton: {
    padding: Spacing.xs,
  },
  // Step 3 Password creation specific styles
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.xl,
    gap: Spacing.base,
  },
  stepHeaderContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  stepSubtitle: {
    fontSize: Typography.fontSize.base,
    color: Colors.text.secondary,
    lineHeight: 22,
  },
  passwordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.base,
    paddingVertical: Platform.OS === 'ios' ? Spacing.base : Spacing.sm,
    borderWidth: 1.5,
    borderColor: '#FDB913',
    shadowColor: Colors.primary.main,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  passwordInput: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    color: Colors.text.primary,
    marginLeft: Spacing.sm,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  passwordRequirements: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.lg,
  },
  requirementsTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  requirementText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
  },
  requirementMet: {
    color: Colors.success,
    fontWeight: Typography.fontWeight.medium,
  },
  termsContainer: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.xl,
  },
  termsTextContainer: {
    flex: 1,
  },
  createAccountContainer: {
    paddingTop: Spacing.base,
  },
  createAccountButton: {
    shadowColor: Colors.primary.main,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  termsText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    lineHeight: 20,
    marginLeft: Spacing.sm,
  },
  termsLink: {
    color: Colors.primary,
    fontWeight: Typography.fontWeight.semiBold,
  },
  buttonGroup: {
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
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
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
    paddingHorizontal: Spacing.base,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  footerText: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
  },
  linkText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.accent,
    marginLeft: Spacing.xs,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  modalTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
  },
  modalContent: {
    flex: 1,
  },
  modalScrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing['3xl'],
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  countryItemFlag: {
    fontSize: Typography.fontSize.lg,
    marginRight: Spacing.base,
    opacity: 1,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  countryItemName: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    color: Colors.text.primary,
  },
  countryItemCode: {
    fontSize: Typography.fontSize.base,
    color: Colors.text.secondary,
  },
  cityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  cityItemName: {
    fontSize: Typography.fontSize.base,
    color: Colors.text.primary,
    marginLeft: Spacing.base,
    flex: 1,
  },
  // Hierarchical city selector styles
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.base,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.base,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    color: Colors.text.primary,
    paddingVertical: Spacing.md,
  },
  countryItemLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
    gap: Spacing.md,
  },
  countryFlagLarge: {
    fontSize: 32,
  },
  countryCityCount: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  sectionDivider: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.background.secondary,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.secondary,
    textTransform: 'uppercase',
  },
  cityCountrySubtext: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['3xl'],
  },
  emptyText: {
    fontSize: Typography.fontSize.base,
    color: Colors.text.tertiary,
    marginTop: Spacing.md,
  },
  backButtonText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.primary,
    marginLeft: Spacing.sm,
  },

  // Guest Footer
  guestFooter: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    marginTop: Spacing.base,
  },
  guestFooterText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  guestFooterHighlight: {
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
  },

  // OTP Verification Styles
  otpPhoneDisplay: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  otpPhoneLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  otpPhoneNumber: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
  },
  otpContainer: {
    marginBottom: Spacing.lg,
  },
  otpInputsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.base,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: Colors.border.default,
    borderRadius: BorderRadius.md,
    textAlign: 'center',
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
    backgroundColor: Colors.white,
  },
  otpInputFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.background.tertiary,
  },
  otpInfoText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  resendContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  resendText: {
    fontSize: Typography.fontSize.base,
    color: Colors.primary,
    fontWeight: Typography.fontWeight.semiBold,
  },
  resendCooldownText: {
    fontSize: Typography.fontSize.base,
    color: Colors.text.tertiary,
  },
});

export default RegisterScreen;