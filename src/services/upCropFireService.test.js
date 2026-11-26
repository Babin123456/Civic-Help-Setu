import { describe, it, expect } from 'vitest';
import {
  triageCropFireIncident,
  clusterFireIncidents,
  exportCropFireVerificationReport,
  UP_FIRE_RESPONSE_SERVICES,
  UP_FIRE_ESCALATION_OFFICERS,
  CRM_EQUIPMENT_SUBSIDIES
} from './upCropFireService';

describe('upCropFireService', () => {
  it('should list emergency response services and CRM equipment subsidies', () => {
    expect(UP_FIRE_RESPONSE_SERVICES.length).toBeGreaterThanOrEqual(3);
    expect(UP_FIRE_RESPONSE_SERVICES.some(s => s.number === '101')).toBe(true);
    expect(UP_FIRE_ESCALATION_OFFICERS.length).toBe(4);
    expect(CRM_EQUIPMENT_SUBSIDIES.SUPER_SEEDER.name).toBe('Super Seeder');
    expect(CRM_EQUIPMENT_SUBSIDIES.BIO_DECOMPOSER.subsidyRatePercent).toBe(100);
  });

  it('should trigger emergency triage when fire threatens huts or power lines', () => {
    const dangerousIncident = {
      incidentId: 'FIRE-2026-001',
      isNearHutsOrHouses: true,
      isNearHighTensionLines: true,
      isCausingHighwayZeroVisibility: false
    };

    const triage = triageCropFireIncident(dangerousIncident);
    expect(triage.isEmergency).toBe(true);
    expect(triage.urgencyLevel).toBe('HIGH_PRIORITY_EMERGENCY');
    expect(triage.immediateAction).toContain('dial 112 / 101');
    expect(triage.recommendedHotlines).toContain('101');
    expect(triage.threatFactors.threateningHutsOrHouses).toBe(true);
  });

  it('should treat isolated contained field smoke as standard environmental monitoring', () => {
    const minorIncident = {
      incidentId: 'FIRE-2026-002',
      isNearHutsOrHouses: false,
      isNearHighTensionLines: false,
      isCausingHighwayZeroVisibility: false
    };

    const triage = triageCropFireIncident(minorIncident);
    expect(triage.isEmergency).toBe(false);
    expect(triage.urgencyLevel).toBe('STANDARD_ENVIRONMENTAL_MONITORING');
    expect(triage.immediateAction).toContain('Lekhpal field verification');
  });

  it('should detect duplicate incident within 1.5 km and 3 hours', () => {
    const now = new Date();
    const existing = [
      {
        incidentId: 'FIRE-LEADER-99',
        latitude: 26.8500,
        longitude: 80.9400,
        timestamp: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(), // 1h ago
        duplicateReportCount: 1
      }
    ];

    const newReport = {
      latitude: 26.8510,
      longitude: 80.9410,
      timestamp: now.toISOString()
    };

    const cluster = clusterFireIncidents(newReport, existing);
    expect(cluster.isDuplicate).toBe(true);
    expect(cluster.clusterLeaderId).toBe('FIRE-LEADER-99');
    expect(cluster.existingClusterSize).toBe(2);
  });

  it('should not cluster reports with substantial distance or time gap', () => {
    const now = new Date();
    const existing = [
      {
        incidentId: 'FIRE-LEADER-99',
        latitude: 26.8500,
        longitude: 80.9400,
        timestamp: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString() // 6h ago
      }
    ];

    const newReport = {
      latitude: 26.8500,
      longitude: 80.9400,
      timestamp: now.toISOString()
    };

    const cluster = clusterFireIncidents(newReport, existing);
    expect(cluster.isDuplicate).toBe(false);
  });

  it('should export field verification report markdown for District Agriculture Officer', () => {
    const incident = {
      village: 'Gram Rampurva',
      tehsil: 'Mohanlalganj',
      district: 'Lucknow',
      timestamp: '18/11/2026 14:30'
    };
    const triage = {
      incidentId: 'FIRE-LKO-443',
      isEmergency: true,
      urgencyLevel: 'HIGH_PRIORITY_EMERGENCY',
      immediateAction: 'Dial 112 / 101 for fire tender dispatch.',
      threatFactors: { nearHighTensionLines: true, highwayVisibilityImpaired: false }
    };

    const report = exportCropFireVerificationReport(incident, triage);
    expect(report).toContain('# Agricultural Fire Incident Verification Report');
    expect(report).toContain('Rampurva');
    expect(report).toContain('Mohanlalganj');
    expect(report).toContain('HIGH_PRIORITY_EMERGENCY');
    expect(report).toContain('YES (High Grid Risk)');
    expect(report).toContain('District Agriculture Officer (DAO)');
  });

  it('should retrieve statutory legal framework and environmental compensation slabs', async () => {
    const { getStubbleLegalFramework } = await import('./upCropFireService');
    const legal = getStubbleLegalFramework();
    expect(legal.CAQM_ACT).toContain('Commission for Air Quality Management');
    expect(legal.ENVIRONMENTAL_COMPENSATION_SLABS.length).toBe(3);
    expect(legal.ENVIRONMENTAL_COMPENSATION_SLABS[0].penaltyINR).toBe(2500);
    expect(legal.RED_ENTRY_DISQUALIFICATION).toContain('Khatauni');
  });

  it('should retrieve practical CRM advisory notes', async () => {
    const { getCrmAdvisoryNotes } = await import('./upCropFireService');
    const notes = getCrmAdvisoryNotes();
    expect(notes.length).toBeGreaterThanOrEqual(3);
    expect(notes.some(n => n.includes('Custom Hiring Centre'))).toBe(true);
    expect(notes.some(n => n.includes('spark arresters'))).toBe(true);
  });
});
