// components/RouteDetails.js
// Kompnent til visning af detaljer for en rute med stop og leveringer

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

  // Lytter til autentificeringstilstanden
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        Alert.alert('Fejl', 'Log venligst ind først');
        navigation.navigate('Login');
      }
    });
    return unsubscribe;
  }, [navigation]);

  // Hvis der ikke er route data, vis en besked
  if (!routeItem || !routeData || !Array.isArray(routeData.stops)) {
    return (
      <View style={styles.center}>
        <Text>Ingen rutedata tilgængelig.</Text>
      </View>
    );
  }

  const stops = routeData.stops;

  // Udtrækker koordinater fra stop
  const coordinates = stops.map((stop) => ({
    latitude: stop.coordinates.latitude,
    longitude: stop.coordinates.longitude,
  }));

  // Initial region for kortet
  const initialRegion = {
    latitude: coordinates[0].latitude,
    longitude: coordinates[0].longitude,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  // Funktion til at få leverings-ID fra taskId
  const getDeliveryId = (taskId) => {
    if (!taskId) return null;
    return taskId.startsWith('delivery-') 
      ? taskId.replace('delivery-', '') 
      : taskId.replace('delivery--', '');
  };

  // Henter leveringsdata for hver levering i stop
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
          console.warn(`Ingen levering fundet med id: ${deliveryId}`);
        }
      }

      setDeliveriesInfo(deliveriesData);
      setFetchingDeliveries(false);
    };

    fetchDeliveriesData();
  }, [stops, db]);

  // Funktion til at anmode om levering
  const requestDelivery = async () => {
    if (isLoading) return;

    try {
      setIsLoading(true);
      if (!currentUser) {
        Alert.alert("Fejl", "Log venligst ind først");
        return;
      }

      if (!Array.isArray(routeData.stops)) {
        throw new Error("Ugyldige rutedata");
      }

      // Tjekker om ruten allerede er tildelt
      const routeRef = ref(db, `routes/${routeItem.id}`);
      const routeSnapshot = await get(routeRef);
      if (routeSnapshot.exists() && routeSnapshot.val().status === 'assigned') {
        Alert.alert('Fejl', 'Denne rute er allerede tildelt');
        return;
      }

      // Henter brugerdata
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

          // Tilføjer anmodning til leveringen
          batchUpdates[`deliveries/${deliveryId}/requests/${currentUser.uid}`] = {
            truckerName: currentUser.displayName || currentUser.email,
            requestTime: Date.now(),
            licensePlate: truckerData.licensePlate || "Ukendt",
            truckType: truckerData.truckType || "Standard", 
            rating: truckerData.rating || 4.5,
            truckerProfile: {
              email: currentUser.email,
              phone: truckerData.phone || "Ikke oplyst",
              experience: truckerData.experience || "Ikke oplyst"
            },
            routeId: routeItem.id
          };

          // Tilføjer notifikation
          const notificationId = Date.now();
          batchUpdates[`notifications/${deliveryData.companyId}/${notificationId}`] = {
            type: 'new_request',
            deliveryId: deliveryId,
            truckerId: currentUser.uid,
            message: `Ny leveringsanmodning fra ${currentUser.displayName || currentUser.email}`,
            status: 'unread',
            timestamp: Date.now(),
          };
        }
      }

      // Opdaterer databasen med batch updates
      if (Object.keys(batchUpdates).length > 0) {
        await update(ref(getDatabase()), batchUpdates);
        Alert.alert("Succes", "Anmodninger sendt til virksomheder");
      } else {
        Alert.alert("Ingen Leveringer", "Ingen leveringer blev fundet til at anmode om.");
      }

    } catch (error) {
      console.error('Fejl ved ruteanmodning:', error);
      Alert.alert('Fejl', error.message || 'Kunne ikke anmode om rute');
    } finally {
      setIsLoading(false);
    }
  };

  // Vis loader mens leveringsdata hentes
  if (fetchingDeliveries) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2F67B2"/>
        <Text>Indlæser leveringsdetaljer...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Kortvisning med rute og markører */}
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
            description={`Ankomst: ${stop.arrivalTime}`}
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
      
      {/* Header med rutens detaljer */}
      <View style={styles.detailsHeader}>
        <Text style={styles.title}>Rutedetaljer</Text>
        <Text style={styles.subtitle}>
          Betaling: {Math.round(routeItem.totalCost)}€
        </Text>
        <Text style={styles.subtitle}>Antal stop: {stops.length}</Text>
      </View>
      
      {/* Liste over stop */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {stops.map((stop, i) => {
          const deliveryId = getDeliveryId(stop.taskId);
          const deliveryData = deliveryId ? deliveriesInfo[deliveryId] : null;

          let payment = deliveryData?.payment || 'N/A';
          let pickupAddress = deliveryData?.pickupAddress || 'Ukendt';
          let deliveryAddress = deliveryData?.deliveryAddress || 'Ukendt';

          return (
            <View key={i} style={styles.stopCard}>
              <Text style={styles.stopTitle}>{stop.type} - {stop.taskId}</Text>
              <Text style={styles.stopInfo}>Ankomsttid: {stop.arrivalTime}</Text>
              {deliveryData && (
                <>
                  <Text style={styles.stopInfo}>Afhentning: {pickupAddress}</Text>
                  <Text style={styles.stopInfo}>Levering: {deliveryAddress}</Text>
                  <Text style={styles.stopInfo}>Betaling: {payment}</Text>
                </>
              )}
            </View>
          );
        })}
        
        {/* Knap til at anmode om rute */}
        <TouchableOpacity
          style={[styles.requestButton, isLoading && styles.disabledButton]}
          onPress={requestDelivery}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Sender Anmodning...' : 'Anmod om Rute'}
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
