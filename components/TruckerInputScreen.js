// components/TruckerInputScreen.js

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { ref, set } from 'firebase/database';
import { auth, database } from '../firebaseConfig';

const TruckerInputScreen = () => {
  // State variables specific to trucker functionalities
  const [driverName, setDriverName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  
  const handleSubmit = () => {
    if (!driverName || !licenseNumber || !experienceYears) {
      Alert.alert('Missing Information', 'Please fill all fields.');
      return;
    }

    const user = auth.currentUser;
    if (user) {
      const truckerRef = ref(database, 'truckers/' + user.uid);
      set(truckerRef, {
        driverName,
        licenseNumber,
        experienceYears: parseInt(experienceYears, 10),
      })
        .then(() => {
          Alert.alert('Success', 'Trucker information saved!');
        })
        .catch((error) => {
          console.error(error);
          Alert.alert('Error', 'Failed to save trucker information.');
        });
    } else {
      Alert.alert('Authentication Required', 'Please log in first.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Trucker Information</Text>

      {/* Driver Name */}
      <Text style={styles.label}>Driver Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your name"
        value={driverName}
        onChangeText={setDriverName}
      />

      {/* License Number */}
      <Text style={styles.label}>License Number</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter license number"
        value={licenseNumber}
        onChangeText={setLicenseNumber}
      />

      {/* Experience Years */}
      <Text style={styles.label}>Years of Experience: {experienceYears}</Text>
      <Slider
        minimumValue={0}
        maximumValue={40}
        step={1}
        value={experienceYears}
        onValueChange={setExperienceYears}
        style={styles.slider}
        minimumTrackTintColor="#1EB1FC"
        maximumTrackTintColor="#d3d3d3"
        thumbTintColor="#1EB1FC"
      />

      {/* Save Trucker Information Button */}
      <Button title="Save Information" onPress={handleSubmit} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 20,
    backgroundColor: '#f9f9f9',
    justifyContent: 'center',
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
  slider: {
    width: '100%',
    height: 40,
    marginBottom: 20,
  },
});

export default TruckerInputScreen;
