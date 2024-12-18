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

  useEffect(() => {
    if (!auth.currentUser) {
      Alert.alert('Error', 'Please login first');
      navigation.navigate('Login');
      return;
    }
    setCurrentUser(auth.currentUser);
  }, [navigation]);

  // Ensure delivery and delivery.id are available
  if (!delivery || !delivery.id) {
    console.error('Delivery data is missing:', delivery);
    Alert.alert('Error', 'Delivery data is missing.');
    return null;
  }

  const deliveryId = delivery.id;

  // Default coordinates for fallback location
  const defaultLocation = {
    latitude: 55.6761,
    longitude: 12.5683,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  // Safely get coordinates from delivery or use default
  const pickupLocation = delivery?.pickupLocation || defaultLocation;
  const deliveryLocation = delivery?.deliveryLocation || defaultLocation;

  const initialRegion = {
    latitude: pickupLocation.latitude,
    longitude: pickupLocation.longitude,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
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

  const handleRequestResponse = async (deliveryId, truckerId, accepted) => {
    if (!currentUser) {
      Alert.alert('Error', 'Please login first');
      return;
    }

    console.log('currentUser:', currentUser);
    console.log('deliveryId:', deliveryId);
    console.log('truckerId:', truckerId);

    try {
      const db = getDatabase();
      const updates = {};

      if (accepted) {
        // Update delivery status and assign trucker
        updates[`deliveries/${deliveryId}/status`] = 'assigned';
        updates[`deliveries/${deliveryId}/assignedTrucker`] = truckerId;
        updates[`deliveries/${deliveryId}/assignedAt`] = Date.now();
        
        // Clear pending requests
        updates[`deliveries/${deliveryId}/requests`] = null;

        // Add notification for trucker
        const notificationId = Date.now();
        updates[`notifications/${truckerId}/${notificationId}`] = {
          type: 'request_accepted',
          deliveryId: deliveryId,
          message: `Your delivery request was accepted by ${currentUser.displayName || currentUser.email}`,
          timestamp: Date.now(),
          status: 'unread'
        };
      } else {
        // Remove only this trucker's request
        updates[`deliveries/${deliveryId}/requests/${truckerId}`] = null;
        
        // Add rejection notification
        const notificationId = Date.now();
        updates[`notifications/${truckerId}/${notificationId}`] = {
          type: 'request_rejected',
          deliveryId: deliveryId,
          message: `Your delivery request was rejected by ${currentUser.displayName || currentUser.email}`,
          timestamp: Date.now(),
          status: 'unread'
        };
      }

      await update(ref(db), updates);
      Alert.alert('Success', accepted ? 'Request accepted' : 'Request rejected');
      navigation.goBack();
    } catch (error) {
      console.error('Error handling request:', error);
      Alert.alert('Error', 'Failed to process the request');
    }
  };

  return (
    <View style={styles.container}>
      {/* Map Section */}
      <MapView 
        style={styles.map}
        initialRegion={initialRegion}
      >
        {/* Only render markers and polyline if we have valid locations */}
        {delivery?.pickupLocation && (
          <Marker
            coordinate={pickupLocation}
            title="Pickup Location"
            description={delivery.pickupAddress}
            pinColor="#2F67B2"
          />
        )}
        {delivery?.deliveryLocation && (
          <Marker
            coordinate={deliveryLocation}
            title="Delivery Location"
            description={delivery.deliveryAddress}
            pinColor="#FF0000"
          />
        )}
        {delivery?.pickupLocation && delivery?.deliveryLocation && (
          <Polyline
            coordinates={[pickupLocation, deliveryLocation]}
            strokeColor="#2F67B2"
            strokeWidth={3}
          />
        )}
      </MapView>

      {/* Tab Buttons */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'details' && styles.activeTab]}
          onPress={() => setActiveTab('details')}
        >
          <Text style={[styles.tabText, activeTab === 'details' && styles.activeTabText]}>Details</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'requests' && styles.activeTab]}
          onPress={() => setActiveTab('requests')}
        >
          <Text style={[styles.tabText, activeTab === 'requests' && styles.activeTabText]}>
            Requests {requests && Object.keys(requests).length > 0 ? `(${Object.keys(requests).length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content Section */}
      <ScrollView style={styles.contentContainer}>
        {activeTab === 'details' ? (
          <View style={styles.detailsContainer}>
            <Text style={styles.sectionTitle}>Delivery Information</Text>
            <View style={styles.infoRow}>
              <Ionicons name="location" size={20} color="#666" />
              <Text style={styles.infoText}>From: {delivery.pickupAddress}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="location" size={20} color="#666" />
              <Text style={styles.infoText}>To: {delivery.deliveryAddress}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="cube" size={20} color="#666" />
              <Text style={styles.infoText}>
                Size: {delivery.length}x{delivery.width}x{delivery.height}cm
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="scale" size={20} color="#666" />
              <Text style={styles.infoText}>Weight: {delivery.weight}kg</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="time" size={20} color="#666" />
              <Text style={styles.infoText}>Status: {delivery.status}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.requestsContainer}>
            {(!requests || Object.keys(requests).length === 0) ? (
              <Text style={styles.noRequestsText}>No pending requests</Text>
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
                      <Text style={styles.infoText}>License Plate: {request.licensePlate}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Ionicons name="cube" size={20} color="#666" />
                      <Text style={styles.infoText}>Truck Type: {request.truckType}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Ionicons name="star" size={20} color="#FFD700" />
                      <Text style={styles.infoText}>Rating: {request.rating} / 5.0</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Ionicons name="call" size={20} color="#666" />
                      <Text style={styles.infoText}>Contact: {request.truckerProfile.phone}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Ionicons name="time" size={20} color="#666" />
                      <Text style={styles.infoText}>Experience: {request.truckerProfile.experience}</Text>
                    </View>
                  </View>

                  <View style={styles.actionButtons}>
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.viewRouteButton]}
                      onPress={() => navigation.navigate('RouteDetails', { 
                        routeId: request.routeId 
                      })}
                    >
                      <Text style={styles.buttonText}>View Route</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.acceptButton]}
                      onPress={() => handleRequestResponse(delivery.id, truckerId, true)}
                    >
                      <Text style={styles.buttonText}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.rejectButton]}
                      onPress={() => handleRequestResponse(delivery.id, truckerId, false)}
                    >
                      <Text style={styles.buttonText}>Reject</Text>
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
