/**
 * src/services/federatedConnectors/waterSupplyConnector.js
 * Connector for Department of Water Supply & Sewerage.
 */

import { BaseConnector } from "./baseConnector.js";
import { FEDERATED_DEPARTMENTS } from "../../data/federatedQueryContract.js";
import { SYNTHETIC_WATER_DATA } from "../../data/syntheticFederatedFixtures.js";

export class WaterSupplyConnector extends BaseConnector {
  constructor() {
    super({
      id: FEDERATED_DEPARTMENTS.WATER_SUPPLY.id,
      name: FEDERATED_DEPARTMENTS.WATER_SUPPLY.name,
      code: FEDERATED_DEPARTMENTS.WATER_SUPPLY.code,
      category: FEDERATED_DEPARTMENTS.WATER_SUPPLY.category,
      schemaVersion: "1.0.0",
      schemaFields: ["id", "wardId", "type", "severity", "resolved", "timestamp"],
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
      throw new Error(`Internal connector error in ${this.id}: Database connection refused`);
    }

    // Filter locally at the source node
    let dataset = [...SYNTHETIC_WATER_DATA];

    if (filters.ward && filters.ward !== "ALL") {
      const wardId = parseInt(filters.ward, 10);
      dataset = dataset.filter((item) => item.wardId === wardId);
    }

    if (filters.severity) {
      dataset = dataset.filter((item) => item.severity === filters.severity);
    }

    // Compute aggregate statistics near source (NO raw rows returned)
    const byWard = {};
    const byType = {};
    let resolvedCount = 0;

    for (const item of dataset) {
      byWard[item.wardId] = (byWard[item.wardId] || 0) + 1;
      byType[item.type] = (byType[item.type] || 0) + 1;
      if (item.resolved) resolvedCount += 1;
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
        resolutionRate: dataset.length > 0 ? Math.round((resolvedCount / dataset.length) * 100) : 0,
      },
    };
  }
}
