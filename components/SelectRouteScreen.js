// components/SelectRouteScreen.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const SelectRouteScreen = () => {
  return (
    <View style={styles.container}>
      <Text>Select Route Screen</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SelectRouteScreen;