// components/CompanyMenu.js
// Virksomheds menu komponent - håndterer navigation til forskellige sektioner

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Hovedkomponent der modtager navigation som prop
const CompanyMenu = ({ navigation }) => {
  return (
    <View style={styles.menuContainer}>
      {/* Knap til at oprette ny levering */}
      <TouchableOpacity 
        style={styles.menuButton}
        onPress={() => navigation.navigate('New Delivery')}
      >
        <Ionicons name="add-circle" size={24} color="#fff" />
        <Text style={styles.menuButtonText}>Opret Ny Levering</Text>
      </TouchableOpacity>

      {/* Knap til notifikationer */}
      <TouchableOpacity 
        style={styles.menuButton}
        onPress={() => navigation.navigate('Notifications')}
      >
        <Ionicons name="notifications" size={24} color="#fff" />
        <Text style={styles.menuButtonText}>Notifikationer</Text>
      </TouchableOpacity>

      {/* Knap til aktive leveringer */}
      <TouchableOpacity 
        style={styles.menuButton}
        onPress={() => navigation.navigate('Active Deliveries')}
      >
        <Ionicons name="bicycle" size={24} color="#fff" />
        <Text style={styles.menuButtonText}>Aktive Leveringer</Text>
      </TouchableOpacity>

      {/* Knap til leveringshistorik */}
      <TouchableOpacity 
        style={styles.menuButton}
        onPress={() => navigation.navigate('Delivery History')}
      >
        <Ionicons name="time" size={24} color="#fff" />
        <Text style={styles.menuButtonText}>Leveringshistorik</Text>
      </TouchableOpacity>
    </View>
  );
};

// Styling for menuen og dens komponenter
const styles = StyleSheet.create({
  // Container for hele menuen
  menuContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
  },
  // Styling for menu knapperne
  menuButton: {
    backgroundColor: '#2F67B2',
    padding: 20,
    borderRadius: 10,
    marginVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Styling for teksten i knapperne
  menuButtonText: {
    color: '#fff',
    fontSize: 18,
    marginLeft: 10,
    fontWeight: '500',
  }
});

export default CompanyMenu;