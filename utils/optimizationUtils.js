// utils/optimizationUtils.js

// Bruges til at optimere ruter og gemme optimerede ruter i Firebase Database

import { getDatabase, ref, set, push, update } from "firebase/database";
import { updateDistanceMatrixIncrementally } from './routeMatrix';
import { Alert } from "react-native";
import { auth } from "../firebaseConfig";

/**
 * Funktion til at forberede payload til CU-Opt optimering
 * @param {Array} deliveries - Liste over leveringer
 * @param {Object} constraints - Brugerens begrænsninger og præferencer
 * @param {Object} user - Den aktuelle bruger
 * @returns {Object} Payload og lokationer til optimering
 */
export const prepareCuOptPayload = async (deliveries, constraints, user) => {
  // Tjekker om brugeren er autentificeret
  if (!user) {
    throw new Error("User must be authenticated");
  }

  const dieselPrice = 12; // Pris pr. liter diesel
  const fuelEfficiency = Number(constraints.fuelEfficiency) || 10; // Brændstofeffektivitet i km/l

  // Opretter arrayet af lokationer
  const locations = [
    {
      latitude: Number(constraints.startLatitude), // Startbreddegrad
      longitude: Number(constraints.startLongitude), // Startlængdegrad
      type: 'depot' // Type af lokation
    },
    ...deliveries.flatMap(d => {
      // Tjekker om pickup location er gyldig
      if (
        !d.pickupLocation || 
        d.pickupLocation.latitude === undefined || 
        d.pickupLocation.longitude === undefined
      ) {
        throw new Error(`Delivery ${d.id} has invalid pickup location.`);
      }
      // Tjekker om delivery location er gyldig
      if (
        !d.deliveryLocation || 
        d.deliveryLocation.latitude === undefined || 
        d.deliveryLocation.longitude === undefined
      ) {
        throw new Error(`Delivery ${d.id} has invalid delivery location.`);
      }
      // Returnerer pickup og delivery lokationer for hver levering
      return [
        {
          latitude: Number(d.pickupLocation.latitude),
          longitude: Number(d.pickupLocation.longitude),
          type: 'pickup' // Type af lokation
        },
        {
          latitude: Number(d.deliveryLocation.latitude),
          longitude: Number(d.deliveryLocation.longitude),
          type: 'delivery' // Type af lokation
        }
      ];
    })
  ];

  // Validerer alle lokationer for at sikre gyldige koordinater
  locations.forEach((loc, index) => {
    if (isNaN(loc.latitude) || isNaN(loc.longitude)) {
      throw new Error(`Invalid location data at index ${index}: ${JSON.stringify(loc)}`);
    }
  });

  // Opdaterer distance matrix og henter afstande og varigheder
  const { distances, durations } = await updateDistanceMatrixIncrementally(user.uid, locations);

  // Beregner omkostningsmatrix baseret på afstand og brændstofeffektivitet
  const costMatrix = distances.map(row =>
    row.map(distanceKm => (distanceKm / fuelEfficiency) * dieselPrice)
  );

  const numDeliveries = deliveries.length; // Antal leveringer
  const numTasks = numDeliveries * 2; // Antal opgaver (pickup og delivery for hver levering)

  // Ekstraherer køretøjernes dimensionelle kapaciteter fra begrænsningerne
  const maxLengthCm = Number(constraints.dimensions?.length) || 0; 
  const maxWidthCm = Number(constraints.dimensions?.width) || 0;  
  const maxHeightCm = Number(constraints.dimensions?.height) || 0;

  // Forbereder efterspørgselsdata for opgaverne
  const demand = deliveries.flatMap(d => {
    const h = Number(d.height) || 0; // Højde i cm
    const w = Number(d.width) || 0;  // Bredde i cm
    const l = Number(d.length) || 0; // Længde i cm

    // Efterspørgsel for pickup opgaver (positive værdier)
    const pickupDemand = [l, w, h];
    // Efterspørgsel for delivery opgaver (negative værdier)
    const deliveryDemand = [-l, -w, -h];

    return [pickupDemand, deliveryDemand];
  });

  // Opretter payload til CU-Opt optimering
  const payload = {
    action: "cuOpt_OptimizedRouting",
    data: {
      cost_matrix_data: {
        data: { "1": costMatrix } // Omkostningsmatrix
      },
      travel_time_matrix_data: {
        data: { "1": durations } // Rejsetidsmatrix
      },
      fleet_data: {
        vehicle_locations: [[0, 0]], // Start og slut ved lokation 0
        vehicle_ids: [`veh-${user.uid}`], // Unik køretøjs-ID baseret på bruger-ID
        capacities: [
          [maxLengthCm], // Dimension 1 (længde)
          [maxWidthCm],  // Dimension 2 (bredde)
          [maxHeightCm]  // Dimension 3 (højde)
        ],
        vehicle_time_windows: [
          [
            (Number(constraints.workStartTime)||6)*60, // Arbejdstid start i minutter
            (Number(constraints.workEndTime)||22)*60  // Arbejdstid slut i minutter
          ]
        ],
        vehicle_break_time_windows: [
          [
            [
              (Number(constraints.breakStartMin)||11)*60, // Pause start tid i minutter
              (Number(constraints.breakStartMax)||16)*60  // Pause slut tid i minutter
            ]
          ]
        ],
        vehicle_break_durations: [
          [(Number(constraints.breakDuration)||1)*30] // Pause varighed i minutter
        ],
        min_vehicles: 1, // Minimum antal køretøjer
        vehicle_types: [1], // Type af køretøjer
        vehicle_max_times: [(Number(constraints.maxDrivingTime)||12)*60], // Maksimal kørselstid i minutter
        vehicle_max_costs: [99999] // Maksimale omkostninger pr. køretøj
      },
      task_data: {
        task_locations: Array.from({ length: numTasks }, (_, i) => i + 1), // Lokationsindeks for opgaver
        task_ids: deliveries.flatMap(d => [`pickup-${d.id}`, `delivery-${d.id}`]), // Unikke ID'er for opgaver
        pickup_and_delivery_pairs: Array.from({ length: numDeliveries }, (_, i) => [i*2, i*2+1]), // Par af pickup og delivery opgaver
        task_time_windows: deliveries.flatMap(d => [
          [6*60, 22*60], // Tidsvindue for pickup opgave
          [6*60, 22*60]  // Tidsvindue for delivery opgave
        ]),
        service_times: deliveries.flatMap(d => [
          Number(d.serviceTime) || 30, // Servicetid for pickup opgave i minutter
          Number(d.serviceTime) || 30  // Servicetid for delivery opgave i minutter
        ]),
        prizes: deliveries.flatMap(d => [
          Number(d.payment) || 0, // Belønning for pickup opgave
          Number(d.payment) || 0  // Belønning for delivery opgave
        ]),
        demand: [
          demand.map(d => d[0]), // Alle længde efterspørgsler
          demand.map(d => d[1]), // Alle bredde efterspørgsler
          demand.map(d => d[2])  // Alle højde efterspørgsler
        ]
      },
      solver_config: {
        time_limit: 10, // Tidsbegrænsning for optimering i sekunder
        objectives: {
          cost: 1,   // Vægt for omkostningsmål
          prize: 1   // Vægt for belønningsmål
        },
        verbose_mode: true,   // Aktiverer detaljeret logning
        error_logging: true   // Aktiverer fejl logning
      }
    }
  };

  return { payload, locations }; // Returnerer payload og lokationer
};

