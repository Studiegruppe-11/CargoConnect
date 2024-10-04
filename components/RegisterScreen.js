// components/RegisterScreen.js

import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getDatabase, ref, set } from 'firebase/database';

const RegisterScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('trucker'); // Default role

  const handleRegister = async () => {
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    const auth = getAuth();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Save user role in the database
      const db = getDatabase();
      await set(ref(db, 'users/' + user.uid), {
        role,
        // Initialize other user data here if necessary
      });

      Alert.alert('Success', 'Registration successful!');
      navigation.navigate('Login');
    } catch (error) {
      Alert.alert('Registration Error', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Register</Text>
      
      {/* Email Input */}
      <Text style={styles.inputLabel}>Email</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      
      {/* Password Input */}
      <Text style={styles.inputLabel}>Password</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      
      {/* Confirm Password Input */}
      <Text style={styles.inputLabel}>Repeat Password</Text>
      <TextInput
        style={styles.input}
        placeholder="Confirm your password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />
      
      {/* Role Selection */}
      <Text style={styles.label}>Register As:</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={role}
          onValueChange={(itemValue) => setRole(itemValue)}
          style={styles.picker}
          itemStyle={styles.pickerItem} // For iOS
        >
          <Picker.Item label="Trucker" value="trucker" />
          <Picker.Item label="Company" value="company" />
        </Picker>
      </View>
      
      {/* Register Button */}
      <Button title="Register" onPress={handleRegister} />
    </View>
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
  inputLabel: {
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
  label: {
    fontSize: 16,
    marginBottom: 5,
    color: '#333',
  },
  pickerContainer: {
    borderColor: 'gray',
    borderWidth: 0,
    borderRadius: 5,
    marginBottom: 20,
    overflow: 'hidden',
    backgroundColor: '#fff', // Ensure background is white
  },
  picker: {
    height: 50,
    width: '100%',
    color: '#000', // Set text color to black
  },
  pickerItem: {
    height: 50,
    color: '#000', // For iOS Picker items
  },
  logoutButtonContainer: {
    marginTop: 30,
    alignSelf: 'center',
    width: '60%',
  },
});

export default RegisterScreen;
