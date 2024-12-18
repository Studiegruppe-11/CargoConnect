// components/RouteHistory.js

// Til at vise rutehistorik

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { getDatabase, ref, onValue } from 'firebase/database';
import { auth } from '../firebaseConfig';

// Skærm til visning af rutehistorik
const RouteHistoryScreen = ({ navigation }) => {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Henter rutehistorik for den nuværende bruger
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const db = getDatabase();
    const routesRef = ref(db, `routes/${user.uid}`);

    // Lytter til ændringer i rute data
    const unsubscribe = onValue(routesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const routeList = Object.entries(data)
          .map(([id, route]) => ({
            id,
            ...route,
            date: new Date(route.timestamp).toLocaleDateString(),
          }))
          .sort((a, b) => b.timestamp - a.timestamp); // Sorter ruter efter dato
        setRoutes(routeList);
      } else {
        setRoutes([]);
      }
      setLoading(false);
    });

    // Rydder lytteren op ved afmontering
    return () => unsubscribe();
  }, []);

  // Håndterer valg af en rute og navigerer til RouteDetails
  const handleRouteSelect = (route) => {
    navigation.navigate('RouteDetails', { route });
  };

  // Viser en loader mens data hentes
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2F67B2" />
        </View>
      </SafeAreaView>
    );
  }

  // Viser en besked hvis ingen ruter findes
  if (routes.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text>Ingen ruter fundet.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Viser rutehistorik
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>
        <Text style={styles.title}>Rutehistorik</Text>
        <FlatList
          data={routes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.routeItem}
              onPress={() => handleRouteSelect(item)}
            >
              <Text style={styles.routeDate}>{item.date}</Text>
              <Text>
                Stop: {item.routes && item.routes[0] && item.routes[0].stops
                  ? item.routes[0].stops.length
                  : 'N/A'}
              </Text>
              <Text>
                Samlet Omkostning: {item.totalCost !== undefined
                  ? Math.round(item.totalCost)
                  : 'N/A'}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </SafeAreaView>
  );
};

// Styling for komponent
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    flex: 1,
    padding: 20,
  },
  center: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  routeItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  routeDate: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
});

export default RouteHistoryScreen;
