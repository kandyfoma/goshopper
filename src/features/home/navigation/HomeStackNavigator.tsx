// Home Stack Navigator - Nested navigation for Home tab including Shops
import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {HomeScreen} from '../screens';
import {ShopsScreen, ShopDetailScreen} from '@/features/shops/screens';

export type HomeStackParamList = {
  HomeMain: undefined;
  Shops: undefined;
  ShopDetail: {shopId: string; shopName: string};
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="Shops" component={ShopsScreen} />
      <Stack.Screen name="ShopDetail" component={ShopDetailScreen} />
    </Stack.Navigator>
  );
}
