// components/OptimizeRoutesScreen.js

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Alert, Button } from "react-native";
import { getDatabase, ref, onValue, set } from "firebase/database";
import { auth, NVIDIA_API_KEY } from "../firebaseConfig";
import { useIsFocused } from "@react-navigation/native";
import { onAuthStateChanged } from 'firebase/auth';
import { getDistanceMatrix } from '../utils/distanceMatrix';

// -------------------------------------
// Utility Functions
// -------------------------------------
const convertToMinutesSinceMidnight = (timestamp) => {
  if (!timestamp) return null;
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return null; 
    return date.getHours() * 60 + date.getMinutes();
  } catch {
    return null;
  }
};

const haversineDistance = (locA, locB) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(locB.latitude - locA.latitude);
  const dLon = toRad(locB.longitude - locA.longitude);
  const lat1 = toRad(locA.latitude);
  const lat2 = toRad(locB.latitude);
  const a = Math.sin(dLat/2)*Math.sin(dLat/2) +
            Math.sin(dLon/2)*Math.sin(dLon/2)*Math.cos(lat1)*Math.cos(lat2);
  const c = 2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R*c; 
};

const POLL_INTERVAL_MS = 10000; // Changed to 10 seconds

async function pollStatus(requestId) {
  const statusUrl = `https://optimize.api.nvidia.com/v1/status/${requestId}`;
  console.log(`Starting status polling for requestId: ${requestId}`);

  return new Promise((resolve, reject) => {
    const pollInterval = setInterval(async () => {
      try {
        console.log(`Checking optimization status... (${new Date().toLocaleTimeString()})`);
        
        const response = await fetch(statusUrl, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${NVIDIA_API_KEY}`,
            "Accept": "application/json"
          }
        });

        if (response.status === 202) {
          console.log("Status: PENDING - Still optimizing routes...");
          return;
        }

        clearInterval(pollInterval);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Status: FAILED - ${response.status} ${errorText}`);
          reject(new Error(`Status polling failed: ${errorText}`));
          return;
        }

        const result = await response.json();
        console.log("Status: COMPLETE - Optimization finished!");
        console.log("Solution details:", JSON.stringify(result?.response?.solver_response || {}, null, 2));
        resolve(result);

      } catch (err) {
        console.error("Status: ERROR -", err.message);
        clearInterval(pollInterval);
        reject(err);
      }
    }, POLL_INTERVAL_MS);
  });
}

const callCuOptAPI = async (payload) => {
  const baseUrl = "https://optimize.api.nvidia.com/v1/nvidia/cuopt";
  const headers = {
    "Authorization": `Bearer ${NVIDIA_API_KEY}`,
    "Content-Type": "application/json",
    "Accept": "application/json"
  };

  console.log("Sending request to cuOpt API with URL:", baseUrl);
  console.log("Using API Key:", NVIDIA_API_KEY ? "Provided" : "Not Provided");
  // console.log("Payload:", JSON.stringify(payload, null, 2));

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(payload)
  });

  console.log("Fetch completed, response status:", response.status);

  if (response.status === 202) {
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
      throw new Error(`API request failed with status 403: Access denied. Detail: ${responseText}`);
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
};

function handleCuOptError(error) {
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
}

// -------------------------------------
// Known working example payload from the node.js snippet (for testing):
// If you want to start testing from a known good payload, uncomment the following code block 
// and comment out your prepareCuOptPayload call. Then see if a solution is returned.
//
// After confirming it works, you can gradually replace parts of this static payload with dynamic 
// data from your database until you find what breaks the solver.
//

// const knownWorkingPayload = {
//   "action": "cuOpt_OptimizedRouting",
//   "data": {
//     "cost_waypoint_graph_data": null,
//     "travel_time_waypoint_graph_data": null,
//     "cost_matrix_data": {
//       "data": {
//         "1": [
//           [0,1,1],
//           [1,0,1],
//           [1,1,0]
//         ],
//         "2": [
//           [0,1,1],
//           [1,0,1],
//           [1,2,0]
//         ]
//       }
//     },
//     "travel_time_matrix_data": {
//       "data": {
//         "1": [
//           [0,1,1],
//           [1,0,1],
//           [1,1,0]
//         ],
//         "2": [
//           [0,1,1],
//           [1,0,1],
//           [1,2,0]
//         ]
//       }
//     },
//     "fleet_data": {
//       "vehicle_locations": [[0,0],[0,0]],
//       "vehicle_ids": ["veh-1","veh-2"],
//       "capacities": [[2,2],[4,1]],
//       "vehicle_time_windows": [[0,10],[0,10]],
//       "vehicle_break_time_windows": [[[1,2],[2,3]]],
//       "vehicle_break_durations": [[1,1]],
//       "vehicle_break_locations": [0,1],
//       "vehicle_types": [1,2],
//       "vehicle_order_match": [
//         {"order_ids":[0],"vehicle_id":0},
//         {"order_ids":[1],"vehicle_id":1}
//       ],
//       "skip_first_trips": [true,false],
//       "drop_return_trips": [true,false],
//       "min_vehicles": 2,
//       "vehicle_max_costs": [7,10],
//       "vehicle_max_times": [7,10]
//     },
//     "task_data": {
//       "task_locations": [1,2],
//       "task_ids": ["Task-A","Task-B"],
//       "demand": [[1,1],[3,1]],
//       "task_time_windows": [[0,5],[3,9]],
//       "service_times": [0,0],
//       "order_vehicle_match": [
//         {"order_id":0,"vehicle_ids":[0]},
//         {"order_id":1,"vehicle_ids":[1]}
//       ]
//     },
//     "solver_config": {
//       "time_limit": 1,
//       "objectives": {
//         "cost": 1,
//         "travel_time": 0,
//         "variance_route_size": 0,
//         "variance_route_service_time": 0,
//         "prize": 0
//       },
//       "verbose_mode": false,
//       "error_logging": true
//     }
//   },
//   "client_version": ""
// };


