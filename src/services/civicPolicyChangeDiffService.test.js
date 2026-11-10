import { describe, it, expect } from 'vitest';
import {
  diffPolicyVersions,
  proposePolicyChangeImpact,
  reviewPolicyChangeProposal,
  evaluateSavedJourneyImpacts,
  dismissJourneyAlert,
  APPROVAL_STATUS,
  JOURNEY_ALERT_STATUS,
  IMPACT_SEVERITY,
} from './civicPolicyChangeDiffService.js';

describe('Civic Policy Change Impact and Saved-Journey Diff Service', () => {
  const v1 = {
    id: 'ration-card-v1',
    serviceId: 'RATION_CARD_TRANSFER',
    versionNumber: 1,
    effectiveDate: '2024-01-01',
    authority: 'Food & Civil Supplies Department',
    jurisdiction: 'KARNATAKA',
    citation: 'Gazette Order No. FCS/2024/01',
    rules: {
      fees: { application: 50 },
      requiredDocuments: ['Aadhaar Card', 'Electricity Bill'],
      processingDays: 30,
    },
  };

  const v2 = {
    id: 'ration-card-v2',
    serviceId: 'RATION_CARD_TRANSFER',
    versionNumber: 2,
    effectiveDate: '2025-06-01',
    authority: 'Food & Civil Supplies Department',
    jurisdiction: 'KARNATAKA',
    citation: 'Gazette Order No. FCS/2025/44',
    rules: {
      fees: { application: 100, expedited: 250 },
      requiredDocuments: ['Aadhaar Card', 'Electricity Bill', 'Income Certificate'],
      processingDays: 21,
    },
  };

  it('detects deep differences between policy versions with source citations', () => {
    const diffs = diffPolicyVersions(v1, v2);

    expect(diffs.length).toBe(4);

    const feeChanged = diffs.find((d) => d.field === 'fees.application');
    expect(feeChanged.type).toBe('FEE_CHANGED');
    expect(feeChanged.priorValue).toBe(50);
    expect(feeChanged.newValue).toBe(100);
    expect(feeChanged.severity).toBe(IMPACT_SEVERITY.CRITICAL);
    expect(feeChanged.priorCitation).toBe('Gazette Order No. FCS/2024/01');
    expect(feeChanged.newCitation).toBe('Gazette Order No. FCS/2025/44');

    const feeAdded = diffs.find((d) => d.field === 'fees.expedited');
    expect(feeAdded.type).toBe('FEE_ADDED');

    const docAdded = diffs.find((d) => d.field === 'requiredDocuments');
    expect(docAdded.newValue).toBe('Income Certificate');

    const deadlineChanged = diffs.find((d) => d.field === 'processingDays');
    expect(deadlineChanged.newValue).toBe(21);
  });

  it('strictly gates proposed impacts as DRAFT_PROPOSED before editor review', () => {
    const proposal = proposePolicyChangeImpact(v1, v2);
    expect(proposal.approvalStatus).toBe(APPROVAL_STATUS.DRAFT_PROPOSED);
    expect(proposal.approvedBy).toBeNull();
  });

  it('prevents notifications from unapproved proposals', () => {
    const unapproved = proposePolicyChangeImpact(v1, v2);
    const mockJourneys = [
      { id: 'j-1', serviceId: 'RATION_CARD_TRANSFER', collectedDocuments: ['Aadhaar Card'] },
    ];

    const alerts = evaluateSavedJourneyImpacts(unapproved, mockJourneys);
    expect(alerts.length).toBe(0);
  });

  it('generates uncertainty-labeled alerts once human editor approves the proposal', () => {
    const unapproved = proposePolicyChangeImpact(v1, v2);
    const approved = reviewPolicyChangeProposal(unapproved, 'editor_senior_01', true);

    expect(approved.approvalStatus).toBe(APPROVAL_STATUS.EDITOR_APPROVED);
    expect(approved.approvedBy).toBe('editor_senior_01');

    const mockJourneys = [
      {
        id: 'j-101',
        serviceId: 'RATION_CARD_TRANSFER',
        submissionDate: '2025-07-15',
        collectedDocuments: ['Aadhaar Card'],
      },
      {
        id: 'j-historical',
        serviceId: 'RATION_CARD_TRANSFER',
        submissionDate: '2025-02-10', // Before v2 effective date of 2025-06-01
        collectedDocuments: ['Aadhaar Card'],
      },
    ];

    const alerts = evaluateSavedJourneyImpacts(approved, mockJourneys);
    expect(alerts.length).toBe(2);

    const activeAlert = alerts.find((a) => a.journeyId === 'j-101');
    expect(activeAlert.uncertaintyLabel).toBe('AFFECTED_PENDING_REVIEW');
    expect(activeAlert.isHistoricalGrandfathered).toBe(false);

    const histAlert = alerts.find((a) => a.journeyId === 'j-historical');
    expect(histAlert.isHistoricalGrandfathered).toBe(true);
    expect(histAlert.historicalRuleNote).toContain('historical statutory guidelines apply');
  });

  it('allows citizens to dismiss an alert with reason tracking', () => {
    const alert = {
      alertId: 'alert-1',
      journeyId: 'j-101',
      alertStatus: JOURNEY_ALERT_STATUS.ACTIVE,
    };

    const dismissed = dismissJourneyAlert(alert, 'I already submitted physical income proof');
    expect(dismissed.alertStatus).toBe(JOURNEY_ALERT_STATUS.DISMISSED);
    expect(dismissed.dismissalReason).toBe('I already submitted physical income proof');
    expect(dismissed.dismissedAt).toBeDefined();
  });
});
