// navigation/AppNavigator.js

import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { getDatabase, ref, onValue } from 'firebase/database';

// Import Screens
import ClientInputScreen from '../components/ClientInputScreen';
import MapScreen from '../components/MapScreen';
import TruckerInputScreen from '../components/TruckerInputScreen';
import RouteDetailsScreen from '../components/DeliveryDetailsScreen';
import RoutesScreen from '../components/RoutesScreen';
import LoginScreen from '../components/LoginScreen';
import RegisterScreen from '../components/RegisterScreen';
import OptimizeRoutesScreen from '../components/OptimizeRoutesScreen'; 
import SelectRouteScreen from '../components/SelectRouteScreen'; 
import ProfileScreen from '../components/ProfileScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Map Stack
function MapStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MapHome" component={MapScreen} />
      <Stack.Screen name="RouteDetails" component={RouteDetailsScreen} />
    </Stack.Navigator>
  );
}

// Routes Stack
function RoutesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RoutesHome" component={RoutesScreen} />
      <Stack.Screen name="RouteDetails" component={RouteDetailsScreen} />
      <Stack.Screen name="OptimizeRoutes" component={OptimizeRoutesScreen} />
      <Stack.Screen name="SelectRoute" component={SelectRouteScreen} />
    </Stack.Navigator>
  );
}

// Profile Stack
function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileHome" component={ProfileScreen} />
      {/* Add more profile-related screens here if necessary */}
    </Stack.Navigator>
  );
}

// Auth Stack
function AuthStack() {
  return (
    <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Login' }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Register' }} />
    </Stack.Navigator>
  );
}

const AppNavigator = () => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);

  useEffect(() => {
    const auth = getAuth();
    const db = getDatabase();

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userRoleRef = ref(db, `users/${currentUser.uid}/role`);
        
        // Set up a real-time listener without 'onlyOnce'
        const unsubscribeRole = onValue(userRoleRef, (snapshot) => {
          const userRole = snapshot.val();
          setRole(userRole);
        });

        // Cleanup role listener when user changes or component unmounts
        return () => {
          unsubscribeRole();
        };
      } else {
        setRole(null);
      }
    });

    return unsubscribeAuth;
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <NavigationContainer>
        {user ? (
          role === 'company' ? (
            <Tab.Navigator
              screenOptions={({ route }) => ({
                tabBarIcon: ({ color, size }) => {
                  let iconName;
                  if (route.name === 'Map') {
                    iconName = 'map';
                  } else if (route.name === 'New Delivery') {
                    iconName = 'add-circle';
                  } else if (route.name === 'Routes') {
                    iconName = 'list';
                  } else if (route.name === 'Profile') {
                    iconName = 'person';
                  }
                  return <Ionicons name={iconName} size={size} color={color} />;
                },
                headerShown: false, // Hide the headers for tabs
              })}
            >
              <Tab.Screen name="Map" component={MapStack} />
              <Tab.Screen name="New Delivery" component={ClientInputScreen} />
              <Tab.Screen name="Routes" component={RoutesStack} />
              <Tab.Screen name="Profile" component={ProfileStack} />
            </Tab.Navigator>
          ) : role === 'trucker' ? (
            <Tab.Navigator
              screenOptions={({ route }) => ({
                tabBarIcon: ({ color, size }) => {
                  let iconName;
                  if (route.name === 'Map') {
                    iconName = 'map';
                  } else if (route.name === 'Routes') {
                    iconName = 'list';
                  } else if (route.name === 'Profile') {
                    iconName = 'person';
                  }
                  return <Ionicons name={iconName} size={size} color={color} />;
                },
                headerShown: false, // Hide the headers for tabs
              })}
            >
              <Tab.Screen name="Map" component={MapStack} />
              {/* Truckers do not have access to 'New Delivery' */}
              <Tab.Screen name="Routes" component={RoutesStack} />
              <Tab.Screen name="Profile" component={ProfileStack} />
            </Tab.Navigator>
          ) : (
            // If role is not set yet
            <View style={styles.loadingContainer}>
              <Text>Loading...</Text>
            </View>
          )
        ) : (
          <AuthStack />
        )}
      </NavigationContainer>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex:1,
    justifyContent: 'center',
    alignItems: 'center',
  }
});

export default AppNavigator;
