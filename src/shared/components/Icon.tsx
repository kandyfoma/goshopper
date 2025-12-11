/**
 * Icon Component
 * 
 * Modern, sleek SVG icons with outline (empty) and filled (full) variants
 * Clean line-drawn style inspired by Feather/Lucide icons
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Path, Circle, Rect, Polyline, Line } from 'react-native-svg';
import { Colors, Layout, BorderRadius } from '../theme/theme';

type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
type IconVariant = 'outline' | 'filled';

interface IconProps {
  name: string;
  size?: IconSize;
  color?: string;
  variant?: IconVariant;
  style?: ViewStyle;
}

// SVG icon paths - clean line-drawn style
const iconPaths: Record<string, { outline: React.ReactNode; filled?: React.ReactNode }> = {
  // Navigation
  home: {
    outline: (
      <>
        <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeLinecap="round" strokeLinejoin="round" />
        <Polyline points="9 22 9 12 15 12 15 22" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    filled: (
      <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="currentColor" />
    ),
  },
  receipt: {
    outline: (
      <>
        <Path d="M4 2v20l4-2 4 2 4-2 4 2V2l-4 2-4-2-4 2z" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="8" y1="10" x2="16" y2="10" strokeLinecap="round" />
        <Line x1="8" y1="14" x2="14" y2="14" strokeLinecap="round" />
      </>
    ),
    filled: (
      <Path d="M4 2v20l4-2 4 2 4-2 4 2V2l-4 2-4-2-4 2z" fill="currentColor" />
    ),
  },
  stats: {
    outline: (
      <>
        <Line x1="18" y1="20" x2="18" y2="10" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="12" y1="20" x2="12" y2="4" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="6" y1="20" x2="6" y2="14" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    filled: (
      <>
        <Rect x="16" y="10" width="4" height="10" rx="1" fill="currentColor" />
        <Rect x="10" y="4" width="4" height="16" rx="1" fill="currentColor" />
        <Rect x="4" y="14" width="4" height="6" rx="1" fill="currentColor" />
      </>
    ),
  },
  cart: {
    outline: (
      <>
        <Circle cx="9" cy="21" r="1" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx="20" cy="21" r="1" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    filled: (
      <>
        <Circle cx="9" cy="21" r="1.5" fill="currentColor" />
        <Circle cx="20" cy="21" r="1.5" fill="currentColor" />
        <Path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" fill="currentColor" fillOpacity="0.2" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  user: {
    outline: (
      <>
        <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx="12" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    filled: (
      <>
        <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" fill="currentColor" />
        <Circle cx="12" cy="7" r="4" fill="currentColor" />
      </>
    ),
  },
  settings: {
    outline: (
      <>
        <Circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  // Actions
  camera: {
    outline: (
      <>
        <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx="12" cy="13" r="4" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    filled: (
      <>
        <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" fill="currentColor" />
        <Circle cx="12" cy="13" r="4" fill="white" />
      </>
    ),
  },
  search: {
    outline: (
      <>
        <Circle cx="11" cy="11" r="8" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="21" y1="21" x2="16.65" y2="16.65" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  plus: {
    outline: (
      <>
        <Line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  edit: {
    outline: (
      <>
        <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  trash: {
    outline: (
      <>
        <Polyline points="3 6 5 6 21 6" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="10" y1="11" x2="10" y2="17" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="14" y1="11" x2="14" y2="17" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  share: {
    outline: (
      <>
        <Circle cx="18" cy="5" r="3" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx="6" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx="18" cy="19" r="3" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="8.59" y1="13.51" x2="15.42" y2="17.49" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="15.41" y1="6.51" x2="8.59" y2="10.49" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  filter: {
    outline: (
      <Polyline points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" strokeLinecap="round" strokeLinejoin="round" />
    ),
    filled: (
      <Path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" fill="currentColor" />
    ),
  },
  // Status
  'check-circle': {
    outline: (
      <>
        <Path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" strokeLinejoin="round" />
        <Polyline points="22 4 12 14.01 9 11.01" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    filled: (
      <>
        <Circle cx="12" cy="12" r="10" fill="currentColor" />
        <Polyline points="22 4 12 14.01 9 11.01" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  'alert-triangle': {
    outline: (
      <>
        <Path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="12" y1="9" x2="12" y2="13" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  'x-circle': {
    outline: (
      <>
        <Circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="15" y1="9" x2="9" y2="15" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="9" y1="9" x2="15" y2="15" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  info: {
    outline: (
      <>
        <Circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="12" y1="16" x2="12" y2="12" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="12" y1="8" x2="12.01" y2="8" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  // UI / Chevrons
  'chevron-right': {
    outline: (
      <Polyline points="9 18 15 12 9 6" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  'chevron-left': {
    outline: (
      <Polyline points="15 18 9 12 15 6" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  'chevron-up': {
    outline: (
      <Polyline points="18 15 12 9 6 15" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  'chevron-down': {
    outline: (
      <Polyline points="6 9 12 15 18 9" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  x: {
    outline: (
      <>
        <Line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  menu: {
    outline: (
      <>
        <Line x1="3" y1="12" x2="21" y2="12" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="3" y1="6" x2="21" y2="6" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="3" y1="18" x2="21" y2="18" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  'more-horizontal': {
    outline: (
      <>
        <Circle cx="12" cy="12" r="1" fill="currentColor" />
        <Circle cx="19" cy="12" r="1" fill="currentColor" />
        <Circle cx="5" cy="12" r="1" fill="currentColor" />
      </>
    ),
  },
  // Features
  bell: {
    outline: (
      <>
        <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    filled: (
      <>
        <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" fill="currentColor" />
        <Path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  tag: {
    outline: (
      <>
        <Path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="7" y1="7" x2="7.01" y2="7" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  'trending-down': {
    outline: (
      <>
        <Polyline points="23 18 13.5 8.5 8.5 13.5 1 6" strokeLinecap="round" strokeLinejoin="round" />
        <Polyline points="17 18 23 18 23 12" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  'trending-up': {
    outline: (
      <>
        <Polyline points="23 6 13.5 15.5 8.5 10.5 1 18" strokeLinecap="round" strokeLinejoin="round" />
        <Polyline points="17 6 23 6 23 12" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  'map-pin': {
    outline: (
      <>
        <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx="12" cy="10" r="3" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    filled: (
      <>
        <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="currentColor" />
        <Circle cx="12" cy="10" r="3" fill="white" />
      </>
    ),
  },
  'shopping-bag': {
    outline: (
      <>
        <Path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="3" y1="6" x2="21" y2="6" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M16 10a4 4 0 0 1-8 0" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  calendar: {
    outline: (
      <>
        <Rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="3" y1="10" x2="21" y2="10" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  wallet: {
    outline: (
      <>
        <Rect x="1" y="4" width="22" height="16" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="1" y1="10" x2="23" y2="10" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  'credit-card': {
    outline: (
      <>
        <Rect x="1" y="4" width="22" height="16" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="1" y1="10" x2="23" y2="10" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  // Additional
  star: {
    outline: (
      <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinecap="round" strokeLinejoin="round" />
    ),
    filled: (
      <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor" />
    ),
  },
  heart: {
    outline: (
      <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" strokeLinecap="round" strokeLinejoin="round" />
    ),
    filled: (
      <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="currentColor" />
    ),
  },
  gift: {
    outline: (
      <>
        <Polyline points="20 12 20 22 4 22 4 12" strokeLinecap="round" strokeLinejoin="round" />
        <Rect x="2" y="7" width="20" height="5" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="12" y1="22" x2="12" y2="7" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  trophy: {
    outline: (
      <>
        <Path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M4 22h16" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M18 2H6v7a6 6 0 0 0 12 0V2z" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  check: {
    outline: (
      <Polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  'arrow-right': {
    outline: (
      <>
        <Line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" strokeLinejoin="round" />
        <Polyline points="12 5 19 12 12 19" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  'arrow-left': {
    outline: (
      <>
        <Line x1="19" y1="12" x2="5" y2="12" strokeLinecap="round" strokeLinejoin="round" />
        <Polyline points="12 19 5 12 12 5" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  clock: {
    outline: (
      <>
        <Circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
        <Polyline points="12 6 12 12 16 14" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  dollar: {
    outline: (
      <>
        <Line x1="12" y1="1" x2="12" y2="23" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  'file-text': {
    outline: (
      <>
        <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
        <Polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="16" y1="13" x2="8" y2="13" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="16" y1="17" x2="8" y2="17" strokeLinecap="round" strokeLinejoin="round" />
        <Polyline points="10 9 9 9 8 9" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  eye: {
    outline: (
      <>
        <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  'eye-off': {
    outline: (
      <>
        <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  lock: {
    outline: (
      <>
        <Rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  unlock: {
    outline: (
      <>
        <Rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M7 11V7a5 5 0 0 1 9.9-1" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  logout: {
    outline: (
      <>
        <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
        <Polyline points="16 17 21 12 16 7" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="21" y1="12" x2="9" y2="12" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  refresh: {
    outline: (
      <>
        <Polyline points="23 4 23 10 17 10" strokeLinecap="round" strokeLinejoin="round" />
        <Polyline points="1 20 1 14 7 14" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  download: {
    outline: (
      <>
        <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
        <Polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  upload: {
    outline: (
      <>
        <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
        <Polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  image: {
    outline: (
      <>
        <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
        <Polyline points="21 15 16 10 5 21" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  copy: {
    outline: (
      <>
        <Rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  mail: {
    outline: (
      <>
        <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" strokeLinecap="round" strokeLinejoin="round" />
        <Polyline points="22 6 12 13 2 6" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  phone: {
    outline: (
      <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  help: {
    outline: (
      <>
        <Circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  globe: {
    outline: (
      <>
        <Circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="2" y1="12" x2="22" y2="12" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  // Onboarding & Auth
  hand: {
    outline: (
      <>
        <Path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M18 8a2 2 0 0 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    filled: (
      <>
        <Path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2" fill="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2" fill="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8" fill="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M18 8a2 2 0 0 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" fill="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  sparkles: {
    outline: (
      <>
        <Path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.64 5.64l2.83 2.83M15.54 15.54l2.83 2.83M5.64 18.36l2.83-2.83M15.54 8.46l2.83-2.83" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    filled: (
      <>
        <Path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.64 5.64l2.83 2.83M15.54 15.54l2.83 2.83M5.64 18.36l2.83-2.83M15.54 8.46l2.83-2.83" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx="12" cy="12" r="3" fill="currentColor" />
      </>
    ),
  },
  rocket: {
    outline: (
      <>
        <Path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  'user-plus': {
    outline: (
      <>
        <Path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx="8.5" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="20" y1="8" x2="20" y2="14" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="23" y1="11" x2="17" y2="11" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    filled: (
      <>
        <Path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" fill="currentColor" />
        <Circle cx="8.5" cy="7" r="4" fill="currentColor" />
        <Line x1="20" y1="8" x2="20" y2="14" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="23" y1="11" x2="17" y2="11" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  'alert-circle': {
    outline: (
      <>
        <Circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="12" y1="8" x2="12" y2="12" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  apple: {
    outline: (
      <Path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  google: {
    outline: (
      <>
        <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
      </>
    ),
  },
  'shopping-bag': {
    outline: (
      <>
        <Path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="3" y1="6" x2="21" y2="6" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M16 10a4 4 0 0 1-8 0" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
};

const Icon: React.FC<IconProps> = ({
  name,
  size = 'md',
  color = Colors.text.primary,
  variant = 'outline',
  style,
}) => {
  const getSizeValue = () => Layout.iconSize[size];
  const sizeValue = getSizeValue();
  
  const iconData = iconPaths[name];
  
  // Fallback for unknown icons
  if (!iconData) {
    return (
      <View style={[styles.container, { width: sizeValue, height: sizeValue }, style]}>
        <Svg width={sizeValue} height={sizeValue} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
        </Svg>
      </View>
    );
  }

  const iconContent = variant === 'filled' && iconData.filled 
    ? iconData.filled 
    : iconData.outline;

  return (
    <View style={[styles.container, { width: sizeValue, height: sizeValue }, style]}>
      <Svg 
        width={sizeValue} 
        height={sizeValue} 
        viewBox="0 0 24 24" 
        fill="none"
        stroke={color}
        strokeWidth="2"
      >
        {iconContent}
      </Svg>
    </View>
  );
};

// Icon with background container
interface IconBoxProps extends IconProps {
  backgroundColor?: string;
  containerStyle?: ViewStyle;
}

export const IconBox: React.FC<IconBoxProps> = ({
  name,
  size = 'md',
  color = Colors.primary,
  variant = 'outline',
  backgroundColor = Colors.background.secondary,
  containerStyle,
}) => {
  const containerSize = Layout.iconSize[size] * 2;

  return (
    <View
      style={[
        styles.iconBox,
        {
          width: containerSize,
          height: containerSize,
          backgroundColor,
          borderRadius: BorderRadius.base,
        },
        containerStyle,
      ]}
    >
      <Icon name={name} size={size} color={color} variant={variant} />
    </View>
  );
};

// Circular icon (for avatars, badges)
export const IconCircle: React.FC<IconBoxProps> = ({
  name,
  size = 'md',
  color = Colors.white,
  variant = 'outline',
  backgroundColor = Colors.primary,
  containerStyle,
}) => {
  const containerSize = Layout.iconSize[size] * 2;

  return (
    <View
      style={[
        styles.iconCircle,
        {
          width: containerSize,
          height: containerSize,
          backgroundColor,
        },
        containerStyle,
      ]}
    >
      <Icon name={name} size={size} color={color} variant={variant} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
});

export default Icon;