const OptimizeRoutesScreen = ({ navigation }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [optimizationStatus, setOptimizationStatus] = useState("Optimizing routes...");
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState(null);
  const isFocused = useIsFocused();
  const database = getDatabase();

  console.log("OptimizeRoutesScreen mounted.");

  useEffect(() => {
    console.log("onAuthStateChanged effect triggered.");
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log("onAuthStateChanged currentUser:", currentUser);
      if (!currentUser) {
        console.log("No user, navigating to Login...");
        navigation.replace('Login');
        return;
      }
      setUser(currentUser);
      try {
        const constraints = await fetchUserConstraints();
        console.log("Fetched constraints on auth change:", constraints);
        if (!constraints) {
          throw new Error("No vehicle constraints found");
        }
      } catch (error) {
        handleOptimizationError(error);
      }
    });

    return () => {
      console.log("Cleanup onAuthStateChanged.");
      unsubscribe();
    };
  }, [navigation]);

  const fetchDeliveries = () => {
    console.log("fetchDeliveries called.");
    return new Promise((resolve, reject) => {
      const deliveriesRef = ref(database, "deliveries");
      onValue(deliveriesRef,
        (snapshot) => {
          const data = snapshot.val();
          console.log("Fetched deliveries data from Firebase:", data);
          const deliveries = [];
          if (data) {
            Object.keys(data).forEach((key) => {
              const delivery = data[key];
              deliveries.push({ id: key, ...delivery });
            });
          }
          console.log("Parsed deliveries:", deliveries);
          resolve(deliveries);
        },
        (error) => {
          console.error("Error fetching deliveries:", error);
          reject(error);
        }
      );
    });
  };

  const fetchUserConstraints = () => {
    console.log("fetchUserConstraints called.");
    return new Promise((resolve, reject) => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.log("User not authenticated, redirecting to Login...");
        navigation.replace('Login');
        reject(new Error("User not authenticated"));
        return;
      }
      const userRef = ref(database, `users/${currentUser.uid}`);
      onValue(userRef, 
        (snapshot) => {
          const data = snapshot.val();
          console.log("Fetched user constraints from Firebase:", data);
          if (data) {
            if (data.preferredCountries && typeof data.preferredCountries === "string") {
              data.preferredCountries = data.preferredCountries.split(",").map(c => c.trim());
            }
            resolve(data);
          } else {
            resolve({});
          }
        },
        (error) => {
          console.error("Error fetching user constraints:", error);
          reject(error);
        },
        { onlyOnce: true }
      );
    });
  };

  // This function prepares the payload using your actual constraints and deliveries
  // If you want to test the known working payload:
  // 1. Comment out all code that calls this function in handleOptimizePress or optimizeRoutes
  // 2. Un-comment the knownWorkingPayload
  // 3. Pass knownWorkingPayload directly to callCuOptAPI to see if it returns a feasible solution
  // Then step by step, replace parts of knownWorkingPayload with your dynamic data.
