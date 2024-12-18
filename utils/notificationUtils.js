import { getDatabase, ref, get } from 'firebase/database';

export const fetchNotificationData = async (notification) => {
  if (notification.type === 'new_request') {
    const db = getDatabase();
    const deliveryRef = ref(db, `deliveries/${notification.deliveryId}`);
    const deliverySnapshot = await get(deliveryRef);
    const delivery = deliverySnapshot.val();
    return {
      id: notification.id,
      ...notification,
      delivery,
      timestamp: new Date(parseInt(notification.id)).toLocaleString()
    };
  }
  return {
    id: notification.id,
    ...notification,
    timestamp: new Date(parseInt(notification.id)).toLocaleString()
  };
};

export const handleNotificationPress = async (notification, navigation) => {
  if (notification.type === 'new_request') {
    if (!notification.deliveryId) {
      Alert.alert('Error', 'Delivery ID is missing in the notification.');
      return;
    }

    const db = getDatabase();
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

};