// utils/locationUtils.js

// Bruges til at hente brugerens aktuelle placering og beregne afstanden mellem to geografiske punkter (bruges som fallback, hvis Google Maps API ikke er tilgængelig)

import * as Location from "expo-location";

/**
 * Funktion til at hente brugerens aktuelle placering
 * @returns {Promise<Object>} En Promise der resolver til et objekt med latitude og longitude
 */
export const fetchUserLocation = async () => {
  try {
    // Anmoder om tilladelse til at få adgang til brugerens placering
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      // Kaster en fejl hvis tilladelse ikke blev givet
      throw new Error("Permission to access location was denied");
    }
    // Henter den aktuelle placering
    const location = await Location.getCurrentPositionAsync({});
    return {
      latitude: location.coords.latitude, // Brugerens breddegrad
      longitude: location.coords.longitude, // Brugerens længdegrad
    };
  } catch (error) {
    // Logger fejlmeddelelse hvis der opstår en fejl under hentning af placering
    console.error("Location Fetch Error:", error);
    throw error; // Kaster fejlen videre
  }
};

/**
 * Funktion til at beregne afstanden mellem to geografiske punkter i kilometer
 * @param {number} lat1 - Breddegrad for det første punkt
 * @param {number} lon1 - Længdegrad for det første punkt
 * @param {number} lat2 - Breddegrad for det andet punkt
 * @param {number} lon2 - Længdegrad for det andet punkt
 * @returns {number} Afstanden mellem de to punkter i kilometer
 */
export const calcDistanceKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Jordens radius i kilometer
  const dLat = ((lat2 - lat1) * Math.PI) / 180; // Forskel i breddegrad i radianer
  const dLon = ((lon2 - lon1) * Math.PI) / 180; // Forskel i længdegrad i radianer
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); // Beregner vinklen
  return R * c; // Beregner afstanden
};
