// components/OptimizeRoutesScreen.js

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Alert, Button } from "react-native";
import { getDatabase, ref, onValue, set, off } from "firebase/database";
import { auth, GEOCODE_MAPS_APIKEY, NVIDIA_API_KEY } from "../firebaseConfig";
import { useIsFocused } from "@react-navigation/native";
import { onAuthStateChanged } from 'firebase/auth';

// Haversine function to calculate distance between two points
const haversineDistance = (locA, locB) => {
  const toRad = (value) => (value * Math.PI) / 180;

  const R = 6371; // Radius of the Earth in kilometers
  const dLat = toRad(locB.latitude - locA.latitude);
  const dLon = toRad(locB.longitude - locA.longitude);
  const lat1 = toRad(locA.latitude);
  const lat2 = toRad(locB.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) *
      Math.sin(dLon / 2) *
      Math.cos(lat1) *
      Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance; // in kilometers
};

const OptimizeRoutesScreen = ({ navigation }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [optimizationStatus, setOptimizationStatus] = useState("Optimizing routes...");
  const isFocused = useIsFocused();
  const database = getDatabase();
  const [vehicleConstraints, setVehicleConstraints] = useState(null);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState(null);

  // Add authentication listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        navigation.replace('Login');
        return;
      }
      setUser(currentUser);
      try {
        // Only load constraints, don't run optimization
        const constraints = await fetchUserConstraints();
        if (!constraints) {
          throw new Error("No vehicle constraints found");
        }
      } catch (error) {
        handleOptimizationError(error);
      }
    });

    return () => unsubscribe();
  }, [navigation]);

  // Fetch all deliveries from Firebase (no status filter)
  const fetchDeliveries = () => {
    return new Promise((resolve, reject) => {
      const deliveriesRef = ref(database, "deliveries");
      const onValueChange = onValue(
        deliveriesRef,
        (snapshot) => {
          const data = snapshot.val();
          const deliveries = [];
          if (data) {
            Object.keys(data).forEach((key) => {
              const delivery = data[key];
              // Include all deliveries, or apply specific status filters if needed
              deliveries.push({ id: key, ...delivery });
            });
          }
          resolve(deliveries);
        },
        (error) => {
          console.error("Error fetching deliveries:", error);
          reject(error);
        }
      );

      // Optional: To remove listener after fetching
      // off(deliveriesRef, 'value', onValueChange);
    });
  };

  // Fetch user's constraints/preferences from Firebase
  const fetchUserConstraints = () => {
    return new Promise((resolve, reject) => {
      const user = auth.currentUser;
      
      if (!user) {
        // Redirect to login if no authenticated user
        navigation.replace('Login');
        reject(new Error("User not authenticated"));
        return;
      }
  
      const userRef = ref(database, `users/${user.uid}`);
      
      onValue(userRef, 
        (snapshot) => {
          const data = snapshot.val();
          if (data) {
            // Format preferredCountries if it exists
            if (data.preferredCountries && typeof data.preferredCountries === "string") {
              data.preferredCountries = data.preferredCountries
                .split(",")
                .map((c) => c.trim());
            }
            setVehicleConstraints(data); // Store all vehicle constraints
            resolve(data);
          } else {
            resolve({});
          }
        },
        (error) => {
          console.error("Error fetching user constraints:", error);
          reject(error);
        },
        {
          // Only get the value once
          onlyOnce: true
        }
      );
    });
  };

  /**
 * Converts a timestamp to minutes since midnight
 * @param {number|string} timestamp - Unix timestamp or ISO string
 * @returns {number} Minutes since midnight, null if invalid input
 */
