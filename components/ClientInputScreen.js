// components/ClientInputScreen.js

import React, { useState, useEffect, useRef } from "react";
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
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import DateTimePickerModal from "react-native-modal-datetime-picker";

import axios from "axios";
import * as Location from "expo-location";
import {
  getDatabase,
  ref,
  push,
  set,
  update,
  onValue,
  off,
} from "firebase/database";
import { GEOCODE_MAPS_APIKEY, auth } from "../firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";

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
      const { house_number, road, postcode, city, country } =
        response.data.address;
      const formattedAddress = `${road ? road + " " : ""}${
        house_number ? house_number + ", " : ""
      }${postcode ? postcode + " " : ""}${city ? city + ", " : ""}${
        country ? country : ""
      }`.trim();
      return formattedAddress;
    } else {
      Alert.alert(
        "Reverse Geocoding Error",
        "No address found for the provided coordinates."
      );
      return null;
    }
  } catch (error) {
    Alert.alert(
      "Reverse Geocoding Error",
      "Failed to convert coordinates to address."
    );
    console.error(error);
    return null;
  }
};

const geocodeAddress = async (address) => {
  try {
    const response = await axios.get("https://geocode.maps.co/search", {
      params: {
        q: address,
        api_key: GEOCODE_MAPS_APIKEY,
      },
    });
    if (response.data && response.data.length > 0) {
      const { lat, lon } = response.data[0];
      return { latitude: parseFloat(lat), longitude: parseFloat(lon) };
    } else {
      Alert.alert(
        "Geocoding Error",
        "No results found for the provided address."
      );
      return null;
    }
  } catch (error) {
    Alert.alert("Geocoding Error", "Failed to convert address to coordinates.");
    console.error(error);
    return null;
  }
};

