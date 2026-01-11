// Scroll Context for sharing scroll position across screens
import React, {createContext, useContext, useRef} from 'react';
import {Animated} from 'react-native';

interface ScrollContextType {
  scrollY: Animated.Value;
}

const ScrollContext = createContext<ScrollContextType | undefined>(undefined);

export function ScrollProvider({children}: {children: React.ReactNode}) {
  const scrollY = useRef(new Animated.Value(0)).current;

  return (
    <ScrollContext.Provider value={{scrollY}}>
      {children}
    </ScrollContext.Provider>
  );
}

export function useScroll() {
  const context = useContext(ScrollContext);
  if (context === undefined) {
    throw new Error('useScroll must be used within a ScrollProvider');
  }
  return context;
}