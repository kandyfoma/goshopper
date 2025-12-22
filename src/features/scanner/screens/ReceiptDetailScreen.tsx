// Receipt Detail Screen - Urbanist Design System
// GoShopper - Warm color palette with category colors
import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  StatusBar,
} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import auth from '@react-native-firebase/auth';
import {RootStackParamList, Receipt} from '@/shared/types';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {formatCurrency, formatDate, convertCurrency} from '@/shared/utils/helpers';
import {receiptStorageService, authService} from '@/shared/services/firebase';
import {hapticService, shareService} from '@/shared/services';
import {useAuth, useToast} from '@/shared/contexts';
import {Spinner, Icon} from '@/shared/components';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ReceiptDetailRouteProp = RouteProp<RootStackParamList, 'ReceiptDetail'>;

// Category color mapping
const CATEGORY_COLORS: Record<string, {bg: string; text: string}> = {
  'Fruits & Légumes': {bg: Colors.card.crimson, text: Colors.white},
  'Viande & Poisson': {bg: Colors.card.red, text: Colors.white},
  'Produits Laitiers': {bg: Colors.card.cream, text: Colors.text.primary},
  'Boulangerie': {bg: Colors.card.yellow, text: Colors.text.primary},
  'Boissons': {bg: Colors.card.blue, text: Colors.white},
  'Épicerie': {bg: Colors.card.cosmos, text: Colors.white},
  'Hygiène': {bg: Colors.accent, text: Colors.white},
  'Entretien': {bg: Colors.border.light, text: Colors.text.primary},
  'Autres': {bg: Colors.background.secondary, text: Colors.text.secondary},
};

const getCategoryColors = (category: string) => {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS['Autres'];
};

