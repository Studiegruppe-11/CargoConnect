// /components/RoutesScreen.js

import React, { useState, useEffect } from "react";
import { View, StyleSheet, TouchableOpacity, Text, Alert } from "react-native";
import MapView, { Polyline, Marker } from "react-native-maps";
import Icon from "react-native-vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { getDatabase, ref, onValue } from "firebase/database";
import { auth } from "../firebaseConfig";

const RoutesScreen = ({ navigation, route }) => {
  const [optimizedRoutes, setOptimizedRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const database = getDatabase();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const optimizedRoutesRef = ref(database, `optimizedRoutes/${user.uid}`);
    const unsubscribe = onValue(optimizedRoutesRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.routes) {
        setOptimizedRoutes(data.routes);
      }
    });

    // Handle selected route from SelectRouteScreen
    if (route.params?.selectedRoute) {
      setSelectedRoute(route.params.selectedRoute);
    }

    return () => unsubscribe();
  }, [route.params?.selectedRoute]);

  const handleOptimizePress = () => {
    navigation.navigate("OptimizeRoutes");
  };

  const handleViewRoutes = () => {
    navigation.navigate("SelectRoute", { optimizedRoutes });
  };

  return (
    <SafeAreaView style={styles.container}>
      <MapView style={styles.map}>
        {selectedRoute ? (
          <>
            <Polyline
              coordinates={selectedRoute.stops.map(stop => stop.coordinates)}
              strokeColor="#FF0000"
              strokeWidth={3}
            />
            {selectedRoute.stops.map((stop, index) => (
              <Marker
                key={`${stop.taskId}-${index}`}
                coordinate={stop.coordinates}
                title={`${stop.type} Stop ${index + 1}`}
                description={`Arrival: ${new Date(stop.arrivalTime * 1000).toLocaleTimeString()}`}
                pinColor={stop.type === 'Pickup' ? 'green' : 'red'}
              />
            ))}
          </>
        ) : (
          optimizedRoutes.map((r, routeIndex) => (
            <Polyline
              key={r.vehicleId}
              coordinates={r.stops.map(stop => stop.coordinates)}
              strokeColor={`#${Math.floor(Math.random()*16777215).toString(16)}`}
              strokeWidth={2}
            />
          ))
        )}
      </MapView>
  
      <View style={styles.buttonContainer}>
        {/* Rename this button from "Optimize Routes" to "Menu" */}
        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('OptimizeRoutes')}>
          <Text style={styles.buttonText}>Menu</Text>
        </TouchableOpacity>
        
        {optimizedRoutes.length > 0 && (
          <TouchableOpacity style={styles.button} onPress={handleViewRoutes}>
            <Text style={styles.buttonText}>View All Routes</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  buttonContainer: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 10,
  },
  button: {
    backgroundColor: "#2F67B2",
    padding: 15,
    borderRadius: 8,
    minWidth: 150,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default RoutesScreen;
