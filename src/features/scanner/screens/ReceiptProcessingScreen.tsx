import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  BackHandler,
  TouchableOpacity,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {Button, Icon} from '@/shared/components';

const {height: screenHeight} = Dimensions.get('window');

interface ProcessingStep {
  id: string;
  title: string;
  description: string;
  duration: number; // in milliseconds
  icon: string;
}

const processingSteps: ProcessingStep[] = [
  {
    id: 'capture',
    title: 'Receipt Captured',
    description: 'Image successfully captured and prepared',
    duration: 800,
    icon: 'camera',
  },
  {
    id: 'scanning',
    title: 'Text Recognition',
    description: 'AI is reading and extracting text from your receipt',
    duration: 2000,
    icon: 'scan',
  },
  {
    id: 'extraction',
    title: 'Data Extraction',
    description: 'Identifying items, prices, and store information',
    duration: 1500,
    icon: 'list',
  },
  {
    id: 'classification',
    title: 'Item Classification',
    description: 'Categorizing products and organizing data',
    duration: 1200,
    icon: 'tag',
  },
  {
    id: 'analysis',
    title: 'Price Analysis',
    description: 'Comparing prices and finding savings opportunities',
    duration: 1000,
    icon: 'trending-up',
  },
  {
    id: 'complete',
    title: 'Processing Complete',
    description: 'Your receipt is ready for review!',
    duration: 500,
    icon: 'check-circle',
  },
];

interface ReceiptProcessingScreenProps {
  receiptId?: string;
  receiptImage?: string;
  onComplete?: (processedData: any) => void;
  onCancel?: () => void;
}

