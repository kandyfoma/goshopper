/**
 * Offline Sync Status Badge
 * 
 * Shows pending offline scans count and sync status.
 * Displays in the header or as a floating indicator.
 */

import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useOfflineMode} from '@/shared/contexts';
import Icon from './Icon';
import {Colors, Typography, Spacing, BorderRadius, Shadows} from '@/shared/theme/theme';
import {RootStackParamList} from '@/shared/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface OfflineSyncBadgeProps {
  showLabel?: boolean;
  size?: 'small' | 'medium' | 'large';
  onPress?: () => void;
}

export function OfflineSyncBadge({
  showLabel = false,
  size = 'medium',
  onPress,
}: OfflineSyncBadgeProps): React.JSX.Element | null {
  const navigation = useNavigation<NavigationProp>();
  const {isOnline, pendingCount, isSyncing, hasOfflineAccess, syncNow} = useOfflineMode();
  
  const [pulseAnim] = useState(() => new Animated.Value(1));

  // Pulse animation when there are pending items
  useEffect(() => {
    if (pendingCount > 0 && !isSyncing) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [pendingCount, isSyncing, pulseAnim]);

  // Don't show if user doesn't have offline access or no pending items
  if (!hasOfflineAccess || pendingCount === 0) {
    return null;
  }

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (isOnline && pendingCount > 0) {
      syncNow();
    }
  };

  const iconSizeMap = {small: 'sm' as const, medium: 'md' as const, large: 'lg' as const};
  const iconSize = iconSizeMap[size];
  const badgeSize = size === 'small' ? 14 : size === 'large' ? 22 : 18;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Animated.View
        style={[
          styles.badge,
          size === 'small' && styles.badgeSmall,
          size === 'large' && styles.badgeLarge,
          !isOnline && styles.badgeOffline,
          {transform: [{scale: pulseAnim}]},
        ]}
      >
        {isSyncing ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Icon
              name={isOnline ? 'refresh-cw' : 'cloud-off'}
              size={iconSize}
              color="#FFFFFF"
            />
            <View style={[styles.countBadge, {width: badgeSize, height: badgeSize}]}>
              <Text style={[styles.countText, size === 'small' && styles.countTextSmall]}>
                {pendingCount > 9 ? '9+' : pendingCount}
              </Text>
            </View>
          </>
        )}
      </Animated.View>
      
      {showLabel && (
        <Text style={styles.label}>
          {isSyncing
            ? 'Synchronisation...'
            : isOnline
            ? 'Synchroniser'
            : 'Hors ligne'}
        </Text>
      )}
    </TouchableOpacity>
  );
}

/**
 * Floating Offline Sync Banner
 * Shows at the top of screens when there are pending offline scans
 */
export function OfflineSyncBanner(): React.JSX.Element | null {
  const {isOnline, pendingCount, isSyncing, hasOfflineAccess, syncNow} = useOfflineMode();
  const [slideAnim] = useState(() => new Animated.Value(-100));

  useEffect(() => {
    if (hasOfflineAccess && pendingCount > 0) {
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [pendingCount, hasOfflineAccess, slideAnim]);

  if (!hasOfflineAccess || pendingCount === 0) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.banner,
        isOnline ? styles.bannerOnline : styles.bannerOffline,
        {transform: [{translateY: slideAnim}]},
      ]}
    >
      <View style={styles.bannerContent}>
        {isSyncing ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Icon
            name={isOnline ? 'cloud' : 'cloud-off'}
            size="sm"
            color="#FFFFFF"
          />
        )}
        <Text style={styles.bannerText}>
          {isSyncing
            ? 'Synchronisation en cours...'
            : isOnline
            ? `${pendingCount} reçu${pendingCount > 1 ? 's' : ''} en attente`
            : `${pendingCount} reçu${pendingCount > 1 ? 's' : ''} hors ligne`}
        </Text>
      </View>
      
      {isOnline && !isSyncing && (
        <TouchableOpacity
          style={styles.syncButton}
          onPress={syncNow}
          activeOpacity={0.7}
        >
          <Text style={styles.syncButtonText}>Synchroniser</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card.blue,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  badgeSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  badgeLarge: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  badgeOffline: {
    backgroundColor: Colors.status.warning,
  },
  countBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.card.red,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  countText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
    color: '#FFFFFF',
  },
  countTextSmall: {
    fontSize: 8,
  },
  label: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.secondary,
    marginLeft: Spacing.xs,
  },
  // Banner styles
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    zIndex: 1000,
  },
  bannerOnline: {
    backgroundColor: Colors.card.blue,
  },
  bannerOffline: {
    backgroundColor: Colors.status.warning,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  bannerText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: '#FFFFFF',
  },
  syncButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  syncButtonText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: '#FFFFFF',
  },
});

export default OfflineSyncBadge;
