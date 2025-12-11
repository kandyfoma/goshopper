// City Selection Screen - Allow users to select their city before scanning
import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '@/shared/types';
import {useAuth} from '@/shared/contexts';
import {COLORS} from '@/shared/utils/constants';
import firestore from '@react-native-firebase/firestore';

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

export function CitySelectionScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {user} = useAuth();
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const handleCitySelect = async () => {
    if (!selectedCity || !user?.uid) return;

    setIsSaving(true);
    try {
      // Update user profile with selected city
      await firestore()
        .collection('artifacts')
        .doc('goshopperai')
        .collection('users')
        .doc(user.uid)
        .set({
          defaultCity: selectedCity,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        }, {merge: true});

      // Navigate to scanner
      navigation.replace('Scanner');
    } catch (error) {
      console.error('Error saving city:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const renderCity = ({item}: {item: string}) => (
    <TouchableOpacity
      style={[
        styles.cityItem,
        selectedCity === item && styles.cityItemSelected,
      ]}
      onPress={() => setSelectedCity(item)}
    >
      <Text
        style={[
          styles.cityText,
          selectedCity === item && styles.cityTextSelected,
        ]}
      >
        {item}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sélectionnez votre ville</Text>
        <Text style={styles.subtitle}>
          Choisissez la ville où vous faites vos achats pour une meilleure expérience
        </Text>
      </View>

      <FlatList
        data={DRC_CITIES}
        renderItem={renderCity}
        keyExtractor={(item) => item}
        numColumns={2}
        contentContainerStyle={styles.citiesGrid}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            (!selectedCity || isSaving) && styles.continueButtonDisabled,
          ]}
          onPress={handleCitySelect}
          disabled={!selectedCity || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.continueButtonText}>Continuer</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.gray[900],
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.gray[600],
    textAlign: 'center',
    lineHeight: 22,
  },
  citiesGrid: {
    padding: 16,
  },
  cityItem: {
    flex: 1,
    margin: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.gray[200],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
  },
  cityItemSelected: {
    borderColor: COLORS.primary[500],
    backgroundColor: COLORS.primary[50],
  },
  cityText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.gray[700],
    textAlign: 'center',
  },
  cityTextSelected: {
    color: COLORS.primary[600],
    fontWeight: '600',
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
  },
  continueButton: {
    backgroundColor: COLORS.primary[500],
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: COLORS.gray[300],
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});