const prepareCuOptPayload = async (deliveries, constraints) => {
  if (!user) {
    throw new Error("User must be authenticated");
  }

  // Create locations array with depot first
  const locations = [
    {
      latitude: Number(constraints.startLatitude),
      longitude: Number(constraints.startLongitude),
      type: 'depot'
    },
    ...deliveries.flatMap(d => [
      {
        latitude: Number(d.pickupLocation.latitude),
        longitude: Number(d.pickupLocation.longitude),
        type: 'pickup'
      },
      {
        latitude: Number(d.deliveryLocation.latitude),
        longitude: Number(d.deliveryLocation.longitude),
        type: 'delivery'
      }
    ])
  ];

  // Get matrices from Google Distance Matrix API
  const { distances, durations } = await getDistanceMatrix(locations, locations);

  // Create task arrays (excluding depot)
  const numDeliveries = deliveries.length;
  const numTasks = numDeliveries * 2;

  // Create payload
  return {
    action: "cuOpt_OptimizedRouting",
    data: {
      cost_matrix_data: {
        data: { "1": distances }
      },
      travel_time_matrix_data: {
        data: { "1": durations }
      },
      fleet_data: {
        vehicle_locations: [[0, 0]],
        vehicle_ids: [`veh-${user.uid}`],
        capacities: [[Number(constraints.maxCargoWeight) || 5000]],
        vehicle_time_windows: [[
          (Number(constraints.workStartTime)||8)*60,
          (Number(constraints.workEndTime)||20)*60
        ]],
        vehicle_break_time_windows: [[[
          (Number(constraints.breakStartMin)||11)*60,
          (Number(constraints.breakStartMax)||16)*60
        ]]],
        vehicle_break_durations: [[(Number(constraints.breakDuration)||1)*60]],
        min_vehicles: 1,
        vehicle_types: [1],
        vehicle_max_times: [(Number(constraints.maxDrivingTime)||10)*60],
        vehicle_max_costs: [9999]
      },
      task_data: {
        task_locations: Array.from({length: numTasks}, (_, i) => i + 1),
        task_ids: deliveries.flatMap(d => [`pickup-${d.id}`, `delivery-${d.id}`]),
        demand: [[...deliveries.flatMap(d => [Number(d.weight), -Number(d.weight)])]],
        pickup_and_delivery_pairs: Array.from({length: numDeliveries}, (_, i) => [i*2, i*2+1]),
        task_time_windows: deliveries.flatMap(d => [
          [8*60, 18*60],  // 8 AM to 6 PM for both pickup and delivery
          [8*60, 18*60]
        ]),
        service_times: deliveries.flatMap(d => [
          Number(d.serviceTime) || 30,
          Number(d.serviceTime) || 30
        ]),
        prizes: deliveries.flatMap(d => [
          Number(d.payment) || 0,
          Number(d.payment) || 0
        ])
      },
      solver_config: {
        time_limit: 300,
        objectives: {
          cost: 1,
          travel_time: 1,
          prize: 1
        },
        verbose_mode: true,
        error_logging: true
      }
    }
  };
};

  const validatePayload = (payload) => {
    console.log("validatePayload called.");
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
    console.log("Payload validation passed");
  };

  const processOptimizedRoutes = async (responseBody) => {
    console.log("processOptimizedRoutes called with:", responseBody);
    const resp = responseBody?.response;

    if (resp?.solver_response) {
      console.log("Feasible solution found");
      const { vehicle_data, solution_cost, num_vehicles } = resp.solver_response;
      const optimizedRoutes = [];

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
            });
          }
        });

        route.totalTime = data.arrival_stamp[data.arrival_stamp.length - 1];
        route.profit = 0; 
        optimizedRoutes.push(route);
      });

      return {
        routes: optimizedRoutes,
        totalCost: solution_cost,
        vehiclesUsed: num_vehicles
      };
    } else if (resp?.solver_infeasible_response) {
      console.warn("No feasible solution found. The solver_infeasible_response provides closest infeasible solution.");
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

  const handleOptimizationError = (error) => {
    console.error("Optimization error:", error);
    const errorMessage = handleCuOptError(error);
    
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

  const optimizeRoutes = async () => {
    if (!user) {
      console.warn("optimizeRoutes called but user is not authenticated");
      throw new Error("User must be authenticated");
    }

    try {
      setLoading(true);
      console.log("Starting optimization process...");

      const constraints = await fetchUserConstraints();
      console.log("Fetched constraints:", constraints);

      const deliveries = await fetchDeliveries();
      console.log("Fetched deliveries:", deliveries);

      // Here we use our data. If you want to test the known working payload:
      // 1. Comment out the next line.
      const payload = await prepareCuOptPayload(deliveries, constraints);
      
      
      // 2. Uncomment the next line to use known working payload:
      // const payload = knownWorkingPayload; 
      
      // After confirming knownWorkingPayload works, gradually replace parts with your data.
      

      console.log("Generated payload:", payload);

      validatePayload(payload);
      console.log("Payload validation passed");

      const result = await callCuOptAPI(payload);
      console.log("API response:", result);

      const processedRoutes = await processOptimizedRoutes(result);
      console.log("Processed routes:", processedRoutes);

      setLoading(false);
      setOptimizationStatus("Optimization completed!");
      Alert.alert("Success", "Optimization completed!");
      return processedRoutes;
    } catch (error) {
      console.error("Optimization error details:", error);
      handleOptimizationError(error);
      setLoading(false);
    }
  };

const saveOptimizedRoutes = async (routes, userId) => {
  const routesRef = ref(database, `routes/${userId}`);
  await set(routesRef, {
    timestamp: Date.now(),
    routes: routes
  });
};

  const handleOptimizePress = async () => {
    try {
      console.log("handleOptimizePress called");
      setOptimizing(true);
      setError(null);
      setOptimizationStatus("Starting optimization...");

      await optimizeRoutes();
    } catch (error) {
      console.error("Optimization failed:", error.message);
      handleOptimizationError(error);
    } finally {
      setOptimizing(false);
    }
  };

  useEffect(() => {
    if (isFocused && user && !optimizing) {
      console.log("isFocused and user authenticated, starting auto optimize...");
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center", 
    alignItems: "center", 
    padding: 20,
    backgroundColor: "#f9f9f9",
  },
  statusText: {
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 20,
    color: '#333',
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
  }
});

export default OptimizeRoutesScreen;
