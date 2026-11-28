import { describe, it, expect, beforeEach } from 'vitest';
import {
  FootpathContinuityAuditService,
  FOOTPATH_DEFECT_TYPE
} from './footpathContinuityAuditService.js';

describe('FootpathContinuityAuditService (#1081)', () => {
  let service;

  beforeEach(() => {
    service = new FootpathContinuityAuditService();
  });

  it('creates a walking route audit and calculates mobility scores', () => {
    const audit = service.createRouteAudit({
      routeName: 'Metro Gate 2 to Govt Hospital',
      originName: 'Central Metro Station',
      destinationName: 'Civil Hospital OPD',
      totalDistanceMeters: 800,
      issues: [
        {
          type: FOOTPATH_DEFECT_TYPE.BLOCKED_RAMP,
          locationMark: 'Near Pharmacy Crossing',
          description: 'Bollard spacing prevents wheelchair entry'
        },
        {
          type: FOOTPATH_DEFECT_TYPE.MISSING_FOOTPATH,
          locationMark: 'Ring Road slip lane',
          description: 'Sidewalk ends abruptly into vehicular road'
        }
      ]
    });

    expect(audit.auditId).toMatch(/^AUD-FP-[A-F0-9]{8}$/);
    expect(audit.scores.generalWalkingScore).toBeLessThan(100);
    expect(audit.scores.wheelchairScore).toBeLessThan(audit.scores.generalWalkingScore);
    expect(audit.scores.disclaimer).toContain('statutory accessibility certification');
  });

  it('generates an audit dossier export packet', () => {
    const audit = service.createRouteAudit({
      routeName: 'School Walk Zone',
      originName: 'Housing Society A',
      destinationName: 'Primary School Gate',
      issues: [{ type: FOOTPATH_DEFECT_TYPE.UNSAFE_CROSSING }]
    });

    const dossier = service.generateAuditDossier(audit.auditId);
    expect(dossier.issueCount).toBe(1);
    expect(dossier.title).toContain('Pedestrian Usability Dossier');
  });
});
