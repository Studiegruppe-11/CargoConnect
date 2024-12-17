// /utils/internFetcher.js
// utils/internFetcher.js
import { getDatabase, ref, onValue } from "firebase/database";
import { auth } from "../firebaseConfig";

const database = getDatabase();


export const fetchDeliveries = () => {
    console.log("fetchDeliveries called.");
    return new Promise((resolve, reject) => {
      const deliveriesRef = ref(database, "deliveries");
      onValue(
        deliveriesRef,
        (snapshot) => {
          const data = snapshot.val();
          console.log("Fetched deliveries data from Firebase:", data);
          const deliveries = [];
          if (data) {
            Object.keys(data).forEach((key) => {
              const delivery = data[key];
              deliveries.push({ id: key, ...delivery });
            });
          }
          console.log("Parsed deliveries:", deliveries);
          resolve(deliveries);
        },
        (error) => {
          console.error("Error fetching deliveries:", error);
          reject(error);
        }
      );
    });
  };

export const fetchUserConstraints = () => {
  console.log("fetchUserConstraints called.");
  return new Promise((resolve, reject) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log("User not authenticated");
      reject(new Error("User not authenticated"));
      return;
    }
    const userRef = ref(database, `users/${currentUser.uid}`);
    onValue(
      userRef,
      (snapshot) => {
        const data = snapshot.val();
        console.log("Fetched user constraints from Firebase:", data);
        if (data) {
          if (
            data.preferredCountries &&
            typeof data.preferredCountries === "string"
          ) {
            data.preferredCountries = data.preferredCountries
              .split(",")
              .map((c) => c.trim());
          }
          resolve(data);
        } else {
          resolve({});
        }
      },
      (error) => {
        console.error("Error fetching user constraints:", error);
        reject(error);
      },
      { onlyOnce: true }
    );
  });
};
