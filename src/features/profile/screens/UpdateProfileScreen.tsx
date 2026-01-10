// Update Profile Screen - Urbanist Design System
// GoShopper - Soft Pastel Colors with Clean Typography
import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '@/shared/types';
import {useAuth, useUser, useToast} from '@/shared/contexts';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {Icon, Spinner, Button, BackButton} from '@/shared/components';
import {APP_ID} from '@/shared/services/firebase/config';
import firestore from '@react-native-firebase/firestore';
import {analyticsService} from '@/shared/services/analytics';
import {countryCodeList} from '@/shared/constants/countries';
import {
  COUNTRIES_CITIES,
  POPULAR_CITIES,
  searchCities,
  CountryData,
} from '@/shared/constants/cities';
import {PhoneService} from '@/shared/services/phone';
const phoneService = new PhoneService();

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const DRC_CITIES = [
  'Kinshasa',
  'Lubumbashi',
  'Mbuji-Mayi',
  'Kisangani',
  'Kananga',
  'Bukavu',
  'Tshikapa',
  'Kolwezi',
  'Likasi',
  'Goma',
  'Uvira',
  'Butembo',
  'Beni',
  'Bunia',
  'Isiro',
  'Mbandaka',
  'Gemena',
  'Kikwit',
  'Bandundu',
  'Matadi',
  'Boma',
];

const SEX_OPTIONS = [
  {value: '', label: 'Non spécifié', icon: 'user'},
  {value: 'male', label: 'Homme', icon: 'user'},
  {value: 'female', label: 'Femme', icon: 'user'},
  {value: 'other', label: 'Autre', icon: 'user'},
];

