declare const NvidiaCuoptInfer: {
    readonly body: {
        readonly properties: {
            readonly action: {
                readonly anyOf: readonly [{
                    readonly type: "string";
                    readonly enum: readonly ["cuOpt_OptimizedRouting", "cuOpt_RoutingValidator", 0];
                }, {
                    readonly type: "null";
                }];
                readonly title: "Action";
                readonly description: "Action to be performed by the service, validator action just validates input against format and base rules.";
                readonly default: "cuOpt_OptimizedRouting";
            };
            readonly data: {
                readonly anyOf: readonly [{
                    readonly properties: {
                        readonly cost_waypoint_graph_data: {
                            readonly anyOf: readonly [{
                                readonly properties: {
                                    readonly waypoint_graph: {
                                        readonly anyOf: readonly [{
                                            readonly additionalProperties: {
                                                readonly properties: {
                                                    readonly edges: {
                                                        readonly items: {
                                                            readonly type: "integer";
                                                        };
                                                        readonly type: "array";
                                                        readonly title: "Edges";
                                                        readonly description: "dtype: int32, edge >= 0. \n\n Vertices of all the directed edges.";
                                                    };
                                                    readonly offsets: {
                                                        readonly items: {
                                                            readonly type: "integer";
                                                        };
                                                        readonly type: "array";
                                                        readonly title: "Offsets";
                                                        readonly description: "dtype: int32, offset >= 0. \n\n Offsets which provide number of edges from the source vertex signified by the index.";
                                                    };
                                                    readonly weights: {
                                                        readonly anyOf: readonly [{
                                                            readonly items: {
                                                                readonly type: "number";
                                                            };
                                                            readonly type: "array";
                                                        }, {
                                                            readonly type: "null";
                                                        }];
                                                        readonly title: "Weights";
                                                        readonly description: "dtype: float32, weight >= 0. \n\n Weights of each edges.";
                                                    };
                                                };
                                                readonly additionalProperties: false;
                                                readonly type: "object";
                                                readonly required: readonly ["edges", "offsets"];
                                                readonly title: "WaypointGraph";
                                            };
                                            readonly type: "object";
                                        }, {
                                            readonly type: "null";
                                        }];
                                        readonly title: "Waypoint Graph";
                                    };
                                };
                                readonly additionalProperties: false;
                                readonly type: "object";
                                readonly title: "UpdateWaypointGraphData";
                            }, {
                                readonly type: "null";
                            }];
                            readonly description: "Waypoint graph with weights as cost to travel from A to B \nand B to A. If there are different types of vehicles \nthey can be provided with key value pair \nwhere key is vehicle-type and value is the graph. Value of \nvehicle type should be within [0, 255]";
                            readonly default: {};
                        };
                        readonly travel_time_waypoint_graph_data: {
                            readonly anyOf: readonly [{
                                readonly properties: {
                                    readonly waypoint_graph: {
                                        readonly anyOf: readonly [{
                                            readonly additionalProperties: {
                                                readonly properties: {
                                                    readonly edges: {
                                                        readonly items: {
                                                            readonly type: "integer";
                                                        };
                                                        readonly type: "array";
                                                        readonly title: "Edges";
                                                        readonly description: "dtype: int32, edge >= 0. \n\n Vertices of all the directed edges.";
                                                    };
                                                    readonly offsets: {
                                                        readonly items: {
                                                            readonly type: "integer";
                                                        };
                                                        readonly type: "array";
                                                        readonly title: "Offsets";
                                                        readonly description: "dtype: int32, offset >= 0. \n\n Offsets which provide number of edges from the source vertex signified by the index.";
                                                    };
                                                    readonly weights: {
                                                        readonly anyOf: readonly [{
                                                            readonly items: {
                                                                readonly type: "number";
                                                            };
                                                            readonly type: "array";
                                                        }, {
                                                            readonly type: "null";
                                                        }];
                                                        readonly title: "Weights";
                                                        readonly description: "dtype: float32, weight >= 0. \n\n Weights of each edges.";
                                                    };
                                                };
                                                readonly additionalProperties: false;
                                                readonly type: "object";
                                                readonly required: readonly ["edges", "offsets"];
                                                readonly title: "WaypointGraph";
                                            };
                                            readonly type: "object";
                                        }, {
                                            readonly type: "null";
                                        }];
                                        readonly title: "Waypoint Graph";
                                    };
                                };
                                readonly additionalProperties: false;
                                readonly type: "object";
                                readonly title: "UpdateWaypointGraphData";
                            }, {
                                readonly type: "null";
                            }];
                            readonly description: "Waypoint graph with weights as time to travel from A to B \nand B to A. If there are different types of vehicles \nthey can be provided with key value pair \nwhere key is vehicle-type and value is the graph. Value of \nvehicle type should be within [0, 255]";
                            readonly default: {};
                        };
                        readonly cost_matrix_data: {
                            readonly anyOf: readonly [{
                                readonly properties: {
                                    readonly data: {
                                        readonly anyOf: readonly [{
                                            readonly additionalProperties: {
                                                readonly items: {
                                                    readonly items: {
                                                        readonly type: "number";
                                                    };
                                                    readonly type: "array";
                                                };
                                                readonly type: "array";
                                            };
                                            readonly type: "object";
                                        }, {
                                            readonly type: "null";
                                        }];
                                        readonly title: "Data";
                                        readonly description: "dtype : vehicle-type (uint8), cost (float32), cost >= 0.\n \n\n Sqaure matrix with cost to travel from A to B and B to A. \nIf there different types of vehicles which have different \ncost matrices, they can be provided with key value pair \nwhere key is vehicle-type and value is cost matrix. Value of \nvehicle type should be within [0, 255]";
                                    };
                                    readonly cost_matrix: {
                                        readonly anyOf: readonly [{
                                            readonly additionalProperties: {
                                                readonly items: {
                                                    readonly items: {
                                                        readonly type: "number";
                                                    };
                                                    readonly type: "array";
                                                };
                                                readonly type: "array";
                                            };
                                            readonly type: "object";
                                        }, {
                                            readonly type: "null";
                                        }];
                                        readonly title: "Cost Matrix";
                                        readonly description: "This field is deprecated, please use the 'data' field instead";
                                        readonly deprecated: true;
                                    };
                                };
                                readonly additionalProperties: false;
                                readonly type: "object";
                                readonly title: "UpdateCostMatrices";
                            }, {
                                readonly type: "null";
                            }];
                            readonly description: "Sqaure matrix with cost to travel from A to B and B to A. \nIf there are different types of vehicles which have different \ncost matrices, they can be provided with key value pair \nwhere key is vehicle-type and value is cost matrix. Value of \nvehicle type should be within [0, 255]";
                            readonly default: {};
                        };
                        readonly travel_time_matrix_data: {
                            readonly anyOf: readonly [{
                                readonly properties: {
                                    readonly data: {
                                        readonly anyOf: readonly [{
                                            readonly additionalProperties: {
                                                readonly items: {
                                                    readonly items: {
                                                        readonly type: "number";
                                                    };
                                                    readonly type: "array";
                                                };
                                                readonly type: "array";
                                            };
                                            readonly type: "object";
                                        }, {
                                            readonly type: "null";
                                        }];
                                        readonly title: "Data";
                                        readonly description: "dtype : vehicle-type (uint8), cost (float32), cost >= 0.\n \n\n Sqaure matrix with cost to travel from A to B and B to A. \nIf there different types of vehicles which have different \ncost matrices, they can be provided with key value pair \nwhere key is vehicle-type and value is cost matrix. Value of \nvehicle type should be within [0, 255]";
                                    };
                                    readonly cost_matrix: {
                                        readonly anyOf: readonly [{
                                            readonly additionalProperties: {
                                                readonly items: {
                                                    readonly items: {
                                                        readonly type: "number";
                                                    };
                                                    readonly type: "array";
                                                };
                                                readonly type: "array";
                                            };
                                            readonly type: "object";
                                        }, {
                                            readonly type: "null";
                                        }];
                                        readonly title: "Cost Matrix";
                                        readonly description: "This field is deprecated, please use the 'data' field instead";
                                        readonly deprecated: true;
                                    };
                                };
                                readonly additionalProperties: false;
                                readonly type: "object";
                                readonly title: "UpdateCostMatrices";
                            }, {
                                readonly type: "null";
                            }];
                            readonly description: "Sqaure matrix with time to travel from A to B and B to A. \nIf there are different types of vehicles which have different \ntravel time matrices, they can be provided with key value pair \nwhere key is vehicle-type and value is time matrix. Value of \nvehicle type should be within [0, 255]";
                            readonly default: {};
                        };
                        readonly fleet_data: {
                            readonly description: "All Fleet information";
                            readonly type: "object";
                            readonly required: readonly ["vehicle_locations"];
                            readonly title: "FleetData";
                            readonly additionalProperties: false;
                            readonly properties: {
                                readonly vehicle_locations: {
                                    readonly type: "array";
                                    readonly title: "Vehicle Locations";
                                    readonly description: "dtype: int32, vehicle_location >= 0. \n\n Start and end location of the vehicles in the given set of locations in WayPointGraph or CostMatrices.\nExample: For 2 vehicles,  \n\n     [ \n\n         [veh_1_start_loc, veh_1_end_loc], \n\n         [veh_2_start_loc, veh_2_end_loc] \n\n     ]";
                                    readonly items: {
                                        readonly type: "array";
                                        readonly items: {
                                            readonly type: "integer";
                                        };
                                    };
                                };
                                readonly vehicle_ids: {
                                    readonly anyOf: readonly [{
                                        readonly items: {
                                            readonly type: "string";
                                        };
                                        readonly type: "array";
                                    }, {
                                        readonly type: "null";
                                    }];
                                    readonly title: "Vehicle Ids";
                                    readonly description: "List of the vehicle ids or names provided as a string.";
                                };
                                readonly capacities: {
                                    readonly anyOf: readonly [{
                                        readonly items: {
                                            readonly type: "array";
                                            readonly items: {
                                                readonly type: "integer";
                                            };
                                        };
                                        readonly type: "array";
                                    }, {
                                        readonly type: "null";
                                    }];
                                    readonly title: "Capacities";
                                    readonly description: "dtype: int32, capacity >= 0. \n\n Note: For this release number of capacity dimensions are limited to 3. \n\n Lists of capacities of each vehicle.\nMultiple capacities can be added and each list will represent one kind of capacity. Order of kind of the capacities should match order of the demands.\nTotal capacity for each type should be sufficient to complete all demand of that type.Example: In case of two sets of capacities per vehicle with 3 vehicles,  \n\n     [ \n\n         [cap_1_veh_1, cap_1_veh_2, cap_1_veh_3], \n\n         [cap_2_veh_1, cap_2_veh_2, cap_2_veh_3] \n\n     ]";
                                };
                                readonly vehicle_time_windows: {
                                    readonly anyOf: readonly [{
                                        readonly items: {
                                            readonly type: "array";
                                            readonly items: {
                                                readonly type: "integer";
                                            };
                                        };
                                        readonly type: "array";
                                    }, {
                                        readonly type: "null";
                                    }];
                                    readonly title: "Vehicle Time Windows";
                                    readonly description: "dtype: int32, time >= 0. \n\n Earliest and Latest time window pairs for each vehicle,\nfor example the data would look as follows for 2 vehicles, \n \n\n     [ \n\n         [veh_1_earliest, veh_1_latest], \n\n         [veh_2_earliest, veh_2_latest] \n\n     ]";
                                };
                                readonly vehicle_break_time_windows: {
                                    readonly anyOf: readonly [{
                                        readonly items: {
                                            readonly type: "array";
                                            readonly items: {
                                                readonly type: "array";
                                                readonly items: {
                                                    readonly type: "integer";
                                                };
                                            };
                                        };
                                        readonly type: "array";
                                    }, {
                                        readonly type: "null";
                                    }];
                                    readonly title: "Vehicle Break Time Windows";
                                    readonly description: "dtype: int32, time >= 0. \n\n Multiple break time windows can be added for each vehicle.Earliest and Latest break time window pairs for each vehicle,\nFor example, in case of 2 sets of breaks for each vehicle which translates to 2 dimensions of breaks,\n \n\n     [ \n\n         [[brk_1_veh_1_earliest, brk_1_veh_1_latest], [brk_1_veh_2_earliest, brk_1_veh_2_latest]] \n\n         [[brk_2_veh_1_earliest, brk_2_veh_1_latest], [brk_2_veh_2_earliest, brk_2_veh_2_latest]] \n\n     ] \n\n The break duration within this time window is provided through vehicle_break_durations.";
                                };
                                readonly vehicle_break_durations: {
                                    readonly anyOf: readonly [{
                                        readonly items: {
                                            readonly type: "array";
                                            readonly items: {
                                                readonly type: "integer";
                                            };
                                        };
                                        readonly type: "array";
                                    }, {
                                        readonly type: "null";
                                    }];
                                    readonly title: "Vehicle Break Durations";
                                    readonly description: "dtype: int32, time >= 0. \n\n Break duration for each vehicle. vehicle_break_time_windows should be provided to use this option.For example, in case of having 2 breaks for each vehicle,  \n\n     [ \n\n         [brk_1_veh_1_duration, brk_1_veh_2_duration], \n\n         [brk_2_veh_1_duration, brk_2_veh_2_duration], \n\n     ]";
                                };
                                readonly vehicle_break_locations: {
                                    readonly anyOf: readonly [{
                                        readonly items: {
                                            readonly type: "integer";
                                        };
                                        readonly type: "array";
                                    }, {
                                        readonly type: "null";
                                    }];
                                    readonly title: "Vehicle Break Locations";
                                    readonly description: "dtype: int32, location >= 0. \n\n Break location where vehicles can take breaks. If not set, any location can be used for the break.";
                                };
                                readonly vehicle_types: {
                                    readonly anyOf: readonly [{
                                        readonly items: {
                                            readonly type: "integer";
                                        };
                                        readonly type: "array";
                                    }, {
                                        readonly type: "null";
                                    }];
                                    readonly title: "Vehicle Types";
                                    readonly description: "dtype: uint8. \n\n Types of vehicles in the fleet given as positive integers.";
                                };
                                readonly vehicle_order_match: {
                                    readonly anyOf: readonly [{
                                        readonly items: {
                                            readonly type: "object";
                                            readonly required: readonly ["vehicle_id", "order_ids"];
                                            readonly title: "VehicleOrderMatch";
                                            readonly additionalProperties: false;
                                            readonly properties: {
                                                readonly vehicle_id: {
                                                    readonly type: "integer";
                                                    readonly title: "Vehicle Id";
                                                    readonly description: "dtype: int32, vehicle_id >= 0. \n\n Vehicle id as an integer, and can serve all the order listed in order_ids.";
                                                };
                                                readonly order_ids: {
                                                    readonly type: "array";
                                                    readonly title: "Order Ids";
                                                    readonly description: "dtype: int32, order_id >= 0. \n\n Indices of orders which can be served by this particular vehicle";
                                                    readonly items: {
                                                        readonly type: "integer";
                                                    };
                                                };
                                            };
                                        };
                                        readonly type: "array";
                                    }, {
                                        readonly type: "null";
                                    }];
                                    readonly title: "Vehicle Order Match";
                                    readonly description: "A list of vehicle order match, where the match would contain a vehicle id and a list of orders that vehicle can serve.";
                                };
                                readonly skip_first_trips: {
                                    readonly anyOf: readonly [{
                                        readonly items: {
                                            readonly type: "boolean";
                                        };
                                        readonly type: "array";
                                    }, {
                                        readonly type: "null";
                                    }];
                                    readonly title: "Skip First Trips";
                                    readonly description: "Drop the cost of trip to first location for that vehicle.";
                                };
                                readonly drop_return_trips: {
                                    readonly anyOf: readonly [{
                                        readonly items: {
                                            readonly type: "boolean";
                                        };
                                        readonly type: "array";
                                    }, {
                                        readonly type: "null";
                                    }];
                                    readonly title: "Drop Return Trips";
                                    readonly description: "Drop cost of return trip for each vehicle.";
                                };
                                readonly min_vehicles: {
                                    readonly anyOf: readonly [{
                                        readonly type: "integer";
                                    }, {
                                        readonly type: "null";
                                    }];
                                    readonly title: "Min Vehicles";
                                    readonly description: "dtype: int32, min_vehicles >= 1. \n\n Solution should consider minimum number of vehicles";
                                    readonly examples: readonly [2];
                                };
                                readonly vehicle_max_costs: {
                                    readonly anyOf: readonly [{
                                        readonly items: {
                                            readonly type: "number";
                                        };
                                        readonly type: "array";
                                    }, {
                                        readonly type: "null";
                                    }];
                                    readonly title: "Vehicle Max Costs";
                                    readonly description: "dtype: float32, max_costs >= 0. \n\n Maximum cost a vehicle can incur and it is based on cost matrix/cost waypoint graph.";
                                };
                                readonly vehicle_max_times: {
                                    readonly anyOf: readonly [{
                                        readonly items: {
                                            readonly type: "number";
                                        };
                                        readonly type: "array";
                                    }, {
                                        readonly type: "null";
                                    }];
                                    readonly title: "Vehicle Max Times";
                                    readonly description: "dtype: float32, max_time >= 0. \n\n Maximum time a vehicle can operate (includes drive, service and wait time), this is based on travel time matrix/travel time waypoint graph.";
                                };
                                readonly vehicle_fixed_costs: {
                                    readonly anyOf: readonly [{
                                        readonly items: {
                                            readonly type: "number";
                                        };
                                        readonly type: "array";
                                    }, {
                                        readonly type: "null";
                                    }];
                                    readonly title: "Vehicle Fixed Costs";
                                    readonly description: "dtype: float32, fixed_cost >= 0. \n\n Cost of each vehicle.This helps in routing where may be 2 vehicles with less cost is effective compared to 1 vehicle with huge cost. As example shows veh-0 (15) > veh-1 (5) + veh-2 (5)";
                                };
                            };
                        };
                        readonly task_data: {
                            readonly description: "All Task information";
                            readonly type: "object";
                            readonly required: readonly ["task_locations"];
                            readonly title: "TaskData";
                            readonly additionalProperties: false;
                            readonly properties: {
                                readonly task_locations: {
                                    readonly type: "array";
                                    readonly title: "Task Locations";
                                    readonly description: "dtype: int32, location >= 0. \n\n Location where the task has been requested.";
                                    readonly items: {
                                        readonly type: "integer";
                                    };
                                };
                                readonly task_ids: {
                                    readonly anyOf: readonly [{
                                        readonly items: {
                                            readonly type: "string";
                                        };
                                        readonly type: "array";
                                    }, {
                                        readonly type: "null";
                                    }];
                                    readonly title: "Task Ids";
                                    readonly description: "List of the task ids or names provided as a string.";
                                };
                                readonly demand: {
                                    readonly anyOf: readonly [{
                                        readonly items: {
                                            readonly type: "array";
                                            readonly items: {
                                                readonly type: "integer";
                                            };
                                        };
                                        readonly type: "array";
                                    }, {
                                        readonly type: "null";
                                    }];
                                    readonly title: "Demand";
                                    readonly description: "dtype: int32 \n\n Note: For this release number of demand dimensions are limited to 3. \n\n Lists of demands of each tasks.\nMultiple demands can be added and each list represents one kind of demand. Order of these demands should match the type of vehicle capacities provided.Example: In case of two sets of demands per vehicle with 3 vehicles,  \n\n     [ \n\n         [dem_1_tsk_1, dem_1_tsk_2, dem_1_tsk_3], \n\n         [dem_2_tsk_1, dem_2_tsk_2, dem_2_tsk_3] \n\n     ]";
                                };
                                readonly pickup_and_delivery_pairs: {
                                    readonly anyOf: readonly [{
                                        readonly items: {
                                            readonly type: "array";
                                            readonly items: {
                                                readonly type: "integer";
                                            };
                                        };
                                        readonly type: "array";
                                    }, {
                                        readonly type: "null";
                                    }];
                                    readonly title: "Pickup And Delivery Pairs";
                                    readonly description: "dtype: int32, pairs >= 0. \n\n List of Pick-up and delivery index pairs from task locations.\nIn case we have the following pick-up and delivery locations, 2->1, 4->5, 3->4, then task locations would look something like, task_locations = [0, 2, 1, 4, 5, 3, 4] and pick-up and delivery pairs would be index of those locations in task location and would look like [[1, 2], [3, 4], [5, 6]], 1 is pickup index for location 2 and it should be delivered to location 1 which is at index 2.Example schema:  \n\n     [ \n\n         [pcikup_1_idx_to_task, drop_1_idx_to_task], \n\n         [pcikup_2_idx_to_task, drop_2_idx_to_task], \n\n     ]";
                                };
                                readonly task_time_windows: {
                                    readonly anyOf: readonly [{
                                        readonly items: {
                                            readonly type: "array";
                                            readonly items: {
                                                readonly type: "integer";
                                            };
                                        };
                                        readonly type: "array";
                                    }, {
                                        readonly type: "null";
                                    }];
                                    readonly title: "Task Time Windows";
                                    readonly description: "dtype: int32, time >= 0. \n\n Earliest and Latest time windows for each tasks.\nFor example the data would look as follows, \n \n\n     [ \n\n         [tsk_1_earliest, tsk_1_latest], \n\n         [tsk_2_earliest, tsk_2_latest] \n\n     ]";
                                };
                                readonly service_times: {
                                    readonly anyOf: readonly [{
                                        readonly items: {
                                            readonly type: "integer";
                                        };
                                        readonly type: "array";
                                    }, {
                                        readonly additionalProperties: {
                                            readonly type: "array";
                                            readonly items: {
                                                readonly type: "integer";
                                            };
                                        };
                                        readonly type: "object";
                                    }, {
                                        readonly type: "null";
                                    }];
                                    readonly title: "Service Times";
                                    readonly description: "dtype: int32, time >= 0. \n\n Service time for each task. Accepts a list of service times for all vehicles. In case of vehicle specific service times, accepts a dict with key as vehicle id and value as list of service times.Example schema: In case all vehicles have same service times,  \n\n     [tsk_1_srv_time, tsk_2_srv_time, tsk_3_srv_time] \n\n  \n\n In case, there are 2 types of vehicle types and each of them have different service times, \n\n     { \n\n         type-1: [tsk_1_srv_time, tsk_3_srv_time, tsk_3_srv_time], \n\n         type-2: [tsk_1_srv_time, tsk_3_srv_time, tsk_3_srv_time] \n\n     }";
                                };
                                readonly prizes: {
                                    readonly anyOf: readonly [{
                                        readonly items: {
                                            readonly type: "number";
                                        };
                                        readonly type: "array";
                                    }, {
                                        readonly type: "null";
                                    }];
                                    readonly title: "Prizes";
                                    readonly description: "dtype: float32, prizes >= 0. \n\n List of values which signifies prizes that are collected for fulfilling each task. This can be used effectively in case solution is infeasible and need to drop few tasks to get feasible solution. Solver will prioritize for higher prize tasks ";
                                };
                                readonly order_vehicle_match: {
                                    readonly anyOf: readonly [{
                                        readonly items: {
                                            readonly type: "object";
                                            readonly required: readonly ["order_id", "vehicle_ids"];
                                            readonly title: "OrderVehicleMatch";
                                            readonly additionalProperties: false;
                                            readonly properties: {
                                                readonly order_id: {
                                                    readonly type: "integer";
                                                    readonly title: "Order Id";
                                                    readonly description: "dtype: int32, order_id >= 0. \n\n Indices of orders which can be served by this particular vehicleOrder id as an integer";
                                                };
                                                readonly vehicle_ids: {
                                                    readonly type: "array";
                                                    readonly title: "Vehicle Ids";
                                                    readonly description: "dtype: int32, vehicle_id >= 0. \n\n Indices of the vehicles which can serve this particular order. \n";
                                                    readonly items: {
                                                        readonly type: "integer";
                                                    };
                                                };
                                            };
                                        };
                                        readonly type: "array";
                                    }, {
                                        readonly type: "null";
                                    }];
                                    readonly title: "Order Vehicle Match";
                                    readonly description: "A list of order vehicle match, where the match would contain a order id and a list of vehicle ids that can serve this order.";
                                };
                                readonly mandatory_task_ids: {
                                    readonly anyOf: readonly [{
                                        readonly items: {
                                            readonly type: "integer";
                                        };
                                        readonly type: "array";
                                    }, {
                                        readonly type: "null";
                                    }];
                                    readonly title: "Mandatory Task Ids";
                                    readonly description: "dtype: int32, mandatory_task_id >= 0. \n\n Note: This is only effective when used along with drop infeasible option. \n\n A list of task ids which are mandatory and solver would fail if these cannot be fulfilled.";
                                };
                            };
                        };
                        readonly solver_config: {
                            readonly anyOf: readonly [{
                                readonly properties: {
                                    readonly time_limit: {
                                        readonly anyOf: readonly [{
                                            readonly type: "number";
                                        }, {
                                            readonly type: "null";
                                        }];
                                        readonly title: "Time Limit";
                                        readonly description: "SolverSettings time limit";
                                        readonly examples: readonly [1];
                                    };
                                    readonly objectives: {
                                        readonly anyOf: readonly [{
                                            readonly properties: {
                                                readonly cost: {
                                                    readonly anyOf: readonly [{
                                                        readonly type: "number";
                                                    }, {
                                                        readonly type: "null";
                                                    }];
                                                    readonly title: "Cost";
                                                    readonly description: "dtype: float32.  \n\n The weight assigned to minimizing the cost for a given solution, default value is 1";
                                                    readonly examples: readonly [1];
                                                };
                                                readonly travel_time: {
                                                    readonly anyOf: readonly [{
                                                        readonly type: "number";
                                                    }, {
                                                        readonly type: "null";
                                                    }];
                                                    readonly title: "Travel Time";
                                                    readonly description: "dtype: float32. \n\n The weight assigned to minimizing total travel time for a given solution (includes drive, service and wait time)";
                                                    readonly examples: readonly [0];
                                                };
                                                readonly variance_route_size: {
                                                    readonly anyOf: readonly [{
                                                        readonly type: "number";
                                                    }, {
                                                        readonly type: "null";
                                                    }];
                                                    readonly title: "Variance Route Size";
                                                    readonly description: "dtype: float32. \n\n The weight assigned to the variance in the number of orders served by each route.";
                                                    readonly examples: readonly [0];
                                                };
                                                readonly variance_route_service_time: {
                                                    readonly anyOf: readonly [{
                                                        readonly type: "number";
                                                    }, {
                                                        readonly type: "null";
                                                    }];
                                                    readonly title: "Variance Route Service Time";
                                                    readonly description: "dtype: float32. \n\n The weight assigned to the variance in the accumulated service times of each route";
                                                    readonly examples: readonly [0];
                                                };
                                                readonly prize: {
                                                    readonly anyOf: readonly [{
                                                        readonly type: "number";
                                                    }, {
                                                        readonly type: "null";
                                                    }];
                                                    readonly title: "Prize";
                                                    readonly description: "dtype: float32. \n\n The weight assigned to the prize in accumulated prizes for each job fulfilled.This will be negated from overall values accumulated with other objectives.For example, if cost accumulated is 10 and objective value for it is 1, and if the prize accumulated is 3 and objective is 2, then total cost would look something like this 10 x 1 - 3 x 2 = 4.";
                                                    readonly examples: readonly [0];
                                                };
                                                readonly vehicle_fixed_cost: {
                                                    readonly anyOf: readonly [{
                                                        readonly type: "number";
                                                    }, {
                                                        readonly type: "null";
                                                    }];
                                                    readonly title: "Vehicle Fixed Cost";
                                                    readonly description: "dtype: float32. \n\n The weight assigned to the accumulated fixed costs of each vehicle used in solution";
                                                    readonly examples: readonly [0];
                                                };
                                            };
                                            readonly additionalProperties: false;
                                            readonly type: "object";
                                            readonly title: "Objective";
                                        }, {
                                            readonly type: "null";
                                        }];
                                        readonly description: "Values provided dictate the linear combination of factors used to evaluate solution quality.Only prize will be negated, all others gets accumulated. That's why sometime you might come across negative value as solution cost.";
                                    };
                                    readonly config_file: {
                                        readonly anyOf: readonly [{
                                            readonly type: "string";
                                        }, {
                                            readonly type: "null";
                                        }];
                                        readonly title: "Config File";
                                        readonly description: "Dump configuration information in a given file as yaml";
                                    };
                                    readonly verbose_mode: {
                                        readonly anyOf: readonly [{
                                            readonly type: "boolean";
                                        }, {
                                            readonly type: "null";
                                        }];
                                        readonly title: "Verbose Mode";
                                        readonly description: "Displaying internal information during the solver execution.";
                                        readonly default: false;
                                    };
                                    readonly error_logging: {
                                        readonly anyOf: readonly [{
                                            readonly type: "boolean";
                                        }, {
                                            readonly type: "null";
                                        }];
                                        readonly title: "Error Logging";
                                        readonly description: "Displaying constraint error information during the solver execution.";
                                        readonly default: true;
                                    };
                                };
                                readonly additionalProperties: false;
                                readonly type: "object";
                                readonly title: "UpdateSolverSettingsConfig";
                            }, {
                                readonly type: "null";
                            }];
                        };
                    };
                    readonly additionalProperties: false;
                    readonly type: "object";
                    readonly required: readonly ["fleet_data", "task_data"];
                    readonly title: "OptimizedRoutingData";
                }, {
                    readonly type: "null";
                }];
                readonly title: "Data";
                readonly description: "The data that needs to be processed by the service. For detailed explanations of each field, please consult the following link: <a href=\"https://docs.nvidia.com/cuopt/service/latest/data-requirements.html\">data requirements</a> . To ensure best practices, please refer to: <a href=\"https://docs.nvidia.com/cuopt/service/latest/best-practices.html\">best practices</a>. For examples, you can find them at: <a href=\"https://github.com/NVIDIA/cuOpt-Resources/tree/branch-23.10/notebooks/routing/service\">notebooks</a>. If the size of the data exceeds 250KB, please utilize the large assets API to upload it to s3. In such cases, set the data as null and include the header NVCF-INPUT-ASSET-REFERENCES: $ASSET_ID in the POST request.";
            };
            readonly parameters: {
                readonly anyOf: readonly [{
                    readonly type: "object";
                    readonly additionalProperties: true;
                }, {
                    readonly type: "null";
                }];
                readonly title: "Parameters";
                readonly description: "unused/ignored but retained for compatibility";
            };
            readonly client_version: {
                readonly anyOf: readonly [{
                    readonly type: "string";
                }, {
                    readonly type: "null";
                }];
                readonly title: "Client Version";
                readonly description: "cuOpt client version. Set to 'custom' to skip version check.";
            };
        };
        readonly additionalProperties: false;
        readonly type: "object";
        readonly required: readonly ["data"];
        readonly title: "cuoptData";
        readonly $schema: "https://json-schema.org/draft/2020-12/schema#";
    };
    readonly metadata: {
        readonly allOf: readonly [{
            readonly type: "object";
            readonly properties: {
                readonly "NVCF-INPUT-ASSET-REFERENCES": {
                    readonly type: "string";
                    readonly $schema: "https://json-schema.org/draft/2020-12/schema#";
                    readonly description: "String of asset IDs separated by commas. Data is uploaded to AWS S3 using NVCF Asset APIs and associated with these asset IDs.If the size of the json is more than 200KB, it needs to be uploaded to a presigned S3 URL bucket. The presigned URL allows for secure and temporary access to the S3 bucket for uploading the image. Once the asset is requested, an asset ID is generated for it. Please include this asset ID in this header and to use the uploaded json the 'data' field in the request body should be null; otherwise, it will be ignored.";
                };
            };
            readonly required: readonly [];
        }];
    };
    readonly response: {
        readonly "200": {
            readonly anyOf: readonly [{
                readonly properties: {};
                readonly additionalProperties: false;
                readonly type: "object";
                readonly title: "EmptyDict";
            }, {
                readonly properties: {
                    readonly response: {
                        readonly anyOf: readonly [{
                            readonly properties: {
                                readonly solver_response: {
                                    readonly description: "Feasible solution";
                                    readonly type: "object";
                                    readonly title: "FeasibleResultData";
                                    readonly additionalProperties: false;
                                    readonly properties: {
                                        readonly status: {
                                            readonly type: "integer";
                                            readonly title: "Status";
                                            readonly description: "0 - Solution is available \n1 - Infeasible solution is available \n";
                                            readonly default: 0;
                                            readonly examples: readonly [0];
                                        };
                                        readonly num_vehicles: {
                                            readonly type: "integer";
                                            readonly title: "Num Vehicles";
                                            readonly description: "Number of vehicle being used for the solution";
                                            readonly default: -1;
                                            readonly examples: readonly [2];
                                        };
                                        readonly solution_cost: {
                                            readonly type: "number";
                                            readonly title: "Solution Cost";
                                            readonly description: "Total cost of the solution";
                                            readonly default: -1;
                                            readonly examples: readonly [2];
                                        };
                                        readonly vehicle_data: {
                                            readonly type: "object";
                                            readonly title: "Vehicle Data";
                                            readonly description: "All the details of vehicle routes and timestamps";
                                            readonly additionalProperties: {
                                                readonly type: "object";
                                                readonly title: "VehicleData";
                                                readonly additionalProperties: false;
                                                readonly properties: {
                                                    readonly task_id: {
                                                        readonly type: "array";
                                                        readonly title: "Task Id";
                                                        readonly description: "task_ids being assigned to vehicle along with depot and breaks";
                                                        readonly default: readonly [];
                                                        readonly items: {
                                                            readonly type: "string";
                                                        };
                                                    };
                                                    readonly arrival_stamp: {
                                                        readonly type: "array";
                                                        readonly title: "Arrival Stamp";
                                                        readonly description: "arrival stamps at each task locations";
                                                        readonly default: readonly [];
                                                        readonly items: {
                                                            readonly type: "number";
                                                        };
                                                    };
                                                    readonly route: {
                                                        readonly type: "array";
                                                        readonly title: "Route";
                                                        readonly description: "Route indices as per waypoint graph or cost matrix provided";
                                                        readonly default: readonly [];
                                                        readonly items: {
                                                            readonly type: "integer";
                                                        };
                                                    };
                                                    readonly type: {
                                                        readonly type: "array";
                                                        readonly title: "Type";
                                                        readonly description: "Type of routing point, whether it is Depot, Waypoint - w \nDelivery, Break, Pickup \n";
                                                        readonly default: readonly [];
                                                        readonly items: {
                                                            readonly type: "string";
                                                            readonly enum: readonly ["Depot", "Pickup", "Delivery", "Break", "w"];
                                                            readonly title: "LocationTypeEnum";
                                                            readonly description: "`Depot` `Pickup` `Delivery` `Break` `w`";
                                                        };
                                                    };
                                                };
                                            };
                                        };
                                        readonly msg: {
                                            readonly anyOf: readonly [{
                                                readonly type: "string";
                                            }, {
                                                readonly type: "null";
                                            }];
                                            readonly title: "Msg";
                                            readonly description: "Any information pertaining to the run.";
                                        };
                                    };
                                };
                                readonly perf_times: {
                                    readonly anyOf: readonly [{
                                        readonly type: "object";
                                        readonly additionalProperties: true;
                                    }, {
                                        readonly type: "null";
                                    }];
                                    readonly title: "Perf Times";
                                    readonly description: "Etl and Solve times of the solve call";
                                };
                            };
                            readonly additionalProperties: false;
                            readonly type: "object";
                            readonly title: "FeasibleSolve";
                        }, {
                            readonly properties: {
                                readonly solver_infeasible_response: {
                                    readonly description: "Infeasible solution, this can mean the problem itself is infeasible or solver requires more time to find a solution. Setting default solve time is suggested in case you are not aware of the expected time.";
                                    readonly type: "object";
                                    readonly title: "InfeasibleResultData";
                                    readonly additionalProperties: false;
                                    readonly properties: {
                                        readonly status: {
                                            readonly type: "integer";
                                            readonly title: "Status";
                                            readonly description: "1 - Infeasible solution is available \n";
                                            readonly default: 1;
                                            readonly examples: readonly [1];
                                        };
                                        readonly num_vehicles: {
                                            readonly type: "integer";
                                            readonly title: "Num Vehicles";
                                            readonly description: "Number of vehicle being used for the solution";
                                            readonly default: -1;
                                            readonly examples: readonly [2];
                                        };
                                        readonly solution_cost: {
                                            readonly type: "number";
                                            readonly title: "Solution Cost";
                                            readonly description: "Total cost of the solution";
                                            readonly default: -1;
                                            readonly examples: readonly [2];
                                        };
                                        readonly vehicle_data: {
                                            readonly type: "object";
                                            readonly title: "Vehicle Data";
                                            readonly description: "All the details of vehicle routes and timestamps";
                                            readonly additionalProperties: {
                                                readonly type: "object";
                                                readonly title: "VehicleData";
                                                readonly additionalProperties: false;
                                                readonly properties: {
                                                    readonly task_id: {
                                                        readonly type: "array";
                                                        readonly title: "Task Id";
                                                        readonly description: "task_ids being assigned to vehicle along with depot and breaks";
                                                        readonly default: readonly [];
                                                        readonly items: {
                                                            readonly type: "string";
                                                        };
                                                    };
                                                    readonly arrival_stamp: {
                                                        readonly type: "array";
                                                        readonly title: "Arrival Stamp";
                                                        readonly description: "arrival stamps at each task locations";
                                                        readonly default: readonly [];
                                                        readonly items: {
                                                            readonly type: "number";
                                                        };
                                                    };
                                                    readonly route: {
                                                        readonly type: "array";
                                                        readonly title: "Route";
                                                        readonly description: "Route indices as per waypoint graph or cost matrix provided";
                                                        readonly default: readonly [];
                                                        readonly items: {
                                                            readonly type: "integer";
                                                        };
                                                    };
                                                    readonly type: {
                                                        readonly type: "array";
                                                        readonly title: "Type";
                                                        readonly description: "Type of routing point, whether it is Depot, Waypoint - w \nDelivery, Break, Pickup \n";
                                                        readonly default: readonly [];
                                                        readonly items: {
                                                            readonly type: "string";
                                                            readonly enum: readonly ["Depot", "Pickup", "Delivery", "Break", "w"];
                                                            readonly title: "LocationTypeEnum";
                                                            readonly description: "`Depot` `Pickup` `Delivery` `Break` `w`";
                                                        };
                                                    };
                                                };
                                            };
                                        };
                                        readonly msg: {
                                            readonly anyOf: readonly [{
                                                readonly type: "string";
                                            }, {
                                                readonly type: "null";
                                            }];
                                            readonly title: "Msg";
                                            readonly description: "Any information pertaining to the run.";
                                        };
                                    };
                                };
                                readonly perf_times: {
                                    readonly anyOf: readonly [{
                                        readonly type: "object";
                                        readonly additionalProperties: true;
                                    }, {
                                        readonly type: "null";
                                    }];
                                    readonly title: "Perf Times";
                                    readonly description: "Etl and Solve times of the solve call";
                                };
                            };
                            readonly additionalProperties: false;
                            readonly type: "object";
                            readonly title: "InFeasibleSolve";
                        }];
                        readonly title: "Response";
                        readonly description: "Response";
                    };
                    readonly warnings: {
                        readonly items: {
                            readonly type: "string";
                        };
                        readonly type: "array";
                        readonly title: "Warnings";
                        readonly description: "List of warnings for users to handle issues";
                        readonly default: readonly [];
                    };
                    readonly notes: {
                        readonly items: {
                            readonly type: "string";
                        };
                        readonly type: "array";
                        readonly title: "Notes";
                        readonly description: "Any notes for users";
                        readonly default: readonly [];
                    };
                };
                readonly additionalProperties: false;
                readonly type: "object";
                readonly required: readonly ["response"];
                readonly title: "ResponseModel";
            }];
            readonly title: "Response Cuopt Cuopt Cuopt Post";
            readonly $schema: "https://json-schema.org/draft/2020-12/schema#";
        };
        readonly "202": {
            readonly $schema: "https://json-schema.org/draft/2020-12/schema#";
        };
        readonly "400": {
            readonly properties: {
                readonly detail: {
                    readonly type: "string";
                    readonly title: "Detail";
                    readonly description: "Error details";
                };
            };
            readonly type: "object";
            readonly required: readonly ["detail"];
            readonly title: "DetailModel";
            readonly $schema: "https://json-schema.org/draft/2020-12/schema#";
        };
        readonly "409": {
            readonly properties: {
                readonly detail: {
                    readonly type: "string";
                    readonly title: "Detail";
                    readonly description: "Error details";
                };
            };
            readonly type: "object";
            readonly required: readonly ["detail"];
            readonly title: "DetailModel";
            readonly $schema: "https://json-schema.org/draft/2020-12/schema#";
        };
        readonly "422": {
            readonly properties: {
                readonly detail: {
                    readonly type: "string";
                    readonly title: "Detail";
                    readonly description: "Error details";
                };
            };
            readonly type: "object";
            readonly required: readonly ["detail"];
            readonly title: "DetailModel";
            readonly $schema: "https://json-schema.org/draft/2020-12/schema#";
        };
        readonly "500": {
            readonly properties: {
                readonly detail: {
                    readonly type: "string";
                    readonly title: "Detail";
                    readonly description: "Error details";
                };
            };
            readonly type: "object";
            readonly required: readonly ["detail"];
            readonly title: "DetailModel";
            readonly $schema: "https://json-schema.org/draft/2020-12/schema#";
        };
    };
};
declare const NvidiaCuoptStatuspolling: {
    readonly metadata: {
        readonly allOf: readonly [{
            readonly type: "object";
            readonly properties: {
                readonly requestId: {
                    readonly type: "string";
                    readonly format: "uuid";
                    readonly maxLength: 36;
                    readonly $schema: "https://json-schema.org/draft/2020-12/schema#";
                    readonly description: "requestId to poll results";
                };
            };
            readonly required: readonly ["requestId"];
        }];
    };
    readonly response: {
        readonly "200": {
            readonly $schema: "https://json-schema.org/draft/2020-12/schema#";
        };
        readonly "202": {
            readonly $schema: "https://json-schema.org/draft/2020-12/schema#";
        };
        readonly "422": {
            readonly properties: {
                readonly type: {
                    readonly type: "string";
                    readonly description: "Error type";
                };
                readonly title: {
                    readonly type: "string";
                    readonly description: "Error title";
                };
                readonly status: {
                    readonly type: "integer";
                    readonly description: "Error status code";
                };
                readonly detail: {
                    readonly type: "string";
                    readonly description: "Detailed information about the error";
                };
                readonly instance: {
                    readonly type: "string";
                    readonly description: "Function instance used to invoke the request";
                };
                readonly requestId: {
                    readonly type: "string";
                    readonly format: "uuid";
                    readonly description: "UUID of the request";
                };
            };
            readonly type: "object";
            readonly required: readonly ["type", "title", "status", "detail", "instance", "requestId"];
            readonly title: "InvokeError";
            readonly $schema: "https://json-schema.org/draft/2020-12/schema#";
        };
        readonly "500": {
            readonly properties: {
                readonly type: {
                    readonly type: "string";
                    readonly description: "Error type";
                };
                readonly title: {
                    readonly type: "string";
                    readonly description: "Error title";
                };
                readonly status: {
                    readonly type: "integer";
                    readonly description: "Error status code";
                };
                readonly detail: {
                    readonly type: "string";
                    readonly description: "Detailed information about the error";
                };
                readonly instance: {
                    readonly type: "string";
                    readonly description: "Function instance used to invoke the request";
                };
                readonly requestId: {
                    readonly type: "string";
                    readonly format: "uuid";
                    readonly description: "UUID of the request";
                };
            };
            readonly type: "object";
            readonly required: readonly ["type", "title", "status", "detail", "instance", "requestId"];
            readonly title: "InvokeError";
            readonly $schema: "https://json-schema.org/draft/2020-12/schema#";
        };
    };
};
export { NvidiaCuoptInfer, NvidiaCuoptStatuspolling };
