// components/OptimizeRoutesScreen.js

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { getDatabase, ref, onValue, set } from 'firebase/database';
import { auth, NVIDIA_API_KEY } from '../firebaseConfig';
import { useIsFocused } from '@react-navigation/native';

const OptimizeRoutesScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [optimizationStatus, setOptimizationStatus] = useState('Optimizing routes...');
  const db = getDatabase();
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      const fetchDataAndOptimize = async () => {
        try {
          // Fetch accepted deliveries
          const deliveries = await fetchDeliveries();

          if (deliveries.length === 0) {
            Alert.alert('No Deliveries', 'There are no accepted deliveries to optimize.');
            setLoading(false);
            return;
          }

          // Fetch trucker's constraints
          const userConstraints = await fetchUserConstraints();

          // Prepare payload for NVIDIA cuOpt
          const payload = await prepareCuOptPayload(deliveries, userConstraints);

          // Call NVIDIA cuOpt API
          const optimizedData = await callCuOptAPI(payload);

          // Save optimized route to database
          const optimizedRouteRef = ref(db, 'optimizedRoutes/' + auth.currentUser.uid);
          await set(optimizedRouteRef, { routes: optimizedData });

          setOptimizationStatus('Routes optimized successfully!');
          setLoading(false);

          // Navigate back to RoutesScreen after optimization
          navigation.navigate('RoutesHome');
        } catch (error) {
          console.error(error);
          Alert.alert('Error', 'Failed to optimize routes.');
          setLoading(false);
        }
      };

      fetchDataAndOptimize();
    }
  }, [isFocused]);

  // Helper functions

  // Fetch deliveries including payment and time windows
  const fetchDeliveries = () => {
    return new Promise((resolve, reject) => {
      const deliveriesRef = ref(db, 'deliveries');
      onValue(
        deliveriesRef,
        (snapshot) => {
          const data = snapshot.val();
          const deliveries = [];
          if (data) {
            Object.keys(data).forEach((key) => {
              if (data[key].status === 'accepted') {
                deliveries.push({ id: key, ...data[key] });
              }
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
            if (data.preferredCountries && typeof data.preferredCountries === 'string') {
              data.preferredCountries = data.preferredCountries.split(',').map((c) => c.trim());
            }
            resolve(data);
          },
          (error) => {
            reject(error);
          }
        );
      } else {
        reject('User not authenticated');
      }
    });
  };

  

  const prepareCuOptPayload = async (deliveries, constraints) => {
    // Map coordinates to indices
    const uniqueLocations = [];
    const locationIndices = {};
    let index = 0;
  
    // Add vehicle starting location
    const vehicleStartLocation = {
      latitude: constraints.currentLatitude || 0,
      longitude: constraints.currentLongitude || 0,
    };
    uniqueLocations.push(vehicleStartLocation);
    const vehicleLocationIndex = index;
    index++;
  
    // Add task locations
    for (const delivery of deliveries) {
      const locKey = `${delivery.location.latitude},${delivery.location.longitude}`;
      if (!(locKey in locationIndices)) {
        uniqueLocations.push({
          latitude: delivery.location.latitude,
          longitude: delivery.location.longitude,
        });
        locationIndices[locKey] = index;
        index++;
      }
    }
  
    // Build cost matrix
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
          // Assuming average speed of 60 km/h
          travelTimeMatrix[i][j] = (distance / 60) * 3600; // in seconds
        }
      }
    }
  
    // Prepare vehicle_locations and task_locations
    const vehicle_locations = [vehicleLocationIndex]; // Index of the vehicle's starting location
    const task_locations = deliveries.map((delivery) => {
      const locKey = `${delivery.location.latitude},${delivery.location.longitude}`;
      return locationIndices[locKey];
    });
  
    // Prepare other task data
    const task_ids = deliveries.map((delivery) => delivery.id);
    const demands = deliveries.map((delivery) => [
      delivery.weight || 1,
      delivery.volume || 1,
    ]);
    const service_times = deliveries.map((delivery) => delivery.serviceTime || 600);
    const task_time_windows = deliveries.map((delivery) => [
      delivery.earliestStartTime || 0,
      delivery.latestEndTime || 86400,
    ]);
    const prizes = deliveries.map((delivery) => delivery.payment || 0);
  
    // Prepare order_vehicle_match
    const order_vehicle_match = [];

    for (let i = 0; i < deliveries.length; i++) {
      const delivery = deliveries[i];
    
      // Determine if this delivery is compatible with the vehicle
      let deliveryCountry = delivery.country || 'Unknown';
      if (!delivery.country) {
        deliveryCountry = await getCountryFromCoordinates(
          delivery.location.latitude,
          delivery.location.longitude
        );
      }
    
      const isMatch = constraints.preferredCountries.includes(deliveryCountry);
    
      order_vehicle_match.push({
        order_id: i, // Index of the task
        vehicle_ids: isMatch ? [0] : [], // Vehicle index 0 if compatible
      });
    }
  
    // Fleet data
    const capacities = [
      [
        constraints.maxCargoWeight || 10000,
        constraints.maxCargoVolume || 100,
      ],
    ];
    const vehicle_time_windows = [
      [0, (constraints.maxDrivingTime || 8) * 3600],
    ];
  
    const fleet_data = {
      vehicle_locations,
      vehicle_ids: [auth.currentUser.uid],
      capacities,
      vehicle_time_windows,
      // Include other fleet data if needed
    };
  
    const task_data = {
      task_locations,
      task_ids,
      demand: demands,
      task_time_windows,
      service_times,
      prizes,
      order_vehicle_match,
      // Include other task data if needed
    };
  
    const payload = {
      action: 'cuOpt_OptimizedRouting',
      data: {
        cost_waypoint_graph_data: null, // Not used in this example
        travel_time_waypoint_graph_data: null, // Not used in this example
        cost_matrix_data: {
          cost_matrix: {
            '0': costMatrix, // Assuming vehicle type '0'
          },
        },
        travel_time_matrix_data: {
          cost_matrix: {
            '0': travelTimeMatrix,
          },
        },
        fleet_data: {
          vehicle_locations,
          vehicle_ids: [auth.currentUser.uid],
          capacities: [
            [
              constraints.maxCargoWeight || 10000,
              constraints.maxCargoVolume || 100,
            ],
          ],
          vehicle_time_windows: [
            [0, (constraints.maxDrivingTime || 8) * 3600],
          ],
          // Include other fleet data if necessary
        },
        task_data: {
          task_locations,
          task_ids: deliveries.map((delivery) => delivery.id),
          demand: deliveries.map((delivery) => [
            delivery.weight || 1,
            delivery.volume || 1,
          ]),
          task_time_windows: deliveries.map((delivery) => [
            delivery.earliestStartTime || 0,
            delivery.latestEndTime || 86400,
          ]),
          service_times: deliveries.map((delivery) => delivery.serviceTime || 600),
          prizes: deliveries.map((delivery) => delivery.payment || 0),
          order_vehicle_match,
        },
        solver_config: {
          time_limit: 60,
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
      parameters: {}, // As per the sample data
      client_version: '', // Set to '' or 'custom' to skip version check
    };
  
    return payload;
  };

  const callCuOptAPI = async (payload) => {
    const invokeUrl = 'https://optimize.api.nvidia.com/v1/nvidia/cuopt';
    const fetchUrlFormat = 'https://optimize.api.nvidia.com/v1/status/';
    const headers = {
      Authorization: `Bearer ${NVIDIA_API_KEY}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    let response = await fetch(invokeUrl, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers,
    });

    // Handle the async nature of the API
    while (response.status === 202) {
      const requestId = response.headers.get('NVCF-REQID');
      const fetchUrl = `${fetchUrlFormat}${requestId}`;
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait before retrying
      response = await fetch(fetchUrl, {
        method: 'GET',
        headers,
      });
    }

    if (response.status !== 200) {
      const errBody = await response.text();
      throw new Error(`Invocation failed with status ${response.status}: ${errBody}`);
    }

    const responseBody = await response.json();
    const optimizedRoutes = parseOptimizedRoute(responseBody);
    return optimizedRoutes;
  };

  const parseOptimizedRoute = (responseBody) => {
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
        totalProfit: route.totalProfit, // Assuming API provides this
      });
    });
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
    justifyContent: 'center', // Center vertically
    alignItems: 'center', // Center horizontally
    padding: 20,
  },
  statusText: {
    marginTop: 20,
    fontSize: 18,
    textAlign: 'center',
  },
});

export default OptimizeRoutesScreen;
