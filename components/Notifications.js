import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { getDatabase, ref, onValue, get } from 'firebase/database';
import { auth } from '../firebaseConfig';

const NotificationsScreen = ({ navigation }) => {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const db = getDatabase();
    const notificationsRef = ref(db, `notifications/${user.uid}`);

    const unsubscribe = onValue(notificationsRef, async (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const notificationList = await Promise.all(
          Object.entries(data).map(async ([id, notification]) => {
            // If it's a request notification, fetch the delivery details
            if (notification.type === 'new_request') {
              const deliveryRef = ref(db, `deliveries/${notification.deliveryId}`);
              const deliverySnap = await get(deliveryRef);
              const delivery = deliverySnap.val();
              return {
                id,
                ...notification,
                delivery,
                timestamp: new Date(parseInt(id)).toLocaleString()
              };
            }
            return {
              id,
              ...notification,
              timestamp: new Date(parseInt(id)).toLocaleString()
            };
          })
        );
        setNotifications(notificationList.sort((a, b) => b.id - a.id));
      }
    });

    return () => unsubscribe();
  }, []);

  const handleNotificationPress = async (notification) => {
    if (notification.type === 'new_request') {
      if (!notification.deliveryId) {
        Alert.alert('Error', 'Delivery ID is missing in the notification.');
        return;
      }

      const deliveryRef = ref(db, `deliveries/${notification.deliveryId}`);
      const deliverySnapshot = await get(deliveryRef);
      const delivery = deliverySnapshot.val();

      if (!delivery) {
        Alert.alert('Error', 'Delivery data not found.');
        return;
      }

      navigation.navigate('DeliveryDetailsEdit', {
        delivery,
        requests: delivery.requests || {},
      });
    }
    // Handle other notification types...
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={notifications}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[
              styles.notificationItem,
              !item.read && styles.unreadNotification
            ]}
            onPress={() => handleNotificationPress(item)}
          >
            <Text style={styles.notificationType}>
              {item.type === 'new_request' ? '🚚 New Delivery Request' : item.type}
            </Text>
            <Text style={styles.message}>{item.message}</Text>
            <Text style={styles.timestamp}>{item.timestamp}</Text>
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
    padding: 10,
    backgroundColor: '#f5f5f5'
  },
  notificationItem: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3
  },
  unreadNotification: {
    backgroundColor: '#e3f2fd'
  },
  notificationType: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#2F67B2'
  },
  message: {
    fontSize: 16,
    marginBottom: 5,
    color: '#333'
  },
  timestamp: {
    fontSize: 12,
    color: '#666'
  }
});

export default NotificationsScreen;