export function UpdateProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {user, isAuthenticated} = useAuth();
  const {profile, isLoading: profileLoading} = useUser();
  const {showToast} = useToast();
  const insets = useSafeAreaInsets();

  // State declarations MUST come before any early returns
  const [formData, setFormData] = useState({
    name: '',
    surname: '',
    dateOfBirth: '',
    sex: '' as '' | 'male' | 'female' | 'other',
    phoneNumber: '',
    email: '',
    city: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(countryCodeList[0]); // Default to RDC
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showVerifyComingSoonModal, setShowVerifyComingSoonModal] = useState(false);
  
  // Date input fields
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigation.navigate('Login');
    }
  }, [isAuthenticated, navigation]);

  // Populate form data when profile is loaded
  useEffect(() => {
    if (profile) {
      console.log('📝 UpdateProfileScreen: Full profile object:', profile);
      console.log('📝 UpdateProfileScreen: User object phoneNumber:', user?.phoneNumber);
      
      // Parse displayName if name/surname are not available
      let parsedName = profile.name || '';
      let parsedSurname = profile.surname || '';
      
      // If name and surname are empty but we have displayName from auth, parse it
      if ((!parsedName && !parsedSurname) && (profile.displayName || user?.displayName)) {
        const fullName = profile.displayName || user?.displayName || '';
        const nameParts = fullName.trim().split(' ');
        parsedName = nameParts[0] || '';
        parsedSurname = nameParts.slice(1).join(' ') || '';
        console.log('📝 UpdateProfileScreen: Parsed displayName:', {
          fullName,
          parsedName,
          parsedSurname,
        });
      }

      // Extract phone number without country code
      let localPhoneNumber = profile.phoneNumber || '';
      let detectedCountry = countryCodeList[0]; // Default to RDC
      
      if (localPhoneNumber) {
        // Find matching country code
        for (const country of countryCodeList) {
          if (localPhoneNumber.startsWith(country.code)) {
            detectedCountry = country;
            // Remove country code to get local number
            localPhoneNumber = localPhoneNumber.substring(country.code.length);
            break;
          }
        }
        setSelectedCountry(detectedCountry);
        console.log('📝 UpdateProfileScreen: Detected country:', detectedCountry.name, 'Local number:', localPhoneNumber);
      }

      // Parse date of birth into day, month, year
      if (profile.dateOfBirth) {
        try {
          const existingDate = new Date(profile.dateOfBirth);
          if (!isNaN(existingDate.getTime())) {
            setSelectedDate(existingDate);
            setBirthDay(String(existingDate.getDate()).padStart(2, '0'));
            setBirthMonth(String(existingDate.getMonth() + 1).padStart(2, '0'));
            setBirthYear(String(existingDate.getFullYear()));
          }
        } catch (e) {
          console.log('📝 UpdateProfileScreen: Invalid dateOfBirth format:', profile.dateOfBirth);
        }
      }

      console.log('📝 UpdateProfileScreen: Populating form with profile data:', {
        name: parsedName,
        surname: parsedSurname,
        phoneNumber: localPhoneNumber,
        phoneVerified: profile.phoneVerified,
        email: profile.email,
        city: profile.defaultCity,
      });
      
      setFormData({
        name: parsedName,
        surname: parsedSurname,
        dateOfBirth: profile.dateOfBirth || '',
        sex: profile.sex || '',
        phoneNumber: localPhoneNumber,
        email: profile.email || '',
        city: profile.defaultCity || '',
      });
    }
  }, [profile, user?.displayName]);

  if (!isAuthenticated || profileLoading) {
    return (
      <SafeAreaView style={{flex: 1, backgroundColor: Colors.background.primary}}>
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={{
            marginTop: Spacing.md,
            fontSize: Typography.fontSize.base,
            fontFamily: Typography.fontFamily.medium,
            color: Colors.text.secondary,
          }}>
            {profileLoading ? 'Chargement du profil...' : 'Chargement...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({...prev, [field]: value}));
  };

  const formatDateToString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleDateInputChange = (field: 'day' | 'month' | 'year', value: string) => {
    // Only allow numeric input
    const numericValue = value.replace(/[^0-9]/g, '');
    
    if (field === 'day') {
      // Limit to 2 digits and max value of 31
      const dayNum = parseInt(numericValue.substring(0, 2) || '0');
      const validDay = Math.min(Math.max(dayNum, 0), 31);
      setBirthDay(numericValue.substring(0, 2));
      
      // Update formData if all fields are filled
      if (numericValue.length === 2 && birthMonth && birthYear) {
        const dateStr = `${birthYear}-${birthMonth}-${numericValue}`;
        setFormData(prev => ({...prev, dateOfBirth: dateStr}));
      }
    } else if (field === 'month') {
      // Limit to 2 digits and max value of 12
      const monthNum = parseInt(numericValue.substring(0, 2) || '0');
      const validMonth = Math.min(Math.max(monthNum, 0), 12);
      setBirthMonth(numericValue.substring(0, 2));
      
      // Update formData if all fields are filled
      if (numericValue.length === 2 && birthDay && birthYear) {
        const dateStr = `${birthYear}-${numericValue}-${birthDay}`;
        setFormData(prev => ({...prev, dateOfBirth: dateStr}));
      }
    } else if (field === 'year') {
      // Limit to 4 digits
      setBirthYear(numericValue.substring(0, 4));
      
      // Update formData if all fields are filled
      if (numericValue.length === 4 && birthDay && birthMonth) {
        const dateStr = `${numericValue}-${birthMonth}-${birthDay}`;
        setFormData(prev => ({...prev, dateOfBirth: dateStr}));
      }
    }
  };

  const handleDatePickerOpen = () => {
    // Determine the initial date
    let initialDate = new Date();
    initialDate.setFullYear(initialDate.getFullYear() - 18); // Default to 18 years ago
    
    if (formData.dateOfBirth) {
      try {
        const existingDate = new Date(formData.dateOfBirth);
        if (!isNaN(existingDate.getTime())) {
          initialDate = existingDate;
        }
      } catch (e) {
        // If invalid date, keep default
        console.log('Invalid dateOfBirth format:', formData.dateOfBirth);
      }
    }
    
    setSelectedDate(initialDate);
    
    // For Android, use DateTimePickerAndroid.open()
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: initialDate,
        mode: 'date',
        maximumDate: new Date(),
        minimumDate: new Date(1900, 0, 1),
        onChange: handleDatePickerChange,
      });
    } else {
      // For iOS, show modal
      setShowDatePicker(true);
    }
  };

  const handleDatePickerChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    
    if (date) {
      setSelectedDate(date);
      const formattedDate = formatDateToString(date);
      setFormData(prev => ({...prev, dateOfBirth: formattedDate}));
      
      if (Platform.OS === 'ios') {
        // On iOS, we handle the close manually
        setShowDatePicker(false);
      }
    }
  };

  const handleDatePickerCancel = () => {
    setShowDatePicker(false);
  };

  const handleSave = async () => {
    if (!user?.uid) {
      return;
    }

    setIsLoading(true);
    try {
      const updateData: any = {};

      // Handle name and surname - always update even if empty to clear old values
      updateData.name = formData.name.trim();
      updateData.surname = formData.surname.trim();
      
      // Update displayName to match name + surname
      const displayName = [formData.name.trim(), formData.surname.trim()]
        .filter(Boolean)
        .join(' ');
      if (displayName) {
        updateData.displayName = displayName;
      }
      
      if (formData.dateOfBirth.trim()) {
        // Validate date format and minimum age of 15
        const dob = new Date(formData.dateOfBirth.trim());
        const today = new Date();
        const age = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();
        const dayDiff = today.getDate() - dob.getDate();
        const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
        
        if (actualAge < 15) {
          Alert.alert('Erreur', 'Vous devez avoir au moins 15 ans pour utiliser cette application');
          setIsLoading(false);
          return;
        }
        
        updateData.dateOfBirth = formData.dateOfBirth.trim();
        updateData.age = actualAge; // Store calculated age for backwards compatibility
      }
      
      // Always update sex field (including empty string for \"not specified\")
      updateData.sex = formData.sex;
      
      if (formData.phoneNumber.trim()) {
        try {
          // Format and validate phone number with country code
          const phoneNumber = formData.phoneNumber.trim();
          const formattedPhone = PhoneService.formatPhoneNumber(selectedCountry.code, phoneNumber);
          
          if (!PhoneService.validatePhoneNumber(formattedPhone)) {
            Alert.alert('Erreur', 'Numéro de téléphone invalide pour ' + selectedCountry.name);
            setIsLoading(false);
            return;
          }
          
          updateData.phoneNumber = formattedPhone;
          updateData.countryCode = selectedCountry.code;
        } catch (error) {
          console.error('Phone validation error:', error);
          Alert.alert(
            'Erreur',
            'Impossible de valider le numéro de téléphone. Veuillez vérifier le format.'
          );
          setIsLoading(false);
          return;
        }
      }
      
      // Always update email - validate only if not empty
      if (formData.email.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email.trim())) {
          Alert.alert('Erreur', 'Format d\'email invalide');
          setIsLoading(false);
          return;
        }
        updateData.email = formData.email.trim();
      } else {
        updateData.email = ''; // Clear email if removed
      }
      
      // Always update city
      updateData.defaultCity = formData.city.trim();

      updateData.updatedAt = firestore.FieldValue.serverTimestamp();

      await firestore()
        .collection('artifacts')
        .doc(APP_ID)
        .collection('users')
        .doc(user.uid)
        .set(updateData, {merge: true});

      analyticsService.logCustomEvent('profile_updated', {
        fields_updated: Object.keys(updateData).filter(
          key => key !== 'updatedAt',
        ),
        has_name: !!updateData.name,
        has_dateOfBirth: !!updateData.dateOfBirth,
        has_sex: !!updateData.sex,
        has_phone: !!updateData.phoneNumber,
        has_city: !!updateData.defaultCity,
      });

      showToast('Profil mis à jour avec succès!', 'success', 3000);
      // Go back to previous screen (ProfileScreen)
      navigation.goBack();
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert(
        'Erreur',
        "Une erreur s'est produite lors de la mise à jour du profil.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCities = DRC_CITIES.filter(city =>
    city.toLowerCase().includes(citySearch.toLowerCase()),
  );

  // Country Modal
  if (showCountryModal) {
    return (
      <Modal
        visible={showCountryModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowCountryModal(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowCountryModal(false)}
              style={styles.backButton}>
              <Icon name="arrow-left" size="md" color={Colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Sélectionner un pays</Text>
            <View style={{width: 40}} />
          </View>

          <ScrollView
            style={styles.cityList}
            contentContainerStyle={styles.cityListContent}
            showsVerticalScrollIndicator={false}>
            {countryCodeList.map((country) => (
              <TouchableOpacity
                key={country.code}
                style={[
                  styles.cityOption,
                  selectedCountry.code === country.code && styles.cityOptionSelected,
                ]}
                onPress={() => {
                  setSelectedCountry(country);
                  setShowCountryModal(false);
                }}
                activeOpacity={0.7}>
                <View style={styles.cityOptionLeft}>
                  <Text style={styles.flagText}>{country.flag}</Text>
                  <View>
                    <Text
                      style={[
                        styles.cityOptionText,
                        selectedCountry.code === country.code && styles.cityOptionTextSelected,
                      ]}>
                      {country.name}
                    </Text>
                    <Text style={styles.countryCodeSubtext}>{country.code}</Text>
                  </View>
                </View>
                {selectedCountry.code === country.code && (
                  <Icon name="check" size="sm" color={Colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  }

  // City Picker Screen
  if (showCityPicker) {
    return (
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setShowCityPicker(false)}
            activeOpacity={0.7}>
            <Icon name="chevron-left" size="md" color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sélectionner une ville</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <Icon name="search" size="sm" color={Colors.text.tertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher une ville..."
              placeholderTextColor={Colors.text.tertiary}
              value={citySearch}
              onChangeText={setCitySearch}
              autoFocus
            />
            {citySearch.length > 0 && (
              <TouchableOpacity onPress={() => setCitySearch('')}>
                <Icon name="x" size="sm" color={Colors.text.tertiary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* City List */}
        <ScrollView
          style={styles.cityList}
          contentContainerStyle={styles.cityListContent}
          showsVerticalScrollIndicator={false}>
          {filteredCities.map(city => (
            <TouchableOpacity
              key={city}
              style={[
                styles.cityOption,
                formData.city === city && styles.cityOptionSelected,
              ]}
              onPress={() => {
                handleInputChange('city', city);
                setShowCityPicker(false);
                setCitySearch('');
              }}
              activeOpacity={0.7}>
              <View style={styles.cityOptionLeft}>
                <View
                  style={[
                    styles.cityIconContainer,
                    formData.city === city && styles.cityIconContainerSelected,
                  ]}>
                  <Icon
                    name="location"
                    size="sm"
                    color={
                      formData.city === city
                        ? Colors.white
                        : Colors.text.secondary
                    }
                  />
                </View>
                <Text
                  style={[
                    styles.cityOptionText,
                    formData.city === city && styles.cityOptionTextSelected,
                  ]}>
                  {city}
                </Text>
              </View>
              {formData.city === city && (
                <Icon name="check" size="sm" color={Colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Main Profile Form
  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {formData.name?.charAt(0)?.toUpperCase() ||
                  user?.displayName?.charAt(0)?.toUpperCase() ||
                  'U'}
              </Text>
            </View>
            <Text style={styles.avatarLabel}>Photo de profil</Text>
          </View>

          {/* Personal Info Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Informations personnelles</Text>

            {/* Name Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Prénom</Text>
              <View style={styles.inputWrapper}>
                <Icon name="user" size="sm" color={Colors.text.tertiary} />
                <TextInput
                  style={styles.input}
                  value={formData.name}
                  onChangeText={value => handleInputChange('name', value)}
                  placeholder="Votre prénom"
                  placeholderTextColor={Colors.text.tertiary}
                />
              </View>
            </View>

            {/* Surname Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nom</Text>
              <View style={styles.inputWrapper}>
                <Icon name="user" size="sm" color={Colors.text.tertiary} />
                <TextInput
                  style={styles.input}
                  value={formData.surname}
                  onChangeText={value => handleInputChange('surname', value)}
                  placeholder="Votre nom de famille"
                  placeholderTextColor={Colors.text.tertiary}
                />
              </View>
            </View>

            {/* Date of Birth Input - Manual Entry */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Date de naissance</Text>
              <View style={styles.dateInputRow}>
                <View style={[styles.inputWrapper, {flex: 1, marginRight: Spacing.sm}]}>
                  <TextInput
                    style={[styles.input, {textAlign: 'center'}]}
                    value={birthDay}
                    onChangeText={value => handleDateInputChange('day', value)}
                    placeholder="JJ"
                    placeholderTextColor={Colors.text.tertiary}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
                <Text style={styles.dateSeparator}>/</Text>
                <View style={[styles.inputWrapper, {flex: 1, marginHorizontal: Spacing.sm}]}>
                  <TextInput
                    style={[styles.input, {textAlign: 'center'}]}
                    value={birthMonth}
                    onChangeText={value => handleDateInputChange('month', value)}
                    placeholder="MM"
                    placeholderTextColor={Colors.text.tertiary}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
                <Text style={styles.dateSeparator}>/</Text>
                <View style={[styles.inputWrapper, {flex: 2, marginLeft: Spacing.sm}]}>
                  <TextInput
                    style={[styles.input, {textAlign: 'center'}]}
                    value={birthYear}
                    onChangeText={value => handleDateInputChange('year', value)}
                    placeholder="AAAA"
                    placeholderTextColor={Colors.text.tertiary}
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                </View>
              </View>
              <Text style={styles.inputHint}>
                Format: Jour / Mois / Année (ex: 15/03/1995) - Vous devez avoir au moins 15 ans
              </Text>
            </View>

            {/* Sex Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Sexe</Text>
              <View style={styles.optionsRow}>
                {SEX_OPTIONS.map(option => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.optionButton,
                      formData.sex === option.value &&
                        styles.optionButtonSelected,
                    ]}
                    onPress={() => handleInputChange('sex', option.value)}
                    activeOpacity={0.7}>
                    <Text
                      style={[
                        styles.optionButtonText,
                        formData.sex === option.value &&
                          styles.optionButtonTextSelected,
                      ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Contact Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact</Text>

            {/* Phone Input - Editable */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Numéro de téléphone</Text>
              <View style={styles.phoneInputContainer}>
                <TouchableOpacity
                  style={styles.countryCodeButton}
                  onPress={() => setShowCountryModal(true)}
                  activeOpacity={0.7}>
                  <Text style={styles.flagText}>{selectedCountry.flag}</Text>
                  <Text style={styles.countryCodeText}>{selectedCountry.code}</Text>
                  <Icon name="chevron-down" size="xs" color={Colors.text.tertiary} />
                </TouchableOpacity>
                <View style={[styles.inputWrapper, {flex: 1}]}>
                  <Icon name="phone" size="sm" color={Colors.text.tertiary} />
                  <TextInput
                    style={styles.input}
                    value={formData.phoneNumber}
                    onChangeText={value => {
                      // Remove non-numeric characters
                      const cleanValue = value.replace(/[^0-9]/g, '');
                      handleInputChange('phoneNumber', cleanValue);
                    }}
                    placeholder="8XX XXX XXX"
                    placeholderTextColor={Colors.text.tertiary}
                    keyboardType="phone-pad"
                    maxLength={15}
                  />
                </View>
              </View>
              {profile?.phoneVerified && formData.phoneNumber && (
                <View style={styles.verifiedBadge}>
                  <Icon name="check-circle" size="xs" color={"#10B981"} />
                  <Text style={styles.verifiedText}>Numéro vérifié</Text>
                </View>
              )}
              {!profile?.phoneVerified && formData.phoneNumber && (
                <TouchableOpacity
                  style={styles.verifyButton}
                  onPress={() => setShowVerifyComingSoonModal(true)}
                  activeOpacity={0.7}>
                  <Icon name="shield-check" size="xs" color={Colors.primary} />
                  <Text style={styles.verifyButtonText}>Vérifier le numéro</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email (optionnel)</Text>
              <View style={styles.inputWrapper}>
                <Icon
                  name="mail"
                  size="sm"
                  color={Colors.text.tertiary}
                />
                <TextInput
                  style={styles.input}
                  value={formData.email}
                  onChangeText={value =>
                    handleInputChange('email', value)
                  }
                  placeholder="votre@email.com"
                  placeholderTextColor={Colors.text.tertiary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* City Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Ville</Text>
              <TouchableOpacity
                style={styles.selectButton}
                onPress={() => setShowCityPicker(true)}
                activeOpacity={0.7}>
                <View style={styles.selectButtonLeft}>
                  <Icon name="location" size="sm" color={Colors.text.tertiary} />
                  <Text
                    style={[
                      styles.selectButtonText,
                      !formData.city && styles.selectButtonPlaceholder,
                    ]}>
                    {formData.city || 'Sélectionner une ville'}
                  </Text>
                </View>
                <Icon
                  name="chevron-right"
                  size="sm"
                  color={Colors.text.tertiary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Save Button */}
          <Button
            title="Enregistrer les modifications"
            onPress={handleSave}
            variant="primary"
            size="lg"
            loading={isLoading}
            disabled={isLoading}
            icon={<Icon name="check" size="sm" color={Colors.white} />}
            style={{marginBottom: Spacing.xl}}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Date Picker Modal - iOS only */}
      {showDatePicker && Platform.OS === 'ios' && (
        <Modal
          visible={showDatePicker}
          transparent
          animationType="slide"
          onRequestClose={handleDatePickerCancel}>
          <View style={styles.datePickerModalContainer}>
            <View style={styles.datePickerModal}>
              {Platform.OS === 'ios' && (
                <View style={styles.modalHeader}>
                  <TouchableOpacity 
                    onPress={handleDatePickerCancel}
                    style={styles.modalCloseButton}>
                    <Text style={styles.modalCloseText}>Annuler</Text>
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>Date de naissance</Text>
                  <TouchableOpacity 
                    onPress={() => setShowDatePicker(false)}
                    style={styles.modalCloseButton}>
                    <Text style={styles.modalDoneText}>OK</Text>
                  </TouchableOpacity>
                </View>
              )}
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDatePickerChange}
                maximumDate={new Date()} // Can't select future dates
                minimumDate={new Date(1900, 0, 1)} // Reasonable minimum date
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Verify Number Coming Soon Modal */}
      <Modal
        visible={showVerifyComingSoonModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowVerifyComingSoonModal(false)}>
        <TouchableOpacity 
          style={styles.comingSoonOverlay}
          activeOpacity={1}
          onPress={() => setShowVerifyComingSoonModal(false)}>
          <View 
            style={styles.comingSoonModal}
            onStartShouldSetResponder={() => true}>
            <View style={styles.comingSoonIconContainer}>
              <Icon name="clock" size="xl" color={Colors.accent} />
            </View>
            <Text style={styles.comingSoonTitle}>Bientôt disponible</Text>
            <Text style={styles.comingSoonText}>
              La vérification du numéro de téléphone sera disponible dans une prochaine mise à jour.
            </Text>
            <TouchableOpacity
              style={styles.comingSoonButton}
              onPress={() => setShowVerifyComingSoonModal(false)}
              activeOpacity={0.7}>
              <Text style={styles.comingSoonButtonText}>Compris</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
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

  // Header (for city picker modal)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
  },
  headerSpacer: {
    width: 40,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing['3xl'],
  },

  // Avatar Section
  avatarSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.card.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    ...Shadows.md,
  },
  avatarText: {
    fontSize: 36,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  avatarLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.tertiary,
  },

  // Section
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: Typography.letterSpacing.wide,
    marginBottom: Spacing.base,
    marginLeft: Spacing.xs,
  },

  // Input Group
  inputGroup: {
    marginBottom: Spacing.base,
  },
  inputLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
    marginLeft: Spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderWidth: 1.5,
    borderColor: '#FDB913',
    gap: Spacing.sm,
  },
  inputDisabled: {
    backgroundColor: Colors.background.secondary,
    opacity: 0.8,
  },
  disabledText: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
    paddingVertical: Spacing.xs,
  },
  lockedIndicator: {
    padding: Spacing.xs,
  },
  inputHint: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.tertiary,
    marginTop: Spacing.xs,
    marginLeft: Spacing.xs,
    fontStyle: 'italic',
  },
  input: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.primary,
    paddingVertical: Spacing.xs,
  },
  inputSuffix: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.tertiary,
  },
  
  // Date Input Row
  dateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateSeparator: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
    marginHorizontal: Spacing.xs,
  },

  // Options Row (Sex selection)
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  optionButton: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: '#FDB913',
  },
  optionButtonSelected: {
    backgroundColor: Colors.card.blue,
    borderColor: Colors.primary,
  },
  optionButtonText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
  },
  optionButtonTextSelected: {
    color: Colors.text.primary,
    fontFamily: Typography.fontFamily.semiBold,
  },

  // Select Button
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
    borderWidth: 1.5,
    borderColor: '#FDB913',
  },
  selectButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  selectButtonText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.primary,
  },
  selectButtonPlaceholder: {
    color: Colors.text.tertiary,
  },

  // Save Button
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.base,
    marginTop: Spacing.lg,
    gap: Spacing.sm,
    ...Shadows.md,
  },
  saveButtonDisabled: {
    backgroundColor: Colors.border.medium,
  },
  saveButtonText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.white,
  },

  // City Picker
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.primary,
    paddingVertical: Spacing.xs,
  },
  cityList: {
    flex: 1,
  },
  cityListContent: {
    padding: Spacing.lg,
  },
  cityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  cityOptionSelected: {
    backgroundColor: Colors.card.blue,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  cityOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
  },
  cityIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityIconContainerSelected: {
    backgroundColor: Colors.primary,
  },
  cityOptionText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.primary,
  },
  cityOptionTextSelected: {
    fontFamily: Typography.fontFamily.semiBold,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  countryCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.sm,
  },
  flagText: {
    fontSize: Typography.fontSize.xl,
  },
  countryCodeText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
  },
  countryCodeSubtext: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  verifiedText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: '#10B981',
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  verifyButtonText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.primary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
    backgroundColor: Colors.white,
  },
  modalTitle: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
  },
  // Date Picker Modal Styles
  datePickerModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  datePickerModal: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    marginHorizontal: Spacing.lg,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  modalCloseButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  modalCloseText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
  },
  modalDoneText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.primary,
  },
  // Coming Soon Modal Styles
  comingSoonOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  comingSoonModal: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginHorizontal: Spacing.lg,
    maxWidth: 340,
    alignItems: 'center',
    ...Shadows.lg,
  },
  comingSoonIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.card.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  comingSoonTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  comingSoonText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  comingSoonButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing['2xl'],
    alignSelf: 'stretch',
    alignItems: 'center',
    ...Shadows.sm,
  },
  comingSoonButtonText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.white,
  },
});
