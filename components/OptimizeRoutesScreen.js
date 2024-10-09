// components/OptimizeRoutesScreen.js

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { getDatabase, ref, onValue, set } from "firebase/database";
import { auth, NVIDIA_API_KEY } from "../firebaseConfig";
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
  const [optimizationStatus, setOptimizationStatus] = useState(
    "Optimizing routes..."
  );
  const db = getDatabase();
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      const fetchDataAndOptimize = async () => {
        try {
          // Fetch accepted deliveries
          const deliveries = await fetchDeliveries();
          if (deliveries.length === 0) {
            Alert.alert(
              "No Deliveries",
              "There are no accepted deliveries to optimize."
            );
            setLoading(false);
            return;
          }

          // Fetch trucker's constraints
          const userConstraints = await fetchUserConstraints();

          // Prepare payload for NVIDIA cuOpt
          const payload = await prepareCuOptPayload(
            deliveries,
            userConstraints
          );

          console.log(
            "User constraints:",
            JSON.stringify(userConstraints, null, 2),
            "Deliveries:",
            JSON.stringify(deliveries, null, 2)
          );

          // Call NVIDIA cuOpt API
          const optimizedData = await callCuOptAPI(payload);

          // Save optimized route to database
          const optimizedRouteRef = ref(
            db,
            "optimizedRoutes/" + auth.currentUser.uid
          );
          await set(optimizedRouteRef, { routes: optimizedData });

          setOptimizationStatus("Routes optimized successfully!");
          setLoading(false);

          // Navigate back to RoutesScreen after optimization
          navigation.navigate("RoutesHome");
        } catch (error) {
          console.error(error);
          Alert.alert("Error", "Failed to optimize routes.");
          setLoading(false);
        }
      };
      fetchDataAndOptimize();
    }
  }, [isFocused]);

  // Helper functions
  const fetchDeliveries = () => {
    return new Promise((resolve, reject) => {
      const deliveriesRef = ref(db, "deliveries");
      onValue(
        deliveriesRef,
        (snapshot) => {
          const data = snapshot.val();
          const deliveries = [];
          if (data) {
            Object.keys(data).forEach((key) => {
              deliveries.push({ id: key, ...data[key] });
            });
          }
          resolve(deliveries);
        },
        (error) => {
          reject(error);
        }
      );
    });
  };

  const fetchUserConstraints = () => {
    return new Promise((resolve, reject) => {
      const user = auth.currentUser;
      if (user) {
        const userRef = ref(db, `users/${user.uid}`);
        onValue(
          userRef,
          (snapshot) => {
            const data = snapshot.val();
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
          },
          (error) => {
            reject(error);
          }
        );
      } else {
        reject("User not authenticated");
      }
    });
  };

  const prepareCuOptPayload = async (deliveries, constraints) => {
    // Validate starting location
    const startLatitude =
    constraints.startLatitude || constraints.currentLatitude;
  const startLongitude =
    constraints.startLongitude || constraints.currentLongitude;

    if (startLatitude === undefined || startLongitude === undefined) {
      console.error("Starting location is missing in constraints:", constraints);
      throw new Error(
        "Starting location is missing. Please update your profile."
      );
    }

        // **Adjust maxDrivingTime to at least 15 hours**
        constraints.maxDrivingTime = Math.max(constraints.maxDrivingTime || 10, 15);
        
    // Define vehicleId as a string
    const vehicleId = "0"; // Assign a string ID to your vehicle

    const uniqueLocations = [];
    const locationIndices = {};
    let index = 0;

    // Add vehicle starting location
    const vehicleStartLocation = {
      latitude: startLatitude,
      longitude: startLongitude,
    };
    uniqueLocations.push(vehicleStartLocation);
    locationIndices[`${startLatitude},${startLongitude}`] = index;
    const vehicleLocationIndex = index;
    index++;

    // Arrays for tasks
    const task_locations = [];
    const task_ids = [];
    const service_times = [];
    const task_time_windows = [];
    const prizes = [];
    const order_vehicle_match = []; // Correct field name
    const pickup_and_delivery_pairs = [];

    // Initialize demand arrays for each dimension
    const demand_weight = [];
    const demand_volume = [];

    // **Option A: Reduce Number of Deliveries**
    // Select deliveries that fit within capacity
    // Example: Only the first delivery for minimal testing
    const selectedDeliveries = deliveries.slice(0, 1); // Adjust as needed

    for (let i = 0; i < selectedDeliveries.length; i++) {
      const delivery = selectedDeliveries[i];

      // Validate delivery locations
      if (
        !delivery.pickupLocation ||
        delivery.pickupLocation.latitude === undefined ||
        delivery.pickupLocation.longitude === undefined
      ) {
        console.error(`Delivery ${delivery.id} is missing pickup location.`);
        continue; // Skip this delivery
      }

      if (
        !delivery.deliveryLocation ||
        delivery.deliveryLocation.latitude === undefined ||
        delivery.deliveryLocation.longitude === undefined
      ) {
        console.error(
          `Delivery ${delivery.id} is missing delivery location.`
        );
        continue; // Skip this delivery
      }

      // Calculate volume (in cubic meters)
      const volume =
        (delivery.height * delivery.width * delivery.length) / 1e6; // converting from cm^3 to m^3

      // Check if delivery matches the user's constraints
      const isMatch =
        (delivery.weight || 0) <= (constraints.maxCargoWeight || Infinity) &&
        volume <= (constraints.maxCargoVolume || Infinity);

      if (!isMatch) {
        // Skip this delivery as it doesn't match constraints
        continue;
      }

      // Handle pickup location
      const pickupLocKey = `${delivery.pickupLocation.latitude},${delivery.pickupLocation.longitude}`;
      let pickupIndex;
      if (!(pickupLocKey in locationIndices)) {
        uniqueLocations.push({
          latitude: delivery.pickupLocation.latitude,
          longitude: delivery.pickupLocation.longitude,
        });
        locationIndices[pickupLocKey] = index;
        pickupIndex = index;
        index++;
      } else {
        pickupIndex = locationIndices[pickupLocKey];
      }

      // Handle delivery location
      const deliveryLocKey = `${delivery.deliveryLocation.latitude},${delivery.deliveryLocation.longitude}`;
      let deliveryIndex;
      if (!(deliveryLocKey in locationIndices)) {
        uniqueLocations.push({
          latitude: delivery.deliveryLocation.latitude,
          longitude: delivery.deliveryLocation.longitude,
        });
        locationIndices[deliveryLocKey] = index;
        deliveryIndex = index;
        index++;
      } else {
        deliveryIndex = locationIndices[deliveryLocKey];
      }

      // Handle pickup task
      const pickupTaskIndex = task_ids.length; // Current length gives the next index
      task_locations.push(pickupIndex);
      const pickupTaskId = `${delivery.id}_pickup`;
      task_ids.push(pickupTaskId);
      service_times.push(Math.floor(delivery.serviceTime || 600)); // in seconds

      // **Set Relative Time Windows**
      const relativeStartTime = 0; // Reference start time
      const relativeEndTime = constraints.maxDrivingTime * 3600; // Now up to 54000 seconds (15 hours)

      task_time_windows.push([
        relativeStartTime,
        relativeEndTime,
      ]);

      prizes.push(delivery.payment || 0);

      // Add demands for pickup task
      demand_weight.push(delivery.weight || 1);
      demand_volume.push(volume || 1);

      // Handle delivery task
      const deliveryTaskIndex = task_ids.length;
      task_locations.push(deliveryIndex);
      const deliveryTaskId = `${delivery.id}_delivery`;
      task_ids.push(deliveryTaskId);
      service_times.push(Math.floor(delivery.serviceTime || 600)); // in seconds

      task_time_windows.push([
        relativeStartTime,
        relativeEndTime,
      ]);

      prizes.push(delivery.payment || 0);

      // Add demands for delivery task (negative values)
      demand_weight.push(-(delivery.weight || 1));
      demand_volume.push(-(volume || 1));

      // Add pickup and delivery pair
      pickup_and_delivery_pairs.push([
        pickupTaskIndex, // Pickup task index (integer)
        deliveryTaskIndex, // Delivery task index (integer)
      ]);

      // Add order_vehicle_match using indices
      order_vehicle_match.push({
        order_id: pickupTaskIndex,
        vehicle_ids: [0], // Integer index of the vehicle
      });
      order_vehicle_match.push({
        order_id: deliveryTaskIndex,
        vehicle_ids: [0], // Integer index of the vehicle
      });
    }

    // **Enhanced Logging for Debugging**
    console.log("Number of tasks:", task_ids.length);
    console.log("Demand weight array length:", demand_weight.length);
    console.log("Demand volume array length:", demand_volume.length);
    console.log("Task Locations length:", task_locations.length);
    console.log("Service Times length:", service_times.length);
    console.log("Task Time Windows length:", task_time_windows.length);
    console.log("Prizes length:", prizes.length);
    console.log("Order Vehicle Match length:", order_vehicle_match.length);
    console.log("Pickup and Delivery Pairs length:", pickup_and_delivery_pairs.length);

    // Check if there are tasks to optimize
    if (task_ids.length === 0) {
      throw new Error(
        "No deliveries match your constraints or deliveries are missing location data."
      );
    }

    // Build cost and travel time matrices
    const costMatrix = [];
    const travelTimeMatrix = [];
    for (let i = 0; i < uniqueLocations.length; i++) {
      costMatrix[i] = [];
      travelTimeMatrix[i] = [];
      for (let j = 0; j < uniqueLocations.length; j++) {
        if (i === j) {
          costMatrix[i][j] = 0;
          travelTimeMatrix[i][j] = 0;
        } else {
          const locA = uniqueLocations[i];
          const locB = uniqueLocations[j];
          const distance = haversineDistance(locA, locB);
          costMatrix[i][j] = distance; // in kilometers
          travelTimeMatrix[i][j] =
            (distance / (constraints.averageSpeed || 60)) * 3600; // in seconds
        }
      }
    }
    
    // Update fleet_data
    const fleet_data = {
      vehicle_locations: [[vehicleLocationIndex, vehicleLocationIndex]],
      vehicle_ids: [0], // Use integers instead of strings
      capacities: [
        [constraints.maxCargoWeight || 8000], // Weight capacity in kg
        [constraints.maxCargoVolume || 60],   // Volume capacity in m³
      ],
      vehicle_time_windows: [
        [0, constraints.maxDrivingTime * 3600], // e.g., 0 to 54000 seconds (15 hours)
      ],
      vehicle_break_time_windows: [],
      vehicle_break_durations: [],
      vehicle_break_locations: [],
      vehicle_types: [1],
      skip_first_trips: [false],
      drop_return_trips: [false],
      min_vehicles: 1,
      vehicle_max_costs: [10000],
      vehicle_max_times: [constraints.maxDrivingTime * 3600],
      vehicle_fixed_costs: [0],
      vehicle_order_match: [
        {
          order_ids: selectedDeliveries.map((delivery, i) => i), // [0, 1, ...]
          vehicle_id: 0
        }
      ]
    };

    // Prepare task_data
    const task_data = {
      task_locations,
      task_ids,
      demand: [demand_weight, demand_volume], // Separate arrays for each dimension
      pickup_and_delivery_pairs,
      task_time_windows,
      service_times,
      prizes,
      order_vehicle_match, // Correct field name
    };

    // Prepare payload with cost_matrix and travel_time_matrix under "data"
    const payload = {
      action: "cuOpt_OptimizedRouting",
      client_version: "",
      data: {
        cost_waypoint_graph_data: null,
        travel_time_waypoint_graph_data: null,
        cost_matrix_data: {
          data: {
            "1": costMatrix, // Correct key as per sample
          },
        },
        travel_time_matrix_data: {
          data: {
            "1": travelTimeMatrix, // Correct key as per sample
          },
        },
        fleet_data,
        task_data,
        solver_config: {
          time_limit: 300, // Increased to 5 minutes
          objectives: {
            cost: 1,
            travel_time: 0,
            variance_route_size: 0,
            variance_route_service_time: 0,
            prize: 0,
            vehicle_fixed_cost: 0,
          },
          config_file: null,
          verbose_mode: false,
          error_logging: true,
        },
      },
      parameters: {},
      client_version: "",
    };

    // Log the fully formatted payload for debugging
    console.log("Final Payload:", JSON.stringify(payload, null, 2));

    return payload;
  };

  const callCuOptAPI = async (payload) => {
    console.log("Calling NVIDIA cuOpt API with payload:", payload);
    const invokeUrl = "https://optimize.api.nvidia.com/v1/nvidia/cuopt";
    const fetchUrlFormat = "https://optimize.api.nvidia.com/v1/status/";
    const headers = {
      Authorization: `Bearer ${NVIDIA_API_KEY}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    let response = await fetch(invokeUrl, {
      method: "POST",
      body: JSON.stringify(payload),
      headers,
    });

    // Handle the async nature of the API
    while (response.status === 202) {
      const requestId = response.headers.get("NVCF-REQID");
      if (!requestId) {
        throw new Error("Missing NVCF-REQID header in the response.");
      }
      const fetchUrl = `${fetchUrlFormat}${requestId}`;
      console.log(`Request in progress. Fetching status from ${fetchUrl}`);
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait before retrying
      response = await fetch(fetchUrl, {
        method: "GET",
        headers,
      });
    }

    if (response.status !== 200) {
      const errBody = await response.text();
      console.error(
        `Invocation failed with status ${response.status}: ${errBody}`
      );
      throw new Error(
        `Invocation failed with status ${response.status}: ${errBody}`
      );
    }

    const responseBody = await response.json();
    console.log("API Response:", responseBody);
    const optimizedRoutes = parseOptimizedRoute(responseBody);
    return optimizedRoutes;
  };

  const parseOptimizedRoute = (responseBody) => {
    if (!responseBody.result || !responseBody.result.routes) {
      throw new Error("Invalid response format from cuOpt API.");
    }

    const routes = responseBody.result.routes;
    const optimizedRoutes = [];
    routes.forEach((route) => {
      const coordinates = route.vehicleStops.map((stop) => ({
        latitude: stop.taskLocation[0],
        longitude: stop.taskLocation[1],
        taskId: stop.taskId,
        arrivalTime: stop.arrivalTime,
        departureTime: stop.departureTime,
      }));
      optimizedRoutes.push({
        vehicleId: route.vehicleId,
        coordinates,
        totalProfit: route.totalProfit, // Ensure this field exists in the API response
      });
    });

    // Sort routes by totalProfit in descending order
    optimizedRoutes.sort((a, b) => b.totalProfit - a.totalProfit);

    return optimizedRoutes;
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center", // Center vertically
    alignItems: "center", // Center horizontally
    padding: 20,
  },
  statusText: {
    marginTop: 20,
    fontSize: 18,
    textAlign: "center",
  },
});

export default OptimizeRoutesScreen;
