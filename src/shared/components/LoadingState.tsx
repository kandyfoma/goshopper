// LoadingState - Unified Loading Component
// Provides consistent loading states across the entire app
import React, {useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import {Colors, Typography, Spacing} from '../theme/theme';

// ===== TYPE DEFINITIONS =====

type LoadingVariant = 'fullscreen' | 'inline' | 'overlay' | 'search' | 'skeleton';
type LoadingSize = 'small' | 'medium' | 'large';
type SkeletonType = 'list' | 'grid' | 'detail' | 'card';

interface BilingualMessage {
  french: string;
  lingala: string;
}

interface LoadingStateProps {
  /** Loading variant - determines layout and behavior */
  variant?: LoadingVariant;
  
  /** Spinner size */
  size?: LoadingSize;
  
  /** Loading message (single language) */
  message?: string;
  
  /** Bilingual message (French + Lingala) */
  bilingualMessage?: BilingualMessage;
  
  /** Custom spinner color (defaults to theme primary) */
  color?: string;
  
  /** Progress value for determinate loading (0-1) */
  progress?: number;
  
  /** Skeleton type (only for skeleton variant) */
  skeletonType?: SkeletonType;
  
  /** Custom container style */
  style?: ViewStyle;
  
  /** Visibility control (for overlay variant) */
  visible?: boolean;
}

// ===== STANDARD MESSAGES =====

export const STANDARD_MESSAGES = {
  loading: {french: 'Chargement...', lingala: 'Eza ko charger...'},
  creating: {french: 'Création...', lingala: 'Eza ko créer...'},
  updating: {french: 'Mise à jour...', lingala: 'Eza ko mettre à jour...'},
  deleting: {french: 'Suppression...', lingala: 'Eza ko supprimer...'},
  searching: {french: 'Recherche...', lingala: 'Eza ko luka...'},
  saving: {french: 'Enregistrement...', lingala: 'Eza ko bamba...'},
  processing: {french: 'Traitement...', lingala: 'Eza ko traiter...'},
};

// ===== LOADING STATE COMPONENT =====

export function LoadingState({
  variant = 'inline',
  size = 'medium',
  message,
  bilingualMessage,
  color = Colors.primary,
  progress,
  skeletonType = 'list',
  style,
  visible = true,
}: LoadingStateProps) {
  // Don't render if not visible (for overlay variant)
  if (variant === 'overlay' && !visible) {
    return null;
  }

  // Render appropriate variant
  switch (variant) {
    case 'fullscreen':
      return (
        <FullScreenLoading
          size={size}
          message={message}
          bilingualMessage={bilingualMessage}
          color={color}
          style={style}
        />
      );
    case 'overlay':
      return (
        <OverlayLoading
          size={size}
          message={message}
          bilingualMessage={bilingualMessage}
          color={color}
          style={style}
        />
      );
    case 'inline':
      return (
        <InlineLoading
          size={size}
          message={message}
          color={color}
          style={style}
        />
      );
    case 'search':
      return <SearchLoading color={color} style={style} />;
    case 'skeleton':
      return <SkeletonLoading type={skeletonType} style={style} />;
    default:
      return (
        <InlineLoading
          size={size}
          message={message}
          color={color}
          style={style}
        />
      );
  }
}

// ===== FULLSCREEN LOADING =====

interface FullScreenLoadingProps {
  size: LoadingSize;
  message?: string;
  bilingualMessage?: BilingualMessage;
  color: string;
  style?: ViewStyle;
}

function FullScreenLoading({
  size,
  message,
  bilingualMessage,
  color,
  style,
}: FullScreenLoadingProps) {
  return (
    <View style={[styles.fullscreenContainer, style]}>
      <Spinner size={size} color={color} />
      {(message || bilingualMessage) && (
        <View style={styles.fullscreenMessageContainer}>
          {bilingualMessage ? (
            <>
              <Text style={styles.fullscreenMessagePrimary}>
                {bilingualMessage.french}
              </Text>
              <Text style={styles.fullscreenMessageSecondary}>
                {bilingualMessage.lingala}
              </Text>
            </>
          ) : (
            <Text style={styles.fullscreenMessagePrimary}>{message}</Text>
          )}
        </View>
      )}
    </View>
  );
}

// ===== OVERLAY LOADING =====

interface OverlayLoadingProps {
  size: LoadingSize;
  message?: string;
  bilingualMessage?: BilingualMessage;
  color: string;
  style?: ViewStyle;
}

function OverlayLoading({
  size,
  message,
  bilingualMessage,
  color,
  style,
}: OverlayLoadingProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  return (
    <Animated.View style={[styles.overlayBackdrop, {opacity: fadeAnim}, style]}>
      <View style={styles.overlayCard}>
        <Spinner size={size} color={color} />
        {(message || bilingualMessage) && (
          <View style={styles.overlayMessageContainer}>
            {bilingualMessage ? (
              <>
                <Text style={styles.overlayMessagePrimary}>
                  {bilingualMessage.french}
                </Text>
                <Text style={styles.overlayMessageSecondary}>
                  {bilingualMessage.lingala}
                </Text>
              </>
            ) : (
              <Text style={styles.overlayMessagePrimary}>{message}</Text>
            )}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

// ===== INLINE LOADING =====

interface InlineLoadingProps {
  size: LoadingSize;
  message?: string;
  color: string;
  style?: ViewStyle;
}

function InlineLoading({size, message, color, style}: InlineLoadingProps) {
  return (
    <View style={[styles.inlineContainer, style]}>
      <Spinner size={size} color={color} />
      {message && <Text style={styles.inlineMessage}>{message}</Text>}
    </View>
  );
}

// ===== SEARCH LOADING =====

interface SearchLoadingProps {
  color: string;
  style?: ViewStyle;
}

function SearchLoading({color, style}: SearchLoadingProps) {
  return (
    <View style={[styles.searchContainer, style]}>
      <Spinner size="small" color={color} />
      <Text style={styles.searchMessage}>Recherche...</Text>
    </View>
  );
}

// ===== SKELETON LOADING =====

interface SkeletonLoadingProps {
  type: SkeletonType;
  style?: ViewStyle;
}

function SkeletonLoading({type, style}: SkeletonLoadingProps) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [shimmerAnim]);

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  // Render skeleton based on type
  switch (type) {
    case 'list':
      return (
        <View style={[styles.skeletonContainer, style]}>
          {[1, 2, 3, 4, 5].map(i => (
            <Animated.View
              key={i}
              style={[styles.skeletonListItem, {opacity: shimmerOpacity}]}
            />
          ))}
        </View>
      );
    case 'grid':
      return (
        <View style={[styles.skeletonContainer, style]}>
          <View style={styles.skeletonGrid}>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Animated.View
                key={i}
                style={[styles.skeletonGridItem, {opacity: shimmerOpacity}]}
              />
            ))}
          </View>
        </View>
      );
    case 'detail':
      return (
        <View style={[styles.skeletonContainer, style]}>
          <Animated.View
            style={[styles.skeletonDetailHeader, {opacity: shimmerOpacity}]}
          />
          <Animated.View
            style={[styles.skeletonDetailContent, {opacity: shimmerOpacity}]}
          />
          <Animated.View
            style={[styles.skeletonDetailContent, {opacity: shimmerOpacity}]}
          />
        </View>
      );
    case 'card':
      return (
        <View style={[styles.skeletonContainer, style]}>
          {[1, 2, 3].map(i => (
            <Animated.View
              key={i}
              style={[styles.skeletonCard, {opacity: shimmerOpacity}]}
            />
          ))}
        </View>
      );
    default:
      return null;
  }
}

