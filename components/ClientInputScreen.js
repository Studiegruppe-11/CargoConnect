// components/ClientInputScreen.js

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import axios from 'axios';
import * as Location from 'expo-location';
import { getDatabase, ref, push, set, update, onValue, off } from 'firebase/database';
import { GEOCODE_MAPS_APIKEY, auth } from '../firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import MapView, { Marker } from 'react-native-maps';

const reverseGeocode = async (latitude, longitude) => {
  try {
    const response = await axios.get(`https://geocode.maps.co/reverse`, {
      params: {
        lat: latitude,
        lon: longitude,
        api_key: GEOCODE_MAPS_APIKEY,
      },
    });

    if (response.data && response.data.address) {
      const { house_number, road, postcode, city, country } = response.data.address;

      // formatted address
      const formattedAddress = `${road ? road + ' ' : ''}${house_number ? house_number + ', ' : ''}${postcode ? postcode + ' ' : ''}${city ? city + ', ' : ''}${country ? country : ''}`.trim();

      return formattedAddress;
    } else {
      Alert.alert('Reverse Geocoding Error', 'No address found for the provided coordinates.');
      return null;
    }
  } catch (error) {
    Alert.alert('Reverse Geocoding Error', 'Failed to convert coordinates to address.');
    console.error(error);
    return null;
  }
};

const geocodeAddress = async (address) => {
  try {
    const response = await axios.get('https://geocode.maps.co/search', {
      params: {
        q: address,
        api_key: GEOCODE_MAPS_APIKEY,
      },
    });

    if (response.data && response.data.length > 0) {
      const { lat, lon } = response.data[0];
      return { latitude: parseFloat(lat), longitude: parseFloat(lon) };
    } else {
      Alert.alert('Geocoding Error', 'No results found for the provided address.');
      return null;
    }
  } catch (error) {
    Alert.alert('Geocoding Error', 'Failed to convert address to coordinates.');
    console.error(error);
    return null;
  }
};

