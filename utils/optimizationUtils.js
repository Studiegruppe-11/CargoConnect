import { getDatabase, ref, set, push, update } from "firebase/database";
import { updateDistanceMatrixIncrementally } from './routeMatrix';
import { Alert } from "react-native";
import { auth } from "../firebaseConfig";

export const prepareCuOptPayload = async (deliveries, constraints, user) => {
  if (!user) {
    throw new Error("User must be authenticated");
  }

  const dieselPrice = 12;
  const fuelEfficiency = Number(constraints.fuelEfficiency) || 10;

  // Create the locations array
  const locations = [
    {
      latitude: Number(constraints.startLatitude),
      longitude: Number(constraints.startLongitude),
      type: 'depot'
    },
    ...deliveries.flatMap(d => {
      if (
        !d.pickupLocation || 
        d.pickupLocation.latitude === undefined || 
        d.pickupLocation.longitude === undefined
      ) {
        throw new Error(`Delivery ${d.id} has invalid pickup location.`);
      }
      if (
        !d.deliveryLocation || 
        d.deliveryLocation.latitude === undefined || 
        d.deliveryLocation.longitude === undefined
      ) {
        throw new Error(`Delivery ${d.id} has invalid delivery location.`);
      }
      return [
        {
          latitude: Number(d.pickupLocation.latitude),
          longitude: Number(d.pickupLocation.longitude),
          type: 'pickup'
        },
        {
          latitude: Number(d.deliveryLocation.latitude),
          longitude: Number(d.deliveryLocation.longitude),
          type: 'delivery'
        }
      ];
    })
  ];

  // Validate locations
  locations.forEach((loc, index) => {
    if (isNaN(loc.latitude) || isNaN(loc.longitude)) {
      throw new Error(`Invalid location data at index ${index}: ${JSON.stringify(loc)}`);
    }
  });

  const { distances, durations } = await updateDistanceMatrixIncrementally(user.uid, locations);

  const costMatrix = distances.map(row =>
    row.map(distanceKm => (distanceKm / fuelEfficiency) * dieselPrice)
  );

  const numDeliveries = deliveries.length;
  const numTasks = numDeliveries * 2;

  // Extract vehicle dimension capacities from constraints
  const maxLengthCm = Number(constraints.dimensions?.length) || 0; 
  const maxWidthCm = Number(constraints.dimensions?.width) || 0;  
  const maxHeightCm = Number(constraints.dimensions?.height) || 0;

  // Prepare demand
  const demand = deliveries.flatMap(d => {
    const h = Number(d.height) || 0;
    const w = Number(d.width) || 0;
    const l = Number(d.length) || 0;

    // pickup task demands (positive)
    const pickupDemand = [l, w, h];
    // delivery task demands (negative)
    const deliveryDemand = [-l, -w, -h];

    return [pickupDemand, deliveryDemand];
  });

  const payload = {
    action: "cuOpt_OptimizedRouting",
    data: {
      cost_matrix_data: {
        data: { "1": costMatrix }
      },
      travel_time_matrix_data: {
        data: { "1": durations }
      },
      fleet_data: {
        vehicle_locations: [[0, 0]], // start and end at location 0
        vehicle_ids: [`veh-${user.uid}`],
        capacities: [
          [maxLengthCm], // dimension 1 (length)
          [maxWidthCm],  // dimension 2 (width)
          [maxHeightCm]  // dimension 3 (height)
        ],
        vehicle_time_windows: [
          [
            (Number(constraints.workStartTime)||6)*60,
            (Number(constraints.workEndTime)||22)*60
          ]
        ],
        vehicle_break_time_windows: [
          [
            [
              (Number(constraints.breakStartMin)||11)*60,
              (Number(constraints.breakStartMax)||16)*60
            ]
          ]
        ],
        vehicle_break_durations: [
          [(Number(constraints.breakDuration)||1)*30]
        ],
        min_vehicles: 1,
        vehicle_types: [1],
        vehicle_max_times: [(Number(constraints.maxDrivingTime)||12)*60],
        vehicle_max_costs: [99999]
      },
      task_data: {
        task_locations: Array.from({ length: numTasks }, (_, i) => i + 1),
        task_ids: deliveries.flatMap(d => [`pickup-${d.id}`, `delivery-${d.id}`]),
        pickup_and_delivery_pairs: Array.from({ length: numDeliveries }, (_, i) => [i*2, i*2+1]),
        task_time_windows: deliveries.flatMap(d => [
          [6*60, 22*60],
          [6*60, 22*60]
        ]),
        service_times: deliveries.flatMap(d => [
          Number(d.serviceTime) || 30,
          Number(d.serviceTime) || 30
        ]),
        prizes: deliveries.flatMap(d => [
          Number(d.payment) || 0,
          Number(d.payment) || 0
        ]),
        demand: [
          demand.map(d => d[0]), // all length demands
          demand.map(d => d[1]), // all width demands
          demand.map(d => d[2])  // all height demands
        ]
      },
      solver_config: {
        time_limit: 10,
        objectives: {
          cost: 1,
          prize: 1
        },
        verbose_mode: true,
        error_logging: true
      }
    }
  };

  return { payload, locations };
};

export const saveOptimizedRoutes = async (processedRoutes, userId) => {
  const database = getDatabase();
  const routesRef = ref(database, `routes/${userId}`);
  const newRef = push(routesRef);
  await set(newRef, {
    timestamp: Date.now(),
    routes: processedRoutes.routes,
    totalCost: processedRoutes.totalCost,
    vehiclesUsed: processedRoutes.vehiclesUsed
  });
};

export const requestRoute = async (optimizedRoute, currentUser) => {
  if (!currentUser) {
    Alert.alert('Error', 'Please login first');
    return;
  }
  
  try {
    const db = getDatabase();
    for (const delivery of optimizedRoute.deliveries) {
      const deliveryRef = ref(db, `deliveries/${delivery.id}`);
      await update(deliveryRef, {
        [`requests/${currentUser.uid}`]: {
          truckerName: currentUser.displayName || currentUser.email,
          requestTime: Date.now(),
          routeId: optimizedRoute.id
        }
      });
    }

    Alert.alert('Success', 'Route request sent to companies');
  } catch (error) {
    console.error('Error requesting route:', error);
    Alert.alert('Error', 'Failed to request route');
  }
};

export const handleOptimizationError = (error, navigation) => {
  console.error("Optimization error:", error);
  const errorMessage = error.message || "Unknown error occurred.";

  Alert.alert("Optimization Error", errorMessage, [
    {
      text: "Go to Profile",
      onPress: () => navigation.navigate("Profile"),
    },
    {
      text: "Cancel",
      style: "cancel",
    },
  ]);
};