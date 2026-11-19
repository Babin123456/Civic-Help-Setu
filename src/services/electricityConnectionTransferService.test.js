import { describe, it, expect } from 'vitest';
import {
  getDiscomSpecs,
  generateElectricityGuide,
  ElectricityApplicationTracker,
  ELECTRICITY_JOURNEY,
  DISCOM_ID,
  ELECTRICITY_DISCLAIMER,
} from './electricityConnectionTransferService.js';

describe('Electricity Connection and Consumer-Name Transfer Guide Service', () => {
  it('identifies state DISCOMs with verified portals and tariff parameters', () => {
    const bescom = getDiscomSpecs(DISCOM_ID.BESCOM_KARNATAKA);
    expect(bescom.name).toContain('Bangalore Electricity Supply');
    expect(bescom.domesticSecurityDepositPerKw).toBe(2500);

    const msedcl = getDiscomSpecs(DISCOM_ID.MAHADISCOM_MAHARASHTRA);
    expect(msedcl.name).toContain('MSEDCL');
    expect(msedcl.nameTransferProcessingFee).toBe(150);
  });

  it('calculates security deposit and service charges based on connected load', () => {
    const guide = generateElectricityGuide({
      journey: ELECTRICITY_JOURNEY.NEW_CONNECTION,
      discomId: DISCOM_ID.BESCOM_KARNATAKA,
      details: { loadKw: 3 },
    });

    expect(guide.estimatedFeeBreakdown.depositOrFee).toBe(3 * 2500); // 7500
    expect(guide.estimatedFeeBreakdown.serviceLineCharges).toBe(1500);
    expect(guide.estimatedFeeBreakdown.estimatedTotal).toBe(9000);
    expect(guide.disclaimer).toBe(ELECTRICITY_DISCLAIMER);
  });

  it('separates evidence for inheritance name transfer vs regular purchase transfer', () => {
    const inheritanceGuide = generateElectricityGuide({
      journey: ELECTRICITY_JOURNEY.NAME_TRANSFER,
      discomId: DISCOM_ID.MAHADISCOM_MAHARASHTRA,
      details: { isInheritance: true },
    });

    const docs = inheritanceGuide.evidenceChecklist.map((e) => e.document);
    expect(docs).toContain('Death Certificate of Prior Consumer');
    expect(docs).toContain('Legal Heir Certificate / Succession Proof');
    expect(docs).not.toContain('Prior Owner Consent / NOC (Form U)');

    const saleGuide = generateElectricityGuide({
      journey: ELECTRICITY_JOURNEY.NAME_TRANSFER,
      discomId: DISCOM_ID.MAHADISCOM_MAHARASHTRA,
      details: { isInheritance: false },
    });

    const saleDocs = saleGuide.evidenceChecklist.map((e) => e.document);
    expect(saleDocs).toContain('Prior Owner Consent / NOC (Form U)');
    expect(saleDocs).toContain('Registered Sale Deed / Conveyance Deed');
  });

  it('tracks consumer milestones privately with toggle and delete', () => {
    const tracker = new ElectricityApplicationTracker();
    const guide = generateElectricityGuide({
      journey: ELECTRICITY_JOURNEY.NEW_CONNECTION,
      discomId: DISCOM_ID.BESCOM_KARNATAKA,
    });

    const tracking = tracker.createTracking('elec-user-99', guide);
    expect(tracking.milestones.length).toBe(4);
    expect(tracking.milestones[0].isCompleted).toBe(false);

    tracker.toggleMilestone('elec-user-99', 1);
    const updated = tracker.getTracking('elec-user-99');
    expect(updated.milestones[0].isCompleted).toBe(true);

    expect(tracker.deleteTracking('elec-user-99')).toBe(true);
    expect(tracker.getTracking('elec-user-99')).toBeNull();
  });
});
