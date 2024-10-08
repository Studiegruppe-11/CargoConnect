// components/SelectRouteScreen.js
import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';


const SelectRouteScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { optimizedRoutes } = route.params || {};
  const [selectedRoute, setSelectedRoute] = useState(null);

  const handleRouteSelect = (route) => {
    setSelectedRoute(route);
    navigation.navigate('RoutesHome', { selectedRoute: route });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select an Optimized Route</Text>
      {optimizedRoutes && optimizedRoutes.length > 0 ? (
        <FlatList
          data={optimizedRoutes}
          keyExtractor={(item) => item.vehicleId}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={styles.routeItem}
              onPress={() => handleRouteSelect(item)}
            >
              <Text style={styles.routeText}>Route {index + 1}</Text>
              <Text style={styles.routeDetails}>Vehicle ID: {item.vehicleId}</Text>
              <Text style={styles.routeDetails}>
                Stops: {item.coordinates.length}
              </Text>
            </TouchableOpacity>
          )}
        />
      ) : (
        <Text>No optimized routes available.</Text>
      )}
    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f9f9f9',
  },
  title: {
    fontSize: 22,
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  routeItem: {
    padding: 15,
    backgroundColor: '#fff',
    marginBottom: 10,
    borderRadius: 8,
    elevation: 2,
  },
  routeText: {
    fontSize: 18,
    fontWeight: '600',
  },
  routeDetails: {
    fontSize: 14,
    color: '#555',
  },
});


export default SelectRouteScreen;