const convertToMinutesSinceMidnight = (timestamp) => {
  if (!timestamp) return null;
  
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return null;
    
    return date.getHours() * 60 + date.getMinutes();
  } catch (error) {
    console.warn('Invalid timestamp format:', timestamp);
    return null;
  }
};

  // Prepare the payload for NVIDIA cuOpt API
  const prepareCuOptPayload = async (deliveries, constraints) => {
    if (!user) {
      throw new Error("User must be authenticated to prepare payload");
    }
  
    if (!constraints || !constraints.maxCargoWeight) {
      console.error("Available constraints:", constraints);
      throw new Error("Vehicle constraints not loaded or incomplete");
    }

    console.log("Preparing payload with constraints:", constraints);

    const payload = {
      action: 'cuOpt_OptimizedRouting',
      data: {
        fleet_data: {
          vehicle_locations: [[
            Number(constraints.startLatitude) || 0,
            Number(constraints.startLongitude) || 0
          ]],
          vehicle_ids: [`veh-${user.uid}`],
          capacities: [
            [Number(constraints.maxCargoWeight) || 5000],
            [Number(constraints.maxCargoVolume) || 60]
          ],
          vehicle_time_windows: [[
            Number(constraints.workStartTime) * 60 || 480,
            Number(constraints.workEndTime) * 60 || 1200
          ]],
          vehicle_break_time_windows: [[
            [
              Number(constraints.breakStartMin) * 60 || 720,
              Number(constraints.breakStartMax) * 60 || 780
            ]
          ]],
          vehicle_break_durations: [[Number(constraints.breakDuration) * 60 || 30]],
          min_vehicles: 1,
          vehicle_max_times: [Number(constraints.maxDrivingTime) * 60 || 720],
          vehicle_fixed_costs: [Number(constraints.vehicleFixedCost) || 0]
        },
        // ...rest of payload structure...
      }
    };

    console.log("Generated payload:", JSON.stringify(payload, null, 2));
    return payload;
  };

  // Payload validation function
  const validatePayload = (payload) => {
    if (!payload?.data?.fleet_data) {
      throw new Error("Invalid payload structure: missing fleet_data");
    }

    const { fleet_data, task_data } = payload.data;

    // Validate vehicle capacities
    if (!Array.isArray(fleet_data.capacities)) {
      throw new Error("Invalid capacities format");
    }

    fleet_data.capacities.forEach((capacityArray) => {
      if (!Array.isArray(capacityArray)) {
        throw new Error("Invalid capacity array format");
      }
      capacityArray.forEach((capacity) => {
        if (typeof capacity !== "number" || capacity <= 0) {
          throw new Error(`Vehicle capacities must be positive numbers. Invalid value: ${capacity}`);
        }
      });
    });

    // Validate time windows
    if (fleet_data.vehicle_time_windows) {
      fleet_data.vehicle_time_windows.forEach((window) => {
        if (!Array.isArray(window) || window.length !== 2 || window[0] >= window[1]) {
          throw new Error(`Invalid vehicle time window: ${window}`);
        }
      });
    }

    // Validate task data
    if (!task_data) {
      throw new Error("Missing task_data");
    }

    if (!Array.isArray(task_data.task_locations)) {
      throw new Error("task_locations must be an array");
    }

    // Validate demands
    if (task_data.demand) {
      task_data.demand.forEach((demandArray) => {
        if (!Array.isArray(demandArray)) {
          throw new Error("Invalid demand array format");
        }
        demandArray.forEach((demand) => {
          if (typeof demand !== "number") {
            throw new Error(`Demands must be numbers. Invalid demand: ${demand}`);
          }
        });
      });
    }

    return true; // Validation passed
  };

  // Call NVIDIA cuOpt API
  const callCuOptAPI = async (payload) => {
    console.log("Calling NVIDIA cuOpt API with payload:", payload);
    
    const baseUrl = "https://optimize.api.nvidia.com/v1";
    const headers = {
      "Authorization": `Bearer ${NVIDIA_API_KEY}`,
      "Accept": "application/json",
      "Content-Type": "application/json"
    };
  
    try {
      const response = await fetch(`${baseUrl}/nvidia/cuopt`, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(payload)
      });
  
      if (response.status === 202) {
        // Handle async processing
        const requestId = response.headers.get("NVCF-REQID");
        if (!requestId) {
          throw new Error("Missing NVCF-REQID header in response");
        }
  
        // Poll for results
        let result;
        let attempts = 0;
        const maxAttempts = 10;
  
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between polls
          
          const statusResponse = await fetch(`${baseUrl}/status/${requestId}`, {
            headers: {
              "Authorization": `Bearer ${NVIDIA_API_KEY}`,
              "Accept": "application/json"
            }
          });
  
          if (statusResponse.status === 200) {
            result = await statusResponse.json();
            break;
          }
  
          if (statusResponse.status !== 202) {
            throw new Error(`Status check failed: ${statusResponse.status}`);
          }
  
          attempts++;
          setOptimizationStatus(`Optimization in progress... Attempt ${attempts}/${maxAttempts}`);
        }
  
        if (!result) {
          throw new Error("Optimization timed out");
        }
  
        return result;
      } else if (response.status === 200) {
        return await response.json();
      } else {
        const errorText = await response.text();
        throw new Error(`API request failed with status ${response.status}: ${errorText}`);
      }
    } catch (error) {
      console.error("API Call Error:", error);
      if (error.message.includes("Network request failed")) {
        throw new Error("Unable to connect to NVIDIA API. Please check your internet connection and API key.");
      }
      throw error;
    }
  };

  // Parse the optimized route from API response
  const processOptimizedRoutes = async (responseBody) => {
    if (!responseBody?.response?.solver_response?.vehicle_data) {
      throw new Error("Invalid API response format");
    }
  
    const { vehicle_data, solution_cost, num_vehicles } = responseBody.response.solver_response;
    const optimizedRoutes = [];
  
    Object.entries(vehicle_data).forEach(([vehicleId, data]) => {
      const route = {
        vehicleId,
        stops: [],
        totalCost: 0,
        totalTime: 0,
        profit: 0
      };
  
      // Process each stop in the route
      data.task_id.forEach((taskId, index) => {
        if (data.type[index] === "Delivery" || data.type[index] === "Pickup") {
          route.stops.push({
            taskId,
            type: data.type[index],
            arrivalTime: data.arrival_stamp[index],
            location: data.route[index],
            coordinates: {
              latitude: locations[data.route[index]].latitude,
              longitude: locations[data.route[index]].longitude
            }
          });
        }
      });
  
      // Calculate route metrics
      route.totalTime = data.arrival_stamp[data.arrival_stamp.length - 1];
      route.profit = calculateRouteProfit(route, locations);
      
      optimizedRoutes.push(route);
    });
  
    return {
      routes: optimizedRoutes,
      totalCost: solution_cost,
      vehiclesUsed: num_vehicles
    };
  };

  const optimizeRoutes = async () => {
    if (!user) {
      throw new Error("User must be authenticated");
    }

    try {
      setLoading(true);
      console.log("Starting optimization process...");

      // Get user constraints
      const constraints = await fetchUserConstraints();
      console.log("Fetched constraints:", constraints);

      // Get deliveries
      const deliveries = await fetchDeliveries();
      console.log("Fetched deliveries:", deliveries);

      // Generate payload
      const payload = await prepareCuOptPayload(deliveries, constraints);
      console.log("Generated payload:", payload);

      // Validate and send
      validatePayload(payload);
      console.log("Payload validation passed");

      const result = await callCuOptAPI(payload);
      console.log("API response:", result);

      // Process results
      const processedRoutes = await processOptimizedRoutes(result);
      console.log("Processed routes:", processedRoutes);

      return processedRoutes;
    } catch (error) {
      console.error("Optimization error details:", error);
      handleOptimizationError(error);
    }
  };
  
  const handleOptimizationError = (error) => {
    console.error("Optimization error:", error);
    const errorMessage = error.message.includes("vehicle constraints") 
      ? "Please set up your vehicle constraints in the Profile page first."
      : handleCuOptError(error);
    
    setOptimizationStatus(`Optimization failed: ${errorMessage}`);
    Alert.alert(
      "Optimization Error",
      errorMessage,
      [
        { 
          text: "Go to Profile", 
          onPress: () => navigation.navigate('Profile')
        },
        {
          text: "Cancel",
          style: "cancel"
        }
      ]
    );
  };

  const fetchUserStartLocation = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    const userRef = ref(database, `users/${user.uid}`); // Use the initialized database
    return new Promise((resolve, reject) => {
      onValue(userRef, (snapshot) => {
        const data = snapshot.val();
        if (data && data.startLatitude && data.startLongitude) {
          resolve({
            latitude: data.startLatitude,
            longitude: data.startLongitude
          });
        } else {
          reject(new Error("Starting location not set in profile"));
        }
      }, {
        onlyOnce: true
      });
    });
  };

  const saveOptimizedRoutes = async (optimizedRoutes) => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    const optimizedRoutesRef = ref(database, `optimizedRoutes/${user.uid}`); // Use the initialized database
    try {
      await set(optimizedRoutesRef, {
        routes: optimizedRoutes.routes,
        timestamp: Date.now(),
        totalCost: optimizedRoutes.totalCost,
        vehiclesUsed: optimizedRoutes.vehiclesUsed
      });
    } catch (error) {
      console.error("Error saving optimized routes:", error);
      throw new Error("Failed to save optimized routes");
    }
  };

  const getVehicleConstraints = () => {
    const user = auth.currentUser;
    if (!user) return null;
    
    return {
      vehicleId: `veh-${user.uid}`,
      maxDrivingTime: parseFloat(maxDrivingTime) || 12,
      breakStartWindow: [parseFloat(breakStartMin) || 4, parseFloat(breakStartMax) || 6],
      breakDuration: parseFloat(breakDuration) || 0.5,
      vehicleTimeWindows: [
        parseFloat(workStartTime) || 8,
        parseFloat(workEndTime) || 20
      ],
      dimensions: {
        length: parseFloat(length) || 0,
        width: parseFloat(width) || 0,
        height: parseFloat(height) || 0
      }
    };
  };

  // Add a function to handle the optimize button press
  const handleOptimizePress = async () => {
    try {
      setOptimizing(true);
      setError(null);
      setOptimizationStatus("Starting optimization...");
      
      // Get constraints first
      const constraints = await fetchUserConstraints();
      console.log("Fetched constraints:", constraints);
      
      if (!constraints) {
        throw new Error("Failed to load vehicle constraints");
      }

      // Fetch deliveries
      const deliveries = await fetchDeliveries();
      console.log("Fetched deliveries:", deliveries);
      
      if (!deliveries || deliveries.length === 0) {
        throw new Error("No deliveries available to optimize");
      }

      // Prepare payload
      setOptimizationStatus("Preparing optimization request...");
      const payload = await prepareCuOptPayload(deliveries, constraints);
      console.log("Prepared payload:", JSON.stringify(payload, null, 2));

      // Validate payload
      validatePayload(payload);
      
      // Call API
      setOptimizationStatus("Calling optimization service...");
      const result = await callCuOptAPI(payload);
      console.log("API Response:", result);

      // Process results
      setOptimizationStatus("Processing optimization results...");
      const processedRoutes = await processOptimizedRoutes(result);
      
      // Save results
      await saveOptimizedRoutes(processedRoutes);
      
      setOptimizationStatus("Optimization completed!");
      navigation.navigate('SelectRoute', { optimizedRoutes: processedRoutes });

    } catch (error) {
      console.error("Optimization failed:", error);
      handleOptimizationError(error);
    } finally {
      setOptimizing(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Route Optimization</Text>
      
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
          <Button 
            title="Generate Optimized Routes" 
            onPress={handleOptimizePress}
            disabled={loading} 
          />
        </View>
      )}
    </View>
  );
};