const ReceiptProcessingScreen: React.FC<ReceiptProcessingScreenProps> = ({
  receiptId,
  receiptImage,
  onComplete,
  onCancel,
}) => {
  const navigation = useNavigation();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(true);
  const [processingCancelled, setProcessingCancelled] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate screen entry
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Start processing steps
    processNextStep();
  }, []);

  useEffect(() => {
    // Handle hardware back button
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackPress,
    );

    return () => backHandler.remove();
  }, []);

  const handleBackPress = () => {
    if (isProcessing) {
      handleCancel();
      return true; // Prevent default behavior
    }
    return false;
  };

  const processNextStep = async () => {
    if (currentStepIndex >= processingSteps.length || processingCancelled) {
      return;
    }

    const currentStep = processingSteps[currentStepIndex];

    // Animate progress bar
    Animated.timing(progressAnim, {
      toValue: (currentStepIndex + 1) / processingSteps.length,
      duration: currentStep.duration,
      useNativeDriver: false,
    }).start();

    // Wait for step duration
    await new Promise<void>(resolve => setTimeout(resolve, currentStep.duration));

    if (!processingCancelled) {
      // Mark step as completed
      setCompletedSteps(prev => [...prev, currentStep.id]);

      if (currentStepIndex === processingSteps.length - 1) {
        // All steps completed
        setIsProcessing(false);
        
        // Simulate processed data
        const processedData = {
          receiptId: receiptId || Date.now().toString(),
          items: [],
          total: 0,
          store: 'Sample Store',
          date: new Date(),
        };

        setTimeout(() => {
          onComplete?.(processedData);
        }, 1000);
      } else {
        // Move to next step
        setCurrentStepIndex(prev => prev + 1);
        setTimeout(() => processNextStep(), 200);
      }
    }
  };

  const handleCancel = () => {
    setProcessingCancelled(true);
    setIsProcessing(false);
    onCancel?.();
  };

  const renderStep = (step: ProcessingStep, index: number) => {
    const isCompleted = completedSteps.includes(step.id);
    const isCurrent = index === currentStepIndex && isProcessing;
    const isPending = index > currentStepIndex;

    return (
      <Animated.View
        key={step.id}
        style={[
          styles.stepContainer,
          {
            opacity: fadeAnim,
            transform: [{scale: scaleAnim}],
          },
        ]}>
        {/* Timeline line */}
        {index < processingSteps.length - 1 && (
          <View style={styles.timelineLine} />
        )}

        {/* Step content */}
        <View style={styles.stepContent}>
          {/* Time indicator */}
          <View style={styles.timeContainer}>
            <Text style={styles.timeText}>
              {new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>

          {/* Status circle */}
          <View
            style={[
              styles.statusCircle,
              isCompleted && styles.statusCircleCompleted,
              isCurrent && styles.statusCircleCurrent,
              isPending && styles.statusCirclePending,
            ]}>
            {isCompleted ? (
              <Icon
                name="check"
                size="sm"
                color={Colors.white}
              />
            ) : isCurrent ? (
              <Animated.View style={styles.currentIndicator}>
                <Icon
                  name="loader"
                  size="sm"
                  color={Colors.white}
                />
              </Animated.View>
            ) : (
              <Icon
                name={step.icon}
                size="sm"
                color={Colors.text.tertiary}
              />
            )}
          </View>

          {/* Step details */}
          <View style={styles.stepDetails}>
            <Text
              style={[
                styles.stepTitle,
                isCompleted && styles.stepTitleCompleted,
                isCurrent && styles.stepTitleCurrent,
              ]}>
              {step.title}
            </Text>
            <Text
              style={[
                styles.stepDescription,
                isCurrent && styles.stepDescriptionCurrent,
              ]}>
              {step.description}
            </Text>
          </View>
        </View>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[Colors.primary, Colors.secondary]}
        style={styles.header}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 0}}>
        <View style={styles.headerContent}>
          <Animated.View
            style={[
              styles.headerLeft,
              {
                opacity: fadeAnim,
                transform: [{translateX: Animated.multiply(fadeAnim, -20)}],
              },
            ]}>
            <TouchableOpacity
              onPress={handleCancel}
              style={styles.backButton}
              activeOpacity={0.7}>
              <Icon name="arrow-left" size="md" color={Colors.white} />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View
            style={[
              styles.headerCenter,
              {
                opacity: fadeAnim,
                transform: [{scale: scaleAnim}],
              },
            ]}>
            <Text style={styles.headerTitle}>Processing Receipt</Text>
            <Text style={styles.headerSubtitle}>
              AI is analyzing your receipt...
            </Text>
          </Animated.View>

          <View style={styles.headerRight} />
        </View>

        {/* Progress bar */}
        <Animated.View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
        </Animated.View>
      </LinearGradient>

      {/* Content */}
      <View style={styles.content}>
        {/* Processing steps */}
        <View style={styles.stepsContainer}>
          {processingSteps.map((step, index) => renderStep(step, index))}
        </View>

        {/* Bottom action */}
        {!isProcessing && (
          <Animated.View
            style={[
              styles.bottomAction,
              {
                opacity: fadeAnim,
                transform: [{translateY: Animated.multiply(fadeAnim, 50)}],
              },
            ]}>
            <View style={styles.successContainer}>
              <View style={styles.successIconContainer}>
                <Icon
                  name="check-circle"
                  size="xl"
                  color={Colors.status.success}
                />
              </View>
              <Text style={styles.successText}>
                Receipt processed successfully!
              </Text>
              <Text style={styles.successSubtext}>
                Your receipt data is ready for review
              </Text>
            </View>
          </Animated.View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  header: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
    ...Shadows.md,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerLeft: {
    width: 40,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerRight: {
    width: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.white,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  progressContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.white,
    borderRadius: 2,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  stepsContainer: {
    flex: 1,
  },
  stepContainer: {
    position: 'relative',
    marginBottom: Spacing.lg,
  },
  timelineLine: {
    position: 'absolute',
    left: 64,
    top: 40,
    bottom: -Spacing.lg,
    width: 2,
    backgroundColor: Colors.border.light,
  },
  stepContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timeContainer: {
    width: 50,
    alignItems: 'flex-end',
    paddingRight: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  timeText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text.tertiary,
  },
  statusCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.border.light,
  },
  statusCircleCompleted: {
    backgroundColor: Colors.status.success,
    borderColor: Colors.status.success,
  },
  statusCircleCurrent: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  statusCirclePending: {
    backgroundColor: Colors.background.tertiary,
    borderColor: Colors.border.medium,
  },
  currentIndicator: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDetails: {
    flex: 1,
    paddingTop: Spacing.xs,
  },
  stepTitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  stepTitleCompleted: {
    color: Colors.text.primary,
  },
  stepTitleCurrent: {
    color: Colors.primary,
  },
  stepDescription: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.tertiary,
    lineHeight: 20,
  },
  stepDescriptionCurrent: {
    color: Colors.text.secondary,
  },
  bottomAction: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
  },
  successContainer: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
  },
  successIconContainer: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    backgroundColor: Colors.background.primary,
    borderRadius: BorderRadius.full,
  },
  successText: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  successSubtext: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
});

export default ReceiptProcessingScreen;