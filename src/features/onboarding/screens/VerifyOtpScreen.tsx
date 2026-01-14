import React, {useState, useRef, useEffect} from 'react';
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
  NativeModules,
  NativeEventEmitter,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute, RouteProp as NavigationRouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '@/shared/types';
import {useAuth} from '@/shared/contexts';
import {useToast} from '@/shared/contexts';
import {smsService} from '@/shared/services/sms';
import {authService, userBehaviorService} from '@/shared/services/firebase';
import {Button, Icon} from '@/shared/components';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
} from '@/shared/theme/theme';

// SMS Retriever for Android auto-fill
const SmsRetriever = Platform.OS === 'android' ? NativeModules.RNSmsRetriever : null;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type VerifyOtpRouteProp = NavigationRouteProp<RootStackParamList, 'VerifyOtp'>;

/**
 * Format phone number for display
 */
const formatPhoneNumber = (phoneNumber: string | undefined): string => {
  if (!phoneNumber) return '';
  
  // For DRC numbers (+243xxxxxxxxx), format as +243 xxx xxx xxx
  if (phoneNumber.startsWith('+243')) {
    return phoneNumber.replace(/(\+243)(\d{3})(\d{3})(\d{4})/, '$1 $2 $3 $4');
  }
  
  // For other formats, just return as is for now
  return phoneNumber;
};

const VerifyOtpScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<VerifyOtpRouteProp>();
  const {user, enableAuthListener, setSocialUser, setPhoneUser} = useAuth();
  const {showToast} = useToast();
  
  // Get params from route or AsyncStorage as fallback
  const routeParams = route.params || {};
  const {phoneNumber, isRegistration = false, registrationData, isPhoneVerification = false, fromSocial, sessionId: initialSessionId, socialUser: socialUserParam} = routeParams;
  
  // If params are missing, try to load from AsyncStorage
  const [storedParams, setStoredParams] = useState<any>(null);
  
  useEffect(() => {
    const loadStoredParams = async () => {
      console.log('🎯 [VerifyOtpScreen] Checking if params needed from AsyncStorage...', { phoneNumber, initialSessionId });
      
      if (!phoneNumber || !initialSessionId) {
        try {
          const stored = await AsyncStorage.getItem('@goshopper_verification_params');
          console.log('🎯 [VerifyOtpScreen] AsyncStorage result:', stored);
          
          if (stored) {
            const parsed = JSON.parse(stored);
            setStoredParams(parsed);
            console.log('🎯 [VerifyOtpScreen] Loaded params from AsyncStorage:', parsed);
          } else {
            console.log('🎯 [VerifyOtpScreen] No stored params found in AsyncStorage');
          }
        } catch (error) {
          console.error('🎯 [VerifyOtpScreen] Error loading stored params:', error);
        }
      } else {
        console.log('🎯 [VerifyOtpScreen] Route params are complete, no need for AsyncStorage');
      }
    };
    
    loadStoredParams();
  }, [phoneNumber, initialSessionId]);
  
  // Use stored params if route params are missing
  const effectiveParams = storedParams || routeParams;
  const effectivePhoneNumber = effectiveParams.phoneNumber || phoneNumber;
  const effectiveSessionId = effectiveParams.sessionId || initialSessionId;
  const effectiveIsPhoneVerification = effectiveParams.isPhoneVerification || isPhoneVerification;
  const effectiveFromSocial = effectiveParams.fromSocial || fromSocial;
  const effectiveSocialUser = effectiveParams.socialUser || socialUserParam;
  
  // Use the user from context, or the socialUser passed as param (for social login verification)
  const effectiveUser = user || effectiveSocialUser;
  
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null); // Store session ID
  const [isTestPhone, setIsTestPhone] = useState(false); // Track if test phone number
  const [webOtpSupported, setWebOtpSupported] = useState(false); // Web OTP API support
  
  // Refs
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Track screen mount/unmount and clear OTP on mount
  useEffect(() => {
    console.log('🎯 [VerifyOtpScreen] MOUNTED - params:', {
      phoneNumber: effectivePhoneNumber,
      isPhoneVerification: effectiveIsPhoneVerification,
      fromSocial: effectiveFromSocial,
      hasSessionId: !!effectiveSessionId,
      hasSocialUser: !!effectiveSocialUser,
    });
    
    // Clear OTP inputs on mount
    setOtpCode(['', '', '', '', '', '']);
    setError(null);
    
    // Validate required params - redirect if missing after AsyncStorage check
    const validateParams = async () => {
      // Wait longer for AsyncStorage to fully load (especially on slower devices)
      await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
      
      // Re-check if we have phone number after waiting
      const hasPhoneNumber = effectivePhoneNumber || storedParams?.phoneNumber;
      const hasSessionId = effectiveSessionId || storedParams?.sessionId;
      
      if (!hasPhoneNumber || !hasSessionId) {
        console.error('🎯 [VerifyOtpScreen] Missing required params after wait:', { 
          hasPhoneNumber, 
          hasSessionId,
          effectivePhoneNumber,
          storedParams 
        });
        Alert.alert(
          'Session expiree',
          'Veuillez recommencer le processus de verification.',
          [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
        );
      } else {
        console.log('✅ [VerifyOtpScreen] Params validated successfully:', {
          phoneNumber: hasPhoneNumber,
          sessionId: hasSessionId
        });
      }
    };
    
    validateParams();
    
    return () => {
      console.log('🎯 [VerifyOtpScreen] UNMOUNTING');
    };
  }, [effectivePhoneNumber, effectiveIsPhoneVerification, effectiveFromSocial, effectiveSessionId, effectiveSocialUser, storedParams, navigation]);

  // Set sessionId from params
  useEffect(() => {
    if (effectiveSessionId && !sessionId) {
      setSessionId(effectiveSessionId);
    }
  }, [effectiveSessionId, sessionId]);

  // Start SMS Retriever listener for Android auto-fill
  useEffect(() => {
    if (Platform.OS !== 'android' || !SmsRetriever) {
      return;
    }

    let smsListener: any = null;

    const startSmsRetriever = async () => {
      try {
        const registered = await SmsRetriever.startSmsRetriever();
        if (registered) {
          console.log('✅ SMS Retriever started');
          
          // Set up event listener for SMS
          const eventEmitter = new NativeEventEmitter(SmsRetriever);
          smsListener = eventEmitter.addListener('com.google.android.gms.auth.api.phone.SMS_RETRIEVED', (event: any) => {
            if (event && event.message) {
              console.log('📨 SMS received:', event.message);
              
              // Extract OTP from SMS (looking for 6-digit code)
              const otpMatch = event.message.match(/\b(\d{6})\b/);
              if (otpMatch && otpMatch[1]) {
                const code = otpMatch[1];
                console.log('🔑 Extracted OTP:', code);
                
                // Auto-fill OTP
                const digits = code.split('');
                setOtpCode(digits);
                
                // Clear any errors
                if (error) {
                  setError(null);
                }
              }
            }
          });
        }
      } catch (err) {
        console.log('❌ SMS Retriever error (non-critical):', err);
      }
    };

    startSmsRetriever();

    // Cleanup
    return () => {
      if (smsListener) {
        smsListener.remove();
      }
    };
  }, []);

  // Web OTP API listener for automatic SMS detection (web platform)
  useEffect(() => {
    const isWebPlatform = Platform.OS === 'web';
    
    if (isWebPlatform) {
      // Type guard for web environment - check if window and navigator exist
      try {
        const hasWebAPIs = typeof (globalThis as any).window !== 'undefined' && 
                          'OTPCredential' in (globalThis as any).window;
        
        if (hasWebAPIs) {
          setWebOtpSupported(true);
          
          // Start listening for OTP
          const abortController = new AbortController();
          
          const listenForOtp = async () => {
            try {
              const nav = (globalThis as any).navigator;
              if (!nav || !nav.credentials) return;
              
              const otpCredential = await nav.credentials.get({
                otp: { transport: ['sms'] },
                signal: abortController.signal
              }) as any;
              
              if (otpCredential && otpCredential.code) {
                const code = otpCredential.code;
                console.log('🔑 Web OTP received:', code);
                
                // Auto-fill the OTP
                const digits = code.split('');
                setOtpCode(digits);
                
                // Clear any errors
                if (error) {
                  setError(null);
                }
              }
            } catch (error: any) {
              // Ignore abort errors, re-throw others
              if (error?.name !== 'AbortError') {
                console.log('Web OTP error:', error);
              }
            }
          };
          
          listenForOtp();
          
          return () => {
            abortController.abort();
          };
        }
      } catch (err) {
        console.log('Web OTP not supported:', err);
      }
    }
  }, []);

  // Get sessionId from route params (ProfileScreen sends OTP before navigating here)
  useEffect(() => {
    if (initialSessionId) {
      setSessionId(initialSessionId);
      console.log('📋 Received sessionId from params:', initialSessionId);
    }
  }, [initialSessionId]);

  // Use ref to track countdown timer for proper cleanup
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  useEffect(() => {
    // Only start timer if countdown is greater than 0
    if (countdown <= 0) {
      setCanResend(true);
      return;
    }
    
    // Clear any existing timer before starting new one
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }
    
    // Start countdown timer
    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
  }, [countdown]);

  const handleOtpChange = (value: string, index: number) => {
    if (value.length > 1) return; // Prevent multiple characters
    
    const newOtp = [...otpCode];
    newOtp[index] = value;
    setOtpCode(newOtp);
    
    // Clear error when user starts typing
    if (error) {
      setError(null);
    }
    
    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otpCode[index] && index > 0) {
      // Focus previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOTP = async () => {
    const code = otpCode.join('');
    
    if (code.length !== 6) {
      setError('Veuillez saisir le code complet a 6 chiffres');
      return;
    }

    if (!sessionId) {
      setError('Session expiree. Veuillez demander un nouveau code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Add timeout wrapper for slow networks (30 seconds)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('TIMEOUT')), 30000);
      });
      
      const verifyPromise = smsService.verifyOTP(effectivePhoneNumber, code, sessionId);
      const result = await Promise.race([verifyPromise, timeoutPromise]);
      
      // Check if OTP was already used or session verified
      if (!result.success && (result.error?.includes('already been verified') || result.error?.includes('Session deja verifiee') || result.error?.includes('already been verified'))) {
        showToast('Ce code a déjà été utilisé. Demandez un nouveau code.', 'warning');
        setError('Ce code a deja ete utilise ou la session est expiree. Veuillez demander un nouveau code.');
        setOtpCode(['', '', '', '', '', '']);
        setSessionId(null); // Clear invalid session
        inputRefs.current[0]?.focus();
        setLoading(false);
        return;
      }
      
      // Check for session expiration errors from backend
      if (!result.success && (result.error?.includes('expired') || result.error?.includes('not found') || result.error?.includes('expiree') || result.error?.includes('deadline-exceeded'))) {
        Alert.alert(
          'Session expiree',
          'Votre session de verification a expire. Veuillez recommencer le processus.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Clear any stored verification data
                AsyncStorage.removeItem('@goshopper_verification_in_progress').catch(console.error);
                AsyncStorage.removeItem('@goshopper_verification_params').catch(console.error);
                // Navigate to login
                navigation.reset({
                  index: 0,
                  routes: [{name: 'Login'}]
                });
              }
            }
          ],
          { cancelable: false }
        );
        setLoading(false);
        return;
      }
      
      if (result.success) {
        if (isPhoneVerification && effectiveUser?.uid) {
          // Verify phone for existing user (including social login users)
          try {
            // Extract country code from phone number
            let countryCode = 'CD'; // Default to DRC
            if (effectivePhoneNumber.startsWith('+')) {
              const match = effectivePhoneNumber.match(/^\+(\d{1,3})/);
              if (match) {
                const code = match[1];
                if (code === '243') countryCode = 'CD';
                else if (code === '1') countryCode = 'US';
                // Add more country codes as needed
              }
            }
            
            await authService.verifyUserPhone(effectiveUser.uid, effectivePhoneNumber, countryCode);
            
            // Clear verification in progress flag
            await AsyncStorage.removeItem('@goshopper_verification_in_progress').catch(console.error);
            await AsyncStorage.removeItem('@goshopper_verification_params').catch(console.error);
            
            // If this is from social login, complete the sign-in
            if (effectiveFromSocial) {
              // Get the current Firebase user (fully mapped with all required fields)
              const currentUser = authService.getCurrentUser();
              
              if (currentUser) {
                // Enable the auth listener and complete social sign-in
                enableAuthListener();
                setSocialUser(currentUser);
                
                console.log('✅ Phone verified for social user, navigating to Main');
                
                // Navigate to main app
                navigation.reset({
                  index: 0,
                  routes: [{name: 'Main'}]
                });
              } else {
                console.error('❌ No current Firebase user found after social login verification');
                setError('Session expirée. Veuillez vous reconnecter.');
                enableAuthListener();
                navigation.reset({
                  index: 0,
                  routes: [{name: 'Login'}]
                });
              }
            } else {
              console.log('✅ Phone verified successfully');
              
              // Navigate back after verification
              navigation.goBack();
            }
          } catch (verifyError: any) {
            setError(verifyError.message || 'Erreur lors de la vérification');
          }
        } else if (isRegistration && registrationData) {
          // Complete registration with verification
          try {
            // First create the user account
            const user = await authService.createUserWithPhone({
              phoneNumber: effectivePhoneNumber,
              password: registrationData.password,
              city: registrationData.city,
              countryCode: registrationData.countryCode
            });
            
            // Now mark the user as verified in the profile
            if (result.token && user.uid) {
              await authService.completeRegistration({
                userId: user.uid,
                verificationToken: result.token,
                phoneNumber: effectivePhoneNumber,
                countryCode: registrationData.countryCode,
                displayName: effectivePhoneNumber
              });
              
              // Initialize behavior profile for new user
              await userBehaviorService.initializeBehaviorProfile(user.uid)
                .catch(err => console.log('Failed to initialize behavior profile:', err));
            }
            
            // Navigate to main app after successful registration
            console.log('New user registered, navigating to Main');
            navigation.reset({
              index: 0,
              routes: [{name: 'Main'}]
            });
          } catch (regError: any) {
            setError(regError.message || 'Erreur lors de la création du compte');
          }
        } else {
          // Phone verification during login - check for pending login and retry
          console.log('✅ Phone verified for login, checking for pending login credentials');
          
          // Clear verification in progress flag
          await AsyncStorage.removeItem('@goshopper_verification_in_progress').catch(console.error);
          await AsyncStorage.removeItem('@goshopper_verification_params').catch(console.error);
          
          // Check if there's a pending login to complete
          try {
            const pendingLoginStr = await AsyncStorage.getItem('@goshopper_pending_login');
            if (pendingLoginStr) {
              const pendingLogin = JSON.parse(pendingLoginStr);
              console.log('🔄 Found pending login, retrying login process');
              
              // Clear the stored credentials
              await AsyncStorage.removeItem('@goshopper_pending_login').catch(console.error);
              
              // Retry the login with verified phone
              // Note: The auth service will mark phone as verified on successful login
              const userCredential = await authService.signInWithPhone(pendingLogin.phoneNumber, pendingLogin.password);
              
              // Set user in AuthContext (this triggers navigation to main app)
              setPhoneUser(userCredential);
              console.log('✅ Login completed after phone verification:', userCredential.uid);
              
              // Navigate to main app
              navigation.reset({
                index: 0,
                routes: [{name: 'Main'}]
              });
              return;
            }
          } catch (loginError) {
            console.error('❌ Failed to retry login after verification:', loginError);
            showToast('Erreur lors de la connexion. Veuillez réessayer.', 'error');
            setLoading(false);
            // Fall back to navigating to login screen
          }
          
          // Fallback: navigate back to login screen
          console.log('📱 No pending login found, navigating back to Login');
          navigation.reset({
            index: 0,
            routes: [{name: 'Login'}]
          });
        }
      } else {
        setError(result.error || 'Code de vérification incorrect');
        // Clear the OTP inputs
        setOtpCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (err: any) {
      console.error('\u274c OTP verification error:', err);
      
      // Handle specific error types
      const errorMsg = err?.message || err?.code || '';
      if (errorMsg === 'TIMEOUT') {
        setError('Delai depasse. Verifiez votre connexion et reessayez.');
      } else if (errorMsg.includes('network') || errorMsg.includes('Network') || errorMsg.includes('fetch')) {
        setError('Erreur reseau. Verifiez votre connexion.');
      } else if (errorMsg.includes('timeout')) {
        setError('Delai depasse. Veuillez reessayer.');
      } else if (errorMsg.includes('expired') || errorMsg.includes('expiree') || errorMsg.includes('not found') || errorMsg.includes('deadline-exceeded')) {
        // Session expired - redirect to login automatically
        Alert.alert(
          'Session expiree',
          'Votre session de verification a expire. Veuillez recommencer le processus.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Clear any stored verification data
                AsyncStorage.removeItem('@goshopper_verification_in_progress').catch(console.error);
                AsyncStorage.removeItem('@goshopper_verification_params').catch(console.error);
                // Navigate to login
                navigation.reset({
                  index: 0,
                  routes: [{name: 'Login'}]
                });
              }
            }
          ],
          { cancelable: false }
        );
        setSessionId(null);
        return; // Don't show inline error, the alert handles it
      } else if (errorMsg.includes('attempts') || errorMsg.includes('tentatives')) {
        setError('Trop de tentatives. Veuillez demander un nouveau code.');
        setSessionId(null);
      } else {
        setError('Erreur lors de la verification. Veuillez reessayer.');
      }
      
      // Clear OTP on error for retry
      setOtpCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setResendLoading(true);
    setError(null);

    try {
      const result = await smsService.sendOTP(effectivePhoneNumber);
      
      if (result.success && result.sessionId) {
        setSessionId(result.sessionId); // Update session ID for new OTP
        Alert.alert('Code envoye', 'Un nouveau code de verification a ete envoye');
        // Reset countdown and trigger countdown timer restart via state
        setCountdown(60);
        setCanResend(false);
        // Clear OTP inputs for new code
        setOtpCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else {
        // Handle specific error messages from backend
        const errorMsg = result.error || 'Erreur lors du renvoi du code';
        
        // Check for daily limit error
        if (errorMsg.includes('Limite quotidienne') || errorMsg.includes('daily limit')) {
          Alert.alert(
            'Limite atteinte',
            'Vous avez atteint la limite de 3 codes par jour. Veuillez reessayer demain.',
            [{ text: 'OK' }]
          );
        } else if (errorMsg.includes('attendre') || errorMsg.includes('wait')) {
          // Cooldown error - show inline
          setError(errorMsg);
        } else {
          setError(errorMsg);
        }
      }
    } catch (err: any) {
      // Handle network errors gracefully
      const errorMsg = err?.message || 'Erreur reseau. Veuillez reessayer.';
      if (errorMsg.includes('Limite quotidienne') || errorMsg.includes('resource-exhausted')) {
        Alert.alert(
          'Limite atteinte',
          'Vous avez atteint la limite de 3 codes par jour. Veuillez reessayer demain.',
          [{ text: 'OK' }]
        );
      } else {
        setError(errorMsg);
      }
    } finally {
      setResendLoading(false);
    }
  };

  // formatPhoneNumber is defined at module level above

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                if (navigation.canGoBack()) {
                  navigation.goBack();
                } else {
                  // If can't go back, navigate to Login screen
                  navigation.navigate('Login');
                }
              }}>
              <Icon name="arrow-left" size="md" color={Colors.text.primary} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {/* Icon */}
            <View style={styles.iconContainer}>
              <Icon name="message-circle" size="3xl" color={Colors.accent} />
            </View>

            {/* Title */}
            <Text style={styles.title}>{isRegistration ? 'Finaliser l\'inscription' : 'Vérification'}</Text>
            <Text style={styles.subtitle}>
              {isRegistration 
                ? 'Entrez le code de vérification envoyé au numéro ci-dessous pour créer votre compte'
                : 'Entrez le code à 6 chiffres envoyé au numéro ci-dessous'
              }
            </Text>
            
            {/* Phone Number Display */}
            <View style={styles.phoneDisplay}>
              <Text style={styles.phoneNumber}>{formatPhoneNumber(effectivePhoneNumber || '')}</Text>
            </View>

            {/* Test Phone Hint */}
            {isTestPhone && (
              <View style={styles.testPhoneHint}>
                <Icon name="info" size="sm" color={Colors.accent} />
                <Text style={styles.testPhoneText}>
                  Mode test : Utilisez le code <Text style={styles.testCode}>123456</Text>
                </Text>
              </View>
            )}

            {/* Web OTP Status */}
            {webOtpSupported && (
              <View style={styles.webOtpHint}>
                <Icon name="smartphone" size="sm" color={Colors.status.success} />
                <Text style={styles.webOtpText}>
                  Détection automatique activée
                </Text>
              </View>
            )}

            {/* OTP Input */}
            <View style={styles.otpContainer}>
              {otpCode.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => { inputRefs.current[index] = ref; }}
                  style={[
                    styles.otpInput,
                    digit ? styles.otpInputFilled : null,
                    error ? styles.otpInputError : null
                  ]}
                  value={digit}
                  onChangeText={(value) => handleOtpChange(value, index)}
                  onKeyPress={({nativeEvent}) => handleKeyPress(nativeEvent.key, index)}
                  keyboardType="numeric"
                  maxLength={1}
                  selectTextOnFocus
                  editable={!loading}
                />
              ))}
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}

            {/* Verify Button */}
            <Button
              variant="primary"
              title={isRegistration ? 'Créer mon compte' : 'Vérifier le code'}
              onPress={handleVerifyOTP}
              disabled={loading || otpCode.join('').length !== 6}
              loading={loading}
              icon={<Icon name={isRegistration ? 'user-plus' : 'check'} size="md" color="white" />}
              iconPosition="right"
            />

            {/* Resend Section */}
            <View style={styles.resendSection}>
              <Text style={styles.resendText}>
                Vous n'avez pas reçu le code ?
              </Text>
              
              {canResend ? (
                <TouchableOpacity
                  onPress={handleResendOTP}
                  disabled={resendLoading}>
                  <Text style={styles.resendLink}>
                    {resendLoading ? 'Envoi en cours...' : 'Renvoyer'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.countdownText}>
                  Renvoyer dans {countdown}s
                </Text>
              )}
            </View>

            {/* Wrong Number */}
            <View style={styles.wrongNumberSection}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={styles.wrongNumberButton}>
                <Text style={styles.wrongNumberText}>Mauvais numéro ?</Text>
              </TouchableOpacity>
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
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  header: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingTop: Spacing.lg,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: (Typography.fontSize as any)['2xl'] ?? 28,
    fontWeight: (Typography.fontWeight as any).bold ?? '700',
    color: Colors.text.primary ?? '#780000',
    textAlign: 'center' as const,
    marginBottom: Spacing.md ?? 12,
    paddingHorizontal: Spacing.md ?? 12,
  },
  subtitle: {
    fontSize: (Typography.fontSize as any).base ?? 16,
    color: Colors.text.secondary ?? '#003049',
    textAlign: 'center' as const,
    marginBottom: Spacing.md ?? 12,
    lineHeight: 22,
    paddingHorizontal: Spacing.lg ?? 16,
  },
  phoneDisplay: {
    alignItems: 'center' as const,
    marginBottom: Spacing.lg ?? 16,
  },
  phoneNumber: {
    fontSize: (Typography.fontSize as any).lg ?? 18,
    fontWeight: (Typography.fontWeight as any).bold ?? '700',
    color: Colors.text.primary ?? '#780000',
    textAlign: 'center' as const,
    paddingHorizontal: Spacing.md ?? 12,
  },
  testPhoneHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
    marginHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  testPhoneText: {
    fontSize: Typography.fontSize.sm || 14,
    color: Colors.text.secondary || '#003049',
    textAlign: 'center',
  },
  testCode: {
    fontWeight: Typography.fontWeight.bold || '700',
    color: Colors.accent || '#003049',
    fontSize: Typography.fontSize.md || 16,
  },
  webOtpHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.status.success + '10' || '#22C55E10',
    borderRadius: BorderRadius.lg || 12,
    paddingVertical: Spacing.sm || 8,
    paddingHorizontal: Spacing.md || 12,
    marginBottom: Spacing.lg || 16,
    marginHorizontal: Spacing.lg || 16,
    gap: Spacing.sm || 8,
  },
  webOtpText: {
    fontSize: Typography.fontSize.sm || 14,
    color: Colors.status.success || '#22C55E',
    textAlign: 'center',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: Colors.border.light,
    backgroundColor: Colors.background.secondary,
    textAlign: 'center',
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
  },
  otpInputFilled: {
    borderColor: Colors.accent,
    backgroundColor: Colors.background.primary,
  },
  otpInputError: {
    borderColor: Colors.status.error,
  },
  errorText: {
    fontSize: Typography.fontSize.sm || 14,
    color: Colors.status.error || '#C1121F',
    textAlign: 'center',
    marginBottom: Spacing.md || 12,
    marginTop: Spacing.xs || 4,
    paddingHorizontal: Spacing.md || 12,
  },
  resendSection: {
    alignItems: 'center',
    marginTop: Spacing['2xl'] || 32,
    marginBottom: Spacing.md || 12,
    paddingTop: Spacing.lg || 16,
  },
  resendText: {
    fontSize: Typography.fontSize.md || 16,
    color: Colors.text.secondary || '#003049',
    marginBottom: Spacing.sm || 8,
    textAlign: 'center',
  },
  resendLink: {
    fontSize: Typography.fontSize.md || 16,
    fontWeight: Typography.fontWeight.semiBold || '600',
    color: Colors.accent || '#003049',
    textAlign: 'center',
  },
  countdownText: {
    fontSize: Typography.fontSize.md || 16,
    color: Colors.text.tertiary || '#669BBC',
    textAlign: 'center',
  },
  wrongNumberSection: {
    alignItems: 'center',
    marginTop: Spacing.xl,
    paddingTop: Spacing.md,
  },
  wrongNumberButton: {
    paddingVertical: Spacing.sm || 8,
    paddingHorizontal: Spacing.lg || 16,
  },
  wrongNumberText: {
    fontSize: Typography.fontSize.md || 16,
    color: Colors.text.secondary || '#003049',
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
});

export default VerifyOtpScreen;