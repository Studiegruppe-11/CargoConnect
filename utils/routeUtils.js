// utils/routeUtils.js

// Funktion til at hente den aktuelle rute fra Firebase Database
// Grundet tidsmangel er det kunnne denne funktion i utilities i forbindelse med ruter, selvom flere nok skulle have været flyttet.

import { ref, onValue } from "firebase/database";

/**
 * Funktion til at hente den aktuelle rute fra Firebase Database
 * @param {string} routeId - ID for den ønskede rute
 * @param {string} userId - ID for brugeren
 * @param {Object} db - Firebase Database reference
 * @param {Function} callback - Callback funktion til at håndtere de hentede data
 */
export const fetchCurrentRoute = (routeId, userId, db, callback) => {
  // Referencer til den specifikke rute i databasen
  const routeRef = ref(db, `routes/${userId}/${routeId}`);
  
  // Lytter til ændringer i rute data
  onValue(routeRef, (snapshot) => {
    const data = snapshot.val(); // Henter data fra snapshot
    if (data && data.coordinates) {
      // Formaterer koordinaterne
      const formattedCoordinates = data.coordinates.map((coord) => ({
        latitude: coord.latitude,
        longitude: coord.longitude,
      }));
      // Kører callback med den formaterede rute
      callback({
        id: routeId,
        ...data,
        coordinates: formattedCoordinates,
      });
    } else {
      // Kører callback med null hvis data ikke findes
      callback(null);
    }
  });
};