const ClientInputScreen = ({ navigation, route }) => {
  const { routeId } = route.params || {}; // Get routeId if provided

  // State variables for pickup
  const [pickupAddress, setPickupAddress] = useState(null);
  const [pickupCoordinates, setPickupCoordinates] = useState({
    latitude: "null",
    longitude: "null",
  });
  const [mapMarker, setMapMarker] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // State variables for delivery
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryCoordinates, setDeliveryCoordinates] = useState({
    latitude: "",
    longitude: "",
  });
  const [deliveryMarker, setDeliveryMarker] = useState(null);
  const [showDeliveryMap, setShowDeliveryMap] = useState(false);
  const [isGeocodingDelivery, setIsGeocodingDelivery] = useState(false);

  // Other state variables
  const [deliveryDetails, setDeliveryDetails] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [width, setWidth] = useState("");
  const [length, setLength] = useState("");
  const [payment, setPayment] = useState("");
  const [earliestStartTime, setEarliestStartTime] = useState(new Date());
  const [latestEndTime, setLatestEndTime] = useState(new Date());
  const [serviceTime, setServiceTime] = useState(10); // in minutes
  const [role, setRole] = useState(null);

  const [isEarliestStartPickerVisible, setEarliestStartPickerVisibility] =
    useState(false);
  const [isLatestEndPickerVisible, setLatestEndPickerVisibility] =
    useState(false);

  // Add new state variables for delivery constraints
  const [priority, setPriority] = useState('1');
  const [isMandatory, setIsMandatory] = useState(false);
  const [prize, setPrize] = useState('0');
  const [vehicleTypeRequired, setVehicleTypeRequired] = useState([]);

  const db = getDatabase();
  const mapRef = useRef(null); // Reference to MapView

  useEffect(() => {
    const authUnsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const userRoleRef = ref(db, `users/${user.uid}/role`);
        const handleRoleChange = (snapshot) => {
          const userRole = snapshot.val();
          setRole(userRole);
          if (userRole !== "company") {
            Alert.alert(
              "Access Denied",
              "You do not have permission to access this page."
            );
            navigation.goBack();
          }
        };
        onValue(userRoleRef, handleRoleChange); // Persistent listener
        // Automatically fetch user location on mount
        getCurrentLocation();
        // Cleanup listener on unmount
        return () => {
          off(userRoleRef, "value", handleRoleChange);
          authUnsubscribe();
        };
      } else {
        Alert.alert("Authentication Required", "Please log in first.");
        navigation.navigate("Login");
      }
    });
  }, []);

  const getCurrentLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Permission to access location was denied"
        );
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;
      setPickupCoordinates({ latitude, longitude });
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
        mapRef.current.animateToRegion(
          {
            latitude,
            longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          },
          1000
        );
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  // Handle map press for pickup location
  const handleMapPress = (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setMapMarker({ latitude, longitude });
    setPickupCoordinates({ latitude, longitude });
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
      mapRef.current.animateToRegion(
        {
          latitude,
          longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        },
        1000
      );
    }
  };

  // Handle map press for delivery location
  const handleDeliveryMapPress = (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setDeliveryMarker({ latitude, longitude });
    setDeliveryCoordinates({ latitude, longitude });
    setIsGeocodingDelivery(true);
    reverseGeocode(latitude, longitude).then((address) => {
      if (address) {
        setDeliveryAddress(address);
      }
      setIsGeocodingDelivery(false);
    });
  };

  // Handle address input blur for pickup
  const handleAddressBlur = async () => {
    if (pickupAddress.trim() === "") return; // Do nothing if address is empty
    setIsGeocoding(true); // Start loading
    const coords = await geocodeAddress(pickupAddress);
    if (coords) {
      setPickupCoordinates(coords);
      // Update map marker
      setMapMarker(coords);
      // Center the map on the new coordinates
      if (mapRef.current) {
        mapRef.current.animateToRegion(
          {
            latitude: coords.latitude,
            longitude: coords.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          },
          1000
        );
      }
      // Reverse geocode to get the formatted address
      const formattedAddress = await reverseGeocode(
        coords.latitude,
        coords.longitude
      );
      if (formattedAddress) {
        setPickupAddress(formattedAddress);
      }
    }
    setIsGeocoding(false); // End loading
  };

  // Handle address input blur for delivery
  const handleDeliveryAddressBlur = async () => {
    if (deliveryAddress.trim() === "") return;
    setIsGeocodingDelivery(true);
    const coords = await geocodeAddress(deliveryAddress);
    if (coords) {
      setDeliveryCoordinates(coords);
      setDeliveryMarker(coords);
    }
    setIsGeocodingDelivery(false);
  };

  // Handle coordinates input blur for pickup
  const handleCoordinatesBlur = async () => {
    const { latitude, longitude } = pickupCoordinates;
    if (latitude === "" || longitude === "") return; // Do nothing if coordinates are empty
    // Validate if latitude and longitude are valid numbers
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lon)) {
      Alert.alert(
        "Invalid Coordinates",
        "Please enter valid numerical coordinates."
      );
      return;
    }
    setPickupCoordinates({ latitude: lat, longitude: lon });
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
      mapRef.current.animateToRegion(
        {
          latitude: lat,
          longitude: lon,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        },
        1000
      );
    }
  };

  // Handle coordinates input blur for delivery
  const handleDeliveryCoordinatesBlur = async () => {
    const { latitude, longitude } = deliveryCoordinates;
    if (latitude === "" || longitude === "") return;
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lon)) {
      Alert.alert(
        "Invalid Coordinates",
        "Please enter valid numerical coordinates."
      );
      return;
    }
    setDeliveryCoordinates({ latitude: lat, longitude: lon });
    setDeliveryMarker({ latitude: lat, longitude: lon });
    setIsGeocodingDelivery(true);
    const address = await reverseGeocode(lat, lon);
    if (address) {
      setDeliveryAddress(address);
    }
    setIsGeocodingDelivery(false);
  };

  // Handle text change for pickup address
  const handleAddressChange = (text) => {
    setPickupAddress(text);
  };

  // Handle text change for delivery address
  const handleDeliveryAddressChange = (text) => {
    setDeliveryAddress(text);
  };

  // Handle text change for pickup coordinates
  const handleCoordinatesChange = (text) => {
    const [lat, lon] = text.split(",").map((coord) => coord.trim());
    setPickupCoordinates({ latitude: lat, longitude: lon });
  };

  // Handle text change for delivery coordinates
  const handleDeliveryCoordinatesChange = (text) => {
    const [lat, lon] = text.split(",").map((coord) => coord.trim());
    setDeliveryCoordinates({ latitude: lat, longitude: lon });
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
      !serviceTime
    ) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }
    if (
      !deliveryAddress ||
      !deliveryCoordinates.latitude ||
      !deliveryCoordinates.longitude
    ) {
      Alert.alert(
        "Error",
        "Please provide a valid delivery address or coordinates."
      );
      return;
    }
      // Ensure pickupCoordinates and deliveryCoordinates have latitude and longitude
    if (
      !pickupCoordinates ||
      pickupCoordinates.latitude === undefined ||
      pickupCoordinates.longitude === undefined
    ) {
      Alert.alert('Error', 'Invalid pickup coordinates.');
      return;
    }
  
    if (
      !deliveryCoordinates ||
      deliveryCoordinates.latitude === undefined ||
      deliveryCoordinates.longitude === undefined
    ) {
      Alert.alert('Error', 'Invalid delivery coordinates.');
      return;
    }
    const newDelivery = {
      pickupAddress,
      pickupLocation: pickupCoordinates,
      deliveryAddress,
      deliveryLocation: deliveryCoordinates,
      deliveryDetails,
      weight: parseFloat(weight),
      height: parseFloat(height),
      width: parseFloat(width),
      length: parseFloat(length),
      payment: parseFloat(payment),
      earliestStartTime: Math.floor(earliestStartTime.getTime() / 1000), // Convert to integer
      latestEndTime: Math.floor(latestEndTime.getTime() / 1000), // Convert to integer
      serviceTime: parseInt(serviceTime, 10) * 60, // Convert minutes to seconds
      routeId: routeId || null, // Associate with route if routeId is provided
      status: "pending", // Optional: Add status field
      priority: parseInt(priority),
      isMandatory,
      prize: parseFloat(prize),
      vehicleTypeRequired,
    };
    try {
      const deliveryRef = ref(db, "deliveries");
      const newRef = push(deliveryRef); // Generates a unique key
      await set(newRef, newDelivery); // Saves the delivery data under the unique key
      Alert.alert("Success", "Delivery created successfully.");
      navigation.goBack(); // Navigate back to the previous screen (MapScreen)
    } catch (error) {
      Alert.alert("Database Error", "Failed to create delivery.");
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
        <Text style={styles.toggleMapText}>
          {showMap ? "Hide Map" : "Show Map"}
        </Text>
      </TouchableOpacity>
      {showMap && (
        <MapView
          ref={mapRef}
          style={styles.map}
          onPress={handleMapPress}
          initialRegion={{
            latitude: mapMarker ? mapMarker.latitude : 55.68162938805638,
            longitude: mapMarker ? mapMarker.longitude : 12.529937312745204,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }}
        >
          {mapMarker && (
            <Marker
              key={`selectedLocation-${mapMarker.latitude}-${mapMarker.longitude}`}
              coordinate={mapMarker}
              title="Pickup Location"
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
      {/* Pickup Coordinates */}
      <Text style={styles.label}>Or coordinates (Latitude, Longitude)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., 55.85193, 12.566337"
        value={`${pickupCoordinates.latitude}, ${pickupCoordinates.longitude}`}
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

      {/* Delivery Section */}
      <Text style={styles.sectionTitle}>Delivery Location</Text>
      <TouchableOpacity onPress={() => setShowDeliveryMap(!showDeliveryMap)}>
        <Text style={styles.toggleMapText}>
          {showDeliveryMap ? "Hide Map" : "Show Map"}
        </Text>
      </TouchableOpacity>
      {showDeliveryMap && (
        <MapView
          style={styles.map}
          onPress={handleDeliveryMapPress}
  initialRegion={{
    latitude: mapMarker ? mapMarker.latitude : 55.68162938805638,
    longitude: mapMarker ? mapMarker.longitude : 12.529937312745204,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  }}
        >
          {deliveryMarker && (
            <Marker coordinate={deliveryMarker} title="Delivery Location" />
          )}
        </MapView>
      )}
      {isGeocodingDelivery && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text>Processing Address...</Text>
        </View>
      )}
      <Text style={styles.label}>Delivery Address</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter delivery address"
        value={deliveryAddress}
        onChangeText={handleDeliveryAddressChange}
        onBlur={handleDeliveryAddressBlur}
      />
      <Text style={styles.label}>Or coordinates (Latitude, Longitude)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., 55.85193, 12.566337"
        value={`${deliveryCoordinates.latitude}, ${deliveryCoordinates.longitude}`}
        onChangeText={handleDeliveryCoordinatesChange}
        onBlur={handleDeliveryCoordinatesBlur}
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
      <Text style={styles.label}>Earliest Start Time</Text>
<TouchableOpacity onPress={() => setEarliestStartPickerVisibility(true)}>
  <View style={styles.input}>
    <Text>{earliestStartTime.toLocaleString()}</Text>
  </View>
</TouchableOpacity>
<DateTimePickerModal
  isVisible={isEarliestStartPickerVisible}
  mode="datetime"
  date={earliestStartTime}
  onConfirm={(date) => {
    setEarliestStartPickerVisibility(false);
    setEarliestStartTime(date);
  }}
  onCancel={() => setEarliestStartPickerVisibility(false)}
/>
      {/* Latest End Time */}
      <Text style={styles.label}>Latest End Time</Text>
<TouchableOpacity onPress={() => setLatestEndPickerVisibility(true)}>
  <View style={styles.input}>
    <Text>{latestEndTime.toLocaleString()}</Text>
  </View>
</TouchableOpacity>
<DateTimePickerModal
  isVisible={isLatestEndPickerVisible}
  mode="datetime"
  date={latestEndTime}
  onConfirm={(date) => {
    setLatestEndPickerVisibility(false);
    setLatestEndTime(date);
  }}
  onCancel={() => setLatestEndPickerVisibility(false)}
/>
      {/* Service Time */}
      <Text style={styles.label}>Service Time at Stop (minutes)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., 10"
        value={serviceTime !== "" ? serviceTime.toString() : ""}
        onChangeText={(text) => {
          if (text === "") {
            setServiceTime("");
          } else {
            const parsed = parseInt(text, 10);
            if (!isNaN(parsed)) {
              setServiceTime(parsed);
            } else {
              Alert.alert(
                "Invalid Input",
                "Please enter a valid number for service time."
              );
            }
          }
        }}
        keyboardType="numeric"
      />
      {/* Delivery Priority */}
      <Text style={styles.label}>Delivery Priority (1-10)</Text>
      <TextInput
        style={styles.input}
        value={priority}
        onChangeText={setPriority}
        keyboardType="numeric"
      />

      {/* Prize/Bonus */}
      <Text style={styles.label}>Prize/Bonus (€)</Text>
      <TextInput
        style={styles.input}
        value={prize}
        onChangeText={setPrize}
        keyboardType="numeric"
      />

      {/* Add checkboxes for vehicle types */}
      <Text style={styles.label}>Required Vehicle Types</Text>
      <View style={styles.checkboxContainer}>
        {/* Add checkboxes for vehicle types */}
      </View>
      {/* Create Delivery Button */}
      <Button title="Create Delivery" onPress={handleCreateDelivery} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#f9f9f9",
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: "center",
    fontWeight: "bold",
  },
  sectionTitle: {
    fontSize: 20,
    marginTop: 30,
    marginBottom: 10,
    textAlign: "center",
    fontWeight: "bold",
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
    color: "#333",
  },
  input: {
    height: 40,
    borderColor: "#ccc",
    borderWidth: 1,
    marginBottom: 20,
    paddingHorizontal: 10,
    borderRadius: 5,
    backgroundColor: "#fff",
  },
  map: {
    height: 300,
    marginBottom: 20,
    borderRadius: 10,
  },
  toggleMapText: {
    color: "#007BFF",
    textAlign: "center",
    marginBottom: 20,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0, // Removed 'showMap' dependency
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.8)",
    zIndex: 2,
  },
});

export default ClientInputScreen;
