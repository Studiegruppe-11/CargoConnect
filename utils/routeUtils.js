import { ref, onValue } from "firebase/database";

export const fetchCurrentRoute = (routeId, userId, db, callback) => {
  const routeRef = ref(db, `routes/${userId}/${routeId}`);
  onValue(routeRef, (snapshot) => {
    const data = snapshot.val();
    if (data && data.coordinates) {
      const formattedCoordinates = data.coordinates.map((coord) => ({
        latitude: coord.latitude,
        longitude: coord.longitude,
      }));
      callback({
        id: routeId,
        ...data,
        coordinates: formattedCoordinates,
      });
    } else {
      callback(null);
    }
  });
};