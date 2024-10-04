import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { database } from '../firebaseConfig';
import { ref, onValue } from 'firebase/database';

const RoutesScreen = ({ navigation }) => {
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [routes, setRoutes] = useState([]);

  useEffect(() => {
    const routesRef = ref(database, 'routes');
    onValue(routesRef, (snapshot) => {
      const data = snapshot.val();
      const fetchedRoutes = Object.keys(data).map((key) => ({
        id: key,
        title: data[key].title,
        coordinates: data[key].coordinates,
      }));
      setRoutes(fetchedRoutes);
    });
  }, []);

  const handleRouteSelect = (routeId) => {
    const route = routes.find((r) => r.id === routeId);
    setSelectedRoute(route);
  };

  return (
    <SafeAreaView style={styles.container}>
      <MapView style={styles.map}>
        {selectedRoute && (
          <Polyline
            coordinates={selectedRoute.coordinates}
            strokeColor="#000"
            strokeWidth={3}
          />
        )}
      </MapView>
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('OptimizeRoutes')}
      >
        <Icon name="route" size={30} color="#000" />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.fab, styles.fabSecondary]}
        onPress={() => navigation.navigate('SelectRoute')}
      >
        <Icon name="map" size={30} color="#000" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    right: 20,
    bottom: 20,
    backgroundColor: 'white',
    borderRadius: 30,
    elevation: 8,
  },
  fabSecondary: {
    bottom: 90, // Adjust as needed for spacing between buttons
  },
});

export default RoutesScreen;