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
  Animated,
  Easing,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '@/shared/types';
import {useSubscription, useAuth, useUser} from '@/shared/contexts';
import {useToast} from '@/shared/contexts';
import {useScanProcessing} from '@/shared/contexts/ScanProcessingContext';
import {cameraService, imageCompressionService} from '@/shared/services/camera';
import {geminiService} from '@/shared/services/ai/gemini';
import {hybridReceiptProcessor} from '@/shared/services/ai/hybridReceiptProcessor';
import {analyticsService} from '@/shared/services/analytics';
import {duplicateDetectionService} from '@/shared/services/duplicateDetection';
import {hapticService} from '@/shared/services/hapticService';
import {inAppReviewService} from '@/shared/services/inAppReviewService';
import {offlineQueueService, receiptStorageService, userBehaviorService} from '@/shared/services/firebase';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {Icon, ScanProgressIndicator, ConfirmationModal, SubscriptionLimitModal} from '@/shared/components';
import functions from '@react-native-firebase/functions';
import firestore from '@react-native-firebase/firestore';
import {APP_ID} from '@/shared/services/firebase/config';
import {Receipt} from '@/shared/types';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface CapturedPhoto {
  id: string;
  uri: string;
  // base64 removed from state to prevent memory leaks
  // Generated on-demand during processing
}

type ScanState = 'idle' | 'capturing' | 'reviewing' | 'processing' | 'success' | 'error';

const MAX_PHOTOS = 5;
const MAX_RETRY_ATTEMPTS = 3;

