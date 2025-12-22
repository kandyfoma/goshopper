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
import {Icon, ScanProgressIndicator} from '@/shared/components';
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
): Promise<{isDuplicate: boolean; existingReceipt?: any}> {
  try {
    // Get recent receipts from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const receiptsSnapshot = await firestore()
      .collection(`artifacts/${APP_ID}/users/${userId}/receipts`)
      .where('scannedAt', '>=', firestore.Timestamp.fromDate(thirtyDaysAgo))
      .get();

    // Check for exact matches
    for (const doc of receiptsSnapshot.docs) {
      const existingReceipt = doc.data();
      
      // Match criteria: same store, same date, same total, or same receipt number
      const sameStore = existingReceipt.storeName?.toLowerCase() === receipt.storeName?.toLowerCase();
      const sameTotal = Math.abs((existingReceipt.total || 0) - (receipt.total || 0)) < 0.01;
      const sameReceiptNumber = receipt.receiptNumber && 
                                 existingReceipt.receiptNumber === receipt.receiptNumber;
      
      // Check date similarity (same day)
      let sameDate = false;
      if (existingReceipt.scannedAt && receipt.date) {
        const existingDate = existingReceipt.scannedAt.toDate();
        const newDate = new Date(receipt.date);
        sameDate = 
          existingDate.getFullYear() === newDate.getFullYear() &&
          existingDate.getMonth() === newDate.getMonth() &&
          existingDate.getDate() === newDate.getDate();
      }

      // If any strong match found, consider it a duplicate
      if (sameReceiptNumber || (sameStore && sameDate && sameTotal)) {
        return {
          isDuplicate: true,
          existingReceipt: {
            ...existingReceipt,
            date: existingReceipt.scannedAt?.toDate(),
          },
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

  // State
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [state, setState] = useState<ScanState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [processingStep, setProcessingStep] = useState(0);

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
      Alert.alert(
        'Limite atteinte',
        isTrialActive
          ? 'Passez à Premium pour continuer à scanner.'
          : 'Vous avez atteint votre limite de scans. Passez à Premium pour continuer.',
        [
          {text: 'Annuler', style: 'cancel'},
          {text: 'Voir Premium', onPress: () => navigation.push('Subscription')},
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

  // Process photos
  const handleProcess = useCallback(async (): Promise<void> => {
    if (photos.length === 0) {
      showToast('Prenez au moins une photo', 'error');
      return;
    }

    // Validate subscription before processing (double-check)
    if (!canScan) {
      analyticsService.logCustomEvent('scan_blocked_no_scans');
      Alert.alert(
        'Limite atteinte',
        isTrialActive
          ? `Vous avez utilisé vos scans gratuits pour ce mois. Passez à Premium pour continuer.`
          : 'Vous avez atteint votre limite de scans. Passez à Premium pour continuer.',
        [
          {text: 'Annuler', style: 'cancel'},
          {text: 'Voir Premium', onPress: () => navigation.push('Subscription')},
        ]
      );
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

    setState('processing');
    setError(null);
    setLoadingMessageIndex(0);
    setProcessingStep(0);
    retryCountRef.current = 0;

    try {
      // Step 1: Compression
      setProcessingStep(0);
      await new Promise<void>(r => setTimeout(r, 500)); // Visual feedback
      
      // Generate base64 from URIs on-demand to avoid memory issues
      const images = await Promise.all(
        photos.map(p => imageCompressionService.compressToBase64(p.uri))
      );

      // Step 2: Detection
      setProcessingStep(1);
      await new Promise<void>(r => setTimeout(r, 500));
      
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

      // Step 3: Extraction
      setProcessingStep(2);

      if (images.length === 1) {
        // Single photo - use hybrid processing (local + AI fallback)
        console.log('Using hybrid receipt processor...');
        const response = await hybridReceiptProcessor.processReceipt(
          images[0],
          user?.uid || 'unknown-user',
          profile?.defaultCity
        );

        if (response.success && response.receipt) {
          // Step 4: Validation
          setProcessingStep(3);
          await new Promise<void>(r => setTimeout(r, 400));
          
          // Add user's default city if receipt doesn't have a city
          if (!response.receipt.city && profile?.defaultCity) {
            response.receipt.city = profile.defaultCity;
            // Also add city to all items
            if (response.receipt.items) {
              response.receipt.items = response.receipt.items.map(item => ({
                ...item,
                city: profile.defaultCity
              }));
            }
          }
          
          // Step 5: Finalization
          setProcessingStep(4);
          await new Promise<void>(r => setTimeout(r, 400));
          
          // Check for duplicates using processed receipt data
          if (user?.uid && response.receipt) {
            const duplicateCheck = await checkProcessedReceiptDuplicate(
              response.receipt,
              user.uid
            );
            
            if (duplicateCheck.isDuplicate) {
              const shouldProceed = await new Promise<boolean>(resolve => {
                Alert.alert(
                  'Reçu déjà scanné',
                  `Ce reçu a déjà été scanné:\n\n` +
                  `Magasin: ${duplicateCheck.existingReceipt?.storeName}\n` +
                  `Date: ${duplicateCheck.existingReceipt?.date ? new Date(duplicateCheck.existingReceipt.date).toLocaleDateString('fr-FR') : 'N/A'}\n` +
                  `Montant: ${duplicateCheck.existingReceipt?.total} ${duplicateCheck.existingReceipt?.currency}\n\n` +
                  `Voulez-vous quand même l'enregistrer ?`,
                  [
                    {text: 'Annuler', style: 'cancel', onPress: () => resolve(false)},
                    {text: 'Enregistrer quand même', style: 'destructive', onPress: () => resolve(true)},
                  ]
                );
              });

              if (!shouldProceed) {
                // User cancelled - don't save or record scan
                setState('idle');
                setPhotos([]);
                return;
              }
            }
          }
          
          // Save the receipt to Firestore
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

          console.log('📸 About to record scan...');
          const scanRecorded = await recordScan();
          console.log('📸 Scan recorded result:', scanRecorded);

          if (!scanRecorded) {
            console.error('⚠️ Failed to record scan usage');
          }

          analyticsService.logCustomEvent('scan_completed', {
            success: true,
            photo_count: 1,
            items_count: response.receipt.items?.length || 0,
            processing_method: 'hybrid', // Track that hybrid processing was used
          });

          // Success haptic feedback
          hapticService.success();
          setState('success');

          // Track scan for in-app review
          inAppReviewService.incrementScanCount().then(() => {
            inAppReviewService.requestReviewIfAppropriate();
          });

          // Show success toast before navigation
          showToast('Reçu analysé avec succès!', 'success', 2000);

          // Navigate after animation
          setTimeout(() => {
            navigation.navigate('ReceiptDetail', {
              receiptId: savedReceiptId,
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
          console.log('📸 About to record scan (multiple photos)...');
          const scanRecorded = await recordScan();
          console.log('📸 Scan recorded result (multiple photos):', scanRecorded);

          if (!scanRecorded) {
            console.error('⚠️ Failed to record scan usage (multiple photos)');
          }

          analyticsService.logCustomEvent('scan_completed', {
            success: true,
            photo_count: images.length,
          });

          // Success haptic feedback
          hapticService.success();
          setState('success');

          // Track scan for in-app review
          inAppReviewService.incrementScanCount().then(() => {
            inAppReviewService.requestReviewIfAppropriate();
          });

          // Show success toast before navigation
          showToast('Reçu analysé avec succès!', 'success', 2000);

          const receiptId = result.receiptId;
          setTimeout(() => {
            navigation.navigate('ReceiptDetail', {
              receiptId: receiptId,
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
      // Error haptic feedback
      hapticService.error();
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
        {/* Idle State - Modern Welcome */}
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
            {/* Hero Illustration */}
            <View style={styles.heroContainer}>
              <Animated.View style={[styles.heroCircle, {transform: [{scale: pulseAnim}]}]}>
                <Icon name="camera" size="3xl" color={Colors.primary} />
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
                <Icon name="cpu" size="md" color={Colors.primary} />
                <Text style={styles.featureTitle}>IA Puissante</Text>
                <Text style={styles.featureDesc}>Extraction auto</Text>
              </View>
              <View style={styles.featureCard}>
                <Icon name="trending-up" size="md" color={Colors.primary} />
                <Text style={styles.featureTitle}>Suivi Budget</Text>
                <Text style={styles.featureDesc}>Vos dépenses</Text>
              </View>
              <View style={styles.featureCard}>
                <Icon name="dollar-sign" size="md" color={Colors.primary} />
                <Text style={styles.featureTitle}>Économies</Text>
                <Text style={styles.featureDesc}>Comparez</Text>
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
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photosGrid}
              decelerationRate="fast"
              snapToInterval={SCREEN_WIDTH * 0.85}
            >
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
                      hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                    >
                      <Icon name="trash-2" size="sm" color={Colors.white} />
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
                    <Icon name="plus" size="lg" color={Colors.primary} />
                  </View>
                  <Text style={styles.addPhotoTextModern}>Ajouter</Text>
                  <Text style={styles.addPhotoSubtext}>une photo</Text>
                </TouchableOpacity>
              )}
            </ScrollView>

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

  // Modern Idle State
  idleContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  heroContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  heroCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.card.blue,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  welcomeTextContainer: {
    marginBottom: Spacing.xl,
  },
  welcomeTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
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
  
  // Action Buttons
  actionButtonsContainer: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
    ...Shadows.md,
  },
  primaryActionText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.white,
  },
  secondaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 2,
    borderColor: Colors.border.light,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  secondaryActionText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.primary,
  },
  
  // Feature Cards
  featureCards: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  featureCard: {
    flex: 1,
    backgroundColor: Colors.card.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
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

  // Modern Review State
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
    backgroundColor: Colors.primary,
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
    color: Colors.text.primary,
  },
  reviewSubtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  photosGrid: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    gap: Spacing.md,
  },
  photoCardModern: {
    width: SCREEN_WIDTH * 0.7,
    height: SCREEN_WIDTH * 0.85,
    borderRadius: BorderRadius['2xl'],
    overflow: 'hidden',
    backgroundColor: Colors.background.secondary,
    ...Shadows.md,
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
    padding: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  photoNumber: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md,
  },
  photoNumberText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
  },
  photoDeleteButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.status.error,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md,
  },
  addPhotoCardModern: {
    width: SCREEN_WIDTH * 0.75,
    height: SCREEN_WIDTH * 0.95,
    borderRadius: BorderRadius['2xl'],
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  addPhotoIconContainer: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  addPhotoTextModern: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
  },
  addPhotoSubtext: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
  },
  reviewActionsModern: {
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  analyzeButton: {
    backgroundColor: Colors.primary,
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
    borderColor: Colors.border.light,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.secondary,
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
