// utils/routeMatrix.js

// Brug af Google Maps Distance Matrix API til at beregne afstande og varigheder mellem lokationer som matricer
// Fallback er en haversine funktion til at beregne afstand i fugleflugt.
// Den rammer rimelig hurtigt vores ratelimits, da vi ellers løber tør for credits, så det er muligt den kører fallback efter et par optimeringer.

import { GOOGLE_MAPS_API_KEY } from "../firebaseConfig";
import { getDatabase, ref, get, set } from "firebase/database";

// Definer maksimal størrelse for API anmodningsbatches pr 
const BATCH_SIZE = 10;

// Hjælpefunktion til at opdele et array i mindre stykker af bestemt størrelse
const chunk = (array, size) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

// Hent tidligere cached rutematrix data for en specifik bruger
export const getCachedMatrix = async (userId) => {
  const db = getDatabase();
  const matrixRef = ref(db, `routeMatrix/${userId}`);
  const snapshot = await get(matrixRef);
  return snapshot.exists() ? snapshot.val() : null;
};

// Gem rutematrix data til Firebase for en specifik bruger
export const saveCachedMatrix = async (userId, matrixData) => {
  const db = getDatabase();
  const matrixRef = ref(db, `routeMatrix/${userId}`);
  await set(matrixRef, matrixData);
};

// Sammenlign gamle og nye lokationssæt for at bestemme hvor mange stop der skal genberegnes
const determineNewStops = (oldMatrix, newLocations) => {
  if (!oldMatrix || !oldMatrix.locations) {
    return { oldCount: 0, newCount: newLocations.length };
  }

  const oldLocations = oldMatrix.locations;
  let oldCount = 0;
  for (let i = 0; i < oldLocations.length; i++) {
    if (i >= newLocations.length) break;
    if (
      oldLocations[i].latitude === newLocations[i].latitude &&
      oldLocations[i].longitude === newLocations[i].longitude
    ) {
      oldCount++;
    } else {
      break;
    }
  }

  const newCount = newLocations.length - oldCount;
  return { oldCount, newCount };
};

