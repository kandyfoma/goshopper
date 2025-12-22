// Profile Setup Screen - Complete profile after registration
import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  FlatList,
} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '@/shared/types';
import {useAuth, useToast} from '@/shared/contexts';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {Icon, Modal, Button, MainLayout} from '@/shared/components';
import {PhoneService} from '@/shared/services/phone';
import {countryCodeList} from '@/shared/constants/countries';
import {
  COUNTRIES_CITIES,
  POPULAR_CITIES,
  searchCities,
  CountryData,
  CityData,
} from '@/shared/constants/cities';
import firestore from '@react-native-firebase/firestore';
import {APP_ID} from '@/shared/services/firebase/config';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ProfileSetupRouteProp = RouteProp<RootStackParamList, 'ProfileSetup'>;

export function ProfileSetupScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ProfileSetupRouteProp>();
  const {user} = useAuth();
  const {showToast} = useToast();

  // Extract names from displayName if available
  const extractNamesFromDisplayName = (displayName: string | null) => {
    if (!displayName) {
      return {firstName: '', surname: ''};
    }

    const parts = displayName.trim().split(' ');
    if (parts.length === 1) {
      return {firstName: parts[0], surname: ''};
    } else {
      return {
        firstName: parts[0],
        surname: parts.slice(1).join(' '),
      };
    }
  };

  const displayNameParts = extractNamesFromDisplayName(
    user?.displayName || null,
  );

  // Pre-fill from social login or displayName
  const [firstName, setFirstName] = useState(
    route.params?.firstName || displayNameParts.firstName,
  );
  const [surname, setSurname] = useState(
    route.params?.surname || displayNameParts.surname,
  );
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(countryCodeList[0]); // Default to RDC for phone
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedLocationCountry, setSelectedLocationCountry] = useState<CountryData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [countrySearchQuery, setCountrySearchQuery] = useState('');
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [showCountrySelector, setShowCountrySelector] = useState(true); // For two-step modal
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [phoneExists, setPhoneExists] = useState(false);
  const [phoneCheckDebounce, setPhoneCheckDebounce] = useState<NodeJS.Timeout | null>(null);
  const [errors, setErrors] = useState<{
    firstName?: string;
    surname?: string;
    phoneNumber?: string;
    city?: string;
  }>({});

  // Check if names are pre-filled from social login
  const namesPreFilled = !!(
    route.params?.firstName || displayNameParts.firstName
  );

  // Check if phone number exists in backend
  const checkPhoneExists = useCallback(async (phone: string) => {
    if (!phone || phone.length < 8) {
      setPhoneExists(false);
      return;
    }

    setIsCheckingPhone(true);
    try {
      const formattedPhone = PhoneService.formatPhoneNumber(selectedCountry.code, phone);
      const exists = await PhoneService.checkPhoneExists(formattedPhone);
      setPhoneExists(exists);
      
      if (exists) {
        setErrors(prev => ({
          ...prev,
          phoneNumber: 'Ce numéro est déjà utilisé',
        }));
      } else {
        setErrors(prev => ({
          ...prev,
          phoneNumber: undefined,
        }));
      }
    } catch (error) {
      console.error('Error checking phone:', error);
    } finally {
      setIsCheckingPhone(false);
    }
  }, [selectedCountry]);

  // Debounce phone check
  useEffect(() => {
    if (phoneCheckDebounce) {
      clearTimeout(phoneCheckDebounce);
    }

    const timeout = setTimeout(() => {
      if (phoneNumber) {
        checkPhoneExists(phoneNumber);
      }
    }, 800);

    setPhoneCheckDebounce(timeout);

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [phoneNumber, selectedCountry]);

  // Filter cities based on search (global search)
  const searchResults = searchQuery.trim() ? searchCities(searchQuery) : [];
  
  // Filter countries based on search (for phone country picker)
  const filteredCountries = countryCodeList.filter(country =>
    country.name.toLowerCase().includes(countrySearchQuery.toLowerCase()) ||
    country.code.includes(countrySearchQuery) ||
    country.shortName.toLowerCase().includes(countrySearchQuery.toLowerCase()),
  );

  // Cities from selected country
  const countryCities = selectedLocationCountry?.cities || [];

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: {
      firstName?: string;
      surname?: string;
      phoneNumber?: string;
      city?: string;
    } = {};

    // Only validate names if not pre-filled
    if (!namesPreFilled) {
      if (!firstName.trim()) {
        newErrors.firstName = 'Le prénom est requis';
      } else if (firstName.trim().length < 2) {
        newErrors.firstName = 'Le prénom doit contenir au moins 2 caractères';
      }

      if (!surname.trim()) {
        newErrors.surname = 'Le nom est requis';
      } else if (surname.trim().length < 2) {
        newErrors.surname = 'Le nom doit contenir au moins 2 caractères';
      }
    }

    // Validate phone number
    if (!phoneNumber.trim()) {
      newErrors.phoneNumber = 'Le numéro de téléphone est requis';
    } else {
      const formatted = PhoneService.formatPhoneNumber(selectedCountry.code, phoneNumber);
      if (!PhoneService.validatePhoneNumber(formatted)) {
        newErrors.phoneNumber = 'Format de numéro de téléphone invalide';
      } else if (phoneExists) {
        newErrors.phoneNumber = 'Ce numéro est déjà utilisé';
      }
    }

    if (!selectedCity) {
      newErrors.city = 'Veuillez sélectionner votre ville';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle profile completion
  const handleComplete = async () => {
    if (!validateForm() || !user?.uid) {
      return;
    }

    setIsLoading(true);
    try {
      const formattedPhone = PhoneService.formatPhoneNumber(selectedCountry.code, phoneNumber);
      
      // Save profile to Firestore
      await firestore()
        .collection('artifacts')
        .doc(APP_ID)
        .collection('users')
        .doc(user.uid)
        .set(
          {
            firstName: firstName.trim(),
            surname: surname.trim(),
            displayName: `${firstName.trim()} ${surname.trim()}`,
            phoneNumber: formattedPhone,
            defaultCity: selectedCity,
            profileCompleted: true,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          },
          {merge: true},
        );

      // Navigate to main app
      showToast('Bienvenue sur GoShopper!', 'success', 3000);
      navigation.reset({
        index: 0,
        routes: [{name: 'Main'}],
      });
    } catch (error) {
      console.error('Error saving profile:', error);
      setErrors({city: 'Une erreur est survenue. Veuillez réessayer.'});
    } finally {
      setIsLoading(false);
    }
  };

  // City picker modal with hierarchical country → city selection
  const renderCityPicker = () => {
    const handleCitySelect = (city: string, country?: CountryData) => {
      setSelectedCity(city);
      if (country) {
        setSelectedLocationCountry(country);
      }
      setShowCityPicker(false);
      setShowCountrySelector(true);
      setSearchQuery('');
      setErrors(prev => ({...prev, city: undefined}));
    };

    const handleCountrySelect = (country: CountryData) => {
      setSelectedLocationCountry(country);
      setShowCountrySelector(false);
      setSearchQuery('');
    };

    const handleBackToCountries = () => {
      setShowCountrySelector(true);
      setSelectedLocationCountry(null);
      setSearchQuery('');
    };

    const popularCountries = COUNTRIES_CITIES.filter(c => c.isPopular);
    const otherCountries = COUNTRIES_CITIES.filter(c => !c.isPopular);

    return (
      <Modal
        visible={showCityPicker}
        variant="fullscreen"
        title={
          showCountrySelector
            ? 'Sélectionnez votre pays'
            : selectedLocationCountry?.name || 'Sélectionnez votre ville'
        }
        onClose={() => {
          setShowCityPicker(false);
          setShowCountrySelector(true);
          setSearchQuery('');
          setSelectedLocationCountry(null);
        }}>
        <View style={styles.searchContainer}>
          <View style={styles.searchIconWrapper}>
            <Icon name="search" size="md" color={Colors.primary} />
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder={
              showCountrySelector
                ? 'Rechercher un pays ou une ville...'
                : 'Rechercher une ville...'
            }
            placeholderTextColor={Colors.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="words"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
              <Icon name="x-circle" size="md" color={Colors.text.tertiary} />
            </TouchableOpacity>
          )}
        </View>

        {searchQuery.trim() && (
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsCount}>
              {searchResults.length} résultat{searchResults.length !== 1 ? 's' : ''}
            </Text>
          </View>
        )}

        <ScrollView
          style={styles.cityScrollView}
          contentContainerStyle={styles.cityListContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {searchQuery.trim() ? (
            searchResults.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrapper}>
                  <Icon name="search" size="3xl" color={Colors.text.tertiary} />
                </View>
                <Text style={styles.emptyTitle}>Aucun résultat</Text>
                <Text style={styles.emptyText}>
                  Essayez avec un autre nom
                </Text>
              </View>
            ) : (
              <View style={styles.citySection}>
                {searchResults.map(result => (
                  <TouchableOpacity
                    key={`${result.countryCode}-${result.name}`}
                    style={[
                      styles.cityItem,
                      selectedCity === result.name && styles.cityItemSelected,
                    ]}
                    onPress={() => {
                      const country = COUNTRIES_CITIES.find(c => c.code === result.countryCode);
                      handleCitySelect(result.name, country);
                    }}
                    activeOpacity={0.7}>
                    <View style={styles.cityIconWrapper}>
                      <Text style={styles.countryFlag}>{COUNTRIES_CITIES.find(c => c.code === result.countryCode)?.flag}</Text>
                    </View>
                    <View style={styles.cityInfoColumn}>
                      <Text style={[styles.cityText, selectedCity === result.name && styles.cityTextSelected]}>
                        {result.name}
                      </Text>
                      <Text style={styles.cityCountryText}>{result.country}</Text>
                    </View>
                    {selectedCity === result.name && (
                      <Icon name="check-circle" size="md" color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )
          ) : showCountrySelector ? (
            <>
              {popularCountries.length > 0 && (
                <View style={styles.citySection}>
                  <View style={styles.sectionHeader}>
                    <Icon name="star" size="sm" color={Colors.primary} />
                    <Text style={styles.sectionTitle}>Pays Populaires</Text>
                  </View>
                  {popularCountries.map(country => (
                    <TouchableOpacity
                      key={country.code}
                      style={styles.countryItem}
                      onPress={() => handleCountrySelect(country)}
                      activeOpacity={0.7}>
                      <Text style={styles.countryFlagLarge}>{country.flag}</Text>
                      <View style={styles.countryInfo}>
                        <Text style={styles.countryNameText}>{country.name}</Text>
                        <Text style={styles.countryCityCount}>
                          {country.cities.length} ville{country.cities.length !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      <Icon name="chevron-right" size="md" color={Colors.text.tertiary} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={styles.citySection}>
                <View style={styles.sectionHeader}>
                  <Icon name="globe" size="sm" color={Colors.text.secondary} />
                  <Text style={styles.sectionTitle}>Tous les Pays</Text>
                </View>
                {otherCountries.map(country => (
                  <TouchableOpacity
                    key={country.code}
                    style={styles.countryItem}
                    onPress={() => handleCountrySelect(country)}
                    activeOpacity={0.7}>
                    <Text style={styles.countryFlagLarge}>{country.flag}</Text>
                    <View style={styles.countryInfo}>
                      <Text style={styles.countryNameText}>{country.name}</Text>
                      <Text style={styles.countryCityCount}>
                        {country.cities.length} ville{country.cities.length !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <Icon name="chevron-right" size="md" color={Colors.text.tertiary} />
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.backToCountries}
                onPress={handleBackToCountries}
                activeOpacity={0.7}>
                <Icon name="arrow-left" size="md" color={Colors.primary} />
                <Text style={styles.backToCountriesText}>Changer de pays</Text>
              </TouchableOpacity>

              {POPULAR_CITIES.some(city => countryCities.includes(city)) && (
                <View style={styles.citySection}>
                  <View style={styles.sectionHeader}>
                    <Icon name="star" size="sm" color={Colors.primary} />
                    <Text style={styles.sectionTitle}>Villes Populaires</Text>
                  </View>
                  <View style={styles.popularCitiesGrid}>
                    {countryCities
                      .filter(city => POPULAR_CITIES.includes(city))
                      .map(city => (
                        <TouchableOpacity
                          key={city}
                          style={[
                            styles.popularCityChip,
                            selectedCity === city && styles.popularCityChipSelected,
                          ]}
                          onPress={() => handleCitySelect(city, selectedLocationCountry || undefined)}
                          activeOpacity={0.7}>
                          <Icon
                            name="map-pin"
                            size="xs"
                            color={selectedCity === city ? Colors.white : Colors.primary}
                          />
                          <Text
                            style={[
                              styles.popularCityText,
                              selectedCity === city && styles.popularCityTextSelected,
                            ]}>
                            {city}
                          </Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                </View>
              )}

              <View style={styles.citySection}>
                <View style={styles.sectionHeader}>
                  <Icon name="map-pin" size="sm" color={Colors.text.secondary} />
                  <Text style={styles.sectionTitle}>Toutes les Villes</Text>
                </View>
                {countryCities.map(city => (
                  <TouchableOpacity
                    key={city}
                    style={[
                      styles.cityItem,
                      selectedCity === city && styles.cityItemSelected,
                    ]}
                    onPress={() => handleCitySelect(city, selectedLocationCountry || undefined)}
                    activeOpacity={0.7}>
                    <View
                      style={[
                        styles.cityIconWrapper,
                        selectedCity === city && styles.cityIconWrapperSelected,
                      ]}>
                      <Icon
                        name="map-pin"
                        size="sm"
                        color={selectedCity === city ? Colors.white : Colors.primary}
                      />
                    </View>
                    <Text
                      style={[
                        styles.cityText,
                        selectedCity === city && styles.cityTextSelected,
                      ]}>
                      {city}
                    </Text>
                    {selectedCity === city && (
                      <View style={styles.cityCheckIcon}>
                        <Icon name="check-circle" size="md" color={Colors.primary} />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </Modal>
    );
  };

  // Country picker modal (for phone code selection)
  const renderCountryPicker = () => (
    <Modal
      visible={showCountryPicker}
      variant="fullscreen"
      title="Sélectionnez votre pays"
      onClose={() => {
        setShowCountryPicker(false);
        setCountrySearchQuery('');
      }}>
        {/* Search input */}
        <View style={styles.searchContainer}>
          <View style={styles.searchIconWrapper}>
            <Icon name="search" size="md" color={Colors.primary} />
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un pays..."
            placeholderTextColor={Colors.text.tertiary}
            value={countrySearchQuery}
            onChangeText={setCountrySearchQuery}
            autoCapitalize="words"
            autoFocus
          />
          {countrySearchQuery.length > 0 && (
            <TouchableOpacity 
              onPress={() => setCountrySearchQuery('')}
              style={styles.clearButton}
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
              <Icon name="x-circle" size="md" color={Colors.text.tertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Results count */}
        {countrySearchQuery && (
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsCount}>
              {filteredCountries.length} {filteredCountries.length === 1 ? 'pays trouvé' : 'pays trouvés'}
            </Text>
          </View>
        )}

        <FlatList
          data={filteredCountries}
          keyExtractor={item => item.code + item.shortName}
          renderItem={({item}) => (
            <TouchableOpacity
              style={[
                styles.countryItem,
                selectedCountry.code === item.code && styles.countryItemSelected,
              ]}
              onPress={() => {
                setSelectedCountry(item);
                setShowCountryPicker(false);
                setCountrySearchQuery('');
              }}>
              <Text style={styles.countryFlag}>{item.flag}</Text>
              <View style={styles.countryInfo}>
                <Text style={styles.countryName}>{item.name}</Text>
                <Text style={styles.countryCode}>{item.code}</Text>
              </View>
              {selectedCountry.code === item.code && (
                <Icon name="check-circle" size="md" color={Colors.primary} />
              )}
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.countryList}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrapper}>
                <Icon name="globe" size="3xl" color={Colors.text.tertiary} />
              </View>
              <Text style={styles.emptyTitle}>Aucun pays trouvé</Text>
              <Text style={styles.emptyText}>
                Essayez avec un autre nom de pays
              </Text>
              {countrySearchQuery && (
                <TouchableOpacity 
                  style={styles.clearSearchButton}
                  onPress={() => setCountrySearchQuery('')}>
                  <Text style={styles.clearSearchText}>Effacer la recherche</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
              <View style={styles.iconContainer}>
                <Icon
                  name="user"
                  size="2xl"
                  color={Colors.text.primary}
                  variant="filled"
                />
              </View>
              <Text style={styles.title}>
                {namesPreFilled
                  ? 'Finalisez votre profil'
                  : 'Complétez votre profil'}
              </Text>
              <Text style={styles.subtitle}>
                {namesPreFilled
                  ? 'Ajoutez votre numéro de téléphone et ville pour continuer'
                  : 'Ces informations nous aideront à personnaliser votre expérience'}
              </Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
            {/* First Name */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>
                Prénom {namesPreFilled && '(auto-rempli)'}
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  errors.firstName ? styles.inputError : null,
                  namesPreFilled && styles.inputDisabled,
                ]}>
                <Icon name="user" size="md" color={Colors.text.secondary} />
                <TextInput
                  style={[
                    styles.input,
                    namesPreFilled && styles.inputTextDisabled,
                  ]}
                  placeholder="Entrez votre prénom"
                  placeholderTextColor={Colors.text.tertiary}
                  value={firstName}
                  onChangeText={text => {
                    if (!namesPreFilled) {
                      setFirstName(text);
                      if (errors.firstName) {
                        setErrors(prev => ({...prev, firstName: undefined}));
                      }
                    }
                  }}
                  autoCapitalize="words"
                  autoCorrect={false}
                  editable={!isLoading && !namesPreFilled}
                />
              </View>
              {errors.firstName && (
                <Text style={styles.errorText}>{errors.firstName}</Text>
              )}
            </View>

            {/* Surname */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>
                Nom de famille {namesPreFilled && '(auto-rempli)'}
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  errors.surname ? styles.inputError : null,
                  namesPreFilled && styles.inputDisabled,
                ]}>
                <Icon name="user" size="md" color={Colors.text.secondary} />
                <TextInput
                  style={[
                    styles.input,
                    namesPreFilled && styles.inputTextDisabled,
                  ]}
                  placeholder="Entrez votre nom"
                  placeholderTextColor={Colors.text.tertiary}
                  value={surname}
                  onChangeText={text => {
                    if (!namesPreFilled) {
                      setSurname(text);
                      if (errors.surname) {
                        setErrors(prev => ({...prev, surname: undefined}));
                      }
                    }
                  }}
                  autoCapitalize="words"
                  autoCorrect={false}
                  editable={!isLoading && !namesPreFilled}
                />
              </View>
              {errors.surname && (
                <Text style={styles.errorText}>{errors.surname}</Text>
              )}
            </View>

            {/* Phone Number with Country Code */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Numéro de téléphone</Text>
              <View style={styles.phoneRow}>
                {/* Country Selector */}
                <TouchableOpacity
                  style={styles.countrySelector}
                  onPress={() => setShowCountryPicker(true)}
                  disabled={isLoading}>
                  <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                  <Text style={styles.countryCodeText}>{selectedCountry.code}</Text>
                  <Icon name="chevron-down" size="sm" color={Colors.text.secondary} />
                </TouchableOpacity>

                {/* Phone Input */}
                <View
                  style={[
                    styles.phoneInputWrapper,
                    errors.phoneNumber ? styles.inputError : null,
                  ]}>
                  <Icon name="phone" size="md" color={Colors.text.secondary} />
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="XX XXX XXXX"
                    placeholderTextColor={Colors.text.tertiary}
                    value={phoneNumber}
                    onChangeText={text => {
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
                      if (errors.phoneNumber) {
                        setErrors(prev => ({...prev, phoneNumber: undefined}));
                      }
                    }}
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                  />
                  {isCheckingPhone && (
                    <Icon name="loader" size="sm" color={Colors.primary} />
                  )}
                  {!isCheckingPhone && phoneNumber && !errors.phoneNumber && (
                    <Icon name="check-circle" size="sm" color={Colors.status.success} />
                  )}
                </View>
              </View>
              {errors.phoneNumber && (
                <Text style={styles.errorText}>{errors.phoneNumber}</Text>
              )}
            </View>

            {/* City Selection */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Ville</Text>
              <TouchableOpacity
                style={[
                  styles.inputWrapper,
                  styles.selectWrapper,
                  errors.city ? styles.inputError : null,
                ]}
                onPress={() => setShowCityPicker(true)}
                disabled={isLoading}>
                <Icon name="map-pin" size="md" color={Colors.text.secondary} />
                <Text
                  style={[
                    styles.selectText,
                    !selectedCity && styles.placeholderText,
                  ]}>
                  {selectedCity || 'Sélectionnez votre ville'}
                </Text>
                <Icon
                  name="chevron-down"
                  size="md"
                  color={Colors.text.secondary}
                />
              </TouchableOpacity>
              {errors.city && (
                <Text style={styles.errorText}>{errors.city}</Text>
              )}
            </View>

            {/* Submit Button */}
            <Button
              title="Commencer"
              onPress={handleComplete}
              disabled={isLoading || isCheckingPhone || phoneExists || !phoneNumber || !selectedCity || (!firstName && !namesPreFilled) || (!surname && !namesPreFilled)}
              loading={isLoading}
              icon={<Icon name="arrow-right" size="md" color={Colors.white} />}
              iconPosition="right"
              fullWidth
            />

            {/* Footer */}
            <View style={styles.guestFooter}>
              <Text style={styles.footerText}>
                En finalisant votre profil, c'est{' '}
                <Text style={styles.footerHighlight}>gratuit, rapide et sécurisé</Text>
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {renderCityPicker()}
      {renderCountryPicker()}
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
    padding: Spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
    marginTop: Spacing.xl,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius['2xl'],
    backgroundColor: Colors.card.yellow,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    ...Shadows.md,
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.lg,
  },
  form: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: Spacing.xl,
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
    borderColor: '#FDB913',
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.base,
    gap: Spacing.md,
  },
  selectWrapper: {
    paddingVertical: Spacing.base,
  },
  inputError: {
    borderColor: Colors.status.error,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  inputDisabled: {
    backgroundColor: Colors.background.secondary,
    borderColor: Colors.border.light,
  },
  inputTextDisabled: {
    color: Colors.text.secondary,
  },
  input: {
    flex: 1,
    paddingVertical: Spacing.base,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.primary,
  },
  selectText: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.primary,
  },
  placeholderText: {
    color: Colors.text.tertiary,
  },
  errorText: {
    color: Colors.status.error,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    marginTop: Spacing.xs,
    marginLeft: Spacing.xs,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FDB913',
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.base,
    gap: Spacing.xs,
  },
  countryCodeText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.primary,
  },
  phoneInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FDB913',
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.base,
    gap: Spacing.md,
  },
  phoneInput: {
    flex: 1,
    paddingVertical: Spacing.base,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.primary,
  },
  guestFooter: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    marginTop: Spacing.md,
  },
  footerText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  footerHighlight: {
    fontFamily: Typography.fontFamily.bold,
    color: Colors.primary,
  },
  countryList: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.sm,
    marginHorizontal: 0,
    gap: Spacing.md,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border.light,
  },
  countryItemSelected: {
    backgroundColor: Colors.primary + '10',
    borderColor: Colors.primary,
  },
  countryFlag: {
    fontSize: 24,
  },
  countryInfo: {
    flex: 1,
  },
  countryName: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.primary,
  },
  countryCode: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.card.blue,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    marginTop: Spacing.md,
    gap: Spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.primary,
    lineHeight: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.xl,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    borderWidth: 2,
    borderColor: Colors.primary + '20',
  },
  searchIconWrapper: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.primary,
  },
  clearButton: {
    padding: Spacing.xs,
  },
  resultsHeader: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background.secondary,
    marginBottom: Spacing.sm,
  },
  resultsCount: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
  },
  cityScrollView: {
    flex: 1,
  },
  cityListContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing['2xl'],
  },
  citySection: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
  },
  popularCitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  popularCityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '10',
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
    gap: Spacing.xs,
    borderWidth: 1.5,
    borderColor: Colors.primary + '30',
  },
  popularCityChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  popularCityText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.primary,
  },
  popularCityTextSelected: {
    color: Colors.white,
  },
  cityList: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  cityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.base,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xs,
    marginHorizontal: 0,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border.light,
  },
  cityItemSelected: {
    backgroundColor: Colors.primary + '10',
    borderColor: Colors.primary,
  },
  cityIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  cityIconWrapperSelected: {
    backgroundColor: Colors.primary,
  },
  cityText: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.primary,
  },
  cityTextSelected: {
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
  },
  cityCheckIcon: {
    marginLeft: Spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['3xl'],
    paddingHorizontal: Spacing.xl,
  },
  emptyIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius['2xl'],
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  clearSearchButton: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
  },
  clearSearchText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.white,
  },
  // Country selection styles
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.light,
    marginHorizontal: Spacing.lg,
  },
  countryFlagLarge: {
    fontSize: 32,
  },
  countryInfo: {
    flex: 1,
  },
  countryNameText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  countryCityCount: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
  },
  backToCountries: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    marginBottom: Spacing.base,
    marginHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  backToCountriesText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.primary,
  },
  cityInfoColumn: {
    flex: 1,
  },
  cityCountryText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
});

export default ProfileSetupScreen;
