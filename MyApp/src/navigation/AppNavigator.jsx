import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/main/HomeScreen';
import SettingsScreen from '../screens/main/SettingsScreen';
import StreakScreen from '../screens/main/StreakScreen';
import { useThemeColors } from '../theme/ThemeContext';

const Tab = createBottomTabNavigator();

export default function AppNavigator() {
  const colors = useThemeColors();
  const [headerMode, setHeaderMode] = useState('Trending');
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {backgroundColor: colors.background, borderTopWidth: 0},
        headerStyle: { backgroundColor: colors.background },
        tabBarIcon: ({ focused, size }) => {
          let iconName;
          if (route.name === 'Puzzles') {
            iconName = focused ? 'grid' : 'grid-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          } else if (route.name === 'Streak') {
            iconName = focused ? 'flame' : 'flame-outline';
          } else {
            iconName = 'help-circle';
          }
          return <Ionicons name={iconName} size={size} color={colors.primary} />;
        },
      })}
    >
      <Tab.Screen 
        name="Puzzles"
        options={{
          headerTitleAlign: 'center',
          headerTitle: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              {['Trending', 'Practice'].map((label, idx) => {
                const isActive = headerMode === label;
                return (
                  <Pressable
                    key={label}
                    onPress={() => setHeaderMode(label)}
                    style={{ marginLeft: idx === 0 ? 0 : 60 }}
                  
                  >
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: '600',
                        color: isActive ? colors.text : colors.muted,
                      }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ),
        }}
      >
        {() => <HomeScreen mode={headerMode} />}
      </Tab.Screen>
      <Tab.Screen name="Streak" component={StreakScreen} 
        options={{ headerTitleAlign: 'center',
          headerTitle: () => (
            <Text
              style={{
                fontSize: 18,
                fontWeight: '600',
                color: colors.text,
              }}
            >
              Streak
            </Text>
          ) }} />
      <Tab.Screen name="Settings" component={SettingsScreen} 
        options={{ headerTitleAlign: 'center',
          headerTitle: () => (
            <Text
              style={{
                fontSize: 18,
                fontWeight: '600',
                color: colors.text,
              }}
            >
              Settings
            </Text>
          ) }} />
    </Tab.Navigator>
  );
}