// Opdater afstandsmatricen trinvist for at undgå unødvendige API-kald
export const updateDistanceMatrixIncrementally = async (userId, locations) => {
  console.log('Opdaterer afstandsmatrix trinvist...');

  // Hent eksisterende matrix og bestem hvad der skal opdateres
  const oldMatrix = await getCachedMatrix(userId);
  const { oldCount, newCount } = determineNewStops(oldMatrix, locations);

  // Valideringstjek for eksisterende matrix
  // Tjek om matricen er kvadratisk og gyldig
  if (oldMatrix && oldMatrix.distances) {
    const n = oldMatrix.distances.length;
    for (let row of oldMatrix.distances) {
      if (row.length !== n) {
        console.warn("Cached matrix not square or corrupted. Recalculating from scratch.");
        const { distances, durations } = await getDistanceMatrixFull(locations, locations);
        await saveCachedMatrix(userId, { locations, distances, durations });
        return { distances, durations };
      }
    }
  }

  // Hvis oldMatrix eksisterer, men præfikset ikke matcher, genberegn
  if (oldMatrix && oldMatrix.locations && oldCount !== oldMatrix.locations.length) {
    console.warn("Old matrix prefix no longer valid. Recalculating from scratch.");
    const { distances, durations } = await getDistanceMatrixFull(locations, locations);
    await saveCachedMatrix(userId, { locations, distances, durations });
    return { distances, durations };
  }

  // Hvis ingen oldMatrix eller oldCount=0, fuld genberegning
  if (!oldMatrix || oldCount === 0) {
    const { distances, durations } = await getDistanceMatrixFull(locations, locations);
    await saveCachedMatrix(userId, { locations, distances, durations });
    return { distances, durations };
  }

  // Hvis ingen nye stop, returner gamle
  if (newCount === 0) {
    return {
      distances: oldMatrix.distances,
      durations: oldMatrix.durations
    };
  }

  // Trinvis opdatering
  const totalCount = oldCount + newCount;
  const oldDistances = oldMatrix.distances;
  const oldDurations = oldMatrix.durations;

  // Udvid gamle rækker
  const newDistances = oldDistances.map(row => {
    const extended = [...row, ...Array(newCount).fill(0)];
    if (extended.length !== totalCount) {
      throw new Error("Row extension error: not matching totalCount");
    }
    return extended;
  });

  const newDurations = oldDurations.map(row => {
    const extended = [...row, ...Array(newCount).fill(0)];
    if (extended.length !== totalCount) {
      throw new Error("Row extension error in durations: not matching totalCount");
    }
    return extended;
  });

  // Tilføj nye rækker
  for (let i = 0; i < newCount; i++) {
    const newDistRow = Array(totalCount).fill(0);
    const newDurRow = Array(totalCount).fill(0);
    newDistances.push(newDistRow);
    newDurations.push(newDurRow);
  }

  // Tjek form nu
  if (newDistances.length !== totalCount || newDurations.length !== totalCount) {
    console.warn("Matrix shape invalid after expansion, recalculating from scratch.");
    const { distances, durations } = await getDistanceMatrixFull(locations, locations);
    await saveCachedMatrix(userId, { locations, distances, durations });
    return { distances, durations };
  }
  for (let row of newDistances) {
    if (row.length !== totalCount) {
      console.warn("Distance row length mismatch after adding new stops, recalculating from scratch.");
      const { distances, durations } = await getDistanceMatrixFull(locations, locations);
      await saveCachedMatrix(userId, { locations, distances, durations });
      return { distances, durations };
    }
  }
  for (let row of newDurations) {
    if (row.length !== totalCount) {
      console.warn("Duration row length mismatch after adding new stops, recalculating from scratch.");
      const { distances, durations } = await getDistanceMatrixFull(locations, locations);
      await saveCachedMatrix(userId, { locations, distances, durations });
      return { distances, durations };
    }
  }

  // Delvise beregninger: disse kan være rektangulære
  const oldSubset = locations.slice(0, oldCount);
  const newSubset = locations.slice(oldCount);

  // Udfør delvise beregninger i tre trin

  // Trin 1: Beregn afstande fra gamle lokationer til nye lokationer
  {
    const partial = await getDistanceMatrixFull(oldSubset, newSubset);
    if (partial.distances.length !== oldCount || partial.distances.some(r => r.length !== newCount)) {
      console.warn("Partial old->new failed shape check. Recalculating full.");
      const { distances, durations } = await getDistanceMatrixFull(locations, locations);
      await saveCachedMatrix(userId, { locations, distances, durations });
      return { distances, durations };
    }

    for (let r = 0; r < oldCount; r++) {
      for (let c = 0; c < newCount; c++) {
        newDistances[r][oldCount + c] = partial.distances[r][c];
        newDurations[r][oldCount + c] = partial.durations[r][c];
      }
    }
  }

  // Trin 2: Beregn afstande fra nye lokationer til gamle lokationer
  {
    const partial = await getDistanceMatrixFull(newSubset, oldSubset);
    if (partial.distances.length !== newCount || partial.distances.some(r => r.length !== oldCount)) {
      console.warn("Partial new->old failed shape check. Recalculating full.");
      const { distances, durations } = await getDistanceMatrixFull(locations, locations);
      await saveCachedMatrix(userId, { locations, distances, durations });
      return { distances, durations };
    }

    for (let r = 0; r < newCount; r++) {
      for (let c = 0; c < oldCount; c++) {
        newDistances[oldCount + r][c] = partial.distances[r][c];
        newDurations[oldCount + r][c] = partial.durations[r][c];
      }
    }
  }

  // Trin 3: Beregn afstande mellem nye lokationer
  {
    const partial = await getDistanceMatrixFull(newSubset, newSubset);
    if (partial.distances.length !== newCount || partial.distances.some(r => r.length !== newCount)) {
      console.warn("Partial new->new failed shape check. Recalculating full.");
      const { distances, durations } = await getDistanceMatrixFull(locations, locations);
      await saveCachedMatrix(userId, { locations, distances, durations });
      return { distances, durations };
    }

    for (let r = 0; r < newCount; r++) {
      for (let c = 0; c < newCount; c++) {
        newDistances[oldCount + r][oldCount + c] = partial.distances[r][c];
        newDurations[oldCount + r][oldCount + c] = partial.durations[r][c];
      }
    }
  }

  // Endelig tjek: nu skal vi have en fuld NxN matrix
  if (newDistances.length !== totalCount || newDurations.length !== totalCount) {
    console.warn("Final incremental update check failed, recalculating from scratch.");
    const { distances, durations } = await getDistanceMatrixFull(locations, locations);
    await saveCachedMatrix(userId, { locations, distances, durations });
    return { distances, durations };
  }

  for (let row of newDistances) {
    if (row.length !== totalCount) {
      console.warn("Distance row length mismatch after final assembly, recalculating from scratch.");
      const { distances, durations } = await getDistanceMatrixFull(locations, locations);
      await saveCachedMatrix(userId, { locations, distances, durations });
      return { distances, durations };
    }
  }
  for (let row of newDurations) {
    if (row.length !== totalCount) {
      console.warn("Duration row length mismatch after final assembly, recalculating from scratch.");
      const { distances, durations } = await getDistanceMatrixFull(locations, locations);
      await saveCachedMatrix(userId, { locations, distances, durations });
      return { distances, durations };
    }
  }

  await saveCachedMatrix(userId, {
    locations,
    distances: newDistances,
    durations: newDurations
  });

  return {
    distances: newDistances,
    durations: newDurations
  };
};

