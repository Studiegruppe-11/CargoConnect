import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert } from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import Icon from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location'; 
import { getDatabase, ref, onValue } from 'firebase/database';
import { auth } from '../firebaseConfig';


const RoutesScreen = ({ navigation }) => {
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [optimizedRoutes, setOptimizedRoutes] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const db = getDatabase();

  useEffect(() => {
    // Fetch user's current location
    fetchUserLocation();

     // Fetch optimized routes if no selected route
     if (!selectedRoute) {
      const optimizedRouteRef = ref(db, 'optimizedRoutes/' + auth.currentUser.uid);
      onValue(optimizedRouteRef, (snapshot) => {
        const data = snapshot.val();
        if (data && data.routes) {
          setOptimizedRoutes(data.routes);
        } else {
          setOptimizedRoutes([]);
        }
      });
    } else {
      setOptimizedRoutes([selectedRoute]);
    }
  }, [selectedRoute]);
  

  const fetchUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Permission to access location was denied.');
        return;
      }
  
      const location = await Location.getCurrentPositionAsync({});
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setUserLocation(coords);
    } catch (error) {
      Alert.alert('Location Error', 'Failed to get current location.');
      console.error('Location Fetch Error:', error);
    }
  };

  const handleOptimizeRoutes = () => {
    navigation.navigate('OptimizeRoutes');
  };

  const handleSelectRoute = () => {
    navigation.navigate('SelectRoute', { optimizedRoutes });
  };

  return (
    <SafeAreaView style={styles.container}>
      <MapView style={styles.map}>
        {optimizedRoutes.map((route, index) => (
          <Polyline
            key={`route-${index}`}
            coordinates={route.coordinates}
            strokeColor="#1EB1FC"
            strokeWidth={3}
          />
        ))}

        {/* Optionally, add markers for stops */}
        {optimizedRoutes.map((route) =>
          route.coordinates.map((coord, idx) => (
            <Marker
              key={`${route.vehicleId}-marker-${idx}`}
              coordinate={coord}
              title={`Stop ${idx + 1}`}
              description={`Task ID: ${coord.taskId}`}
            />
          ))
        )}
      </MapView>

      {/* Optimize Routes Button */}
      <TouchableOpacity style={styles.optimizeButton} onPress={handleOptimizeRoutes}>
        <Icon name="refresh" size={24} color="#fff" />
        <Text style={styles.buttonText}>Optimize Routes</Text>
      </TouchableOpacity>

      {/* Select Route Button */}
      <TouchableOpacity style={styles.selectRouteButton} onPress={handleSelectRoute}>
        <Icon name="list" size={24} color="#fff" />
        <Text style={styles.buttonText}>Select Route</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  optimizeButton: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2F67B2',
    padding: 10,
    borderRadius: 8,
    opacity: 0.9,
    zIndex: 1,
  },
  selectRouteButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2F67B2',
    padding: 10,
    borderRadius: 8,
    opacity: 0.9,
    zIndex: 1,
  },
  buttonText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 16,
  },
});


export default RoutesScreen;