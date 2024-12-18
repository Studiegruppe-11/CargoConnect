// navigation/AppNavigator.js

import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getDatabase, ref, get } from 'firebase/database';
import { SafeAreaView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

// Import Screens
import LoginScreen from '../components/Login';
import RegisterScreen from '../components/Register';

import ClientInputScreen from '../components/CreateDelivery';
import MapScreen from '../components/Map';
import DeliveryDetailsScreen from '../components/DeliveryDetails';
import OptimizeRoutesScreen from '../components/OptimizeRoutes';
import ProfileScreen from '../components/Profile';
import RouteListScreen from '../components/RouteList';
import RouteDetailsScreen from '../components/RouteDetails';
import NotificationsScreen from '../components/Notifications';
import ActiveDeliveriesScreen from '../components/ActiveDeliveries';
import DeliveryHistoryScreen from '../components/DeliveryHistory';
import CompanyMenu from '../components/CompanyMenu';
import DeliveryDetailsEdit from '../components/DeliveryDetailsEdit';
import ActiveRoute from '../components/ActiveRoute';
import TruckerMenu from '../components/TruckerMenu';
import RouteHistory from '../components/RouteHistory';

// Stacks
const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Common Profile Stack
function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileHome" component={ProfileScreen} />
    </Stack.Navigator>
  );
}

// Map stack (Trucker)
function MapStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MapHome" component={MapScreen} />
      <Stack.Screen name="DeliveryDetails" component={DeliveryDetailsScreen} />
    </Stack.Navigator>
  );
}

// Routes stack (Trucker)
function TruckerRoutesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TruckerMenu" component={TruckerMenu} />
      <Stack.Screen name="OptimizeRoutes" component={OptimizeRoutesScreen}/>
      <Stack.Screen name="RouteList" component={RouteListScreen}/>
      <Stack.Screen name="RouteDetails" component={RouteDetailsScreen}/>
      <Stack.Screen name="ActiveRoute" component={ActiveRoute}/>
      <Stack.Screen name="RouteHistory" component={RouteHistory}/>
    </Stack.Navigator>
  );
}

// Company stack
function CompanyStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CompanyMenu" component={CompanyMenu} />
      <Stack.Screen name="New Delivery" component={ClientInputScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Active Deliveries" component={ActiveDeliveriesScreen} />
      <Stack.Screen name="Delivery History" component={DeliveryHistoryScreen} />
      <Stack.Screen name="DeliveryDetailsEdit" component={DeliveryDetailsEdit} />
    </Stack.Navigator>
  );
}

// Auth stack
function AuthStack() {
  return (
    <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen}/>
      <Stack.Screen name="Register" component={RegisterScreen}/>
    </Stack.Navigator>
  );
}

// Trucker Tab Navigator: Map, Routes, Profile
function TruckerTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown:false,
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
      })}
    >
      <Tab.Screen name="Map" component={MapStack} />
      <Tab.Screen name="Routes" component={TruckerRoutesStack} />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}

// Company Tab Navigator: Menu, Profile (you can add more if needed)
function CompanyTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown:false,
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === 'Menu') {
            iconName = 'home';
          } else if (route.name === 'Profile') {
            iconName = 'person';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Menu" component={CompanyStack} />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const [currentUser, setCurrentUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const auth = getAuth();
  const db = getDatabase();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        // Fetch user role
        const roleRef = ref(db, `users/${user.uid}/role`);
        const snapshot = await get(roleRef);
        if (snapshot.exists()) {
          setRole(snapshot.val());
        } else {
          console.warn('No role found for this user.');
          setRole(null);
        }
      } else {
        setCurrentUser(null);
        setRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [auth, db]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff"/>
      </SafeAreaView>
    );
  }

  if (!currentUser) {
    return (
      <NavigationContainer>
        <AuthStack/>
      </NavigationContainer>
    );
  }

  if (role === 'company') {
    return (
      <NavigationContainer>
        <CompanyTabNavigator/>
      </NavigationContainer>
    );
  } else if (role === 'trucker') {
    return (
      <NavigationContainer>
        <TruckerTabNavigator/>
      </NavigationContainer>
    );
  } else {
    Alert.alert("Error", "Your account has no assigned role. Contact support.");
    return (
      <NavigationContainer>
        <AuthStack/>
      </NavigationContainer>
    );
  }
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex:1,
    justifyContent:'center',
    alignItems:'center'
  }
});
