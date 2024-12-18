// navigation/AppNavigator.js

import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getDatabase, ref, get, onValue } from 'firebase/database';
import { SafeAreaView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

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

// Definerer stakke
const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Fælles profil-stak
function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* Skærm for profilhjem */}
      <Stack.Screen name="ProfileHome" component={ProfileScreen} />
    </Stack.Navigator>
  );
}

// Kort-stak (Trucker)
function MapStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* Skærm for korthjem */}
      <Stack.Screen name="MapHome" component={MapScreen} />
      {/* Skærm for leveringsdetaljer */}
      <Stack.Screen name="DeliveryDetails" component={DeliveryDetailsScreen} />
    </Stack.Navigator>
  );
}

// Rute-stak (Trucker)
function TruckerRoutesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* Skærm for truckermenu */}
      <Stack.Screen name="TruckerMenu" component={TruckerMenu} />
      {/* Skærm for at optimere ruter */}
      <Stack.Screen name="OptimizeRoutes" component={OptimizeRoutesScreen}/>
      {/* Skærm for liste over ruter */}
      <Stack.Screen name="RouteList" component={RouteListScreen}/>
      {/* Skærm for rutedetaljer */}
      <Stack.Screen name="RouteDetails" component={RouteDetailsScreen}/>
      {/* Skærm for aktiv rute */}
      <Stack.Screen name="ActiveRoute" component={ActiveRoute}/>
      {/* Skærm for rutehistorik */}
      <Stack.Screen name="RouteHistory" component={RouteHistory}/>
    </Stack.Navigator>
  );
}

// Firma-stak
function CompanyStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* Skærm for firmamenü */}
      <Stack.Screen name="CompanyMenu" component={CompanyMenu} />
      {/* Skærm for ny levering */}
      <Stack.Screen name="New Delivery" component={ClientInputScreen} />
      {/* Skærm for notifikationer */}
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      {/* Skærm for aktive leveringer */}
      <Stack.Screen name="Active Deliveries" component={ActiveDeliveriesScreen} />
      {/* Skærm for leveringshistorik */}
      <Stack.Screen name="Delivery History" component={DeliveryHistoryScreen} />
      {/* Skærm for redigering af leveringsdetaljer */}
      <Stack.Screen name="DeliveryDetailsEdit" component={DeliveryDetailsEdit} />
    </Stack.Navigator>
  );
}

// Auth-stak
function AuthStack() {
  return (
    <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
      {/* Skærm for login */}
      <Stack.Screen name="Login" component={LoginScreen}/>
      {/* Skærm for registrering */}
      <Stack.Screen name="Register" component={RegisterScreen}/>
    </Stack.Navigator>
  );
}

// Trucker Tab Navigator: Kort, Ruter, Profil
function TruckerTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        // Definerer ikoner for hver fane
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
      {/* Fane for kort */}
      <Tab.Screen name="Map" component={MapStack} />
      {/* Fane for ruter */}
      <Tab.Screen name="Routes" component={TruckerRoutesStack} />
      {/* Fane for profil */}
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}

// Firma Tab Navigator: Menu, Profil (kan tilføje flere om nødvendigt)
function CompanyTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        // Definerer ikoner for hver fane
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
      {/* Fane for menu */}
      <Tab.Screen name="Menu" component={CompanyStack} />
      {/* Fane for profil */}
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}

// Hovedkomponent for navigation
export default function AppNavigator() {
  const [currentUser, setCurrentUser] = useState(null); // Tilstand for den aktuelle bruger
  const [role, setRole] = useState(null); // Tilstand for brugerens rolle
  const [loading, setLoading] = useState(true); // Tilstand for indlæsning

  const auth = getAuth(); // Firebase autentificering
  const db = getDatabase(); // Firebase database

  useEffect(() => {
    // Lytter til autentificeringstilstand
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        // Opsætter realtidslytter for rolleændringer
        const roleRef = ref(db, `users/${user.uid}/role`);
        const roleUnsubscribe = onValue(roleRef, (snapshot) => {
          if (snapshot.exists()) {
            setRole(snapshot.val());
          } else {
            console.warn('Ingen rolle fundet for denne bruger.');
            setRole(null);
          }
          setLoading(false);
        });

        // Rydder lytteren op ved afmontering
        return () => {
          roleUnsubscribe(); // Rydder op i rolle-lytteren
        };
      } else {
        setCurrentUser(null);
        setRole(null);
        setLoading(false);
      }
    });

    // Rydder hovedlytteren op ved afmontering
    return () => unsubscribe();
  }, [auth, db]);

  // Viser en indlæsningsindikator, mens data hentes
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff"/>
      </SafeAreaView>
    );
  }

  // Hvis der ikke er nogen bruger, vis autentificeringsstakken
  if (!currentUser) {
    return (
      <NavigationContainer>
        <AuthStack/>
      </NavigationContainer>
    );
  }

  // Viser forskellige navigatører baseret på brugerens rolle
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
    // Viser en fejlmeddelelse, hvis der ikke er nogen rolle
    Alert.alert("Fejl", "Din konto har ingen tildelt rolle. Kontakt support.");
    return (
      <NavigationContainer>
        <AuthStack/>
      </NavigationContainer>
    );
  }
}

// Definerer styling for komponenten
const styles = StyleSheet.create({
  loadingContainer: {
    flex:1,
    justifyContent:'center',
    alignItems:'center'
  }
});
