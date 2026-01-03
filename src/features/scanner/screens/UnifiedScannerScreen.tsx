// Unified Scanner Screen - Animated & Interactive Receipt Scanner
// Single photo + video scanning with entertaining UX
import React, {useState, useCallback, useRef, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Animated,
  Easing,
  Dimensions,
  SafeAreaView,
  AppState,
  AppStateStatus,
} from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '@/shared/types';
import {useSubscription, useAuth, useUser, useOfflineMode} from '@/shared/contexts';
import {useToast} from '@/shared/contexts';
import {useScanProcessing} from '@/shared/contexts/ScanProcessingContext';
import {cameraService, imageCompressionService} from '@/shared/services/camera';
import {geminiService} from '@/shared/services/ai/gemini';
import {hybridReceiptProcessor} from '@/shared/services/ai/hybridReceiptProcessor';
import {analyticsService} from '@/shared/services/analytics';
import {hapticService} from '@/shared/services/hapticService';
import {inAppReviewService} from '@/shared/services/inAppReviewService';
import {offlineQueueService, receiptStorageService, userBehaviorService} from '@/shared/services/firebase';
import {backgroundScanService} from '@/shared/services/firebase/backgroundScan';
import {offlineModeService} from '@/shared/services/offlineModeService';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {Icon, ScanProgressIndicator, ConfirmationModal, SubscriptionLimitModal} from '@/shared/components';
import firestore from '@react-native-firebase/firestore';
import {APP_ID} from '@/shared/services/firebase/config';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type ScanState = 'idle' | 'capturing' | 'processing' | 'success' | 'error';

const MAX_RETRY_ATTEMPTS = 3;

// Fun loading messages
const LOADING_MESSAGES = [
  {icon: 'search', text: 'Recherche du reçu...', subtext: 'Kozela na reçu...'},
  {icon: 'camera', text: 'Analyse de l\'image...', subtext: 'Kotala foto...'},
  {icon: 'cpu', text: 'IA en action...', subtext: 'Intelligence artificielle ezo sebela...'},
  {icon: 'edit', text: 'Extraction des articles...', subtext: 'Kobimisa biloko...'},
  {icon: 'dollar-sign', text: 'Calcul des prix...', subtext: 'Kotanga ntalo...'},
  {icon: 'sparkles', text: 'Presque fini...', subtext: 'Eza pene na kosila...'},
  {icon: 'gift', text: 'Finalisation...', subtext: 'Eza kosila...'},
];


