// components/MapScreen.js

import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { getDatabase, ref, onValue, off } from 'firebase/database';
import { auth } from '../firebaseConfig';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as Location from 'expo-location';

const MapScreen = ({ navigation }) => {
  const [deliveries, setDeliveries] = useState([]);
  const [currentRoute, setCurrentRoute] = useState(null);
  const [showCurrentRouteOnly, setShowCurrentRouteOnly] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [role, setRole] = useState(null); // To determine if user is trucker or company

  const db = getDatabase();
  const mapRef = useRef(null); // Reference to MapView

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Error', 'User not authenticated.');
      return;
    }

    // Fetch user role with a persistent listener
    const userRoleRef = ref(db, `users/${user.uid}/role`);
    const handleRoleChange = (snapshot) => {
      const userRole = snapshot.val();
      setRole(userRole);
      console.log('MapScreen role:', userRole); // Debugging line
    };

    onValue(userRoleRef, handleRoleChange); // Persistent listener

    // Reference to user's currentRouteId
    const currentRouteIdRef = ref(db, `users/${user.uid}/currentRouteId`);

    // Listen for changes to currentRouteId
    const handleCurrentRouteIdChange = (snapshot) => {
      const currentRouteId = snapshot.val();
      if (currentRouteId) {
        fetchCurrentRoute(currentRouteId);
      } else {
        setCurrentRoute(null);
      }
    };

    onValue(currentRouteIdRef, handleCurrentRouteIdChange); // Persistent listener

    // Fetch all deliveries
    const deliveriesRef = ref(db, 'deliveries');
    const handleDeliveriesChange = (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const formattedDeliveries = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        setDeliveries(formattedDeliveries);
      } else {
        setDeliveries([]);
      }
    };

    onValue(deliveriesRef, handleDeliveriesChange); // Persistent listener

    // Fetch user's current location
    fetchUserLocation();

    // Cleanup listeners on unmount
    return () => {
      off(userRoleRef, 'value', handleRoleChange);
      off(currentRouteIdRef, 'value', handleCurrentRouteIdChange);
      off(deliveriesRef, 'value', handleDeliveriesChange);
    };
  }, []);

  // Function to fetch current route details
  const fetchCurrentRoute = (routeId) => {
    const routeRef = ref(db, `routes/${routeId}`);
    const handleRouteChange = (snapshot) => {
      const data = snapshot.val();
      if (data && data.coordinates) {
        // Ensure coordinates are in the correct format
        const formattedCoordinates = data.coordinates.map((coord) => ({
          latitude: coord.latitude, // Adjust based on your data structure
          longitude: coord.longitude,
        }));
        setCurrentRoute({
          id: routeId,
          ...data,
          coordinates: formattedCoordinates,
        });
      } else {
        setCurrentRoute(null);
      }
    };

    onValue(routeRef, handleRouteChange); // Persistent listener
  };

  // Function to fetch user's current location
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

      // Center the map on user location initially
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          ...coords,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }, 1000);
      }
    } catch (error) {
      Alert.alert('Location Error', 'Failed to get current location.');
      console.error('Location Fetch Error:', error);
    }
  };

  // Function to toggle between all deliveries and current route's deliveries
  const toggleView = () => {
    setShowCurrentRouteOnly(!showCurrentRouteOnly);
  };

  // Function to navigate to ClientInputScreen with currentRouteId
  const navigateToAddDelivery = () => {
    if (!currentRoute) {
      Alert.alert('No Current Route', 'Please set a current route first.');
      return;
    }
    navigation.navigate('New Delivery', { routeId: currentRoute.id });
  };

  // Function to center map on user location
  const centerOnUser = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        ...userLocation,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 1000);
    }
  };

  // Filtered deliveries based on toggle
  const filteredDeliveries =
    showCurrentRouteOnly && currentRoute
      ? deliveries.filter((delivery) => delivery.routeId === currentRoute.id)
      : deliveries;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        showsUserLocation={true}
        showsMyLocationButton={false}
        initialRegion={{
          latitude: userLocation ? userLocation.latitude : 37.78825,
          longitude: userLocation ? userLocation.longitude : -122.4324,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
      >
        {filteredDeliveries.map((delivery) => (
          <Marker
            key={`delivery-${delivery.id}`} // Prefix added
            coordinate={{
              latitude: delivery.location ? delivery.location.latitude : 0,
              longitude: delivery.location ? delivery.location.longitude : 0,
            }}
            title={delivery.deliveryDetails}
            description={delivery.pickupAddress}
            onPress={() => navigation.navigate('RouteDetails', { delivery })}
          />
        ))}

        {currentRoute && currentRoute.coordinates && (
          <Polyline coordinates={currentRoute.coordinates} strokeColor="#1EB1FC" strokeWidth={3} />
        )}
      </MapView>

      {/* Toggle View Button */}
      {role === 'trucker' && (
        <TouchableOpacity style={styles.toggleButton} onPress={toggleView}>
          <Ionicons name={showCurrentRouteOnly ? 'list' : 'filter'} size={24} color="#fff" />
          <Text style={styles.buttonText}>
            {showCurrentRouteOnly ? 'Show All Deliveries' : 'Show Current Route'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Add Delivery Button */}
      {role === 'trucker' && (
        <TouchableOpacity style={styles.addButton} onPress={navigateToAddDelivery}>
          <Ionicons name="add-circle" size={24} color="#fff" />
          <Text style={styles.buttonText}>Add to Route</Text>
        </TouchableOpacity>
      )}

      {/* Center on User Location Button */}
      <TouchableOpacity style={styles.centerButton} onPress={centerOnUser}>
        <Ionicons name="locate" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  toggleButton: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2F67B2',
    padding: 10,
    borderRadius: 8,
    opacity: 0.9,
    zIndex: 1, // Ensure it's above the map
    elevation: 5, // For Android
    shadowColor: '#000', // For iOS
    shadowOffset: { width: 0, height: 2 }, // For iOS
    shadowOpacity: 0.3, // For iOS
    shadowRadius: 2, // For iOS
  },
  addButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2F67B2',
    padding: 10,
    borderRadius: 8,
    opacity: 0.9,
    zIndex: 1, // Ensure it's above the map
    elevation: 5, // For Android
    shadowColor: '#000', // For iOS
    shadowOffset: { width: 0, height: 2 }, // For iOS
    shadowOpacity: 0.3, // For iOS
    shadowRadius: 2, // For iOS
  },
  centerButton: {
    position: 'absolute',
    bottom: 20,
    right: 15,
    backgroundColor: '#2F67B2',
    padding: 10,
    borderRadius: 25,
    zIndex: 1,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  buttonText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 16,
  },
});

export default MapScreen;
