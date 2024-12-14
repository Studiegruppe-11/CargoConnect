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
      throw new Error("User must be authenticated");
    }
  
    // Depot location
    const depotLocation = {
      latitude: Number(constraints.startLatitude),
      longitude: Number(constraints.startLongitude),
      type: "depot",
    };
  
    // Locations: depot + pickup + delivery
    const locations = [
      depotLocation,
      ...deliveries.flatMap((delivery) => [
        {
          latitude: Number(delivery.pickupLocation.latitude),
          longitude: Number(delivery.pickupLocation.longitude),
          type: "pickup",
        },
        {
          latitude: Number(delivery.deliveryLocation.latitude),
          longitude: Number(delivery.deliveryLocation.longitude),
          type: "delivery",
        },
      ]),
    ];
  
    // Cost and time matrices
    const { costMatrix, timeMatrix } = buildMatrices(locations, constraints);
  
    // Task data arrays
    const taskLocations = locations.map((_, index) => index);
    const taskIds = [
      "depot",
      ...deliveries.flatMap((delivery) => [
        `pickup-${delivery.id}`,
        `delivery-${delivery.id}`,
      ]),
    ];
    const demands = new Array(taskLocations.length).fill(0);
    const pickupDeliveryPairs = [];
    const taskTimeWindows = [[0, 1440]]; // Depot always available
    const serviceTimes = [0]; // Depot has no service time
  
    // Populate task data for each delivery
    deliveries.forEach((delivery, index) => {
      const pickupIndex = 1 + index * 2;
      const deliveryIndex = pickupIndex + 1;
  
      // Add pickup and delivery pair
      pickupDeliveryPairs.push([pickupIndex, deliveryIndex]);
  
      // Set demands
      demands[pickupIndex] = Number(delivery.weight) || 0;
      demands[deliveryIndex] = -(Number(delivery.weight) || 0);
  
      // Time windows for pickup and delivery
      const startTime = convertToMinutesSinceMidnight(
        delivery.earliestStartTime
      );
      const endTime = convertToMinutesSinceMidnight(delivery.latestEndTime);
      taskTimeWindows.push(
        [startTime || 0, endTime || 1440],
        [startTime || 0, endTime || 1440]
      );
  
      // Service times
      const serviceTime = Number(delivery.serviceTime) || 600;
      serviceTimes.push(serviceTime, serviceTime);
    });
  
    // **Move logs here to ensure pickupDeliveryPairs is populated before debugging**
    console.log("Task Locations:", taskLocations);
    console.log("Pickup and Delivery Pairs:", pickupDeliveryPairs);
    console.log("Task IDs:", taskIds);
    console.log("Demands:", demands);
    console.log("Task Time Windows:", taskTimeWindows);
    console.log("Service Times:", serviceTimes);
  
    // Ensure all indices are used
    if (
      new Set(pickupDeliveryPairs.flat()).size !==
      taskLocations.length - 1 // Exclude depot (index 0)
    ) {
      throw new Error(
        "Mismatch between task locations and pickup/delivery pairs."
      );
    }
  
    return {
      action: "cuOpt_OptimizedRouting",
      data: {
        cost_matrix_data: {
          data: {
            "1": costMatrix,
          },
        },
        travel_time_matrix_data: {
          data: {
            "1": timeMatrix,
          },
        },
        fleet_data: {
          vehicle_locations: [[0, 0]], // Start and end at depot
          vehicle_ids: [`veh-${user.uid}`],
          capacities: [[Number(constraints.maxCargoWeight) || 5000]],
          vehicle_time_windows: [
            [
              Number(constraints.workStartTime) * 60 || 480,
              Number(constraints.workEndTime) * 60 || 1200,
            ],
          ],
          vehicle_break_time_windows: [
            [
              [
                Number(constraints.breakStartMin) * 60 || 720,
                Number(constraints.breakStartMax) * 60 || 780,
              ],
            ],
          ],
          vehicle_break_durations: [
            [Number(constraints.breakDuration) * 60 || 30],
          ],
          min_vehicles: 1,
          vehicle_types: [1],
          vehicle_max_times: [Number(constraints.maxDrivingTime) * 60 || 720],
          vehicle_max_costs: [9999],
          skip_first_trips: [false],
          drop_return_trips: [false],
        },
        task_data: {
          task_locations: taskLocations,
          task_ids: taskIds,
          demand: [demands],
          pickup_and_delivery_pairs: pickupDeliveryPairs,
          task_time_windows: taskTimeWindows,
          service_times: serviceTimes,
        },
        solver_config: {
          time_limit: 300,
          objectives: {
            cost: 1,
            travel_time: 1,
          },
          verbose_mode: true,
          error_logging: true,
        },
      },
    };
  };
  
  
  

  // Payload validation function
  const validatePayload = (payload) => {
    if (!payload?.data?.fleet_data || !payload?.data?.task_data) {
      throw new Error("Invalid payload structure: missing fleet_data or task_data");
    }

    if (!payload?.data?.cost_matrix_data?.data) {
      throw new Error("Missing cost matrix data");
    }

    const { fleet_data, task_data } = payload.data;

    // Rest of validation stays the same...
  };

  // Call NVIDIA cuOpt API
  const callCuOptAPI = async (payload) => {
    const baseUrl = "https://optimize.api.nvidia.com/v1/nvidia/cuopt";
    const headers = {
      "Authorization": `Bearer ${NVIDIA_API_KEY}`,
      "Content-Type": "application/json",
      "Accept": "application/json"
    };
  
    try {
      const response = await fetch(baseUrl, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(payload)
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed with status ${response.status}: ${errorText}`);
      }
  
      return await response.json();
    } catch (error) {
      console.error("API Call Error:", error);
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

  useEffect(() => {
    if (isFocused && user) {
      optimizeRoutes();
    }
  }, [isFocused, user]);

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