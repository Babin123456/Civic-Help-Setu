import { describe, it, expect } from 'vitest';
import {
  getDocumentSpecs,
  evaluateLostDocumentPrerequisites,
  generateDocumentRecoveryPlan,
  PersonalRecoveryChecklistManager,
  LOSS_REASON,
  RECOVERY_CHANNEL,
  RECOVERY_NAVIGATOR_DISCLAIMER,
} from './lostDocumentRecoveryNavigatorService.js';

describe('Lost Government Document Recovery and Reissue Navigator', () => {
  it('catalogues supported Indian civic documents with official authorities and fees', () => {
    const aadhaar = getDocumentSpecs('DOC_AADHAAR');
    expect(aadhaar).toBeDefined();
    expect(aadhaar.authority).toContain('UIDAI');
    expect(aadhaar.reprintFee).toBe(50);
    expect(aadhaar.canDigitalDownload).toBe(true);

    const pan = getDocumentSpecs('DOC_PAN');
    expect(pan.authority).toContain('Income Tax Department');
  });

  it('determines conditional police report requirements accurately', () => {
    // Aadhaar does not require police NCR for online PVC reprint
    const aadhaarEval = evaluateLostDocumentPrerequisites('DOC_AADHAAR', LOSS_REASON.ACCIDENTAL_LOSS);
    expect(aadhaarEval.requiresPoliceReport).toBe(false);

    // Driving licence strictly requires Police NCR on Sarathi
    const dlEval = evaluateLostDocumentPrerequisites('DOC_DRIVING_LICENCE', LOSS_REASON.ACCIDENTAL_LOSS);
    expect(dlEval.requiresPoliceReport).toBe(true);
    expect(dlEval.requiresAffidavit).toBe(true);

    // Theft always mandates police report regardless of document
    const theftEval = evaluateLostDocumentPrerequisites('DOC_AADHAAR', LOSS_REASON.THEFT);
    expect(theftEval.requiresPoliceReport).toBe(true);
  });

  it('handles natural disaster/fire exemption gracefully', () => {
    const disasterEval = evaluateLostDocumentPrerequisites('DOC_DRIVING_LICENCE', LOSS_REASON.FLOOD_NATURAL_CALAMITY);
    expect(disasterEval.requiresPoliceReport).toBe(false);
    expect(disasterEval.specialExemptionNote).toContain('Disaster Exemption');
  });

  it('generates an actionable multi-stage recovery plan with dated verification metadata', () => {
    const plan = generateDocumentRecoveryPlan({
      documentId: 'DOC_DRIVING_LICENCE',
      lossReason: LOSS_REASON.THEFT,
      jurisdiction: 'ALL_INDIA',
    });

    expect(plan.status).toBe('ACTIVE_PLAN');
    expect(plan.documentName).toBe('Driving Licence (DL)');
    expect(plan.steps.length).toBeGreaterThanOrEqual(3);

    const policeStep = plan.steps.find((s) => s.title.includes('Police Lost Property Report'));
    expect(policeStep).toBeDefined();
    expect(policeStep.isMandatory).toBe(true);

    const reprintStep = plan.steps.find((s) => s.title.includes('Duplicate'));
    expect(reprintStep.fee).toBe(200);

    expect(plan.verificationMeta.effectiveDate).toBeDefined();
    expect(plan.disclaimer).toBe(RECOVERY_NAVIGATOR_DISCLAIMER);
  });

  it('returns unavailable-data state when document is unrecognized', () => {
    const unknownPlan = generateDocumentRecoveryPlan({
      documentId: 'DOC_NONEXISTENT_XYZ',
    });

    expect(unknownPlan.status).toBe('UNAVAILABLE_DATA');
    expect(unknownPlan.steps.length).toBe(0);
    expect(unknownPlan.message).toContain('unverified');
  });

  it('manages personal checklist state safely without storing PII', () => {
    const manager = new PersonalRecoveryChecklistManager();

    const mockPlan = {
      documentId: 'DOC_AADHAAR',
      documentName: 'Aadhaar Card',
      lossReason: LOSS_REASON.ACCIDENTAL_LOSS,
      steps: [
        { stepNumber: 1, title: 'Download e-Aadhaar', isCompleted: false },
        { stepNumber: 2, title: 'Order PVC Reprint', isCompleted: false },
      ],
    };

    const saved = manager.savePlan('plan-user-123', mockPlan);
    expect(saved.planId).toBe('plan-user-123');

    // Toggle step
    const updated = manager.toggleStep('plan-user-123', 1);
    expect(updated.steps[0].isCompleted).toBe(true);

    // Retrieve
    const fetched = manager.getPlan('plan-user-123');
    expect(fetched.steps[0].isCompleted).toBe(true);

    // Delete
    const deleted = manager.deletePlan('plan-user-123');
    expect(deleted).toBe(true);
    expect(manager.getPlan('plan-user-123')).toBeNull();
  });
});
