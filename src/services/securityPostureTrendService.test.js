import { describe, it, expect, beforeEach } from 'vitest';
import {
  SecurityPostureTrendService,
  VULNERABILITY_SEVERITIES
} from './securityPostureTrendService.js';

describe('securityPostureTrendService', () => {
  let service;
  const maintainer = { username: 'security_lead', role: 'MAINTAINER' };
  const developer = { username: 'dev_user', role: 'CONTRIBUTOR' };

  beforeEach(() => {
    service = new SecurityPostureTrendService();
  });

  describe('recordScanSnapshot', () => {
    it('records safe numeric scan metrics without exploit details', () => {
      const snap = service.recordScanSnapshot({
        scanId: 'scan_001',
        workflowRunId: 'run_888',
        dependencyFindings: { critical: 0, high: 2, medium: 5, low: 8 },
        secretScanClean: true
      });

      expect(snap.scanId).toBe('scan_001');
      expect(snap.dependencyFindings.high).toBe(2);
      expect(snap.secretScanClean).toBe(true);
      expect(snap.scannerConfigVersion).toBe('2026.1');
    });

    it('throws error when mandatory identifiers are missing', () => {
      expect(() => {
        service.recordScanSnapshot({ scanId: '' });
      }).toThrow(/requires scanId and workflowRunId/);
    });
  });

  describe('getPostureTrendReport', () => {
    it('denies access to non-maintainer callers', () => {
      expect(() => {
        service.getPostureTrendReport(developer);
      }).toThrow(/restricted to MAINTAINER roles/);
    });

    it('computes remediation trends across chronological snapshots for maintainers', () => {
      service.recordScanSnapshot({
        scanId: 's1',
        workflowRunId: 'r1',
        timestamp: 1700000000000,
        dependencyFindings: { critical: 2, high: 5 }
      });
      service.recordScanSnapshot({
        scanId: 's2',
        workflowRunId: 'r2',
        timestamp: 1700005000000,
        dependencyFindings: { critical: 0, high: 2 }
      });

      const report = service.getPostureTrendReport(maintainer);
      expect(report.totalScansAnalyzed).toBe(2);
      expect(report.latestSnapshot.scanId).toBe('s2');
      expect(report.remediationTrends.criticalDelta).toBe(-2); // Decreased by 2 (improved)
      expect(report.remediationTrends.highDelta).toBe(-3);
      expect(report.remediationTrends.improving).toBe(true);
      expect(report.complianceNote).toContain('Zero CVE descriptions');
    });
  });
});
