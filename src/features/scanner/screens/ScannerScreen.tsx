// Scanner Screen - Capture and process receipts
// Styled with GoShopperAI Design System (Blue + Gold)
import React, {useState, useCallback, useRef, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList, Receipt} from '@/shared/types';
import {useSubscription, useAuth} from '@/shared/contexts';
import {cameraService} from '@/shared/services/camera';
import {geminiService} from '@/shared/services/ai/gemini';
import {analyticsService} from '@/shared/services/analytics';
import {duplicateDetectionService} from '@/shared/services/duplicateDetection';
import {offlineQueueService} from '@/shared/services/firebase';
import {Colors, Typography, Spacing, BorderRadius, Shadows} from '@/shared/theme/theme';
import {Icon, FadeIn, SlideIn} from '@/shared/components';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type ScanState = 'idle' | 'capturing' | 'processing' | 'success' | 'error';

const MAX_RETRY_ATTEMPTS = 3;

export function ScannerScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {user, isAuthenticated} = useAuth();
  const {
    canScan,
    recordScan,
    scansRemaining,
    isTrialActive,
    trialDaysRemaining,
  } = useSubscription();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigation.navigate('Login');
    }
  }, [isAuthenticated, navigation]);

  // Don't render anything if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  const [state, setState] = useState<ScanState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [processingProgress, setProcessingProgress] = useState<string>('');
  const [isOffline, setIsOffline] = useState(false);
  const [queueCount, setQueueCount] = useState(0);

  const retryCountRef = useRef(0);
  const currentImageRef = useRef<string | null>(null);

  useEffect(() => {
    // Track screen view
    analyticsService.logScreenView('Scanner', 'ScannerScreen');

    // Initialize offline queue
    offlineQueueService.init();

    // Subscribe to queue updates
    const unsubscribe = offlineQueueService.subscribe((queue) => {
      setQueueCount(queue.length);
    });

    // Check initial queue count
    offlineQueueService.getQueueCount().then(setQueueCount);

    return () => {
      offlineQueueService.cleanup();
      unsubscribe();
    };
  }, []);

  const processImage = useCallback(
    async (base64Data: string, isRetry: boolean = false): Promise<void> => {
      setState('processing');
      setProcessingProgress('Vérification des doublons...');

      try {
        // Step 1: Check for duplicates before full processing
        if (!isRetry) {
          const duplicateCheck =
            await duplicateDetectionService.checkForDuplicate(
              base64Data,
              user?.uid || 'unknown-user',
            );

          // Track duplicate detection result
          analyticsService.logCustomEvent('duplicate_check_completed', {
            is_duplicate: duplicateCheck.isDuplicate,
            confidence: duplicateCheck.confidence,
            has_existing_receipt: !!duplicateCheck.existingReceiptId,
          });

          if (duplicateCheck.isDuplicate && duplicateCheck.confidence > 0.8) {
            // High confidence duplicate - ask user to confirm
            const shouldProceed = await new Promise<boolean>(resolve => {
              Alert.alert(
                'Reçu potentiellement dupliqué',
                `Un reçu similaire a été trouvé (${Math.round(
                  duplicateCheck.confidence * 100,
                )}% de similarité). Voulez-vous quand même continuer ?`,
                [
                  {
                    text: 'Annuler',
                    style: 'cancel',
                    onPress: () => resolve(false),
                  },
                  {
                    text: 'Continuer',
                    onPress: () => resolve(true),
                  },
                ],
              );
            });

            if (!shouldProceed) {
              setState('idle');
              analyticsService.logCustomEvent('duplicate_scan_cancelled', {
                confidence: duplicateCheck.confidence,
              });
              return;
            }
          } else if (
            duplicateCheck.isDuplicate &&
            duplicateCheck.confidence > 0.6
          ) {
            // Medium confidence - show warning but continue
            setProcessingProgress(
              "Reçu similaire détecté, poursuite de l'analyse...",
            );
            analyticsService.logCustomEvent('duplicate_warning_shown', {
              confidence: duplicateCheck.confidence,
            });
          }
        }

        setProcessingProgress('Analyse en cours...');

        // Step 2: Parse receipt with Gemini AI using base64 directly (no compression needed)
        const result = await geminiService.parseReceipt(
          base64Data,
          user?.uid || 'unknown-user',
        );

        if (result.success && result.receipt) {
          // Record scan usage only on success and not retry
          if (!isRetry) {
            const recorded = await recordScan();
            if (!recorded) {
              console.warn('Failed to record scan, continuing anyway');
            }
          }

          // Track successful scan
          analyticsService.logCustomEvent('scan_completed', {
            success: true,
            retry: isRetry,
            retry_count: retryCountRef.current,
            items_count: result.receipt.items?.length || 0,
            total_amount: result.receipt.total || 0,
            currency: result.receipt.currency || 'unknown',
          });

          setReceipt(result.receipt);
          setState('success');
          setProcessingProgress('');
        } else {
          throw new Error(result.error || "Échec de l'analyse");
        }
      } catch (err: any) {
        console.error('Processing error:', err);

        // Auto-retry logic for transient errors
        const isRetryableError =
          err.message?.includes('timeout') ||
          err.message?.includes('network') ||
          err.message?.includes('503') ||
          err.message?.includes('rate limit');

        if (isRetryableError && retryCountRef.current < MAX_RETRY_ATTEMPTS) {
          retryCountRef.current += 1;
          setProcessingProgress(
            `Nouvelle tentative (${retryCountRef.current}/${MAX_RETRY_ATTEMPTS})...`,
          );

          // Exponential backoff
          await new Promise<void>(resolve =>
            setTimeout(resolve, 1000 * retryCountRef.current),
          );
          return processImage(base64Data, true);
        }

        // Format user-friendly error message
        let userMessage = "Une erreur est survenue lors de l'analyse.";
        if (err.message?.includes('Unable to detect receipt')) {
          userMessage =
            'Impossible de détecter une facture dans cette image. Veuillez réessayer avec une photo plus claire.';
        } else if (
          err.message?.includes('network') ||
          err.message?.includes('offline')
        ) {
          // Queue for offline processing
          if (currentImageRef.current && user?.uid) {
            try {
              await offlineQueueService.queueReceipt(
                {
                  // Partial receipt data - will be processed when online
                  processingStatus: 'pending',
                  createdAt: new Date(),
                },
                [currentImageRef.current],
                user.uid,
              );

              userMessage =
                'Pas de connexion internet. Votre reçu a été mis en file d\'attente et sera traité automatiquement quand vous serez en ligne.';
              setState('success'); // Show success state for queued items
            } catch (queueError) {
              console.error('Failed to queue receipt:', queueError);
              userMessage =
                'Pas de connexion internet. Veuillez vérifier votre connexion et réessayer.';
            }
          } else {
            userMessage =
              'Pas de connexion internet. Veuillez vérifier votre connexion et réessayer.';
          }
        } else if (err.message?.includes('rate limit')) {
          userMessage =
            'Trop de requêtes. Veuillez patienter quelques secondes et réessayer.';
        } else if (err.message) {
          userMessage = err.message;
        }

        setError(userMessage);
        setState('error');

        // Track failed scan
        analyticsService.logCustomEvent('scan_completed', {
          success: false,
          retry: isRetry,
          retry_count: retryCountRef.current,
          error_type: err.message?.includes('Unable to detect receipt')
            ? 'detection_failed'
            : err.message?.includes('network')
            ? 'network_error'
            : err.message?.includes('rate limit')
            ? 'rate_limit'
            : 'processing_error',
          error_message: err.message || 'unknown',
        });
        setProcessingProgress('');
      }
    },
    [user, recordScan],
  );

  const handleCapture = useCallback(async () => {
    // Check if user can scan
    if (!canScan) {
      analyticsService.logCustomEvent('scan_blocked_subscription');
      Alert.alert(
        'Limite atteinte',
        isTrialActive
          ? 'Une erreur est survenue. Veuillez réessayer.'
          : 'Vous avez atteint votre limite de scans. Passez à un plan supérieur pour continuer.',
        [
          {text: 'Annuler', style: 'cancel'},
          {
            text: 'Voir les plans',
            onPress: () => navigation.navigate('Subscription'),
          },
        ],
      );
      return;
    }

    analyticsService.logCustomEvent('scan_started', {method: 'camera'});
    setState('capturing');
    setError(null);
    retryCountRef.current = 0;

    const result = await cameraService.captureFromCamera();

    if (!result.success || !result.base64) {
      analyticsService.logCustomEvent('scan_failed', {
        method: 'camera',
        reason: result.error || 'unknown',
      });
      setState('idle');
      if (result.error && result.error !== 'Capture annulée') {
        setError(result.error);
      }
      return;
    }

    // Store image URI temporarily for potential offline queuing
    currentImageRef.current = result.uri || null;
    await processImage(result.base64);
  }, [canScan, navigation, isTrialActive, processImage]);

  const handleGallery = useCallback(async () => {
    if (!canScan) {
      analyticsService.logCustomEvent('scan_blocked_subscription');
      Alert.alert(
        'Limite atteinte',
        isTrialActive
          ? 'Une erreur est survenue. Veuillez réessayer.'
          : 'Vous avez atteint votre limite de scans. Passez à un plan supérieur pour continuer.',
        [
          {text: 'Annuler', style: 'cancel'},
          {
            text: 'Voir les plans',
            onPress: () => navigation.navigate('Subscription'),
          },
        ],
      );
      return;
    }

    analyticsService.logCustomEvent('scan_started', {method: 'gallery'});
    setState('capturing');
    setError(null);
    retryCountRef.current = 0;

    const result = await cameraService.selectFromGallery();

    if (!result.success || !result.base64) {
      analyticsService.logCustomEvent('scan_failed', {
        method: 'gallery',
        reason: result.error || 'unknown',
      });
      setState('idle');
      if (result.error && result.error !== 'Capture annulée') {
        setError(result.error);
      }
      return;
    }

    // Store image URI temporarily for potential offline queuing
    currentImageRef.current = result.uri || null;
    await processImage(result.base64);
  }, [canScan, navigation, isTrialActive, processImage]);

  const handleRetry = () => {
    setState('idle');
    setError(null);
    setReceipt(null);
    retryCountRef.current = 0;
  };

  const handleRetryWithSameImage = async () => {
    // Since we don't store images anymore, just show error that retry isn't available
    Alert.alert(
      'Nouvelle tentative impossible',
      "L'image n'est plus disponible. Veuillez prendre une nouvelle photo.",
      [{text: 'OK', onPress: handleRetry}],
    );
  };

  const handleViewResults = () => {
    if (receipt) {
      navigation.navigate('ReceiptDetail', {receiptId: receipt.id, receipt});
    }
  };

  const handleClose = () => {
    navigation.goBack();
  };

  // Scans remaining text
  const getScansText = () => {
    if (isTrialActive) {
      return `Essai gratuit: ${trialDaysRemaining} jours restants`;
    }
    if (scansRemaining === -1) {
      return 'Scans illimités';
    }
    return `${scansRemaining} scans restants`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Icon name="close" size="sm" color={Colors.text.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scanner</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Scans remaining badge */}
      {state === 'idle' && (
        <FadeIn>
          <View style={styles.scansBadge}>
            <Icon name="camera" size="xs" color={Colors.primary} />
            <Text style={styles.scansBadgeText}>{getScansText()}</Text>
          </View>
        </FadeIn>
      )}

      {/* Offline banner */}
      {(isOffline || queueCount > 0) && state === 'idle' && (
        <View style={styles.offlineBanner}>
          <Icon 
            name={isOffline ? 'alert' : 'clock'} 
            size="sm" 
            color={Colors.status.warning} 
          />
          <View style={styles.offlineTextContainer}>
            <Text style={styles.offlineTitle}>
              {isOffline ? 'Mode hors ligne' : 'File d\'attente active'}
            </Text>
            <Text style={styles.offlineDesc}>
              {isOffline
                ? `${queueCount} scans en attente`
                : `${queueCount} scans seront traités automatiquement`}
            </Text>
          </View>
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        {state === 'idle' && (
          <SlideIn>
            <View style={styles.idleContainer}>
              <View style={styles.scannerIconWrapper}>
                <Icon name="camera" size="xl" color={Colors.primary} />
              </View>
              <Text style={styles.idleTitle}>Scannez votre facture</Text>
              <Text style={styles.idleDesc}>
                Prenez en photo votre ticket de caisse ou sélectionnez une image
              </Text>

              <View style={styles.buttonsContainer}>
                <TouchableOpacity
                  style={styles.captureButton}
                  onPress={handleCapture}
                  activeOpacity={0.8}>
                  <View style={styles.captureButtonGlow} />
                  <Icon name="camera" size="md" color={Colors.white} />
                  <Text style={styles.captureText}>Prendre une photo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.galleryButton}
                  onPress={handleGallery}
                  activeOpacity={0.8}>
                  <Icon name="image" size="md" color={Colors.primary} />
                  <Text style={styles.galleryText}>Galerie</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SlideIn>
        )}

        {state === 'capturing' && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Capture en cours...</Text>
          </View>
        )}

        {state === 'processing' && (
          <View style={styles.loadingContainer}>
            <View style={styles.processingOverlay}>
              <View style={styles.processingIcon}>
                <ActivityIndicator size="large" color={Colors.white} />
              </View>
              <Text style={styles.processingText}>
                {processingProgress || 'Analyse en cours...'}
              </Text>
              <Text style={styles.processingSubtext}>
                L'IA extrait les informations de votre facture
              </Text>
            </View>
          </View>
        )}

        {state === 'success' && receipt && (
          <SlideIn>
            <View style={styles.successContainer}>
              <View style={styles.successIconWrapper}>
                <Icon name="check" size="xl" color={Colors.status.success} />
              </View>
              <Text style={styles.successTitle}>Facture analysée !</Text>

              <View style={styles.summaryCard}>
                <View style={styles.storeIconWrapper}>
                  <Icon name="location" size="md" color={Colors.primary} />
                </View>
                <Text style={styles.storeName}>{receipt.storeName}</Text>
                <Text style={styles.itemCount}>
                  {receipt.items.length} article
                  {receipt.items.length > 1 ? 's' : ''} détecté
                  {receipt.items.length > 1 ? 's' : ''}
                </Text>
                <Text style={styles.totalAmount}>
                  Total: ${receipt.total.toFixed(2)}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.viewResultsButton}
                onPress={handleViewResults}
                activeOpacity={0.8}>
                <Text style={styles.viewResultsText}>
                  Voir les détails & comparer
                </Text>
                <Icon name="arrow-right" size="sm" color={Colors.white} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.scanAnotherButton}
                onPress={handleRetry}
                activeOpacity={0.8}>
                <Icon name="camera" size="sm" color={Colors.text.secondary} />
                <Text style={styles.scanAnotherText}>
                  Scanner une autre facture
                </Text>
              </TouchableOpacity>
            </View>
          </SlideIn>
        )}

        {state === 'error' && (
          <SlideIn>
            <View style={styles.errorContainer}>
              <View style={styles.errorIconWrapper}>
                <Icon name="alert" size="xl" color={Colors.status.error} />
              </View>
              <Text style={styles.errorTitle}>Échec de l'analyse</Text>
              <Text style={styles.errorDesc}>{error}</Text>

              <View style={styles.errorButtons}>
                {currentImageRef.current && (
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={handleRetryWithSameImage}
                    activeOpacity={0.8}>
                    <Icon name="refresh" size="sm" color={Colors.white} />
                    <Text style={styles.retryText}>Réessayer l'analyse</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.retryButton, styles.retryButtonSecondary]}
                  onPress={handleRetry}
                  activeOpacity={0.8}>
                  <Icon name="camera" size="sm" color={Colors.primary} />
                  <Text style={styles.retryTextSecondary}>Nouvelle photo</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SlideIn>
        )}
      </View>
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
  },
  placeholder: {
    width: 44,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  idleContainer: {
    alignItems: 'center',
    width: '100%',
  },
  scannerIconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  idleTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  idleDesc: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing['2xl'],
    paddingHorizontal: Spacing.lg,
  },
  buttonsContainer: {
    width: '100%',
    gap: Spacing.md,
  },
  captureButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  captureButtonGlow: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.accent,
    opacity: 0.2,
  },
  captureText: {
    color: Colors.white,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
  },
  galleryButton: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.sm,
  },
  galleryText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  loadingText: {
    marginTop: Spacing.lg,
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
  },
  processingOverlay: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    padding: Spacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    ...Shadows.lg,
  },
  processingIcon: {
    marginBottom: Spacing.lg,
  },
  processingText: {
    color: Colors.white,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  processingSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
  },
  successContainer: {
    alignItems: 'center',
    width: '100%',
  },
  successIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.status.successLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  successTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.xl,
  },
  summaryCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    ...Shadows.md,
  },
  storeIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  storeName: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  itemCount: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.tertiary,
    marginBottom: Spacing.md,
  },
  totalAmount: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.accent,
  },
  viewResultsButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    ...Shadows.md,
  },
  viewResultsText: {
    color: Colors.white,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
  },
  scanAnotherButton: {
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  scanAnotherText: {
    color: Colors.text.secondary,
    fontSize: Typography.fontSize.sm,
  },
  errorContainer: {
    alignItems: 'center',
    width: '100%',
  },
  errorIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.status.errorLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  errorTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  errorDesc: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing['2xl'],
    marginBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    ...Shadows.md,
  },
  retryButtonSecondary: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  retryText: {
    color: Colors.white,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
  },
  retryTextSecondary: {
    color: Colors.primary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
  },
  errorButtons: {
    width: '100%',
    alignItems: 'center',
  },
  scansBadge: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
  },
  scansBadgeText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semiBold,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.status.warningLight,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.status.warning,
    gap: Spacing.md,
  },
  offlineTextContainer: {
    flex: 1,
  },
  offlineTitle: {
    color: Colors.text.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semiBold,
    marginBottom: 2,
  },
  offlineDesc: {
    color: Colors.text.secondary,
    fontSize: Typography.fontSize.xs,
  },
});
