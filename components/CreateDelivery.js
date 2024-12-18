// components/CreateDelivery.js
// Komponent til oprettelse af leveringer

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import DateTimePickerModal from "react-native-modal-datetime-picker";

import axios from "axios";
import * as Location from "expo-location";
import {
  getDatabase,
  ref,
  push,
  set,
  update,
  onValue,
  off,
} from "firebase/database";
import { GEOCODE_MAPS_APIKEY, auth } from "../firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";

// Funktion til at konvertere koordinater til en adresse
const reverseGeocode = async (latitude, longitude) => {
  try {
    const response = await axios.get(`https://geocode.maps.co/reverse`, {
      params: {
        lat: latitude,
        lon: longitude,
        api_key: GEOCODE_MAPS_APIKEY,
      },
    });
    if (response.data && response.data.address) {
      const { house_number, road, postcode, city, country } =
        response.data.address;
      const formattedAddress = `${road ? road + " " : ""}${
        house_number ? house_number + ", " : ""
      }${postcode ? postcode + " " : ""}${city ? city + ", " : ""}${
        country ? country : ""
      }`.trim();
      return formattedAddress;
    } else {
      Alert.alert(
        "Reverse Geocoding Fejl",
        "Ingen adresse fundet for de angivne koordinater."
      );
      return null;
    }
  } catch (error) {
    Alert.alert(
      "Reverse Geocoding Fejl",
      "Kunne ikke konvertere koordinater til adresse."
    );
    console.error(error);
    return null;
  }
};

// Funktion til at konvertere en adresse til koordinater
const geocodeAddress = async (address) => {
  try {
    const response = await axios.get("https://geocode.maps.co/search", {
      params: {
        q: address,
        api_key: GEOCODE_MAPS_APIKEY,
      },
    });
    if (response.data && response.data.length > 0) {
      const { lat, lon } = response.data[0];
      return { latitude: parseFloat(lat), longitude: parseFloat(lon) };
    } else {
      Alert.alert(
        "Geocoding Fejl",
        "Ingen resultater fundet for den angivne adresse."
      );
      return null;
    }
  } catch (error) {
    Alert.alert("Geocoding Fejl", "Kunne ikke konvertere adresse til koordinater.");
    console.error(error);
    return null;
  }
};

