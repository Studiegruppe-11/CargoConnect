// utils/deliveryFixer.js

// Bruges til at rette leveringsdata i databasen, hvis der mangler nødvendige felter eller data er ugyldig
// Meningen er at denne kun bruges under produktion, så kan deaktiveres ved at fjerne den fra app.js.
// Den er ikke nødvændig for at applikationen kører, men er "nice to have" for at sikre data integritet.
 
import { getDatabase, ref, get, update } from 'firebase/database';

// Mulige statusværdier for leveringer
const possibleStatuses = ['pending', 'accepted', 'in_progress', 'completed', 'cancelled'];

// Funktion til at rette leveringsdata
export const fixDeliveryData = async () => {
  const db = getDatabase(); // Initialiserer Firebase Database
  const usersRef = ref(db, 'users'); // Referencer til 'users' i databasen
  const deliveriesRef = ref(db, 'deliveries'); // Referencer til 'deliveries' i databasen

  try {
    // Henter alle brugere og leveringer samtidig
    const [usersSnapshot, deliveriesSnapshot] = await Promise.all([
      get(usersRef),
      get(deliveriesRef)
    ]);

    const users = usersSnapshot.val(); // Får værdien af brugerne
    const deliveries = deliveriesSnapshot.val(); // Får værdien af leveringerne

    // Filtrerer brugere med rollen 'company'
    const companyUsers = Object.entries(users)
      .filter(([_, user]) => user.role === 'company')
      .map(([id]) => id);

    // Tjekker om der findes nogen virksomhedsbilleder
    if (!companyUsers.length) {
      console.error('Ingen virksomhedsbilleder fundet');
      return;
    }

    // Gennemgår hver levering for at rette data
    for (const [deliveryId, delivery] of Object.entries(deliveries)) {
      const updates = {}; // Objekt til at holde opdateringer

      // Tilføjer tilfældig virksomhed ID, hvis den mangler
      if (!delivery.companyId) {
        const randomCompanyId = companyUsers[Math.floor(Math.random() * companyUsers.length)];
        updates.companyId = randomCompanyId;
      }

      // Tilføjer tilfældig status, hvis den mangler
      if (!delivery.status) {
        const randomStatus = possibleStatuses[Math.floor(Math.random() * possibleStatuses.length)];
        updates.status = randomStatus;
      }

      // Retter negative betalinger til positive værdier
      if (delivery.payment < 0) {
        updates.payment = Math.abs(delivery.payment);
      }
      // Retter negative præmier til positive værdier
      if (delivery.prize < 0) {
        updates.prize = Math.abs(delivery.prize);
      }

      // Opdaterer leveringen, hvis der er ændringer
      if (Object.keys(updates).length > 0) {
        await update(ref(db, `deliveries/${deliveryId}`), updates);
        console.log(`Rettede levering ${deliveryId}:`, updates);
      }
    }

    console.log('Færdig med at rette leveringsdata');
  } catch (error) {
    console.error('Fejl under rettelse af leveringsdata:', error);
  }
};

fixDeliveryData();
