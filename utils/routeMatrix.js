import { GOOGLE_MAPS_APIKEY } from "../firebaseConfig";

export const getDistanceMatrix = async (origins, destinations) => {
  try {
    const BATCH_SIZE = 10;
    const originBatches = chunk(origins, BATCH_SIZE);
    const destinationBatches = chunk(destinations, BATCH_SIZE);

    const allDistances = Array(origins.length).fill().map(() => Array(destinations.length).fill(0));
    const allDurations = Array(origins.length).fill().map(() => Array(destinations.length).fill(0));
    const allRoutes = Array(origins.length).fill().map(() => Array(destinations.length).fill(null));

    for (let i = 0; i < originBatches.length; i++) {
      for (let j = 0; j < destinationBatches.length; j++) {
        const response = await fetch(
          'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix',  // Fixed URL
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': GOOGLE_MAPS_APIKEY,
              'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,distanceMeters,condition,routes.polyline.encodedPolyline'
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
                }
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
          throw new Error(`Route Matrix API error: ${response.status}`);
        }

        const data = await response.json();
        
        data.forEach(element => {
          if (element.condition === 'ROUTE_EXISTS') {
            const globalRowIndex = i * BATCH_SIZE + element.originIndex;
            const globalColIndex = j * BATCH_SIZE + element.destinationIndex;
            allDistances[globalRowIndex][globalColIndex] = element.distanceMeters / 1000; // Convert to km
            allDurations[globalRowIndex][globalColIndex] = Math.ceil(parseInt(element.duration) / 60); // Convert seconds to minutes
            allRoutes[globalRowIndex][globalColIndex] = element.routes?.polyline?.encodedPolyline || null;
          }
        });
      }
    }

    return {
      distances: allDistances,
      durations: allDurations,
      routes: allRoutes
    };

  } catch (error) {
    console.error('Route Matrix Error:', error);
    // Fallback calculation remains the same...
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

  const durations = distances.map(row => 
    row.map(distance => Math.ceil(distance / 60 * 60))
  );

  return {
    distances,
    durations,
    routes: Array(origins.length).fill().map(() => Array(destinations.length).fill(null))
  };
};

const chunk = (array, size) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};