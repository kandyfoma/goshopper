// Profile Setup Screen - Complete profile after registration
import React, {useState, useEffect} from 'react';
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
  ActivityIndicator,
  FlatList,
} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '@/shared/types';
import {useAuth} from '@/shared/contexts';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {Icon, Modal} from '@/shared/components';
import firestore from '@react-native-firebase/firestore';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ProfileSetupRouteProp = RouteProp<RootStackParamList, 'ProfileSetup'>;

// Major DRC cities - deduplicated and sorted
const DRC_CITIES = [
  'Kinshasa',
  'Lubumbashi',
  'Mbuji-Mayi',
  'Kisangani',
  'Kananga',
  'Bukavu',
  'Goma',
  'Tshikapa',
  'Kolwezi',
  'Likasi',
  'Uvira',
  'Butembo',
  'Beni',
  'Bunia',
  'Isiro',
  'Mbandaka',
  'Kikwit',
  'Matadi',
  'Boma',
  'Bandundu',
  'Gemena',
  'Kabinda',
  'Mwene-Ditu',
  'Kalemie',
  'Kindu',
  'Lisala',
  'Bumba',
  'Inongo',
  'Boende',
  'Lusambo',
  'Ilebo',
  'Kisantu',
  'Mbanza-Ngungu',
  'Kasangulu',
  'Tshela',
].sort();

export function ProfileSetupScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ProfileSetupRouteProp>();
  const {user} = useAuth();

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
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [selectedCity, setSelectedCity] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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

  // Filter cities based on search
  const filteredCities = DRC_CITIES.filter(city =>
    city.toLowerCase().includes(searchQuery.toLowerCase()),
  );

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
    } else if (!/^\+?[0-9\s\-\(\)]{8,}$/.test(phoneNumber.trim())) {
      newErrors.phoneNumber = 'Format de numéro de téléphone invalide';
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
      // Save profile to Firestore
      await firestore()
        .collection('artifacts')
        .doc('goshopperai')
        .collection('users')
        .doc(user.uid)
        .set(
          {
            firstName: firstName.trim(),
            surname: surname.trim(),
            displayName: `${firstName.trim()} ${surname.trim()}`,
            phoneNumber: phoneNumber.trim(),
            defaultCity: selectedCity,
            profileCompleted: true,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          },
          {merge: true},
        );

      // Navigate to main app
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

  // City picker modal
  const renderCityPicker = () => (
    <Modal
      visible={showCityPicker}
      variant="fullscreen"
      title="Sélectionnez votre ville"
      onClose={() => setShowCityPicker(false)}>

        {/* Search input */}
        <View style={styles.searchContainer}>
          <Icon name="search" size="md" color={Colors.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher une ville..."
            placeholderTextColor={Colors.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="words"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="x" size="sm" color={Colors.text.tertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* City list */}
        <FlatList
          data={filteredCities}
          keyExtractor={item => item}
          renderItem={({item}) => (
            <TouchableOpacity
              style={[
                styles.cityItem,
                selectedCity === item && styles.cityItemSelected,
              ]}
              onPress={() => {
                setSelectedCity(item);
                setShowCityPicker(false);
                setSearchQuery('');
                setErrors(prev => ({...prev, city: undefined}));
              }}>
              <Icon
                name="map-pin"
                size="md"
                color={
                  selectedCity === item ? Colors.primary : Colors.text.secondary
                }
              />
              <Text
                style={[
                  styles.cityText,
                  selectedCity === item && styles.cityTextSelected,
                ]}>
                {item}
              </Text>
              {selectedCity === item && (
                <Icon name="check" size="md" color={Colors.primary} />
              )}
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.cityList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Icon name="map-pin" size="2xl" color={Colors.text.tertiary} />
              <Text style={styles.emptyText}>Aucune ville trouvée</Text>
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

            {/* Phone Number */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Numéro de téléphone</Text>
              <View
                style={[
                  styles.inputWrapper,
                  errors.phoneNumber ? styles.inputError : null,
                ]}>
                <Icon name="phone" size="md" color={Colors.text.secondary} />
                <TextInput
                  style={styles.input}
                  placeholder="+243 XX XXX XXXX"
                  placeholderTextColor={Colors.text.tertiary}
                  value={phoneNumber}
                  onChangeText={text => {
                    setPhoneNumber(text);
                    if (errors.phoneNumber) {
                      setErrors(prev => ({...prev, phoneNumber: undefined}));
                    }
                  }}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
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

            {/* Info text */}
            <View style={styles.infoBox}>
              <Icon name="info" size="md" color={Colors.primary} />
              <Text style={styles.infoText}>
                Votre ville nous aide à vous montrer les prix et offres près de
                chez vous
              </Text>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleComplete}
              disabled={isLoading}
              activeOpacity={0.8}>
              {isLoading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <View style={styles.buttonInner}>
                  <Text style={styles.buttonText}>Commencer</Text>
                  <Icon name="arrow-right" size="md" color={Colors.white} />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {renderCityPicker()}
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
    marginBottom: Spacing.lg,
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
    borderColor: Colors.border.light,
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
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.card.blue,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.primary,
    lineHeight: 20,
  },
  button: {
    backgroundColor: Colors.text.primary,
    borderRadius: BorderRadius.xl,
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
    fontFamily: Typography.fontFamily.bold,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    borderWidth: 1.5,
    borderColor: Colors.border.light,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.primary,
  },
  cityList: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  cityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  cityItemSelected: {
    backgroundColor: Colors.card.green,
  },
  cityText: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.primary,
  },
  cityTextSelected: {
    color: Colors.text.primary,
    fontFamily: Typography.fontFamily.semiBold,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['3xl'],
  },
  emptyText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
    marginTop: Spacing.md,
  },
});

export default ProfileSetupScreen;
