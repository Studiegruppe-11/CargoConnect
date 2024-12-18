import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { getDatabase, ref, onValue } from 'firebase/database';
import { auth } from '../firebaseConfig';

const RouteHistoryScreen = ({ navigation }) => {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const db = getDatabase();
    const routesRef = ref(db, `routes/${user.uid}`);
    
    const unsubscribe = onValue(routesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const routeList = Object.entries(data)
          .map(([id, route]) => ({
            id,
            ...route,
            date: new Date(route.timestamp).toLocaleDateString()
          }))
          .sort((a, b) => b.timestamp - a.timestamp);
        setRoutes(routeList);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleRouteSelect = (route) => {
    navigation.navigate('RouteDetails', { route });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Route History</Text>
      <FlatList
        data={routes}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.routeItem}
            onPress={() => handleRouteSelect(item)}
          >
            <Text style={styles.routeDate}>{item.date}</Text>
            <Text>Stops: {item.routes[0].stops.length}</Text>
            <Text>Total Cost: {Math.round(item.totalCost)}</Text>
          </TouchableOpacity>
        )}
        keyExtractor={item => item.id}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
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