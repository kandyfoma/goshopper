// Update Profile Screen - Allow users to update their profile information
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
  ActivityIndicator,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '@/shared/types';
import {useAuth} from '@/shared/contexts';
import {COLORS} from '@/shared/utils/constants';
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
  'Inongo',
  'Boende',
  'Lusambo',
  'Kabinda',
  'Lubao',
  'Ilebo',
  'Mweka',
  'Basankusu',
  'Libenge',
  'Bumba',
  'Yangambi',
  'Aketi',
  'Lisala',
  'Bondo',
  'Poko',
  'Bosobolo',
  'Yumbi',
  'Bolomba',
  'Makanza',
  'Lukolela',
  'Irebu',
  'Kiri',
  'Lukolela',
  'Ingende',
  'Oshwe',
  'Befale',
  'Lukunga',
  'Mont-Ngafula',
  'Kintambo',
  'Ngaliema',
  'Gombe',
  'Barumbu',
  'Lingwala',
  'Makala',
  'Selembao',
  'Masina',
  'Righini',
  'Nsele',
  'Maluku',
  'Kimbanseke',
  'Ngaba',
  'Mont-Amba',
  'Binza',
  'Limete',
  'Matete',
  'Kasa-Vubu',
  'Ndjili',
  'Lemba',
  'Kingasani',
  'Ndjili',
  'Kimwenza',
  'Mbanza-Ngungu',
  'Kasangulu',
  'Madimba',
  'Kimpese',
  'Boko',
  'Songololo',
  'Lukaya',
  'Tshela',
  'Luozi',
  'Mbanza-Ngungu',
  'Noki',
  'Kimvula',
  'Lukula',
  'Seke-Banza',
  'Kwamouth',
  'Inga',
  'Kisantu',
  'Mbanza-Mputu',
  'Mbanza-Ngungu',
  'Lukala',
  'Madimba',
  'Kimpese',
  'Boko',
  'Songololo',
  'Lukaya',
  'Tshelia',
  'Luozi',
  'Mbanza-Ngungu',
  'Noki',
  'Kimvula',
  'Lukula',
  'Seke-Banza',
  'Kwamouth',
  'Inga',
  'Kisantu',
  'Mbanza-Mputu',
  'Mbanza-Ngungu',
  'Lukala',
];

