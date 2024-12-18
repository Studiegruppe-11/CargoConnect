// components/ActiveDeliveries.js
// Komponent til visning og håndtering af aktive leveringer

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert, SafeAreaView } from 'react-native';
import { getDatabase, ref, onValue, update } from 'firebase/database';
import { auth } from '../firebaseConfig';

// Hovedkomponent for aktive leveringer
const ActiveDeliveriesScreen = ({ navigation }) => {
  // State variabler til at holde styr på data
  const [deliveries, setDeliveries] = useState([]); // Liste af leveringer
  const [loading, setLoading] = useState(true); // Indlæsningsindikator
  const [pendingRequests, setPendingRequests] = useState({}); // Ventende anmodninger
  const [currentUser, setCurrentUser] = useState(null); // Aktuel bruger

  const db = getDatabase();

  // Effekt til at håndtere brugerautentifikation
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        Alert.alert('Fejl', 'Venligst log ind først');
        navigation.navigate('Login');
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // Effekt til at hente og lytte efter ændringer i leveringer
  useEffect(() => {
    if (!currentUser) return;

    const deliveriesRef = ref(db, 'deliveries');

    const unsubscribe = onValue(deliveriesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const companyDeliveries = Object.entries(data)
          .filter(([_, delivery]) => (
            delivery.companyId === currentUser.uid && 
            delivery.status !== 'completed'
          ))
          .map(([id, delivery]) => ({
            id,
            ...delivery
          }));
        setDeliveries(companyDeliveries);

        // Get pending requests
        const requests = Object.entries(data)
          .filter(([_, delivery]) => delivery.requests)
          .reduce((acc, [id, delivery]) => {
            acc[id] = delivery.requests;
            return acc;
          }, {});
        setPendingRequests(requests);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Funktion til at håndtere svar på anmodninger
  const handleRequestResponse = async (deliveryId, truckerId, accepted) => {
    if (!currentUser) {
      Alert.alert('Fejl', 'Venligst log ind først');
      return;
    }

    if (!deliveryId || !truckerId) {
      Alert.alert('Fejl', 'Manglende leverings- eller vognmandsoplysninger');
      return;
    }

    const db = getDatabase();
    const deliveryRef = ref(db, `deliveries/${deliveryId}`);

    try {
      if (accepted) {
        // Opdater leveringsstatus og tildel vognmand
        await update(deliveryRef, {
          status: 'assigned',
          truckerId: truckerId,
          requests: null // Clear requests after accepting
        });

        // Create notification for trucker
        const notificationRef = ref(db, `notifications/${truckerId}`);
        const notificationId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await update(notificationRef, {
          [notificationId]: {
            type: 'request_accepted',
            deliveryId: deliveryId,
            message: `Your delivery request was accepted by ${currentUser.displayName || currentUser.email}`,
            timestamp: Date.now(),
            status: 'unread'
          }
        });
      } else {
        // Fjern kun denne vognmands anmodning
        await update(deliveryRef, {
          [`requests/${truckerId}`]: null
        });

        // Notify trucker of rejection
        const notificationRef = ref(db, `notifications/${truckerId}`);
        const notificationId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await update(notificationRef, {
          [notificationId]: {
            type: 'request_rejected',
            deliveryId: deliveryId,
            message: `Your delivery request was rejected by ${currentUser.displayName || currentUser.email}`,
            timestamp: Date.now(),
            status: 'unread'
          }
        });
      }

      Alert.alert('Succes', accepted ? 'Anmodning accepteret' : 'Anmodning afvist');
      navigation.goBack();
    } catch (error) {
      console.error('Fejl ved håndtering af anmodning:', error);
      Alert.alert('Fejl', 'Kunne ikke håndtere anmodningen');
    }
  };

  // Funktion til at vise anmodningsknapper
  const renderRequestButtons = (deliveryId, requests) => {
    if (!requests) return null;

    return Object.entries(requests).map(([truckerId, request]) => (
      <View key={truckerId} style={styles.requestContainer}>
        <Text style={styles.requestText}>Request from: {request.truckerName}</Text>
        <View style={styles.requestButtons}>
          <TouchableOpacity 
            style={[styles.requestButton, styles.acceptButton]}
            onPress={() => handleRequestResponse(deliveryId, truckerId, true)}
          >
            <Text style={styles.buttonText}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.requestButton, styles.rejectButton]}
            onPress={() => handleRequestResponse(deliveryId, truckerId, false)}
          >
            <Text style={styles.buttonText}>Reject</Text>
          </TouchableOpacity>
        </View>
      </View>
    ));
  };

  // Funktion til at åbne leveringsdetaljer
  const openDeliveryDetails = (delivery) => {
    navigation.navigate('DeliveryDetailsEdit', { 
      delivery,
      requests: pendingRequests[delivery.id] || {}
    });
  };

  // Funktion til at opdatere en levering
  const handleDeliveryUpdate = async (deliveryId, updates) => {
    const db = getDatabase();
    const deliveryRef = ref(db, `deliveries/${deliveryId}`);
    
    try {
      await update(deliveryRef, updates);
      Alert.alert('Succes', 'Levering opdateret');
    } catch (error) {
      console.error('Fejl ved opdatering af levering:', error);
      Alert.alert('Fejl', 'Kunne ikke opdatere leveringen');
    }
  };

  // Vis indlæsningsindikator mens data hentes
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2F67B2" />
      </View>
    );
  }

  // Vis hovedkomponenten
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>
        <Text style={styles.title}>Aktive Leveringer</Text>
        <FlatList
          data={deliveries}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.deliveryItem}
              onPress={() => openDeliveryDetails(item)}
            >
              <Text style={styles.deliveryId}>Delivery #{item.id}</Text>
              <Text style={styles.deliveryDetails}>From: {item.pickupAddress}</Text>
              <Text style={styles.deliveryDetails}>To: {item.deliveryAddress}</Text>
              <Text style={styles.deliveryStatus}>Status: {item.status}</Text>
              {pendingRequests[item.id] && (
                <View style={styles.requestsBadge}>
                  <Text style={styles.requestsCount}>
                    {Object.keys(pendingRequests[item.id]).length} Requests
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.id}
        />
      </View>
    </SafeAreaView>
  );
};

// Styling for komponenten
const styles = StyleSheet.create({
  // Container stil
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  // Indholdscontainer stil
  contentContainer: {
    flex: 1,
    padding: 20,
  },
  // Centrer container stil
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Øvrige styles...
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  deliveryItem: {
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
  deliveryId: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  deliveryDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
  },
  deliveryStatus: {
    fontSize: 14,
    color: '#2F67B2',
    fontWeight: '500',
  },
  requestContainer: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
  },
  requestText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  requestButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  requestButton: {
    padding: 8,
    borderRadius: 5,
    width: '48%',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#f44336',
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 14,
  },
  requestsBadge: {
    marginTop: 10,
    backgroundColor: '#FFD700',
    padding: 5,
    borderRadius: 5,
  },
  requestsCount: {
    color: '#000',
    fontSize: 14,
    textAlign: 'center',
  }
});

export default ActiveDeliveriesScreen;