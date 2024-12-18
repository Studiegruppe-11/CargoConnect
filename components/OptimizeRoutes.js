// components/OptimizeRoutes.js

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Button,
  SafeAreaView,
  ScrollView,
} from "react-native";
import { auth } from "../firebaseConfig";
import { useIsFocused } from "@react-navigation/native";
import { onAuthStateChanged } from "firebase/auth";

// Import functions from nvApi.js
import { 
  validatePayload, 
  callCuOptAPI, 
  processOptimizedRoutes
} from '../utils/nvApi';

// Import functions from internFetcher.js
import { fetchDeliveries, fetchUserConstraints } from '../utils/internFetcher';

import { 
  prepareCuOptPayload, 
  saveOptimizedRoutes,
  requestRoute,
  handleOptimizationError
} from '../utils/optimizationUtils';

const OptimizeRoutesScreen = ({ navigation }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [optimizationStatus, setOptimizationStatus] = useState(
    "Optimizing routes..."
  );
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState(null);
  const isFocused = useIsFocused();

  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        Alert.alert('Error', 'Please login first');
        navigation.navigate('Login');
      }
    });
    return () => unsubscribe();
  }, []);

  console.log("OptimizeRoutesScreen mounted.");

  useEffect(() => {
    console.log("onAuthStateChanged effect triggered.");
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log("onAuthStateChanged currentUser:", currentUser);
      if (!currentUser) {
        console.log("No user, navigating to Login...");
        navigation.replace("Login");
        return;
      }
      setUser(currentUser);
      try {
        if (!auth.currentUser) {
          navigation.replace("Login");
          return;
        }
        const constraints = await fetchUserConstraints(navigation);
        console.log("Fetched constraints on auth change");
        if (!constraints) {
          throw new Error("No vehicle constraints found");
        }

        // Fetch deliveries here.
        const deliveries = await fetchDeliveries();
        console.log("Fetched deliveries");

        // Now data is ready, show buttons:
        setLoading(false);

      } catch (error) {
        handleOptimizationError(error, navigation);
        setLoading(false);
      }
    });

    return () => {
      console.log("Cleanup onAuthStateChanged.");
      unsubscribe();
    };
  }, [navigation]);

  const optimizeRoutes = async () => {
    if (!user) {
      console.warn("optimizeRoutes called but user is not authenticated");
      throw new Error("User must be authenticated");
    }

    if (!user || !user.uid) {
      throw new Error("User is not authenticated.");
    }
  
    try {
      setLoading(true);
      console.log("Starting optimization process...");
  
      const constraints = await fetchUserConstraints(navigation);
      console.log("Fetched constraints");
  
      const deliveries = await fetchDeliveries();
      console.log("Fetched deliveries");
  
      const { payload, locations } = await prepareCuOptPayload(deliveries, constraints, user);
      console.log("Generated payload:", payload);
  
      validatePayload(payload);
      console.log("Payload validation passed");
  
      const result = await callCuOptAPI(payload);
      console.log("API response:", result);
  
      const processedRoutes = await processOptimizedRoutes(result, locations);
      console.log("Processed routes:", processedRoutes);
  
      await saveOptimizedRoutes(processedRoutes, user.uid);
      console.log("Saved optimized routes to Firebase", processedRoutes.routes);
  
      setLoading(false);
    } catch (error) {
      console.error("Optimization error:", error);
      handleOptimizationError(error, navigation);
      setLoading(false);
    }
  };

  const handleOptimizePress = async () => {
    if (optimizing) return;

    console.log("handleOptimizePress called");
    setOptimizing(true);
    setError(null);
    setOptimizationStatus("Starting optimization...");

    try {
      await optimizeRoutes();
    } catch (error) {
      console.error("Optimization failed:", error.message);
      handleOptimizationError(error, navigation);
    } finally {
      setOptimizing(false);
    }
  };

  const handleRequestRoute = async (optimizedRoute) => {
    try {
      await requestRoute(optimizedRoute, currentUser);
    } catch (error) {
      console.error('Error requesting route:', error);
      Alert.alert('Error', 'Failed to request route');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>
        <ScrollView>
          <Text style={styles.title}>Generate Routes</Text>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0000ff" />
              <Text style={styles.statusText}>{optimizationStatus}</Text>
            </View>
          ) : (
            <View style={styles.contentContainer}>
              <Text style={styles.statusText}>
                Ready to optimize routes. Press the button below to start.
              </Text>
              <View style={styles.buttonContainer}>
                <Button 
                  title="Generate Optimized Routes" 
                  onPress={handleOptimizePress}
                  disabled={loading} 
                />
                <View style={styles.buttonSpacing}>
                  <Button 
                    title="View Generated Routes" 
                    onPress={() => navigation.navigate('RouteList')} 
                  />
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  statusText: {
    fontSize: 16,
    textAlign: "center",
    marginVertical: 20,
    backgroundColor: 'transparent', // Fixes background color issue
    color: "#333",
    padding: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  contentContainer: {
    flex: 1,
    padding: 20,
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 20,
  },
  buttonSpacing: {
    marginTop: 15, // Adds space between buttons
  },
});

export default OptimizeRoutesScreen;
