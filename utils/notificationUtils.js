// utils/routeUtils.js

// Til at hente og "handle" notifikationsdata fra Firebase

import { getDatabase, ref, get } from 'firebase/database';
// Importerer Alert fra react-native for at vise meddelelser til brugeren
import { Alert } from 'react-native';

/**
 * Funktion til at hente notifikationsdata fra Firebase
 * @param {Object} notification - Notifikationsobjektet
 * @returns {Promise<Object>} En Promise der resolver til et objekt med notifikationsdata
 */
export const fetchNotificationData = async (notification) => {
  // Tjekker om notifikationen er af typen 'new_request'
  if (notification.type === 'new_request') {
    const db = getDatabase(); // Initialiserer Firebase Database
    // Referencer til den specifikke levering baseret på deliveryId
    const deliveryRef = ref(db, `deliveries/${notification.deliveryId}`);
    // Henter data for den specifikke levering
    const deliverySnapshot = await get(deliveryRef);
    const delivery = deliverySnapshot.val(); // Får værdien af leveringen
    return {
      id: notification.id, // Notifikationens ID
      ...notification, // Inkluderer alle andre notifikationsdata
      delivery, // Inkluderer leveringsdata
      timestamp: new Date(parseInt(notification.id)).toLocaleString() // Tidsstempel for notifikationen
    };
  }
  // Returnerer notifikationsdata uden leveringsinformation hvis typen ikke er 'new_request'
  return {
    id: notification.id, // Notifikationens ID
    ...notification, // Inkluderer alle andre notifikationsdata
    timestamp: new Date(parseInt(notification.id)).toLocaleString() // Tidsstempel for notifikationen
  };
};

/**
 * Funktion til at håndtere handling ved tryk på en notifikation
 * @param {Object} notification - Notifikationsobjektet
 * @param {Object} navigation - Navigation objektet til at navigere mellem skærme
 */
export const handleNotificationPress = async (notification, navigation) => {
  // Tjekker om notifikationen er af typen 'new_request'
  if (notification.type === 'new_request') {
    // Tjekker om deliveryId er til stede i notifikationen
    if (!notification.deliveryId) {
      Alert.alert('Error', 'Delivery ID is missing in the notification.'); // Viser fejlmeddelelse
      return; // Stopper funktionen hvis deliveryId mangler
    }

    const db = getDatabase(); // Initialiserer Firebase Database
    // Referencer til den specifikke levering baseret på deliveryId
    const deliveryRef = ref(db, `deliveries/${notification.deliveryId}`);
    // Henter data for den specifikke levering
    const deliverySnapshot = await get(deliveryRef);
    const delivery = deliverySnapshot.val(); // Får værdien af leveringen

    // Tjekker om leveringsdata blev fundet
    if (!delivery) {
      Alert.alert('Error', 'Delivery data not found.'); // Viser fejlmeddelelse
      return; // Stopper funktionen hvis leveringsdata ikke findes
    }

    // Tilføjer deliveryId til leveringsobjektet
    const deliveryWithId = {
      id: notification.deliveryId, // Leveringsens ID
      ...delivery // Inkluderer alle andre leveringsdata
    };

    // Navigerer til 'DeliveryDetailsEdit' skærmen med leveringsdata og eventuelle anmodninger
    navigation.navigate('DeliveryDetailsEdit', {
      delivery: deliveryWithId, // Leveringsdata med ID
      requests: delivery.requests || {}, // Eventuelle anmodninger til leveringen eller tomt objekt
    });
  }

};