export function ReceiptDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ReceiptDetailRouteProp>();
  const {user} = useAuth();
  const {showToast} = useToast();
  const {receiptId, receipt: passedReceipt} = route.params;

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (passedReceipt) {
      // Add converted currency if not present
      const enhancedReceipt = {...passedReceipt};
      if (enhancedReceipt.currency === 'USD' && !enhancedReceipt.totalCDF) {
        enhancedReceipt.totalCDF = convertCurrency(enhancedReceipt.total, 'USD', 'CDF');
      } else if (enhancedReceipt.currency === 'CDF' && !enhancedReceipt.totalUSD) {
        enhancedReceipt.totalUSD = convertCurrency(enhancedReceipt.total, 'CDF', 'USD');
      }
      setReceipt(enhancedReceipt);
      setLoading(false);
      return;
    }

    const fetchReceipt = async () => {
      try {
        setLoading(true);
        setError(null);

        const userId = auth().currentUser?.uid;
        if (!userId) {
          setError('Utilisateur non connecté');
          return;
        }

        const fetchedReceipt = await receiptStorageService.getReceipt(
          userId,
          receiptId
        );

        if (!fetchedReceipt) {
          setError('Reçu non trouvé');
          return;
        }

        // Add converted currency if not present
        if (fetchedReceipt.currency === 'USD' && !fetchedReceipt.totalCDF) {
          fetchedReceipt.totalCDF = convertCurrency(fetchedReceipt.total, 'USD', 'CDF');
        } else if (fetchedReceipt.currency === 'CDF' && !fetchedReceipt.totalUSD) {
          fetchedReceipt.totalUSD = convertCurrency(fetchedReceipt.total, 'CDF', 'USD');
        }

        setReceipt(fetchedReceipt);

        // Detect city if not set
        if (!fetchedReceipt.city && fetchedReceipt.storeName) {
          const detectedCity =
            await receiptStorageService.detectCityFromStore(fetchedReceipt.storeName);
          if (detectedCity) {
            const userProfile = await authService.getUserProfile(userId);
            const userCity = userProfile?.defaultCity;

            if (detectedCity !== userCity) {
              Alert.alert(
                'Ville détectée',
                `Le reçu semble provenir de ${detectedCity}, mais votre ville par défaut est ${
                  userCity || 'non définie'
                }. Voulez-vous enregistrer ce reçu dans ${detectedCity} ?`,
                [
                  {
                    text: 'Utiliser ma ville',
                    onPress: () => {
                      if (userCity) {
                        receiptStorageService.updateReceiptCity(
                          fetchedReceipt.id,
                          userId,
                          userCity,
                        );
                        setReceipt(prev =>
                          prev ? {...prev, city: userCity} : null,
                        );
                        showToast(
                          `Reçu enregistré dans ${userCity}`,
                          'success',
                        );
                      }
                    },
                  },
                  {
                    text: 'Utiliser la ville détectée',
                    onPress: () => {
                      receiptStorageService.updateReceiptCity(
                        fetchedReceipt.id,
                        userId,
                        detectedCity,
                      );
                      setReceipt(prev =>
                        prev ? {...prev, city: detectedCity} : null,
                      );
                      showToast(
                        `Reçu enregistré dans ${detectedCity}`,
                        'success',
                      );
                    },
                  },
                ],
              );
            } else {
              await receiptStorageService.updateReceiptCity(
                fetchedReceipt.id,
                userId,
                detectedCity,
              );
              setReceipt(prev =>
                prev ? {...prev, city: detectedCity} : null,
              );
            }
          } else {
            const userProfile = await authService.getUserProfile(userId);
            const userCity = userProfile?.defaultCity;
            if (userCity) {
              await receiptStorageService.updateReceiptCity(
                fetchedReceipt.id,
                userId,
                userCity,
              );
              setReceipt(prev => (prev ? {...prev, city: userCity} : null));
            }
          }
        }
      } catch (err) {
        console.error('Error fetching receipt:', err);
        setError('Erreur lors du chargement du reçu');
      } finally {
        setLoading(false);
      }
    };

    fetchReceipt();
  }, [receiptId, passedReceipt, showToast]);

  const handleCompare = () => {
    navigation.push('PriceComparison', {receiptId});
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Spinner size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Chargement du reçu...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !receipt) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <View style={styles.errorIconContainer}>
            <Icon name="alert-circle" size="2xl" color={Colors.status.error} />
          </View>
          <Text style={styles.errorText}>{error || 'Reçu non trouvé'}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              // Navigate to History page
              navigation.navigate('History');
            }}
            activeOpacity={0.8}>
            <Icon name="arrow-left" size="sm" color={Colors.white} />
            <Text style={styles.retryButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFFFFF"
        translucent={false}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            // Navigate to History page after viewing receipt details
            navigation.navigate('History');
          }}>
          <Icon name="arrow-left" size="md" color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Détails du reçu</Text>
        <TouchableOpacity
          style={styles.shareButton}
          onPress={() => {
            hapticService.light();
            if (receipt) {
              shareService.shareReceipt(receipt);
            }
          }}>
          <Icon name="share" size="md" color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Store Header Card */}
        <View style={styles.storeCard}>
          <View style={styles.storeIconContainer}>
            <Icon name="store" size="xl" color={Colors.white} />
          </View>
          <Text style={styles.storeName}>{receipt.storeName}</Text>
          <View style={styles.dateContainer}>
            <Icon name="calendar" size="sm" color={Colors.white} />
            <Text style={styles.receiptDate}>
              {formatDate(receipt.date, 'long')}
            </Text>
          </View>
          {receipt.city && (
            <View style={styles.cityBadge}>
              <Icon name="map-pin" size="xs" color={Colors.white} />
              <Text style={styles.cityText}>{receipt.city}</Text>
            </View>
          )}
        </View>

        {/* Items Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Articles</Text>
            <View style={styles.itemCountBadge}>
              <Text style={styles.itemCountText}>{receipt.items.length}</Text>
            </View>
          </View>

          {receipt.items.map(item => (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemMain}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.itemMeta}>
                    {item.quantity} ×{' '}
                    {formatCurrency(item.unitPrice, receipt.currency)}
                  </Text>
                </View>
                <Text style={styles.itemPrice}>
                  {formatCurrency(item.totalPrice, receipt.currency)}
                </Text>
              </View>

              {item.category && (
                <View
                  style={[
                    styles.categoryBadge,
                    {backgroundColor: getCategoryColors(item.category).bg},
                  ]}>
                  <Icon
                    name="tag"
                    size="xs"
                    color={getCategoryColors(item.category).text}
                  />
                  <Text
                    style={[
                      styles.categoryText,
                      {color: getCategoryColors(item.category).text},
                    ]}>
                    {item.category}
                  </Text>
                </View>
              )}

              {/* Confidence indicator */}
              <View style={styles.confidenceContainer}>
                <View style={styles.confidenceBar}>
                  <View
                    style={[
                      styles.confidenceFill,
                      {
                        width: `${item.confidence * 100}%`,
                        backgroundColor:
                          item.confidence > 0.8
                            ? Colors.card.cosmos
                            : item.confidence > 0.5
                            ? Colors.accent
                            : Colors.card.crimson,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.confidenceText}>
                  {Math.round(item.confidence * 100)}%
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Total Section */}
        <View style={styles.totalCard}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <View style={styles.totalAmountContainer}>
              {receipt.currency === 'USD' ? (
                <>
                  <Text style={styles.totalAmount}>
                    {formatCurrency(receipt.total, 'USD')}
                  </Text>
                  <Text style={styles.totalAmountSecondary}>
                    {receipt.totalCDF 
                      ? formatCurrency(receipt.totalCDF, 'CDF')
                      : `≈ ${formatCurrency(convertCurrency(receipt.total, 'USD', 'CDF'), 'CDF')}`
                    }
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.totalAmount}>
                    {formatCurrency(receipt.total, 'CDF')}
                  </Text>
                  <Text style={styles.totalAmountSecondary}>
                    {receipt.totalUSD
                      ? formatCurrency(receipt.totalUSD, 'USD')
                      : `≈ ${formatCurrency(convertCurrency(receipt.total, 'CDF', 'USD'), 'USD')}`
                    }
                  </Text>
                </>
              )}
            </View>
          </View>
          {receipt.subtotal && receipt.subtotal !== receipt.total && (
            <>
              <View style={styles.divider} />
              <View style={styles.subtotalRow}>
                <Text style={styles.subtotalLabel}>Sous-total</Text>
                <Text style={styles.subtotalAmount}>
                  {formatCurrency(receipt.subtotal, receipt.currency)}
                </Text>
              </View>
              {receipt.tax !== undefined && receipt.tax > 0 && (
                <View style={styles.subtotalRow}>
                  <Text style={styles.subtotalLabel}>TVA</Text>
                  <Text style={styles.subtotalAmount}>
                    {formatCurrency(receipt.tax, receipt.currency)}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Compare Prices Card */}
        <TouchableOpacity
          style={styles.compareCard}
          onPress={handleCompare}
          activeOpacity={0.8}>
          <View style={styles.compareIconContainer}>
            <Icon
              name="trending-down"
              size="lg"
              color={Colors.card.cosmos}
            />
          </View>
          <View style={styles.compareTextContainer}>
            <Text style={styles.compareTitle}>Comparer les prix</Text>
            <Text style={styles.compareDesc}>
              Voir si vous avez payé le meilleur prix
            </Text>
          </View>
          <Icon name="chevron-right" size="md" color={Colors.text.tertiary} />
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.base,
    backgroundColor: Colors.white,
    shadowColor: Colors.black,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  shareButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },

  // Loading & Error States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  loadingText: {
    marginTop: Spacing.base,
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.status.errorLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  errorText: {
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  retryButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.semiBold,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },

  // Store Card
  storeCard: {
    backgroundColor: Colors.card.cosmos,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  storeIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.base,
  },
  storeName: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.white,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  receiptDate: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.white,
  },
  cityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  cityText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.white,
  },

  // Section
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.base,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
  },
  itemCountBadge: {
    backgroundColor: Colors.card.blue,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  itemCountText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
  },

  // Item Card
  itemCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  itemMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemInfo: {
    flex: 1,
    marginRight: Spacing.base,
  },
  itemName: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  itemMeta: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
  },
  itemPrice: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  categoryText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  confidenceBar: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.border.light,
    borderRadius: 2,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 2,
  },
  confidenceText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.tertiary,
    width: 32,
    textAlign: 'right',
  },

  // Total Card
  totalCard: {
    backgroundColor: Colors.card.cream,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.primary,
  },
  totalAmount: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  totalAmountContainer: {
    alignItems: 'flex-end',
  },
  totalAmountSecondary: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginVertical: Spacing.sm,
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  subtotalLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
  },
  subtotalAmount: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
  },

  // Compare Card
  compareCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.light,
    marginTop: Spacing.base,
    ...Shadows.sm,
  },
  compareIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.base,
  },
  compareTextContainer: {
    flex: 1,
  },
  compareTitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  compareDesc: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
  },
});
