// components/TruckerMenu.js

/// Til at navigere til forskellige skærme for en trucker

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Definerer TruckerMenu komponenten
const TruckerMenu = ({ navigation }) => {
  return (
    <View style={styles.menuContainer}>
      {/* Knap til at generere ruter */}
      <TouchableOpacity 
        style={styles.menuButton}
        onPress={() => navigation.navigate('OptimizeRoutes')}
      >
        <Ionicons name="git-network" size={24} color="#fff" />
        <Text style={styles.menuButtonText}>Generate Routes</Text>
      </TouchableOpacity>

      {/* Knap til at se genererede ruter */}
      <TouchableOpacity 
        style={styles.menuButton}
        onPress={() => navigation.navigate('RouteList')}
      >
        <Ionicons name="list" size={24} color="#fff" />
        <Text style={styles.menuButtonText}>View Generated Routes</Text>
      </TouchableOpacity>

      {/* Knap til den aktive rute */}
      <TouchableOpacity 
        style={styles.menuButton}
        onPress={() => navigation.navigate('ActiveRoute')}
      >
        <Ionicons name="navigate" size={24} color="#fff" />
        <Text style={styles.menuButtonText}>Active Route</Text>
      </TouchableOpacity>

      {/* Knap til rutehistorik */}
      <TouchableOpacity 
        style={styles.menuButton}
        onPress={() => navigation.navigate('RouteHistory')}
      >
        <Ionicons name="time" size={24} color="#fff" />
        <Text style={styles.menuButtonText}>Route History</Text>
      </TouchableOpacity>
    </View>
  );
};

// Definerer styling for komponenten
const styles = StyleSheet.create({
  menuContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
  },
  menuButton: {
    backgroundColor: '#2F67B2',
    padding: 20,
    borderRadius: 10,
    marginVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuButtonText: {
    color: '#fff',
    fontSize: 18,
    marginLeft: 10,
    fontWeight: '500',
  }
});

// Eksporterer TruckerMenu komponenten som standard
export default TruckerMenu;
