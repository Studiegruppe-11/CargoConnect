// components/DeliveryDetailsEdit.js
// Til at redigere leveringsdetaljer og håndtere truckeranmodninger

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getDatabase, ref, update } from 'firebase/database';
import { auth } from '../firebaseConfig';
import MapView, { Marker, Polyline } from 'react-native-maps';

const DeliveryDetailsEdit = ({ route, navigation }) => {
  const { delivery, requests } = route.params;
  const [activeTab, setActiveTab] = useState('details');
  const [currentUser, setCurrentUser] = useState(auth.currentUser);

  // Effect hook til at sikre at brugeren er logget ind
  useEffect(() => {
    if (!auth.currentUser) {
      Alert.alert('Fejl', 'Log venligst ind først');
      navigation.navigate('Login');
      return;
    }
    setCurrentUser(auth.currentUser);
  }, [navigation]);

  // Sikre at leveringsdata og leverings-ID er tilgængelige
  if (!delivery || !delivery.id) {
    console.error('Leveringsdata mangler:', delivery);
    Alert.alert('Fejl', 'Leveringsdata mangler.');
    return null;
  }

  const deliveryId = delivery.id;

  // Standardkoordinater for en fallback-lokation
  const defaultLocation = {
    latitude: 55.6761,
    longitude: 12.5683,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  // Hent koordinater fra leveringsdata eller brug standardkoordinater
  const pickupLocation = delivery?.pickupLocation || defaultLocation;
  const deliveryLocation = delivery?.deliveryLocation || defaultLocation;

  const initialRegion = {
    latitude: pickupLocation.latitude,
    longitude: pickupLocation.longitude,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  // Funktion til at opdatere leveringsdata i databasen
  const handleDeliveryUpdate = async (deliveryId, updates) => {
    const db = getDatabase();
    const deliveryRef = ref(db, `deliveries/${deliveryId}`);
    
    try {
      await update(deliveryRef, updates);
      Alert.alert('Succes', 'Levering opdateret succesfuldt');
    } catch (error) {
      console.error('Fejl ved opdatering af levering:', error);
      Alert.alert('Fejl', 'Kunne ikke opdatere levering');
    }
  };

  // Funktion til at håndtere respons på anmodning fra en trucker
  const handleRequestResponse = async (deliveryId, truckerId, accepted) => {
    if (!currentUser) {
      Alert.alert('Fejl', 'Log venligst ind først');
      return;
    }

    console.log('currentUser:', currentUser);
    console.log('deliveryId:', deliveryId);
    console.log('truckerId:', truckerId);

    try {
      const db = getDatabase();
      const updates = {};

      if (accepted) {
        // Opdater leveringsstatus og tilknyt trucker
        updates[`deliveries/${deliveryId}/status`] = 'assigned';
        updates[`deliveries/${deliveryId}/assignedTrucker`] = truckerId;
        updates[`deliveries/${deliveryId}/assignedAt`] = Date.now();
        
        // Fjern ventende anmodninger
        updates[`deliveries/${deliveryId}/requests`] = null;

        // Tilføj notifikation til truckeren
        const notificationId = Date.now();
        updates[`notifications/${truckerId}/${notificationId}`] = {
          type: 'request_accepted',
          deliveryId: deliveryId,
          message: `Din leveringsanmodning blev accepteret af ${currentUser.displayName || currentUser.email}`,
          timestamp: Date.now(),
          status: 'unread'
        };
      } else {
        // Fjern specific truckers anmodning
        updates[`deliveries/${deliveryId}/requests/${truckerId}`] = null;
        
        // Tilføj afvisningsnotifikation
        const notificationId = Date.now();
        updates[`notifications/${truckerId}/${notificationId}`] = {
          type: 'request_rejected',
          deliveryId: deliveryId,
          message: `Din leveringsanmodning blev afvist af ${currentUser.displayName || currentUser.email}`,
          timestamp: Date.now(),
          status: 'unread'
        };
      }

      await update(ref(db), updates);
      Alert.alert('Succes', accepted ? 'Anmodning accepteret' : 'Anmodning afvist');
      navigation.goBack();
    } catch (error) {
      console.error('Fejl ved håndtering af anmodning:', error);
      Alert.alert('Fejl', 'Kunne ikke behandle anmodningen');
    }
  };

  return (
    <View style={styles.container}>
      {/* Kortvisning med afhentnings- og leveringslokation */}
      <MapView 
        style={styles.map}
        initialRegion={initialRegion}
      >
        {/* Marker for afhentningssted */}
        {delivery?.pickupLocation && (
          <Marker
            coordinate={pickupLocation}
            title="Afhentningssted"
            description={delivery.pickupAddress}
            pinColor="#2F67B2"
          />
        )}
        {/* Marker for leveringssted */}
        {delivery?.deliveryLocation && (
          <Marker
            coordinate={deliveryLocation}
            title="Leveringssted"
            description={delivery.deliveryAddress}
            pinColor="#FF0000"
          />
        )}
        {/* Tegn en linje mellem afhentnings- og leveringssted */}
        {delivery?.pickupLocation && delivery?.deliveryLocation && (
          <Polyline
            coordinates={[pickupLocation, deliveryLocation]}
            strokeColor="#2F67B2"
            strokeWidth={3}
          />
        )}
      </MapView>

      {/* Tabknapper til skift mellem detaljer og anmodninger */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'details' && styles.activeTab]}
          onPress={() => setActiveTab('details')}
        >
          <Text style={[styles.tabText, activeTab === 'details' && styles.activeTabText]}>Detaljer</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'requests' && styles.activeTab]}
          onPress={() => setActiveTab('requests')}
        >
          <Text style={[styles.tabText, activeTab === 'requests' && styles.activeTabText]}>
            Anmodninger {requests && Object.keys(requests).length > 0 ? `(${Object.keys(requests).length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Indholdsområde afhængigt af aktiv faneblad */}
      <ScrollView style={styles.contentContainer}>
        {activeTab === 'details' ? (
          // Detaljevisning af leveringsinformation
          <View style={styles.detailsContainer}>
            <Text style={styles.sectionTitle}>Leveringsinformation</Text>
            <View style={styles.infoRow}>
              <Ionicons name="location" size={20} color="#666" />
              <Text style={styles.infoText}>Fra: {delivery.pickupAddress}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="location" size={20} color="#666" />
              <Text style={styles.infoText}>Til: {delivery.deliveryAddress}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="cube" size={20} color="#666" />
              <Text style={styles.infoText}>
                Størrelse: {delivery.length}x{delivery.width}x{delivery.height}cm
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="scale" size={20} color="#666" />
              <Text style={styles.infoText}>Vægt: {delivery.weight}kg</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="time" size={20} color="#666" />
              <Text style={styles.infoText}>Status: {delivery.status}</Text>
            </View>
          </View>
        ) : (
          // Visning af anmodninger fra truckere
          <View style={styles.requestsContainer}>
            {(!requests || Object.keys(requests).length === 0) ? (
              <Text style={styles.noRequestsText}>Ingen ventende anmodninger</Text>
            ) : (
              Object.entries(requests).map(([truckerId, request]) => (
                <View key={truckerId} style={styles.requestCard}>
                  <View style={styles.requestHeader}>
                    <Text style={styles.truckerName}>{request.truckerName}</Text>
                    <Text style={styles.requestTime}>
                      {new Date(request.requestTime).toLocaleDateString()}
                    </Text>
                  </View>
                  
                  <View style={styles.truckerInfo}>
                    <View style={styles.infoRow}>
                      <Ionicons name="car" size={20} color="#666" />
                      <Text style={styles.infoText}>Nummerplade: {request.licensePlate}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Ionicons name="cube" size={20} color="#666" />
                      <Text style={styles.infoText}>Trucktype: {request.truckType}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Ionicons name="star" size={20} color="#FFD700" />
                      <Text style={styles.infoText}>Rating: {request.rating} / 5.0</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Ionicons name="call" size={20} color="#666" />
                      <Text style={styles.infoText}>Kontakt: {request.truckerProfile.phone}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Ionicons name="time" size={20} color="#666" />
                      <Text style={styles.infoText}>Erfaring: {request.truckerProfile.experience}</Text>
                    </View>
                  </View>

                  {/* Handlingsknapper for hver anmodning */}
                  <View style={styles.actionButtons}>
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.viewRouteButton]}
                      onPress={() => navigation.navigate('RouteDetails', { 
                        routeId: request.routeId 
                      })}
                    >
                      <Text style={styles.buttonText}>Vis Rute</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.acceptButton]}
                      onPress={() => handleRequestResponse(delivery.id, truckerId, true)}
                    >
                      <Text style={styles.buttonText}>Accepter</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.rejectButton]}
                      onPress={() => handleRequestResponse(delivery.id, truckerId, false)}
                    >
                      <Text style={styles.buttonText}>Afvis</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

// Styling for komponent
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  map: {
    height: Dimensions.get('window').height * 0.4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  tabButton: {
    flex: 1,
    padding: 15,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#2F67B2',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
  },
  activeTabText: {
    color: '#2F67B2',
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  detailsContainer: {
    padding: 20,
    backgroundColor: '#fff',
    margin: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 16,
    marginLeft: 10,
    color: '#444',
  },
  requestsContainer: {
    padding: 10,
  },
  requestCard: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  truckerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  requestTime: {
    color: '#666',
  },
  truckerInfo: {
    marginBottom: 15,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 0.48,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewRouteButton: {
    backgroundColor: '#2196F3',
    flex: 1,
    marginRight: 8
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
    flex: 1,
    marginRight: 8
  },
  rejectButton: {
    backgroundColor: '#f44336',
    flex: 1
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  noRequestsText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    marginTop: 20,
  }
});

export default DeliveryDetailsEdit;
