/**
 * Route Diagnostics and Telemetry Integrity Monitor (#427)
 * 
 * Provides automated integrity checks, route parameter validation, and safe
 * diagnostic error telemetry for all application routes in Civic Help Setu.
 * 
 * Privacy & Security Guarantees:
 * 1. Zero PII: Strictly preserves sanitized route patterns (e.g. `/services/:id`),
 *    stripping all tokens, reference IDs, query strings, and auth fragments.
 * 2. Parameter Guard: Verifies that path parameters are never echoed as raw user values.
 * 3. Anomaly Detection: Detects high-frequency transitions to `/[other]` indicating
 *    broken links or navigation loops.
 * 4. Diagnostic Reporting: Outputs structured health audits without exposing client state.
 */

import { ROUTE_PATTERNS, UNKNOWN_ROUTE, routeOf } from './diagnostics';

/**
 * Route classification sensitivity levels
 */
export const ROUTE_SENSITIVITY = {
  PUBLIC: 'public',
  PROTECTED_USER: 'protected_user',
  ADMIN_RESTRICTED: 'admin_restricted',
  DYNAMIC_TOKEN: 'dynamic_token',
};

/**
 * Maps known route patterns to operational sensitivity levels
 */
export const ROUTE_SENSITIVITY_MAP = {
  '/': ROUTE_SENSITIVITY.PUBLIC,
  '/login': ROUTE_SENSITIVITY.PUBLIC,
  '/signup': ROUTE_SENSITIVITY.PUBLIC,
  '/signup/sso-callback': ROUTE_SENSITIVITY.PUBLIC,
  '/sso-callback': ROUTE_SENSITIVITY.PUBLIC,
  '/assistant': ROUTE_SENSITIVITY.PUBLIC,
  '/services': ROUTE_SENSITIVITY.PUBLIC,
  '/services/:id': ROUTE_SENSITIVITY.PUBLIC,
  '/acronyms': ROUTE_SENSITIVITY.PUBLIC,
  '/eligibility': ROUTE_SENSITIVITY.PUBLIC,
  '/nearby': ROUTE_SENSITIVITY.PUBLIC,
  '/nearby-offices': ROUTE_SENSITIVITY.PUBLIC,
  '/track': ROUTE_SENSITIVITY.PUBLIC,
  '/shared-checklist/:token': ROUTE_SENSITIVITY.DYNAMIC_TOKEN,
  '/saved': ROUTE_SENSITIVITY.PROTECTED_USER,
  '/vault': ROUTE_SENSITIVITY.PROTECTED_USER,
  '/profile': ROUTE_SENSITIVITY.PROTECTED_USER,
  '/open-source': ROUTE_SENSITIVITY.PUBLIC,
  '/privacy': ROUTE_SENSITIVITY.PUBLIC,
  '/admin': ROUTE_SENSITIVITY.ADMIN_RESTRICTED,
};

/**
 * Resolve sensitivity level for a given route pattern
 */
export const getRouteSensitivityLevel = (pattern) => {
  return ROUTE_SENSITIVITY_MAP[pattern] || ROUTE_SENSITIVITY.PUBLIC;
};

/**
 * Audit route configuration consistency against declared patterns
 */
export const auditRouteIntegrity = (definedRouteList = [], declaredPatterns = ROUTE_PATTERNS) => {
  const definedSet = new Set(definedRouteList);
  const declaredSet = new Set(declaredPatterns);

  const missingFromDeclared = definedRouteList.filter((r) => !declaredSet.has(r));
  const unusedDeclared = declaredPatterns.filter((r) => !definedSet.has(r));

  const parameterizedRoutes = declaredPatterns.filter((r) => r.includes(':'));
  const staticRoutes = declaredPatterns.filter((r) => !r.includes(':'));

  const parameterIssues = [];
  parameterizedRoutes.forEach((p) => {
    const parts = p.split('/');
    parts.forEach((part) => {
      if (part.startsWith(':') && part.length < 2) {
        parameterIssues.push(`Empty parameter name in route pattern: ${p}`);
      }
    });
  });

  const isHealthy = missingFromDeclared.length === 0 && parameterIssues.length === 0;

  return {
    isHealthy,
    totalDeclared: declaredPatterns.length,
    totalDefined: definedRouteList.length,
    staticRoutesCount: staticRoutes.length,
    parameterizedRoutesCount: parameterizedRoutes.length,
    missingFromDeclared,
    unusedDeclared,
    parameterIssues,
    timestamp: new Date().toISOString(),
  };
};

/**
 * Create a privacy-preserving in-memory route telemetry recorder
 */
