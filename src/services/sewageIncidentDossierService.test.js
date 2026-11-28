import { describe, it, expect, beforeEach } from 'vitest';
import {
  SewageIncidentDossierService,
  INCIDENT_TYPE,
  INCIDENT_SEVERITY
} from './sewageIncidentDossierService.js';

describe('SewageIncidentDossierService (#1084)', () => {
  let service;

  beforeEach(() => {
    service = new SewageIncidentDossierService();
  });

  it('creates an incident dossier and flags emergency hazards', () => {
    const incident = service.createIncidentReport({
      incidentType: INCIDENT_TYPE.OPEN_MANHOLE,
      isOpenManhole: true,
      hasElectricalHazard: true,
      location: {
        address: 'Service Lane, Block C Market',
        landmark: 'Opposite Community Hall'
      },
      reporterNotes: 'Submerged wires visible near uncovered manhole.'
    });

    expect(incident.dossierId).toMatch(/^DOS-WW-\d{4}-[A-F0-9]{8}$/);
    expect(incident.severity).toBe(INCIDENT_SEVERITY.EMERGENCY_HAZARD);
    expect(incident.safetyAdvisory).toContain('CAUTION: Do not approach');
  });

  it('records chronological follow-up observations and exports escalation packet', () => {
    const incident = service.createIncidentReport({
      incidentType: INCIDENT_TYPE.SEWAGE_OVERFLOW,
      location: { landmark: 'Main Market Road' }
    });

    service.addFollowUpEvidence(incident.dossierId, 'Overflow water entered shop basements.');
    const packet = service.generateEscalationPacket(incident.dossierId);

    expect(packet.dossierId).toBe(incident.dossierId);
    expect(packet.chronologySummary).toContain('Overflow water entered shop basements');
    expect(packet.agencyDispatch).toContain('Jal Board');
  });
});