const buildMatrices = (locations, constraints) => {
  const n = locations.length;
  const costMatrix = Array(n).fill().map(() => Array(n).fill(0));
  const timeMatrix = Array(n).fill().map(() => Array(n).fill(0));
  
  // Calculate costs and times between all location pairs
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        const distance = haversineDistance(locations[i], locations[j]);
        const averageSpeed = constraints.averageSpeed || 60; // km/h
        const timeHours = distance / averageSpeed;
        const fuelUsed = distance / constraints.fuelEfficiency;
        const fuelCost = fuelUsed * constraints.fuelCost;
        
        // Time in seconds
        timeMatrix[i][j] = Math.round(timeHours * 3600);
        
        // Cost includes fuel and time-based costs
        costMatrix[i][j] = Math.round(fuelCost + (timeHours * 50)); // €50/hour operating cost
      }
    }
  }
  
  return { costMatrix, timeMatrix };
};

const convertToMinutesSinceMidnight = (timestamp) => {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  return date.getHours() * 60 + date.getMinutes();
};

const validateDeliveryConstraints = (delivery, constraints) => {
  const errors = [];
  
  const volume = (delivery.height * delivery.width * delivery.length) / 1000000;
  
  if (delivery.weight > constraints.maxCargoWeight) {
    errors.push(`Delivery ${delivery.id} exceeds weight limit: ${delivery.weight}kg > ${constraints.maxCargoWeight}kg`);
  }
  
  if (volume > constraints.maxCargoVolume) {
    errors.push(`Delivery ${delivery.id} exceeds volume limit: ${volume}m³ > ${constraints.maxCargoVolume}m³`);
  }

  // Convert timestamps to minutes since midnight
  const startTimeMinutes = convertToMinutesSinceMidnight(delivery.earliestStartTime);
  const endTimeMinutes = convertToMinutesSinceMidnight(delivery.latestEndTime);
  
  if (startTimeMinutes && endTimeMinutes) {
    const timeWindowDuration = endTimeMinutes - startTimeMinutes;
    const maxDrivingTimeMinutes = constraints.maxDrivingTime * 60; // Convert hours to minutes
    
    if (timeWindowDuration > maxDrivingTimeMinutes) {
      // Adjust the time window to fit within maximum driving time
      console.warn(`Adjusting time window for delivery ${delivery.id} to fit within maximum driving time`);
    }
    
    if (startTimeMinutes >= endTimeMinutes) {
      errors.push(`Delivery ${delivery.id} has invalid time window: start time must be before end time`);
    }
  }

  return errors;
};