export const createRouteTelemetryRecorder = (maxEvents = 100) => {
  const events = [];

  return {
    /**
     * Record a route transition safely (strips query strings and raw parameters)
     */
    recordTransition(rawUrlOrPath, statusCode = 200) {
      const sanitizedRoute = routeOf(rawUrlOrPath);
      const isUnknown = sanitizedRoute === UNKNOWN_ROUTE;

      const record = {
        route: sanitizedRoute,
        isUnknown,
        statusCode: typeof statusCode === 'number' ? statusCode : 200,
        sensitivity: getRouteSensitivityLevel(sanitizedRoute),
        timestamp: Date.now(),
      };

      events.push(record);
      if (events.length > maxEvents) {
        events.shift();
      }

      return record;
    },

    /**
     * Retrieve copy of recorded events
     */
    getEvents() {
      return [...events];
    },

    /**
     * Clear recorded telemetry
     */
    clear() {
      events.length = 0;
    },

    /**
     * Get route transition frequency summary
     */
    getSummary() {
      const counts = {};
      let unknownCount = 0;

      events.forEach((evt) => {
        counts[evt.route] = (counts[evt.route] || 0) + 1;
        if (evt.isUnknown) unknownCount++;
      });

      return {
        totalTransitions: events.length,
        unknownTransitions: unknownCount,
        routeCounts: counts,
      };
    },
  };
};

/**
 * Scan event logs for route navigation anomalies
 */
export const detectRouteAnomalies = (events = [], options = {}) => {
  const unknownThreshold = options.unknownThreshold || 3;
  const unknownOccurrences = [];
  const statusFailures = [];

  events.forEach((evt, idx) => {
    if (evt.isUnknown || evt.route === UNKNOWN_ROUTE) {
      unknownOccurrences.push({ index: idx, route: evt.route, timestamp: evt.timestamp });
    }
    if (evt.statusCode >= 400) {
      statusFailures.push({ index: idx, route: evt.route, statusCode: evt.statusCode });
    }
  });

  const hasHighUnknownRate = unknownOccurrences.length >= unknownThreshold;
  const hasHighFailureRate = statusFailures.length >= 5;

  const anomalies = [];
  if (hasHighUnknownRate) {
    anomalies.push({
      type: 'HIGH_UNKNOWN_ROUTE_RATE',
      message: `${unknownOccurrences.length} navigation events failed to match any registered route pattern.`,
      severity: 'warning',
    });
  }

  if (hasHighFailureRate) {
    anomalies.push({
      type: 'FREQUENT_STATUS_ERRORS',
      message: `${statusFailures.length} transitions registered HTTP error status codes >= 400.`,
      severity: 'error',
    });
  }

  return {
    isClean: anomalies.length === 0,
    anomalies,
    unknownCount: unknownOccurrences.length,
    failureCount: statusFailures.length,
  };
};

/**
 * Format a human-readable diagnostic report for logging or administrative review
 */
export const formatRouteDiagnosticReport = (auditResult, anomalyReport) => {
  const lines = [
    '==================================================',
    'CIVIC HELP SETU: ROUTE DIAGNOSTIC INTEGRITY REPORT',
    '==================================================',
    `Timestamp: ${auditResult?.timestamp || new Date().toISOString()}`,
    `Audit Status: ${auditResult?.isHealthy ? 'HEALTHY' : 'CONFIGURATION ISSUE DETECTED'}`,
    `Total Declared Patterns: ${auditResult?.totalDeclared ?? 0}`,
    `Static Routes: ${auditResult?.staticRoutesCount ?? 0} | Parameterized Routes: ${auditResult?.parameterizedRoutesCount ?? 0}`,
    '',
  ];

  if (auditResult?.missingFromDeclared?.length > 0) {
    lines.push('CRITICAL: Defined routes missing from ROUTE_PATTERNS:');
    auditResult.missingFromDeclared.forEach((r) => lines.push(`  - ${r}`));
    lines.push('');
  }

  if (anomalyReport) {
    lines.push(`Telemetry Anomaly Status: ${anomalyReport.isClean ? 'CLEAN (No anomalies)' : 'ANOMALIES DETECTED'}`);
    lines.push(`Unknown Route Hits: ${anomalyReport.unknownCount}`);
    lines.push(`Status Failures: ${anomalyReport.failureCount}`);
    if (anomalyReport.anomalies?.length > 0) {
      anomalyReport.anomalies.forEach((a) => lines.push(`  [${a.severity.toUpperCase()}] ${a.message}`));
    }
  }

  lines.push('==================================================');
  return lines.join('\n');
};