export function UpdateProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {user, userProfile} = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    surname: '',
    age: '',
    sex: '' as '' | 'male' | 'female' | 'other',
    phoneNumber: '',
    monthlyBudget: '',
    city: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setFormData({
        name: userProfile.name || '',
        surname: userProfile.surname || '',
        age: userProfile.age?.toString() || '',
        sex: userProfile.sex || '',
        phoneNumber: userProfile.phoneNumber || '',
        monthlyBudget: userProfile.monthlyBudget?.toString() || '',
        city: userProfile.defaultCity || '',
      });
    }
  }, [userProfile]);

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!user?.uid) return;

    setIsLoading(true);
    try {
      const updateData: any = {};

      // Only include non-empty fields
      if (formData.name.trim()) updateData.name = formData.name.trim();
      if (formData.surname.trim()) updateData.surname = formData.surname.trim();
      if (formData.age.trim()) updateData.age = parseInt(formData.age.trim());
      if (formData.sex) updateData.sex = formData.sex;
      if (formData.phoneNumber.trim()) updateData.phoneNumber = formData.phoneNumber.trim();
      if (formData.monthlyBudget.trim()) updateData.monthlyBudget = parseFloat(formData.monthlyBudget.trim());
      if (formData.city.trim()) updateData.defaultCity = formData.city.trim();

      updateData.updatedAt = firestore.FieldValue.serverTimestamp();

      await firestore()
        .collection('artifacts')
        .doc('goshopperai')
        .collection('users')
        .doc(user.uid)
        .set(updateData, { merge: true });

      Alert.alert('Succès', 'Votre profil a été mis à jour avec succès!');
      navigation.goBack();
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Erreur', 'Une erreur s\'est produite lors de la mise à jour du profil.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderInput = (
    label: string,
    field: keyof typeof formData,
    placeholder: string,
    keyboardType: 'default' | 'numeric' | 'phone-pad' = 'default',
    multiline = false
  ) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multilineInput]}
        value={formData[field]}
        onChangeText={(value) => handleInputChange(field, value)}
        placeholder={placeholder}
        placeholderTextColor={COLORS.gray[400]}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
  );

  const renderSelect = (
    label: string,
    field: keyof typeof formData,
    options: {value: string, label: string}[]
  ) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.selectContainer}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.selectOption,
              formData[field] === option.value && styles.selectOptionSelected,
            ]}
            onPress={() => handleInputChange(field, option.value)}
          >
            <Text style={[
              styles.selectOptionText,
              formData[field] === option.value && styles.selectOptionTextSelected,
            ]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  if (showCityPicker) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setShowCityPicker(false)}
          >
            <Text style={styles.backButtonText}>← Retour</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sélectionner une ville</Text>
        </View>

        <ScrollView style={styles.cityPickerContainer}>
          {DRC_CITIES.map((city) => (
            <TouchableOpacity
              key={city}
              style={[
                styles.cityOption,
                formData.city === city && styles.cityOptionSelected,
              ]}
              onPress={() => {
                handleInputChange('city', city);
                setShowCityPicker(false);
              }}
            >
              <Text style={[
                styles.cityOptionText,
                formData.city === city && styles.cityOptionTextSelected,
              ]}>
                {city}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Modifier le profil</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {renderInput('Prénom', 'name', 'Votre prénom')}
        {renderInput('Nom', 'surname', 'Votre nom de famille')}
        {renderInput('Âge', 'age', 'Votre âge', 'numeric')}
        {renderInput('Numéro de téléphone', 'phoneNumber', 'Votre numéro', 'phone-pad')}
        {renderInput('Budget mensuel (FC)', 'monthlyBudget', 'Votre budget mensuel', 'numeric')}

        {renderSelect('Sexe', 'sex', [
          {value: '', label: 'Non spécifié'},
          {value: 'male', label: 'Homme'},
          {value: 'female', label: 'Femme'},
          {value: 'other', label: 'Autre'},
        ])}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Ville</Text>
          <TouchableOpacity
            style={styles.citySelector}
            onPress={() => setShowCityPicker(true)}
          >
            <Text style={formData.city ? styles.citySelectorText : styles.citySelectorPlaceholder}>
              {formData.city || 'Sélectionner une ville'}
            </Text>
            <Text style={styles.citySelectorArrow}>▼</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Enregistrer</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: COLORS.primary[500],
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.gray[900],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.gray[700],
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: COLORS.gray[900],
  },
  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  selectContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    backgroundColor: '#fff',
  },
  selectOptionSelected: {
    borderColor: COLORS.primary[500],
    backgroundColor: COLORS.primary[50],
  },
  selectOptionText: {
    fontSize: 14,
    color: COLORS.gray[700],
  },
  selectOptionTextSelected: {
    color: COLORS.primary[600],
    fontWeight: '500',
  },
  citySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    borderRadius: 8,
    padding: 12,
  },
  citySelectorText: {
    fontSize: 16,
    color: COLORS.gray[900],
  },
  citySelectorPlaceholder: {
    fontSize: 16,
    color: COLORS.gray[400],
  },
  citySelectorArrow: {
    fontSize: 12,
    color: COLORS.gray[500],
  },
  cityPickerContainer: {
    flex: 1,
    padding: 16,
  },
  cityOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  cityOptionSelected: {
    backgroundColor: COLORS.primary[50],
  },
  cityOptionText: {
    fontSize: 16,
    color: COLORS.gray[900],
  },
  cityOptionTextSelected: {
    color: COLORS.primary[600],
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: COLORS.primary[500],
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  saveButtonDisabled: {
    backgroundColor: COLORS.gray[300],
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});