// City Selection Screen - Allow users to select their city before scanning
import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
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
import {Icon, Button, AppLoader} from '@/shared/components';
import firestore from '@react-native-firebase/firestore';
import {APP_ID} from '@/shared/services/firebase/config';
import {COUNTRIES_CITIES, CountryData, CityData} from '@/shared/constants/cities';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function CitySelectionScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {user} = useAuth();
  const {showToast} = useToast();
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedLocationCountry, setSelectedLocationCountry] = useState<CountryData | null>(null);
  const [showCountrySelector, setShowCountrySelector] = useState(true);
  const [citySearchQuery, setCitySearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Search across all cities
  const searchCities = (query: string): Array<{name: string; country: string; countryCode: string}> => {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return [];

    const results: Array<{name: string; country: string; countryCode: string}> = [];
    
    COUNTRIES_CITIES.forEach(country => {
      country.cities.forEach(city => {
        if (city.toLowerCase().includes(lowerQuery) || 
            country.name.toLowerCase().includes(lowerQuery)) {
          results.push({
            name: city,
            country: country.name,
            countryCode: country.code,
          });
        }
      });
    });

    return results.slice(0, 20); // Limit results
  };

  const handleCitySelect = async (cityName: string) => {
    if (!cityName || !user?.uid) {
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
            defaultCity: cityName,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          },
          {merge: true},
        );

      // Navigate to scanner
      showToast('Ville sélectionnée!', 'success', 2000);
      navigation.replace('Scanner');
    } catch (error) {
      console.error('Error saving city:', error);
      showToast('Erreur lors de la sauvegarde', 'error', 2000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size="md" color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>
          {showCountrySelector
            ? 'Sélectionnez votre pays'
            : selectedLocationCountry?.name || 'Sélectionnez votre ville'}
        </Text>
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

      {/* Back button for city selection */}
      {!citySearchQuery.trim() && !showCountrySelector && selectedLocationCountry && (
        <TouchableOpacity
          style={styles.backToCountryButton}
          onPress={() => {
            setShowCountrySelector(true);
            setSelectedLocationCountry(null);
            setCitySearchQuery('');
          }}>
          <Icon name="arrow-left" size="md" color={Colors.primary} />
          <Text style={styles.backToCountryText}>Changer de pays</Text>
        </TouchableOpacity>
      )}

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.scrollContent}>
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
                  handleCitySelect(result.name);
                }}>
                <Text style={styles.countryFlag}>
                  {COUNTRIES_CITIES.find(c => c.code === result.countryCode)?.flag}
                </Text>
                <View style={{flex: 1}}>
                  <Text style={styles.cityName}>{result.name}</Text>
                  <Text style={styles.cityCountry}>{result.country}</Text>
                </View>
                <Icon name="chevron-right" size="md" color={Colors.text.tertiary} />
              </TouchableOpacity>
            ))
          )
        ) : showCountrySelector ? (
          /* Country selection */
          <>
            {COUNTRIES_CITIES.map(country => (
              <TouchableOpacity
                key={country.code}
                style={styles.countryItem}
                onPress={() => {
                  setSelectedLocationCountry(country);
                  setShowCountrySelector(false);
                  setCitySearchQuery('');
                }}>
                <Text style={styles.countryFlagLarge}>{country.flag}</Text>
                <View style={{flex: 1}}>
                  <Text style={styles.countryName}>{country.name}</Text>
                  <Text style={styles.countryCityCount}>
                    {country.cities.length} ville{country.cities.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                <Icon name="chevron-right" size="md" color={Colors.text.tertiary} />
              </TouchableOpacity>
            ))}
          </>
        ) : selectedLocationCountry ? (
          /* City selection for selected country */
          selectedLocationCountry.cities.map(city => (
            <TouchableOpacity
              key={city}
              style={styles.cityItem}
              onPress={() => {
                handleCitySelect(city);
              }}>
              <Icon name="map-pin" size="md" color={Colors.primary} />
              <Text style={styles.cityName}>{city}</Text>
              {selectedCity === city && (
                <Icon name="check-circle" size="md" color={Colors.primary} />
              )}
            </TouchableOpacity>
          ))
        ) : null}
      </ScrollView>

      {/* Loading overlay */}
      {isSaving && (
        <View style={styles.loadingOverlay}>
          <AppLoader size="large" message="Sauvegarde en cours..." />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.base,
  },
  title: {
    flex: 1,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: Spacing.base,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: Typography.fontSize.base,
    color: Colors.text.primary,
    padding: 0,
  },
  backToCountryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  backToCountryText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.primary,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.base,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['3xl'],
  },
  emptyText: {
    marginTop: Spacing.base,
    fontSize: Typography.fontSize.lg,
    color: Colors.text.tertiary,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
  },
  countryFlagLarge: {
    fontSize: 40,
    marginRight: Spacing.base,
  },
  countryName: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
  },
  countryCityCount: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  cityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  countryFlag: {
    fontSize: 32,
  },
  cityName: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.primary,
  },
  cityCountry: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Spacing.base,
    fontSize: Typography.fontSize.base,
    color: Colors.white,
    fontWeight: Typography.fontWeight.medium,
  },
});
