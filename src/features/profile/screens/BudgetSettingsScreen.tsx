// Budget Settings Screen - Urbanist Design System
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
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useUser} from '@/shared/contexts';
import {RootStackParamList} from '@/shared/types';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {Icon} from '@/shared/components';
import {formatCurrency} from '@/shared/utils/helpers';
import {analyticsService} from '@/shared/services/analytics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function BudgetSettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {profile, updateProfile} = useUser();

  const [budgetAmount, setBudgetAmount] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState<'USD' | 'CDF'>(
    'USD',
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    analyticsService.logScreenView('Budget Settings', 'BudgetSettingsScreen');
  }, []);

  useEffect(() => {
    if (profile) {
      setBudgetAmount(profile.monthlyBudget?.toString() || '');
      setSelectedCurrency(profile.preferredCurrency || 'USD');
    }
  }, [profile]);

  const handleSave = async () => {
    if (!budgetAmount.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir un montant de budget valide');
      return;
    }

    const amount = parseFloat(budgetAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Erreur', 'Le montant du budget doit être un nombre positif');
      return;
    }

    setIsLoading(true);
    try {
      await updateProfile({
        monthlyBudget: amount,
        preferredCurrency: selectedCurrency,
      });

      analyticsService.logCustomEvent('budget_settings_updated', {
        currency: selectedCurrency,
        amount: amount,
      });

      Alert.alert('Succès', 'Vos paramètres de budget ont été mis à jour', [
        {text: 'OK', onPress: () => navigation.goBack()},
      ]);
    } catch (error) {
      console.error('Failed to update budget settings:', error);
      Alert.alert(
        'Erreur',
        'Impossible de mettre à jour les paramètres de budget',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const currencies = [
    {code: 'USD' as const, name: 'Dollar Américain (USD)', symbol: '$'},
    {code: 'CDF' as const, name: 'Franc Congolais (CDF)', symbol: 'FC'},
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size="md" color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Paramètres du Budget</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Current Budget Display */}
        {profile?.monthlyBudget && (
          <View style={styles.currentBudgetCard}>
            <View style={styles.currentBudgetHeader}>
              <Icon name="wallet" size="md" color={Colors.accent} />
              <Text style={styles.currentBudgetTitle}>Budget Actuel</Text>
            </View>
            <Text style={styles.currentBudgetAmount}>
              {formatCurrency(profile.monthlyBudget, profile.preferredCurrency)}
            </Text>
            <Text style={styles.currentBudgetCurrency}>
              {profile.preferredCurrency === 'CDF'
                ? 'Franc Congolais'
                : 'Dollar Américain'}
            </Text>
          </View>
        )}

        {/* Currency Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Devise</Text>
          <Text style={styles.sectionSubtitle}>
            Choisissez la devise pour votre budget mensuel
          </Text>

          <View style={styles.currencyOptions}>
            {currencies.map(currency => (
              <TouchableOpacity
                key={currency.code}
                style={[
                  styles.currencyOption,
                  selectedCurrency === currency.code &&
                    styles.currencyOptionSelected,
                ]}
                onPress={() => setSelectedCurrency(currency.code)}>
                <View style={styles.currencyOptionContent}>
                  <Text style={styles.currencySymbol}>{currency.symbol}</Text>
                  <View style={styles.currencyInfo}>
                    <Text style={styles.currencyName}>{currency.name}</Text>
                    <Text style={styles.currencyCode}>{currency.code}</Text>
                  </View>
                </View>
                {selectedCurrency === currency.code && (
                  <View style={styles.checkIcon}>
                    <Icon name="check" size="sm" color={Colors.white} />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Budget Amount Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Montant du Budget</Text>
          <Text style={styles.sectionSubtitle}>
            Définissez votre budget mensuel en{' '}
            {selectedCurrency === 'CDF'
              ? 'Francs Congolais'
              : 'Dollars Américains'}
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.currencyPrefix}>
              {selectedCurrency === 'CDF' ? 'FC' : '$'}
            </Text>
            <TextInput
              style={styles.budgetInput}
              value={budgetAmount}
              onChangeText={setBudgetAmount}
              placeholder="0"
              keyboardType="numeric"
              placeholderTextColor={Colors.text.tertiary}
            />
          </View>

          {budgetAmount && !isNaN(parseFloat(budgetAmount)) && (
            <Text style={styles.previewText}>
              Budget:{' '}
              {formatCurrency(parseFloat(budgetAmount), selectedCurrency)}
            </Text>
          )}
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isLoading}>
          <Text style={styles.saveButtonText}>
            {isLoading ? 'Enregistrement...' : 'Enregistrer les Paramètres'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  headerTitle: {
    flex: 1,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginHorizontal: Spacing.md,
  },
  headerSpacer: {
    width: 40,
  },
  currentBudgetCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    ...Shadows.sm,
  },
  currentBudgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  currentBudgetTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
    marginLeft: Spacing.sm,
  },
  currentBudgetAmount: {
    fontSize: Typography.fontSize['5xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.accent,
    marginBottom: Spacing.xs,
  },
  currentBudgetCurrency: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  sectionSubtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    marginBottom: Spacing.lg,
    lineHeight: Typography.fontSize.sm * Typography.lineHeight.relaxed,
  },
  currencyOptions: {
    gap: Spacing.md,
  },
  currencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  currencyOptionSelected: {
    backgroundColor: Colors.accent,
  },
  currencyOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  currencySymbol: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginRight: Spacing.md,
    minWidth: 30,
  },
  currencyInfo: {
    flex: 1,
  },
  currencyName: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  currencyCode: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
  },
  checkIcon: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.status.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    ...Shadows.sm,
  },
  currencyPrefix: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.accent,
    marginRight: Spacing.sm,
  },
  budgetInput: {
    flex: 1,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
    paddingVertical: 0,
  },
  previewText: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    marginTop: Spacing.lg,
    ...Shadows.md,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.white,
  },
});
