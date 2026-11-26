/**
 * src/services/federatedConnectors/roadsInfrastructureConnector.js
 * Connector for Public Works & Roads Department.
 */

import { BaseConnector } from "./baseConnector.js";
import { FEDERATED_DEPARTMENTS } from "../../data/federatedQueryContract.js";
import { SYNTHETIC_ROADS_DATA } from "../../data/syntheticFederatedFixtures.js";

export class RoadsInfrastructureConnector extends BaseConnector {
  constructor() {
    super({
      id: FEDERATED_DEPARTMENTS.ROADS_INFRASTRUCTURE.id,
      name: FEDERATED_DEPARTMENTS.ROADS_INFRASTRUCTURE.name,
      code: FEDERATED_DEPARTMENTS.ROADS_INFRASTRUCTURE.code,
      category: FEDERATED_DEPARTMENTS.ROADS_INFRASTRUCTURE.category,
      schemaVersion: "1.0.0",
      schemaFields: ["id", "wardId", "type", "severity", "status", "repairCostEstimate", "timestamp"],
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
      throw new Error(`Internal connector error in ${this.id}: Local storage unavailable`);
    }

    let dataset = [...SYNTHETIC_ROADS_DATA];

    if (filters.ward && filters.ward !== "ALL") {
      const wardId = parseInt(filters.ward, 10);
      dataset = dataset.filter((item) => item.wardId === wardId);
    }

    const byWard = {};
    const byType = {};
    let totalEstimatedCost = 0;

    for (const item of dataset) {
      byWard[item.wardId] = (byWard[item.wardId] || 0) + 1;
      byType[item.type] = (byType[item.type] || 0) + 1;
      totalEstimatedCost += item.repairCostEstimate || 0;
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
        totalEstimatedCost,
        avgEstimatedCost: dataset.length > 0 ? Math.round(totalEstimatedCost / dataset.length) : 0,
      },
    };
  }
}
