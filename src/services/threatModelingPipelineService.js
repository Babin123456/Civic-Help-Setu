import crypto from 'node:crypto';

/**
 * STRIDE Categories and Threat Severity Classifications
 */
export const THREAT_SEVERITY = Object.freeze({
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW'
});

export const STRIDE_CATEGORY = Object.freeze({
  SPOOFING: 'Spoofing',
  TAMPERING: 'Tampering',
  REPUDIATION: 'Repudiation',
  INFORMATION_DISCLOSURE: 'Information Disclosure',
  DENIAL_OF_SERVICE: 'Denial of Service',
  ELEVATION_OF_PRIVILEGE: 'Elevation of Privilege'
});

export const TRUST_ZONE = Object.freeze({
  PUBLIC_INTERNET: 'PUBLIC_INTERNET',
  DMZ_GATEWAY: 'DMZ_GATEWAY',
  APPLICATION_CORE: 'APPLICATION_CORE',
  SECURE_DATASTORE: 'SECURE_DATASTORE'
});

/**
 * Platform Threat Modeling and Attack-Surface Regression Service
 */
export class PlatformThreatModelingService {
  constructor() {
    this.threatCatalog = new Map();
    this.trustBoundaries = new Map();
    this.knownEndpoints = new Map();
    this.regressionViolations = [];
    this._initializeBaselineBoundaries();
  }

  _initializeBaselineBoundaries() {
    this.trustBoundaries.set(TRUST_ZONE.PUBLIC_INTERNET, { allowedIngress: [], requireAuth: false });
    this.trustBoundaries.set(TRUST_ZONE.DMZ_GATEWAY, { allowedIngress: [TRUST_ZONE.PUBLIC_INTERNET], requireAuth: false });
    this.trustBoundaries.set(TRUST_ZONE.APPLICATION_CORE, { allowedIngress: [TRUST_ZONE.DMZ_GATEWAY], requireAuth: true });
    this.trustBoundaries.set(TRUST_ZONE.SECURE_DATASTORE, { allowedIngress: [TRUST_ZONE.APPLICATION_CORE], requireAuth: true });
  }

  registerEndpoint(endpoint) {
    const { path, method, trustZone, authRequired, sensitiveDataExposed } = endpoint;
    const key = `${method.toUpperCase()}:${path}`;
    this.knownEndpoints.set(key, {
      path,
      method: method.toUpperCase(),
      trustZone: trustZone || TRUST_ZONE.APPLICATION_CORE,
      authRequired: Boolean(authRequired),
      sensitiveDataExposed: Boolean(sensitiveDataExposed)
    });
  }

  evaluateRouteDiff(incomingRoutes = []) {
    const findings = [];

    for (const route of incomingRoutes) {
      const key = `${route.method.toUpperCase()}:${route.path}`;
      const existing = this.knownEndpoints.get(key);

      // Check unauthenticated exposure in protected zones
      if (
        (route.trustZone === TRUST_ZONE.APPLICATION_CORE || route.trustZone === TRUST_ZONE.SECURE_DATASTORE) &&
        !route.authRequired
      ) {
        findings.push({
          id: `ATM-${crypto.randomBytes(4).toString('hex')}`,
          endpoint: key,
          stride: STRIDE_CATEGORY.ELEVATION_OF_PRIVILEGE,
          severity: THREAT_SEVERITY.CRITICAL,
          description: `Unauthenticated route exposed in protected zone: ${route.trustZone}`,
          recommendation: 'Enforce citizen/admin JWT verification middleware.'
        });
      }

      // Check sensitive data exposure over public/DMZ without encryption or mask
      if (route.sensitiveDataExposed && (route.trustZone === TRUST_ZONE.PUBLIC_INTERNET || route.trustZone === TRUST_ZONE.DMZ_GATEWAY)) {
        findings.push({
          id: `ATM-${crypto.randomBytes(4).toString('hex')}`,
          endpoint: key,
          stride: STRIDE_CATEGORY.INFORMATION_DISCLOSURE,
          severity: THREAT_SEVERITY.HIGH,
          description: `Sensitive citizen data exposed at border gateway route`,
          recommendation: 'Apply payload redaction and data masking filters.'
        });
      }

      // Check route regression: Auth removed from existing route
      if (existing && existing.authRequired && !route.authRequired) {
        findings.push({
          id: `ATM-${crypto.randomBytes(4).toString('hex')}`,
          endpoint: key,
          stride: STRIDE_CATEGORY.ELEVATION_OF_PRIVILEGE,
          severity: THREAT_SEVERITY.CRITICAL,
          description: `Regression detected: Previously authenticated route ${key} has authentication disabled`,
          recommendation: 'Revert auth removal or obtain explicit security council waiver.'
        });
      }
    }

    return {
      evaluatedAt: new Date().toISOString(),
      routesEvaluated: incomingRoutes.length,
      violationsCount: findings.length,
      hasBlockingViolations: findings.some(f => f.severity === THREAT_SEVERITY.CRITICAL),
      findings
    };
  }

  generateThreatModelDigest() {
    return {
      registeredEndpointsCount: this.knownEndpoints.size,
      trustBoundaries: Array.from(this.trustBoundaries.entries()).map(([zone, rules]) => ({
        zone,
        ...rules
      })),
      timestamp: new Date().toISOString()
    };
  }
}
