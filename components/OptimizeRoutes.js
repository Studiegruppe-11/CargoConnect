// components/OptimizeRoutes.js

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Button,
} from "react-native";
import { getDatabase, ref, onValue, set, push } from "firebase/database";
import { auth } from "../firebaseConfig";
import { useIsFocused } from "@react-navigation/native";
import { onAuthStateChanged } from "firebase/auth";
import { updateDistanceMatrixIncrementally } from '../utils/routeMatrix';

// Import functions from nvApi.js
import { 
  validatePayload, 
  callCuOptAPI, 
  processOptimizedRoutes, 
  handleCuOptError 
} from '../utils/nvApi';

// Import functions from internFetcher.js
import { fetchDeliveries, fetchUserConstraints } from '../utils/internFetcher';

const OptimizeRoutesScreen = ({ navigation }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [optimizationStatus, setOptimizationStatus] = useState(
    "Optimizing routes..."
  );
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
        console.log("Fetched constraints on auth change:", constraints);
        if (!constraints) {
          throw new Error("No vehicle constraints found");
        }
  
        // At this point you have constraints. You may also want to fetch deliveries here.
        const deliveries = await fetchDeliveries();
        console.log("Fetched deliveries:", deliveries);
  
        // Now data is ready, show buttons:
        setLoading(false);
  
      } catch (error) {
        handleOptimizationError(error);
        setLoading(false);
      }
    });
  
    return () => {
      console.log("Cleanup onAuthStateChanged.");
      unsubscribe();
    };
  }, [navigation]);

  // In OptimizeRoutesScreen.js (showing only the prepareCuOptPayload function changes):

const prepareCuOptPayload = async (deliveries, constraints) => {
  if (!user) {
    throw new Error("User must be authenticated");
  }

  const dieselPrice = 12;
  const fuelEfficiency = Number(constraints.fuelEfficiency) || 10;

  // Create the locations array
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

  const { distances, durations } = await updateDistanceMatrixIncrementally(user.uid, locations);

  const costMatrix = distances.map(row =>
    row.map(distanceKm => (distanceKm / fuelEfficiency) * dieselPrice)
  );

  const numDeliveries = deliveries.length;
  const numTasks = numDeliveries * 2;

  // Extract vehicle dimension capacities from constraints
  const maxLengthCm = Number(constraints.dimensions?.length) || 0; 
  const maxWidthCm = Number(constraints.dimensions?.width) || 0;  
  const maxHeightCm = Number(constraints.dimensions?.height) || 0;

  // Prepare demand (note it's called 'demand' not 'demands')
  // Each delivery has a pickup (positive) and a delivery (negative)
  // We'll use length, width, height as the three dimensions.
  const demand = deliveries.flatMap(d => {
    const h = Number(d.height) || 0;
    const w = Number(d.width) || 0;
    const l = Number(d.length) || 0;

    // pickup task demands (positive)
    const pickupDemand = [l, w, h];
    // delivery task demands (negative)
    const deliveryDemand = [-l, -w, -h];

    return [pickupDemand, deliveryDemand];
  });

  const payload = {
    action: "cuOpt_OptimizedRouting",
    data: {
      cost_matrix_data: {
        // vehicle-type '1' used as key as per specification (uint8)
        data: { "1": costMatrix }
      },
      travel_time_matrix_data: {
        data: { "1": durations }
      },
      fleet_data: {
        vehicle_locations: [[0, 0]], // start and end at location 0
        vehicle_ids: [`veh-${user.uid}`],
        capacities: [
          [maxLengthCm], // dimension 1 (length)
          [maxWidthCm],  // dimension 2 (width)
          [maxHeightCm]  // dimension 3 (height)
        ],
        // Note: capacities should be arrays of arrays if multiple vehicles, 
        // since we have one vehicle, each dimension gets a single-element array.
        
        vehicle_time_windows: [
          [
            (Number(constraints.workStartTime)||6)*60,
            (Number(constraints.workEndTime)||22)*60
          ]
        ],
        vehicle_break_time_windows: [
          [
            [
              (Number(constraints.breakStartMin)||11)*60,
              (Number(constraints.breakStartMax)||16)*60
            ]
          ]
        ],
        vehicle_break_durations: [
          [(Number(constraints.breakDuration)||1)*30]
        ],
        min_vehicles: 1,
        vehicle_types: [1],
        vehicle_max_times: [(Number(constraints.maxDrivingTime)||12)*60],
        vehicle_max_costs: [99999]
      },
      task_data: {
        task_locations: Array.from({ length: numTasks }, (_, i) => i + 1),
        task_ids: deliveries.flatMap(d => [`pickup-${d.id}`, `delivery-${d.id}`]),
        pickup_and_delivery_pairs: Array.from({ length: numDeliveries }, (_, i) => [i*2, i*2+1]),
        task_time_windows: deliveries.flatMap(d => [
          [6*60, 22*60],
          [6*60, 22*60]
        ]),
        service_times: deliveries.flatMap(d => [
          Number(d.serviceTime) || 30,
          Number(d.serviceTime) || 30
        ]),
        prizes: deliveries.flatMap(d => [
          Number(d.payment) || 0,
          Number(d.payment) || 0
        ]),
        // Provide demand in the correct format: an array of arrays, one per dimension
        // We have 3 dimensions, so we must transpose our demand data. 
        // Currently, 'demand' is an array of [l, w, h] for each task.
        // We need [[dem_for_dim1], [dem_for_dim2], [dem_for_dim3]].
        
        // Let's transpose:
        demand: [
          demand.map(d => d[0]), // all length demands
          demand.map(d => d[1]), // all width demands
          demand.map(d => d[2])  // all height demands
        ]
      },
      solver_config: {
        time_limit: 10,
        objectives: {
          cost: 1,
          prize: 1
        },
        verbose_mode: true,
        error_logging: true
      }
    }
  };

  return { payload, locations };
};

// The rest of your code in OptimizeRoutesScreen.js remains the same.

  

  const saveOptimizedRoutes = async (processedRoutes, userId) => {
    const routesRef = ref(database, `routes/${userId}`);
    const newRef = push(routesRef);
    await set(newRef, {
      timestamp: Date.now(),
      routes: processedRoutes.routes,
      totalCost: processedRoutes.totalCost,
      vehiclesUsed: processedRoutes.vehiclesUsed
    });
  };
  

  const optimizeRoutes = async () => {
    if (!user) {
      console.warn("optimizeRoutes called but user is not authenticated");
      throw new Error("User must be authenticated");
    }
  
    try {
      setLoading(true);
      console.log("Starting optimization process...");
  
      const constraints = await fetchUserConstraints(navigation);
      console.log("Fetched constraints:", constraints);
  
      const deliveries = await fetchDeliveries();
      console.log("Fetched deliveries:", deliveries);
  
      const { payload, locations } = await prepareCuOptPayload(deliveries, constraints);
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
      const errorMessage = handleCuOptError(error);
  
      setOptimizationStatus(`Optimization failed: ${errorMessage}`);
      Alert.alert("Optimization Error", errorMessage, [
        {
          text: "Go to Profile",
          onPress: () => navigation.navigate("Profile"),
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ]);
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
          <Button 
            title="View Generated Routes" 
            onPress={() => navigation.navigate('RouteList')} 
          />
          {/* Remove the "View Details of a Specific Route" button */}
          {/*<Button 
            title="View Details of a Specific Route" 
            onPress={() => navigation.navigate('RouteDetails', { route })}
          />*/}
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
    textAlign: "center",
    marginVertical: 20,
    color: "#333",
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
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
});

export default OptimizeRoutesScreen;
