// Scanner Screen - Capture and process receipts
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
import {COLORS} from '@/shared/utils/constants';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type ScanState = 'idle' | 'capturing' | 'processing' | 'success' | 'error';

const MAX_RETRY_ATTEMPTS = 3;

export function ScannerScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {user} = useAuth();
  const {
    canScan,
    recordScan,
    scansRemaining,
    isTrialActive,
    trialDaysRemaining,
  } = useSubscription();

  const [state, setState] = useState<ScanState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [processingProgress, setProcessingProgress] = useState<string>('');

  const retryCountRef = useRef(0);
  const currentImageRef = useRef<string | null>(null);

  useEffect(() => {
    // Track screen view
    analyticsService.logScreenView('Scanner', 'ScannerScreen');
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
          userMessage =
            'Pas de connexion internet. Veuillez vérifier votre connexion et réessayer.';
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

    // Don't store image URI to avoid keeping file on device
    currentImageRef.current = null;
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

    // Don't store image URI to avoid keeping file on device
    currentImageRef.current = null;
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
      navigation.navigate('ReceiptDetail', {receiptId: receipt.id});
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
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scanner</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Scans remaining badge */}
      {state === 'idle' && (
        <View style={styles.scansBadge}>
          <Text style={styles.scansBadgeText}>{getScansText()}</Text>
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        {state === 'idle' && (
          <View style={styles.idleContainer}>
            <Text style={styles.idleIcon}>📸</Text>
            <Text style={styles.idleTitle}>Scannez votre facture</Text>
            <Text style={styles.idleDesc}>
              Prenez en photo votre ticket de caisse ou sélectionnez une image
            </Text>

            <View style={styles.buttonsContainer}>
              <TouchableOpacity
                style={styles.captureButton}
                onPress={handleCapture}
                activeOpacity={0.8}>
                <Text style={styles.captureIcon}>📷</Text>
                <Text style={styles.captureText}>Prendre une photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.galleryButton}
                onPress={handleGallery}
                activeOpacity={0.8}>
                <Text style={styles.galleryIcon}>🖼️</Text>
                <Text style={styles.galleryText}>Galerie</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {state === 'capturing' && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary[500]} />
            <Text style={styles.loadingText}>Capture en cours...</Text>
          </View>
        )}

        {state === 'processing' && (
          <View style={styles.loadingContainer}>
            <View style={styles.processingOverlay}>
              <ActivityIndicator size="large" color="#ffffff" />
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
          <View style={styles.successContainer}>
            <Text style={styles.successIcon}>✅</Text>
            <Text style={styles.successTitle}>Facture analysée !</Text>

            <View style={styles.summaryCard}>
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
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.scanAnotherButton}
              onPress={handleRetry}
              activeOpacity={0.8}>
              <Text style={styles.scanAnotherText}>
                Scanner une autre facture
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {state === 'error' && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>❌</Text>
            <Text style={styles.errorTitle}>Échec de l'analyse</Text>
            <Text style={styles.errorDesc}>{error}</Text>

            <View style={styles.errorButtons}>
              {currentImageRef.current && (
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={handleRetryWithSameImage}
                  activeOpacity={0.8}>
                  <Text style={styles.retryText}>Réessayer l'analyse</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.retryButton, styles.retryButtonSecondary]}
                onPress={handleRetry}
                activeOpacity={0.8}>
                <Text style={styles.retryTextSecondary}>Nouvelle photo</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 20,
    color: COLORS.gray[600],
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.gray[900],
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  idleContainer: {
    alignItems: 'center',
  },
  idleIcon: {
    fontSize: 80,
    marginBottom: 24,
  },
  idleTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.gray[900],
    marginBottom: 8,
  },
  idleDesc: {
    fontSize: 16,
    color: COLORS.gray[500],
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  buttonsContainer: {
    width: '100%',
  },
  captureButton: {
    backgroundColor: COLORS.primary[500],
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  captureIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  captureText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  galleryButton: {
    backgroundColor: COLORS.gray[100],
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  galleryText: {
    color: COLORS.gray[700],
    fontSize: 18,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.gray[600],
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  processingSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  successContainer: {
    alignItems: 'center',
    width: '100%',
  },
  successIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.gray[900],
    marginBottom: 24,
  },
  summaryCard: {
    backgroundColor: COLORS.gray[50],
    borderRadius: 16,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  storeName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.gray[900],
    marginBottom: 8,
  },
  itemCount: {
    fontSize: 14,
    color: COLORS.gray[500],
    marginBottom: 12,
  },
  totalAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary[500],
  },
  viewResultsButton: {
    backgroundColor: COLORS.primary[500],
    borderRadius: 12,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewResultsText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  scanAnotherButton: {
    padding: 16,
  },
  scanAnotherText: {
    color: COLORS.gray[600],
    fontSize: 14,
  },
  errorContainer: {
    alignItems: 'center',
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.gray[900],
    marginBottom: 8,
  },
  errorDesc: {
    fontSize: 16,
    color: COLORS.gray[500],
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: COLORS.primary[500],
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 48,
    marginBottom: 12,
  },
  retryButtonSecondary: {
    backgroundColor: COLORS.gray[100],
  },
  retryText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  retryTextSecondary: {
    color: COLORS.gray[700],
    fontSize: 16,
    fontWeight: '600',
  },
  errorButtons: {
    width: '100%',
    alignItems: 'center',
  },
  scansBadge: {
    alignSelf: 'center',
    backgroundColor: COLORS.primary[50],
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  scansBadgeText: {
    color: COLORS.primary[700],
    fontSize: 13,
    fontWeight: '600',
  },
});
