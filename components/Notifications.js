// components/Notifications.js
// Til at vise brugerens notifikationer og håndtere tryk på notifikationer

import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, SafeAreaView } from 'react-native';
import { getDatabase, ref, onValue } from 'firebase/database';
import { auth } from '../firebaseConfig';
import { fetchNotificationData, handleNotificationPress } from '../utils/notificationUtils';

// Skærm til visning af brugerens notifikationer
const NotificationsScreen = ({ navigation }) => {
  const [notifications, setNotifications] = useState([]); // Tilstand for listen af notifikationer

  // Effekt hook til at hente notifikationer fra databasen ved komponentens montering
  useEffect(() => {
    const user = auth.currentUser; // Hent den aktuelle bruger
    if (!user) return; // Stop hvis brugeren ikke er logget ind

    const db = getDatabase(); // Initialiser Firebase database
    const notificationsRef = ref(db, `notifications/${user.uid}`); // Reference til brugerens notifikationer

    // Lyt til ændringer i notifikationsdata
    const unsubscribe = onValue(notificationsRef, async (snapshot) => {
      const data = snapshot.val(); // Hent notifikationsdata
      if (data) {
        // Hent og formater hver notifikation
        const notificationList = await Promise.all(
          Object.entries(data).map(async ([id, notification]) => {
            return await fetchNotificationData({ id, ...notification });
          })
        );
        // Sorter notifikationer efter ID i faldende rækkefølge
        setNotifications(notificationList.sort((a, b) => b.id - a.id));
      }
    });

    // Ryd lytteren ved unmount for at undgå hukommelseslækager
    return () => unsubscribe();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>
        {/* Titel for notifikationsskærmen */}
        <Text style={styles.title}>Notifikationer</Text>
        
        {/* Liste over notifikationer */}
        <FlatList
          data={notifications} // Data kilde til listen
          renderItem={({ item }) => (
            // Hver notifikation er en trykbar komponent
            <TouchableOpacity 
              style={[
                styles.notificationItem,
                !item.read && styles.unreadNotification // Anvend anden baggrundsfarve hvis notifikationen ikke er læst
              ]}
              onPress={() => handleNotificationPress(item, navigation)} // Håndter tryk på notifikationen
            >
              {/* Vis type af notifikation */}
              <Text style={styles.notificationType}>
                {item.type === 'new_request' ? '🚚 Ny Leveringsanmodning' : item.type}
              </Text>
              
              {/* Vis besked for notifikationen */}
              <Text style={styles.message}>{item.message}</Text>
              
              {/* Vis tidsstempel for notifikationen */}
              <Text style={styles.timestamp}>{item.timestamp}</Text>
            </TouchableOpacity>
          )}
          keyExtractor={item => item.id} // Unik nøgle for hver notifikation
        />
      </View>
    </SafeAreaView>
  );
};

// Styling for komponent
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    flex: 1,
    padding: 20,
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
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333'
  }
});

export default NotificationsScreen;