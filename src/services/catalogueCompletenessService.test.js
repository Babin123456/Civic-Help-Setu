import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  auditServiceCompleteness,
  auditEntireCatalogue,
  dismissFinding,
  restoreFinding,
  clearAllDismissals,
  getDismissedFindings,
  AUDITABLE_FIELDS
} from './catalogueCompletenessService';

describe('catalogueCompletenessService', () => {
  beforeEach(() => {
    const store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key) => store.get(key) || null,
      setItem: (key, val) => store.set(key, String(val)),
      removeItem: (key) => store.delete(key),
      clear: () => store.clear()
    });
  });

  const completeService = {
    id: 'birth-cert-delhi',
    name: 'Birth Certificate Delhi',
    officialUrl: 'https://edistrict.delhigovt.nic.in/birth',
    department: 'Revenue Department',
    jurisdiction: 'Delhi',
    documents: ['Hospital discharge slip', 'Parent Aadhaar card'],
    contact: '1800-111-555',
    processingTime: '7 working days',
    fee: '₹20 (Free within 21 days)',
    eligibilityCriteria: ['Child born in Delhi NCT', 'Registered within prescribed timeline'],
    steps: ['Fill Form 1', 'Upload hospital proof', 'Pay online fee']
  };

  const sparseService = {
    id: 'ration-card-rural',
    name: 'Rural Food Grain Scheme',
    // Missing officialUrl, documents, department, jurisdiction, eligibilityCriteria, steps
    fee: 'Free'
  };

  it('audits a complete service with 100% score and zero missing fields', () => {
    const result = auditServiceCompleteness(completeService);
    expect(result.completenessScore).toBe(100);
    expect(result.missingFields).toHaveLength(0);
    expect(result.status).toBe('complete');
  });

  it('detects missing critical and high severity fields in incomplete records', () => {
    const result = auditServiceCompleteness(sparseService);
    expect(result.completenessScore).toBeLessThan(60);
    expect(result.status).toBe('severely-incomplete');

    const fields = result.missingFields.map((f) => f.field);
    expect(fields).toContain('officialUrl');
    expect(fields).toContain('documents');
    expect(fields).toContain('department');
    expect(fields).toContain('jurisdiction');

    const officialUrlFinding = result.missingFields.find((f) => f.field === 'officialUrl');
    expect(officialUrlFinding.severity).toBe('critical');
    expect(officialUrlFinding.impactExplanation).toContain('cannot verify or submit online');
  });

  it('aggregates catalogue health metrics across multiple services', () => {
    const catalogue = [completeService, sparseService];
    const report = auditEntireCatalogue(catalogue);

    expect(report.totalServices).toBe(2);
    expect(report.completeCount).toBe(1);
    expect(report.incompleteCount).toBe(1);
    expect(report.findings[0].serviceId).toBe('ration-card-rural');
  });

  it('supports dismissing and restoring quality findings for a service', () => {
    dismissFinding('ration-card-rural', 'officialUrl');
    let dismissed = getDismissedFindings();
    expect(dismissed['ration-card-rural']).toContain('officialUrl');

    const filteredAudit = auditServiceCompleteness(sparseService, { filterDismissed: true });
    const missing = filteredAudit.missingFields.map((f) => f.field);
    expect(missing).not.toContain('officialUrl');

    restoreFinding('ration-card-rural', 'officialUrl');
    dismissed = getDismissedFindings();
    expect(dismissed['ration-card-rural']).toBeUndefined();

    const restoredAudit = auditServiceCompleteness(sparseService, { filterDismissed: true });
    const restoredMissing = restoredAudit.missingFields.map((f) => f.field);
    expect(restoredMissing).toContain('officialUrl');
  });

  it('clears all dismissals correctly', () => {
    dismissFinding('s1', 'fee');
    dismissFinding('s2', 'documents');
    clearAllDismissals();
    expect(getDismissedFindings()).toEqual({});
  });

  it('handles null or invalid inputs gracefully', () => {
    const result = auditServiceCompleteness(null);
    expect(result.completenessScore).toBe(0);
    expect(result.status).toBe('severely-incomplete');

    const cat = auditEntireCatalogue(null);
    expect(cat.totalServices).toBe(0);
    expect(cat.findings).toHaveLength(0);
  });
});
