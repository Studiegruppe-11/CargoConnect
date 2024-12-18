// utils/nvApi.js

import { NVIDIA_API_KEY } from "../firebaseConfig";


const POLL_INTERVAL_MS = 10000; // 10 seconds

export const callCuOptAPI = async (payload) => {
  const baseUrl = "https://optimize.api.nvidia.com/v1/nvidia/cuopt";
  const headers = {
    Authorization: `Bearer ${NVIDIA_API_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  console.log("Using API Key:", NVIDIA_API_KEY ? "Provided" : "Not Provided");
  console.log("Sending request to cuOpt API with URL:", baseUrl);

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(payload),
  });

  console.log("Fetch completed, response status:", response.status);

  if (response.status === 202) {
    const requestId = response.headers.get("NVCF-REQID");
    if (!requestId) {
      throw new Error(
        "202 Accepted but no requestId provided in headers for polling."
      );
    }
    return await pollStatus(requestId);
  }

  const responseText = await response.text();
  if (!response.ok) {
    console.error("Response not ok:", response.status, responseText);
    if (response.status === 403) {
      throw new Error(
        `API request failed with status 403: Access denied. Detail: ${responseText}`
      );
    }
    throw new Error(
      `API request failed with status ${response.status}: ${responseText}`
    );
  }

  let result;
  try {
    result = JSON.parse(responseText);
  } catch (jsonError) {
    console.error("JSON parse error:", jsonError.message);
    console.error("Response text was not valid JSON:", responseText);
    throw new Error("Failed to parse JSON response from server");
  }

  // console.log("API call completed successfully:", result);
  return result;
};

export const validatePayload = (payload) => {
  console.log("validatePayload called.");
  const data = payload?.data;
  if (!data) {
    throw new Error("Missing data object");
  }
  if (!data.fleet_data || !data.task_data) {
    throw new Error(
      "Invalid payload structure: missing fleet_data or task_data"
    );
  }
  if (!data.cost_matrix_data?.data) {
    throw new Error("Missing cost matrix data");
  }
  console.log("Payload validation passed");
};

export const pollStatus = async (requestId) => {
  console.log(`Starting status polling for requestId: ${requestId}`);
  return new Promise((resolve, reject) => {
    const pollInterval = setInterval(async () => {
      try {
        console.log(
          `Checking optimization status... (${new Date().toLocaleTimeString()})`
        );

        const response = await fetch(
          `https://optimize.api.nvidia.com/v1/status/${requestId}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${NVIDIA_API_KEY}`,
              Accept: "application/json",
            },
          }
        );

        if (response.status === 202) {
          console.log("Status: PENDING - Still optimizing routes...");
          return; // continue polling
        }

        // Once a non-202 response is received, stop polling.
        clearInterval(pollInterval);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Status: FAILED - ${response.status} ${errorText}`);
          reject(new Error(`Status polling failed: ${errorText}`));
          return;
        }

        const result = await response.json();
        console.log("Status: COMPLETE - Optimization finished!");
        console.log(
          "Solution details:",
          JSON.stringify(result?.response?.solver_response || {}, null, 2)
        );
        resolve(result);
      } catch (err) {
        console.error("Status: ERROR -", err.message);
        clearInterval(pollInterval);
        reject(err);
      }
    }, POLL_INTERVAL_MS);
  });
}

export const handleCuOptError = (error) => {
  if (error.response) {
    if (error.response.status === 401) {
      return "Invalid API key or unauthorized access";
    }
    if (error.response.status === 422) {
      return "Invalid input data format";
    }
    if (error.response.status === 500) {
      return "NVIDIA cuOpt service error";
    }
    return `API Error: ${error.response.status}`;
  }
  return error.message;
}

export const processOptimizedRoutes = async (responseBody, locations) => {
  console.log("processOptimizedRoutes called with:", responseBody);
  const resp = responseBody?.response;

  if (resp?.solver_response) {
    console.log("Feasible solution found");
    // Invert the sign of solution_cost since it represents profit
    const solution_cost = -resp.solver_response.solution_cost;
    const { vehicle_data, num_vehicles } = resp.solver_response;
    const optimizedRoutes = [];

    Object.entries(vehicle_data).forEach(([vehicleId, data]) => {
      const route = {
        vehicleId,
        stops: [],
        totalCost: solution_cost, // Use the inverted cost here
        totalTime: 0,
      };

      data.task_id.forEach((taskId, index) => {
        if (data.type[index] === "Delivery" || data.type[index] === "Pickup") {
          const locationIndex = data.route[index];
          const coord = locations[locationIndex];
          route.stops.push({
            taskId,
            type: data.type[index],
            arrivalTime: data.arrival_stamp[index],
            coordinates: {
              latitude: coord.latitude,
              longitude: coord.longitude,
            },
          });
        }
      });

      route.totalTime = data.arrival_stamp[data.arrival_stamp.length - 1];
      optimizedRoutes.push(route);
    });

    return {
      routes: optimizedRoutes,
      totalCost: solution_cost, // Use the inverted cost here
      vehiclesUsed: num_vehicles,
    };
  } else if (resp?.solver_infeasible_response) {
    console.warn("No feasible solution found.");
    // Invert the sign for infeasible solutions as well
    const solution_cost = -resp.solver_infeasible_response.solution_cost;
    return {
      routes: [],
      totalCost: solution_cost,
      vehiclesUsed: resp.solver_infeasible_response.num_vehicles,
      infeasible: true,
      message: "No feasible solution found",
    };
  }

  throw new Error("Invalid API response format");
};
