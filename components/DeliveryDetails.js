// components/DeliveryDetails.js
// Til at vise detaljer om en levering og tilføje leveringer til en rute

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

// Skærm til visning af leveringsdetaljer
const DeliveryDetailsScreen = ({ route, navigation }) => {
  const { delivery } = route.params;
  const currentUser = auth.currentUser; // Hent den nuværende bruger

  // Funktion til at acceptere en stop på leveringen
  const acceptStop = () => {
    if (!delivery || !delivery.id) {
      Alert.alert("Fejl", "Ugyldige leveringsdata.");
      return;
    }

    // Hent brugerens aktuelle rute-ID
    const userRef = ref(database, `users/${currentUser.uid}/currentRouteId`);

    onValue(userRef, (snapshot) => {
      const currentRouteId = snapshot.val();

      if (currentRouteId) {
        const deliveryRef = ref(database, `deliveries/${delivery.id}`);
        update(deliveryRef, {
          status: "accepted",
          routeId: currentRouteId, // Tilknyt til den aktuelle rute
        })
          .then(() => {
            Alert.alert("Stop tilføjet til rute", "Du har accepteret dette stop.");
            navigation.goBack(); // Naviger tilbage til den forrige skærm
          })
          .catch((error) => {
            console.error(error);
            Alert.alert("Fejl", "Kunne ikke acceptere stop.");
          });
      } else {
        Alert.alert("Ingen Aktuel Rute", "Indstil venligst en aktuel rute først.");
      }
    });
  };

  // Vis en fejlbesked, hvis der ikke er nogen leveringsdata
  if (!delivery) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Ingen leveringsdata tilgængelig.</Text>
      </View>
    );
  }

  // Udpak leveringsdetaljer for nem adgang
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
      {/* Kortvisning med afhentnings- og leveringslokation */}
      <MapView style={styles.map}>
        {/* Marker for afhentningssted */}
        <Marker
          key={`pickup-${delivery.id}`}
          coordinate={{
            latitude: pickupLocation ? pickupLocation.latitude : 0,
            longitude: pickupLocation ? pickupLocation.longitude : 0,
          }}
          title="Afhentningssted"
          description={pickupAddress}
        />
        {/* Marker for leveringssted */}
        <Marker
          key={`delivery-${delivery.id}`}
          coordinate={{
            latitude: deliveryLocation ? deliveryLocation.latitude : 0,
            longitude: deliveryLocation ? deliveryLocation.longitude : 0,
          }}
          title="Leveringssted"
          description={delivery.deliveryAddress}
        />
        {/* Tegn en linje mellem afhentnings- og leveringssted */}
        <Polyline
          coordinates={[pickupLocation, deliveryLocation]}
          strokeColor="#1EB1FC"
          strokeWidth={3}
        />
      </MapView>
      {/* Scrollable sektion med leveringsdetaljer */}
      <ScrollView style={styles.detailsContainer}>
        <View style={styles.details}>
          <Text style={styles.title}>Leveringsdetaljer</Text>
          <Text style={styles.detailText}>
            <Text style={styles.boldText}>Detaljer:</Text> {deliveryDetails}
          </Text>
          <Text style={styles.detailText}>
            <Text style={styles.boldText}>Afhentningsadresse:</Text> {pickupAddress}
          </Text>
          <Text style={styles.detailText}>
            <Text style={styles.boldText}>Leveringsadresse:</Text>{" "}
            {delivery.deliveryAddress}
          </Text>

          {/* Information om pakkens dimensioner */}
          <Text style={styles.subtitle}>Pakkedimensioner:</Text>
          <View style={styles.dimensionRow}>
            <Text style={styles.dimensionLabel}>Vægt:</Text>
            <Text style={styles.dimensionValue}>{weight} kg</Text>
          </View>
          <View style={styles.dimensionRow}>
            <Text style={styles.dimensionLabel}>Højde:</Text>
            <Text style={styles.dimensionValue}>{height} cm</Text>
          </View>
          <View style={styles.dimensionRow}>
            <Text style={styles.dimensionLabel}>Bredde:</Text>
            <Text style={styles.dimensionValue}>{width} cm</Text>
          </View>
          <View style={styles.dimensionRow}>
            <Text style={styles.dimensionLabel}>Længde:</Text>
            <Text style={styles.dimensionValue}>{length} cm</Text>
          </View>
        </View>

        {/* Knap til at acceptere stop */}
        <View style={styles.buttonContainer}>
          <Button title="Tilføj stop til aktuel rute" onPress={acceptStop} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Styling for komponentet
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
