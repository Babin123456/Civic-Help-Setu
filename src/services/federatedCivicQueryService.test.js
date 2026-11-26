/**
 * src/services/federatedCivicQueryService.test.js
 * Comprehensive unit and integration tests for Federated Civic Data Query Layer (#1162).
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  executeFederatedCivicQuery,
  checkFederatedNodeHealth,
  generateFederatedQuerySeal,
} from "./federatedCivicQueryService.js";
import {
  validateFederatedQueryRequest,
  applyPrivacyThreshold,
  AVAILABILITY_STATES,
} from "../data/federatedQueryContract.js";
import {
  getConnectorById,
  resetAllConnectors,
} from "./federatedConnectors/index.js";

describe("Federated Civic Query Service (#1162)", () => {
  beforeEach(() => {
    resetAllConnectors();
  });

  describe("Contract Validation & Purpose Scoping", () => {
    it("validates an authorized query request", () => {
      const validReq = {
        purpose: "INFRASTRUCTURE_MONITORING",
        targetDepartments: ["water_supply", "roads_infrastructure"],
        ward: "ALL",
      };
      const result = validateFederatedQueryRequest(validReq);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("rejects missing or unauthorized purpose", () => {
      const invalidReq = {
        purpose: "COMMERCIAL_MARKETING_SURVEILLANCE",
        targetDepartments: ["water_supply"],
      };
      const result = validateFederatedQueryRequest(invalidReq);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/Invalid or missing purpose/);
    });

    it("rejects unknown target department IDs", () => {
      const invalidReq = {
        purpose: "INFRASTRUCTURE_MONITORING",
        targetDepartments: ["non_existent_dept"],
      };
      const result = validateFederatedQueryRequest(invalidReq);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/Unknown department ID/);
    });

    it("rejects invalid ward boundaries", () => {
      const invalidReq = {
        purpose: "INFRASTRUCTURE_MONITORING",
        targetDepartments: ["water_supply"],
        ward: "invalid_ward_9999",
      };
      const result = validateFederatedQueryRequest(invalidReq);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/Ward must be 'ALL' or an integer/);
    });
  });

  describe("Differential Privacy & k-Anonymity Threshold Enforcement", () => {
    it("suppresses counts below the minimum privacy threshold (k < 10)", () => {
      const belowThreshold = applyPrivacyThreshold(4, 10);
      expect(belowThreshold.isSuppressed).toBe(true);
      expect(belowThreshold.value).toBeNull();
      expect(belowThreshold.displayValue).toBe("< 10 (Suppressed for Privacy)");
    });

    it("allows counts meeting or exceeding the threshold (k >= 10)", () => {
      const aboveThreshold = applyPrivacyThreshold(15, 10);
      expect(aboveThreshold.isSuppressed).toBe(false);
      expect(aboveThreshold.value).toBe(15);
      expect(aboveThreshold.displayValue).toBe("15");
    });

    it("handles zero counts without suppression", () => {
      const zeroCount = applyPrivacyThreshold(0, 10);
      expect(zeroCount.isSuppressed).toBe(false);
      expect(zeroCount.value).toBe(0);
      expect(zeroCount.displayValue).toBe("0");
    });

    it("enforces k-anonymity on Ward 3 in real federated execution", async () => {
      const query = {
        purpose: "PUBLIC_HEALTH_SURVEILLANCE",
        targetDepartments: ["water_supply", "health_sanitation"],
        ward: "ALL",
      };

      const result = await executeFederatedCivicQuery(query);
      expect(result.success).toBe(true);

      // In synthetic fixtures, Ward 3 has 4 water incidents (suppressed) and 3 health incidents (suppressed)
      const waterWard3 = result.data.water_supply.aggregates.privacyDetails[3];
      expect(waterWard3.isSuppressed).toBe(true);
      expect(result.data.water_supply.aggregates.byWard[3]).toBe("< 10 (Suppressed for Privacy)");

      // Ward 2 has 18 water incidents (not suppressed)
      const waterWard2 = result.data.water_supply.aggregates.privacyDetails[2];
      expect(waterWard2.isSuppressed).toBe(false);
      expect(result.data.water_supply.aggregates.byWard[2]).toBe("18");

      expect(result.privacyMetrics.suppressedWardCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Resilience, Timeouts & Partial Availability", () => {
    it("returns FULL_AVAILABILITY when all targeted connectors respond within SLA", async () => {
      const query = {
        purpose: "INFRASTRUCTURE_MONITORING",
        targetDepartments: ["water_supply", "roads_infrastructure"],
        ward: "ALL",
      };

      const result = await executeFederatedCivicQuery(query, { timeoutMs: 1000 });
      expect(result.success).toBe(true);
      expect(result.status).toBe("SUCCESS");
      expect(result.availability).toBe(AVAILABILITY_STATES.FULL);
      expect(result.respondingNodes).toBe(2);
      expect(result.degradedNodes).toHaveLength(0);
      expect(result.provenanceSeal).toMatch(/^SEAL-FED-[A-F0-9]{4}-[A-F0-9]{4}$/);
    });

    it("returns PARTIAL_AVAILABILITY and isolates degraded node on connector timeout", async () => {
      const healthConn = getConnectorById("health_sanitation");
      healthConn.setFaultInjection({ timeout: true });

      const query = {
        purpose: "PUBLIC_HEALTH_SURVEILLANCE",
        targetDepartments: ["water_supply", "health_sanitation"],
        ward: "ALL",
      };

      // Query with 100ms timeout
      const result = await executeFederatedCivicQuery(query, { timeoutMs: 100 });
      expect(result.success).toBe(true);
      expect(result.status).toBe("PARTIAL");
      expect(result.availability).toBe(AVAILABILITY_STATES.PARTIAL);
      expect(result.respondingNodes).toBe(1);
      expect(result.degradedNodes).toHaveLength(1);
      expect(result.degradedNodes[0].connectorId).toBe("health_sanitation");
      expect(result.degradedNodes[0].errorCode).toBe("CONNECTOR_TIMEOUT");

      // Water data should still be present
      expect(result.data.water_supply).toBeDefined();
      expect(result.data.health_sanitation).toBeUndefined();
      expect(result.provenanceSeal).toBeDefined();
    });

    it("detects schema drift and isolates drifted connector safely", async () => {
      const roadsConn = getConnectorById("roads_infrastructure");
      roadsConn.setFaultInjection({ driftSchema: true });

      const query = {
        purpose: "INFRASTRUCTURE_MONITORING",
        targetDepartments: ["water_supply", "roads_infrastructure"],
        ward: "ALL",
      };

      const result = await executeFederatedCivicQuery(query);
      expect(result.success).toBe(true);
      expect(result.status).toBe("PARTIAL");
      expect(result.availability).toBe(AVAILABILITY_STATES.PARTIAL);
      expect(result.degradedNodes[0].connectorId).toBe("roads_infrastructure");
      expect(result.degradedNodes[0].errorCode).toBe("SCHEMA_DRIFT_DETECTED");
    });

    it("returns SERVICE_UNAVAILABLE when all targeted connectors fail", async () => {
      const waterConn = getConnectorById("water_supply");
      waterConn.setFaultInjection({ timeout: true });

      const query = {
        purpose: "INFRASTRUCTURE_MONITORING",
        targetDepartments: ["water_supply"],
        ward: "ALL",
      };

      const result = await executeFederatedCivicQuery(query, { timeoutMs: 50 });
      expect(result.success).toBe(false);
      expect(result.status).toBe("FAILED");
      expect(result.availability).toBe(AVAILABILITY_STATES.NONE);
      expect(result.respondingNodes).toBe(0);
      expect(result.provenanceSeal).toBeNull();
    });
  });

  describe("Deterministic Cryptographic Provenance", () => {
    it("generates deterministic provenance seal for identical inputs", () => {
      const query = { purpose: "INFRASTRUCTURE_MONITORING", ward: "1" };
      const deptResults = {
        water_supply: { schemaHash: "HASH_A" },
        roads_infrastructure: { schemaHash: "HASH_B" },
      };
      const timestamp = "2026-11-25T12:00:00Z";

      const seal1 = generateFederatedQuerySeal(query, deptResults, timestamp);
      const seal2 = generateFederatedQuerySeal(query, deptResults, timestamp);
      expect(seal1).toBe(seal2);
      expect(seal1).toMatch(/^SEAL-FED-[A-F0-9]{4}-[A-F0-9]{4}$/);
    });

    it("produces distinct seals if inputs or timestamps differ", () => {
      const query = { purpose: "INFRASTRUCTURE_MONITORING", ward: "1" };
      const deptResults = { water_supply: { schemaHash: "HASH_A" } };

      const sealA = generateFederatedQuerySeal(query, deptResults, "2026-11-25T12:00:00Z");
      const sealB = generateFederatedQuerySeal(query, deptResults, "2026-11-25T12:05:00Z");
      expect(sealA).not.toBe(sealB);
    });
  });

  describe("Node Health Monitoring", () => {
    it("reports healthy status for normal operational connectors", async () => {
      const health = await checkFederatedNodeHealth();
      expect(health.water_supply.status).toBe("HEALTHY");
      expect(health.roads_infrastructure.status).toBe("HEALTHY");
      expect(health.health_sanitation.status).toBe("HEALTHY");
      expect(health.urban_transport.status).toBe("HEALTHY");
    });
  });
});
