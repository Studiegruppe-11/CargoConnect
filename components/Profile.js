// components/Profile.js
// Til at vise og redigere brugerpræferencer

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
  SafeAreaView,
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

  // Opret debounced gem funktion
  const debouncedSave = debounce(async (preferences) => {
    if (!user) return;
    
    const userRef = ref(database, `users/${user.uid}`);
    try {
      await update(userRef, preferences);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error(error);
      Alert.alert('Fejl', 'Kunne ikke gemme ændringer');
    }
  }, 1000); // Vil gemme efter 1 sekund uden ændringer

  // Fjern duplikerede/unødvendige tilstandsvariabler
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Tilføj rollevalg før køretøjsinformation
  const [role, setRole] = useState('trucker');

  // Køretøjsinformation
  const [vehicleId, setVehicleId] = useState(`veh-${auth.currentUser?.uid || 'new'}`);
  const [maxCargoWeight, setMaxCargoWeight] = useState('');
  const [maxCargoVolume, setMaxCargoVolume] = useState('');
  const [licensePlate, setLicensePlate] = useState('');

  // Dimensioner
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');

  // Stedindstillinger
  const [startLatitude, setStartLatitude] = useState('');
  const [startLongitude, setStartLongitude] = useState('');
  const [useMapPicker, setUseMapPicker] = useState(false);
  const [mapMarker, setMapMarker] = useState(null);

  // Tidsbegrænsninger
  const [workStartTime, setWorkStartTime] = useState('8');
  const [workEndTime, setWorkEndTime] = useState('20');
  const [maxDrivingTime, setMaxDrivingTime] = useState('12');
  const [breakStartMin, setBreakStartMin] = useState('12');
  const [breakStartMax, setBreakStartMax] = useState('13');
  const [breakDuration, setBreakDuration] = useState('0.5');

  // Effektivitetsindstillinger
  const [fuelEfficiency, setFuelEfficiency] = useState('');
  const [fuelCost, setFuelCost] = useState('0');
  const [averageSpeed, setAverageSpeed] = useState(60);

  // Turindstillinger
  const [skipFirstTrip, setSkipFirstTrip] = useState(false);
  const [dropReturnTrip, setDropReturnTrip] = useState(false);
  const [minTasksPerDay, setMinTasksPerDay] = useState('1');

  // Andre præferencer
  const [preferredCountries, setPreferredCountries] = useState('');
  const [availability, setAvailability] = useState('');

  // Tilføj tilstand for usaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Tilføj auth state listener
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

  // Tilføj before remove listener
  useEffect(() => {
    const handleBeforeRemove = (e) => {
      if (!hasUnsavedChanges) return;
      
      e.preventDefault();
      Alert.alert(
        'Usavedede Ændringer',
        'Vil du gemme dine ændringer før du forlader?',
        [
          {
            text: 'Gem',
            onPress: async () => {
              await savePreferences();
              navigation.dispatch(e.data.action);
            },
          },
          {
            text: 'Forlad uden at gemme',
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
          {
            text: 'Annuller',
            style: 'cancel',
          },
        ]
      );
    };

    navigation.addListener('beforeRemove', handleBeforeRemove);
    return () => navigation.removeListener('beforeRemove', handleBeforeRemove);
  }, [hasUnsavedChanges, navigation]);

  // Indlæs brugerpræferencer
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
        setRole(data.role || "trucker"); // Tilføjet rolle
        setAvailability(data.availability || "");
        setStartLatitude(data.startLatitude ? data.startLatitude.toString() : '');
        setStartLongitude(data.startLongitude ? data.startLongitude.toString() : '');
        setLength(data.dimensions?.length?.toString() || '');
        setWidth(data.dimensions?.width?.toString() || '');
        setHeight(data.dimensions?.height?.toString() || '');
        setLicensePlate(data.licensePlate || '');
        setLicenseVerified(data.licenseVerified || false);
        setLicenseScanned(data.licenseVerified || false); // Opdater UI state baseret på database
      }
      setLoading(false);
    }, {
      onlyOnce: true
    });
  };

  // Gem præferencer med brugercheck
  const savePreferences = async () => {
    if (!user) {
      Alert.alert('Fejl', 'Du skal være logget ind for at gemme præferencer');
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
      Alert.alert('Succes', 'Præferencer gemt successfully!');
    } catch (error) {
      console.error(error);
      Alert.alert('Fejl', 'Kunne ikke gemme præferencer');
    }
  };

  const handleLogout = () => {
    signOut(auth)
      .then(() => {
        navigation.navigate('Login');
      })
      .catch((error) => {
        console.error("Logout fejl:", error);
        Alert.alert("Fejl", "Kunne ikke logge ud.");
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
      // Opdater lokal state for at afspejle, at licensen er scannet og verificeret
      setLicenseScanned(true);
      setLicenseVerified(true);
  
      // Gem verifikationsstatus til databasen
      const userRef = ref(database, `users/${user.uid}`);
      try {
        await update(userRef, { licenseVerified: true });
      } catch (error) {
        console.error('Fejl ved opdatering af licensstatus:', error);
        Alert.alert('Fejl', 'Kunne ikke opdatere licensstatus');
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
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Indstillinger</Text>

        {/* Tilføj Rollevalg øverst */}
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
            ]}>Firma</Text>
          </TouchableOpacity>
        </View>

        {/* Tilføj Felt for Nummerplade */}
        {role === 'trucker' && (
          <>
            <View style={styles.scannerContainer}>
              {licenseVerified ? (
                <View style={styles.successContainer}>
                  <Ionicons name="checkmark-circle" size={40} color="#4CAF50" />
                  <Text style={styles.successText}>Licens Verificeret</Text>
                </View>
              ) : (
                <TouchableOpacity 
                  style={styles.scanButton} 
                  onPress={handleScanLicense}
                >
                  <Ionicons name="camera" size={24} color="#fff" />
                  <Text style={styles.scanButtonText}>Scan Licens</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.sectionTitle}>Køretøjsinformation</Text>
            <Text style={styles.label}>Nummerplade</Text>
            <TextInput
              style={styles.input}
              placeholder="Indtast nummerplade"
              placeholderTextColor="#666"
              value={licensePlate}
              onChangeText={(text) => {
                setLicensePlate(text);
                setHasUnsavedChanges(true);
              }}
            />

            {/* Dimensioner Sektion direkte efter nummerplade */}
            <Text style={styles.sectionTitle}>Lastdimensioner</Text>
            <Text style={styles.inputLabel}>Længde (cm):</Text>
            <TextInput
              style={styles.input}
              value={length}
              onChangeText={(text) => {
                setLength(text);
                setHasUnsavedChanges(true);
              }}
              keyboardType="numeric"
            />
            <Text style={styles.inputLabel}>Bredde (cm):</Text>
            <TextInput
              style={styles.input}
              value={width}
              onChangeText={(text) => {
                setWidth(text);
                setHasUnsavedChanges(true);
              }}
              keyboardType="numeric"
            />
            <Text style={styles.inputLabel}>Højde (cm):</Text>
            <TextInput
              style={styles.input}
              value={height}
              onChangeText={(text) => {
                setHeight(text);
                setHasUnsavedChanges(true);
              }}
              keyboardType="numeric"
            />

            {/* Lastkapacitet */}
            <Text style={styles.sectionTitle}>Lastkapacitet</Text>
            <Text style={styles.label}>Maks Lastvægt (kg)</Text>
            <TextInput
              style={styles.input}
              placeholder="Indtast maks lastvægt"
              placeholderTextColor="#666"
              value={maxCargoWeight}
              onChangeText={(text) => {
                setMaxCargoWeight(text);
                setHasUnsavedChanges(true);
              }}
              keyboardType="decimal-pad"
            />
            <Text style={styles.label}>Maks Lastvolumen (m³)</Text>
            <TextInput
              style={styles.input}
              placeholder="Indtast maks lastvolumen"
              placeholderTextColor="#666"
              value={maxCargoVolume}
              onChangeText={(text) => {
                setMaxCargoVolume(text);
                setHasUnsavedChanges(true);
              }}
              keyboardType="decimal-pad"
            />

            {/* Startplacering Sektion */}
            <Text style={styles.sectionTitle}>Startplacering</Text>
            <TouchableOpacity onPress={() => setUseMapPicker(!useMapPicker)}>
              <Text style={styles.toggleMapText}>
                {useMapPicker ? "Skjul Kort" : "Vis Kort"}
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

            {/* Indtastningsfelter for Sted */}
            <View>
              <Text style={styles.label}>Start Latitude</Text>
              <TextInput
                style={styles.input}
                placeholder="Indtast start latitude"
                placeholderTextColor="#666"
                value={startLatitude}
                onChangeText={(text) => {
                  setStartLatitude(text);
                  setHasUnsavedChanges(true);
                }}
                keyboardType="decimal-pad"
              />

              <Text style={styles.label}>Start Longitude</Text>
              <TextInput
                style={styles.input}
                placeholder="Indtast start longitude"
                placeholderTextColor="#666"
                value={startLongitude}
                onChangeText={(text) => {
                  setStartLongitude(text);
                  setHasUnsavedChanges(true);
                }}
                keyboardType="decimal-pad"
              />
            </View>

            {/* Tidsindstillinger Sektion */}
            <Text style={styles.sectionTitle}>Tidsindstillinger</Text>
            <Text style={styles.label}>Arbejdsstarttid (24-timers format)</Text>
            <TextInput
              style={styles.input}
              value={workStartTime}
              onChangeText={(text) => {
                setWorkStartTime(text);
                setHasUnsavedChanges(true);
              }}
              keyboardType="decimal-pad"
              placeholder="f.eks., 8 for 8:00 AM"
              placeholderTextColor="#666"
            />
            <Text style={styles.label}>Arbejdssluttid (24-timers format)</Text>
            <TextInput
              style={styles.input}
              value={workEndTime}
              onChangeText={(text) => {
                setWorkEndTime(text);
                setHasUnsavedChanges(true);
              }}
              keyboardType="decimal-pad"
              placeholder="f.eks., 20 for 8:00 PM"
              placeholderTextColor="#666"
            />
            <Text style={styles.label}>Maks Køretid pr. Dag (timer): {maxDrivingTime}</Text>
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

            {/* Pauseindstillinger */}
            <Text style={styles.label}>Pausevindue</Text>
            <View style={styles.breakWindowContainer}>
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="Start time"
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
                placeholder="Slut time"
                placeholderTextColor="#666"
                value={breakStartMax}
                onChangeText={(text) => {
                  setBreakStartMax(text);
                  setHasUnsavedChanges(true);
                }}
                keyboardType="decimal-pad"
              />
            </View>
            <Text style={styles.label}>Pause Varighed (timer)</Text>
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

            {/* Effektivitetsindstillinger */}
            <Text style={styles.sectionTitle}>Effektivitetsindstillinger</Text>
            <Text style={styles.label}>Brændstofeffektivitet (km/L)</Text>
            <TextInput
              style={styles.input}
              placeholder="Indtast brændstofeffektivitet"
              placeholderTextColor="#666"
              value={fuelEfficiency}
              onChangeText={(text) => {
                setFuelEfficiency(text);
                setHasUnsavedChanges(true);
              }}
              keyboardType="decimal-pad"
            />
            <Text style={styles.label}>Gennemsnitshastighed (km/t): {averageSpeed}</Text>
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

        {/* Tilføj en gem knap nær logout knappen */}
        <View style={styles.buttonContainer}>
          {hasUnsavedChanges && (
            <Button 
              title="Gem Ændringer" 
              onPress={savePreferences}
              color="#007AFF" 
            />
          )}
          <View style={styles.logoutButtonContainer}>
            <Button title="Log Ud" onPress={handleLogout} color="#FF3B30" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
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
    flex: 0.48, // Ændret fra 1 for at skabe mellemrum
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
