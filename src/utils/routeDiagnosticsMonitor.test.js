import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ROUTE_PATTERNS } from './diagnostics';
import {
  ROUTE_SENSITIVITY,
  ROUTE_SENSITIVITY_MAP,
  getRouteSensitivityLevel,
  auditRouteIntegrity,
  createRouteTelemetryRecorder,
  detectRouteAnomalies,
  formatRouteDiagnosticReport,
} from './routeDiagnosticsMonitor';

describe('routeDiagnosticsMonitor (#427)', () => {
  it('maps route patterns to correct sensitivity classifications', () => {
    expect(getRouteSensitivityLevel('/')).toBe(ROUTE_SENSITIVITY.PUBLIC);
    expect(getRouteSensitivityLevel('/services')).toBe(ROUTE_SENSITIVITY.PUBLIC);
    expect(getRouteSensitivityLevel('/acronyms')).toBe(ROUTE_SENSITIVITY.PUBLIC);
    expect(getRouteSensitivityLevel('/vault')).toBe(ROUTE_SENSITIVITY.PROTECTED_USER);
    expect(getRouteSensitivityLevel('/admin')).toBe(ROUTE_SENSITIVITY.ADMIN_RESTRICTED);
    expect(getRouteSensitivityLevel('/shared-checklist/:token')).toBe(ROUTE_SENSITIVITY.DYNAMIC_TOKEN);
    expect(getRouteSensitivityLevel('/unknown/path')).toBe(ROUTE_SENSITIVITY.PUBLIC);
  });

  it('audits route integrity and detects when defined routes are missing from declared patterns', () => {
    const definedInApp = ['/', '/login', '/services', '/services/:id', '/acronyms'];
    const declaredPatterns = ['/', '/login', '/services', '/services/:id', '/acronyms'];

    const healthyAudit = auditRouteIntegrity(definedInApp, declaredPatterns);
    expect(healthyAudit.isHealthy).toBe(true);
    expect(healthyAudit.missingFromDeclared).toHaveLength(0);

    // Simulate missing route
    const brokenAudit = auditRouteIntegrity(['/new-feature', ...definedInApp], declaredPatterns);
    expect(brokenAudit.isHealthy).toBe(false);
    expect(brokenAudit.missingFromDeclared).toContain('/new-feature');
  });

  it('matches actual App.jsx routes against ROUTE_PATTERNS including /acronyms', () => {
    const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
    const definedRoutes = [...app.matchAll(/<Route path="([^"*]+?)(?:\/\*)?"/g)].map((m) => m[1]);

    const audit = auditRouteIntegrity(definedRoutes, ROUTE_PATTERNS);
    expect(audit.isHealthy).toBe(true);
    expect(audit.missingFromDeclared).toHaveLength(0);
    expect(ROUTE_PATTERNS).toContain('/acronyms');
  });

  it('records route transitions safely without leaking query params or tokens', () => {
    const recorder = createRouteTelemetryRecorder(5);

    recorder.recordTransition('/services/ration-card?token=secret123&q=query', 200);
    recorder.recordTransition('/acronyms#top', 200);
    recorder.recordTransition('/unknown-404-link', 404);

    const events = recorder.getEvents();
    expect(events).toHaveLength(3);
    expect(events[0].route).toBe('/services/:id');
    expect(events[0].sensitivity).toBe(ROUTE_SENSITIVITY.PUBLIC);
    expect(events[1].route).toBe('/acronyms');
    expect(events[2].route).toBe('/[other]');
    expect(events[2].isUnknown).toBe(true);

    const summary = recorder.getSummary();
    expect(summary.totalTransitions).toBe(3);
    expect(summary.unknownTransitions).toBe(1);
    expect(summary.routeCounts['/acronyms']).toBe(1);

    recorder.clear();
    expect(recorder.getEvents()).toHaveLength(0);
  });

  it('detects route navigation anomalies and high-frequency unknown route occurrences', () => {
    const recorder = createRouteTelemetryRecorder(10);
    recorder.recordTransition('/invalid/1', 404);
    recorder.recordTransition('/invalid/2', 404);
    recorder.recordTransition('/invalid/3', 404);
    recorder.recordTransition('/invalid/4', 404);

    const anomalies = detectRouteAnomalies(recorder.getEvents(), { unknownThreshold: 3 });
    expect(anomalies.isClean).toBe(false);
    expect(anomalies.unknownCount).toBe(4);
    expect(anomalies.anomalies[0].type).toBe('HIGH_UNKNOWN_ROUTE_RATE');
  });

  it('formats clean human-readable diagnostic report', () => {
    const audit = auditRouteIntegrity(['/'], ['/']);
    const anomalyReport = { isClean: true, unknownCount: 0, failureCount: 0, anomalies: [] };

    const report = formatRouteDiagnosticReport(audit, anomalyReport);
    expect(report).toContain('CIVIC HELP SETU: ROUTE DIAGNOSTIC INTEGRITY REPORT');
    expect(report).toContain('Audit Status: HEALTHY');
    expect(report).toContain('Telemetry Anomaly Status: CLEAN');
  });
});
