// components/ActiveRoute.js
// Aktiv rute komponent - viser brugerens aktive rute

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, SafeAreaView } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { getDatabase, ref, onValue } from 'firebase/database';
import { auth } from '../firebaseConfig';

// Hovedkomponent til visning af den aktive rute
const ActiveRouteScreen = () => {
  // State variabler til at holde styr på aktiv rute og loading status
  const [activeRoute, setActiveRoute] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Hent den nuværende bruger
    const user = auth.currentUser;
    if (!user) return;

    // Opsæt database referencer
    const db = getDatabase();
    const userRouteRef = ref(db, `users/${user.uid}/currentRouteId`);
    
    // Lyt efter ændringer i brugerens aktive rute
    const unsubscribe = onValue(userRouteRef, async (snapshot) => {
      const routeId = snapshot.val();
      if (routeId) {
        // Hvis der findes en rute-ID, hent rutedata
        const routeRef = ref(db, `routes/${user.uid}/${routeId}`);
        onValue(routeRef, (routeSnapshot) => {
          const routeData = routeSnapshot.val();
          setActiveRoute(routeData);
          setLoading(false);
        });
      } else {
        // Hvis ingen rute findes, nulstil state
        setActiveRoute(null);
        setLoading(false);
      }
    });

    // Ryd op når komponenten unmountes
    return () => unsubscribe();
  }, []);

  // Vis loading indikator mens data hentes
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2F67B2" />
      </View>
    );
  }

  // Vis besked hvis ingen aktiv rute findes
  if (!activeRoute) {
    return (
      <View style={styles.centerContainer}>
        <Text>Ingen aktiv rute fundet</Text>
      </View>
    );
  }

  // Hovedvisning med kort og rutedetaljer
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>
        {/* Kortvisning med markører og rutelinje */}
        <MapView 
          style={styles.map}
          initialRegion={{
            latitude: activeRoute.routes[0].stops[0].coordinates.latitude,
            longitude: activeRoute.routes[0].stops[0].coordinates.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          {/* Opret markører for hvert stop på ruten */}
          {activeRoute.routes[0].stops.map((stop, index) => (
            <Marker
              key={index}
              coordinate={stop.coordinates}
              title={`${stop.type} - ${stop.taskId}`}
              description={`Ankomst: ${stop.arrivalTime}`}
              pinColor={stop.type === 'Pickup' ? 'green' : 'red'}
            />
          ))}
          {/* Tegn ruten mellem alle stop */}
          <Polyline
            coordinates={activeRoute.routes[0].stops.map(stop => stop.coordinates)}
            strokeColor="#2F67B2"
            strokeWidth={3}
          />
        </MapView>
        
        {/* Visning af rutedetaljer */}
        <View style={styles.detailsContainer}>
          <Text style={styles.title}>Aktiv Rute Detaljer</Text>
          <Text>Antal stop: {activeRoute.routes[0].stops.length}</Text>
          <Text>Betaling: {Math.round(activeRoute.totalCost)}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

// Styling for komponenten
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  map: {
    flex: 1,
  },
  detailsContainer: {
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
});

export default ActiveRouteScreen;