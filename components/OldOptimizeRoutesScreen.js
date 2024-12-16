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

// Add this near the top of the file
const POLL_INTERVAL_MS = 5000;

async function pollStatus(requestId) {
  const statusUrl = `https://optimize.api.nvidia.com/v1/status/${requestId}`;
  console.log(`Starting status polling for requestId: ${requestId}`);

  return new Promise((resolve, reject) => {
    const pollInterval = setInterval(async () => {
      console.log(`Polling status for requestId: ${requestId}...`);
      try {
        const response = await fetch(statusUrl, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${NVIDIA_API_KEY}`,
            "Accept": "application/json"
          }
        });

        // If still 202, continue polling
        if (response.status === 202) {
          console.log("Solution still pending...");
          return;
        }

        // Stop polling now that we have a different status
        clearInterval(pollInterval);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Status polling failed: ${response.status} ${errorText}`);
          reject(new Error(`Status polling failed: ${errorText}`));
          return;
        }

        const result = await response.json();
        console.log("Status polling returned final result:", result);
        resolve(result);

      } catch (err) {
        clearInterval(pollInterval);
        reject(err);
      }
    }, POLL_INTERVAL_MS);
  });
}

// Updated callCuOptAPI function
// callCuOptAPI with extra logging
const callCuOptAPI = async (payload) => {
  const baseUrl = "https://optimize.api.nvidia.com/v1/nvidia/cuopt";
  const headers = {
    "Authorization": `Bearer ${NVIDIA_API_KEY}`,
    "Content-Type": "application/json",
    "Accept": "application/json"
  };

  console.log("Sending request to cuOpt API with URL:", baseUrl);
  console.log("Using API Key:", NVIDIA_API_KEY ? "Provided" : "Not Provided");
  console.log("Payload:", payload);

  try {
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload)
    });

    console.log("Fetch completed, response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Response not ok:", errorText);
      throw new Error(`API request failed with status ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log("API call completed successfully:", result);
    return result;

  } catch (error) {
    console.error("API Call Error (Network or otherwise):", error.message);
    console.error(error);
    throw error;
  }
};

// In optimizeRoutes, add more logs
// Also add logs to optimizeRoutes if you're calling it directly
const optimizeRoutes = async () => {
  if (!user) {
    throw new Error("User must be authenticated");
  }

  try {
    setLoading(true);
    console.log("Starting optimization process...");

    const constraints = await fetchUserConstraints();
    console.log("Fetched constraints:", constraints);

    const deliveries = await fetchDeliveries();
    console.log("Fetched deliveries:", deliveries);

    const payload = await prepareCuOptPayload(deliveries, constraints);
    console.log("Generated payload:", payload);

    validatePayload(payload);
    console.log("Payload validation passed");

    console.log("Calling cuOpt API with prepared payload...");
    const result = await callCuOptAPI(payload);
    console.log("API response:", result);

    const processedRoutes = await processOptimizedRoutes(result);
    console.log("Processed routes:", processedRoutes);

    return processedRoutes;
  } catch (error) {
    console.error("Optimization error details:", error.message);
    handleOptimizationError(error);
  }
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

  // Updated prepareCuOptPayload function
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

  // locations = depot + each pickup + each delivery
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

  // Build cost and time matrices
  const { costMatrix, timeMatrix } = buildMatrices(locations, constraints);

  const deliveryCount = deliveries.length;
  const taskCount = deliveryCount * 2; // 2 tasks per delivery

  // Tasks are only pickups and deliveries, no depot
  // Task indices: 0-based
  // For delivery i:
  // pickup task = i*2, delivery task = i*2+1
  // location indices for pickup: 1 + i*2
  // location indices for delivery: 2 + i*2

  const taskLocations = Array.from({ length: taskCount }, (_, i) => i + 1);
  // i-th task corresponds to locations[i+1], since 0 is depot

  const taskIds = deliveries.flatMap((delivery) => [
    `pickup-${delivery.id}`,
    `delivery-${delivery.id}`,
  ]);

  // Initialize arrays
  const demands = new Array(taskCount).fill(0);
  const pickupDeliveryPairs = [];
  const taskTimeWindows = [];
  const serviceTimes = [];

  // Populate task data for each delivery
  deliveries.forEach((delivery, i) => {
    const pickupTaskIndex = i * 2;
    const deliveryTaskIndex = i * 2 + 1;

    // Add pickup and delivery pair
    pickupDeliveryPairs.push([pickupTaskIndex, deliveryTaskIndex]);

    // Demands
    const w = Number(delivery.weight) || 0;
    demands[pickupTaskIndex] = w;
    demands[deliveryTaskIndex] = -w;

    // Time windows for pickup and delivery
    const startTime = convertToMinutesSinceMidnight(delivery.earliestStartTime) || 0;
    const endTime = convertToMinutesSinceMidnight(delivery.latestEndTime) || 1440;
    taskTimeWindows.push([startTime, endTime], [startTime, endTime]);

    // Service times
    const st = Number(delivery.serviceTime) || 600;
    serviceTimes.push(st, st);
  });

  console.log("Task Locations:", taskLocations);
  console.log("Pickup and Delivery Pairs:", pickupDeliveryPairs);
  console.log("Task IDs:", taskIds);
  console.log("Demands:", demands);
  console.log("Task Time Windows:", taskTimeWindows);
  console.log("Service Times:", serviceTimes);

  // Validate pairs: should use all tasks
  // We have 2 tasks per delivery, all should be referenced once
  if (new Set(pickupDeliveryPairs.flat()).size !== taskCount) {
    throw new Error("Mismatch between tasks and pickup/delivery pairs.");
  }

  return {
    action: "cuOpt_OptimizedRouting",
    data: {
      cost_matrix_data: {
        data: {
          "1": costMatrix
        }
      },
      travel_time_matrix_data: {
        data: {
          "1": timeMatrix
        }
      },
      fleet_data: {
        // Depot is referenced in cost/time matrices at index 0
        // The vehicles start and end at depot index 0
        vehicle_locations: [[0, 0]],
        vehicle_ids: [`veh-${user.uid}`],
        capacities: [[Number(constraints.maxCargoWeight) || 5000]],
        vehicle_time_windows: [
          [
            Number(constraints.workStartTime) * 60 || 480,
            Number(constraints.workEndTime) * 60 || 1200,
          ]
        ],
        vehicle_break_time_windows: [
          [
            [
              Number(constraints.breakStartMin) * 60 || 720,
              Number(constraints.breakStartMax) * 60 || 780,
            ]
          ]
        ],
        vehicle_break_durations: [
          [Number(constraints.breakDuration) * 60 || 30]
        ],
        min_vehicles: 1,
        vehicle_types: [1],
        vehicle_max_times: [Number(constraints.maxDrivingTime) * 60 || 720],
        vehicle_max_costs: [9999],
        skip_first_trips: [false],
        drop_return_trips: [false]
      },
      task_data: {
        // Only tasks (no depot)
        task_locations: taskLocations,
        task_ids: taskIds,
        demand: [demands], // 2D array
        pickup_and_delivery_pairs: pickupDeliveryPairs,
        task_time_windows: taskTimeWindows,
        service_times: serviceTimes
      },
      solver_config: {
        time_limit: 600
      }
    }
  };
};

// Updated validatePayload function
const validatePayload = (payload) => {
  const data = payload?.data;
  if (!data) {
    throw new Error("Missing data object");
  }

  if (!data.fleet_data || !data.task_data) {
    throw new Error("Invalid payload structure: missing fleet_data or task_data");
  }

  if (!data.cost_matrix_data?.data) {
    throw new Error("Missing cost matrix data");
  }

  const { fleet_data, task_data } = data;

  // Check task_data arrays
  if (
    !Array.isArray(task_data.task_locations) ||
    !Array.isArray(task_data.task_ids) ||
    !Array.isArray(task_data.demand) ||
    !Array.isArray(task_data.task_time_windows) ||
    !Array.isArray(task_data.service_times)
  ) {
    throw new Error("Task data arrays are missing or not in the correct format");
  }

  // Check demands length matches task_ids length
  if (task_data.demand[0].length !== task_data.task_ids.length) {
    throw new Error("Demands array length does not match the number of tasks");
  }

  // Check pickup_and_delivery_pairs
  if (Array.isArray(task_data.pickup_and_delivery_pairs)) {
    task_data.pickup_and_delivery_pairs.forEach(pair => {
      if (
        pair.length !== 2 ||
        pair[0] < 0 || pair[0] >= task_data.task_locations.length ||
        pair[1] < 0 || pair[1] >= task_data.task_locations.length
      ) {
        throw new Error("Invalid pickup_and_delivery_pair found");
      }
    });
  } else if (task_data.pickup_and_delivery_pairs !== null && task_data.pickup_and_delivery_pairs !== undefined) {
    throw new Error("pickup_and_delivery_pairs must be an array or null");
  }

  // Check fleet_data
  if (!Array.isArray(fleet_data.vehicle_locations) || fleet_data.vehicle_locations.length === 0) {
    throw new Error("No vehicle locations provided");
  }

  console.log("Payload validation passed");
};


  // Call NVIDIA cuOpt API
  async function callCuOptAPI(payload) {
    const baseUrl = "https://optimize.api.nvidia.com/v1/nvidia/cuopt";
    const headers = {
      "Authorization": `Bearer ${NVIDIA_API_KEY}`,
      "Content-Type": "application/json",
      "Accept": "application/json"
    };
  
    console.log("Sending request to cuOpt API...");
  
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload)
    });
  
    console.log("Fetch completed, response status:", response.status);
  
    if (response.status === 202) {
      // Accepted but not done, poll for results
      const requestId = response.headers.get("NVCF-REQID");
      if (!requestId) {
        throw new Error("202 Accepted but no requestId provided in headers for polling.");
      }
      return await pollStatus(requestId);
    }
  
    const responseText = await response.text();
    if (!response.ok) {
      console.error("Response not ok:", response.status, responseText);
      if (response.status === 403) {
        // Forbidden: likely invalid API key or insufficient permissions
        throw new Error(`API request failed with status 403: Access denied. Check your NVIDIA_API_KEY and permissions. Detail: ${responseText}`);
      }
      throw new Error(`API request failed with status ${response.status}: ${responseText}`);
    }
  
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (jsonError) {
      console.error("JSON parse error:", jsonError.message);
      console.error("Response text was not valid JSON:", responseText);
      throw new Error("Failed to parse JSON response from server");
    }
  
    console.log("API call completed successfully:", result);
    return result;
  }
  

  // Parse the optimized route from API response
  const processOptimizedRoutes = async (responseBody) => {
    const resp = responseBody?.response;
  
    if (resp?.solver_response) {
      // Feasible solution found
      const { vehicle_data, solution_cost, num_vehicles } = resp.solver_response;
      const optimizedRoutes = [];
  
      // Note: If you need access to 'locations' here for profit calculation,
      // you must ensure 'locations' is accessible in this scope or remove profit calc.
      // For now, skip coordinates-based profit calculation or define 'locations' globally.
      // Just comment out or simplify profit calculation if 'locations' not available.
      
      Object.entries(vehicle_data).forEach(([vehicleId, data]) => {
        const route = {
          vehicleId,
          stops: [],
          totalCost: solution_cost,
          totalTime: 0,
          profit: 0
        };
  
        data.task_id.forEach((taskId, index) => {
          if (data.type[index] === "Delivery" || data.type[index] === "Pickup") {
            route.stops.push({
              taskId,
              type: data.type[index],
              arrivalTime: data.arrival_stamp[index],
              location: data.route[index],
              // coordinates: {
              //   latitude: locations[data.route[index]].latitude,
              //   longitude: locations[data.route[index]].longitude
              // }
            });
          }
        });
  
        route.totalTime = data.arrival_stamp[data.arrival_stamp.length - 1];
        // route.profit = calculateRouteProfit(route, locations); 
        route.profit = 0; // Without location details or define logic if needed
  
        optimizedRoutes.push(route);
      });
  
      return {
        routes: optimizedRoutes,
        totalCost: solution_cost,
        vehiclesUsed: num_vehicles
      };
    } else if (resp?.solver_infeasible_response) {
      // Infeasible solution (status=1)
      console.warn("No feasible solution found. The solver_infeasible_response provides the closest infeasible solution.");
      return {
        routes: [],
        totalCost: resp.solver_infeasible_response.solution_cost,
        vehiclesUsed: resp.solver_infeasible_response.num_vehicles,
        infeasible: true,
        message: "No feasible solution found"
      };
    }
  
    throw new Error("Invalid API response format");
  };
  

  const optimizeRoutes = async () => {
    if (!user) {
      throw new Error("User must be authenticated");
    }
  
    try {
      setLoading(true);
      console.log("Starting optimization process...");
  
      const constraints = await fetchUserConstraints();
      console.log("Fetched constraints:", constraints);
  
      const deliveries = await fetchDeliveries();
      console.log("Fetched deliveries:", deliveries);
  
      const payload = await prepareCuOptPayload(deliveries, constraints);
      console.log("Generated payload:", payload);
  
      validatePayload(payload);
      console.log("Payload validation passed");
  
      const result = await callCuOptAPI(payload);
      console.log("API response:", result);
  
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

    const constraints = await fetchUserConstraints();
    console.log("Fetched constraints:", constraints);

    if (!constraints) {
      throw new Error("Failed to load vehicle constraints");
    }

    const deliveries = await fetchDeliveries();
    console.log("Fetched deliveries:", deliveries);

    if (!deliveries || deliveries.length === 0) {
      throw new Error("No deliveries available to optimize");
    }

    setOptimizationStatus("Preparing optimization request...");
    const payload = await prepareCuOptPayload(deliveries, constraints);
    console.log("Prepared payload:", JSON.stringify(payload, null, 2));

    validatePayload(payload);
    console.log("Payload validation passed");

    if (!NVIDIA_API_KEY) {
      throw new Error("NVIDIA_API_KEY not set or invalid");
    }

    setOptimizationStatus("Calling optimization service...");
    console.log("Attempting to call API now...");

    const result = await callCuOptAPI(payload);
    console.log("API Response:", result);

    setOptimizationStatus("Processing optimization results...");
    const processedRoutes = await processOptimizedRoutes(result);

    await saveOptimizedRoutes(processedRoutes);

    setOptimizationStatus("Optimization completed!");
    navigation.navigate('SelectRoute', { optimizedRoutes: processedRoutes });

  } catch (error) {
    console.error("Optimization failed:", error.message);
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