// components/OptimizeRoutesScreen.js

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { getDatabase, ref, onValue, set, off } from "firebase/database";
import { auth, GEOCODE_MAPS_APIKEY, NVIDIA_API_KEY } from "../firebaseConfig";
import { useIsFocused } from "@react-navigation/native";

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
  const [loading, setLoading] = useState(true);
  const [optimizationStatus, setOptimizationStatus] = useState("Optimizing routes...");
  const database = getDatabase();  // Initialize database here
  const isFocused = useIsFocused();

  // Define the Corrected API Endpoint
  const invokeUrl = "https://optimize.api.nvidia.com/v1/nvidia/cuOpt"; // Corrected Endpoint
  const fetchUrlFormat = "https://optimize.api.nvidia.com/v1/status/";

  useEffect(() => {
    if (isFocused) {
      optimizeRoutes();
    }

    // Cleanup function to remove listeners if any are set globally
    return () => {
      // It's a good practice to ensure no lingering listeners
      // However, in this implementation, listeners are handled within helper functions
    };
  }, [isFocused]);

  // Helper Functions

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
      if (user) {
        const userRef = ref(database, `users/${user.uid}`);
        const onValueChange = onValue(
          userRef,
          (snapshot) => {
            const data = snapshot.val();
            if (data) {
              // Ensure preferredCountries is an array
              if (
                data.preferredCountries &&
                typeof data.preferredCountries === "string"
              ) {
                data.preferredCountries = data.preferredCountries
                  .split(",")
                  .map((c) => c.trim());
              }
              resolve(data);
            } else {
              resolve({});
            }
          },
          (error) => {
            console.error("Error fetching user constraints:", error);
            reject(error);
          }
        );

        // Optional: To remove listener after fetching
        // off(userRef, 'value', onValueChange);
      } else {
        reject("User not authenticated");
      }
    });
  };

  // Prepare the payload for NVIDIA cuOpt API
  const prepareCuOptPayload = async (deliveries, constraints) => {
    // 1. Basic Setup and Validation
    const startLatitude = constraints.startLatitude || constraints.currentLatitude;
    const startLongitude = constraints.startLongitude || constraints.currentLongitude;
    
    if (!startLatitude || !startLongitude) {
      throw new Error("Starting location is required");
    }
  
    // 2. Vehicle Constraints from Profile
    const vehicleConstraints = {
      maxCargoWeight: parseFloat(constraints.maxCargoWeight) || 5000, // kg
      maxCargoVolume: parseFloat(constraints.maxCargoVolume) || 60, // m³
      maxDrivingTime: parseFloat(constraints.maxDrivingTime) || 15, // hours
      breakDuration: parseFloat(constraints.breakDuration) || 1, // hours
      breakStartWindow: constraints.breakStartWindow || [6, 8], // hours into shift
      fuelEfficiency: parseFloat(constraints.fuelEfficiency) || 3, // km/L
      fuelCost: 2.0, // USD/L (can be made configurable)
      startTime: 8 * 3600, // 8 AM in seconds
      vehicleId: "veh-1"
    };
  
    // 3. Location Processing - Start with depot
    const locations = [{
      id: 0,
      type: 'depot',
      latitude: startLatitude,
      longitude: startLongitude
    }];
  
    // Process deliveries into pickup/delivery pairs with proper indexing
    deliveries.forEach((delivery) => {
      if (!delivery.pickupLocation || !delivery.deliveryLocation) return;
      
      // Calculate volume in m³
      const volume = (delivery.height * delivery.width * delivery.length) / 1000000;
      
      if (delivery.weight > vehicleConstraints.maxCargoWeight || 
          volume > vehicleConstraints.maxCargoVolume) {
        return;
      }
  
      // Add pickup location
      const pickupIndex = locations.length;
      locations.push({
        id: pickupIndex,
        type: 'pickup',
        latitude: delivery.pickupLocation.latitude,
        longitude: delivery.pickupLocation.longitude,
        serviceTime: delivery.serviceTime || 1800,
        timeWindow: [
          convertToMinutesSinceMidnight(delivery.earliestStartTime) || 0,
          convertToMinutesSinceMidnight(delivery.latestEndTime) || 1440
        ],
        weight: delivery.weight,
        volume: volume,
        payment: delivery.payment
      });
  
      // Add delivery location
      const deliveryIndex = locations.length;
      locations.push({
        id: deliveryIndex,
        type: 'delivery',
        latitude: delivery.deliveryLocation.latitude,
        longitude: delivery.deliveryLocation.longitude,
        serviceTime: delivery.serviceTime || 1800,
        timeWindow: [
          convertToMinutesSinceMidnight(delivery.earliestStartTime) + 30,
          convertToMinutesSinceMidnight(delivery.latestEndTime) + 30
        ],
        weight: delivery.weight,
        volume: volume,
        payment: delivery.payment
      });
    });
  
    // Build matrices
    const { costMatrix, timeMatrix } = buildMatrices(locations, vehicleConstraints);
  
    // Generate pickup-delivery pairs with correct indices
    const pairs = [];
    for (let i = 1; i < locations.length; i += 2) {
      pairs.push([i, i + 1]); // Pickup followed by delivery
    }
  
    return {
      action: "cuOpt_OptimizedRouting",
      data: {
        cost_matrix_data: {
          data: { "1": costMatrix }
        },
        travel_time_matrix_data: {
          data: { "1": timeMatrix }
        },
        fleet_data: {
          vehicle_locations: [[0, 0]], // Start and end at depot
          vehicle_ids: [vehicleConstraints.vehicleId],
          capacities: [
            [vehicleConstraints.maxCargoWeight],
            [vehicleConstraints.maxCargoVolume]
          ],
          vehicle_time_windows: [[
            480, // 8 AM in minutes
            480 + (vehicleConstraints.maxDrivingTime * 60)
          ]],
          vehicle_break_time_windows: [[
            [vehicleConstraints.breakStartWindow[0] * 60,
             vehicleConstraints.breakStartWindow[1] * 60]
          ]],
          vehicle_break_durations: [[vehicleConstraints.breakDuration * 60]]
        },
        task_data: {
          task_locations: locations.map(loc => loc.id),
          task_ids: locations.map(loc => loc.id.toString()),
          demand: [
            locations.map(loc => loc.type === 'pickup' ? loc.weight : 0),
            locations.map(loc => loc.type === 'pickup' ? loc.volume : 0)
          ],
          service_times: locations.map(loc => loc.serviceTime || 0),
          task_time_windows: locations.map(loc => loc.timeWindow || [0, vehicleConstraints.maxDrivingTime * 60]),
          prizes: locations.map(loc => loc.type === 'delivery' ? loc.payment : 0),
          pickup_and_delivery_pairs: pairs
        },
        solver_config: {
          objectives: {
            cost: 1,
            travel_time: 0.5,
            prize: 2
          },
          verbose_mode: true,
          error_logging: true
        }
      }
    };
  };

  // Payload validation function
  const validatePayload = (payload) => {
    const { fleet_data, task_data } = payload.data;

    // Validate vehicle capacities
    fleet_data.capacities.forEach((capacityArray, dimensionIndex) => {
      capacityArray.forEach((capacity) => {
        if (typeof capacity !== "number" || capacity <= 0) {
          throw new Error(
            `Vehicle capacities must be positive numbers. Invalid value: ${capacity}`
          );
        }
      });
    });

    // Validate demands
    task_data.demand.forEach((demandArray, dimensionIndex) => {
      demandArray.forEach((demand) => {
        if (typeof demand !== "number") {
          throw new Error(
            `Demands must be numbers. Invalid demand: ${demand}`
          );
        }
      });
    });

    // Validate time windows
    task_data.task_time_windows.forEach((window, index) => {
      if (window[0] >= window[1]) {
        throw new Error(
          `Task time window start time must be less than end time. Invalid window at index ${index}: [${window[0]}, ${window[1]}]`
        );
      }
    });

    fleet_data.vehicle_time_windows.forEach((window, index) => {
      if (window[0] >= window[1]) {
        throw new Error(
          `Vehicle time window start time must be less than end time. Invalid window at index ${index}: [${window[0]}, ${window[1]}]`
        );
      }
    });

    // Validate that demands do not exceed capacities
    const totalDemandWeight = task_data.demand[0].reduce(
      (sum, val) => sum + val,
      0
    );
    const totalDemandVolume = task_data.demand[1].reduce(
      (sum, val) => sum + val,
      0
    );

    if (totalDemandWeight > fleet_data.capacities[0][0]) {
      throw new Error("Total demand weight exceeds vehicle capacity.");
    }
    if (totalDemandVolume > fleet_data.capacities[1][0]) {
      throw new Error("Total demand volume exceeds vehicle capacity.");
    }

    // Additional validations can be added as needed
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
    try {
      setLoading(true);
      setOptimizationStatus("Fetching deliveries...");
  
      // Get user location first
      const startLocation = await fetchUserStartLocation();
      
      // Fetch deliveries
      const deliveries = await fetchDeliveries();
      if (deliveries.length === 0) {
        throw new Error("No deliveries available for optimization");
      }
  
      // Get user constraints
      setOptimizationStatus("Loading constraints...");
      const constraints = await fetchUserConstraints();
      
      // Add start location to constraints
      constraints.startLatitude = startLocation.latitude;
      constraints.startLongitude = startLocation.longitude;
  
      // Validate input data
      const validationErrors = validateOptimizationInput(deliveries, constraints);
      if (validationErrors.length > 0) {
        throw new Error(`Validation failed:\n${validationErrors.join('\n')}`);
      }
  
      setOptimizationStatus("Preparing optimization request...");
      const payload = await prepareCuOptPayload(deliveries, constraints);
  
      // Validate payload before sending
      validatePayload(payload);
  
      setOptimizationStatus("Calling optimization service...");
      const result = await callCuOptAPI(payload);
  
      setOptimizationStatus("Processing results...");
      const processedRoutes = await processOptimizedRoutes(result);
  
      // Save to Firebase
      await saveOptimizedRoutes(processedRoutes);
  
      setOptimizationStatus("Optimization completed successfully!");
      navigation.navigate('Routes', { optimizedRoutes: processedRoutes });
      return processedRoutes;
  
    } catch (error) {
      handleOptimizationError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };
  
  const handleOptimizationError = (error) => {
    console.error("Optimization error:", error);
    const errorMessage = handleCuOptError(error);
    setOptimizationStatus(`Optimization failed: ${errorMessage}`);
    Alert.alert(
      "Optimization Error",
      errorMessage,
      [{ text: "OK", onPress: () => navigation.goBack() }]
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

  return (
    <View style={styles.container}>
      {loading ? (
        <>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text style={styles.statusText}>{optimizationStatus}</Text>
        </>
      ) : (
        <Text style={styles.statusText}>{optimizationStatus}</Text>
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

const generatePickupDeliveryPairs = (locations) => {
  const pairs = [];
  let pickupIndex = -1;
  
  locations.forEach((loc, index) => {
    if (loc.type === 'pickup') {
      pickupIndex = index;
    } else if (loc.type === 'delivery' && pickupIndex !== -1) {
      pairs.push([pickupIndex, index]);
      pickupIndex = -1;
    }
  });
  
  return pairs;
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
});

export default OptimizeRoutesScreen;
