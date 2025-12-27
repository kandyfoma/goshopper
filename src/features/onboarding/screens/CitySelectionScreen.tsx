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
import {useAuth, useToast} from '@/shared/contexts';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {Icon, Button} from '@/shared/components';
import firestore from '@react-native-firebase/firestore';
import {APP_ID} from '@/shared/services/firebase/config';

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
  'Noki',
  'Kimvula',
  'Lukula',
  'Seke-Banza',
  'Kwamouth',
  'Inga',
  'Kisantu',
  'Mbanza-Mputu',
  'Lukala',
].sort();

export function CitySelectionScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {user} = useAuth();
  const {showToast} = useToast();
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const handleCitySelect = async () => {
    if (!selectedCity || !user?.uid) {
      return;
    }

    setIsSaving(true);
    try {
      // Update user profile with selected city
      await firestore()
        .collection('artifacts')
        .doc(APP_ID)
        .collection('users')
        .doc(user.uid)
        .set(
          {
            defaultCity: selectedCity,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          },
          {merge: true},
        );

      // Navigate to scanner
      showToast('Ville sélectionnée!', 'success', 2000);
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
      onPress={() => setSelectedCity(item)}>
      {selectedCity === item && (
        <View style={styles.checkIcon}>
          <Icon name="check" size="sm" color={Colors.white} />
        </View>
      )}
      <Text
        style={[
          styles.cityText,
          selectedCity === item && styles.cityTextSelected,
        ]}>
        {item}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Back Button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}>
        <Icon name="arrow-left" size="md" color={Colors.text.primary} />
      </TouchableOpacity>

      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Icon name="map-pin" size="xl" color={Colors.primary} />
        </View>
        <Text style={styles.title}>Sélectionnez votre ville</Text>
        <Text style={styles.subtitle}>
          Choisissez la ville où vous faites vos achats pour une meilleure
          expérience
        </Text>
      </View>

      <FlatList
        data={DRC_CITIES}
        renderItem={renderCity}
        keyExtractor={item => item}
        numColumns={2}
        contentContainerStyle={styles.citiesGrid}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.footer}>
        <Button
          title="Continuer"
          onPress={handleCitySelect}
          variant="primary"
          size="lg"
          loading={isSaving}
          disabled={!selectedCity || isSaving}
          icon={<Icon name="arrow-right" size="sm" color={Colors.white} />}
          iconPosition="right"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  backButton: {
    position: 'absolute',
    top: Spacing.base,
    left: Spacing.base,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  header: {
    padding: Spacing.xl,
    paddingTop: Spacing['2xl'], // Extra top padding to avoid back button
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.fontSize.base,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  citiesGrid: {
    padding: Spacing.base,
  },
  cityItem: {
    flex: 1,
    margin: Spacing.sm,
    padding: Spacing.base,
    borderRadius: BorderRadius.base,
    borderWidth: 2,
    borderColor: Colors.border.light,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
    backgroundColor: Colors.background.primary,
  },
  cityItemSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.background.secondary,
  },
  checkIcon: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 20,
    height: 20,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cityText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  cityTextSelected: {
    color: Colors.primary,
    fontWeight: Typography.fontWeight.semiBold,
  },
  footer: {
    padding: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  continueButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.base,
    padding: Spacing.base,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  continueButtonDisabled: {
    backgroundColor: Colors.border.medium,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  continueButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
  },
});
