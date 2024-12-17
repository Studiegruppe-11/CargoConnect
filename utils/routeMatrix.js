// utils/routeMatrix.js

import { GOOGLE_MAPS_API_KEY } from "../firebaseConfig";
import { getDatabase, ref, get, set } from "firebase/database";

const BATCH_SIZE = 10;

const chunk = (array, size) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

export const getCachedMatrix = async (userId) => {
  const db = getDatabase();
  const matrixRef = ref(db, `routeMatrix/${userId}`);
  const snapshot = await get(matrixRef);
  return snapshot.exists() ? snapshot.val() : null;
};

export const saveCachedMatrix = async (userId, matrixData) => {
  const db = getDatabase();
  const matrixRef = ref(db, `routeMatrix/${userId}`);
  await set(matrixRef, matrixData);
};

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

export const updateDistanceMatrixIncrementally = async (userId, locations) => {
  console.log('Updating distance matrix incrementally...');
  const oldMatrix = await getCachedMatrix(userId);
  const { oldCount, newCount } = determineNewStops(oldMatrix, locations);

  // If oldMatrix is invalid or not square, recalc from scratch
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

  // If oldMatrix exists but prefix doesn't match, recalc
  if (oldMatrix && oldMatrix.locations && oldCount !== oldMatrix.locations.length) {
    console.warn("Old matrix prefix no longer valid. Recalculating from scratch.");
    const { distances, durations } = await getDistanceMatrixFull(locations, locations);
    await saveCachedMatrix(userId, { locations, distances, durations });
    return { distances, durations };
  }

  // If no oldMatrix or oldCount=0, full recalculation
  if (!oldMatrix || oldCount === 0) {
    const { distances, durations } = await getDistanceMatrixFull(locations, locations);
    await saveCachedMatrix(userId, { locations, distances, durations });
    return { distances, durations };
  }

  // If no new stops, return old
  if (newCount === 0) {
    return {
      distances: oldMatrix.distances,
      durations: oldMatrix.durations
    };
  }

  // Incremental update
  const totalCount = oldCount + newCount;
  const oldDistances = oldMatrix.distances;
  const oldDurations = oldMatrix.durations;

  // Extend old rows
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

  // Add new rows
  for (let i = 0; i < newCount; i++) {
    const newDistRow = Array(totalCount).fill(0);
    const newDurRow = Array(totalCount).fill(0);
    newDistances.push(newDistRow);
    newDurations.push(newDurRow);
  }

  // Check shape now
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

  // Partial computations: these may be rectangular
  const oldSubset = locations.slice(0, oldCount);
  const newSubset = locations.slice(oldCount);

  // 1) Old -> New (oldCount x newCount)
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

  // 2) New -> Old (newCount x oldCount)
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

  // 3) New -> New (newCount x newCount)
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

  // Final check: now we should have a full NxN matrix
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

export const getDistanceMatrixFull = async (origins, destinations) => {
  console.log('Calculating full distance matrix...');
  try {
    const rows = origins.length;
    const cols = destinations.length;

    const originBatches = chunk(origins, BATCH_SIZE);
    const destinationBatches = chunk(destinations, BATCH_SIZE);

    const allDistances = Array.from({ length: rows }, () => Array(cols).fill(0));
    const allDurations = Array.from({ length: rows }, () => Array(cols).fill(0));

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

    // Check uniformity for NxM
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
    console.error('Route Matrix Error:', error);
    return fallbackCalculation(origins, destinations);
  }
};

const fallbackCalculation = (origins, destinations) => {
  const rows = origins.length;
  const cols = destinations.length;

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
  // No need to check here; fallback always creates the correct shape.
  return {
    distances,
    durations
  };
};
