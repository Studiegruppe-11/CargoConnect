// components/OptimizeRoutes.js
// Til at optimere ruter og gemme optimerede ruter i Firebase

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Button,
  SafeAreaView,
  ScrollView,
} from "react-native";
import { auth } from "../firebaseConfig";
import { useIsFocused } from "@react-navigation/native";
import { onAuthStateChanged } from "firebase/auth";

// Importer funktioner fra nvApi.js
import { 
  validatePayload, 
  callCuOptAPI, 
  processOptimizedRoutes
} from '../utils/nvApi';

// Importer funktioner fra internFetcher.js
import { fetchDeliveries, fetchUserConstraints } from '../utils/internFetcher';

// Importer funktioner fra optimizationUtils.js
import { 
  prepareCuOptPayload, 
  saveOptimizedRoutes,
  requestRoute,
  handleOptimizationError
} from '../utils/optimizationUtils';

// Skærm til optimering af ruter
const OptimizeRoutesScreen = ({ navigation }) => {
  const [user, setUser] = useState(null); // Tilstand for den aktuelle bruger
  const [loading, setLoading] = useState(true); // Tilstand for indlæsningsindikator
  const [optimizationStatus, setOptimizationStatus] = useState(
    "Optimerer ruter..."
  ); // Tilstand for optimeringsstatus
  const [optimizing, setOptimizing] = useState(false); // Tilstand for optimeringsproces
  const [error, setError] = useState(null); // Tilstand for fejlbeskeder
  const isFocused = useIsFocused(); // Hook til at tjekke om skærmen er fokuseret

  const [currentUser, setCurrentUser] = useState(null); // Tilstand for den aktuelle bruger

  // Effekt hook til at håndtere brugerautentificering
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        Alert.alert('Fejl', 'Log venligst ind først');
        navigation.navigate('Login');
      }
    });
    return () => unsubscribe();
  }, []);

  console.log("OptimizeRoutesScreen monteret.");

  // Effekt hook til at hente data ved ændring af autentificering
  useEffect(() => {
    console.log("onAuthStateChanged effekt trigget.");
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log("onAuthStateChanged currentUser:", currentUser);
      if (!currentUser) {
        console.log("Ingen bruger, navigerer til Login...");
        navigation.replace("Login");
        return;
      }
      setUser(currentUser);
      try {
        if (!auth.currentUser) {
          navigation.replace("Login");
          return;
        }
        const constraints = await fetchUserConstraints(navigation); // Hent brugerens køretøjskonfigurationer
        console.log("Hentede konfigurationer ved autentificeringsændring");
        if (!constraints) {
          throw new Error("Ingen køretøjskonfigurationer fundet");
        }

        // Hent leveringer
        const deliveries = await fetchDeliveries();
        console.log("Hentede leveringer");

        // Data er klar, vis knapper
        setLoading(false);

      } catch (error) {
        handleOptimizationError(error, navigation); // Håndter fejl under optimering
        setLoading(false);
      }
    });

    return () => {
      console.log("Rydder onAuthStateChanged lytter.");
      unsubscribe();
    };
  }, [navigation]);

  // Funktion til at optimere ruter
  const optimizeRoutes = async () => {
    if (!user) {
      console.warn("optimizeRoutes kaldt men bruger er ikke autentificeret");
      throw new Error("Bruger skal være autentificeret");
    }

    if (!user || !user.uid) {
      throw new Error("Bruger er ikke autentificeret.");
    }
  
    try {
      setLoading(true);
      console.log("Starter optimeringsproces...");
  
      const constraints = await fetchUserConstraints(navigation); // Hent brugerens konfigurationer
      console.log("Hentede konfigurationer");
  
      const deliveries = await fetchDeliveries(); // Hent leveringer
      console.log("Hentede leveringer");
  
      const { payload, locations } = await prepareCuOptPayload(deliveries, constraints, user); // Forbered payload til API
      console.log("Genereret payload:", payload);
  
      validatePayload(payload); // Valider payload
      console.log("Payload validering bestået");
  
      const result = await callCuOptAPI(payload); // Kald optimerings-API
      console.log("API respons:", result);
  
      const processedRoutes = await processOptimizedRoutes(result, locations); // Behandl optimerede ruter
      console.log("Behandlede ruter:", processedRoutes);
  
      await saveOptimizedRoutes(processedRoutes, user.uid); // Gem optimerede ruter i Firebase
      console.log("Gemte optimerede ruter i Firebase", processedRoutes.routes);
  
      setLoading(false);
    } catch (error) {
      console.error("Optimeringsfejl:", error);
      handleOptimizationError(error, navigation); // Håndter fejl under optimering
      setLoading(false);
    }
  };

  // Funktion til håndtering af optimeringsknaptryk
  const handleOptimizePress = async () => {
    if (optimizing) return;

    console.log("handleOptimizePress kaldt");
    setOptimizing(true);
    setError(null);
    setOptimizationStatus("Starter optimering...");

    try {
      await optimizeRoutes(); // Kald optimeringsfunktionen
    } catch (error) {
      console.error("Optimering mislykkedes:", error.message);
      handleOptimizationError(error, navigation); // Håndter fejl
    } finally {
      setOptimizing(false);
    }
  };

  // Funktion til at anmode om en rute
  const handleRequestRoute = async (optimizedRoute) => {
    try {
      await requestRoute(optimizedRoute, currentUser); // Anmod om rute
    } catch (error) {
      console.error('Fejl ved anmodning om rute:', error);
      Alert.alert('Fejl', 'Kunne ikke anmode om rute');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>
        <ScrollView>
          {/* Titel for optimeringsskærmen */}
          <Text style={styles.title}>Generer Ruter</Text>
          
          {/* Vis indlæsningsindikator hvis data hentes */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0000ff" />
              <Text style={styles.statusText}>{optimizationStatus}</Text>
            </View>
          ) : (
            <View style={styles.contentContainer}>
              {/* Beskrivelse og knapper når optimering er klar */}
              <Text style={styles.statusText}>
                Klar til at optimere ruter. Tryk på knappen nedenfor for at starte.
              </Text>
              <View style={styles.buttonContainer}>
                {/* Knap til at starte optimering */}
                <Button 
                  title="Generer Optimerede Ruter" 
                  onPress={handleOptimizePress}
                  disabled={loading} 
                />
                <View style={styles.buttonSpacing}>
                  {/* Knap til at se genererede ruter */}
                  <Button 
                    title="Se Genererede Ruter" 
                    onPress={() => navigation.navigate('RouteList')} 
                  />
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

// Styling for komponenten (begrænset kommentarer)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  statusText: {
    fontSize: 16,
    textAlign: "center",
    marginVertical: 20,
    backgroundColor: 'transparent',
    color: "#333",
    padding: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  contentContainer: {
    flex: 1,
    padding: 20,
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 20,
  },
  buttonSpacing: {
    marginTop: 15, // Tilføjer mellemrum mellem knapperne
  },
});

export default OptimizeRoutesScreen;