// Helper function to check for duplicate receipts using processed data
async function checkProcessedReceiptDuplicate(
  receipt: any,
  userId: string
): Promise<{isDuplicate: boolean; existingReceipt?: any; matchReason?: string}> {
  try {
    // Get recent receipts from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const receiptsSnapshot = await firestore()
      .collection(`artifacts/${APP_ID}/users/${userId}/receipts`)
      .where('scannedAt', '>=', firestore.Timestamp.fromDate(thirtyDaysAgo))
      .get();

    // Parse new receipt date
    let newReceiptDate: Date | null = null;
    if (receipt.date) {
      newReceiptDate = new Date(receipt.date);
      // Invalid date check
      if (isNaN(newReceiptDate.getTime())) {
        newReceiptDate = null;
      }
    }

    // Check for exact matches
    for (const doc of receiptsSnapshot.docs) {
      if (!doc.exists) continue;
      const existingReceipt = doc.data();
      if (!existingReceipt) continue;
      
      // ========== 1. RECEIPT NUMBER MATCH (strongest indicator) ==========
      // If both have receipt numbers and they match exactly, it's definitely a duplicate
      if (receipt.receiptNumber && 
          existingReceipt.receiptNumber && 
          receipt.receiptNumber.trim() === existingReceipt.receiptNumber.trim()) {
        return {
          isDuplicate: true,
          existingReceipt: {
            ...existingReceipt,
            id: doc.id,
            date: existingReceipt.scannedAt?.toDate(),
          },
          matchReason: 'Même numéro de reçu',
        };
      }

      // ========== 2. EXACT MATCH: Same store + Same date + Same total ==========
      // Normalize store names for comparison
      const normalizeStoreName = (name: string) => 
        (name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      
      const newStoreName = normalizeStoreName(receipt.storeName);
      const existingStoreName = normalizeStoreName(existingReceipt.storeName);
      
      // Store must match (at least partially)
      const storeMatches = newStoreName && existingStoreName && (
        newStoreName === existingStoreName ||
        newStoreName.includes(existingStoreName) ||
        existingStoreName.includes(newStoreName)
      );

      if (!storeMatches) {
        continue; // Different store, not a duplicate
      }

      // Check date - must be SAME day
      let dateMatches = false;
      if (existingReceipt.scannedAt && newReceiptDate) {
        const existingDate = existingReceipt.scannedAt.toDate();
        dateMatches = 
          existingDate.getFullYear() === newReceiptDate.getFullYear() &&
          existingDate.getMonth() === newReceiptDate.getMonth() &&
          existingDate.getDate() === newReceiptDate.getDate();
      } else if (existingReceipt.date && newReceiptDate) {
        // Fallback to date field
        const existingDate = new Date(existingReceipt.date);
        if (!isNaN(existingDate.getTime())) {
          dateMatches = 
            existingDate.getFullYear() === newReceiptDate.getFullYear() &&
            existingDate.getMonth() === newReceiptDate.getMonth() &&
            existingDate.getDate() === newReceiptDate.getDate();
        }
      }

      if (!dateMatches) {
        continue; // Different day, not a duplicate
      }

      // Check total - must be within 1% or $0.10
      const newTotal = receipt.total || receipt.totalUSD || 0;
      const existingTotal = existingReceipt.total || existingReceipt.totalUSD || 0;
      const totalDiff = Math.abs(newTotal - existingTotal);
      const totalMatches = totalDiff < 0.10 || totalDiff < (newTotal * 0.01);

      if (storeMatches && dateMatches && totalMatches) {
        return {
          isDuplicate: true,
          existingReceipt: {
            ...existingReceipt,
            id: doc.id,
            date: existingReceipt.scannedAt?.toDate() || existingReceipt.date,
          },
          matchReason: 'Même magasin, date et montant',
        };
      }
    }

    return {isDuplicate: false};
  } catch (error) {
    console.error('Duplicate check error:', error);
    return {isDuplicate: false};
  }
}

// Processing timeout constants
const PROCESSING_TIMEOUT_MS = 30000; // 30 seconds max
const MAX_BACKGROUND_RETRIES = 2;
const SCAN_DEBOUNCE_MS = 2000; // 2 seconds between scans

// Helper to add timeout to promises
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

export function UnifiedScannerScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {user, isAuthenticated} = useAuth();
  const {canScan, recordScan, scansRemaining, isTrialActive} = useSubscription();
  const {showToast} = useToast();
  const {profile} = useUser();
  const scanProcessing = useScanProcessing();

  // State
  const [state, setState] = useState<ScanState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [processingStep, setProcessingStep] = useState(0);
  
  // Confirmation Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    title: string;
    message: string;
    variant: 'info' | 'warning' | 'danger' | 'success';
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
  } | null>(null);

  // Subscription Limit Modal State
  const [showLimitModal, setShowLimitModal] = useState(false);

  // Pending scan state for auto-retry after subscription update
  const pendingScanPhotoRef = useRef<string | null>(null);
  const previousScansRemainingRef = useRef<number>(scansRemaining);

  // Debouncing state for preventing rapid scans
  const lastScanTimeRef = useRef<number>(0);
  const isProcessingRef = useRef<boolean>(false);

  // Processing steps for progress indicator
  const PROCESSING_STEPS = [
    {
      key: 'compression',
      title: 'Compression',
      subtitle: 'Optimisation des images...',
      icon: 'image',
    },
    {
      key: 'detection',
      title: 'Détection',
      subtitle: 'Recherche du reçu...',
      icon: 'search',
    },
    {
      key: 'extraction',
      title: 'Extraction',
      subtitle: 'Lecture des articles...',
      icon: 'file-text',
    },
    {
      key: 'validation',
      title: 'Validation',
      subtitle: 'Vérification des prix...',
      icon: 'check-circle',
    },
    {
      key: 'finalization',
      title: 'Enregistrement',
      subtitle: 'Sauvegarde du reçu...',
      icon: 'save',
    },
  ];

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
  const confettiRef = useRef<any>(null);

  // Reset state when screen comes into focus (e.g., after viewing receipt)
  useFocusEffect(
    useCallback(() => {
      // Reset to idle state when returning to scanner
      if (state === 'success' || state === 'error') {
        setState('idle');
        setError(null);
        setLoadingMessageIndex(0);
        setProcessingStep(0);
        retryCountRef.current = 0;
        
        // Reset animations
        fadeAnim.setValue(1);
        scaleAnim.setValue(1);
        pulseAnim.setValue(1);
        rotateAnim.setValue(0);
        bounceAnim.setValue(0);
        slideAnim.setValue(0);
        progressAnim.setValue(0);
        scanLineAnim.setValue(0);
      }
    }, [state])
  );

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
    
    // Sync with server when app comes back from background
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // Check for any completed background scans
        try {
          const syncResult = await backgroundScanService.syncWithServer();
          
          // Show toast for completed scans
          if (syncResult.completed.length > 0) {
            showToast(`✅ ${syncResult.completed.length} reçu(s) traité(s) avec succès!`, 'success');
          }
          
          // Show toast for failed scans
          if (syncResult.failed.length > 0) {
            showToast(`❌ ${syncResult.failed.length} scan(s) échoué(s)`, 'error');
          }
          
          // Log pending scans
          if (syncResult.pending.length > 0) {
            console.log(`⏳ ${syncResult.pending.length} scan(s) still pending`);
          }
        } catch (err) {
          console.error('Error syncing background scans:', err);
        }
      }
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
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
      subscription.remove();
      offlineQueueService.cleanup();
    };
  }, [showToast]);

  // Auto-retry scan when subscription is updated (e.g., after adding scans via developer tools or purchase)
  useEffect(() => {
    // Check if scans increased (user added more scans)
    const scansIncreased = scansRemaining > previousScansRemainingRef.current;
    
    // If scans increased and we have a pending photo, automatically retry
    if (scansIncreased && pendingScanPhotoRef.current && !isProcessingRef.current) {
      const pendingPhoto = pendingScanPhotoRef.current;
      console.log('📊 Subscription updated with more scans available. Auto-retrying pending scan...');
      
      // Close limit modal if it's open
      setShowLimitModal(false);
      
      // Clear pending scan
      pendingScanPhotoRef.current = null;
      
      // Show toast notification
      showToast('✅ Scans ajoutés! Reprise automatique...', 'success');
      
      // Retry the scan after a brief delay
      setTimeout(() => {
        processPhotoInBackground(pendingPhoto);
      }, 500);
    }
    
    // Update previous scans remaining
    previousScansRemainingRef.current = scansRemaining;
  }, [scansRemaining, showToast]);

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

      const animations = [pulseAnimation, rotateAnimation, scanAnimation];
      animations.forEach(anim => anim.start());

      return () => {
        // Stop and reset ALL animations to prevent memory leaks
        animations.forEach(anim => {
          anim.stop();
          anim.reset && anim.reset();
        });
        
        // Reset all animated values to free memory safely
        try {
          pulseAnim.setValue(1);
          rotateAnim.setValue(0);
          scanLineAnim.setValue(0);
          progressAnim.setValue(0);
        } catch (error) {
          console.warn('Error resetting animation values:', error);
        }
      };
    }
  }, [state, pulseAnim, rotateAnim, scanLineAnim, progressAnim]);

  // Success animation
  useEffect(() => {
    if (state === 'success') {
      // Small delay to ensure confetti component is mounted
      setTimeout(() => {
        if (confettiRef.current) {
          confettiRef.current.start();
        }
      }, 100);
      
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

  // Capture and process single photo
  const handlePhotoCapture = useCallback(async (fromGallery: boolean = false) => {
    // Debounce: Prevent rapid multiple scans
    const now = Date.now();
    if (now - lastScanTimeRef.current < SCAN_DEBOUNCE_MS) {
      showToast('Veuillez patienter avant de scanner à nouveau', 'warning');
      return;
    }
    if (isProcessingRef.current) {
      showToast('Un scan est déjà en cours', 'warning');
      return;
    }
    lastScanTimeRef.current = now;

    // Check scan permission
    if (!canScan) {
      analyticsService.logCustomEvent('scan_blocked_subscription');
      setShowLimitModal(true);
      return;
    }

    // Validate user has a city set
    if (!profile?.defaultCity) {
      analyticsService.logCustomEvent('scan_blocked_no_city');
      Alert.alert(
        'Ville requise',
        'Veuillez configurer votre ville dans les paramètres avant de scanner.',
        [
          {text: 'Annuler', style: 'cancel'},
          {text: 'Configurer', onPress: () => navigation.push('Settings')},
        ]
      );
      return;
    }

    setState('capturing');

    const result = fromGallery
      ? await cameraService.selectFromGallery()
      : await cameraService.captureFromCamera();

    if (!result.success || !result.uri) {
      setState('idle');
      if (result.error && result.error !== 'Capture annulée') {
        showToast(result.error, 'error');
      }
      return;
    }

    // Start background processing immediately
    scanProcessing.startProcessing(1);
    setState('idle');
    
    // Navigate away - user can browse the app
    navigation.goBack();
    
    // Use server-side processing for true background support
    // This ensures FCM notifications arrive even when phone is locked
    processPhotoOnServer(result.uri);

    analyticsService.logCustomEvent('photo_captured', {
      from_gallery: fromGallery,
    });
  }, [canScan, profile?.defaultCity, navigation, showToast, scanProcessing]);

  // Handle video recording for long receipts
  const handleVideoScan = useCallback(async () => {
    // Check scan permission
    if (!canScan) {
      analyticsService.logCustomEvent('video_scan_blocked_subscription');
      setShowLimitModal(true);
      return;
    }

    // Validate user has a city set
    if (!profile?.defaultCity) {
      analyticsService.logCustomEvent('scan_blocked_no_city');
      Alert.alert(
        'Ville requise',
        'Veuillez configurer votre ville dans les paramètres avant de scanner.',
        [
          {text: 'Annuler', style: 'cancel'},
          {text: 'Configurer', onPress: () => navigation.push('Settings')},
        ]
      );
      return;
    }

    // Show video quality tips before recording
    Alert.alert(
      '📹 Comment scanner en vidéo',
      '🐌 RÈGLE #1: SCANNEZ TRÈS LENTEMENT!\n' +
      'Prenez 10-15 secondes pour tout le reçu.\n\n' +
      
      '📱 RÈGLE #2: SÉQUENCE CORRECTE\n' +
      '1️⃣ Commencez 5cm AU-DESSUS du nom du magasin\n' +
      '2️⃣ Descendez LENTEMENT ligne par ligne (1-2s par section)\n' +
      '3️⃣ Terminez 5cm APRÈS le total\n\n' +
      
      '💡 RÈGLE #3: QUALITÉ\n' +
      '• Utilisez les DEUX mains pour stabilité\n' +
      '• Bonne lumière (près d\'une fenêtre)\n' +
      '• Distance: 20-30cm du reçu\n\n' +
      
      '⚠️ ASTUCE: Reçu court (< 10 articles)?\n' +
      'Le mode PHOTO est plus précis et plus rapide!',
      [
        {text: 'Annuler', style: 'cancel'},
        {text: 'Utiliser PHOTO', onPress: handlePhotoCapture},
        {text: 'OK, compris', style: 'default', onPress: async () => {
          setState('capturing');
          showToast('Scannez lentement du haut vers le bas...', 'info');
          
          const result = await cameraService.recordVideo();

          if (!result.success || !result.base64) {
            setState('idle');
            if (result.error && result.error !== 'Capture annulée') {
              showToast(result.error, 'error');
            }
            return;
          }

          // Validate video duration
          if (result.duration && result.duration < 5000) {
            Alert.alert(
              '⚠️ Vidéo trop rapide',
              `Votre scan a duré ${(result.duration / 1000).toFixed(1)} secondes.\n\n` +
              'Pour de MEILLEURS RÉSULTATS:\n' +
              '• Scannez pendant 10-15 secondes\n' +
              '• Bougez LENTEMENT du haut vers le bas\n' +
              '• Prenez votre temps sur chaque section\n\n' +
              'Voulez-vous réessayer plus lentement?',
              [
                {text: 'Recommencer', onPress: () => {
                  // Restart video recording
                  setTimeout(() => {
                    Alert.alert(
                      '📹 Rappel: Scannez LENTEMENT',
                      'Prenez 10-15 secondes. Qualité > Vitesse!',
                      [{text: 'OK', onPress: async () => {
                        const retryResult = await cameraService.recordVideo();
                        if (retryResult.success && retryResult.base64) {
                          startVideoProcessing(retryResult);
                        }
                      }}]
                    );
                  }, 500);
                }},
                {text: 'Continuer quand même', style: 'default', onPress: () => startVideoProcessing(result)},
              ]
            );
            return;
          }

          startVideoProcessing(result);
        }},
      ]
    );
  }, [canScan, profile?.defaultCity, navigation, showToast, handlePhotoCapture]);

  // Separate function for video processing
  const startVideoProcessing = useCallback(async (result: any) => {
    // Use background processing for video
    scanProcessing.startProcessing(1);
    scanProcessing.updateProgress(5, 'Préparation de la vidéo...');
    setState('idle'); // Go back to idle, processing happens in background

    analyticsService.logCustomEvent('video_scan_started', {
      duration: result.duration,
    });

    try {
      scanProcessing.updateProgress(15, 'Analyse des images clés...');
      
      // Video progress simulation for better UX
      const progressInterval = setInterval(() => {
        // Random progress between current and 60% while waiting for API
        scanProcessing.updateProgress(
          Math.min(55, 15 + Math.random() * 40),
          'Lecture du contenu du reçu...'
        );
      }, 3000);
      
      const parseResult = await geminiService.parseReceiptVideo(
        result.base64,
        user?.uid || '',
        profile?.defaultCity,
      );
      
      clearInterval(progressInterval);

      if (!parseResult.success || !parseResult.receipt) {
        throw new Error(parseResult.error || 'Échec de l\'analyse de la vidéo');
      }

      scanProcessing.updateProgress(70, 'Vérification des données...');

      // Enhanced receipt validation
      const total = parseResult.receipt.total;
      
      // Check for null, undefined, or zero total
      if (total === null || total === undefined || total === 0) {
        scanProcessing.setError('Reçu invalide: Aucun montant détecté.\nScannez plus lentement.');
        return;
      }
      
      // Check for negative totals
      if (total < 0) {
        scanProcessing.setError('Reçu invalide: Montant négatif détecté.');
        return;
      }
      
      // Check for unreasonably large totals (> 1,000,000)
      if (total > 1000000 || !Number.isFinite(total)) {
        scanProcessing.setError('Reçu invalide: Montant trop élevé ou invalide.');
        return;
      }

      // Validate items exist and are an array
      if (!parseResult.receipt.items || parseResult.receipt.items.length === 0) {
        scanProcessing.setError('Aucun article détecté.\nScannez plus lentement.');
        return;
      }
      
      // Validate item prices
      const invalidItems = parseResult.receipt.items.filter(item => 
        !item || 
        typeof item.unitPrice !== 'number' || 
        item.unitPrice < 0 || 
        !Number.isFinite(item.unitPrice) ||
        (item.totalPrice !== undefined && (item.totalPrice < 0 || !Number.isFinite(item.totalPrice)))
      );
      
      if (invalidItems.length > 0) {
        console.warn('Invalid items detected:', invalidItems);
        scanProcessing.setError('Articles invalides détectés dans le reçu.');
        return;
      }
      
      // Validate receipt date
      if (parseResult.receipt.date) {
        const receiptDate = new Date(parseResult.receipt.date);
        if (isNaN(receiptDate.getTime()) || 
            receiptDate > new Date() || 
            receiptDate < new Date('1900-01-01')) {
          console.warn('Invalid receipt date:', parseResult.receipt.date);
          parseResult.receipt.date = new Date().toISOString(); // Use today
        }
      }

      // Note: Scan usage is already recorded atomically by the Cloud Function

      scanProcessing.updateProgress(90, 'Finalisation...');

      // Success!
      scanProcessing.updateProgress(100, 'Presque terminé !');
      hapticService.success();
      scanProcessing.setSuccess(parseResult.receipt, parseResult.receipt.id || '');

      analyticsService.logCustomEvent('video_scan_success', {
        duration: result.duration,
        items_count: parseResult.receipt.items.length,
        total: parseResult.receipt.total,
      });

      // Track for in-app review
      inAppReviewService.incrementScanCount().then(() => {
        inAppReviewService.requestReviewIfAppropriate();
      });

    } catch (error: any) {
      console.error('Video scan error:', error);

      // Check if this is a subscription limit error
      const errorText = error.message || '';
      const isSubscriptionLimitError = 
        errorText.includes('Limite d\'essai atteinte') ||
        errorText.includes('limite d\'essai') ||
        errorText.includes('trial limit') ||
        errorText.includes('RESOURCE_EXHAUSTED') ||
        errorText.includes('Abonnez-vous pour continuer') ||
        errorText.includes('Subscribe to continue');

      if (isSubscriptionLimitError) {
        console.log('📊 Video scan subscription limit reached, showing modal');
        setShowLimitModal(true);
        hapticService.error();
        analyticsService.logCustomEvent('video_scan_subscription_limit');
        return;
      }

      // Hybrid approach: Suggest photo mode on video failure
      const isVideoQualityError = 
        errorText.includes('Aucun article détecté') ||
        errorText.includes('trop longue') ||
        errorText.includes('complexe') ||
        errorText.includes('lentement') ||
        errorText.includes('truncated') ||
        errorText.includes('Incomplete');
      
      if (isVideoQualityError) {
        // Suggest using photo mode instead
        scanProcessing.setError(
          'La vidéo n\'a pas pu être analysée correctement.\n\n' +
          '💡 Conseil: Essayez le mode PHOTO pour de meilleurs résultats.\n' +
          'Prenez une photo claire du reçu entier.'
        );
        hapticService.error();
        analyticsService.logCustomEvent('video_scan_suggest_photo', {
          error: error.message,
        });
        return;
      }

      scanProcessing.setError(
        (error.message || 'Erreur lors de l\'analyse de la vidéo') +
        '\n\n💡 Conseil: Le mode photo est souvent plus précis.'
      );
      hapticService.error();

      analyticsService.logCustomEvent('video_scan_error', {
        error: error.message,
      });
    }
  }, [user?.uid, profile?.defaultCity, scanProcessing]);

  /**
   * Process photo using TRUE server-side background processing
   * - Uploads image to Cloud Storage first (quick)
   * - Triggers Cloud Function to process in background
   * - FCM push notification will arrive even if phone is locked
   * - User can close app completely and still get notified
   */
  const processPhotoOnServer = useCallback(async (photoUri: string): Promise<void> => {
    isProcessingRef.current = true;
    
    try {
      // Step 1: Compress image for upload
      scanProcessing.updateProgress(10, 'Compression de l\'image...');
      
      const imageBase64 = await withTimeout(
        imageCompressionService.compressToBase64(photoUri),
        10000,
        'Compression trop longue'
      );

      // Step 2: Upload and start server-side processing
      scanProcessing.updateProgress(30, 'Envoi au serveur...');
      
      const pendingScan = await backgroundScanService.uploadAndProcessInBackground(
        imageBase64,
        user?.uid || 'unknown-user',
        profile?.defaultCity,
        photoUri
      );

      scanProcessing.updateProgress(50, 'Traitement en cours sur le serveur...');
      
      showToast(
        '📤 Votre reçu est en cours de traitement. Vous recevrez une notification quand ce sera terminé!',
        'success',
        5000
      );

      analyticsService.logCustomEvent('server_scan_started', {
        pendingScanId: pendingScan.id,
        city: profile?.defaultCity,
      });

      // Update UI to show pending state
      scanProcessing.updateProgress(
        60,
        'Analyse en cours... Vous pouvez fermer l\'application.'
      );

      // Give user time to see the message
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Reset UI - notification will come from server
      scanProcessing.reset();
      isProcessingRef.current = false;

    } catch (error: any) {
      console.error('Server processing error:', error);
      
      // Fall back to local processing
      showToast(
        'Impossible d\'envoyer au serveur. Traitement local en cours...',
        'warning'
      );
      
      // Try local processing instead
      isProcessingRef.current = false;
      await processPhotoInBackground(photoUri, 0);
    }
  }, [user?.uid, profile?.defaultCity, scanProcessing, showToast]);

  // Background process single photo - runs in background while user can navigate away
  const processPhotoInBackground = useCallback(async (photoUri: string, retryCount: number = 0): Promise<void> => {
    isProcessingRef.current = true;
    
    try {
      // Step 1: Compression with timeout
      scanProcessing.updateProgress(10, 'Préparation de l\'analyse...');
      
      const imageBase64 = await withTimeout(
        imageCompressionService.compressToBase64(photoUri),
        10000, // 10s timeout for compression
        'Compression de l\'image trop longue. Réessayez avec une photo plus petite.'
      );

      // Step 2: Detection
      scanProcessing.updateProgress(25, 'Compression et optimisation...');
      scanProcessing.updateProgress(45, 'Extraction des données...');
      
      // Add timeout to the AI processing
      const response = await withTimeout(
        hybridReceiptProcessor.processReceipt(
          imageBase64,
          user?.uid || 'unknown-user',
          profile?.defaultCity
        ),
        PROCESSING_TIMEOUT_MS,
        'L\'analyse prend trop de temps. Vérifiez votre connexion et réessayez.'
      );

      if (response.success && response.receipt) {
        // Enhanced validation checks
        const total = response.receipt.total;
        
        // Check for null, undefined, or zero total
        if (total === null || total === undefined || total === 0) {
          isProcessingRef.current = false;
          scanProcessing.setError('Reçu invalide: Aucun montant détecté.\\nVeuillez scanner un reçu valide avec des prix.');
          return;
        }
        
        // Check for negative totals
        if (total < 0) {
          isProcessingRef.current = false;
          scanProcessing.setError('Reçu invalide: Montant négatif détecté.');
          return;
        }
        
        // Check for unreasonably large totals
        if (total > 1000000 || !Number.isFinite(total)) {
          isProcessingRef.current = false;
          scanProcessing.setError('Reçu invalide: Montant trop élevé ou invalide.');
          return;
        }
        
        // Validate items exist and are valid
        if (!response.receipt.items || response.receipt.items.length === 0) {
          isProcessingRef.current = false;
          scanProcessing.setError('Image invalide: Ceci n\'est pas un reçu.\nVeuillez scanner un reçu valide.');
          return;
        }
        
        // Validate item prices
        const invalidItems = response.receipt.items.filter(item => 
          !item || 
          typeof item.unitPrice !== 'number' || 
          item.unitPrice < 0 || 
          !Number.isFinite(item.unitPrice) ||
          (item.totalPrice !== undefined && (item.totalPrice < 0 || !Number.isFinite(item.totalPrice)))
        );
        
        if (invalidItems.length > 0) {
          console.warn('Invalid items detected in photo scan:', invalidItems);
          isProcessingRef.current = false;
          scanProcessing.setError('Articles invalides détectés dans le reçu.');
          return;
        }
        
        // Validate receipt date
        if (response.receipt.date) {
          const receiptDate = new Date(response.receipt.date);
          if (isNaN(receiptDate.getTime()) || 
              receiptDate > new Date() || 
              receiptDate < new Date('1900-01-01')) {
            console.warn('Invalid receipt date in photo scan:', response.receipt.date);
            response.receipt.date = new Date().toISOString(); // Use today
          }
        }
        
        if (!response.receipt.storeName && !response.receipt.date) {
          isProcessingRef.current = false;
          scanProcessing.setError('Image invalide: Ceci ne semble pas être un reçu.');
          return;
        }
        
        // Step 4: Validation
        scanProcessing.updateProgress(70, 'Vérification des informations...');
        
        // Add user's default city if receipt doesn't have a city
        if (!response.receipt.city && profile?.defaultCity) {
          response.receipt.city = profile.defaultCity;
          if (response.receipt.items) {
            response.receipt.items = response.receipt.items.map(item => ({
              ...item,
              city: profile.defaultCity
            }));
          }
        }
        
        // Step 5: Finalization - Save to Firestore (or queue if offline)
        scanProcessing.updateProgress(90, 'Finalisation...');
        
        // Use offline mode service to handle both online and offline scenarios
        const saveResult = await offlineModeService.saveReceipt(
          response.receipt,
          null, // Image URI - we've already processed the image
          user?.uid || 'unknown-user'
        );

        if (!saveResult.success) {
          throw new Error(saveResult.error || 'Échec de la sauvegarde');
        }

        const savedReceiptId = saveResult.queued 
          ? saveResult.queuedReceipt?.id || response.receipt.id
          : saveResult.savedReceiptId || response.receipt.id;
        
        // Show queued message if receipt was queued for offline sync
        if (saveResult.queued) {
          showToast('Reçu enregistré hors ligne. Il sera synchronisé une fois connecté.', 'info', 4000);
        }

        // Track shopping patterns for ML
        if (user?.uid) {
          await userBehaviorService.updateShoppingPatterns(user.uid, {
            total: response.receipt.total || 0,
            itemCount: response.receipt.items?.length || 0,
            storeName: response.receipt.storeName || '',
            categories: [...new Set(response.receipt.items?.map(item => item.category).filter(Boolean) || [])] as string[],
            date: new Date(),
          }).catch(err => console.log('Failed to track shopping patterns:', err));
        }

        // Note: Scan usage is already recorded atomically by the Cloud Function

        analyticsService.logCustomEvent('scan_completed_background', {
          success: true,
          items_count: response.receipt.items?.length || 0,
        });

        // Success!
        scanProcessing.updateProgress(100, 'Presque terminé !');
        hapticService.success();
        scanProcessing.setSuccess(response.receipt, savedReceiptId);
        
        // Track for in-app review
        inAppReviewService.incrementScanCount().then(() => {
          inAppReviewService.requestReviewIfAppropriate();
        });
        
        isProcessingRef.current = false;
        return;
      } else {
        throw new Error(response.error || 'Échec de l\'analyse');
      }
    } catch (err: any) {
      console.error('Background processing error:', err);

      // Check if we should retry (network/timeout errors only)
      const errorText = err.message || '';
      const isRetryableError = 
        errorText.includes('timeout') ||
        errorText.includes('trop longue') ||
        errorText.includes('network') ||
        errorText.includes('réseau') ||
        errorText.includes('fetch') ||
        errorText.includes('Failed to fetch');

      if (isRetryableError && retryCount < MAX_BACKGROUND_RETRIES) {
        console.log(`Retrying scan (attempt ${retryCount + 2}/${MAX_BACKGROUND_RETRIES + 1})...`);
        scanProcessing.updateProgress(10, `Nouvelle tentative (${retryCount + 2}/${MAX_BACKGROUND_RETRIES + 1})...`);
        
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 2000));
        return processPhotoInBackground(photoUri, retryCount + 1);
      }

      // Check if this is a subscription limit error
      const isSubscriptionLimitError = 
        errorText.includes('Limite d\'essai atteinte') ||
        errorText.includes('limite d\'essai') ||
        errorText.includes('trial limit') ||
        errorText.includes('RESOURCE_EXHAUSTED') ||
        errorText.includes('Abonnez-vous pour continuer') ||
        errorText.includes('Subscribe to continue');

      if (isSubscriptionLimitError) {
        console.log('📊 Subscription limit reached, saving pending scan for auto-retry');
        // Save the photo for auto-retry when scans are added
        pendingScanPhotoRef.current = photoUri;
        setShowLimitModal(true);
        scanProcessing.setError(''); // Clear any error state
        hapticService.error();
        isProcessingRef.current = false;
        return;
      }

      // Extract error message from JSON responses (like Cloud Function errors)
      let extractedErrorMessage = errorText;
      try {
        // Try to parse JSON error responses
        if (errorText.includes('{') && errorText.includes('}')) {
          const jsonMatch = errorText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const errorJson = JSON.parse(jsonMatch[0]);
            if (errorJson.error && errorJson.error.message) {
              extractedErrorMessage = errorJson.error.message;
            }
          }
        }
      } catch (parseError) {
        // If JSON parsing fails, use the original error text
        console.log('Failed to parse error JSON, using original text');
      }

      // Use extracted message for further processing
      errorText = extractedErrorMessage;

      // Define the user-facing error message
      let userMessage = 'Une erreur est survenue lors de l\'analyse.';

      // Only override with generic messages if no specific error was extracted
      if (userMessage === 'Une erreur est survenue lors de l\'analyse.') {
        if (errorText.includes('ne semble pas être un reçu') ||
            errorText.includes('not a receipt')) {
          userMessage = 'Cette image ne semble pas être un reçu.';
        } else if (errorText.includes('Unable to detect receipt')) {
          userMessage = 'Impossible de détecter une facture.';
        } else if (errorText.includes('timeout') || errorText.includes('trop longue')) {
          userMessage = 'L\'analyse a pris trop de temps. Vérifiez votre connexion et réessayez.';
        } else if (errorText.includes('network') || errorText.includes('réseau') || errorText.includes('offline')) {
          // Check if user has offline access
          const hasOfflineAccess = offlineModeService.canUseOfflineMode();
          if (hasOfflineAccess) {
            userMessage = 'Erreur réseau. Le scan sera synchronisé une fois connecté.';
          } else {
            userMessage = 'Pas de connexion internet. Mettez à niveau vers Standard ou Premium pour scanner hors ligne.';
          }
        } else if (errorText.includes('floue') || errorText.includes('sombre') ||
                   errorText.includes('blur') || errorText.includes('dark')) {
          // Use the extracted message if it's about image quality
          userMessage = errorText;
        } else if (errorText && errorText.length > 0 && errorText.length < 200) {
          // Use the error text directly if it's a reasonable length
          userMessage = errorText;
        }
      }

      hapticService.error();
      scanProcessing.setError(userMessage);
      isProcessingRef.current = false;
    }
  }, [user?.uid, profile?.defaultCity, recordScan, scanProcessing]);

  // Reset
  const handleReset = useCallback(() => {
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
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Info Bar */}
        {state === 'idle' && scansRemaining !== undefined && scansRemaining !== Infinity && (
          <Animated.View 
          style={[
            styles.topInfoBar,
            {
              opacity: fadeAnim,
            }
          ]}
        >
          <View style={styles.scansRemainingBadge}>
            <Icon name="zap" size="xs" color={Colors.white} />
            <Text style={styles.scansRemainingText}>{scansRemaining} scans restants</Text>
          </View>
          <TouchableOpacity
            onPress={() => Alert.alert(
              'Conseils',
              '• Photo nette et bien éclairée\n• Reçu complet visible\n• Évitez reflets et ombres\n• Mode vidéo pour longs reçus'
            )}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
          >
            <Icon name="help-circle" size="sm" color={Colors.white} />
          </TouchableOpacity>
        </Animated.View>
      )}
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* Idle State - Modern Welcome with Blue Theme */}
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
            {/* 3-Step Flow Illustration */}
            <View style={styles.stepsFlowContainer}>
              <View style={styles.stepsRow}>
                {/* Step 1 */}
                <View style={styles.stepItem}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>1</Text>
                  </View>
                  <Icon name="camera" size="sm" color={Colors.primary} />
                  <Text style={styles.stepTitle}>Capturez</Text>
                  <Text style={styles.stepDesc}>Photo du reçu</Text>
                </View>

                {/* Arrow */}
                <Icon name="chevron-right" size="xs" color={Colors.border.medium} style={styles.stepArrow} />

                {/* Step 2 */}
                <View style={styles.stepItem}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>2</Text>
                  </View>
                  <Icon name="cpu" size="sm" color={Colors.accent} />
                  <Text style={styles.stepTitle}>Analysez</Text>
                  <Text style={styles.stepDesc}>IA extrait tout</Text>
                </View>

                {/* Arrow */}
                <Icon name="chevron-right" size="xs" color={Colors.border.medium} style={styles.stepArrow} />

                {/* Step 3 */}
                <View style={styles.stepItem}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>3</Text>
                  </View>
                  <Icon name="trending-up" size="sm" color={Colors.accentLight} />
                  <Text style={styles.stepTitle}>Économisez</Text>
                  <Text style={styles.stepDesc}>Suivez budget</Text>
                </View>
              </View>
            </View>

            {/* Hero Illustration */}
            <View style={styles.heroContainer}>
              <Animated.View style={[styles.heroCircle, {transform: [{scale: pulseAnim}]}]}>
                <Icon name="camera" size="2xl" color={Colors.white} />
              </Animated.View>
            </View>

            {/* Welcome Text */}
            <View style={styles.welcomeTextContainer}>
              <Text style={styles.welcomeTitle}>Scannez votre reçu</Text>
              <Text style={styles.welcomeSubtitle}>
                Capturez votre reçu pour analyser vos dépenses
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity
                style={[styles.primaryActionButton, !canScan && styles.disabledButton]}
                onPress={() => handlePhotoCapture(false)}
                activeOpacity={canScan ? 0.9 : 1}
                disabled={!canScan}
              >
                <Icon name="camera" size="md" color={Colors.white} />
                <Text style={styles.primaryActionText}>
                  {canScan ? 'Prendre une photo' : 'Limite atteinte'}
                </Text>
              </TouchableOpacity>

              <View style={styles.secondaryButtonsRow}>
                <TouchableOpacity
                  style={[styles.secondaryActionButton, !canScan && styles.disabledButton]}
                  onPress={() => handlePhotoCapture(true)}
                  activeOpacity={canScan ? 0.9 : 1}
                  disabled={!canScan}
                >
                  <Icon name="image" size="sm" color={canScan ? Colors.primary : Colors.text.tertiary} />
                  <Text style={[styles.secondaryActionText, !canScan && styles.disabledText]}>
                    Galerie
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.secondaryActionButton, styles.videoButton, !canScan && styles.disabledButton]}
                  onPress={handleVideoScan}
                  activeOpacity={canScan ? 0.9 : 1}
                  disabled={!canScan}
                >
                  <Icon name="video" size="sm" color={canScan ? Colors.accent : Colors.text.tertiary} />
                  <Text style={[styles.secondaryActionText, !canScan && styles.disabledText, {color: canScan ? Colors.accent : Colors.text.tertiary}]}>
                    Vidéo
                  </Text>
                  <Text style={[styles.videoHint, !canScan && styles.disabledText]}>(longs reçus)</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Processing State - Progress Stepper */}
        {state === 'processing' && (
          <View style={styles.processingContainer}>
            <ScanProgressIndicator
              steps={PROCESSING_STEPS}
              currentStep={processingStep}
            />
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
              <Icon name="check-circle" size="xl" color={Colors.primary} />
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
                style={[styles.retryButton, !canScan && styles.disabledButton]}
                onPress={() => handlePhotoCapture(false)}
                disabled={!canScan}
              >
                <Icon name="camera" size="sm" color={Colors.white} />
                <Text style={[styles.retryButtonText, !canScan && styles.disabledText]}>Réessayer</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.newScanButton, !canScan && styles.disabledButton]}
                onPress={handleReset}
                disabled={!canScan}
              >
                <Icon name="refresh" size="sm" color={Colors.primary} />
                <Text style={[styles.newScanButtonText, !canScan && styles.disabledText]}>Recommencer</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.helpButton}
              onPress={() => Alert.alert(
                'Aide',
                '• Assurez-vous que la photo est bien éclairée\n• Le reçu doit être entièrement visible\n• Évitez les reflets et les ombres\n• Pour les longs reçus, utilisez le mode vidéo'
              )}
            >
              <Text style={styles.helpButtonText}>💡 Conseils pour un meilleur scan</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
      
      {/* Confetti Cannon - Celebration! Only render when successful */}
      {state === 'success' && (
        <ConfettiCannon
          ref={confettiRef}
          count={200}
          origin={{x: SCREEN_WIDTH / 2, y: SCREEN_HEIGHT / 2}}
          autoStart={false}
          fadeOut={true}
          fallSpeed={3000}
          colors={['#FFD700', '#FFA500', '#FF6347', '#32CD32', '#1E90FF', '#FF69B4']}
        />
      )}
      
      {/* Confirmation Modal */}
      {showConfirmModal && confirmModalConfig && (
        <ConfirmationModal
          visible={showConfirmModal}
          title={confirmModalConfig.title}
          message={confirmModalConfig.message}
          variant={confirmModalConfig.variant}
          confirmText={confirmModalConfig.confirmText}
          cancelText={confirmModalConfig.cancelText}
          onConfirm={confirmModalConfig.onConfirm}
          onClose={confirmModalConfig.onCancel}
          onCancel={confirmModalConfig.onCancel}
        />
      )}

      {/* Subscription Limit Modal */}
      <SubscriptionLimitModal
        visible={showLimitModal}
        onClose={() => {
          setShowLimitModal(false);
          // Clear pending scan if user dismisses without adding scans
          pendingScanPhotoRef.current = null;
        }}
        limitType="scan"
        isTrialActive={isTrialActive}
      />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100,
  },
  
  // Modern Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },

  // Top Info Bar
  topInfoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: 'rgba(0, 48, 73, 0.9)',
    borderBottomWidth: 0,
  },
  scansRemainingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  scansRemainingText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.white,
  },
  headerBackButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accentLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  headerBadgeText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.accent,
  },
  headerInfoButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Modern Idle State (Blue Theme)
  idleContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  stepsFlowContainer: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  stepItem: {
    alignItems: 'center',
    gap: 4,
  },
  stepNumber: {
    width: 20,
    height: 20,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
    marginBottom: 4,
  },
  stepNumberText: {
    fontSize: 11,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
  },
  stepTitle: {
    fontSize: 12,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  stepDesc: {
    fontSize: 10,
    color: Colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 12,
  },
  stepArrow: {
    opacity: 0.4,
  },
  heroContainer: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  heroCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.lg,
  },
  welcomeTextContainer: {
    marginBottom: Spacing.xl,
  },
  welcomeTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  welcomeSubtitle: {
    fontSize: Typography.fontSize.base,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: Typography.fontSize.base * 1.5,
    paddingHorizontal: Spacing.md,
  },
  
  // Action Buttons (Blue Theme)
  actionButtonsContainer: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 100,
    paddingVertical: Spacing.lg + 4,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
    elevation: 8,
    shadowColor: Colors.primary,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  primaryActionText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
    letterSpacing: 0.5,
  },
  secondaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background.secondary,
    borderRadius: 100,
    paddingVertical: Spacing.base + 4,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08,
    shadowRadius: 8,
    flex: 1,
  },
  secondaryButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  videoButton: {
    borderWidth: 1,
    borderColor: Colors.accentLight,
    backgroundColor: Colors.white,
  },
  videoHint: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.tertiary,
  },
  secondaryActionText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
  },
  
  // Feature Cards (Blue Theme)
  featureCards: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  featureCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.sm,
  },
  featureTitle: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  featureDesc: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.tertiary,
    textAlign: 'center',
  },

  // Processing State
  processingContainer: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing['2xl'],
    paddingBottom: Spacing.xl,
    justifyContent: 'center',
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
    backgroundColor: Colors.accentLight,
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
    backgroundColor: Colors.accent,
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
    color: Colors.accent,
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
    backgroundColor: Colors.card.cream,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    ...Shadows.md,
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
    backgroundColor: Colors.accent,
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
    borderColor: Colors.accent,
  },
  newScanButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.accent,
    marginLeft: Spacing.sm,
  },
  helpButton: {
    padding: Spacing.md,
  },
  helpButtonText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
  },
  disabledButton: {
    opacity: 0.5,
    backgroundColor: Colors.border.light,
  },
  disabledText: {
    color: Colors.text.tertiary,
  },
});
