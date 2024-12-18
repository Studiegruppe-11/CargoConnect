import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, SafeAreaView } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { getDatabase, ref, onValue } from 'firebase/database';
import { auth } from '../firebaseConfig';

const ActiveRouteScreen = () => {
  const [activeRoute, setActiveRoute] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const db = getDatabase();
    const userRouteRef = ref(db, `users/${user.uid}/currentRouteId`);
    
    const unsubscribe = onValue(userRouteRef, async (snapshot) => {
      const routeId = snapshot.val();
      if (routeId) {
        const routeRef = ref(db, `routes/${user.uid}/${routeId}`);
        onValue(routeRef, (routeSnapshot) => {
          const routeData = routeSnapshot.val();
          setActiveRoute(routeData);
          setLoading(false);
        });
      } else {
        setActiveRoute(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2F67B2" />
      </View>
    );
  }

  if (!activeRoute) {
    return (
      <View style={styles.centerContainer}>
        <Text>No active route found</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>
        <MapView 
          style={styles.map}
          initialRegion={{
            latitude: activeRoute.routes[0].stops[0].coordinates.latitude,
            longitude: activeRoute.routes[0].stops[0].coordinates.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          {activeRoute.routes[0].stops.map((stop, index) => (
            <Marker
              key={index}
              coordinate={stop.coordinates}
              title={`${stop.type} - ${stop.taskId}`}
              description={`Arrival: ${stop.arrivalTime}`}
              pinColor={stop.type === 'Pickup' ? 'green' : 'red'}
            />
          ))}
          <Polyline
            coordinates={activeRoute.routes[0].stops.map(stop => stop.coordinates)}
            strokeColor="#2F67B2"
            strokeWidth={3}
          />
        </MapView>
        
        <View style={styles.detailsContainer}>
          <Text style={styles.title}>Active Route Details</Text>
          <Text>Total stops: {activeRoute.routes[0].stops.length}</Text>
          <Text>Payment: {Math.round(activeRoute.totalCost)}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

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