// Hovedkomponent for oprettelse af leveringer
const ClientInputScreen = ({ navigation, route }) => {
  // Hent rute-ID hvis tilgængelig
  const { routeId } = route.params || {}; // Hent routeId hvis tilgængelig

  // Tilstandsvariabler for afhentningssted
  const [pickupAddress, setPickupAddress] = useState(null);
  const [pickupCoordinates, setPickupCoordinates] = useState({
    latitude: "null",
    longitude: "null",
  });
  const [mapMarker, setMapMarker] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Tilstandsvariabler for leveringssted
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryCoordinates, setDeliveryCoordinates] = useState({
    latitude: "",
    longitude: "",
  });
  const [deliveryMarker, setDeliveryMarker] = useState(null);
  const [showDeliveryMap, setShowDeliveryMap] = useState(false);
  const [isGeocodingDelivery, setIsGeocodingDelivery] = useState(false);

  // Andre tilstandsvariabler
  const [deliveryDetails, setDeliveryDetails] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [width, setWidth] = useState("");
  const [length, setLength] = useState("");
  const [payment, setPayment] = useState("");
  const [earliestStartTime, setEarliestStartTime] = useState(new Date());
  const [latestEndTime, setLatestEndTime] = useState(new Date());
  const [serviceTime, setServiceTime] = useState(10); // i minutter
  const [role, setRole] = useState(null);

  const [isEarliestStartPickerVisible, setEarliestStartPickerVisibility] =
    useState(false);
  const [isLatestEndPickerVisible, setLatestEndPickerVisibility] =
    useState(false);

  // Tilføj nye tilstandsvariabler for leveringsbegrænsninger
  const [priority, setPriority] = useState("1");
  const [isMandatory, setIsMandatory] = useState(false);
  // const [prize, setPrize] = useState("0");
  const [vehicleTypeRequired, setVehicleTypeRequired] = useState([]);

  const db = getDatabase();
  const mapRef = useRef(null); // Reference til kortet

  // Effekt hook til at håndtere brugerautentificering og rolle
  useEffect(() => {
    const authUnsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const userRoleRef = ref(db, `users/${user.uid}/role`);
        const handleRoleChange = (snapshot) => {
          const userRole = snapshot.val();
          setRole(userRole);
          if (userRole !== "company") {
            Alert.alert(
              "Adgang Nekter",
              "Du har ikke tilladelse til at få adgang til denne side."
            );
            navigation.goBack();
          }
        };
        onValue(userRoleRef, handleRoleChange); // Vedvarende lytter
        // Automatisk hent brugerens placering ved montering
        getCurrentLocation();
        // Ryd lytteren ved unmount
        return () => {
          off(userRoleRef, "value", handleRoleChange);
          authUnsubscribe();
        };
      } else {
        Alert.alert("Autentificering Krævet", "Log venligst ind først.");
        navigation.navigate("Login");
      }
    });
  }, []);

  // Funktion til at hente brugerens nuværende position
  const getCurrentLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Tilladelse Afvist",
          "Tilladelse til at få adgang til placering blev afvist."
        );
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;
      setPickupCoordinates({ latitude, longitude });
      // Reverse geocode for at få adresse
      setIsGeocoding(true); // Start indlæsning
      const address = await reverseGeocode(latitude, longitude);
      if (address) {
        setPickupAddress(address);
      }
      setIsGeocoding(false); // Stop indlæsning
      // Opdater kortmarkør
      setMapMarker({ latitude, longitude });
      // Centrer kortet på brugerens placering
      if (mapRef.current) {
        mapRef.current.animateToRegion(
          {
            latitude,
            longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          },
          1000
        );
      }
    } catch (error) {
      Alert.alert("Fejl", error.message);
    }
  };

  // Håndter tryk på kortet for afhentningssted
  const handleMapPress = (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setMapMarker({ latitude, longitude });
    setPickupCoordinates({ latitude, longitude });
    // Reverse geocode for at få adresse
    setIsGeocoding(true); // Start indlæsning
    reverseGeocode(latitude, longitude).then((address) => {
      if (address) {
        setPickupAddress(address);
      }
      setIsGeocoding(false); // Stop indlæsning
    });
    // Centrer kortet på den valgte placering
    if (mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude,
          longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        },
        1000
      );
    }
  };

  // Håndter tryk på kortet for leveringssted
  const handleDeliveryMapPress = (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setDeliveryMarker({ latitude, longitude });
    setDeliveryCoordinates({ latitude, longitude });
    setIsGeocodingDelivery(true);
    reverseGeocode(latitude, longitude).then((address) => {
      if (address) {
        setDeliveryAddress(address);
      }
      setIsGeocodingDelivery(false);
    });
  };

  // Håndter når afhentningsadressen mister fokus
  const handleAddressBlur = async () => {
    if (pickupAddress.trim() === "") return; // Gør ingenting hvis adresse er tom
    setIsGeocoding(true); // Start indlæsning
    const coords = await geocodeAddress(pickupAddress);
    if (coords) {
      setPickupCoordinates(coords);
      // Opdater kortmarkør
      setMapMarker(coords);
      // Centrer kortet på de nye koordinater
      if (mapRef.current) {
        mapRef.current.animateToRegion(
          {
            latitude: coords.latitude,
            longitude: coords.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          },
          1000
        );
      }
      // Reverse geocode for at få den formaterede adresse
      const formattedAddress = await reverseGeocode(
        coords.latitude,
        coords.longitude
      );
      if (formattedAddress) {
        setPickupAddress(formattedAddress);
      }
    }
    setIsGeocoding(false); // Stop indlæsning
  };

  // Håndter når leveringsadressen mister fokus
  const handleDeliveryAddressBlur = async () => {
    if (deliveryAddress.trim() === "") return;
    setIsGeocodingDelivery(true);
    const coords = await geocodeAddress(deliveryAddress);
    if (coords) {
      setDeliveryCoordinates(coords);
      setDeliveryMarker(coords);
    }
    setIsGeocodingDelivery(false);
  };

  // Håndter når koordinaterne mister fokus for afhentning
  const handleCoordinatesBlur = async () => {
    const { latitude, longitude } = pickupCoordinates;
    if (latitude === "" || longitude === "") return; // Gør ingenting hvis koordinater er tomme
    // Valider om latitude og longitude er gyldige tal
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lon)) {
      Alert.alert(
        "Ugyldige Koordinater",
        "Indtast venligst gyldige numeriske koordinater."
      );
      return;
    }
    setPickupCoordinates({ latitude: lat, longitude: lon });
    // Reverse geocode for at få adresse
    setIsGeocoding(true); // Start indlæsning
    const address = await reverseGeocode(lat, lon);
    if (address) {
      setPickupAddress(address);
    }
    setIsGeocoding(false); // Stop indlæsning
    // Opdater kortmarkør
    setMapMarker({ latitude: lat, longitude: lon });
    // Centrer kortet på de nye koordinater
    if (mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: lat,
          longitude: lon,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        },
        1000
      );
    }
  };

  // Håndter når koordinaterne mister fokus for levering
  const handleDeliveryCoordinatesBlur = async () => {
    const { latitude, longitude } = deliveryCoordinates;
    if (latitude === "" || longitude === "") return;
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lon)) {
      Alert.alert(
        "Ugyldige Koordinater",
        "Indtast venligst gyldige numeriske koordinater."
      );
      return;
    }
    setDeliveryCoordinates({ latitude: lat, longitude: lon });
    setDeliveryMarker({ latitude: lat, longitude: lon });
    setIsGeocodingDelivery(true);
    const address = await reverseGeocode(lat, lon);
    if (address) {
      setDeliveryAddress(address);
    }
    setIsGeocodingDelivery(false);
  };

  // Håndter tekstændring for afhentningsadresse
  const handleAddressChange = (text) => {
    setPickupAddress(text);
  };

  // Håndter tekstændring for leveringsadresse
  const handleDeliveryAddressChange = (text) => {
    setDeliveryAddress(text);
  };

  // Håndter koordinatændring for afhentning
  const handleCoordinatesChange = (text) => {
    const [lat, lon] = text.split(",").map((coord) => coord.trim());
    setPickupCoordinates({ latitude: lat, longitude: lon });
  };

  // Håndter koordinatændring for levering
  const handleDeliveryCoordinatesChange = (text) => {
    const [lat, lon] = text.split(",").map((coord) => coord.trim());
    setDeliveryCoordinates({ latitude: lat, longitude: lon });
  };

  // Opret ny levering i databasen
  const handleCreateDelivery = async () => {
    if (
      !pickupAddress ||
      !deliveryDetails ||
      !weight ||
      !height ||
      !width ||
      !length ||
      !payment ||
      !serviceTime
    ) {
      Alert.alert("Fejl", "Udfyld venligst alle felter.");
      return;
    }
    if (
      !deliveryAddress ||
      !deliveryCoordinates.latitude ||
      !deliveryCoordinates.longitude
    ) {
      Alert.alert(
        "Fejl",
        "Angiv venligst en gyldig leveringsadresse eller koordinater."
      );
      return;
    }
    // Sikre at pickupCoordinates og deliveryCoordinates har latitude og longitude
    if (
      !pickupCoordinates ||
      pickupCoordinates.latitude === undefined ||
      pickupCoordinates.longitude === undefined
    ) {
      Alert.alert("Fejl", "Ugyldige afhentningskoordinater.");
      return;
    }

    if (
      !deliveryCoordinates ||
      deliveryCoordinates.latitude === undefined ||
      deliveryCoordinates.longitude === undefined
    ) {
      Alert.alert("Fejl", "Ugyldige leveringskoordinater.");
      return;
    }
    const newDelivery = {
      pickupAddress,
      pickupLocation: pickupCoordinates,
      deliveryAddress,
      deliveryLocation: deliveryCoordinates,
      deliveryDetails,
      weight: parseFloat(weight),
      height: parseFloat(height),
      width: parseFloat(width),
      length: parseFloat(length),
      payment: parseFloat(payment),
      companyId: auth.currentUser.uid, // Tilføj denne linje
      status: 'pending',
      createdAt: Date.now()
    };
    try {
      const deliveryRef = ref(db, "deliveries");
      const newRef = push(deliveryRef); // Genererer en unik nøgle
      await set(newRef, newDelivery); // Gemmer leveringsdata under den unikke nøgle
      Alert.alert("Succes", "Levering oprettet successfully.");
      navigation.goBack(); // Naviger tilbage til den forrige skærm (MapScreen)
    } catch (error) {
      Alert.alert("Database Fejl", "Kunne ikke oprette levering.");
      console.error(error);
    }
  };

  // Returner brugergrænsefladen
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <Text style={styles.title}>Opret Levering</Text>
        {/* Hent Nuværende Placering Knap */}
        <Button title="Hent Nuværende Placering" onPress={getCurrentLocation} />
        {/* Skift Kortvisning */}
        <TouchableOpacity onPress={() => setShowMap(!showMap)}>
          <Text style={styles.toggleMapText}>
            {showMap ? "Skjul Kort" : "Vis Kort"}
          </Text>
        </TouchableOpacity>
        {showMap && (
          <MapView
            ref={mapRef}
            style={styles.map}
            onPress={handleMapPress}
            initialRegion={{
              latitude: mapMarker ? mapMarker.latitude : 55.68162938805638,
              longitude: mapMarker ? mapMarker.longitude : 12.529937312745204,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            }}
          >
            {mapMarker && (
              <Marker
                key={`selectedLocation-${mapMarker.latitude}-${mapMarker.longitude}`}
                coordinate={mapMarker}
                title="Afhentningssted"
              />
            )}
          </MapView>
        )}
        {/* Indlæsningsindikator */}
        {isGeocoding && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#0000ff" />
            <Text>Behandler Adresse...</Text>
          </View>
        )}
        {/* Afhentningsadresse */}
        <Text style={styles.label}>Afhentningsadresse</Text>
        <TextInput
          style={styles.input}
          placeholder="Indtast afhentningsadresse"
          value={pickupAddress}
          onChangeText={handleAddressChange}
          onBlur={handleAddressBlur}
        />
        {/* Afhentningskoordinater */}
        <Text style={styles.label}>Eller koordinater (Breddegrad, Længdegrad)</Text>
        <TextInput
          style={styles.input}
          placeholder="f.eks., 55.85193, 12.566337"
          value={`${pickupCoordinates.latitude}, ${pickupCoordinates.longitude}`}
          onChangeText={handleCoordinatesChange}
          onBlur={handleCoordinatesBlur}
        />
        {/* Leveringsdetaljer */}
        <Text style={styles.label}>Leveringsdetaljer</Text>
        <TextInput
          style={styles.input}
          placeholder="Indtast leveringsdetaljer"
          value={deliveryDetails}
          onChangeText={setDeliveryDetails}
        />

        {/* Leveringssektion */}
        <Text style={styles.sectionTitle}>Leveringssted</Text>
        <TouchableOpacity onPress={() => setShowDeliveryMap(!showDeliveryMap)}>
          <Text style={styles.toggleMapText}>
            {showDeliveryMap ? "Skjul Kort" : "Vis Kort"}
          </Text>
        </TouchableOpacity>
        {showDeliveryMap && (
          <MapView
            style={styles.map}
            onPress={handleDeliveryMapPress}
            initialRegion={{
              latitude: mapMarker ? mapMarker.latitude : 55.68162938805638,
              longitude: mapMarker ? mapMarker.longitude : 12.529937312745204,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            }}
          >
            {deliveryMarker && (
              <Marker coordinate={deliveryMarker} title="Leveringssted" />
            )}
          </MapView>
        )}
        {isGeocodingDelivery && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#0000ff" />
            <Text>Behandler Adresse...</Text>
          </View>
        )}
        {/* Leveringsadresse */}
        <Text style={styles.label}>Leveringsadresse</Text>
        <TextInput
          style={styles.input}
          placeholder="Indtast leveringsadresse"
          value={deliveryAddress}
          onChangeText={handleDeliveryAddressChange}
          onBlur={handleDeliveryAddressBlur}
        />
        {/* Leveringskoordinater */}
        <Text style={styles.label}>Eller koordinater (Breddegrad, Længdegrad)</Text>
        <TextInput
          style={styles.input}
          placeholder="f.eks., 55.85193, 12.566337"
          value={`${deliveryCoordinates.latitude}, ${deliveryCoordinates.longitude}`}
          onChangeText={handleDeliveryCoordinatesChange}
          onBlur={handleDeliveryCoordinatesBlur}
        />
        {/* Vægt */}
        <Text style={styles.label}>Vægt (kg)</Text>
        <TextInput
          style={styles.input}
          placeholder="Indtast vægt"
          value={weight}
          onChangeText={setWeight}
          keyboardType="numeric"
        />
        {/* Højde */}
        <Text style={styles.label}>Højde (cm)</Text>
        <TextInput
          style={styles.input}
          placeholder="Indtast højde"
          value={height}
          onChangeText={setHeight}
          keyboardType="numeric"
        />
        {/* Bredde */}
        <Text style={styles.label}>Bredde (cm)</Text>
        <TextInput
          style={styles.input}
          placeholder="Indtast bredde"
          value={width}
          onChangeText={setWidth}
          keyboardType="numeric"
        />
        {/* Længde */}
        <Text style={styles.label}>Længde (cm)</Text>
        <TextInput
          style={styles.input}
          placeholder="Indtast længde"
          value={length}
          onChangeText={setLength}
          keyboardType="numeric"
        />
        {/* Betaling */}
        <Text style={styles.label}>Betaling (€)</Text>
        <TextInput
          style={styles.input}
          placeholder="Indtast betalingsbeløb"
          value={payment}
          onChangeText={setPayment}
          keyboardType="numeric"
        /> 
        {/* Tidligste Starttidspunkt */}
        <Text style={styles.label}>Tidligste Starttidspunkt</Text>
        <TouchableOpacity onPress={() => setEarliestStartPickerVisibility(true)}>
          <View style={styles.input}>
            <Text>{earliestStartTime.toLocaleString()}</Text>
          </View>
        </TouchableOpacity>
        <DateTimePickerModal
          isVisible={isEarliestStartPickerVisible}
          mode="datetime"
          date={earliestStartTime}
          onConfirm={(date) => {
            setEarliestStartPickerVisibility(false);
            setEarliestStartTime(date);
          }}
          onCancel={() => setEarliestStartPickerVisibility(false)}
        />
        {/* Seneste Sluttidspunkt */}
        <Text style={styles.label}>Seneste Sluttidspunkt</Text>
        <TouchableOpacity onPress={() => setLatestEndPickerVisibility(true)}>
          <View style={styles.input}>
            <Text>{latestEndTime.toLocaleString()}</Text>
          </View>
        </TouchableOpacity>
        <DateTimePickerModal
          isVisible={isLatestEndPickerVisible}
          mode="datetime"
          date={latestEndTime}
          onConfirm={(date) => {
            setLatestEndPickerVisibility(false);
            setLatestEndTime(date);
          }}
          onCancel={() => setLatestEndPickerVisibility(false)}
        />
        {/* Service Tid */}
        <Text style={styles.label}>Servicetid ved Stop (minutter)</Text>
        <TextInput
          style={styles.input}
          placeholder="f.eks., 10"
          value={serviceTime !== "" ? serviceTime.toString() : ""}
          onChangeText={(text) => {
            if (text === "") {
              setServiceTime("");
            } else {
              const parsed = parseInt(text, 10);
              if (!isNaN(parsed)) {
                setServiceTime(parsed);
              } else {
                Alert.alert(
                  "Ugyldig Indtastning",
                  "Indtast venligst et gyldigt tal for servicetid."
                );
              }
            }
          }}
          keyboardType="numeric"
        />
        {/* Leveringsprioritet */}
        <Text style={styles.label}>Leveringsprioritet (1-10)</Text>
        <TextInput
          style={styles.input}
          value={priority}
          onChangeText={setPriority}
          keyboardType="numeric"
        />

        {/* Præmie/Bonus */}
        {/* <Text style={styles.label}>Præmie/Bonus (€)</Text>
        <TextInput
          style={styles.input}
          value={prize}
          onChangeText={setPrize}
          keyboardType="numeric"
        /> */}
    {/* Knap til at oprette levering */}
        <Button title="Opret Levering" onPress={handleCreateDelivery} />
      </ScrollView>
    </SafeAreaView>
  );
};

// Styling for komponenten
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    flexGrow: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: "center",
    fontWeight: "bold",
  },
  sectionTitle: {
    fontSize: 20,
    marginTop: 30,
    marginBottom: 10,
    textAlign: "center",
    fontWeight: "bold",
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
    color: "#333",
  },
  input: {
    height: 40,
    borderColor: "#ccc",
    borderWidth: 1,
    marginBottom: 20,
    paddingHorizontal: 10,
    borderRadius: 5,
    backgroundColor: "#fff",
  },
  map: {
    height: 300,
    marginBottom: 20,
    borderRadius: 10,
  },
  toggleMapText: {
    color: "#007BFF",
    textAlign: "center",
    marginBottom: 20,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.8)",
    zIndex: 2,
  },
});

export default ClientInputScreen;
