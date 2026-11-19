import { describe, it, expect } from 'vitest';
import {
  verifyServiceCentre,
  auditKioskFeeCompliance,
  processCentreFeedback,
  exportCentreVisitDossier,
  auditCentreInfrastructure,
  SERVICE_CENTRE_TYPES,
  NOTIFIED_SERVICE_FEES
} from './digitalServiceCentreDirectoryService';

describe('digitalServiceCentreDirectoryService', () => {
  it('should define service centre models and rate tiers', () => {
    expect(SERVICE_CENTRE_TYPES.CSC_VLE.code).toBe('CSC_VLE');
    expect(SERVICE_CENTRE_TYPES.STATE_KIOSK.code).toBe('STATE_KIOSK');
    expect(NOTIFIED_SERVICE_FEES.AADHAAR_MANDATORY_BIOMETRIC.govtFee).toBe(0);
    expect(NOTIFIED_SERVICE_FEES.AADHAAR_DEMOGRAPHIC_UPDATE.govtFee).toBe(50);
  });

  it('should verify compliant service centre profile', () => {
    const centre = {
      kendraId: '123456789012',
      operatorName: 'Ramesh Patel',
      centreType: 'CSC_VLE',
      hasRateChartDisplayed: true
    };

    const res = verifyServiceCentre(centre);
    expect(res.isValidId).toBe(true);
    expect(res.isCompliant).toBe(true);
    expect(res.errors).toHaveLength(0);
    expect(res.warnings).toHaveLength(0);
  });

  it('should detect rate overcharging accurately', () => {
    // Aadhaar demographic update max permissible is ₹50
    const compliantAudit = auditKioskFeeCompliance('AADHAAR_DEMOGRAPHIC_UPDATE', 50);
    expect(compliantAudit.isCompliant).toBe(true);
    expect(compliantAudit.isOvercharging).toBe(false);

    // If charged ₹100
    const overchargedAudit = auditKioskFeeCompliance('AADHAAR_DEMOGRAPHIC_UPDATE', 100);
    expect(overchargedAudit.isCompliant).toBe(false);
    expect(overchargedAudit.isOvercharging).toBe(true);
    expect(overchargedAudit.excessAmount).toBe(50);
    expect(overchargedAudit.remedy).toContain('Excess charge of ₹50');
  });

  it('should sanitize citizen feedback and preserve privacy', () => {
    const rawFeedback = {
      kendraId: 'CSC_998877',
      serviceCode: 'PAN_APPLICATION',
      rating: 4,
      providedReceipt: true,
      overchargingReported: false,
      remarks: 'Fast processing and polite operator.',
      citizenPhone: '9876543210' // must not be retained in record
    };

    const res = processCentreFeedback(rawFeedback);
    expect(res.success).toBe(true);
    expect(res.feedbackRecord.citizenPhone).toBeUndefined();
    expect(res.feedbackRecord.rating).toBe(4);
    expect(res.feedbackRecord.kendraId).toBe('CSC_998877');
  });

  it('should audit physical infrastructure and technical compliance', () => {
    const res = auditCentreInfrastructure(['biometric', 'web', 'thermal', 'ramp', 'clean']);
    expect(res.isFullyCompliant).toBe(true);
    expect(res.helpdesk.CSC_DIGITAL_INDIA.tollFree).toBe('14599');
  });

  it('should export formatted markdown visit dossier with rate chart', () => {
    const centre = {
      centreName: 'Seva Kendra Sector 14',
      kendraId: 'CSC_112233',
      operatorName: 'Aarti Sharma',
      centreType: 'CSC_VLE',
      hasRateChartDisplayed: true
    };

    const dossier = exportCentreVisitDossier(centre);
    expect(dossier).toContain('# Digital Service Centre (CSC / Kiosk) Verification Dossier');
    expect(dossier).toContain('CSC_112233');
    expect(dossier).toContain('Aadhaar Biometric Update');
    expect(dossier).toContain('Mandatory Receipt');
  });
});
