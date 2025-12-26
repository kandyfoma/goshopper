// Stats Stack Navigator - Nested navigation for Stats tab
import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {StatsScreen, CategoryDetailScreen} from '../screens';

export type StatsStackParamList = {
  StatsMain: undefined;
  CategoryDetail: {categoryName: string; categoryColor: string};
};

const Stack = createNativeStackNavigator<StatsStackParamList>();

export function StatsStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}>
      <Stack.Screen name="StatsMain" component={StatsScreen} />
      <Stack.Screen name="CategoryDetail" component={CategoryDetailScreen} />
    </Stack.Navigator>
  );
}