const ClientInputScreen = ({ navigation, route }) => {
  const { routeId } = route.params || {}; // Get routeId if provided

  // State variables
  const [pickupAddress, setPickupAddress] = useState('');
  const [deliveryDetails, setDeliveryDetails] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [width, setWidth] = useState('');
  const [length, setLength] = useState('');
  const [payment, setPayment] = useState(''); // New field
  const [earliestStartTime, setEarliestStartTime] = useState(''); // New field
  const [latestEndTime, setLatestEndTime] = useState(''); // New field
  const [serviceTime, setServiceTime] = useState(''); // New field

  const [location, setLocation] = useState(null);
  const [coordinates, setCoordinates] = useState({ latitude: '', longitude: '' });
  const [showMap, setShowMap] = useState(false);
  const [role, setRole] = useState(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [mapMarker, setMapMarker] = useState(null);

  const db = getDatabase();
  const mapRef = useRef(null); // Reference to MapView

  useEffect(() => {
    const authUnsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const userRoleRef = ref(db, `users/${user.uid}/role`);
        const handleRoleChange = (snapshot) => {
          const userRole = snapshot.val();
          setRole(userRole);
          if (userRole !== 'company') {
            Alert.alert('Access Denied', 'You do not have permission to access this page.');
            navigation.goBack();
          }
        };

        onValue(userRoleRef, handleRoleChange); // Persistent listener

        // Automatically fetch user location on mount
        getCurrentLocation();

        // Cleanup listener on unmount
        return () => {
          off(userRoleRef, 'value', handleRoleChange);
          authUnsubscribe();
        };
      } else {
        Alert.alert('Authentication Required', 'Please log in first.');
        navigation.navigate('Login');
      }
    });
  }, []);

  const getCurrentLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Permission to access location was denied');
        return;
      }

      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);

      const { latitude, longitude } = loc.coords;
      setCoordinates({ latitude, longitude });

      // Reverse geocode to get address
      setIsGeocoding(true); // Start loading
      const address = await reverseGeocode(latitude, longitude);
      if (address) {
        setPickupAddress(address);
      }
      setIsGeocoding(false); // End loading

      // Update map marker
      setMapMarker({ latitude, longitude });

      // Center the map on user location
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude,
          longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }, 1000);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleMapPress = (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setMapMarker({ latitude, longitude });
    setCoordinates({ latitude, longitude });

    // Update location state with the selected coordinates
    setLocation({ coords: { latitude, longitude } });

    // Reverse geocode to get address
    setIsGeocoding(true); // Start loading
    reverseGeocode(latitude, longitude).then((address) => {
      if (address) {
        setPickupAddress(address);
      }
      setIsGeocoding(false); // End loading
    });

    // Center the map on the selected location
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude,
        longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 1000);
    }
  };

  // Handle address input blur
  const handleAddressBlur = async () => {
    if (pickupAddress.trim() === '') return; // Do nothing if address is empty

    setIsGeocoding(true); // Start loading
    const coords = await geocodeAddress(pickupAddress);
    if (coords) {
      setCoordinates(coords);
      setLocation({ coords });
      // Update map marker
      setMapMarker(coords);

      // Center the map on the new coordinates
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: coords.latitude,
          longitude: coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }, 1000);
      }

      // Reverse geocode to get the formatted address
      const formattedAddress = await reverseGeocode(coords.latitude, coords.longitude);
      if (formattedAddress) {
        setPickupAddress(formattedAddress);
      }
    }
    setIsGeocoding(false); // End loading
  };

  // Handle coordinates input blur
  const handleCoordinatesBlur = async () => {
    const { latitude, longitude } = coordinates;
    if (latitude === '' || longitude === '') return; // Do nothing if coordinates are empty

    // Validate if latitude and longitude are valid numbers
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lon)) {
      Alert.alert('Invalid Coordinates', 'Please enter valid numerical coordinates.');
      return;
    }

    setLocation({ coords: { latitude: lat, longitude: lon } });

    // Reverse geocode to get address
    setIsGeocoding(true); // Start loading
    const address = await reverseGeocode(lat, lon);
    if (address) {
      setPickupAddress(address);
    }
    setIsGeocoding(false); // End loading

    // Update map marker
    setMapMarker({ latitude: lat, longitude: lon });

    // Center the map on the new coordinates
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: lat,
        longitude: lon,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 1000);
    }
  };

  const handleAddressChange = (text) => {
    setPickupAddress(text);
    // No immediate geocoding
  };

  const handleCoordinatesChange = (text) => {
    // Expecting input as "latitude, longitude"
    const [lat, lon] = text.split(',').map(coord => coord.trim());
    setCoordinates({ latitude: lat, longitude: lon });
    // No immediate reverse geocoding
  };

  const handleCreateDelivery = async () => {
    if (
      !pickupAddress ||
      !deliveryDetails ||
      !weight ||
      !height ||
      !width ||
      !length ||
      !payment ||
      !earliestStartTime ||
      !latestEndTime ||
      !serviceTime
    ) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    let coords = location ? location.coords : null;
    if (!coords) {
      coords = await geocodeAddress(pickupAddress);
      if (!coords) return;
    }

    const newDelivery = {
      pickupAddress,
      deliveryDetails,
      weight: parseFloat(weight),
      height: parseFloat(height),
      width: parseFloat(width),
      length: parseFloat(length),
      payment: parseFloat(payment), // New field
      earliestStartTime: parseInt(earliestStartTime, 10), // New field
      latestEndTime: parseInt(latestEndTime, 10), // New field
      serviceTime: parseInt(serviceTime, 10), // New field
      location: coords,
      routeId: routeId || null, // Associate with route if routeId is provided
      status: 'pending', // Optional: Add status field
    };

    try {
      const deliveryRef = ref(db, 'deliveries');
      const newRef = push(deliveryRef); // Generates a unique key
      await set(newRef, newDelivery); // Saves the delivery data under the unique key

      // If routeId is provided, add this delivery to the route's deliveryIds
      if (routeId) {
        const routeDeliveriesRef = ref(db, `routes/${routeId}/deliveryIds`);
        // Use transaction to safely add to array
        onValue(routeDeliveriesRef, (snapshot) => {
          const currentDeliveries = snapshot.val() || [];
          const updatedDeliveries = [...currentDeliveries, newRef.key];
          update(routeDeliveriesRef, { deliveryIds: updatedDeliveries })
            .then(() => {
              console.log('Delivery added to route.');
            })
            .catch((error) => {
              console.error('Error adding delivery to route:', error);
            });
        }, {
          onlyOnce: true,
        });
      }

      Alert.alert('Success', 'Delivery created successfully.');
      navigation.goBack(); // Navigate back to the previous screen (MapScreen)
    } catch (error) {
      Alert.alert('Database Error', 'Failed to create delivery.');
      console.error(error);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Create Delivery</Text>

      {/* Get Current Location Button */}
      <Button title="Get Current Location" onPress={getCurrentLocation} />

      {/* Toggle Map View */}
      <TouchableOpacity onPress={() => setShowMap(!showMap)}>
        <Text style={styles.toggleMapText}>{showMap ? 'Hide Map' : 'Show Map'}</Text>
      </TouchableOpacity>

      {showMap && (
        <MapView
          ref={mapRef}
          style={styles.map}
          onPress={handleMapPress}
          initialRegion={{
            latitude: mapMarker ? mapMarker.latitude : 37.78825,
            longitude: mapMarker ? mapMarker.longitude : -122.4324,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }}
        >
          {mapMarker && (
            <Marker
              key={`selectedLocation-${mapMarker.latitude}-${mapMarker.longitude}`}
              coordinate={mapMarker}
              title="Selected Location"
            />
          )}
        </MapView>
      )}

      {/* Loading Indicator */}
      {isGeocoding && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text>Processing Address...</Text>
        </View>
      )}

      {/* Pickup Address */}
      <Text style={styles.label}>Pickup Address</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter pickup address"
        value={pickupAddress}
        onChangeText={handleAddressChange}
        onBlur={handleAddressBlur}
      />

      {/* Coordinates */}
      <Text style={styles.label}>Or coordinates (Latitude, Longitude)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., 55.85193, 12.566337"
        value={`${coordinates.latitude}, ${coordinates.longitude}`}
        onChangeText={handleCoordinatesChange}
        onBlur={handleCoordinatesBlur}
      />

      {/* Delivery Details */}
      <Text style={styles.label}>Delivery Details</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter delivery details"
        value={deliveryDetails}
        onChangeText={setDeliveryDetails}
      />

      {/* Weight */}
      <Text style={styles.label}>Weight (kg)</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter weight"
        value={weight}
        onChangeText={setWeight}
        keyboardType="numeric"
      />

      {/* Height */}
      <Text style={styles.label}>Height (cm)</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter height"
        value={height}
        onChangeText={setHeight}
        keyboardType="numeric"
      />

      {/* Width */}
      <Text style={styles.label}>Width (cm)</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter width"
        value={width}
        onChangeText={setWidth}
        keyboardType="numeric"
      />

      {/* Length */}
      <Text style={styles.label}>Length (cm)</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter length"
        value={length}
        onChangeText={setLength}
        keyboardType="numeric"
      />

      {/* Payment */}
      <Text style={styles.label}>Payment (€)</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter payment amount"
        value={payment}
        onChangeText={setPayment}
        keyboardType="numeric"
      />

      {/* Earliest Start Time */}
      <Text style={styles.label}>Earliest Start Time (Unix Timestamp)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., 1633035600"
        value={earliestStartTime}
        onChangeText={setEarliestStartTime}
        keyboardType="numeric"
      />

      {/* Latest End Time */}
      <Text style={styles.label}>Latest End Time (Unix Timestamp)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., 1633122000"
        value={latestEndTime}
        onChangeText={setLatestEndTime}
        keyboardType="numeric"
      />

      {/* Service Time */}
      <Text style={styles.label}>Service Time at Stop (seconds)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., 600"
        value={serviceTime}
        onChangeText={setServiceTime}
        keyboardType="numeric"
      />

      {/* Create Delivery Button */}
      <Button title="Create Delivery" onPress={handleCreateDelivery} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flexGrow: 1, 
    justifyContent: 'center', 
    padding: 20,
    backgroundColor: '#f9f9f9',
  },
  title: { 
    fontSize: 24, 
    marginBottom: 20, 
    textAlign: 'center',
    fontWeight: 'bold',
  },
  label: { 
    fontSize: 16, 
    marginBottom: 5,
    color: '#333',
  },
  input: { 
    height: 40, 
    borderColor: '#ccc', 
    borderWidth: 1, 
    marginBottom: 20, 
    paddingHorizontal: 10, 
    borderRadius: 5,
    backgroundColor: '#fff',
  },
  map: { 
    height: 300, 
    marginBottom: 20, 
    borderRadius: 10,
  },
  toggleMapText: {
    color: '#007BFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0, // Removed 'showMap' dependency
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    zIndex: 2,
  },
});

export default ClientInputScreen;
