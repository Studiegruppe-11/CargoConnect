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
          const payload = prepareCuOptPayload(deliveries, userConstraints);

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
                deliveries.push({
                  id: key,
                  ...data[key],
                });
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

  const prepareCuOptPayload = (deliveries, constraints) => {
    const task_locations = deliveries.map((delivery) => [
      delivery.location.latitude,
      delivery.location.longitude,
    ]);

    const task_ids = deliveries.map((delivery) => delivery.id);

    const demands = deliveries.map((delivery) => [
      delivery.weight || 1, // Default to 1 if weight is not provided
    ]);

    // Vehicle data
    const vehicle_ids = [auth.currentUser.uid];
    const capacities = [[constraints.maxCargoWeight || 10000]]; // Default capacity
    const vehicle_time_windows = [
      [0, (constraints.maxDrivingTime || 8) * 3600], // Convert hours to seconds
    ];
    const vehicle_locations = [
      [constraints.currentLatitude || 0, constraints.currentLongitude || 0], // Default to (0,0)
    ];

    const payload = {
      action: 'cuOpt_OptimizedRouting',
      data: {
        task_data: {
          task_locations,
          task_ids,
          demand: demands,
          time_windows: Array(task_ids.length).fill([0, 86400]), // Allowable time window (24 hours)
          service_times: Array(task_ids.length).fill(600), // 10 minutes per service
        },
        fleet_data: {
          vehicle_ids,
          capacities,
          vehicle_time_windows,
          vehicle_locations,
        },
        solver_config: {
          time_limit: 60, // in seconds
          objectives: {
            cost: 1,
            // ...other objectives
          },
          verbose_mode: false,
          error_logging: true,
        },
      },
      client_version: '',
    };
    return payload;
  };

  const callCuOptAPI = async (payload) => {
    const invokeUrl = 'https://optimize.api.nvidia.com/v1/nvidia/cuopt';
    const fetchUrlFormat = 'https://optimize.api.nvidia.com/v1/status/';
    const headers = {
      Authorization: 'Bearer $NVIDIA', // Replace with your API key
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    let response = await fetch(invokeUrl, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers,
    });

    while (response.status === 202) {
      const requestId = response.headers.get('NVCF-REQID');
      const fetchUrl = `${fetchUrlFormat}${requestId}`;
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
    // Adjust this based on the actual response structure from NVIDIA cuOpt
    const routes = responseBody.result.routes;
    const optimizedRoutes = [];

    routes.forEach((route) => {
      const coordinates = route.vehicleStops.map((stop) => ({
        latitude: stop.taskLocation[0],
        longitude: stop.taskLocation[1],
        taskId: stop.taskId,
      }));
      optimizedRoutes.push({
        vehicleId: route.vehicleId,
        coordinates,
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
