// /components/RouteList.js

// Til at vise en liste over brugerens genererede ruter

import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, SafeAreaView } from 'react-native';
import { getDatabase, ref, onValue } from 'firebase/database';
import { auth } from '../firebaseConfig';

const RouteListScreen = ({ navigation }) => {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Henter rutehistorik for den aktuelle bruger
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      // Håndterer tilfælde hvor der ikke er nogen bruger logget ind
      return;
    }
    const db = getDatabase();
    const routesRef = ref(db, `routes/${user.uid}`);

    // Lytter til ændringer i rute data
    const unsubscribe = onValue(routesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const routeArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setRoutes(routeArray);
      } else {
        setRoutes([]);
      }
      setLoading(false);
    });

    // Rydder lytteren op ved komponentafmontering
    return () => unsubscribe();
  }, []);

  // Håndterer valg af en rute og navigerer til RouteDetails skærmen
  const handleRouteSelect = (item) => {
    navigation.navigate('RouteDetails', { route: item });
  };

  // Viser en loader mens data hentes
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Viser en besked hvis ingen ruter findes
  if (routes.length === 0) {
    return (
      <View style={styles.center}>
        <Text>Ingen ruter fundet.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>
        <Text style={styles.title}>Dine Genererede Ruter</Text>
        <FlatList
          data={routes}
          keyExtractor={item => item.id}
          renderItem={({ item, index }) => (
            <TouchableOpacity style={styles.item} onPress={() => handleRouteSelect(item)}>
              <Text style={styles.itemTitle}>Rute {index + 1}</Text>
              <Text>Stop: {item.routes && item.routes[0] ? item.routes[0].stops.length : 0}</Text>
              <Text>Betaling: {Math.round(item.totalCost)}</Text>
            </TouchableOpacity>
          )}
        />
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
    padding: 20,
  },
  center:{
    flex:1, 
    justifyContent:'center', 
    alignItems:'center'
  },
  title:{
    fontSize:24, 
    fontWeight:'bold', 
    marginBottom:20, 
    textAlign:'center'
  },
  item:{
    backgroundColor:'#fff',
    padding:15,
    borderRadius:8,
    marginBottom:10
  },
  itemTitle:{
    fontSize:18,
    fontWeight:'bold'
  }
});

export default RouteListScreen;
