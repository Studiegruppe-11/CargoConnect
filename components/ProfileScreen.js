// components/ProfileScreen.js

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import Slider from "@react-native-community/slider";
import { Picker } from "@react-native-picker/picker";
import * as Location from 'expo-location';
import { ref, onValue, update, set } from "firebase/database";
import { auth, database } from "../firebaseConfig";
import { signOut } from "firebase/auth";
import MapView, { Marker } from 'react-native-maps';
import { onAuthStateChanged } from "firebase/auth";

const ProfileScreen = ({ navigation }) => {
  // Remove duplicate/unnecessary state variables
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Add role selection before vehicle info
  const [role, setRole] = useState('trucker');

  // Vehicle info
  const [vehicleId, setVehicleId] = useState(`veh-${auth.currentUser?.uid || 'new'}`);
  const [maxCargoWeight, setMaxCargoWeight] = useState('');
  const [maxCargoVolume, setMaxCargoVolume] = useState('');

  // Dimensions
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');

  // Location settings
  const [startLatitude, setStartLatitude] = useState('');
  const [startLongitude, setStartLongitude] = useState('');
  const [useMapPicker, setUseMapPicker] = useState(false);
  const [mapMarker, setMapMarker] = useState(null);

  // Time constraints
  const [workStartTime, setWorkStartTime] = useState('8');
  const [workEndTime, setWorkEndTime] = useState('20');
  const [maxDrivingTime, setMaxDrivingTime] = useState('12');
  const [breakStartMin, setBreakStartMin] = useState('12');
  const [breakStartMax, setBreakStartMax] = useState('13');
  const [breakDuration, setBreakDuration] = useState('0.5');

  // Efficiency settings
  const [fuelEfficiency, setFuelEfficiency] = useState('');
  const [fuelCost, setFuelCost] = useState('0');
  const [averageSpeed, setAverageSpeed] = useState(60);

  // Trip settings
  const [skipFirstTrip, setSkipFirstTrip] = useState(false);
  const [dropReturnTrip, setDropReturnTrip] = useState(false);
  const [minTasksPerDay, setMinTasksPerDay] = useState('1');

  // Other preferences
  const [preferredCountries, setPreferredCountries] = useState('');
  const [availability, setAvailability] = useState('');

  // Add auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        navigation.replace('Login');
        return;
      }
      setUser(currentUser);
      loadUserPreferences(currentUser.uid);
    });

    return () => unsubscribe();
  }, [navigation]);

  // Load user preferences
  const loadUserPreferences = async (uid) => {
    const userRef = ref(database, `users/${uid}`);
    onValue(userRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setMaxCargoWeight(data.maxCargoWeight?.toString() || '');
        setMaxCargoVolume(data.maxCargoVolume?.toString() || '');
        setStartLatitude(data.startLatitude?.toString() || '');
        setStartLongitude(data.startLongitude?.toString() || '');
        setMaxDrivingTime(data.maxDrivingTime?.toString() || '');
        setBreakStartMin(data.breakStartMin?.toString() || '12');
        setBreakStartMax(data.breakStartMax?.toString() || '13');
        setBreakDuration(data.breakDuration?.toString() || '');
        setFuelEfficiency(data.fuelEfficiency ? data.fuelEfficiency.toString() : "");
        setPreferredCountries(
          Array.isArray(data.preferredCountries) 
            ? data.preferredCountries.join(", ") 
            : data.preferredCountries || ""
        );
        setRole(data.role || "trucker"); // Added role
        setAvailability(data.availability || "");
        setStartLatitude(data.startLatitude ? data.startLatitude.toString() : '');
        setStartLongitude(data.startLongitude ? data.startLongitude.toString() : '');
        setLength(data.dimensions?.length?.toString() || '');
        setWidth(data.dimensions?.width?.toString() || '');
        setHeight(data.dimensions?.height?.toString() || '');
      }
      setLoading(false);
    }, {
      onlyOnce: true
    });
  };

  // Save preferences with user check
  const savePreferences = async () => {
    if (!user) {
      Alert.alert('Error', 'Must be logged in to save preferences');
      return;
    }

    const userRef = ref(database, `users/${user.uid}`);
    const preferences = {
      vehicleId,
      
      // Add role before other preferences
      role, // This will be either 'trucker' or 'company'

      // Cargo constraints
      maxCargoWeight: Number(maxCargoWeight) || 5000,
      maxCargoVolume: Number(maxCargoVolume) || 60,
      dimensions: {
        length: parseFloat(length) || 0,
        width: parseFloat(width) || 0,
        height: parseFloat(height) || 0
      },

      // Location
      startLatitude: parseFloat(startLatitude) || 0,
      startLongitude: parseFloat(startLongitude) || 0,

      // Time constraints
      workStartTime: parseFloat(workStartTime) || 8,
      workEndTime: parseFloat(workEndTime) || 20,
      maxDrivingTime: Number(maxDrivingTime) || 12,
      breakStartMin: parseFloat(breakStartMin) || 12,
      breakStartMax: parseFloat(breakStartMax) || 13,
      breakDuration: Number(breakDuration) || 0.5,

      // Efficiency
      fuelEfficiency: Number(fuelEfficiency) || 10,
      fuelCost: Number(fuelCost) || 0,
      averageSpeed: Number(averageSpeed) || 60,

      preferredCountries: preferredCountries
        ? preferredCountries.split(',').map(country => country.trim())
        : [],
    };

    try {
      await update(userRef, preferences);
      Alert.alert('Success', 'Preferences saved successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to save preferences');
      console.error(error);
    }
  };

  const handleLogout = () => {
    signOut(auth)
      .then(() => {
        navigation.navigate('Login');
      })
      .catch((error) => {
        console.error("Logout error:", error);
        Alert.alert("Error", "Failed to log out.");
      });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>User Settings</Text>

      {/* Add Role Selection at the top */}
      <Text style={styles.sectionTitle}>User Role</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={role}
          onValueChange={(itemValue) => setRole(itemValue)}
          style={styles.picker}
        >
          <Picker.Item label="Trucker" value="trucker" />
          <Picker.Item label="Company" value="company" />
        </Picker>
      </View>

      {/* Only show truck settings if role is trucker */}
      {role === 'trucker' && (
        <>
          <Text style={styles.sectionTitle}>Truck Settings</Text>

          {/* Dimensions Section */}
          <Text style={styles.sectionTitle}>Cargo Dimensions</Text>
          <Text style={styles.label}>Length (meters)</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter length"
            placeholderTextColor="#666"
            value={length}
            onChangeText={setLength}
            keyboardType="decimal-pad"
          />
          <Text style={styles.label}>Width (meters)</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter width"
            placeholderTextColor="#666"
            value={width}
            onChangeText={setWidth}
            keyboardType="decimal-pad"
          />
          <Text style={styles.label}>Height (meters)</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter height"
            placeholderTextColor="#666"
            value={height}
            onChangeText={setHeight}
            keyboardType="decimal-pad"
          />

          {/* Cargo Capacity */}
          <Text style={styles.sectionTitle}>Cargo Capacity</Text>
          <Text style={styles.label}>Max Cargo Weight (kg)</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter max cargo weight"
            placeholderTextColor="#666"
            value={maxCargoWeight}
            onChangeText={setMaxCargoWeight}
            keyboardType="decimal-pad"
          />
          <Text style={styles.label}>Max Cargo Volume (m³)</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter max cargo volume"
            placeholderTextColor="#666"
            value={maxCargoVolume}
            onChangeText={setMaxCargoVolume}
            keyboardType="decimal-pad"
          />

          {/* Starting Location Section */}
          <Text style={styles.sectionTitle}>Starting Location</Text>
          <TouchableOpacity onPress={() => setUseMapPicker(!useMapPicker)}>
            <Text style={styles.toggleMapText}>
              {useMapPicker ? "Hide Map" : "Show Map"}
            </Text>
          </TouchableOpacity>

          {useMapPicker && (
            <MapView
              style={styles.map}
              onPress={(e) => {
                const { latitude, longitude } = e.nativeEvent.coordinate;
                setStartLatitude(latitude.toString());
                setStartLongitude(longitude.toString());
                setMapMarker({ latitude, longitude });
              }}
              initialRegion={{
                latitude: parseFloat(startLatitude) || 55.6816,
                longitude: parseFloat(startLongitude) || 12.5299,
                latitudeDelta: 0.0922,
                longitudeDelta: 0.0421,
              }}
            >
              {mapMarker && <Marker coordinate={mapMarker} />}
            </MapView>
          )}

          {/* Location Input Fields */}
          <View>
            <Text style={styles.label}>Starting Latitude</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter starting latitude"
              placeholderTextColor="#666"
              value={startLatitude}
              onChangeText={setStartLatitude}
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>Starting Longitude</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter starting longitude"
              placeholderTextColor="#666"
              value={startLongitude}
              onChangeText={setStartLongitude}
              keyboardType="decimal-pad"
            />
          </View>

          {/* Time Settings Section */}
          <Text style={styles.sectionTitle}>Time Settings</Text>
          <Text style={styles.label}>Work Start Time (24h format)</Text>
          <TextInput
            style={styles.input}
            value={workStartTime}
            onChangeText={setWorkStartTime}
            keyboardType="decimal-pad"
            placeholder="e.g., 8 for 8:00 AM"
            placeholderTextColor="#666"
          />
          <Text style={styles.label}>Work End Time (24h format)</Text>
          <TextInput
            style={styles.input}
            value={workEndTime}
            onChangeText={setWorkEndTime}
            keyboardType="decimal-pad"
            placeholder="e.g., 20 for 8:00 PM"
            placeholderTextColor="#666"
          />
          <Text style={styles.label}>Max Driving Time per Day (hours): {maxDrivingTime}</Text>
          <Slider
            minimumValue={1}
            maximumValue={12}
            step={1}
            value={parseFloat(maxDrivingTime)}
            onValueChange={setMaxDrivingTime}
            style={styles.slider}
          />

          {/* Break Settings */}
          <Text style={styles.label}>Break Window</Text>
          <View style={styles.breakWindowContainer}>
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="Start hour"
              placeholderTextColor="#666"
              value={breakStartMin}
              onChangeText={setBreakStartMin}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="End hour"
              placeholderTextColor="#666"
              value={breakStartMax}
              onChangeText={setBreakStartMax}
              keyboardType="decimal-pad"
            />
          </View>
          <Text style={styles.label}>Break Duration (hours)</Text>
          <TextInput
            style={styles.input}
            value={breakDuration}
            onChangeText={setBreakDuration}
            keyboardType="decimal-pad"
            placeholderTextColor="#666"
          />

          {/* Efficiency Settings */}
          <Text style={styles.sectionTitle}>Efficiency Settings</Text>
          <Text style={styles.label}>Fuel Efficiency (km/L)</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter fuel efficiency"
            placeholderTextColor="#666"
            value={fuelEfficiency}
            onChangeText={setFuelEfficiency}
            keyboardType="decimal-pad"
          />
          <Text style={styles.label}>Average Speed (km/h): {averageSpeed}</Text>
          <Slider
            minimumValue={30}
            maximumValue={90}
            step={5}
            value={averageSpeed}
            onValueChange={setAverageSpeed}
            style={styles.slider}
          />
        </>
      )}

      {/* Buttons */}
      <Button title="Update Preferences" onPress={savePreferences} />
      <View style={styles.logoutButtonContainer}>
        <Button title="Logout" onPress={handleLogout} color="#FF3B30" />
      </View>
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
  inputLabel: {
    fontSize: 16,
    marginBottom: 5,
    color: "#333",
    color: "#1b1811",
  },
  input: {
    height: 40,
    borderColor: "#ccc",
    borderWidth: 1,
    marginBottom: 20,
    paddingHorizontal: 10,
    borderRadius: 5,
    backgroundColor: "#fff",
    color: "#000",
    fontSize: 16,
  },

  label: {
    fontSize: 16,
    marginBottom: 5,
    color: "#333",
    fontWeight: "500",
  },
  pickerContainer: {
    borderColor: "gray",
    borderWidth: 0,
    borderRadius: 5,
    marginBottom: 20,
    overflow: "hidden",
    backgroundColor: "#fff", // Ensure background is white
  },
  picker: {
    height: 50,
    width: "100%",
    color: "#000", // Set text color to black
  },
  pickerItem: {
    height: 50,
    color: "#000", // For iOS Picker items
  },
  logoutButtonContainer: {
    marginTop: 30,
    alignSelf: "center",
    width: "60%",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  toggleMapText: {
    color: "#1EB1FC",
    textAlign: "center",
    marginBottom: 10,
  },
  map: {
    height: 200,
    marginBottom: 20,
  },
  breakWindowContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  halfInput: {
    width: "48%",
  },
});

export default ProfileScreen;
