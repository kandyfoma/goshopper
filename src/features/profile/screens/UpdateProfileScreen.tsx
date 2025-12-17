// Update Profile Screen - Urbanist Design System
// GoShopperAI - Soft Pastel Colors with Clean Typography
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
import {Icon, Spinner} from '@/shared/components';
import {APP_ID} from '@/shared/services/firebase/config';
import firestore from '@react-native-firebase/firestore';
import {analyticsService} from '@/shared/services/analytics';

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

  useEffect(() => {
    if (!isAuthenticated) {
      navigation.navigate('Login');
    }
  }, [isAuthenticated, navigation]);

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

  const [formData, setFormData] = useState({
    name: '',
    surname: '',
    age: '',
    sex: '' as '' | 'male' | 'female' | 'other',
    phoneNumber: '',
    email: '',
    monthlyBudget: '',
    city: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [citySearch, setCitySearch] = useState('');

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        surname: profile.surname || '',
        age: profile.age?.toString() || '',
        sex: profile.sex || '',
        phoneNumber: profile.phoneNumber || '',
        email: profile.email || '',
        monthlyBudget: profile.monthlyBudget?.toString() || '',
        city: profile.defaultCity || '',
      });
    }
  }, [profile]);

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({...prev, [field]: value}));
  };

  const handleSave = async () => {
    if (!user?.uid) {
      return;
    }

    setIsLoading(true);
    try {
      const updateData: any = {};

      if (formData.name.trim()) {
        updateData.name = formData.name.trim();
      }
      if (formData.surname.trim()) {
        updateData.surname = formData.surname.trim();
      }
      if (formData.age.trim()) {
        updateData.age = parseInt(formData.age.trim());
      }
      if (formData.sex) {
        updateData.sex = formData.sex;
      }
      if (formData.phoneNumber.trim()) {
        updateData.phoneNumber = formData.phoneNumber.trim();
      }
      if (formData.email.trim()) {
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(formData.email.trim())) {
          updateData.email = formData.email.trim();
        } else {
          Alert.alert('Erreur', 'Format d\'email invalide');
          setIsLoading(false);
          return;
        }
      }
      if (formData.monthlyBudget.trim()) {
        updateData.monthlyBudget = parseFloat(formData.monthlyBudget.trim());
      }
      if (formData.city.trim()) {
        updateData.defaultCity = formData.city.trim();
      }

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
        has_age: !!updateData.age,
        has_sex: !!updateData.sex,
        has_phone: !!updateData.phoneNumber,
        has_budget: !!updateData.monthlyBudget,
        has_city: !!updateData.defaultCity,
      });

      Alert.alert('Succès', 'Votre profil a été mis à jour avec succès!');
      showToast('Profil mis à jour avec succès!', 'success', 3000);
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
                    name="map-pin"
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

            {/* Age Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Âge</Text>
              <View style={styles.inputWrapper}>
                <Icon name="calendar" size="sm" color={Colors.text.tertiary} />
                <TextInput
                  style={styles.input}
                  value={formData.age}
                  onChangeText={value => handleInputChange('age', value)}
                  placeholder="Votre âge"
                  placeholderTextColor={Colors.text.tertiary}
                  keyboardType="numeric"
                />
              </View>
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

            {/* Phone Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Numéro de téléphone</Text>
              <View style={styles.inputWrapper}>
                <Icon
                  name="smartphone"
                  size="sm"
                  color={Colors.text.tertiary}
                />
                <TextInput
                  style={styles.input}
                  value={formData.phoneNumber}
                  onChangeText={value =>
                    handleInputChange('phoneNumber', value)
                  }
                  placeholder="+243 XXX XXX XXX"
                  placeholderTextColor={Colors.text.tertiary}
                  keyboardType="phone-pad"
                />
              </View>
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
                  <Icon name="map-pin" size="sm" color={Colors.text.tertiary} />
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

          {/* Financial Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Budget</Text>

            {/* Monthly Budget Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Budget mensuel (FC)</Text>
              <View style={styles.inputWrapper}>
                <Icon name="wallet" size="sm" color={Colors.text.tertiary} />
                <TextInput
                  style={styles.input}
                  value={formData.monthlyBudget}
                  onChangeText={value =>
                    handleInputChange('monthlyBudget', value)
                  }
                  placeholder="Ex: 500000"
                  placeholderTextColor={Colors.text.tertiary}
                  keyboardType="numeric"
                />
                <Text style={styles.inputSuffix}>FC</Text>
              </View>
              <Text style={styles.inputHint}>
                Ce budget nous aide à vous suggérer des économies personnalisées
              </Text>
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isLoading}
            activeOpacity={0.8}>
            {isLoading ? (
              <Spinner size="small" color={Colors.white} />
            ) : (
              <>
                <Icon name="check" size="sm" color={Colors.white} />
                <Text style={styles.saveButtonText}>
                  Enregistrer les modifications
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
    borderWidth: 1,
    borderColor: Colors.border.light,
    gap: Spacing.sm,
    ...Shadows.sm,
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
  inputHint: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
    marginTop: Spacing.xs,
    marginLeft: Spacing.xs,
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
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.sm,
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
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.sm,
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
});
