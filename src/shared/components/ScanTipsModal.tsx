/**
 * Scan Tips Modal
 * Simple modal showing general scanning tips
 * Replaces Alert.alert for better UX consistency
 */

import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ScrollView} from 'react-native';
import Icon from '@/shared/components/Icon';
import {Colors, Typography, Spacing} from '@/shared/theme/theme';
import {AnimatedModal} from './AnimatedModal';

interface ScanTipsModalProps {
  visible: boolean;
  onClose: () => void;
  variant?: 'general' | 'error';
}

export default function ScanTipsModal({
  visible,
  onClose,
  variant = 'general',
}: ScanTipsModalProps) {

  return (
    <AnimatedModal
      visible={visible}
      onClose={onClose}
      variant="centered"
      overlayOpacity={0.6}>
      <View style={styles.outerContainer}>
        <View style={styles.modal}>
          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Icon */}
            <View style={styles.iconContainer}>
              <View style={styles.iconOuter}>
                <View style={styles.iconInner}>
                  <Icon name="help-circle" size="xl" color={Colors.primary} />
                </View>
              </View>
            </View>

            {/* Title */}
            <Text style={styles.title}>
              {variant === 'error' ? '💡 Conseils pour un meilleur scan' : 'Conseils'}
            </Text>

            {/* Tips Container */}
            <View style={styles.tipsContainer}>
              <View style={styles.tipRow}>
                <Icon name="check-circle" size="sm" color={Colors.status.success} />
                <Text style={styles.tipText}>Photo nette et bien éclairée</Text>
              </View>
              <View style={styles.tipRow}>
                <Icon name="check-circle" size="sm" color={Colors.status.success} />
                <Text style={styles.tipText}>Reçu complet visible</Text>
              </View>
              <View style={styles.tipRow}>
                <Icon name="check-circle" size="sm" color={Colors.status.success} />
                <Text style={styles.tipText}>Évitez reflets et ombres</Text>
              </View>
              <View style={styles.tipRow}>
                <Icon name="check-circle" size="sm" color={Colors.status.success} />
                <Text style={styles.tipText}>Mode vidéo pour longs reçus</Text>
              </View>
              {variant === 'error' && (
                <>
                  <View style={styles.tipRow}>
                    <Icon name="check-circle" size="sm" color={Colors.status.success} />
                    <Text style={styles.tipText}>Assurez-vous que la photo est bien éclairée</Text>
                  </View>
                  <View style={styles.tipRow}>
                    <Icon name="check-circle" size="sm" color={Colors.status.success} />
                    <Text style={styles.tipText}>Le reçu doit être entièrement visible</Text>
                  </View>
                  <View style={styles.tipRow}>
                    <Icon name="check-circle" size="sm" color={Colors.status.success} />
                    <Text style={styles.tipText}>Pour les longs reçus, utilisez le mode vidéo</Text>
                  </View>
                </>
              )}
            </View>

            {/* Action Button */}
            <TouchableOpacity style={styles.primaryButton} onPress={onClose}>
              <Text style={styles.primaryButtonText}>Compris</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </AnimatedModal>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    backgroundColor: '#003049', // Cosmos Blue
    borderRadius: 28,
    padding: 4,
    width: '100%',
    maxWidth: 380,
  },
  modal: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    width: '100%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  scrollContent: {
    padding: 28,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 20,
  },
  iconOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#003049', // Cosmos Blue
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#C1121F', // Crimson Blaze
  },
  iconInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#C1121F', // Crimson Blaze
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: 24,
  },
  tipsContainer: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 16,
    padding: 16,
    width: '100%',
    marginBottom: 24,
    gap: 12,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: '#C1121F', // Crimson Blaze
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#C1121F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.white,
  },
});
