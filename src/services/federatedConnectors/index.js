/**
 * src/services/federatedConnectors/index.js
 * Registry and connector discovery for all department adapters.
 */

import { WaterSupplyConnector } from "./waterSupplyConnector.js";
import { RoadsInfrastructureConnector } from "./roadsInfrastructureConnector.js";
import { HealthSanitationConnector } from "./healthSanitationConnector.js";
import { UrbanTransportConnector } from "./urbanTransportConnector.js";
import { FEDERATED_DEPARTMENTS } from "../../data/federatedQueryContract.js";

// Singleton connector instances
const connectors = {
  [FEDERATED_DEPARTMENTS.WATER_SUPPLY.id]: new WaterSupplyConnector(),
  [FEDERATED_DEPARTMENTS.ROADS_INFRASTRUCTURE.id]: new RoadsInfrastructureConnector(),
  [FEDERATED_DEPARTMENTS.HEALTH_SANITATION.id]: new HealthSanitationConnector(),
  [FEDERATED_DEPARTMENTS.URBAN_TRANSPORT.id]: new UrbanTransportConnector(),
};

/**
 * Returns a map of all registered connector instances.
 */
export function getRegisteredConnectors() {
  return connectors;
}

/**
 * Returns a connector instance by ID.
 * @param {string} id
 */
export function getConnectorById(id) {
  return connectors[id] || null;
}

/**
 * Resets all fault injections and simulated states on registered connectors.
 */
export function resetAllConnectors() {
  Object.values(connectors).forEach((c) => c.resetFaultInjection());
}
