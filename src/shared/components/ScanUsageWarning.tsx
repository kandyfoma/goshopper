/**
 * Scan Usage Warning Component
 * Shows alerts when scan usage reaches thresholds (80%, 100%, emergency)
 */

import React, {useEffect, useState} from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useSubscription} from '@/shared/contexts';
import {RootStackParamList} from '@/shared/types';
import {PLAN_SCAN_LIMITS} from '@/shared/utils/constants';
import Icon from '@/shared/components/Icon';
import {AnimatedModal} from './AnimatedModal';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ScanUsageWarning() {
  const navigation = useNavigation<NavigationProp>();
  const {subscription, scansRemaining} = useSubscription();
  const [showWarning, setShowWarning] = useState(false);
  const [warningType, setWarningType] = useState<'low' | 'depleted' | 'emergency'>('low');

  useEffect(() => {
    if (!subscription || scansRemaining === -1) return;

    const planLimit = subscription.planId 
      ? PLAN_SCAN_LIMITS[subscription.planId as keyof typeof PLAN_SCAN_LIMITS]
      : 10;
    
    if (planLimit === -1) return; // Unlimited

    const usagePercent = subscription.monthlyScansUsed / planLimit;
    const bonusScans = subscription.bonusScans || 0;
    const emergencyUsed = subscription.emergencyScansUsed || 0;

    // Check thresholds
    if (usagePercent >= 1.0 && bonusScans === 0 && emergencyUsed > 0) {
      // Using emergency scans
      setWarningType('emergency');
      setShowWarning(true);
    } else if (usagePercent >= 1.0 && bonusScans === 0) {
      // Depleted, no bonus
      setWarningType('depleted');
      setShowWarning(true);
    } else if (usagePercent >= 0.8 && !showWarning) {
      // Low (80%+ used)
      setWarningType('low');
      setShowWarning(true);
    }
  }, [subscription, scansRemaining]);

  const handleBuyScanPack = () => {
    setShowWarning(false);
    navigation.navigate('Subscription');
  };

  const handleUpgrade = () => {
    setShowWarning(false);
    navigation.navigate('Subscription');
  };

  const getWarningContent = () => {
    switch (warningType) {
      case 'low':
        return {
          icon: 'alert-triangle',
          iconColor: '#FF9800',
          title: 'Scans Presque Épuisés',
          message: `Il vous reste ${scansRemaining} scans. Achetez un pack ou passez à un plan supérieur.`,
          primaryAction: 'Acheter des Scans',
          secondaryAction: 'Voir les Plans',
        };
      case 'depleted':
        return {
          icon: 'x-circle',
          iconColor: '#F44336',
          title: 'Limite Atteinte',
          message: 'Vous avez épuisé vos scans mensuels. 🎁 3 scans d\'urgence gratuits disponibles!',
          primaryAction: 'Acheter des Scans',
          secondaryAction: 'Passer au Premium',
        };
      case 'emergency':
        return {
          icon: 'alert-octagon',
          iconColor: '#F44336',
          title: 'Scans d\'Urgence Utilisés',
          message: `Vous utilisez vos scans d'urgence gratuits (${3 - (subscription?.emergencyScansUsed || 0)} restants). Achetez un pack maintenant!`,
          primaryAction: 'Acheter Maintenant',
          secondaryAction: 'Annuler',
        };
    }
  };

  if (!showWarning) return null;

  const content = getWarningContent();

  return (
    <AnimatedModal
      visible={showWarning}
      onClose={() => setShowWarning(false)}
      variant="centered"
      overlayOpacity={0.5}>
      <View style={styles.modal}>
          <View style={[styles.iconContainer, {backgroundColor: content.iconColor + '20'}]}>
            <Icon name={content.icon} size="xl" color={content.iconColor} />
          </View>
          
          <Text style={styles.title}>{content.title}</Text>
          <Text style={styles.message}>{content.message}</Text>

          <TouchableOpacity style={styles.primaryButton} onPress={handleBuyScanPack}>
            <Text style={styles.primaryButtonText}>{content.primaryAction}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.secondaryButton} 
            onPress={warningType === 'emergency' ? () => setShowWarning(false) : handleUpgrade}>
            <Text style={styles.secondaryButtonText}>{content.secondaryAction}</Text>
          </TouchableOpacity>
      </View>
    </AnimatedModal>
  );
}

const styles = StyleSheet.create({
  modal: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  secondaryButton: {
    padding: 12,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    color: '#FF6B35',
  },
});