// Fun loading messages
const LOADING_MESSAGES = [
  {icon: 'search', text: 'Recherche du ticket...', subtext: 'Kozela na tiki...'},
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
      const existingReceipt = doc.data();
      
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

export function UnifiedScannerScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {user, isAuthenticated} = useAuth();
  const {canScan, recordScan, scansRemaining, isTrialActive} = useSubscription();
  const {showToast} = useToast();
  const {profile} = useUser();
  const scanProcessing = useScanProcessing();

  // State
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
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
        setPhotos([]);
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

      const animations = [pulseAnimation, rotateAnimation, scanAnimation];
      animations.forEach(anim => anim.start());

      return () => {
        // Stop and reset ALL animations to prevent memory leaks
        animations.forEach(anim => {
          anim.stop();
          anim.reset && anim.reset();
        });
        
        // Reset all animated values to free memory
        pulseAnim.setValue(1);
        rotateAnim.setValue(0);
        scanLineAnim.setValue(0);
        progressAnim.setValue(0);
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

  // Add photo handler
  const handleAddPhoto = useCallback(async (fromGallery: boolean = false) => {
    if (photos.length >= MAX_PHOTOS) {
      showToast(`Maximum ${MAX_PHOTOS} photos par facture`, 'warning');
      return;
    }

    // Check scan permission
    if (!canScan) {
      analyticsService.logCustomEvent('scan_blocked_subscription');
      setShowLimitModal(true);
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

    // Store only URI - base64 will be generated during processing
    const newPhoto: CapturedPhoto = {
      id: `photo_${Date.now()}`,
      uri: result.uri,
    };

    setPhotos(prev => [...prev, newPhoto]);
    setState('reviewing');

    // Haptic feedback for successful capture
    hapticService.success();

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
        setProcessingStep(0);
      }
      return newPhotos;
    });
  }, []);

  // Background process photos - runs in background while user can navigate away
  const processInBackground = useCallback(async (photosToProcess: CapturedPhoto[]): Promise<void> => {
    try {
      // Step 1: Compression
      scanProcessing.updateProgress(10, 'Préparation de l\'analyse...');
      
      const images = await Promise.all(
        photosToProcess.map(p => imageCompressionService.compressToBase64(p.uri))
      );

      // Step 2: Detection
      scanProcessing.updateProgress(25, 'Compression et optimisation...');

      interface ParseReceiptV2Result {
        success: boolean;
        receiptId?: string;
        receipt?: any;
        error?: string;
      }

      let result: ParseReceiptV2Result | undefined;

      if (images.length === 1) {
        // Single photo - use hybrid processing
        scanProcessing.updateProgress(45, 'Extraction des données...');
        
        const response = await hybridReceiptProcessor.processReceipt(
          images[0],
          user?.uid || 'unknown-user',
          profile?.defaultCity
        );

        if (response.success && response.receipt) {
          // Validation checks
          const total = response.receipt.total;
          if (total === null || total === undefined || total === 0) {
            scanProcessing.setError('Reçu invalide: Aucun montant détecté.\nVeuillez scanner un reçu valide avec des prix.');
            return;
          }
          
          if (!response.receipt.items || response.receipt.items.length === 0) {
            scanProcessing.setError('Image invalide: Ceci n\'est pas un reçu.\nVeuillez scanner un reçu valide.');
            return;
          }
          
          if (!response.receipt.storeName && !response.receipt.date) {
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
          
          // Step 5: Finalization - Save to Firestore
          scanProcessing.updateProgress(90, 'Finalisation...');
          
          const savedReceiptId = await receiptStorageService.saveReceipt(
            response.receipt,
            user?.uid || 'unknown-user'
          );

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

          // Record scan usage
          await recordScan();

          analyticsService.logCustomEvent('scan_completed_background', {
            success: true,
            photo_count: 1,
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
          
          return;
        } else {
          throw new Error(response.error || 'Échec de l\'analyse');
        }
      } else {
        // Multiple photos - use parseReceiptMulti callable function
        scanProcessing.updateProgress(45, 'Extraction des données...');
        
        const parseReceiptMulti = functions().httpsCallable('parseReceiptMulti');
        const response = await parseReceiptMulti({
          images,
          mimeType: 'image/jpeg',
        });

        result = response.data as ParseReceiptV2Result;

        if (result.receipt) {
          const total = result.receipt.total;
          if (total === null || total === undefined || total === 0) {
            scanProcessing.setError('Reçu invalide: Aucun montant détecté.');
            return;
          }
          
          if (!result.receipt.items || result.receipt.items.length === 0) {
            scanProcessing.setError('Image invalide: Ceci n\'est pas un reçu.');
            return;
          }
        }

        if (result.success && result.receiptId) {
          scanProcessing.updateProgress(90, 'Finalisation...');
          await recordScan();

          analyticsService.logCustomEvent('scan_completed_background', {
            success: true,
            photo_count: images.length,
          });

          scanProcessing.updateProgress(100, 'Presque terminé !');
          hapticService.success();
          
          // Fetch the saved receipt for the modal
          const savedReceipt = await receiptStorageService.getReceipt(user?.uid || 'unknown-user', result.receiptId);
          if (savedReceipt) {
            scanProcessing.setSuccess(savedReceipt, result.receiptId);
          } else {
            scanProcessing.setSuccess({
              storeName: 'Reçu enregistré',
              items: [],
              total: 0,
              currency: 'USD',
            } as any, result.receiptId);
          }
          
          inAppReviewService.incrementScanCount().then(() => {
            inAppReviewService.requestReviewIfAppropriate();
          });
          
          return;
        } else {
          throw new Error(result?.error || 'Échec du traitement');
        }
      }
    } catch (err: any) {
      console.error('Background processing error:', err);

      // Parse error message - improved extraction
      let errorText = err.message || '';
      let userMessage = 'Une erreur est survenue lors de l\'analyse.';
      
      try {
        // Try to extract JSON error from various formats
        if (errorText.includes('{"error":{') || errorText.includes('"error":{')) {
          const jsonMatch = errorText.match(/\{.*\}/s);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.error?.message) {
              errorText = parsed.error.message;
              // Use the backend error message directly if it exists
              userMessage = parsed.error.message;
            }
          }
        }
      } catch (parseError) {
        console.error('Error parsing JSON:', parseError);
      }

      // Only override with generic messages if no specific error was extracted
      if (userMessage === 'Une erreur est survenue lors de l\'analyse.') {
        if (errorText.includes('ne semble pas être un reçu') || 
            errorText.includes('not a receipt')) {
          userMessage = 'Cette image ne semble pas être un reçu.';
        } else if (errorText.includes('Unable to detect receipt')) {
          userMessage = 'Impossible de détecter une facture.';
        } else if (errorText.includes('network') || errorText.includes('réseau')) {
          userMessage = 'Pas de connexion internet.';
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
    }
  }, [user?.uid, profile?.defaultCity, recordScan, scanProcessing]);

  // Process photos - now with background option
  const handleProcess = useCallback(async (): Promise<void> => {
    if (photos.length === 0) {
      showToast('Prenez au moins une photo', 'error');
      return;
    }

    // Validate subscription before processing (double-check)
    if (!canScan) {
      analyticsService.logCustomEvent('scan_blocked_no_scans');
      setShowLimitModal(true);
      setState('idle');
      setPhotos([]);
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
      setState('idle');
      setPhotos([]);
      return;
    }

    // Start background processing
    const photosToProcess = [...photos];
    
    // Reset local state and allow navigation away
    setState('idle');
    setPhotos([]);
    setError(null);
    
    // Start the global processing state
    scanProcessing.startProcessing(photosToProcess.length);
    
    // Navigate away - user can browse the app
    navigation.goBack();
    
    // Process in background (non-blocking)
    processInBackground(photosToProcess);
    
  }, [photos, canScan, isTrialActive, profile?.defaultCity, navigation, showToast, scanProcessing, processInBackground]);

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
            <Icon name="zap" size="xs" color={Colors.accent} />
            <Text style={styles.scansRemainingText}>{scansRemaining} scans restants</Text>
          </View>
          <TouchableOpacity
            onPress={() => Alert.alert(
              'Conseils',
              '• Photo nette et bien éclairée\n• Ticket complet visible\n• Évitez reflets et ombres\n• Max 5 photos pour longs tickets'
            )}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
          >
            <Icon name="help-circle" size="sm" color={Colors.text.tertiary} />
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
              <Text style={styles.welcomeTitle}>Scannez votre ticket</Text>
              <Text style={styles.welcomeSubtitle}>
                Capturez votre reçu pour analyser vos dépenses
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity
                style={styles.primaryActionButton}
                onPress={() => handleAddPhoto(false)}
                activeOpacity={0.9}
              >
                <Icon name="camera" size="md" color={Colors.white} />
                <Text style={styles.primaryActionText}>Prendre une photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryActionButton}
                onPress={() => handleAddPhoto(true)}
                activeOpacity={0.9}
              >
                <Icon name="image" size="sm" color={Colors.primary} />
                <Text style={styles.secondaryActionText}>Galerie</Text>
              </TouchableOpacity>
            </View>

            {/* Feature Cards */}
            <View style={styles.featureCards}>
              <View style={styles.featureCard}>
                <Icon name="zap" size="md" color={Colors.primary} />
                <Text style={styles.featureTitle}>Rapide</Text>
                <Text style={styles.featureDesc}>En 5 secondes</Text>
              </View>
              <View style={styles.featureCard}>
                <Icon name="shield" size="md" color={Colors.accent} />
                <Text style={styles.featureTitle}>Sécurisé</Text>
                <Text style={styles.featureDesc}>Données cryptées</Text>
              </View>
              <View style={styles.featureCard}>
                <Icon name="globe" size="md" color={Colors.accentLight} />
                <Text style={styles.featureTitle}>Multi-devise</Text>
                <Text style={styles.featureDesc}>USD & CDF</Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Reviewing State - Modern Photo Preview */}
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
            {/* Review Header */}
            <View style={styles.reviewHeader}>
              <View style={styles.reviewHeaderLeft}>
                <View style={styles.reviewBadge}>
                  <Text style={styles.reviewBadgeText}>{photos.length}/{MAX_PHOTOS}</Text>
                </View>
                <View>
                  <Text style={styles.reviewTitle}>
                    {photos.length} photo{photos.length > 1 ? 's' : ''}
                  </Text>
                  <Text style={styles.reviewSubtitle}>
                    {photos.length < MAX_PHOTOS ? 'Ajoutez plus ou analysez' : 'Limite atteinte'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Photo Grid */}
            <View style={styles.photosGridContainer}>
              <View style={styles.photosGrid}>
                {photos.map((photo, index) => (
                  <Animated.View 
                    key={photo.id} 
                    style={[
                      styles.photoCardModern,
                      {transform: [{scale: scaleAnim}]}
                    ]}
                  >
                    <Image source={{uri: photo.uri}} style={styles.photoImageModern} />
                    <View style={styles.photoOverlay}>
                      <View style={styles.photoNumber}>
                        <Text style={styles.photoNumberText}>{index + 1}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.photoDeleteButton}
                        onPress={() => handleRemovePhoto(photo.id)}
                        hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                      >
                        <Icon name="trash-2" size="xs" color={Colors.white} />
                      </TouchableOpacity>
                    </View>
                  </Animated.View>
                ))}

                {photos.length < MAX_PHOTOS && (
                  <TouchableOpacity
                    style={styles.addPhotoCardModern}
                    onPress={() => handleAddPhoto(false)}
                    activeOpacity={0.9}
                  >
                    <View style={styles.addPhotoIconContainer}>
                      <Icon name="plus" size="md" color={Colors.primary} />
                    </View>
                    <Text style={styles.addPhotoTextModern}>Ajouter</Text>
                    <Text style={styles.addPhotoSubtext}>une photo</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Review Actions */}
            <View style={styles.reviewActionsModern}>
              <TouchableOpacity
                style={styles.analyzeButton}
                onPress={handleProcess}
                activeOpacity={0.9}
              >
                <View style={styles.analyzeButtonContent}>
                  <View style={styles.analyzeButtonIcon}>
                    <Icon name="zap" size="md" color={Colors.white} />
                  </View>
                  <View style={styles.analyzeButtonTexts}>
                    <Text style={styles.analyzeButtonText}>Analyser</Text>
                    <Text style={styles.analyzeButtonSubtext}>
                      {photos.length} {photos.length > 1 ? 'photos' : 'photo'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setPhotos([]);
                  setState('idle');
                }}
                activeOpacity={0.9}
              >
                <Text style={styles.cancelButtonText}>Recommencer</Text>
              </TouchableOpacity>
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
            
            {/* Photo Count Badge */}
            <View style={styles.photoCountBadge}>
              <Icon name="image" size="sm" color={Colors.primary} />
              <Text style={styles.photoCountBadgeText}>
                {photos.length} photo{photos.length > 1 ? 's' : ''}
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
        onClose={() => setShowLimitModal(false)}
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
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  scansRemainingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accentLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  scansRemainingText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.accent,
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

  // Modern Review State (Blue Theme)
  reviewContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  reviewHeader: {
    marginBottom: Spacing.xl,
  },
  reviewHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  reviewBadge: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewBadgeText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
  },
  reviewTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.accent,
  },
  reviewSubtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  photosGridContainer: {
    marginBottom: Spacing.lg,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: Spacing.xs,
  },
  photoCardModern: {
    width: (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.xs) / 2,
    height: (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.xs) / 2 * 1.2,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    backgroundColor: Colors.background.secondary,
    ...Shadows.sm,
  },
  photoImageModern: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  photoNumber: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  photoNumberText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
  },
  photoDeleteButton: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.status.error,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  addPhotoCardModern: {
    width: (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.xs) / 2,
    height: (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.xs) / 2 * 1.2,
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.accentLight,
    backgroundColor: '#E5F2F8',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  addPhotoIconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    ...Shadows.sm,
  },
  addPhotoTextModern: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.accent,
    textAlign: 'center',
  },
  addPhotoSubtext: {
    fontSize: Typography.fontSize.sm,
    color: Colors.accentLight,
    textAlign: 'center',
  },
  reviewActionsModern: {
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  analyzeButton: {
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.lg,
  },
  analyzeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  analyzeButtonIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyzeButtonTexts: {
    alignItems: 'center',
  },
  analyzeButtonText: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
  },
  analyzeButtonSubtext: {
    fontSize: Typography.fontSize.sm,
    color: 'rgba(255,255,255,0.9)',
  },
  cancelButton: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 2,
    borderColor: Colors.accentLight,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.accent,
  },

  // Processing State
  processingContainer: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing['2xl'],
    paddingBottom: Spacing.xl,
    justifyContent: 'center',
  },
  photoCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: Colors.white,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.xl,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  photoCountBadgeText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.primary,
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
});
