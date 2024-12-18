// components/Register.js
// Til at oprette en ny bruger i Firebase Authentication og gemme brugerdata i Realtime Database

import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getDatabase, ref, set } from 'firebase/database';

const RegisterScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('trucker'); // Standardrolle

  const handleRegister = async () => {
    if (password !== confirmPassword) {
      Alert.alert('Fejl', 'Adgangskoderne stemmer ikke overens');
      return;
    }

    const auth = getAuth();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Gem brugerrolle i databasen
      const db = getDatabase();
      await set(ref(db, 'users/' + user.uid), {
        role,
        // Initialiser andre brugerdata her, hvis nødvendigt
      });

      Alert.alert('Succes', 'Registrering lykkedes!');
      navigation.navigate('Login');
    } catch (error) {
      Alert.alert('Registreringsfejl', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Registrer</Text>
      
      {/* E-mail Indtastning */}
      <Text style={styles.inputLabel}>E-mail</Text>
      <TextInput
        style={styles.input}
        placeholder="Indtast din e-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      
      {/* Adgangskode Indtastning */}
      <Text style={styles.inputLabel}>Adgangskode</Text>
      <TextInput
        style={styles.input}
        placeholder="Indtast din adgangskode"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      
      {/* Bekræft Adgangskode Indtastning */}
      <Text style={styles.inputLabel}>Gentag Adgangskode</Text>
      <TextInput
        style={styles.input}
        placeholder="Bekræft din adgangskode"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />
      
      {/* Rollevalg */}
      <Text style={styles.label}>Registrer Som:</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={role}
          onValueChange={(itemValue) => setRole(itemValue)}
          style={styles.picker}
          itemStyle={styles.pickerItem} // For iOS
        >
          <Picker.Item label="Trucker" value="trucker" />
          <Picker.Item label="Firma" value="company" />
        </Picker>
      </View>
      
      {/* Registrer-knap */}
      <Button title="Registrer" onPress={handleRegister} />
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
    backgroundColor: '#fff', 
  },
  picker: {
    height: 50,
    width: '100%',
    color: '#000', 
  },
  pickerItem: {
    height: 50,
    color: '#000', 
  },
  logoutButtonContainer: {
    marginTop: 30,
    alignSelf: 'center',
    width: '60%',
  },
});

export default RegisterScreen;
