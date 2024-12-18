// utils/internFetcher.js

// Til at hente brugerpræferencer, leveringer og brugerdata fra Firebase

import { getDatabase, ref, onValue } from "firebase/database";
import { auth } from "../firebaseConfig";

// Initialiserer Firebase Database
const database = getDatabase();

/**
 * Funktion til at hente leveringsdata fra Firebase
 * @returns {Promise<Array>} En Promise der resolver til en liste af leveringer
 */
export const fetchDeliveries = () => {
    console.log("fetchDeliveries kaldt.");
    return new Promise((resolve, reject) => {
        // Referencer til 'deliveries' i databasen
        const deliveriesRef = ref(database, "deliveries");
        // Lytter til ændringer i 'deliveries'
        onValue(
            deliveriesRef,
            (snapshot) => {
                const data = snapshot.val();
                console.log("Hentede leveringsdata fra Firebase");
                const deliveries = [];
                if (data) {
                    // Gennemgår hver levering og tilføjer den til listen
                    Object.keys(data).forEach((key) => {
                        const delivery = data[key];
                        deliveries.push({ id: key, ...delivery });
                    });
                }
                console.log("Parserede leveringer");
                resolve(deliveries);
            },
            (error) => {
                console.error("Fejl ved hentning af leveringer:", error);
                reject(error);
            }
        );
    });
};

/**
 * Funktion til at hente brugerbegrænsninger fra Firebase
 * @returns {Promise<Object>} En Promise der resolver til brugerens begrænsninger
 */
export const fetchUserConstraints = () => {
    console.log("fetchUserConstraints kaldt.");
    return new Promise((resolve, reject) => {
        // Henter den aktuelle bruger
        const currentUser = auth.currentUser;
        if (!currentUser) {
            console.log("Bruger ikke autentificeret");
            reject(new Error("Bruger ikke autentificeret"));
            return;
        }
        // Referencer til den aktuelle bruger i databasen
        const userRef = ref(database, `users/${currentUser.uid}`);
        // Lytter til ændringer i brugerens data, kun én gang
        onValue(
            userRef,
            (snapshot) => {
                const data = snapshot.val();
                console.log("Hentede brugerbegrænsninger fra Firebase");
                if (data) {
                    // Tjekker om 'preferredCountries' er en streng og splitter den til en liste
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
                console.error("Fejl ved hentning af brugerbegrænsninger:", error);
                reject(error);
            },
            { onlyOnce: true }
        );
    });
};
