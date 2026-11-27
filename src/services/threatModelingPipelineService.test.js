import { describe, it, expect, beforeEach } from 'vitest';
import {
  PlatformThreatModelingService,
  TRUST_ZONE,
  THREAT_SEVERITY,
  STRIDE_CATEGORY
} from './threatModelingPipelineService.js';

describe('PlatformThreatModelingService', () => {
  let service;

  beforeEach(() => {
    service = new PlatformThreatModelingService();
  });

  it('detects unauthenticated route exposure in application core', () => {
    const diff = [
      {
        path: '/api/v1/citizen/records',
        method: 'GET',
        trustZone: TRUST_ZONE.APPLICATION_CORE,
        authRequired: false,
        sensitiveDataExposed: true
      }
    ];

    const result = service.evaluateRouteDiff(diff);
    expect(result.violationsCount).toBeGreaterThanOrEqual(1);
    expect(result.hasBlockingViolations).toBe(true);
    expect(result.findings[0].stride).toBe(STRIDE_CATEGORY.ELEVATION_OF_PRIVILEGE);
    expect(result.findings[0].severity).toBe(THREAT_SEVERITY.CRITICAL);
  });

  it('detects security regression when auth is removed from existing route', () => {
    service.registerEndpoint({
      path: '/api/v1/grievance/admin-review',
      method: 'POST',
      trustZone: TRUST_ZONE.APPLICATION_CORE,
      authRequired: true,
      sensitiveDataExposed: false
    });

    const incoming = [
      {
        path: '/api/v1/grievance/admin-review',
        method: 'POST',
        trustZone: TRUST_ZONE.APPLICATION_CORE,
        authRequired: false,
        sensitiveDataExposed: false
      }
    ];

    const result = service.evaluateRouteDiff(incoming);
    expect(result.hasBlockingViolations).toBe(true);
    const regression = result.findings.find(f => f.description.includes('Regression detected'));
    expect(regression).toBeDefined();
  });

  it('passes cleanly for compliant authenticated routes', () => {
    const incoming = [
      {
        path: '/api/v1/documents/upload',
        method: 'POST',
        trustZone: TRUST_ZONE.APPLICATION_CORE,
        authRequired: true,
        sensitiveDataExposed: true
      }
    ];

    const result = service.evaluateRouteDiff(incoming);
    expect(result.violationsCount).toBe(0);
    expect(result.hasBlockingViolations).toBe(false);
  });
});
