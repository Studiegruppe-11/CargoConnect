// components/Login.js
// Login komponent til håndtering af brugerautentifikation

import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// Hovedkomponent for login-skærmen
const LoginScreen = ({ navigation }) => {
  // State variabler til at gemme brugerens input
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Funktion til at håndtere login-processen
  const handleLogin = async () => {
    const auth = getAuth();
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      Alert.alert('Login Fejl', error.message);
    }
  };

  // Render login-formularen
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>
      <Text>Email</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your email"
        value={email}
        onChangeText={setEmail}
      />
      <Text>Password</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <View style={styles.buttonContainer}>
        <Button title="Login" onPress={handleLogin} />
        <View style={styles.registerButton}>
          <Button title="Register" onPress={() => navigation.navigate('Register')} />
        </View>
      </View>
    </View>
  );
};

// Styling for komponenten
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    padding: 20 
  },
  title: { 
    fontSize: 24, 
    marginBottom: 20, 
    textAlign: 'center' 
  },
  input: { 
    height: 40, 
    borderColor: 'gray', 
    borderWidth: 1, 
    marginBottom: 20, 
    paddingHorizontal: 10, 
    borderRadius: 8
  },
  buttonContainer: {
    marginTop: 10,
    borderRadius: 8
  },
  registerButton: {
    marginTop: 15,
    borderRadius: 25
  }
});

export default LoginScreen;