// Beregn komplet afstandsmatrix for alle lokationer
export const getDistanceMatrixFull = async (origins, destinations) => {
  console.log('Beregner fuld afstandsmatrix...');
  try {
    const rows = origins.length;
    const cols = destinations.length;

    // Initialiser matricer til lagring af afstande og varigheder
    const originBatches = chunk(origins, BATCH_SIZE);
    const destinationBatches = chunk(destinations, BATCH_SIZE);

    const allDistances = Array.from({ length: rows }, () => Array(cols).fill(0));
    const allDurations = Array.from({ length: rows }, () => Array(cols).fill(0));

    // Lav batchede API-kald til Google Maps Distance Matrix API
    for (let i = 0; i < originBatches.length; i++) {
      for (let j = 0; j < destinationBatches.length; j++) {
        const response = await fetch(
          'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
              'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,distanceMeters,status,condition'
            },
            body: JSON.stringify({
              origins: originBatches[i].map(loc => ({
                waypoint: {
                  location: {
                    latLng: {
                      latitude: loc.latitude,
                      longitude: loc.longitude
                    }
                  }
                },
                routeModifiers: { avoid_ferries: true }
              })),
              destinations: destinationBatches[j].map(loc => ({
                waypoint: {
                  location: {
                    latLng: {
                      latitude: loc.latitude,
                      longitude: loc.longitude
                    }
                  }
                }
              })),
              travelMode: "DRIVE",
              routingPreference: "TRAFFIC_AWARE"
            })
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error('API Response:', errorText);
          throw new Error(`Route Matrix API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        if (Array.isArray(data)) {
          data.forEach(element => {
            const globalRowIndex = i * BATCH_SIZE + element.originIndex;
            const globalColIndex = j * BATCH_SIZE + element.destinationIndex;

            if (
              element.condition === 'ROUTE_EXISTS' &&
              element.distanceMeters != null &&
              element.duration != null
            ) {
              const distanceValue = Number(element.distanceMeters);
              const durationSeconds = parseInt(element.duration, 10);

              if (!isNaN(distanceValue) && !isNaN(durationSeconds)) {
                allDistances[globalRowIndex][globalColIndex] = distanceValue / 1000.0; // km
                allDurations[globalRowIndex][globalColIndex] = Math.ceil(durationSeconds / 60); // min
              }
            }
          });
        }
      }
    }

    // Tjek ensartethed for NxM
    if (allDistances.length !== rows || allDurations.length !== rows) {
      console.error("Row count mismatch in results. Falling back.");
      return fallbackCalculation(origins, destinations);
    }
    for (let row of allDistances) {
      if (row.length !== cols) {
        console.error("Distances row length mismatch. Falling back.");
        return fallbackCalculation(origins, destinations);
      }
    }
    for (let row of allDurations) {
      if (row.length !== cols) {
        console.error("Durations row length mismatch. Falling back.");
        return fallbackCalculation(origins, destinations);
      }
    }

    return {
      distances: allDistances,
      durations: allDurations
    };

  } catch (error) {
    console.error('Rutematrix Fejl:', error);
    return fallbackCalculation(origins, destinations);
  }
};

// Reserveberegning med Haversine-formlen når API fejler
const fallbackCalculation = (origins, destinations) => {
  const rows = origins.length;
  const cols = destinations.length;

  // Beregn luftlinjeafstande mellem punkter ved hjælp af Haversine-formlen
  // Dette er mindre præcist, men virker uden API-adgang
  const distances = origins.map(origin => 
    destinations.map(dest => {
      const R = 6371;
      const dLat = (dest.latitude - origin.latitude) * Math.PI / 180;
      const dLon = (dest.longitude - origin.longitude) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(origin.latitude * Math.PI / 180) * Math.cos(dest.latitude * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    })
  );

  const durations = distances.map(row => row.map(distance => Math.ceil(distance)));
  // Ingen grund til at tjekke her; fallback skaber altid den korrekte form.
  return {
    distances,
    durations
  };
};
