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
  const oldMatrix = await getCachedMatrix(userId);
  const { oldCount, newCount } = determineNewStops(oldMatrix, locations);

  // If oldMatrix is invalid or doesn't match the expected NxN shape, recalc
  if (oldMatrix && oldMatrix.distances) {
    const n = oldMatrix.distances.length;
    // Check all rows are the same length
    for (let row of oldMatrix.distances) {
      if (row.length !== n) {
        console.warn("Cached matrix not square. Recalculating from scratch.");
        const { distances, durations } = await getDistanceMatrixFull(locations, locations);
        await saveCachedMatrix(userId, { locations, distances, durations });
        return { distances, durations };
      }
    }
  }

  if (!oldMatrix || oldCount === 0) {
    // Full recalculation
    const { distances, durations } = await getDistanceMatrixFull(locations, locations);
    await saveCachedMatrix(userId, { locations, distances, durations });
    return { distances, durations };
  }

  if (newCount === 0) {
    // No new stops, just return the old one
    return {
      distances: oldMatrix.distances,
      durations: oldMatrix.durations
    };
  }

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

  // Add new rows for new stops
  for (let i = 0; i < newCount; i++) {
    const newDistRow = Array(totalCount).fill(0);
    const newDurRow = Array(totalCount).fill(0);
    newDistances.push(newDistRow);
    newDurations.push(newDurRow);
  }

  // Verify matrix shape now
  if (newDistances.length !== totalCount || newDurations.length !== totalCount) {
    throw new Error("Matrix rows count does not match totalCount after expansion.");
  }
  for (let row of newDistances) {
    if (row.length !== totalCount) {
      throw new Error("Mismatch in distances row length after adding new stops.");
    }
  }
  for (let row of newDurations) {
    if (row.length !== totalCount) {
      throw new Error("Mismatch in durations row length after adding new stops.");
    }
  }

  const oldSubset = locations.slice(0, oldCount);
  const newSubset = locations.slice(oldCount);

  // 1) Old -> New
  {
    const partial = await getDistanceMatrixFull(oldSubset, newSubset);
    for (let r = 0; r < oldCount; r++) {
      for (let c = 0; c < newCount; c++) {
        newDistances[r][oldCount + c] = partial.distances[r][c];
        newDurations[r][oldCount + c] = partial.durations[r][c];
      }
    }
  }

  // 2) New -> Old
  {
    const partial = await getDistanceMatrixFull(newSubset, oldSubset);
    for (let r = 0; r < newCount; r++) {
      for (let c = 0; c < oldCount; c++) {
        newDistances[oldCount + r][c] = partial.distances[r][c];
        newDurations[oldCount + r][c] = partial.durations[r][c];
      }
    }
  }

  // 3) New -> New
  {
    const partial = await getDistanceMatrixFull(newSubset, newSubset);
    for (let r = 0; r < newCount; r++) {
      for (let c = 0; c < newCount; c++) {
        newDistances[oldCount + r][oldCount + c] = partial.distances[r][c];
        newDurations[oldCount + r][oldCount + c] = partial.durations[r][c];
      }
    }
  }

  // Final sanity check
  if (newDistances.length !== totalCount || newDurations.length !== totalCount) {
    throw new Error("Final matrix not square after incremental update.");
  }
  for (let row of newDistances) {
    if (row.length !== totalCount) {
      throw new Error("Final distances matrix row length mismatch.");
    }
  }
  for (let row of newDurations) {
    if (row.length !== totalCount) {
      throw new Error("Final durations matrix row length mismatch.");
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
  try {
    const originBatches = chunk(origins, BATCH_SIZE);
    const destinationBatches = chunk(destinations, BATCH_SIZE);

    const allDistances = Array(origins.length).fill().map(() => Array(destinations.length).fill(0));
    const allDurations = Array(origins.length).fill().map(() => Array(destinations.length).fill(0));

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

    // Check uniformity one last time here
    const n = origins.length;
    for (let row of allDistances) {
      if (row.length !== n) {
        console.error("All rows must match length n in distances.");
        throw new Error("Distance matrix row length mismatch after full query.");
      }
    }
    for (let row of allDurations) {
      if (row.length !== n) {
        console.error("All rows must match length n in durations.");
        throw new Error("Duration matrix row length mismatch after full query.");
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
  return {
    distances,
    durations
  };
};
