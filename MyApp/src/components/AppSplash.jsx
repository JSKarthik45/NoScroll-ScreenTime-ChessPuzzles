import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

// Simple in-app splash screen: centered logo with rounded rectangle corners.
export default function AppSplash() {
  return (
    <View style={styles.container}>
      <Image source={require('../../assets/logo2.png')} style={styles.logo} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 280,
    height: 280,
    borderRadius: 24, // rectangle with moderately rounded corners
  },
});
