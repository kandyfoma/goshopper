// Shops Stack Navigator - Nested navigation for Shops (accessed from Home)
import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {ShopsScreen, ShopDetailScreen} from '../screens';

export type ShopsStackParamList = {
  ShopsMain: undefined;
  ShopDetail: {shopId: string; shopName: string};
};

const Stack = createNativeStackNavigator<ShopsStackParamList>();

export function ShopsStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}>
      <Stack.Screen name="ShopsMain" component={ShopsScreen} />
      <Stack.Screen name="ShopDetail" component={ShopDetailScreen} />
    </Stack.Navigator>
  );
}
