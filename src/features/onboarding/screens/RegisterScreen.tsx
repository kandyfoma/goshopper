// Register Screen - 2-step phone registration
import React, {useState, useEffect} from 'react';
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
  Modal,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '@/shared/types';
import {authService} from '@/shared/services/firebase';
import {PhoneService} from '@/shared/services/phone';
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
import {Icon, Button, BiometricModal} from '@/shared/components';
import {passwordService} from '@/shared/services/password';
import {useAuth, useToast} from '@/shared/contexts';
import {biometricService} from '@/shared/services/biometric';
import {getFCMToken} from '@/shared/services/notificationService';
import functions from '@react-native-firebase/functions';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RegistrationStep = 'step1' | 'step2';

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
  
  // Step 2: Password and terms
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

  // Step 2 validation
  const isStep2Valid = (): boolean => {
    return (
      password !== '' &&
      confirmPassword !== '' &&
      !passwordError &&
      !confirmPasswordError &&
      acceptedTerms
    );
  };

  const handleStep1Continue = () => {
    const error = validatePhoneNumber(phoneNumber);
    if (error) {
      setPhoneError(error);
      return;
    }
    
    if (!selectedCity) {
      Alert.alert('Erreur', 'Veuillez sélectionner votre ville');
      return;
    }
    
    if (phoneExists) {
      return; // User should see the error message already
    }
    
    setCurrentStep('step2');
  };

  const handleRegistration = async () => {
    if (!isStep2Valid()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const formattedPhone = PhoneService.formatPhoneNumber(selectedCountry.code, phoneNumber);
      
      // Re-check phone exists before registration (edge case: user went back and changed phone)
      const phoneStillAvailable = !(await PhoneService.checkPhoneExists(formattedPhone));
      if (!phoneStillAvailable) {
        setError('Ce numéro est déjà utilisé');
        setCurrentStep('step1');
        setLoading(false);
        return;
      }
      
      // Suppress auth listener during registration to prevent auto-navigation
      // This allows biometric modal to show before navigation
      suppressAuthListener();
      
      // Create user directly without OTP verification
      // Phone verification can be done later from profile
      const user = await authService.createUserWithPhone({
        phoneNumber: formattedPhone,
        password,
        city: selectedCity,
        countryCode: selectedCountry.code
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
        // Show success toast
        showToast('Compte créé avec succès! Bienvenue sur GoShopper 🎉', 'success', 3000);
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
      await signInWithGoogle();
    } catch (err: any) {
      setError(err?.message || 'Échec de la connexion Google');
    } finally {
      setSocialLoading(null);
    }
  };

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

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}>
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
                : 'Sécurisez votre compte'
              }
            </Text>
            
            {/* Progress indicator */}
            <View style={styles.progressContainer}>
              <View style={[styles.progressStep, currentStep === 'step1' && styles.progressStepActive]}>
                <Text style={[styles.progressStepText, currentStep === 'step1' && styles.progressStepTextActive]}>1</Text>
              </View>
              <View style={[styles.progressLine, currentStep === 'step2' && styles.progressLineActive]} />
              <View style={[styles.progressStep, currentStep === 'step2' && styles.progressStepActive]}>
                <Text style={[styles.progressStepText, currentStep === 'step2' && styles.progressStepTextActive]}>2</Text>
              </View>
            </View>
          </View>

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
                disabled={!isStep1Valid()}
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

          {/* Step 2: Password and Terms */}
          {currentStep === 'step2' && (
            <View style={styles.form}>
              {/* Password */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Mot de passe *</Text>
                <View style={[styles.inputWrapper, passwordError ? styles.inputError : null]}>
                  <Icon name="lock" size="md" color={Colors.text.secondary} />
                  <TextInput
                    style={styles.input}
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
                    onPress={() => setShowPassword(!showPassword)}>
                    <Icon
                      name={showPassword ? 'eye-off' : 'eye'}
                      size="sm"
                      color={Colors.text.secondary}
                    />
                  </TouchableOpacity>
                </View>
                {passwordError && <Text style={styles.errorText}>{passwordError}</Text>}
              </View>

              {/* Confirm Password */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Confirmer le mot de passe *</Text>
                <View style={[styles.inputWrapper, confirmPasswordError ? styles.inputError : null]}>
                  <Icon name="lock" size="md" color={Colors.text.secondary} />
                  <TextInput
                    style={styles.input}
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
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                    <Icon
                      name={showConfirmPassword ? 'eye-off' : 'eye'}
                      size="sm"
                      color={Colors.text.secondary}
                    />
                  </TouchableOpacity>
                </View>
                {confirmPasswordError && <Text style={styles.errorText}>{confirmPasswordError}</Text>}
              </View>

              {/* Terms and Privacy */}
              <TouchableOpacity 
                style={styles.termsRow}
                onPress={() => setAcceptedTerms(!acceptedTerms)}
                activeOpacity={0.7}>
                <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
                  {acceptedTerms && <Icon name="check" size="sm" color={Colors.white} />}
                </View>
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
              </TouchableOpacity>

              {/* Buttons */}
              <View style={styles.buttonGroup}>
                <Button
                  variant="primary"
                  title="Créer mon compte"
                  onPress={handleRegistration}
                  disabled={!isStep2Valid()}
                  loading={loading}
                  icon={<Icon name="user-plus" size="sm" color={Colors.white} />}
                  iconPosition="right"
                />

                <Button
                  variant="outline"
                  title="Retour"
                  onPress={() => setCurrentStep('step1')}
                  disabled={loading}
                  icon={<Icon name="arrow-left" size="sm" color={Colors.text.primary} />}
                  iconPosition="left"
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
            
            // Show success toast
            showToast('Compte créé avec succès! Bienvenue sur GoShopper 🎉', 'success', 3000);
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
          
          // Show success toast
          showToast('Compte créé avec succès! Bienvenue sur GoShopper 🎉', 'success', 3000);
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
});

export default RegisterScreen;