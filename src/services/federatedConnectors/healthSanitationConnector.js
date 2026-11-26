/**
 * src/services/federatedConnectors/healthSanitationConnector.js
 * Connector for Municipal Health & Sanitation Directorate.
 */

import { BaseConnector } from "./baseConnector.js";
import { FEDERATED_DEPARTMENTS } from "../../data/federatedQueryContract.js";
import { SYNTHETIC_HEALTH_DATA } from "../../data/syntheticFederatedFixtures.js";

export class HealthSanitationConnector extends BaseConnector {
  constructor() {
    super({
      id: FEDERATED_DEPARTMENTS.HEALTH_SANITATION.id,
      name: FEDERATED_DEPARTMENTS.HEALTH_SANITATION.name,
      code: FEDERATED_DEPARTMENTS.HEALTH_SANITATION.code,
      category: FEDERATED_DEPARTMENTS.HEALTH_SANITATION.category,
      schemaVersion: "1.0.0",
      schemaFields: ["id", "wardId", "type", "severity", "inspectionDone", "timestamp"],
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
      throw new Error(`Internal connector error in ${this.id}: Service unreachable`);
    }

    let dataset = [...SYNTHETIC_HEALTH_DATA];

    if (filters.ward && filters.ward !== "ALL") {
      const wardId = parseInt(filters.ward, 10);
      dataset = dataset.filter((item) => item.wardId === wardId);
    }

    const byWard = {};
    const byType = {};
    let inspectedCount = 0;

    for (const item of dataset) {
      byWard[item.wardId] = (byWard[item.wardId] || 0) + 1;
      byType[item.type] = (byType[item.type] || 0) + 1;
      if (item.inspectionDone) inspectedCount += 1;
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
        inspectionRate: dataset.length > 0 ? Math.round((inspectedCount / dataset.length) * 100) : 0,
      },
    };
  }
}
