/**
 * Scan Pack Purchase Screen
 * Allows users to buy additional scans when they run out
 */

import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {RouteProp, useNavigation, useRoute} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useSubscription, usePaymentProcessing} from '@/shared/contexts';
import {RootStackParamList} from '@/shared/types';
import {SCAN_PACKS} from '@/shared/types/scanPacks.types';
import Icon from '@/shared/components/Icon';

type ScanPacksScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ScanPacks'>;
type ScanPacksScreenRouteProp = RouteProp<RootStackParamList, 'ScanPacks'>;

export default function ScanPacksScreen() {
  const navigation = useNavigation<ScanPacksScreenNavigationProp>();
  const route = useRoute<ScanPacksScreenRouteProp>();
  const {subscription, scansRemaining} = useSubscription();
  const {startPayment} = usePaymentProcessing();
  const [selectedPack, setSelectedPack] = useState<string | null>('medium');
  const [loading, setLoading] = useState(false);

  const handlePurchase = async () => {
    if (!selectedPack) return;

    const pack = SCAN_PACKS[selectedPack as keyof typeof SCAN_PACKS];
    
    // Navigate to payment flow with scan pack details
    navigation.navigate('SubscriptionDuration', {
      planId: 'basic',
      isScanPack: true,
      scanPackId: pack.id,
      scanPackScans: pack.scans,
      scanPackPrice: pack.price,
    });
  };

  const packs = Object.values(SCAN_PACKS);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size="md" color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Acheter des Scans</Text>
      </View>

      {/* Current Status */}
      <View style={styles.statusCard}>
        <Icon name="zap" size="lg" color="#FF6B35" />
        <Text style={styles.statusTitle}>Scans Restants</Text>
        <Text style={styles.statusCount}>{scansRemaining === -1 ? '∞' : scansRemaining}</Text>
        {scansRemaining === 0 && (
          <Text style={styles.statusWarning}>
            Vous avez épuisé vos scans mensuels
          </Text>
        )}
      </View>

      {/* Emergency Scans Info */}
      {scansRemaining === 0 && (
        <View style={styles.emergencyInfo}>
          <Icon name="gift" size="sm" color="#4CAF50" />
          <Text style={styles.emergencyText}>
            🎁 3 scans d'urgence gratuits disponibles après l'achat!
          </Text>
        </View>
      )}

      {/* Scan Packs */}
      <View style={styles.packsSection}>
        <Text style={styles.sectionTitle}>Choisissez un Pack</Text>
        {packs.map((pack) => (
          <TouchableOpacity
            key={pack.id}
            style={[
              styles.packCard,
              selectedPack === pack.id && styles.packCardSelected,
              pack.popular && styles.packCardPopular,
            ]}
            onPress={() => setSelectedPack(pack.id)}>
            {pack.popular && (
              <View style={styles.popularBadge}>
                <Text style={styles.popularText}>POPULAIRE</Text>
              </View>
            )}
            <View style={styles.packHeader}>
              <Text style={styles.packName}>{pack.name}</Text>
              <Text style={styles.packScans}>{pack.scans} scans</Text>
            </View>
            <View style={styles.packPricing}>
              <Text style={styles.packPrice}>${pack.price.toFixed(2)}</Text>
              <Text style={styles.packPriceCDF}>{pack.priceCDF} CDF</Text>
            </View>
            <Text style={styles.packValue}>
              ${(pack.price / pack.scans).toFixed(2)} par scan
            </Text>
            {selectedPack === pack.id && (
              <View style={styles.checkmark}>
                <Icon name="check-circle" size="md" color="#4CAF50" />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Purchase Button */}
      <TouchableOpacity
        style={[styles.purchaseButton, !selectedPack && styles.purchaseButtonDisabled]}
        onPress={handlePurchase}
        disabled={!selectedPack || loading}>
        {loading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <>
            <Text style={styles.purchaseButtonText}>Continuer</Text>
            <Icon name="arrow-right" size="sm" color="#FFF" />
          </>
        )}
      </TouchableOpacity>

      {/* Alternative */}
      <TouchableOpacity
        style={styles.upgradeLink}
        onPress={() => navigation.navigate('Subscription')}>
        <Text style={styles.upgradeLinkText}>
          Ou passez à un plan supérieur pour plus de scans mensuels
        </Text>
        <Icon name="arrow-right" size="xs" color="#FF6B35" />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  statusCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statusTitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  statusCount: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginTop: 8,
  },
  statusWarning: {
    fontSize: 14,
    color: '#F44336',
    marginTop: 8,
    textAlign: 'center',
  },
  emergencyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  emergencyText: {
    fontSize: 14,
    color: '#2E7D32',
    marginLeft: 12,
    flex: 1,
  },
  packsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  packCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    position: 'relative',
  },
  packCardSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#F1F8F4',
  },
  packCardPopular: {
    borderColor: '#FF6B35',
  },
  popularBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#FF6B35',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFF',
  },
  packHeader: {
    marginBottom: 12,
  },
  packName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  packScans: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  packPricing: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  packPrice: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginRight: 12,
  },
  packPriceCDF: {
    fontSize: 16,
    color: '#999',
  },
  packValue: {
    fontSize: 14,
    color: '#666',
  },
  checkmark: {
    position: 'absolute',
    bottom: 16,
    right: 16,
  },
  purchaseButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  purchaseButtonDisabled: {
    backgroundColor: '#CCC',
  },
  purchaseButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginRight: 8,
  },
  upgradeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  upgradeLinkText: {
    fontSize: 14,
    color: '#FF6B35',
    marginRight: 8,
    textAlign: 'center',
  },
});
