// components/Map.js
// Til at vise kort og leveringer

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
import { fetchUserLocation, calcDistanceKm } from '../utils/locationUtils';
import { fetchCurrentRoute } from '../utils/routeUtils';

// Skærm til visning af kort og håndtering af leveringer
export default function MapScreen({ navigation }) {
  const [deliveries, setDeliveries] = useState([]); // Tilstand for leveringsdata
  const [currentRoute, setCurrentRoute] = useState(null); // Tilstand for den aktuelle rute
  const [userLocation, setUserLocation] = useState(null); // Tilstand for brugerens placering
  const [role, setRole] = useState(null); // Tilstand for brugerens rolle
  const [filterModalVisible, setFilterModalVisible] = useState(false); // Tilstand for filter-modal
  const [maxDistanceKm, setMaxDistanceKm] = useState(""); // Tilstand for maksimal afstandsfilter
  const [routesList, setRoutesList] = useState([]); // Tilstand for liste over ruter
  const [routeSelectionModalVisible, setRouteSelectionModalVisible] = useState(false); // Tilstand for rutevalg-modal

  const db = getDatabase();
  const mapRef = useRef(null); // Reference til kortet

  // Effekt hook til at hente data og lytte til ændringer
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Fejl", "Bruger ikke autentificeret.");
      return;
    }

    // Hent brugerens rolle
    const userRoleRef = ref(db, `users/${user.uid}/role`);
    const handleRoleChange = (snapshot) => {
      const userRole = snapshot.val();
      setRole(userRole);
      console.log("MapScreen rolle:", userRole);
    };
    onValue(userRoleRef, handleRoleChange);

    // Reference til brugerens aktuelle rute-ID
    const currentRouteIdRef = ref(db, `users/${user.uid}/currentRouteId`);
    const handleCurrentRouteIdChange = (snapshot) => {
      const currentRouteId = snapshot.val();
      if (currentRouteId) {
        fetchCurrentRoute(currentRouteId, user.uid, db, setCurrentRoute);
      } else {
        setCurrentRoute(null);
      }
    };
    onValue(currentRouteIdRef, handleCurrentRouteIdChange);

    // Hent alle leveringer
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

    // Hent brugerens genererede ruter
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

    // Hent brugerens nuværende placering
    fetchUserLocation();

    // Ryd lyttere ved unmount
    return () => {
      off(userRoleRef, "value", handleRoleChange);
      off(currentRouteIdRef, "value", handleCurrentRouteIdChange);
      off(deliveriesRef, "value", handleDeliveriesChange);
      off(routesRef, "value", handleRoutesChange);
    };
  }, []);

  // Funktion til at centrere kortet på brugerens placering
  const centerOnUser = async () => {
    try {
      const coords = await fetchUserLocation();
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
      Alert.alert("Placering Fejl", "Kunne ikke hente nuværende placering.");
    }
  };

  // Anvend filtrering baseret på maksimal afstand, hvis angivet
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
        return true; // Hvis ingen afhentningsplacering eller brugerplacering, filtrer ikke ud
      });
    }
  }

  // Funktion til at åbne modal for rutevalg
  const openRouteSelectionModal = () => {
    if (routesList.length === 0) {
      Alert.alert("Ingen Ruter", "Du har ikke genereret nogen ruter endnu.");
      return;
    }
    setRouteSelectionModalVisible(true);
  };

  // Funktion til at vælge en rute
  const selectRoute = (route) => {
    setCurrentRoute(route);
    setRouteSelectionModalVisible(false);
  };

  // Funktion til at rydde rutefilter
  const clearRouteFilter = () => {
    setCurrentRoute(null);
  };

  // Naviger til skærmen for at tilføje en ny levering
  const navigateToAddDelivery = () => {
    if (!currentRoute) {
      Alert.alert("Ingen Aktuel Rute", "Indstil venligst en aktuel rute først.");
      return;
    }
    navigation.navigate("New Delivery", { routeId: currentRoute.id });
  };

  return (
    <View style={styles.container}>
      {/* Kortvisning med leveringsmarkører og rute */}
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
        {/* Vis afhentningssteder som markører */}
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
              console.log(`Markør trykket for levering ID: ${delivery.id}`);
              if (delivery) {
                navigation.navigate("DeliveryDetails", { delivery });
              } else {
                console.warn("Leveringsdata er ikke defineret.");
              }
            }}
          />
        ))}

        {/* Vis leveringsdestinationer som markører */}
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
                `Destination Markør trykket for levering ID: ${delivery.id}`
              );
              if (delivery) {
                navigation.navigate("DeliveryDetails", { delivery });
              } else {
                console.warn("Leveringsdata er ikke defineret.");
              }
            }}
          />
        ))}

        {/* Vis den aktuelle rute som en linje på kortet */}
        {currentRoute && currentRoute.coordinates && (
          <Polyline
            coordinates={currentRoute.coordinates}
            strokeColor="#1EB1FC"
            strokeWidth={3}
          />
        )}
      </MapView>

      {/* Kun for truckere: Knap til at tilføje en levering */}
      {role === "trucker" && (
        <>
          {/* Knap til at tilføje levering til rute */}
          <TouchableOpacity
            style={styles.addButton}
            onPress={navigateToAddDelivery}
          >
            <Ionicons name="add-circle" size={24} color="#fff" />
            <Text style={styles.buttonText}>Tilføj til Rute</Text>
          </TouchableOpacity>
          
          {/* Knap til at vælge eller ændre rute */}
          <TouchableOpacity
            style={styles.routeSelectionButton}
            onPress={openRouteSelectionModal}
          >
            <Ionicons name="git-branch" size={24} color="#fff" />
            <Text style={styles.buttonText}>
              {currentRoute ? "Skift Rute" : "Vis Min Rute"}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {/* Knap til at centrere kortet på brugerens placering */}
      <TouchableOpacity style={styles.centerButton} onPress={centerOnUser}>
        <Ionicons name="locate" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Kun for truckere: Knap til at åbne filtermodal */}
      {role === "trucker" && (
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setFilterModalVisible(true)}
        >
          <Ionicons name="search" size={24} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Modal til valg af rute */}
      <Modal
        visible={routeSelectionModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setRouteSelectionModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Vælg en Rute</Text>
            {/* Liste over ruter til valg */}
            <FlatList
              data={routesList}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.routeItem}
                  onPress={() => selectRoute(item)}
                >
                  <Text style={styles.routeItemText}>Rute {item.id}</Text>
                  <Text style={styles.routeDateText}>{item.date}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text>Ingen ruter tilgængelige.</Text>}
            />
            {/* Knap til at rydde filter */}
            <Button
              title="Ryd Filter"
              onPress={clearRouteFilter}
              color="red"
            />
            {/* Knap til at lukke modal */}
            <Button
              title="Luk"
              onPress={() => setRouteSelectionModalVisible(false)}
            />
          </View>
        </View>
      </Modal>

      {/* Modal til filtrering af leveringer */}
      <Modal
        visible={filterModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Filtrer Leveringer</Text>
            <Text>Maksimal Afstand Fra Placering (km)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="f.eks. 50"
              value={maxDistanceKm}
              onChangeText={setMaxDistanceKm}
              keyboardType="numeric"
            />
            {/* Funktionalitet til filtrering af vægt og dimensioner kan tilføjes her */}
            <Text>Maksimal Vægt (kg)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="f.eks. 50"
              value={maxDistanceKm}
              keyboardType="numeric"
            />
            <Text>Maksimal Længde (cm)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="f.eks. 50"
              value={maxDistanceKm}
              keyboardType="numeric"
            />
            <Text>Maksimal Bredde (cm)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="f.eks. 50"
              value={maxDistanceKm}
              keyboardType="numeric"
            />
            <Text>Maksimal Højde (cm)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="f.eks. 50"
              value={maxDistanceKm}
              keyboardType="numeric"
            />
            <View style={styles.modalButtons}>
              {/* Knap til at anvende filter */}
              <Button
                title="Anvend Filter"
                onPress={() => setFilterModalVisible(false)}
              />
              <View style={{ height: 10 }} />
              {/* Knap til at rydde filter */}
              <Button
                title="Ryd Filter"
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

// Styling for komponenten
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
