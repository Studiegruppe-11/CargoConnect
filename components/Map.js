// components/Map.js

import React, { useEffect, useState, useRef } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  Modal,
  TextInput,
  Button,
  FlatList,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { getDatabase, ref, onValue, off } from "firebase/database";
import { auth } from "../firebaseConfig";
import Ionicons from "react-native-vector-icons/Ionicons";
import * as Location from "expo-location";

export default function MapScreen({ navigation }) {
  const [deliveries, setDeliveries] = useState([]);
  const [currentRoute, setCurrentRoute] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [role, setRole] = useState(null); // To determine if user is trucker or company
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [maxDistanceKm, setMaxDistanceKm] = useState(""); // Filter criteria
  const [routesList, setRoutesList] = useState([]); // List of user's generated routes
  const [routeSelectionModalVisible, setRouteSelectionModalVisible] =
    useState(false);

  const db = getDatabase();
  const mapRef = useRef(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Error", "User not authenticated.");
      return;
    }

    // Fetch user role
    const userRoleRef = ref(db, `users/${user.uid}/role`);
    const handleRoleChange = (snapshot) => {
      const userRole = snapshot.val();
      setRole(userRole);
      console.log("MapScreen role:", userRole);
    };
    onValue(userRoleRef, handleRoleChange);

    // Reference to user's currentRouteId
    const currentRouteIdRef = ref(db, `users/${user.uid}/currentRouteId`);
    const handleCurrentRouteIdChange = (snapshot) => {
      const currentRouteId = snapshot.val();
      if (currentRouteId) {
        fetchCurrentRoute(currentRouteId, user.uid);
      } else {
        setCurrentRoute(null);
      }
    };
    onValue(currentRouteIdRef, handleCurrentRouteIdChange);

    // Fetch all deliveries
    const deliveriesRef = ref(db, "deliveries");
    const handleDeliveriesChange = (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const formattedDeliveries = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        setDeliveries(formattedDeliveries);
      } else {
        setDeliveries([]);
      }
    };
    onValue(deliveriesRef, handleDeliveriesChange);

    // Fetch user's generated routes
    const routesRef = ref(db, `routes/${user.uid}`);
    const handleRoutesChange = (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const formattedRoutes = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
          date: new Date(data[key].timestamp).toLocaleDateString(),
        }));
        setRoutesList(formattedRoutes);
      } else {
        setRoutesList([]);
      }
    };
    onValue(routesRef, handleRoutesChange);

    fetchUserLocation();

    // Cleanup
    return () => {
      off(userRoleRef, "value", handleRoleChange);
      off(currentRouteIdRef, "value", handleCurrentRouteIdChange);
      off(deliveriesRef, "value", handleDeliveriesChange);
      off(routesRef, "value", handleRoutesChange);
    };
  }, []);

  const fetchCurrentRoute = (routeId, userId) => {
    const routeRef = ref(db, `routes/${userId}/${routeId}`);
    const handleRouteChange = (snapshot) => {
      const data = snapshot.val();
      if (data && data.coordinates) {
        const formattedCoordinates = data.coordinates.map((coord) => ({
          latitude: coord.latitude,
          longitude: coord.longitude,
        }));
        setCurrentRoute({
          id: routeId,
          ...data,
          coordinates: formattedCoordinates,
        });
      } else {
        setCurrentRoute(null);
      }
    };
    onValue(routeRef, handleRouteChange);
  };

  const fetchUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Permission to access location was denied."
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setUserLocation(coords);

      if (mapRef.current) {
        mapRef.current.animateToRegion(
          {
            ...coords,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          },
          1000
        );
      }
    } catch (error) {
      Alert.alert("Location Error", "Failed to get current location.");
      console.error("Location Fetch Error:", error);
    }
  };

  // Calculate distance between two coords in km
  const calcDistanceKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Apply filtering based on maxDistanceKm if provided
  let filteredDeliveries = deliveries;
  if (currentRoute) {
    filteredDeliveries = filteredDeliveries.filter(
      (delivery) => delivery.routeId === currentRoute.id
    );
  }

  if (maxDistanceKm && userLocation) {
    const maxDist = parseFloat(maxDistanceKm);
    if (!isNaN(maxDist)) {
      filteredDeliveries = filteredDeliveries.filter((delivery) => {
        if (delivery.pickupLocation && userLocation) {
          const dist = calcDistanceKm(
            userLocation.latitude,
            userLocation.longitude,
            delivery.pickupLocation.latitude,
            delivery.pickupLocation.longitude
          );
          return dist <= maxDist;
        }
        return true; // If no pickupLocation or userLocation, don't filter out
      });
    }
  }

  const openRouteSelectionModal = () => {
    if (routesList.length === 0) {
      Alert.alert("No Routes", "You have not generated any routes yet.");
      return;
    }
    setRouteSelectionModalVisible(true);
  };

  const selectRoute = (route) => {
    setCurrentRoute(route);
    setRouteSelectionModalVisible(false);
  };

  const clearRouteFilter = () => {
    setCurrentRoute(null);
  };

  const navigateToAddDelivery = () => {
    if (!currentRoute) {
      Alert.alert("No Current Route", "Please set a current route first.");
      return;
    }
    navigation.navigate("New Delivery", { routeId: currentRoute.id });
  };

  const centerOnUser = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          ...userLocation,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        },
        1000
      );
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        showsUserLocation={true}
        showsMyLocationButton={false}
        initialRegion={{
          latitude: userLocation ? userLocation.latitude : 55.6816,
          longitude: userLocation ? userLocation.longitude : 12.5299,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
      >
        {/* Display pickups as markers */}
        {filteredDeliveries.map((delivery) => (
          <Marker
            key={`pickup-${delivery.id}`}
            coordinate={{
              latitude: delivery.pickupLocation
                ? delivery.pickupLocation.latitude
                : 0,
              longitude: delivery.pickupLocation
                ? delivery.pickupLocation.longitude
                : 0,
            }}
            title={delivery.deliveryDetails}
            description={delivery.pickupAddress}
            onPress={() => {
              console.log(`Marker pressed for delivery ID: ${delivery.id}`);
              if (delivery) {
                navigation.navigate("DeliveryDetails", { delivery });
              } else {
                console.warn("Delivery data is undefined.");
              }
            }}
          />
        ))}

        {/* Display delivery destinations as markers */}
        {filteredDeliveries.map((delivery) => (
          <Marker
            key={`delivery-dest-${delivery.id}`}
            coordinate={{
              latitude: delivery.deliveryLocation
                ? delivery.deliveryLocation.latitude
                : 0,
              longitude: delivery.deliveryLocation
                ? delivery.deliveryLocation.longitude
                : 0,
            }}
            title={`${delivery.deliveryDetails} (Destination)`}
            description={delivery.deliveryAddress}
            onPress={() => {
              console.log(
                `Destination Marker pressed for delivery ID: ${delivery.id}`
              );
              if (delivery) {
                navigation.navigate("DeliveryDetails", { delivery });
              } else {
                console.warn("Delivery data is undefined.");
              }
            }}
          />
        ))}

        {/* Optionally, display current route as polyline */}
        {currentRoute && currentRoute.coordinates && (
          <Polyline
            coordinates={currentRoute.coordinates}
            strokeColor="#1EB1FC"
            strokeWidth={3}
          />
        )}
      </MapView>

      {role === "trucker" && (
        <>
          {/* Add Delivery Button */}
          <TouchableOpacity
            style={styles.addButton}
            onPress={navigateToAddDelivery}
          >
            <Ionicons name="add-circle" size={24} color="#fff" />
            <Text style={styles.buttonText}>Add to Route</Text>
          </TouchableOpacity>
          {/* Route Selection Button */}
          <TouchableOpacity
            style={styles.routeSelectionButton}
            onPress={openRouteSelectionModal}
          >
            <Ionicons name="git-branch" size={24} color="#fff" />
            <Text style={styles.buttonText}>
              {currentRoute ? "Change Route" : "Show My Route"}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {/* Center on User Location Button */}
      <TouchableOpacity style={styles.centerButton} onPress={centerOnUser}>
        <Ionicons name="locate" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Filter (Search) Button */}
      {role === "trucker" && (
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setFilterModalVisible(true)}
        >
          <Ionicons name="search" size={24} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Route Selection Modal */}
      <Modal
        visible={routeSelectionModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setRouteSelectionModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Select a Route</Text>
            <FlatList
              data={routesList}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.routeItem}
                  onPress={() => selectRoute(item)}
                >
                  <Text style={styles.routeItemText}>Route {item.id}</Text>
                  <Text style={styles.routeDateText}>{item.date}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text>No routes available.</Text>}
            />
            <Button
              title="Clear Filter"
              onPress={clearRouteFilter}
              color="red"
            />
            <Button
              title="Close"
              onPress={() => setRouteSelectionModalVisible(false)}
            />
          </View>
        </View>
      </Modal>

      {/* Filter Modal */}
      <Modal
        visible={filterModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Filter Deliveries</Text>
            <Text>Max Distance From Location (km)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 50"
              value={maxDistanceKm}
              onChangeText={setMaxDistanceKm}
              keyboardType="numeric"
            />
            {/*No functionality yet*/}
            <Text>Max Weight (kg)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 50"
              value={maxDistanceKm}
              keyboardType="numeric"
            />
            {/*No functionality yet*/}
            <Text>Max Length (cm)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 50"
              value={maxDistanceKm}
              keyboardType="numeric"
            />
            {/*No functionality yet*/}
            <Text>Max Width (cm)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 50"
              value={maxDistanceKm}
              keyboardType="numeric"
            />
            {/*No functionality yet*/}
            <Text>Max Height (cm)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 50"
              value={maxDistanceKm}
              keyboardType="numeric"
            />
            <View style={styles.modalButtons}>
              <Button
                title="Apply Filter"
                onPress={() => setFilterModalVisible(false)}
              />
              <View style={{ height: 10 }} />
              <Button
                title="Clear Filter"
                color="red"
                onPress={() => {
                  setMaxDistanceKm("");
                  setFilterModalVisible(false);
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  routeSelectionButton: {
    position: "absolute",
    bottom: 80,
    left: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2F67B2",
    padding: 10,
    borderRadius: 8,
    opacity: 0.9,
    zIndex: 1,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  addButton: {
    position: "absolute",
    bottom: 20,
    left: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2F67B2",
    padding: 10,
    borderRadius: 8,
    opacity: 0.9,
    zIndex: 1,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  centerButton: {
    position: "absolute",
    bottom: 20,
    right: 15,
    backgroundColor: "#2F67B2",
    padding: 10,
    borderRadius: 25,
    zIndex: 1,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  filterButton: {
    position: "absolute",
    top: 50,
    right: 15,
    backgroundColor: "#2F67B2",
    padding: 10,
    borderRadius: 25,
    zIndex: 1,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  buttonText: {
    color: "#fff",
    marginLeft: 8,
    fontSize: 16,
  },
  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 10,
    width: "80%",
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    padding: 10,
    marginVertical: 10,
    backgroundColor: "#fff",
  },
  modalButtons: {
    marginTop: 10,
  },
  routeItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderColor: "#ccc",
  },
  routeItemText: {
    fontSize: 16,
    fontWeight: "500",
  },
  routeDateText: {
    fontSize: 14,
    color: "#666",
  },
});
