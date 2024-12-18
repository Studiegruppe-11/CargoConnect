// components/CompanyMenu.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const CompanyMenu = ({ navigation }) => {
  return (
    <View style={styles.menuContainer}>
      <TouchableOpacity 
        style={styles.menuButton}
        onPress={() => navigation.navigate('New Delivery')}
      >
        <Ionicons name="add-circle" size={24} color="#fff" />
        <Text style={styles.menuButtonText}>Create New Delivery</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.menuButton}
        onPress={() => navigation.navigate('Notifications')}
      >
        <Ionicons name="notifications" size={24} color="#fff" />
        <Text style={styles.menuButtonText}>Notifications</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.menuButton}
        onPress={() => navigation.navigate('Active Deliveries')}
      >
        <Ionicons name="bicycle" size={24} color="#fff" />
        <Text style={styles.menuButtonText}>Active Deliveries</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.menuButton}
        onPress={() => navigation.navigate('Delivery History')}
      >
        <Ionicons name="time" size={24} color="#fff" />
        <Text style={styles.menuButtonText}>Delivery History</Text>
      </TouchableOpacity>
    </View>
  );
};

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

export default CompanyMenu;