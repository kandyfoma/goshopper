// Swipe to Delete Component
// Provides swipe gesture UI with delete action

import React, {useRef, useState, ReactNode} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import {
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
  State,
} from 'react-native-gesture-handler';
import Icon from './Icon';
import {Colors, Typography, Spacing, BorderRadius} from '@/shared/theme/theme';
import {hapticService} from '@/shared/services';

interface SwipeToDeleteProps {
  children: ReactNode;
  onDelete: () => void | Promise<void>;
  isDeleting?: boolean;
  deleteLabel?: string;
  swipeThreshold?: number;
  style?: ViewStyle;
  testID?: string;
}

export function SwipeToDelete({
  children,
  onDelete,
  isDeleting = false,
  deleteLabel = 'Supprimer',
  swipeThreshold = 40,
  style,
  testID,
}: SwipeToDeleteProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const lastOffset = useRef(0);
  const [isOpen, setIsOpen] = useState(false);
  const panRef = useRef<any>(null);

  const onGestureEvent = (event: PanGestureHandlerGestureEvent) => {
    const {translationX} = event.nativeEvent;
    const newValue = Math.min(0, Math.max(-80, lastOffset.current + translationX));
    translateX.setValue(newValue);
  };

  const onHandlerStateChange = (event: PanGestureHandlerGestureEvent) => {
    if (event.nativeEvent.state === State.END) {
      const {translationX, velocityX} = event.nativeEvent;
      const currentPosition = lastOffset.current + translationX;
      
      // Determine whether to open or close based on position and velocity
      let shouldOpen = false;
      
      if (velocityX < -500) {
        // Fast swipe left - open
        shouldOpen = true;
      } else if (velocityX > 500) {
        // Fast swipe right - close
        shouldOpen = false;
      } else {
        // Based on position
        shouldOpen = currentPosition < -40;
      }

      if (shouldOpen) {
        // Open - reveal delete button
        hapticService.light();
        lastOffset.current = -80;
        setIsOpen(true);
        Animated.spring(translateX, {
          toValue: -80,
          useNativeDriver: true,
          tension: 100,
          friction: 10,
        }).start();
      } else {
        // Close - hide delete button
        lastOffset.current = 0;
        setIsOpen(false);
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 10,
        }).start();
      }
    }
  };

  const handleDelete = async () => {
    hapticService.medium();
    try {
      await onDelete();
    } catch (error) {
      console.error('Delete error:', error);
      // Reset animation on error
      lastOffset.current = 0;
      setIsOpen(false);
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleContentPress = () => {
    // If open, close it when tapping the content
    if (isOpen) {
      lastOffset.current = 0;
      setIsOpen(false);
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 10,
      }).start();
    }
  };

  return (
    <View style={[styles.container, style]} testID={testID}>
      {/* Delete action - only visible when swiped */}
      <View style={styles.deleteAction}>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          disabled={isDeleting}
          activeOpacity={0.8}>
          <Icon name="trash-2" size="sm" color={Colors.white} />
        </TouchableOpacity>
      </View>

      <PanGestureHandler
        ref={panRef}
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
        activeOffsetX={[-10, 10]}
        failOffsetY={[-15, 15]}>
        <Animated.View
          style={[
            styles.content,
            {
              transform: [{translateX}],
            },
          ]}>
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={handleContentPress}
            disabled={!isOpen}>
            {children}
          </TouchableOpacity>
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: BorderRadius.base,
    position: 'relative',
  },
  content: {
    backgroundColor: Colors.background.primary,
    zIndex: 1,
  },
  deleteAction: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderTopRightRadius: BorderRadius.base,
    borderBottomRightRadius: BorderRadius.base,
  },
  deleteButton: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SwipeToDelete;
