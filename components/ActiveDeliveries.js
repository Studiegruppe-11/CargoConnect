// components/ActiveDeliveries.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { getDatabase, ref, onValue, update } from 'firebase/database';
import { auth } from '../firebaseConfig';

const ActiveDeliveriesScreen = ({ navigation }) => {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingRequests, setPendingRequests] = useState({});
  const [currentUser, setCurrentUser] = useState(null);

  const db = getDatabase(); // Define db here

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        Alert.alert('Error', 'Please login first');
        navigation.navigate('Login');
      }
    });
    return () => unsubscribeAuth();
  }, []);

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

  const handleRequestResponse = async (deliveryId, truckerId, accepted) => {
    if (!currentUser) {
      Alert.alert('Error', 'Please login first');
      return;
    }

    if (!deliveryId || !truckerId) {
      Alert.alert('Error', 'Missing delivery or trucker information.');
      return;
    }

    const db = getDatabase();
    const deliveryRef = ref(db, `deliveries/${deliveryId}`);

    try {
      if (accepted) {
        // Update delivery status and assign trucker
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
        // Remove only this trucker's request
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

      Alert.alert('Success', accepted ? 'Request accepted' : 'Request rejected');
      navigation.goBack();
    } catch (error) {
      console.error('Error handling request:', error);
      Alert.alert('Error', 'Failed to handle request');
    }
  };

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

  const openDeliveryDetails = (delivery) => {
    navigation.navigate('DeliveryDetailsEdit', { 
      delivery,
      requests: pendingRequests[delivery.id] || {}
    });
  };

  const handleDeliveryUpdate = async (deliveryId, updates) => {
    const db = getDatabase();
    const deliveryRef = ref(db, `deliveries/${deliveryId}`);
    
    try {
      await update(deliveryRef, updates);
      Alert.alert('Success', 'Delivery updated successfully');
    } catch (error) {
      console.error('Error updating delivery:', error);
      Alert.alert('Error', 'Failed to update delivery');
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2F67B2" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Active Deliveries</Text>
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
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
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