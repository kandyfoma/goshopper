// Global Scan Result Modal - Shows scan completion modal anywhere in the app
// Appears when background scan processing completes
// Bottom sheet style modal that slides up from the bottom
import React, {useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Animated,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Icon} from '@/shared/components';
import {Colors, Typography, Spacing, Shadows} from '@/shared/theme/theme';
import {useScanProcessing} from '@/shared/contexts/ScanProcessingContext';
import {formatCurrency} from '@/shared/utils/helpers';
import {hapticService} from '@/shared/services/hapticService';
import {RootStackParamList} from '@/shared/types';

const {width, height} = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function GlobalScanResultModal() {
  const navigation = useNavigation<NavigationProp>();
  const {state, isAwaitingConfirmation, dismiss} = useScanProcessing();
  
  // Animation refs
  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const iconScaleAnim = useRef(new Animated.Value(0)).current;
  const iconPulseAnim = useRef(new Animated.Value(1)).current;
  
  // Entrance animation
  useEffect(() => {
    if (isAwaitingConfirmation) {
      hapticService.success(); // Haptic feedback on appearance
      
      // Slide up from bottom
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
      ]).start(() => {
        // Icon pop animation after slide
        Animated.spring(iconScaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 6,
        }).start();
        
        // Subtle pulse animation on icon
        Animated.loop(
          Animated.sequence([
            Animated.timing(iconPulseAnim, {
              toValue: 1.05,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(iconPulseAnim, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
          ])
        ).start();
      });
    } else {
      // Reset animations when modal closes
      slideAnim.setValue(height);
      fadeAnim.setValue(0);
      iconScaleAnim.setValue(0);
      iconPulseAnim.setValue(1);
    }
  }, [isAwaitingConfirmation, slideAnim, fadeAnim, iconScaleAnim, iconPulseAnim]);
  
  if (!isAwaitingConfirmation || !state.receipt) {
    return null;
  }
  
  const receipt = state.receipt;
  const itemCount = receipt.items?.length || 0;
  const storeName = receipt.storeName || 'Magasin';
  const total = receipt.total || 0;
  const currency = receipt.currency || 'CDF';
  
  const handleViewReceipt = () => {
    hapticService.selection();
    const receiptId = state.receiptId;
    
    // Slide down animation before dismissing
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      dismiss();
      if (receiptId) {
        navigation.navigate('ReceiptDetail', {receiptId});
      }
    });
  };
  
  const handleDismiss = () => {
    hapticService.selection();
    
    // Slide down animation
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      dismiss();
    });
  };
  
  return (
    <Modal
      visible={true}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}>
      <View style={styles.container}>
        {/* Backdrop */}
        <Animated.View 
          style={[styles.backdrop, {opacity: fadeAnim}]}>
          <TouchableOpacity 
            style={styles.backdropTouch} 
            onPress={handleDismiss}
            activeOpacity={1}
          />
        </Animated.View>
        
        {/* Bottom Sheet */}
        <Animated.View 
          style={[
            styles.bottomSheet,
            {
              transform: [{translateY: slideAnim}],
            }
          ]}>
          {/* Handle bar */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>
          
          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={handleDismiss}>
            <Icon name="x" size="sm" color={Colors.text.tertiary} />
          </TouchableOpacity>
          
          {/* Content */}
          <View style={styles.content}>
            {/* Success Icon with glow effect */}
            <Animated.View 
              style={[
                styles.iconContainer,
                {
                  transform: [
                    {scale: Animated.multiply(iconScaleAnim, iconPulseAnim)}
                  ],
                }
              ]}>
              <View style={styles.iconGlow} />
              <View style={styles.iconInner}>
                <Icon name="check" size="xl" color="#1A1A1A" />
              </View>
            </Animated.View>
            
            {/* Title */}
            <Text style={styles.title}>Succès !</Text>
            
            {/* Subtitle */}
            <Text style={styles.subtitle}>
              Votre <Text style={styles.highlightText}>reçu</Text> a été ajouté avec succès
            </Text>
            
            {/* Receipt Summary Card */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryIconContainer}>
                  <Icon name="shopping-bag" size="sm" color={Colors.primary} />
                </View>
                <View style={styles.summaryTextContainer}>
                  <Text style={styles.summaryLabel}>Magasin</Text>
                  <Text style={styles.summaryValue} numberOfLines={1}>{storeName}</Text>
                </View>
              </View>
              
              <View style={styles.summaryDivider} />
              
              <View style={styles.summaryRow}>
                <View style={styles.summaryIconContainer}>
                  <Icon name="package" size="sm" color={Colors.primary} />
                </View>
                <View style={styles.summaryTextContainer}>
                  <Text style={styles.summaryLabel}>Articles</Text>
                  <Text style={styles.summaryValue}>{itemCount} article{itemCount > 1 ? 's' : ''}</Text>
                </View>
              </View>
              
              <View style={styles.summaryDivider} />
              
              <View style={styles.summaryRow}>
                <View style={styles.summaryIconContainer}>
                  <Icon name="credit-card" size="sm" color={Colors.primary} />
                </View>
                <View style={styles.summaryTextContainer}>
                  <Text style={styles.summaryLabel}>Total</Text>
                  <Text style={styles.summaryValueLarge}>{formatCurrency(total, currency)}</Text>
                </View>
              </View>
            </View>
            
            {/* Done Button */}
            <TouchableOpacity
              style={styles.doneButton}
              onPress={handleViewReceipt}
              activeOpacity={0.8}>
              <Text style={styles.doneButtonText}>Voir le reçu</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  backdropTouch: {
    flex: 1,
  },
  bottomSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    minHeight: height * 0.75,
    maxHeight: height * 0.85,
    paddingBottom: 34, // Safe area
    ...Shadows.lg,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border.light,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  iconContainer: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  iconGlow: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#D4F400',
    opacity: 0.3,
  },
  iconInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#D4F400',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  highlightText: {
    color: Colors.primary,
    fontFamily: Typography.fontFamily.semiBold,
  },
  doneButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 100,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
    width: '100%',
  },
  doneButtonText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.white,
  },
  summaryCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 20,
    padding: Spacing.md,
    width: '100%',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  summaryIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  summaryTextContainer: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.primary,
  },
  summaryValueLarge: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.border.light,
    marginVertical: Spacing.xs,
  },
});
