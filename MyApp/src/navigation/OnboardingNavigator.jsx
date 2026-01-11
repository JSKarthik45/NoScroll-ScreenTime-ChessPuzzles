import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OnboardingPager from '../screens/onboarding/OnboardingPager';

const Stack = createNativeStackNavigator();

export default function OnboardingNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Onboarding" component={OnboardingPager} />
    </Stack.Navigator>
  );
}
