import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { auth } from "../firebaseConfig";
import { getDatabase, ref, update, onValue, get } from "firebase/database";

const RouteDetailsScreen = ({ route, navigation }) => {
  const { route: routeItem } = route.params;
  const [isLoading, setIsLoading] = useState(false);
  const [fetchingDeliveries, setFetchingDeliveries] = useState(true);
  const [deliveriesInfo, setDeliveriesInfo] = useState({});
  const [currentUser, setCurrentUser] = useState(auth.currentUser);

  const db = getDatabase(); 
  const routeData = routeItem && routeItem.routes && routeItem.routes[0];

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        Alert.alert('Error', 'Please login first');
        navigation.navigate('Login');
      }
    });
    return unsubscribe;
  }, [navigation]);

  if (!routeItem || !routeData || !Array.isArray(routeData.stops)) {
    return (
      <View style={styles.center}>
        <Text>No route data available.</Text>
      </View>
    );
  }

  const stops = routeData.stops;

  // Extract coordinates
  const coordinates = stops.map((stop) => ({
    latitude: stop.coordinates.latitude,
    longitude: stop.coordinates.longitude,
  }));

  const initialRegion = {
    latitude: coordinates[0].latitude,
    longitude: coordinates[0].longitude,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  const getDeliveryId = (taskId) => {
    if (!taskId) return null;
    return taskId.startsWith('delivery-') 
      ? taskId.replace('delivery-', '') 
      : taskId.replace('delivery--', '');
  };

  // Fetch delivery data for each delivery encountered in stops
  useEffect(() => {
    const fetchDeliveriesData = async () => {
      const uniqueDeliveryIds = new Set();
      for (const stop of stops) {
        if (stop.type === "Pickup" || stop.type === "Delivery") {
          const deliveryId = getDeliveryId(stop.taskId);
          if (deliveryId) {
            uniqueDeliveryIds.add(deliveryId);
          }
        }
      }

      const deliveriesData = {};
      for (const deliveryId of uniqueDeliveryIds) {
        const deliveryRef = ref(db, `deliveries/${deliveryId}`);
        const deliverySnapshot = await get(deliveryRef);
        if (deliverySnapshot.exists()) {
          deliveriesData[deliveryId] = deliverySnapshot.val();
        } else {
          console.warn(`No delivery found with id: ${deliveryId}`);
        }
      }

      setDeliveriesInfo(deliveriesData);
      setFetchingDeliveries(false);
    };

    fetchDeliveriesData();
  }, [stops, db]);

  const requestDelivery = async () => {
    if (isLoading) return;

    try {
      setIsLoading(true);
      if (!currentUser) {
        Alert.alert("Error", "Please login first");
        return;
      }

      if (!Array.isArray(routeData.stops)) {
        throw new Error("Invalid route data");
      }

      // Check if route is already assigned
      const routeRef = ref(db, `routes/${routeItem.id}`);
      const routeSnapshot = await get(routeRef);
      if (routeSnapshot.exists() && routeSnapshot.val().status === 'assigned') {
        Alert.alert('Error', 'This route has already been assigned');
        return;
      }

      // Loop through all deliveries in the route
      const userRef = ref(db, `users/${currentUser.uid}`);
      const truckerSnapshot = await get(userRef);
      const truckerData = truckerSnapshot.val() || {};

      const batchUpdates = {};
      for (const stop of routeData.stops) {
        if (stop.type === "Delivery") {
          const deliveryId = getDeliveryId(stop.taskId);
          if (!deliveryId) continue;

          const deliveryRef = ref(db, `deliveries/${deliveryId}`);
          const deliverySnapshot = await get(deliveryRef);
          if (!deliverySnapshot.exists()) continue;

          const deliveryData = deliverySnapshot.val();
          if (!deliveryData?.companyId) continue;

          // Add request to delivery
          batchUpdates[`deliveries/${deliveryId}/requests/${currentUser.uid}`] = {
            truckerName: currentUser.displayName || currentUser.email,
            requestTime: Date.now(),
            licensePlate: truckerData.licensePlate || "Unknown",
            truckType: truckerData.truckType || "Standard", 
            rating: truckerData.rating || 4.5,
            truckerProfile: {
              email: currentUser.email,
              phone: truckerData.phone || "Not provided",
              experience: truckerData.experience || "Not provided"
            },
            routeId: routeItem.id
          };

          // Add notification
          const notificationId = Date.now();
          batchUpdates[`notifications/${deliveryData.companyId}/${notificationId}`] = {
            type: 'new_request',
            deliveryId: deliveryId,
            truckerId: currentUser.uid,
            message: `New delivery request from ${currentUser.displayName || currentUser.email}`,
            status: 'unread',
            timestamp: Date.now(),
          };
        }
      }

      if (Object.keys(batchUpdates).length > 0) {
        await update(ref(getDatabase()), batchUpdates);
        Alert.alert("Success", "Requests sent to companies");
      } else {
        Alert.alert("No Deliveries", "No deliveries were found to request.");
      }

    } catch (error) {
      console.error('Route request error:', error);
      Alert.alert('Error', error.message || 'Failed to request route');
    } finally {
      setIsLoading(false);
    }
  };

  if (fetchingDeliveries) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2F67B2"/>
        <Text>Loading delivery details...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={initialRegion}>
        {coordinates.length > 1 && (
          <Polyline
            coordinates={coordinates}
            strokeColor="#2F67B2"
            strokeWidth={3}
          />
        )}
        {stops.map((stop, index) => (
          <Marker
            key={index}
            coordinate={{
              latitude: stop.coordinates.latitude,
              longitude: stop.coordinates.longitude,
            }}
            title={`${stop.type} - ${stop.taskId}`}
            description={`Arrival: ${stop.arrivalTime}`}
            pinColor={
              stop.type === "Pickup"
                ? "green"
                : stop.type === "Delivery"
                ? "red"
                : "blue"
            }
          />
        ))}
      </MapView>
      <View style={styles.detailsHeader}>
        <Text style={styles.title}>Route Details</Text>
        <Text style={styles.subtitle}>
          Payment: {Math.round(routeItem.totalCost)}€
        </Text>
        <Text style={styles.subtitle}>Number of stops: {stops.length}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {stops.map((stop, i) => {
          const deliveryId = getDeliveryId(stop.taskId);
          const deliveryData = deliveryId ? deliveriesInfo[deliveryId] : null;

          let payment = deliveryData?.payment || 'N/A';
          let pickupAddress = deliveryData?.pickupAddress || 'Unknown';
          let deliveryAddress = deliveryData?.deliveryAddress || 'Unknown';

          return (
            <View key={i} style={styles.stopCard}>
              <Text style={styles.stopTitle}>{stop.type} - {stop.taskId}</Text>
              <Text style={styles.stopInfo}>Arrival Time: {stop.arrivalTime}</Text>
              {deliveryData && (
                <>
                  <Text style={styles.stopInfo}>Pickup: {pickupAddress}</Text>
                  <Text style={styles.stopInfo}>Delivery: {deliveryAddress}</Text>
                  <Text style={styles.stopInfo}>Payment: {payment}</Text>
                </>
              )}
            </View>
          );
        })}
        <TouchableOpacity
          style={[styles.requestButton, isLoading && styles.disabledButton]}
          onPress={requestDelivery}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Sending Request...' : 'Request Route'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { height: '40%' },
  detailsHeader: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomColor: '#ccc',
    borderBottomWidth: 1
  },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 5 },
  subtitle: { fontSize: 16, color: '#555', marginBottom: 5 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: {
    padding: 20
  },
  stopCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {width: 0, height:2},
    shadowOpacity:0.1,
    shadowRadius:4,
    elevation:3
  },
  stopTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5
  },
  stopInfo: {
    fontSize: 14,
    color: '#333',
    marginBottom: 3
  },
  requestButton: {
    backgroundColor: "#2F67B2",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
    marginBottom: 40
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight:'500'
  },
  disabledButton: {
    backgroundColor: "#A9A9A9",
  },
});

export default RouteDetailsScreen;
