// Items Stack Navigator - Nested navigation for Items tab including item details
import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {CityItemsScreen, CityItemDetailScreen, ItemsScreen} from '../screens';

export type ItemsStackParamList = {
  ItemsMain: undefined;
  CityItemDetail: {itemId: string; itemName: string};
  BrowseItems: undefined;
};

const Stack = createNativeStackNavigator<ItemsStackParamList>();

export function ItemsStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}>
      <Stack.Screen name="ItemsMain" component={CityItemsScreen} />
      <Stack.Screen name="CityItemDetail" component={CityItemDetailScreen} />
      <Stack.Screen name="BrowseItems" component={ItemsScreen} />
    </Stack.Navigator>
  );
}