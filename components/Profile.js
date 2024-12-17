// components/Profile.js

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
  PermissionsAndroid,
  Platform,
} from "react-native";
import Slider from "@react-native-community/slider";
import { ref, onValue, update, set } from "firebase/database";
import { auth, database } from "../firebaseConfig";
import { signOut } from "firebase/auth";
import MapView, { Marker } from 'react-native-maps';
import { onAuthStateChanged } from "firebase/auth";
import { debounce } from 'lodash';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from 'react-native-vector-icons/Ionicons';


const ProfileScreen = ({ navigation }) => {
  const [licenseScanned, setLicenseScanned] = useState(false);
  const [licenseVerified, setLicenseVerified] = useState(false);

  // Create debounced save function
  const debouncedSave = debounce(async (preferences) => {
    if (!user) return;
    
    const userRef = ref(database, `users/${user.uid}`);
    try {
      await update(userRef, preferences);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to save changes');
    }
  }, 1000); // Will save after 1 second of no changes

  // Remove duplicate/unnecessary state variables
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Add role selection before vehicle info
  const [role, setRole] = useState('trucker');

  // Vehicle info
  const [vehicleId, setVehicleId] = useState(`veh-${auth.currentUser?.uid || 'new'}`);
  const [maxCargoWeight, setMaxCargoWeight] = useState('');
  const [maxCargoVolume, setMaxCargoVolume] = useState('');
  const [licensePlate, setLicensePlate] = useState('');

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

  // Add unsaved changes state
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

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

  // Add before remove listener
  useEffect(() => {
    const handleBeforeRemove = (e) => {
      if (!hasUnsavedChanges) return;
      
      e.preventDefault();
      Alert.alert(
        'Unsaved Changes',
        'Do you want to save your changes before leaving?',
        [
          {
            text: 'Save',
            onPress: async () => {
              await savePreferences();
              navigation.dispatch(e.data.action);
            },
          },
          {
            text: 'Leave without saving',
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
    };

    navigation.addListener('beforeRemove', handleBeforeRemove);
    return () => navigation.removeListener('beforeRemove', handleBeforeRemove);
  }, [hasUnsavedChanges, navigation]);

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
        setLicensePlate(data.licensePlate || '');
        setLicenseVerified(data.licenseVerified || false);
        setLicenseScanned(data.licenseVerified || false); // Update UI state based on database
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
      role,
      licensePlate,
      maxCargoWeight: Number(maxCargoWeight) || 8000,
      dimensions: {
        length: parseFloat(length) || 0,
        width: parseFloat(width) || 0,
        height: parseFloat(height) || 0
      },
      startLatitude: parseFloat(startLatitude) || 0,
      startLongitude: parseFloat(startLongitude) || 0,
    };

    try {
      await update(userRef, preferences);
      setHasUnsavedChanges(false);
      Alert.alert('Success', 'Preferences saved successfully!');
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to save preferences');
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

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    setHasUnsavedChanges(true);
  };

  const handleScanLicense = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaType: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
  
    if (!result.cancelled) {
      // Update local state to reflect that the license has been scanned and verified
      setLicenseScanned(true);
      setLicenseVerified(true);
  
      // Save the verification status to the database
      const userRef = ref(database, `users/${user.uid}`);
      try {
        await update(userRef, { licenseVerified: true });
      } catch (error) {
        console.error('Error updating license status:', error);
        Alert.alert('Error', 'Failed to update license status');
      }
    }
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
      <Text style={styles.title}>Settings</Text>

      {/* Add Role Selection at the top */}
      <View style={styles.roleButtonContainer}>
        <TouchableOpacity 
          style={[
            styles.roleButton, 
            role === 'trucker' && styles.roleButtonActive
          ]}
          onPress={() => handleRoleChange('trucker')}
        >
          <Text style={[
            styles.roleButtonText,
            role === 'trucker' && styles.roleButtonTextActive
          ]}>Trucker</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[
            styles.roleButton, 
            role === 'company' && styles.roleButtonActive
          ]}
          onPress={() => handleRoleChange('company')}
        >
          <Text style={[
            styles.roleButtonText,
            role === 'company' && styles.roleButtonTextActive
          ]}>Company</Text>
        </TouchableOpacity>
      </View>

      {/* Add License Plate field */}
      {role === 'trucker' && (
        <>
          <View style={styles.scannerContainer}>
            {licenseVerified ? (
              <View style={styles.successContainer}>
                <Ionicons name="checkmark-circle" size={40} color="#4CAF50" />
                <Text style={styles.successText}>License Verified</Text>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.scanButton} 
                onPress={handleScanLicense}
              >
                <Ionicons name="camera" size={24} color="#fff" />
                <Text style={styles.scanButtonText}>Scan License</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.sectionTitle}>Vehicle Information</Text>
          <Text style={styles.label}>License Plate</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter license plate"
            placeholderTextColor="#666"
            value={licensePlate}
            onChangeText={(text) => {
              setLicensePlate(text);
              setHasUnsavedChanges(true);
            }}
          />

          {/* Dimensions Section directly after license plate */}
          <Text style={styles.sectionTitle}>Cargo Dimensions</Text>
          <Text style={styles.inputLabel}>Length (cm):</Text>
          <TextInput
            style={styles.input}
            value={length}
            onChangeText={(text) => {
              setLength(text);
              setHasUnsavedChanges(true);
            }}
            keyboardType="numeric"
          />
          <Text style={styles.inputLabel}>Width (cm):</Text>
          <TextInput
            style={styles.input}
            value={width}
            onChangeText={(text) => {
              setWidth(text);
              setHasUnsavedChanges(true);
            }}
            keyboardType="numeric"
          />
          <Text style={styles.inputLabel}>Height (cm):</Text>
          <TextInput
            style={styles.input}
            value={height}
            onChangeText={(text) => {
              setHeight(text);
              setHasUnsavedChanges(true);
            }}
            keyboardType="numeric"
          />

          {/* Cargo Capacity */}
          <Text style={styles.sectionTitle}>Cargo Capacity</Text>
          <Text style={styles.label}>Max Cargo Weight (kg)</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter max cargo weight"
            placeholderTextColor="#666"
            value={maxCargoWeight}
            onChangeText={(text) => {
              setMaxCargoWeight(text);
              setHasUnsavedChanges(true);
            }}
            keyboardType="decimal-pad"
          />
          <Text style={styles.label}>Max Cargo Volume (m³)</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter max cargo volume"
            placeholderTextColor="#666"
            value={maxCargoVolume}
            onChangeText={(text) => {
              setMaxCargoVolume(text);
              setHasUnsavedChanges(true);
            }}
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
                setHasUnsavedChanges(true);
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
              onChangeText={(text) => {
                setStartLatitude(text);
                setHasUnsavedChanges(true);
              }}
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>Starting Longitude</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter starting longitude"
              placeholderTextColor="#666"
              value={startLongitude}
              onChangeText={(text) => {
                setStartLongitude(text);
                setHasUnsavedChanges(true);
              }}
              keyboardType="decimal-pad"
            />
          </View>

          {/* Time Settings Section */}
          <Text style={styles.sectionTitle}>Time Settings</Text>
          <Text style={styles.label}>Work Start Time (24h format)</Text>
          <TextInput
            style={styles.input}
            value={workStartTime}
            onChangeText={(text) => {
              setWorkStartTime(text);
              setHasUnsavedChanges(true);
            }}
            keyboardType="decimal-pad"
            placeholder="e.g., 8 for 8:00 AM"
            placeholderTextColor="#666"
          />
          <Text style={styles.label}>Work End Time (24h format)</Text>
          <TextInput
            style={styles.input}
            value={workEndTime}
            onChangeText={(text) => {
              setWorkEndTime(text);
              setHasUnsavedChanges(true);
            }}
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
            onValueChange={(value) => {
              setMaxDrivingTime(value.toString());
              setHasUnsavedChanges(true);
            }}
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
              onChangeText={(text) => {
                setBreakStartMin(text);
                setHasUnsavedChanges(true);
              }}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="End hour"
              placeholderTextColor="#666"
              value={breakStartMax}
              onChangeText={(text) => {
                setBreakStartMax(text);
                setHasUnsavedChanges(true);
              }}
              keyboardType="decimal-pad"
            />
          </View>
          <Text style={styles.label}>Break Duration (hours)</Text>
          <TextInput
            style={styles.input}
            value={breakDuration}
            onChangeText={(text) => {
              setBreakDuration(text);
              setHasUnsavedChanges(true);
            }}
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
            onChangeText={(text) => {
              setFuelEfficiency(text);
              setHasUnsavedChanges(true);
            }}
            keyboardType="decimal-pad"
          />
          <Text style={styles.label}>Average Speed (km/h): {averageSpeed}</Text>
          <Slider
            minimumValue={30}
            maximumValue={90}
            step={5}
            value={averageSpeed}
            onValueChange={(value) => {
              setAverageSpeed(value);
              setHasUnsavedChanges(true);
            }}
            style={styles.slider}
          />
        </>
      )}

      {/* Add a save button near the logout button */}
      <View style={styles.buttonContainer}>
        {hasUnsavedChanges && (
          <Button 
            title="Save Changes" 
            onPress={savePreferences}
            color="#007AFF" 
          />
        )}
        <View style={styles.logoutButtonContainer}>
          <Button title="Logout" onPress={handleLogout} color="#FF3B30" />
        </View>
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
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 5,
    marginBottom: 20,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  picker: {
    height: 50,
    width: "100%",
    color: "#333", 
  },
  pickerItem: {
    height: 50,
    color: "#333",
  },
  buttonContainer: {
    marginTop: 20,
    marginBottom: 20,
  },
  logoutButtonContainer: {
    marginTop: 10,
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
  roleButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    marginTop: 10,
    paddingHorizontal: 10,
  },
  roleButton: {
    flex: 0.48, // Changed from 1 to create spacing
    padding: 15,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  roleButtonActive: {
    backgroundColor: "#1EB1FC",
  },
  roleButtonText: {
    color: "#333",
    fontWeight: "500",
  },
  roleButtonTextActive: {
    color: "#fff",
  },
  scannerContainer: {
    alignItems: 'center',
    marginVertical: 15,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1EB1FC',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  successContainer: {
    alignItems: 'center',
  },
  successText: {
    color: '#4CAF50',
    marginTop: 4,
    fontSize: 14,
  },
});

export default ProfileScreen;
