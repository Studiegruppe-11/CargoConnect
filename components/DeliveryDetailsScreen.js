// components/DeliveryDetailsScreen.js

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Button,
  Alert,
  ScrollView,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { ref, update, onValue } from "firebase/database";
import { database, auth } from "../firebaseConfig";

const DeliveryDetailsScreen = ({ route, navigation }) => {
  const { delivery } = route.params;

  const acceptStop = () => {
    if (!delivery || !delivery.id) {
      Alert.alert("Error", "Invalid delivery data.");
      return;
    }

    // Fetch user's current route ID
    const user = auth.currentUser;
    const userRef = ref(database, `users/${user.uid}/currentRouteId`);

    onValue(userRef, (snapshot) => {
      const currentRouteId = snapshot.val();

      if (currentRouteId) {
        const deliveryRef = ref(database, `deliveries/${delivery.id}`);
        update(deliveryRef, {
          status: "accepted",
          routeId: currentRouteId, // Associate with current route
        })
          .then(() => {
            Alert.alert("Stop added to route", "You have accepted this stop.");
            navigation.goBack(); // Navigate back to the previous screen
          })
          .catch((error) => {
            console.error(error);
            Alert.alert("Error", "Failed to accept the stop.");
          });
      } else {
        Alert.alert("No Current Route", "Please set a current route first.");
      }
    });
  };

  if (!delivery) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No delivery data available.</Text>
      </View>
    );
  }

  // Destructure delivery details for easier access
  const {
    deliveryDetails,
    pickupAddress,
    weight,
    height,
    width,
    length,
    pickupLocation,
    deliveryLocation,
  } = delivery;

  return (
    <SafeAreaView style={styles.container}>
      <MapView style={styles.map}>
        {/* Display pickup location */}
        <Marker
          key={`pickup-${delivery.id}`}
          coordinate={{
            latitude: pickupLocation ? pickupLocation.latitude : 0,
            longitude: pickupLocation ? pickupLocation.longitude : 0,
          }}
          title="Pickup Location"
          description={pickupAddress}
        />
        {/* Display delivery location */}
        <Marker
          key={`delivery-${delivery.id}`}
          coordinate={{
            latitude: deliveryLocation ? deliveryLocation.latitude : 0,
            longitude: deliveryLocation ? deliveryLocation.longitude : 0,
          }}
          title="Delivery Location"
          description={delivery.deliveryAddress}
        />
        {/* Optionally, draw a line between pickup and delivery */}
        <Polyline
          coordinates={[pickupLocation, deliveryLocation]}
          strokeColor="#1EB1FC"
          strokeWidth={3}
        />
      </MapView>
      <ScrollView style={styles.detailsContainer}>
        <View style={styles.details}>
          <Text style={styles.title}>Delivery Details</Text>
          <Text style={styles.detailText}>
            <Text style={styles.boldText}>Details:</Text> {deliveryDetails}
          </Text>
          <Text style={styles.detailText}>
            <Text style={styles.boldText}>Pickup Address:</Text> {pickupAddress}
          </Text>
          <Text style={styles.detailText}>
            <Text style={styles.boldText}>Delivery Address:</Text>{" "}
            {delivery.deliveryAddress}
          </Text>

          {/* Dimensions Information */}
          <Text style={styles.subtitle}>Package Dimensions:</Text>
          <View style={styles.dimensionRow}>
            <Text style={styles.dimensionLabel}>Weight:</Text>
            <Text style={styles.dimensionValue}>{weight} kg</Text>
          </View>
          <View style={styles.dimensionRow}>
            <Text style={styles.dimensionLabel}>Height:</Text>
            <Text style={styles.dimensionValue}>{height} cm</Text>
          </View>
          <View style={styles.dimensionRow}>
            <Text style={styles.dimensionLabel}>Width:</Text>
            <Text style={styles.dimensionValue}>{width} cm</Text>
          </View>
          <View style={styles.dimensionRow}>
            <Text style={styles.dimensionLabel}>Length:</Text>
            <Text style={styles.dimensionValue}>{length} cm</Text>
          </View>
        </View>

        {/* Accept Stop Button */}
        <View style={styles.buttonContainer}>
          <Button title="Add stop to current route" onPress={acceptStop} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  detailsContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  details: {
    marginBottom: 20,
  },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 10 },
  subtitle: { fontSize: 20, fontWeight: "600", marginTop: 15, marginBottom: 5 },
  detailText: { fontSize: 16, marginBottom: 5 },
  boldText: { fontWeight: "bold" },
  dimensionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  dimensionLabel: {
    fontSize: 16,
    color: "#555",
  },
  dimensionValue: {
    fontSize: 16,
    color: "#000",
  },
  buttonContainer: {
    marginTop: 10,
  },
  errorText: { fontSize: 18, color: "red", textAlign: "center", marginTop: 20 },
});

export default DeliveryDetailsScreen;
