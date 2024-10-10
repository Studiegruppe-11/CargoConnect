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
  const [optimizationStatus, setOptimizationStatus] = useState(
    "Optimizing routes..."
  );
  const db = getDatabase();
  const isFocused = useIsFocused();

  // Define the Corrected API Endpoint
  const invokeUrl = "https://optimize.api.nvidia.com/v1/nvidia/cuopt"; // Corrected Endpoint
  const fetchUrlFormat = "https://optimize.api.nvidia.com/v1/status/";

  useEffect(() => {
    if (isFocused) {
      const fetchDataAndOptimize = async () => {
        try {
          // Fetch all deliveries (remove the 'accepted' filter)
          const deliveries = await fetchDeliveries();
          if (deliveries.length === 0) {
            Alert.alert(
              "No Deliveries",
              "There are no deliveries to optimize."
            );
            setOptimizationStatus("No deliveries available for optimization.");
            setLoading(false);
            return;
          }

          // Fetch trucker's constraints
          const userConstraints = await fetchUserConstraints();

          // Prepare payload for NVIDIA cuOpt
          const payload = await prepareCuOptPayload(deliveries, userConstraints);

          console.log(
            "User constraints:",
            JSON.stringify(userConstraints, null, 2),
            "Deliveries:",
            JSON.stringify(deliveries, null, 2)
          );

          // Validate the Payload
          validatePayload(payload);

          // Proceed to call the API
          const optimizedData = await callCuOptAPI(
            payload,
            invokeUrl,
            fetchUrlFormat
          );

          // Save optimized route to database
          const optimizedRouteRef = ref(
            db,
            "optimizedRoutes/" + auth.currentUser.uid
          );
          await set(optimizedRouteRef, { routes: optimizedData });

          // Navigate to the optimized routes screen
          navigation.navigate("RoutesHome", { optimizedRoutes: optimizedData });

          setOptimizationStatus("Routes optimized successfully!");
          setLoading(false);
        } catch (error) {
          console.error("Optimization Error:", error);
          Alert.alert("Error", `Failed to optimize routes. ${error.message}`);
          setOptimizationStatus(`Optimization failed: ${error.message}`);
          setLoading(false);
        }
      };

      fetchDataAndOptimize();
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
      const deliveriesRef = ref(db, "deliveries");
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
        const userRef = ref(db, `users/${user.uid}`);
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
    // Validate starting location
    const startLatitude = constraints.startLatitude || constraints.currentLatitude;
    const startLongitude = constraints.startLongitude || constraints.currentLongitude;

    if (startLatitude === undefined || startLongitude === undefined) {
      console.error("Starting location is missing in constraints:", constraints);
      throw new Error("Starting location is missing. Please update your profile.");
    }

    // Adjust maxDrivingTime to at least 15 hours
    const maxDrivingTime = Math.max(constraints.maxDrivingTime || 10, 15);

    // Define vehicleId as a string
    const vehicleId = "veh-1"; // Modify as needed

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
    const pickup_and_delivery_pairs = [];

    // Initialize demand arrays for each dimension
    const demand_weight = [];
    const demand_volume = [];

    // Track order_vehicle_match separately
    const order_vehicle_match = [];

    // Iterate through deliveries
    deliveries.forEach((delivery, deliveryIndex) => {
      // Validate delivery locations
      if (
        !delivery.pickupLocation ||
        delivery.pickupLocation.latitude === undefined ||
        delivery.pickupLocation.longitude === undefined
      ) {
        console.error(`Delivery ${delivery.id} is missing pickup location.`);
        return; // Skip this delivery
      }

      if (
        !delivery.deliveryLocation ||
        delivery.deliveryLocation.latitude === undefined ||
        delivery.deliveryLocation.longitude === undefined
      ) {
        console.error(`Delivery ${delivery.id} is missing delivery location.`);
        return; // Skip this delivery
      }

      // Calculate volume (in cubic meters)
      const volume =
        (delivery.height * delivery.width * delivery.length) / 1e6; // cm³ to m³

      // Ensure constraints are defined (additional defensive check)
      if (!constraints) {
        console.error("User constraints are not defined.");
        throw new Error("User constraints are not defined.");
      }
      console.log("User Constraints:", constraints);

      // Check if delivery matches the user's constraints
      const maxCargoWeight =
        typeof constraints.maxCargoWeight === "number" && constraints.maxCargoWeight > 0
          ? constraints.maxCargoWeight
          : 8000;
      const maxCargoVolume =
        typeof constraints.maxCargoVolume === "number" && constraints.maxCargoVolume > 0
          ? constraints.maxCargoVolume
          : 60;

      const isMatch =
        (delivery.weight || 0) <= maxCargoWeight &&
        volume <= maxCargoVolume;

      if (!isMatch) {
        // Skip this delivery as it doesn't match constraints
        console.log(`Delivery ${delivery.id} does not match constraints. Skipping.`);
        return;
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
      let deliveryIndexLocal;
      if (!(deliveryLocKey in locationIndices)) {
        uniqueLocations.push({
          latitude: delivery.deliveryLocation.latitude,
          longitude: delivery.deliveryLocation.longitude,
        });
        locationIndices[deliveryLocKey] = index;
        deliveryIndexLocal = index;
        index++;
      } else {
        deliveryIndexLocal = locationIndices[deliveryLocKey];
      }

      // Handle pickup task
      const pickupTaskIndex = task_ids.length; // Current length gives the next index
      task_locations.push(pickupIndex);
      const pickupTaskId = `${delivery.id}_pickup`;
      task_ids.push(pickupTaskId);
      const serviceTime = Math.max(Math.floor(delivery.serviceTime || 600), 1); // in seconds
      service_times.push(serviceTime);

      // Set relative time windows
      const relativeStartTime = 0; // Reference start time
      const relativeEndTime = maxDrivingTime * 3600; // e.g., 15 hours in seconds

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
      task_locations.push(deliveryIndexLocal);
      const deliveryTaskId = `${delivery.id}_delivery`;
      task_ids.push(deliveryTaskId);
      service_times.push(serviceTime); // Same service time

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
        pickupTaskIndex,
        deliveryTaskIndex,
      ]);

      // Add order_vehicle_match
      order_vehicle_match.push({
        order_id: pickupTaskIndex,
        vehicle_ids: [vehicleId],
      });
      order_vehicle_match.push({
        order_id: deliveryTaskIndex,
        vehicle_ids: [vehicleId],
      });
    });

    // Validate task-related arrays
    if (
      task_ids.length !== task_locations.length ||
      task_ids.length !== service_times.length ||
      task_ids.length !== task_time_windows.length ||
      task_ids.length !== demand_weight.length ||
      task_ids.length !== demand_volume.length ||
      task_ids.length !== prizes.length
    ) {
      throw new Error("Mismatch in task-related array lengths.");
    }

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
          const averageSpeed =
            typeof constraints.averageSpeed === "number" && constraints.averageSpeed > 0
              ? constraints.averageSpeed
              : 60; // km/h
          travelTimeMatrix[i][j] =
            (distance / averageSpeed) * 3600; // in seconds
        }
      }
    }

    // Define fleet_data
    const fleet_data = {
      vehicle_locations: [
        [vehicleLocationIndex, vehicleLocationIndex],
      ],
      vehicle_ids: [
        vehicleId,
      ],
      capacities: [
        [maxCargoWeight],
        [maxCargoVolume],
      ],
      vehicle_time_windows: [
        [0, maxDrivingTime * 3600], // 15 hours in seconds
      ],
      vehicle_break_time_windows: [],
      vehicle_break_durations: [],
      vehicle_break_locations: [],
      vehicle_types: [1],
      skip_first_trips: [false],
      drop_return_trips: [false],
      min_vehicles: 1,
      vehicle_max_costs: [1000000],
      vehicle_max_times: [maxDrivingTime * 3600],
      vehicle_fixed_costs: [0],
      vehicle_order_match: order_vehicle_match,
    };

    // Prepare task_data
    const task_data = {
      task_locations,
      task_ids,
      demand: [demand_weight, demand_volume],
      pickup_and_delivery_pairs,
      task_time_windows,
      service_times,
      prizes,
    };

    // Prepare payload
    const payload = {
      action: "cuOpt_OptimizedRouting",
      client_version: "",
      data: {
        cost_waypoint_graph_data: null,
        travel_time_waypoint_graph_data: null,
        cost_matrix_data: {
          data: {
            "1": costMatrix, // Adjust vehicle type key as needed
          },
        },
        travel_time_matrix_data: {
          data: {
            "1": travelTimeMatrix, // Adjust vehicle type key as needed
          },
        },
        fleet_data,
        task_data,
        solver_config: {
          time_limit: 300,
          objectives: {
            cost: 1,
            travel_time: 0,
            variance_route_size: 0,
            variance_route_service_time: 0,
            prize: -1,
            vehicle_fixed_cost: 0,
          },
          verbose_mode: true,
          error_logging: true,
        },
      },
      parameters: {},
      client_version: "",
    };

    console.log("Final Payload:", JSON.stringify(payload, null, 2));

    return payload;
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
  const callCuOptAPI = async (payload, invokeUrl, fetchUrlFormat) => {
    console.log("Calling NVIDIA cuOpt API with payload:", payload);
    const headers = {
      Authorization: `Bearer ${NVIDIA_API_KEY}`, // Ensure this is securely stored
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    let response;
    try {
      response = await fetch(`${invokeUrl}/routes`, {
        method: "POST",
        body: JSON.stringify(payload),
        headers,
      });
    } catch (networkError) {
      console.error("Network Error:", networkError);
      throw new Error(`Network Error: ${networkError.message}`);
    }

    // Handle asynchronous API processing
    while (response.status === 202) {
      const requestId = response.headers.get("NVCF-REQID");
      if (!requestId) {
        throw new Error("Missing NVCF-REQID header in the response.");
      }
      const fetchUrl = `${fetchUrlFormat}${requestId}`;
      console.log(`Request in progress. Fetching status from ${fetchUrl}`);
      setOptimizationStatus("Optimization in progress...");
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait before retrying
      try {
        response = await fetch(fetchUrl, {
          method: "GET",
          headers,
        });
      } catch (networkError) {
        console.error("Network Error during polling:", networkError);
        throw new Error(
          `Network Error during polling: ${networkError.message}`
        );
      }
    }

    if (response.status !== 200) {
      const errBody = await response.text(); // Get the raw text for more detail
      console.error("API Error Details:", errBody);
      throw new Error(`Invocation failed with status ${response.status}: ${errBody}`);
    }

    let responseBody;
    try {
      responseBody = await response.json();
    } catch (parseError) {
      const errBody = await response.text();
      console.error("Failed to parse JSON:", errBody);
      throw new Error(
        `JSON Parse Error: ${parseError.message}. Response Body: ${errBody}`
      );
    }

    console.log("API Response:", JSON.stringify(responseBody, null, 2));

    const optimizedRoutes = parseOptimizedRoute(responseBody);
    return optimizedRoutes;
  };

  // Parse the optimized route from API response
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
        totalProfit: route.totalProfit || 0, // Ensure this field exists in the API response
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
