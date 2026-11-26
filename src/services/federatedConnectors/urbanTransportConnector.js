/**
 * src/services/federatedConnectors/urbanTransportConnector.js
 * Connector for Directorate of Urban Public Transit.
 */

import { BaseConnector } from "./baseConnector.js";
import { FEDERATED_DEPARTMENTS } from "../../data/federatedQueryContract.js";
import { SYNTHETIC_TRANSIT_DATA } from "../../data/syntheticFederatedFixtures.js";

export class UrbanTransportConnector extends BaseConnector {
  constructor() {
    super({
      id: FEDERATED_DEPARTMENTS.URBAN_TRANSPORT.id,
      name: FEDERATED_DEPARTMENTS.URBAN_TRANSPORT.name,
      code: FEDERATED_DEPARTMENTS.URBAN_TRANSPORT.code,
      category: FEDERATED_DEPARTMENTS.URBAN_TRANSPORT.category,
      schemaVersion: "1.0.0",
      schemaFields: ["id", "wardId", "type", "delayMinutes", "accessibilityBarrier", "timestamp"],
    });
  }

  async executeLocalAggregate(filters = {}, timeoutMs = 1500) {
    const start = performance.now();

    if (this.shouldTimeout) {
      await new Promise((resolve) => setTimeout(resolve, timeoutMs + 50));
      throw new Error(`Connector '${this.id}' timed out after ${timeoutMs}ms`);
    }

    if (this.simulatedLatencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.simulatedLatencyMs));
    }

    if (this.shouldFail) {
      throw new Error(`Internal connector error in ${this.id}: Remote gateway 502`);
    }

    let dataset = [...SYNTHETIC_TRANSIT_DATA];

    if (filters.ward && filters.ward !== "ALL") {
      const wardId = parseInt(filters.ward, 10);
      dataset = dataset.filter((item) => item.wardId === wardId);
    }

    const byWard = {};
    const byType = {};
    let totalDelay = 0;
    let barrierCount = 0;

    for (const item of dataset) {
      byWard[item.wardId] = (byWard[item.wardId] || 0) + 1;
      byType[item.type] = (byType[item.type] || 0) + 1;
      totalDelay += item.delayMinutes || 0;
      if (item.accessibilityBarrier) barrierCount += 1;
    }

    const duration = Math.round(performance.now() - start);

    return {
      connectorId: this.id,
      departmentCode: this.code,
      departmentName: this.name,
      schemaHash: this.getSchemaSignature(),
      status: "SUCCESS",
      executionTimeMs: duration,
      aggregates: {
        totalRecords: dataset.length,
        byWard,
        breakdown: byType,
        avgDelayMinutes: dataset.length > 0 ? Math.round(totalDelay / dataset.length) : 0,
        accessibilityBarriers: barrierCount,
      },
    };
  }
}
