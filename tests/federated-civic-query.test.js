/**
 * tests/federated-civic-query.test.js
 * API endpoint tests for /api/federated-civic-query (#1162).
 */

import { describe, it, expect, beforeEach } from "vitest";
import handler, { scanPayloadForPII } from "../api/_lib/handlers/federated-civic-query.js";
import { resetAllConnectors } from "../src/services/federatedConnectors/index.js";

function createMockReqRes({ method = "GET", body = {}, headers = {} } = {}) {
  const req = {
    method,
    body,
    headers: {
      "x-real-ip": "127.0.0.1",
      ...headers,
    },
    query: {},
  };

  const res = {
    statusCode: 200,
    headers: {},
    ended: false,
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      this.ended = true;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };

  return { req, res };
}

describe("api/federated-civic-query (#1162)", () => {
  beforeEach(() => {
    resetAllConnectors();
  });

  describe("Anti-PII Scanning Guard", () => {
    it("detects Aadhaar numbers in request bodies", () => {
      const piiBody = { note: "Citizen Aadhaar is 2345 6789 0123" };
      expect(scanPayloadForPII(piiBody)).toMatch(/Aadhaar number detected/);
    });

    it("detects PAN numbers in request bodies", () => {
      const piiBody = { query: "Filter by ABCDE1234F" };
      expect(scanPayloadForPII(piiBody)).toMatch(/PAN number detected/);
    });

    it("detects phone numbers in request bodies", () => {
      const piiBody = { contact: "Call 9876543210" };
      expect(scanPayloadForPII(piiBody)).toMatch(/Phone number detected/);
    });

    it("detects emails in request bodies", () => {
      const piiBody = { user: "citizen@example.gov" };
      expect(scanPayloadForPII(piiBody)).toMatch(/Email address detected/);
    });

    it("returns null for clean analytical payloads", () => {
      const cleanBody = {
        purpose: "INFRASTRUCTURE_MONITORING",
        targetDepartments: ["water_supply"],
        ward: "1",
      };
      expect(scanPayloadForPII(cleanBody)).toBeNull();
    });
  });

  describe("HTTP Method Handling", () => {
    it("handles GET to return metadata, registered departments, and presets", async () => {
      const { req, res } = createMockReqRes({ method: "GET" });
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.service).toBe("Federated Civic Data Query Layer");
      expect(res.body.schemaVersion).toBe("1.0.0");
      expect(res.body.registeredDepartments).toHaveLength(4);
      expect(res.body.presets.length).toBeGreaterThanOrEqual(1);
      expect(res.body.nodeHealth).toBeDefined();
    });

    it("handles POST to execute compliant federated query", async () => {
      const { req, res } = createMockReqRes({
        method: "POST",
        body: {
          purpose: "INFRASTRUCTURE_MONITORING",
          targetDepartments: ["water_supply", "roads_infrastructure"],
          ward: "ALL",
        },
      });

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.availability).toBe("FULL_AVAILABILITY");
      expect(res.body.provenanceSeal).toMatch(/^SEAL-FED-/);
      expect(res.body.data.water_supply).toBeDefined();
      expect(res.body.data.roads_infrastructure).toBeDefined();
    });

    it("rejects POST containing personal data with 400 Bad Request", async () => {
      const { req, res } = createMockReqRes({
        method: "POST",
        body: {
          purpose: "INFRASTRUCTURE_MONITORING",
          targetDepartments: ["water_supply"],
          citizenPhone: "9876543210",
        },
      });

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe("PII Violation");
      expect(res.body.message).toMatch(/Phone number detected/);
    });

    it("rejects invalid request purpose with 400 Bad Request", async () => {
      const { req, res } = createMockReqRes({
        method: "POST",
        body: {
          purpose: "UNAUTHORIZED_COMMERCIAL_DATA_EXTRACTION",
          targetDepartments: ["water_supply"],
        },
      });

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe("Bad Request");
    });

    it("rejects unsupported HTTP methods with 405 Method Not Allowed", async () => {
      const { req, res } = createMockReqRes({ method: "DELETE" });
      await handler(req, res);

      expect(res.statusCode).toBe(405);
      expect(res.body.error).toBe("Method Not Allowed");
    });

    it("handles OPTIONS preflight with 204 No Content", async () => {
      const { req, res } = createMockReqRes({ method: "OPTIONS" });
      await handler(req, res);

      expect(res.statusCode).toBe(204);
      expect(res.headers["Access-Control-Allow-Methods"]).toBe("GET, POST, OPTIONS");
    });
  });
});
