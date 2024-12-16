// components/SelectRouteScreen.js
import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

const SelectRouteScreen = ({ navigation, route }) => {
  const { optimizedRoutes } = route.params || {};
  const [selectedRoute, setSelectedRoute] = useState(null);

  const handleRouteSelect = (selectedRoute) => {
    setSelectedRoute(selectedRoute);
    navigation.navigate('RouteDetails', { route: selectedRoute });
  };
  

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select an Optimized Route</Text>
      <FlatList
        data={optimizedRoutes}
        keyExtractor={(item) => item.vehicleId}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={[
              styles.routeItem,
              selectedRoute?.vehicleId === item.vehicleId && styles.selectedRoute
            ]}
            onPress={() => handleRouteSelect(item)}
          >
            <Text style={styles.routeTitle}>Route {index + 1}</Text>
            <Text style={styles.routeDetails}>Stops: {item.stops.length}</Text>
            <Text style={styles.routeDetails}>
              Total Time: {Math.round(item.totalTime / 3600)}h {Math.round((item.totalTime % 3600) / 60)}m
            </Text>
            <Text style={styles.routeDetails}>
              Estimated Profit: €{Math.round(item.profit)}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  routeItem: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  selectedRoute: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2F67B2',
    borderWidth: 2,
  },
  routeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  routeDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
  },
});

export default SelectRouteScreen;