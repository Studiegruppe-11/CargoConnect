// components/DeliveryHistory.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, SafeAreaView } from 'react-native';
import { getDatabase, ref, onValue } from 'firebase/database';
import { auth } from '../firebaseConfig';

const DeliveryHistoryScreen = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const db = getDatabase();
    const historyRef = ref(db, 'deliveries');
    
    const unsubscribe = onValue(historyRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const completedDeliveries = Object.entries(data)
          .filter(([_, delivery]) => delivery.status === 'completed')
          .map(([id, delivery]) => ({
            id,
            ...delivery,
            completedAt: new Date(delivery.completedAt).toLocaleDateString()
          }));
        setHistory(completedDeliveries);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2F67B2" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>
        <Text style={styles.title}>Delivery History</Text>
        <FlatList
          data={history}
          renderItem={({ item }) => (
            <View style={styles.historyItem}>
              <Text style={styles.historyId}>Delivery #{item.id}</Text>
              <Text style={styles.historyDetails}>From: {item.pickupAddress}</Text>
              <Text style={styles.historyDetails}>To: {item.deliveryAddress}</Text>
              <Text style={styles.historyDate}>Completed: {item.completedAt}</Text>
            </View>
          )}
          keyExtractor={(item) => item.id}
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
  historyItem: {
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
  historyId: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  historyDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
  },
  historyDate: {
    fontSize: 14,
    color: '#999',
    marginTop: 5,
  },
});

export default DeliveryHistoryScreen;