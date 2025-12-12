// Unified Scanner Screen - Animated & Interactive Receipt Scanner
// Combines single and multi-photo scanning with entertaining UX
import React, {useState, useCallback, useRef, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  SafeAreaView,
  Animated,
  Easing,
  Dimensions,
  StatusBar,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '@/shared/types';
import {useSubscription, useAuth} from '@/shared/contexts';
import {useToast} from '@/shared/contexts';
import {cameraService, imageCompressionService} from '@/shared/services/camera';
import {geminiService} from '@/shared/services/ai/gemini';
import {analyticsService} from '@/shared/services/analytics';
import {duplicateDetectionService} from '@/shared/services/duplicateDetection';
import {offlineQueueService} from '@/shared/services/firebase';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {Icon} from '@/shared/components';
import functions from '@react-native-firebase/functions';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface CapturedPhoto {
  id: string;
  uri: string;
  base64?: string;
}

type ScanState = 'idle' | 'capturing' | 'reviewing' | 'processing' | 'success' | 'error';

const MAX_PHOTOS = 5;
const MAX_RETRY_ATTEMPTS = 3;

// Fun loading messages
const LOADING_MESSAGES = [
  {emoji: '🔍', text: 'Recherche du ticket...', subtext: 'Kozela na tiki...'},
  {emoji: '📸', text: 'Analyse de l\'image...', subtext: 'Kotala foto...'},
  {emoji: '🧠', text: 'IA en action...', subtext: 'Intelligence artificielle ezo sebela...'},
  {emoji: '📝', text: 'Extraction des articles...', subtext: 'Kobimisa biloko...'},
  {emoji: '💰', text: 'Calcul des prix...', subtext: 'Kotanga ntalo...'},
  {emoji: '✨', text: 'Presque fini...', subtext: 'Eza pene na kosila...'},
  {emoji: '🎉', text: 'Finalisation...', subtext: 'Eza kosila...'},
];

export function UnifiedScannerScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {user, isAuthenticated} = useAuth();
  const {canScan, recordScan, scansRemaining, isTrialActive} = useSubscription();
  const {showToast} = useToast();

  // State
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [state, setState] = useState<ScanState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const retryCountRef = useRef(0);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigation.navigate('Login');
    }
  }, [isAuthenticated, navigation]);

  // Track screen view
  useEffect(() => {
    analyticsService.logScreenView('UnifiedScanner', 'UnifiedScannerScreen');
    offlineQueueService.init();
    
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
    ]).start();

    return () => {
      offlineQueueService.cleanup();
    };
  }, []);

  // Loading message cycling
  useEffect(() => {
    if (state === 'processing') {
      const interval = setInterval(() => {
        setLoadingMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [state]);

  // Processing animations
  useEffect(() => {
    if (state === 'processing') {
      // Pulse animation
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );

      // Rotation animation
      const rotateAnimation = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );

      // Scan line animation
      const scanAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );

      // Progress animation
      Animated.timing(progressAnim, {
        toValue: 100,
        duration: 15000,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start();

      pulseAnimation.start();
      rotateAnimation.start();
      scanAnimation.start();

      return () => {
        pulseAnimation.stop();
        rotateAnimation.stop();
        scanAnimation.stop();
        progressAnim.setValue(0);
      };
    }
  }, [state]);

  // Success animation
  useEffect(() => {
    if (state === 'success') {
      Animated.sequence([
        Animated.spring(bounceAnim, {
          toValue: 1,
          friction: 3,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      bounceAnim.setValue(0);
    }
  }, [state]);

  // Add photo handler
  const handleAddPhoto = useCallback(async (fromGallery: boolean = false) => {
    if (photos.length >= MAX_PHOTOS) {
      showToast(`Maximum ${MAX_PHOTOS} photos par facture`, 'warning');
      return;
    }

    // Check scan permission
    if (!canScan) {
      analyticsService.logCustomEvent('scan_blocked_subscription');
      Alert.alert(
        'Limite atteinte',
        isTrialActive
          ? 'Passez à Premium pour continuer à scanner.'
          : 'Vous avez atteint votre limite de scans. Passez à Premium pour continuer.',
        [
          {text: 'Annuler', style: 'cancel'},
          {text: 'Voir Premium', onPress: () => navigation.navigate('Subscription')},
        ]
      );
      return;
    }

    setState('capturing');

    const result = fromGallery
      ? await cameraService.selectFromGallery()
      : await cameraService.captureFromCamera();

    if (!result.success || !result.uri) {
      setState(photos.length > 0 ? 'reviewing' : 'idle');
      if (result.error && result.error !== 'Capture annulée') {
        showToast(result.error, 'error');
      }
      return;
    }

    // Compress and convert to base64
    const base64 = await imageCompressionService.compressToBase64(result.uri);

    const newPhoto: CapturedPhoto = {
      id: `photo_${Date.now()}`,
      uri: result.uri,
      base64,
    };

    setPhotos(prev => [...prev, newPhoto]);
    setState('reviewing');

    // Animate new photo entrance
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();

    analyticsService.logCustomEvent('photo_captured', {
      photo_count: photos.length + 1,
      from_gallery: fromGallery,
    });
  }, [photos.length, canScan, isTrialActive, navigation, showToast]);

  // Remove photo
  const handleRemovePhoto = useCallback((photoId: string) => {
    setPhotos(prev => {
      const newPhotos = prev.filter(p => p.id !== photoId);
      if (newPhotos.length === 0) {
        setState('idle');
      }
      return newPhotos;
    });
  }, []);

  // Process photos
  const handleProcess = useCallback(async () => {
    if (photos.length === 0) {
      showToast('Prenez au moins une photo', 'error');
      return;
    }

    setState('processing');
    setError(null);
    setLoadingMessageIndex(0);
    retryCountRef.current = 0;

    try {
      const images = photos.filter(p => p.base64).map(p => p.base64!);

      // Check for duplicates on first image
      if (images.length > 0 && user?.uid) {
        const duplicateCheck = await duplicateDetectionService.checkForDuplicate(
          images[0],
          user.uid
        );

        if (duplicateCheck.isDuplicate && duplicateCheck.confidence > 0.8) {
          const shouldProceed = await new Promise<boolean>(resolve => {
            Alert.alert(
              'Reçu potentiellement dupliqué',
              `Un reçu similaire a été trouvé (${Math.round(duplicateCheck.confidence * 100)}% de similarité). Voulez-vous quand même continuer ?`,
              [
                {text: 'Annuler', style: 'cancel', onPress: () => resolve(false)},
                {text: 'Continuer', onPress: () => resolve(true)},
              ]
            );
          });

          if (!shouldProceed) {
            setState('reviewing');
            return;
          }
        }
      }

      interface ParseReceiptV2Result {
        success: boolean;
        receiptId?: string;
        receipt?: any;
        error?: string;
      }

      let result: ParseReceiptV2Result | undefined;

      if (images.length === 1) {
        // Single photo - use direct Gemini processing
        const response = await geminiService.parseReceipt(
          images[0],
          user?.uid || 'unknown-user'
        );

        if (response.success && response.receipt) {
          await recordScan();
          
          analyticsService.logCustomEvent('scan_completed', {
            success: true,
            photo_count: 1,
            items_count: response.receipt.items?.length || 0,
          });

          setState('success');

          // Navigate after animation
          setTimeout(() => {
            navigation.replace('ReceiptDetail', {
              receiptId: response.receipt!.id,
              receipt: response.receipt,
            });
          }, 2000);
          return;
        } else {
          throw new Error(response.error || 'Échec de l\'analyse');
        }
      } else {
        // Multiple photos - use V2 function
        const parseReceiptV2 = functions().httpsCallable('parseReceiptV2');
        const response = await parseReceiptV2({
          images,
          mimeType: 'image/jpeg',
        });

        result = response.data as ParseReceiptV2Result;

        if (result.success && result.receiptId) {
          await recordScan();

          analyticsService.logCustomEvent('scan_completed', {
            success: true,
            photo_count: images.length,
          });

          setState('success');

          const receiptId = result.receiptId;
          const receipt = result.receipt;
          setTimeout(() => {
            navigation.replace('ReceiptDetail', {
              receiptId: receiptId,
              receipt: receipt,
            });
          }, 2000);
          return;
        } else {
          throw new Error(result.error || 'Échec du traitement');
        }
      }
    } catch (err: any) {
      console.error('Processing error:', err);

      // Auto-retry for transient errors
      const isRetryable = err.message?.includes('timeout') ||
        err.message?.includes('network') ||
        err.message?.includes('503');

      if (isRetryable && retryCountRef.current < MAX_RETRY_ATTEMPTS) {
        retryCountRef.current += 1;
        await new Promise<void>(resolve => setTimeout(resolve, 1000 * retryCountRef.current));
        return handleProcess();
      }

      let userMessage = 'Une erreur est survenue lors de l\'analyse.';
      if (err.message?.includes('Unable to detect receipt')) {
        userMessage = 'Impossible de détecter une facture. Veuillez réessayer avec une photo plus claire.';
      } else if (err.message?.includes('network')) {
        userMessage = 'Pas de connexion internet. Veuillez vérifier votre connexion.';
      }

      setError(userMessage);
      setState('error');

      analyticsService.logCustomEvent('scan_failed', {
        error: err.message,
        photo_count: photos.length,
      });
    }
  }, [photos, user, recordScan, navigation, showToast]);

  // Reset
  const handleReset = useCallback(() => {
    setPhotos([]);
    setState('idle');
    setError(null);
    setLoadingMessageIndex(0);
    progressAnim.setValue(0);
  }, []);

  // Animated values
  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const scanLineY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 150],
  });

  const bounceScale = bounceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  if (!isAuthenticated) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background.primary} />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View 
          style={[
            styles.header,
            {
              opacity: fadeAnim,
              transform: [{translateY: slideAnim}],
            }
          ]}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-left" size="md" color={Colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Scanner</Text>
            {scansRemaining !== undefined && scansRemaining !== Infinity && (
              <View style={styles.scansBadge}>
                <Text style={styles.scansBadgeText}>{scansRemaining} scans</Text>
              </View>
            )}
          </View>
          <View style={styles.headerSpacer} />
        </Animated.View>

        {/* Idle State - Welcome & Instructions */}
        {state === 'idle' && (
          <Animated.View 
            style={[
              styles.idleContainer,
              {
                opacity: fadeAnim,
                transform: [{scale: scaleAnim}],
              }
            ]}
          >
            <View style={styles.illustrationContainer}>
              <Animated.View style={[styles.receiptIcon, {transform: [{scale: pulseAnim}]}]}>
                <Text style={styles.receiptIconText}>🧾</Text>
              </Animated.View>
              <View style={styles.sparkles}>
                <Text style={styles.sparkle}>✨</Text>
                <Text style={[styles.sparkle, styles.sparkleRight]}>✨</Text>
              </View>
            </View>

            <Text style={styles.welcomeTitle}>Scanner votre facture</Text>
            <Text style={styles.welcomeSubtitle}>
              Prenez une ou plusieurs photos de votre ticket
            </Text>
            <Text style={styles.welcomeSubtitleLingala}>
              Zwa foto moko to ebele ya tiki na yo
            </Text>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => handleAddPhoto(false)}
                activeOpacity={0.8}
              >
                <View style={styles.buttonIconContainer}>
                  <Icon name="camera" size="lg" color={Colors.white} />
                </View>
                <View style={styles.buttonTextContainer}>
                  <Text style={styles.primaryButtonText}>Prendre une photo</Text>
                  <Text style={styles.primaryButtonSubtext}>Ouvrir la caméra</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => handleAddPhoto(true)}
                activeOpacity={0.8}
              >
                <View style={styles.buttonIconContainer}>
                  <Icon name="image" size="lg" color={Colors.primary} />
                </View>
                <View style={styles.buttonTextContainer}>
                  <Text style={styles.secondaryButtonText}>Choisir de la galerie</Text>
                  <Text style={styles.secondaryButtonSubtext}>Sélectionner une image</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Tips */}
            <View style={styles.tipsCard}>
              <Text style={styles.tipsTitle}>💡 Conseils pour un meilleur scan</Text>
              <View style={styles.tipItem}>
                <Text style={styles.tipEmoji}>📸</Text>
                <Text style={styles.tipText}>Photo bien éclairée et nette</Text>
              </View>
              <View style={styles.tipItem}>
                <Text style={styles.tipEmoji}>📄</Text>
                <Text style={styles.tipText}>Ticket complet visible</Text>
              </View>
              <View style={styles.tipItem}>
                <Text style={styles.tipEmoji}>🔢</Text>
                <Text style={styles.tipText}>Jusqu'à 5 photos pour les longs tickets</Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Reviewing State - Photo Preview */}
        {(state === 'reviewing' || state === 'capturing') && (
          <Animated.View 
            style={[
              styles.reviewContainer,
              {
                opacity: fadeAnim,
                transform: [{scale: scaleAnim}],
              }
            ]}
          >
            <Text style={styles.reviewTitle}>
              {photos.length} photo{photos.length > 1 ? 's' : ''} capturée{photos.length > 1 ? 's' : ''}
            </Text>
            <Text style={styles.reviewSubtitle}>
              Ajoutez plus ou lancez l'analyse
            </Text>

            {/* Photo Grid */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photosGrid}
            >
              {photos.map((photo, index) => (
                <Animated.View 
                  key={photo.id} 
                  style={[
                    styles.photoCard,
                    {transform: [{scale: scaleAnim}]}
                  ]}
                >
                  <Image source={{uri: photo.uri}} style={styles.photoImage} />
                  <View style={styles.photoBadge}>
                    <Text style={styles.photoBadgeText}>{index + 1}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.photoRemoveButton}
                    onPress={() => handleRemovePhoto(photo.id)}
                  >
                    <Icon name="x" size="sm" color={Colors.white} />
                  </TouchableOpacity>
                </Animated.View>
              ))}

              {photos.length < MAX_PHOTOS && (
                <TouchableOpacity
                  style={styles.addPhotoCard}
                  onPress={() => handleAddPhoto(false)}
                >
                  <Icon name="plus" size="xl" color={Colors.primary} />
                  <Text style={styles.addPhotoText}>Ajouter</Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            {/* Review Actions */}
            <View style={styles.reviewActions}>
              <TouchableOpacity
                style={styles.processButton}
                onPress={handleProcess}
                activeOpacity={0.8}
              >
                <Text style={styles.processButtonIcon}>✨</Text>
                <Text style={styles.processButtonText}>
                  Analyser {photos.length > 1 ? `les ${photos.length} photos` : 'la photo'}
                </Text>
              </TouchableOpacity>

              <View style={styles.reviewSecondaryActions}>
                <TouchableOpacity
                  style={styles.reviewSecondaryButton}
                  onPress={() => handleAddPhoto(false)}
                >
                  <Icon name="camera" size="sm" color={Colors.text.primary} />
                  <Text style={styles.reviewSecondaryText}>Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.reviewSecondaryButton}
                  onPress={() => handleAddPhoto(true)}
                >
                  <Icon name="image" size="sm" color={Colors.text.primary} />
                  <Text style={styles.reviewSecondaryText}>Galerie</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.reviewSecondaryButton}
                  onPress={handleReset}
                >
                  <Icon name="refresh" size="sm" color={Colors.status.error} />
                  <Text style={[styles.reviewSecondaryText, {color: Colors.status.error}]}>
                    Réinitialiser
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Processing State - Animated Loading */}
        {state === 'processing' && (
          <View style={styles.processingContainer}>
            {/* Animated Receipt Card */}
            <View style={styles.processingCard}>
              <Animated.View 
                style={[
                  styles.processingIconContainer,
                  {transform: [{scale: pulseAnim}]}
                ]}
              >
                <Animated.View style={{transform: [{rotate: spin}]}}>
                  <Text style={styles.processingEmoji}>
                    {LOADING_MESSAGES[loadingMessageIndex].emoji}
                  </Text>
                </Animated.View>
              </Animated.View>

              {/* Scan Line Effect */}
              <Animated.View 
                style={[
                  styles.scanLine,
                  {transform: [{translateY: scanLineY}]}
                ]}
              />

              {/* Progress Bar */}
              <View style={styles.progressContainer}>
                <Animated.View 
                  style={[
                    styles.progressBar,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 100],
                        outputRange: ['0%', '100%'],
                      })
                    }
                  ]}
                />
              </View>

              {/* Loading Messages */}
              <Animated.View style={styles.loadingTextContainer}>
                <Text style={styles.loadingTitle}>
                  {LOADING_MESSAGES[loadingMessageIndex].text}
                </Text>
                <Text style={styles.loadingSubtitle}>
                  {LOADING_MESSAGES[loadingMessageIndex].subtext}
                </Text>
              </Animated.View>

              {/* Photo Count */}
              <Text style={styles.photoCountText}>
                {photos.length} photo{photos.length > 1 ? 's' : ''} en cours d'analyse
              </Text>
            </View>

            {/* Fun Facts */}
            <View style={styles.funFactCard}>
              <Text style={styles.funFactEmoji}>💡</Text>
              <Text style={styles.funFactText}>
                L'IA analyse chaque article, prix et devise de votre facture
              </Text>
            </View>
          </View>
        )}

        {/* Success State */}
        {state === 'success' && (
          <View style={styles.successContainer}>
            <Animated.View 
              style={[
                styles.successIconContainer,
                {transform: [{scale: bounceScale}]}
              ]}
            >
              <Text style={styles.successEmoji}>🎉</Text>
            </Animated.View>
            <Text style={styles.successTitle}>Analyse terminée!</Text>
            <Text style={styles.successSubtitle}>
              Votre facture a été scannée avec succès
            </Text>
            <Text style={styles.successSubtitleLingala}>
              Tiki na yo eza malamu!
            </Text>
            <View style={styles.successLoader}>
              <Text style={styles.successLoaderText}>Chargement des détails...</Text>
            </View>
          </View>
        )}

        {/* Error State */}
        {state === 'error' && (
          <View style={styles.errorContainer}>
            <View style={styles.errorIconContainer}>
              <Text style={styles.errorEmoji}>😕</Text>
            </View>
            <Text style={styles.errorTitle}>Oups!</Text>
            <Text style={styles.errorMessage}>{error}</Text>

            <View style={styles.errorActions}>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={handleProcess}
              >
                <Icon name="refresh" size="sm" color={Colors.white} />
                <Text style={styles.retryButtonText}>Réessayer</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.newScanButton}
                onPress={handleReset}
              >
                <Icon name="camera" size="sm" color={Colors.primary} />
                <Text style={styles.newScanButtonText}>Nouveau scan</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.helpButton}
              onPress={() => Alert.alert(
                'Aide',
                '• Assurez-vous que la photo est bien éclairée\n• Le ticket doit être entièrement visible\n• Évitez les reflets et les ombres\n• Pour les longs tickets, prenez plusieurs photos'
              )}
            >
              <Text style={styles.helpButtonText}>💡 Conseils pour un meilleur scan</Text>
            </TouchableOpacity>
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
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
  },
  scansBadge: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  scansBadgeText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.white,
  },
  headerSpacer: {
    width: 44,
  },

  // Idle State
  idleContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  illustrationContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    position: 'relative',
  },
  receiptIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.card.blue,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md,
  },
  receiptIconText: {
    fontSize: 60,
  },
  sparkles: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
  },
  sparkle: {
    fontSize: 28,
    position: 'absolute',
    top: 0,
    left: 20,
  },
  sparkleRight: {
    left: 'auto',
    right: 20,
    top: 30,
  },
  welcomeTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  welcomeSubtitle: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  welcomeSubtitleLingala: {
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: Spacing.xl,
  },
  actionButtons: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.md,
  },
  buttonIconContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  buttonTextContainer: {
    flex: 1,
  },
  primaryButtonText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
    marginBottom: 2,
  },
  primaryButtonSubtext: {
    fontSize: Typography.fontSize.sm,
    color: 'rgba(255,255,255,0.8)',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 2,
    borderColor: Colors.border.light,
    ...Shadows.sm,
  },
  secondaryButtonText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  secondaryButtonSubtext: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
  },
  tipsCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  tipsTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  tipEmoji: {
    fontSize: 18,
    marginRight: Spacing.sm,
  },
  tipText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    flex: 1,
  },

  // Review State
  reviewContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  reviewTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  reviewSubtitle: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  photosGrid: {
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  photoCard: {
    width: 140,
    height: 180,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    backgroundColor: Colors.background.secondary,
    ...Shadows.md,
  },
  photoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoBadge: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoBadgeText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
  },
  photoRemoveButton: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.status.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoCard: {
    width: 140,
    height: 180,
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.primary,
    backgroundColor: Colors.card.blue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.primary,
    marginTop: Spacing.sm,
  },
  reviewActions: {
    marginTop: Spacing.xl,
  },
  processButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.status.success,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    ...Shadows.md,
  },
  processButtonIcon: {
    fontSize: 24,
    marginRight: Spacing.sm,
  },
  processButtonText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
  },
  reviewSecondaryActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  reviewSecondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    ...Shadows.sm,
  },
  reviewSecondaryText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.primary,
    marginLeft: Spacing.xs,
  },

  // Processing State
  processingContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing['2xl'],
    alignItems: 'center',
  },
  processingCard: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadows.lg,
    overflow: 'hidden',
  },
  processingIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.card.blue,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  processingEmoji: {
    fontSize: 48,
  },
  scanLine: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: Colors.primary,
    opacity: 0.5,
  },
  progressContainer: {
    width: '100%',
    height: 6,
    backgroundColor: Colors.border.light,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
  },
  loadingTextContainer: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  loadingTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  loadingSubtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
    fontStyle: 'italic',
  },
  photoCountText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
  },
  funFactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card.yellow,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginTop: Spacing.xl,
  },
  funFactEmoji: {
    fontSize: 24,
    marginRight: Spacing.md,
  },
  funFactText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    color: Colors.text.primary,
    lineHeight: 20,
  },

  // Success State
  successContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing['2xl'],
    alignItems: 'center',
  },
  successIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.card.green,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    ...Shadows.md,
  },
  successEmoji: {
    fontSize: 60,
  },
  successTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  successSubtitle: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  successSubtitleLingala: {
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
    fontStyle: 'italic',
    marginTop: Spacing.xs,
  },
  successLoader: {
    marginTop: Spacing.xl,
  },
  successLoaderText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.tertiary,
  },

  // Error State
  errorContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing['2xl'],
    alignItems: 'center',
  },
  errorIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.status.errorLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  errorEmoji: {
    fontSize: 60,
  },
  errorTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  errorMessage: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  errorActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    ...Shadows.sm,
  },
  retryButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.white,
    marginLeft: Spacing.sm,
  },
  newScanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  newScanButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.primary,
    marginLeft: Spacing.sm,
  },
  helpButton: {
    padding: Spacing.md,
  },
  helpButtonText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
  },
});