const validateOptimizationInput = (deliveries, constraints) => {
  const errors = [];

  // Validate start location
  if (!constraints.startLatitude || !constraints.startLongitude) {
    errors.push("Missing starting location coordinates");
  }

  // Validate vehicle constraints
  if (!constraints.maxCargoWeight || !constraints.maxCargoVolume) {
    errors.push("Missing vehicle capacity constraints");
  }

  // Validate deliveries
  deliveries.forEach(delivery => {
    const deliveryErrors = validateDeliveryConstraints(delivery, constraints);
    errors.push(...deliveryErrors);
  });

  return errors;
};

const calculateRouteProfit = (route, locations) => {
  let totalProfit = 0;
  let totalCosts = 0;

  // Calculate revenue from deliveries
  route.stops.forEach(stop => {
    const location = locations.find(loc => loc.id === parseInt(stop.taskId));
    if (location && location.payment) {
      totalProfit += location.payment;
    }
  });

  // Calculate fuel costs
  for (let i = 0; i < route.stops.length - 1; i++) {
    const currentStop = locations[route.stops[i].location];
    const nextStop = locations[route.stops[i + 1].location];
    const distance = haversineDistance(currentStop, nextStop);
    const fuelUsed = distance / vehicleConstraints.fuelEfficiency;
    totalCosts += fuelUsed * vehicleConstraints.fuelCost;
  }

  // Add driver costs (assuming hourly rate)
  const driverHourlyRate = 30; // €/hour
  const totalHours = route.totalTime / 3600;
  totalCosts += totalHours * driverHourlyRate;

  return totalProfit - totalCosts;
};

