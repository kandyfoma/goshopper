// Budget Settings Screen - Urbanist Design System
// GoShopper - Soft Pastel Colors with Clean Typography
import React, {useState, useEffect, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
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
import {Icon, Button} from '@/shared/components';
import {formatCurrency, getCurrencyForCountry} from '@/shared/utils/helpers';
import {analyticsService} from '@/shared/services/analytics';
import {
  getCurrentMonthBudget,
  updateCurrentMonthBudget,
  getCurrentMonthKey,
  formatMonthKey,
  getBudgetHistory,
} from '@/shared/services/firebase/budgetService';
import {MonthlyBudget} from '@/shared/types/user.types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function BudgetSettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {profile, updateProfile} = useUser();

  const [budgetAmount, setBudgetAmount] = useState('');
  const [defaultBudget, setDefaultBudget] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState<string>(
    'USD',
  );
  const [isLoading, setIsLoading] = useState(false);
  const [currentMonthBudget, setCurrentMonthBudget] = useState<{
    amount: number;
    currency: string;
    isCustom: boolean;
  } | null>(null);
  const [budgetHistory, setBudgetHistory] = useState<MonthlyBudget[]>([]);
  const [isLoadingBudget, setIsLoadingBudget] = useState(true);

  useEffect(() => {
    analyticsService.logScreenView('Budget Settings', 'BudgetSettingsScreen');
  }, []);

  // Load current month budget and history
  useEffect(() => {
    if (profile?.userId) {
      loadBudgetData();
    }
  }, [profile?.userId]);

  // Initialize from profile
  useEffect(() => {
    if (profile) {
      // For Congo users, allow currency selection between USD and CDF
      // For other users, use their country's currency
      const userCurrency = profile.countryCode === 'CD' 
        ? (profile.preferredCurrency || 'USD')
        : (profile.preferredCurrency || 'USD');
      setSelectedCurrency(userCurrency);
      
      // Set default budget from new field or legacy field
      const defBudget = profile.defaultMonthlyBudget || profile.monthlyBudget || 0;
      setDefaultBudget(defBudget > 0 ? defBudget.toString() : '');
    }
  }, [profile]);

  const loadBudgetData = async () => {
    if (!profile?.userId) return;

    try {
      setIsLoadingBudget(true);

      // Get current month budget
      const currentBudget = await getCurrentMonthBudget(
        profile.userId,
        profile.defaultMonthlyBudget || profile.monthlyBudget,
        profile.preferredCurrency,
      );
      setCurrentMonthBudget(currentBudget);
      setBudgetAmount(currentBudget.amount > 0 ? currentBudget.amount.toString() : '');

      // Get budget history
      const history = await getBudgetHistory(profile.userId, 3);
      setBudgetHistory(history);
    } catch (error) {
      console.error('Error loading budget data:', error);
    } finally {
      setIsLoadingBudget(false);
    }
  };

  const handleSave = async () => {
    if (!budgetAmount.trim() && !defaultBudget.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir au moins un montant de budget');
      return;
    }

    const currentAmount = budgetAmount.trim() ? parseFloat(budgetAmount) : 0;
    const defaultAmount = defaultBudget.trim() ? parseFloat(defaultBudget) : 0;

    if ((currentAmount > 0 && isNaN(currentAmount)) || (defaultAmount > 0 && isNaN(defaultAmount))) {
      Alert.alert('Erreur', 'Les montants doivent être des nombres valides');
      return;
    }

    if (currentAmount < 0 || defaultAmount < 0) {
      Alert.alert('Erreur', 'Les montants ne peuvent pas être négatifs');
      return;
    }

    setIsLoading(true);
    try {
      // Update current month budget if changed
      if (currentAmount > 0 && profile?.userId) {
        await updateCurrentMonthBudget(
          profile.userId,
          currentAmount,
          selectedCurrency,
        );
      }

      // Update default budget in profile
      await updateProfile({
        defaultMonthlyBudget: defaultAmount > 0 ? defaultAmount : undefined,
        monthlyBudget: defaultAmount > 0 ? defaultAmount : undefined, // Keep legacy field synced
        preferredCurrency: selectedCurrency,
      });

      analyticsService.logCustomEvent('budget_settings_updated', {
        currency: selectedCurrency,
        currentMonth: currentAmount,
        default: defaultAmount,
      });

      Alert.alert('Succès', 'Vos paramètres de budget ont été mis à jour', [
        {
          text: 'OK',
          onPress: () => {
            loadBudgetData(); // Reload data
            navigation.goBack();
          },
        },
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

  const currencies = useMemo(() => {
    const userCurrency = profile?.preferredCurrency || 'USD';
    const userCountry = profile?.countryCode;
    
    // If user is from Congo (CD), show both USD and CDF
    if (userCountry === 'CD') {
      return [
        {code: 'USD' as const, name: 'Dollar Américain (USD)', symbol: '$'},
        {code: 'CDF' as const, name: 'Franc Congolais (CDF)', symbol: 'FC'},
      ];
    }
    
    // For other countries, show only their country's currency
    const currencyMap: Record<string, {name: string; symbol: string}> = {
      'USD': {name: 'Dollar Américain (USD)', symbol: '$'},
      'EUR': {name: 'Euro (EUR)', symbol: '€'},
      'GBP': {name: 'Livre Sterling (GBP)', symbol: '£'},
      'CDF': {name: 'Franc Congolais (CDF)', symbol: 'FC'},
      'ZAR': {name: 'Rand Sud-Africain (ZAR)', symbol: 'R'},
      'NGN': {name: 'Naira Nigérian (NGN)', symbol: '₦'},
      'KES': {name: 'Shilling Kényan (KES)', symbol: 'KSh'},
      'TZS': {name: 'Shilling Tanzanien (TZS)', symbol: 'TSh'},
      'UGX': {name: 'Shilling Ougandais (UGX)', symbol: 'USh'},
      'GHS': {name: 'Cedi Ghanéen (GHS)', symbol: 'GH₵'},
      'XAF': {name: 'Franc CFA (XAF)', symbol: 'FCFA'},
      'XOF': {name: 'Franc CFA (XOF)', symbol: 'CFA'},
    };
    
    const currencyInfo = currencyMap[userCurrency] || currencyMap['USD'];
    return [{
      code: userCurrency as any,
      name: currencyInfo.name,
      symbol: currencyInfo.symbol,
    }];
  }, [profile?.countryCode, profile?.preferredCurrency]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size="md" color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Paramètres du Budget</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {isLoadingBudget ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Chargement...</Text>
          </View>
        ) : (
          <View>
            {/* Current Month Budget */}
            {currentMonthBudget && currentMonthBudget.amount > 0 && (
              <View style={styles.currentBudgetCard}>
                <View style={styles.currentBudgetHeader}>
                  <Icon name="calendar" size="md" color={Colors.card.red} />
                  <Text style={styles.currentBudgetTitle}>
                    {formatMonthKey(getCurrentMonthKey())}
                  </Text>
                  {currentMonthBudget.isCustom && (
                    <View style={styles.customBadge}>
                      <Text style={styles.customBadgeText}>Personnalisé</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.currentBudgetAmount}>
                  {formatCurrency(currentMonthBudget.amount, currentMonthBudget.currency)}
                </Text>
                {!currentMonthBudget.isCustom && (
                  <Text style={styles.currentBudgetCurrency}>
                    Copié du budget par défaut
                  </Text>
                )}
              </View>
            )}

            {/* Budget History */}
            {budgetHistory.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Historique (3 derniers mois)</Text>
                <View style={styles.historyList}>
                  {budgetHistory.map((budget) => (
                    <View key={budget.month} style={styles.historyItem}>
                      <View style={styles.historyLeft}>
                        <Text style={styles.historyMonth}>
                          {formatMonthKey(budget.month)}
                        </Text>
                        {budget.isCustom && (
                          <View style={styles.customBadgeSmall}>
                            <Text style={styles.customBadgeSmallText}>Modifié</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.historyAmount}>
                        {formatCurrency(budget.amount, budget.currency)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Currency Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Devise</Text>
              <Text style={styles.sectionSubtitle}>
                {profile?.countryCode === 'CD' 
                  ? 'Choisissez la devise pour vos budgets'
                  : 'Devise basée sur votre pays'
                }
              </Text>

              {profile?.countryCode === 'CD' ? (
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
                        <Text style={[
                          styles.currencySymbol,
                          selectedCurrency === currency.code && {color: Colors.text.inverse}
                        ]}>{currency.symbol}</Text>
                        <View style={styles.currencyInfo}>
                          <Text style={[
                            styles.currencyName,
                            selectedCurrency === currency.code && {color: Colors.text.inverse}
                          ]}>{currency.name}</Text>
                          <Text style={[
                            styles.currencyCode,
                            selectedCurrency === currency.code && {color: Colors.text.inverse}
                          ]}>{currency.code}</Text>
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
              ) : (
                <View style={styles.currencyDisplay}>
                  {currencies.map(currency => (
                    <View key={currency.code} style={styles.currencyOptionContent}>
                      <Text style={styles.currencySymbol}>{currency.symbol}</Text>
                      <View style={styles.currencyInfo}>
                        <Text style={styles.currencyName}>{currency.name}</Text>
                        <Text style={styles.currencyCode}>{currency.code}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

        {/* Budget Amount Input - Current Month */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Budget Ce Mois-ci</Text>
          <Text style={styles.sectionSubtitle}>
            Modifiez le budget pour {formatMonthKey(getCurrentMonthKey())}
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.currencyPrefix}>
              {currencies.find(c => c.code === selectedCurrency)?.symbol || '$'}
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
              Ce mois:{' '}
              {formatCurrency(parseFloat(budgetAmount), selectedCurrency)}
            </Text>
          )}
        </View>

        {/* Default Budget Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Budget par Défaut</Text>
          <Text style={styles.sectionSubtitle}>
            Ce montant sera automatiquement copié pour les nouveaux mois
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.currencyPrefix}>
              {currencies.find(c => c.code === selectedCurrency)?.symbol || '$'}
            </Text>
            <TextInput
              style={styles.budgetInput}
              value={defaultBudget}
              onChangeText={setDefaultBudget}
              placeholder="0"
              keyboardType="numeric"
              placeholderTextColor={Colors.text.tertiary}
            />
          </View>

          {defaultBudget && !isNaN(parseFloat(defaultBudget)) && (
            <Text style={styles.previewText}>
              Prochain mois:{' '}
              {formatCurrency(parseFloat(defaultBudget), selectedCurrency)}
            </Text>
          )}
        </View>

        {/* Save Button */}
        <Button
          title={isLoading ? 'Enregistrement...' : 'Enregistrer les Paramètres'}
          onPress={handleSave}
          variant="primary"
          size="lg"
          loading={isLoading}
          disabled={isLoading || !budgetAmount.trim() || !defaultBudget.trim()}
          style={{marginBottom: Spacing.xl, marginTop: Spacing.lg}}
        />
        </View>
        )}
      </ScrollView>
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
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    ...Shadows.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card.blue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
  },
  currentBudgetCard: {
    backgroundColor: Colors.card.cream,
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
    color: Colors.card.crimson,
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
  currencyDisplay: {
    backgroundColor: Colors.card.cream,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  currencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card.cream,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  currencyOptionSelected: {
    backgroundColor: Colors.card.cosmos,
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
    backgroundColor: Colors.card.red,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card.cream,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    ...Shadows.sm,
  },
  currencyPrefix: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.card.red,
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
    backgroundColor: Colors.card.crimson,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
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
  loadingContainer: {
    paddingVertical: Spacing['3xl'],
    alignItems: 'center',
  },
  loadingText: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
    marginTop: Spacing.md,
  },
  customBadge: {
    backgroundColor: Colors.card.crimson,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    marginLeft: Spacing.sm,
  },
  customBadgeText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.white,
  },
  historyList: {
    gap: Spacing.sm,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.card.cream,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  historyMonth: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.primary,
  },
  customBadgeSmall: {
    backgroundColor: Colors.card.crimson,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  customBadgeSmallText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.white,
  },
  historyAmount: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.card.crimson,
  },
});