// ===== SPINNER COMPONENT =====

interface SpinnerProps {
  size: LoadingSize;
  color: string;
}

function Spinner({size, color}: SpinnerProps) {
  // Use native ActivityIndicator for better performance and stability
  const getActivityIndicatorSize = () => {
    switch (size) {
      case 'small':
        return 'small' as const;
      case 'large':
        return 'large' as const;
      default:
        return 'small' as const;
    }
  };

  return (
    <ActivityIndicator
      size={getActivityIndicatorSize()}
      color={color}
    />
  );
}

// ===== STYLES =====

const styles = StyleSheet.create({
  // Fullscreen variant
  fullscreenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background.primary,
  },
  fullscreenMessageContainer: {
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  fullscreenMessagePrimary: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.medium,
    lineHeight: Typography.fontSize.lg * Typography.lineHeight.normal,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  fullscreenMessageSecondary: {
    fontSize: Typography.fontSize.sm,
    lineHeight: Typography.fontSize.sm * Typography.lineHeight.normal,
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },

  // Overlay variant
  overlayBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  overlayCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: 16,
    padding: Spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
    minWidth: 200,
  },
  overlayMessageContainer: {
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  overlayMessagePrimary: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.medium,
    lineHeight: Typography.fontSize.base * Typography.lineHeight.normal,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  overlayMessageSecondary: {
    fontSize: Typography.fontSize.sm,
    lineHeight: Typography.fontSize.sm * Typography.lineHeight.normal,
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },

  // Inline variant
  inlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
  },
  inlineMessage: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.medium,
    lineHeight: Typography.fontSize.base * Typography.lineHeight.normal,
    color: Colors.text.secondary,
    marginLeft: Spacing.md,
  },

  // Search variant
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
  },
  searchMessage: {
    fontSize: Typography.fontSize.sm,
    lineHeight: Typography.fontSize.sm * Typography.lineHeight.normal,
    color: Colors.text.tertiary,
    marginLeft: Spacing.sm,
  },

  // Spinner
  spinner: {
    borderWidth: 3,
    borderRadius: 50,
    borderTopColor: 'transparent',
  },

  // Skeleton variant
  skeletonContainer: {
    padding: Spacing.md,
  },
  skeletonListItem: {
    height: 80,
    backgroundColor: Colors.border.light,
    borderRadius: 12,
    marginBottom: Spacing.md,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  skeletonGridItem: {
    width: '48%',
    height: 120,
    backgroundColor: Colors.border.light,
    borderRadius: 12,
    marginBottom: Spacing.md,
  },
  skeletonDetailHeader: {
    height: 200,
    backgroundColor: Colors.border.light,
    borderRadius: 12,
    marginBottom: Spacing.lg,
  },
  skeletonDetailContent: {
    height: 60,
    backgroundColor: Colors.border.light,
    borderRadius: 8,
    marginBottom: Spacing.md,
  },
  skeletonCard: {
    height: 100,
    backgroundColor: Colors.border.light,
    borderRadius: 12,
    marginBottom: Spacing.md,
  },
});

// ===== EXPORTS =====

export default LoadingState;