/**
 * Funktion til at gemme optimerede ruter i Firebase Database
 * @param {Object} processedRoutes - Behandlede ruteoplysninger
 * @param {string} userId - Brugerens ID
 */
export const saveOptimizedRoutes = async (processedRoutes, userId) => {
  const database = getDatabase(); // Initialiserer Firebase Database
  const routesRef = ref(database, `routes/${userId}`); // Referencer til brugerens ruter
  const newRef = push(routesRef); // Opretter en ny rute reference
  await set(newRef, {
    timestamp: Date.now(), // Tidspunkt for gemning
    routes: processedRoutes.routes, // Liste over ruter
    totalCost: processedRoutes.totalCost, // Samlet omkostning
    vehiclesUsed: processedRoutes.vehiclesUsed // Antal brugte køretøjer
  });
};

/**
 * Funktion til at anmode om en rute og opdatere leveringsdata
 * @param {Object} optimizedRoute - Optimeret rute
 * @param {Object} currentUser - Den aktuelle bruger
 */
export const requestRoute = async (optimizedRoute, currentUser) => {
  // Tjekker om brugeren er autentificeret
  if (!currentUser) {
    Alert.alert('Error', 'Please login first'); // Viser fejlmeddelelse
    return;
  }
  
  try {
    const db = getDatabase(); // Initialiserer Firebase Database
    // Gennemgår hver levering i den optimerede rute
    for (const delivery of optimizedRoute.deliveries) {
      const deliveryRef = ref(db, `deliveries/${delivery.id}`); // Referencer til den specifikke levering
      await update(deliveryRef, {
        [`requests/${currentUser.uid}`]: {
          truckerName: currentUser.displayName || currentUser.email, // Navn på trucker
          requestTime: Date.now(), // Tidspunkt for anmodning
          routeId: optimizedRoute.id // ID for den optimerede rute
        }
      });
    }

    Alert.alert('Success', 'Route request sent to companies'); // Viser succesmeddelelse
  } catch (error) {
    console.error('Error requesting route:', error); // Logger fejlen i konsollen
    Alert.alert('Error', 'Failed to request route'); // Viser fejlmeddelelse
  }
};

/**
 * Funktion til at håndtere fejl under optimering
 * @param {Error} error - Fejlen der opstod
 * @param {Object} navigation - Navigation objektet til at navigere mellem skærme
 */
export const handleOptimizationError = (error, navigation) => {
  console.error("Optimization error:", error); // Logger fejlen i konsollen
  const errorMessage = error.message || "Unknown error occurred."; // Bestemmer fejlmeddelelsen

  // Viser en alert med fejlmeddelelsen og valgmuligheder
  Alert.alert("Optimization Error", errorMessage, [
    {
      text: "Go to Profile", // Tekst for knap til at gå til profil
      onPress: () => navigation.navigate("Profile"), // Handler til knap
    },
    {
      text: "Cancel", // Tekst for annuller knap
      style: "cancel", // Stil for knap
    },
  ]);
};
