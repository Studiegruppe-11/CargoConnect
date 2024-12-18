import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const TruckerMenu = ({ navigation }) => {
  return (
    <View style={styles.menuContainer}>
      <TouchableOpacity 
        style={styles.menuButton}
        onPress={() => navigation.navigate('OptimizeRoutes')}
      >
        <Ionicons name="git-network" size={24} color="#fff" />
        <Text style={styles.menuButtonText}>Generate Routes</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.menuButton}
        onPress={() => navigation.navigate('RouteList')}
      >
        <Ionicons name="list" size={24} color="#fff" />
        <Text style={styles.menuButtonText}>View Generated Routes</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.menuButton}
        onPress={() => navigation.navigate('ActiveRoute')}
      >
        <Ionicons name="navigate" size={24} color="#fff" />
        <Text style={styles.menuButtonText}>Active Route</Text>
      </TouchableOpacity>

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

export default TruckerMenu;