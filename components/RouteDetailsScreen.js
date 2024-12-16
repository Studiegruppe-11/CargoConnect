// /components/RouteDetailsScreen.js

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

const RouteDetailsScreen = ({ route }) => {
  const { route: routeItem } = route.params;

  if (!routeItem || !routeItem.routes || routeItem.routes.length === 0) {
    return (
      <View style={styles.center}>
        <Text>No route data available.</Text>
      </View>
    );
  }

  const routeData = routeItem.routes[0]; // Assuming one vehicle/one route for simplicity
  const stops = routeData.stops;

  // Extract coordinates
  const coordinates = stops.map(stop => ({
    latitude: stop.coordinates.latitude,
    longitude: stop.coordinates.longitude
  }));
  

  const initialRegion = {
    latitude: coordinates[0].latitude,
    longitude: coordinates[0].longitude,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  return (
    <View style={styles.container}>
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
            coordinate={{ latitude: stop.location.latitude, longitude: stop.location.longitude }}
            title={`${stop.type} - ${stop.taskId}`}
            description={`Arrival: ${stop.arrivalTime}`}
            pinColor={stop.type === 'Pickup' ? 'green' : (stop.type === 'Delivery' ? 'red' : 'blue')}
          />
        ))}
      </MapView>
      <ScrollView style={styles.detailsContainer}>
        <Text style={styles.title}>Route Details</Text>
        <Text>Total Cost (cost - prize): {Math.round(routeItem.totalCost)}</Text>
        <Text>Number of stops: {stops.length}</Text>
        {/* Add more details as needed */}
        {stops.map((stop, i) => (
          <Text key={i}>{i+1}. {stop.taskId} ({stop.type})</Text>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container:{flex:1},
  map:{flex:1},
  detailsContainer:{padding:20, backgroundColor:'#fff'},
  title:{fontSize:20, fontWeight:'bold', marginBottom:10},
  center:{flex:1,justifyContent:'center',alignItems:'center'}
});

export default RouteDetailsScreen;
