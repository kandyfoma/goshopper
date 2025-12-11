// Receipt Detail Screen - View parsed receipt details
import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import {RootStackParamList, Receipt, ReceiptItem} from '@/shared/types';
import {COLORS} from '@/shared/utils/constants';
import {formatCurrency, formatDate} from '@/shared/utils/helpers';
import {receiptStorageService, authService} from '@/shared/services/firebase';
import {useAuth} from '@/shared/contexts';
import {useToast} from '@/shared/contexts';
import {Spinner} from '@/shared/components';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ReceiptDetailRouteProp = RouteProp<RootStackParamList, 'ReceiptDetail'>;

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
      setReceipt(passedReceipt);
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

        const receiptDoc = await firestore()
          .collection('artifacts')
          .doc('goshopperai')
          .collection('users')
          .doc(userId)
          .collection('receipts')
          .doc(receiptId)
          .get();

        if (!receiptDoc.exists) {
          setError('Reçu non trouvé');
          return;
        }

        const data = receiptDoc.data();
        if (data) {
          setReceipt({
            id: receiptDoc.id,
            userId: data.userId,
            storeName: data.storeName || 'Magasin inconnu',
            storeNameNormalized: data.storeNameNormalized || '',
            storeAddress: data.storeAddress,
            storePhone: data.storePhone,
            city: data.city,
            receiptNumber: data.receiptNumber,
            date: data.date
              ? new Date(data.date)
              : data.scannedAt?.toDate() || new Date(),
            currency: data.currency || 'USD',
            items: (data.items || []).map((item: any) => ({
              id: item.id || Math.random().toString(36).substring(7),
              name: item.name || 'Article inconnu',
              nameNormalized: item.nameNormalized || '',
              quantity: item.quantity || 1,
              unitPrice: item.unitPrice || 0,
              totalPrice: item.totalPrice || 0,
              unit: item.unit,
              category: item.category || 'Autres',
              confidence: item.confidence || 0.85,
            })),
            subtotal: data.subtotal,
            tax: data.tax,
            total: data.total || 0,
            processingStatus: data.processingStatus || 'completed',
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
            scannedAt: data.scannedAt?.toDate() || new Date(),
          });

          // Detect city if not set
          if (!data.city && data.storeName) {
            const detectedCity = await receiptStorageService.detectCityFromStore(data.storeName);
            if (detectedCity) {
              const userProfile = await authService.getUserProfile(userId);
              const userCity = userProfile?.defaultCity;

              if (detectedCity !== userCity) {
                // Ask user to confirm
                Alert.alert(
                  'Ville détectée',
                  `Le reçu semble provenir de ${detectedCity}, mais votre ville par défaut est ${userCity || 'non définie'}. Voulez-vous enregistrer ce reçu dans ${detectedCity} ?`,
                  [
                    {
                      text: 'Utiliser ma ville',
                      onPress: () => {
                        if (userCity) {
                          receiptStorageService.updateReceiptCity(receiptDoc.id, userId, userCity);
                          setReceipt(prev => prev ? {...prev, city: userCity} : null);
                          showToast(`Reçu enregistré dans ${userCity}`, 'success');
                        }
                      },
                    },
                    {
                      text: 'Utiliser la ville détectée',
                      onPress: () => {
                        receiptStorageService.updateReceiptCity(receiptDoc.id, userId, detectedCity);
                        setReceipt(prev => prev ? {...prev, city: detectedCity} : null);
                        showToast(`Reçu enregistré dans ${detectedCity}`, 'success');
                      },
                    },
                  ],
                );
              } else {
                // Same city, just set it
                await receiptStorageService.updateReceiptCity(receiptDoc.id, userId, detectedCity);
                setReceipt(prev => prev ? {...prev, city: detectedCity} : null);
              }
            } else {
              // No city detected, use user's default
              const userProfile = await authService.getUserProfile(userId);
              const userCity = userProfile?.defaultCity;
              if (userCity) {
                await receiptStorageService.updateReceiptCity(receiptDoc.id, userId, userCity);
                setReceipt(prev => prev ? {...prev, city: userCity} : null);
              }
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
  }, [receiptId]);

  const handleCompare = () => {
    navigation.navigate('PriceComparison', {receiptId});
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Spinner size="large" color={COLORS.primary[500]} />
          <Text style={styles.loadingText}>Chargement du reçu...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !receipt) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.errorIcon}>❌</Text>
          <Text style={styles.errorText}>{error || 'Reçu non trouvé'}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => navigation.goBack()}>
            <Text style={styles.retryButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}>
        {/* Store Header */}
        <View style={styles.storeHeader}>
          <Text style={styles.storeIcon}>🏪</Text>
          <Text style={styles.storeName}>{receipt.storeName}</Text>
          <Text style={styles.receiptDate}>
            {formatDate(receipt.date, 'long')}
          </Text>
        </View>

        {/* Items List */}
        <View style={styles.itemsSection}>
          <Text style={styles.sectionTitle}>
            Articles ({receipt.items.length})
          </Text>

          {receipt.items.map((item, index) => (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemMain}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemMeta}>
                    {item.quantity} ×{' '}
                    {formatCurrency(item.unitPrice, receipt.currency)}
                  </Text>
                  {item.category && (
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryText}>{item.category}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.itemPrice}>
                  {formatCurrency(item.totalPrice, receipt.currency)}
                </Text>
              </View>

              {/* Confidence indicator */}
              <View style={styles.confidenceBar}>
                <View
                  style={[
                    styles.confidenceFill,
                    {width: `${item.confidence * 100}%`},
                  ]}
                />
              </View>
            </View>
          ))}
        </View>

        {/* Total */}
        <View style={styles.totalSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>
              {formatCurrency(receipt.total, receipt.currency)}
            </Text>
          </View>
        </View>

        {/* Compare Prices CTA */}
        <TouchableOpacity
          style={styles.compareButton}
          onPress={handleCompare}
          activeOpacity={0.8}>
          <Text style={styles.compareIcon}>📊</Text>
          <View style={styles.compareTextContainer}>
            <Text style={styles.compareTitle}>Comparer les prix</Text>
            <Text style={styles.compareDesc}>
              Voir si vous avez payé le meilleur prix
            </Text>
          </View>
          <Text style={styles.compareArrow}>→</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  storeHeader: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  storeIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  storeName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.gray[900],
    marginBottom: 4,
    textAlign: 'center',
  },
  receiptDate: {
    fontSize: 14,
    color: COLORS.gray[500],
  },
  itemsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.gray[700],
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  itemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  itemMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.gray[900],
    marginBottom: 4,
  },
  itemMeta: {
    fontSize: 14,
    color: COLORS.gray[500],
    marginBottom: 8,
  },
  categoryBadge: {
    backgroundColor: COLORS.primary[50],
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  categoryText: {
    fontSize: 12,
    color: COLORS.primary[700],
    fontWeight: '500',
  },
  itemPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.gray[900],
  },
  confidenceBar: {
    height: 3,
    backgroundColor: COLORS.gray[200],
    borderRadius: 2,
    marginTop: 12,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: COLORS.primary[500],
    borderRadius: 2,
  },
  totalSection: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.gray[700],
  },
  totalAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary[500],
  },
  compareButton: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary[200],
  },
  compareIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  compareTextContainer: {
    flex: 1,
  },
  compareTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.gray[900],
    marginBottom: 2,
  },
  compareDesc: {
    fontSize: 13,
    color: COLORS.gray[500],
  },
  compareArrow: {
    fontSize: 24,
    color: COLORS.primary[500],
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.gray[600],
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.gray[600],
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: COLORS.primary[500],
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