const saveOptimizedRoutes = async (optimizedRoutes) => {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const optimizedRoutesRef = ref(database, `optimizedRoutes/${user.uid}`); // Use the initialized database
  try {
    await set(optimizedRoutesRef, {
      routes: optimizedRoutes.routes,
      timestamp: Date.now(),
      totalCost: optimizedRoutes.totalCost,
      vehiclesUsed: optimizedRoutes.vehiclesUsed
    });
  } catch (error) {
    console.error("Error saving optimized routes:", error);
    throw new Error("Failed to save optimized routes");
  }
};

const getErrorMessage = (error) => {
  if (error.response) {
    if (error.response.data && error.response.data.detail) {
      return error.response.data.detail;
    }
    return `Server error: ${error.response.status}`;
  }
  if (error.message) {
    if (error.message.includes("maxCargoWeight")) {
      return "One or more deliveries exceed vehicle cargo weight capacity";
    }
    if (error.message.includes("maxCargoVolume")) {
      return "One or more deliveries exceed vehicle cargo volume capacity";
    }
    return error.message;
  }
  return "An unknown error occurred";
};

const fetchUserStartLocation = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");


  const userRef = ref(database, `users/${user.uid}`);
  return new Promise((resolve, reject) => {
    onValue(userRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.startLatitude && data.startLongitude) {
        resolve({
          latitude: data.startLatitude,
          longitude: data.startLongitude
        });
      } else {
        reject(new Error("Starting location not set in profile"));
      }
    }, {
      onlyOnce: true
    });
  });
};

const handleCuOptError = (error) => {
  if (error.response) {
    if (error.response.status === 401) {
      return "Invalid API key or unauthorized access";
    }
    if (error.response.status === 422) {
      return "Invalid input data format";
    }
    if (error.response.status === 500) {
      return "NVIDIA cuOpt service error";
    }
    return `API Error: ${error.response.status}`;
  }
  return error.message;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center", // Center vertically
    alignItems: "center", // Center horizontally
    padding: 20,
    backgroundColor: "#f9f9f9",
  },
  statusText: {
    marginTop: 20,
    fontSize: 18,
    textAlign: "center",
    color: "#333",  
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  statusText: {
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 20,
    color: '#333',
  },
});

export default OptimizeRoutesScreen;