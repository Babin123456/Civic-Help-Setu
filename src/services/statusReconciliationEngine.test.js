import { describe, it, expect } from 'vitest';
import {
  ingestStatusEvidence,
  extractReferenceFromText,
  extractDateFromText,
  detectReferenceMismatches,
  detectTemporalInversions,
  detectTerminalConflicts,
  detectSlaStall,
  reconcileApplicationStatus,
  generateActionableGuidance,
  CONFLICT_TYPES,
  CONFLICT_SEVERITY,
} from './statusReconciliationEngine.js';
import { CANONICAL_STATUS } from './statusVocabularyNormalizer.js';

describe('statusReconciliationEngine', () => {
  describe('extractReferenceFromText and extractDateFromText', () => {
    it('extracts standard government reference formats from raw text', () => {
      expect(extractReferenceFromText('Application MH-10293 is under process')).toBe('MH-10293');
      expect(extractReferenceFromText('Notice for ref DL/2026/88921 received')).toBe('DL/2026/88921');
      expect(extractReferenceFromText('No ref code here')).toBeNull();
      expect(extractReferenceFromText(null)).toBeNull();
    });

    it('extracts ISO and DD/MM/YYYY dates from text', () => {
      expect(extractDateFromText('Updated on 2026-04-12 by clerk')).toBe('2026-04-12');
      expect(extractDateFromText('Filed on 15/08/2026 at counter')).toBe('2026-08-15');
      expect(extractDateFromText('No date mentioned')).toBeNull();
    });
  });

  describe('ingestStatusEvidence', () => {
    it('sanitizes PII from raw text and normalizes status and provenance', () => {
      const raw = 'Applicant phone +91 9876543210 and Aadhaar 2345 6789 0123. Ref MH-10293 query raised.';
      const evidence = ingestStatusEvidence({
        rawText: raw,
        sourceType: 'SMS',
        channelLabel: 'VZ-GOVMH',
      });

      expect(evidence.id).toBeDefined();
      expect(evidence.rawTextScrubbed).not.toContain('9876543210');
      expect(evidence.rawTextScrubbed).toContain('[REDACTED_PHONE]');
      expect(evidence.rawTextScrubbed).not.toContain('2345 6789 0123');
      expect(evidence.rawTextScrubbed).toContain('[REDACTED_AADHAAR]');
      expect(evidence.normalizedStatus).toBe(CANONICAL_STATUS.ACTION_REQUIRED);
      expect(evidence.extractedReferenceId).toBe('MH-10293');
      expect(evidence.provenance.channelLabel).toBe('VZ-GOVMH');
      expect(evidence.provenance.confidenceWeight).toBe(0.85);
    });

    it('respects explicitly provided referenceId, date, and rawStatus', () => {
      const evidence = ingestStatusEvidence({
        rawText: 'General remarks at counter',
        sourceType: 'PAPER_RECEIPT',
        referenceId: 'KA-99120',
        date: '2026-05-10',
        rawStatus: 'Sanctioned and Approved',
      });

      expect(evidence.extractedReferenceId).toBe('KA-99120');
      expect(evidence.extractedDate).toBe('2026-05-10');
      expect(evidence.normalizedStatus).toBe(CANONICAL_STATUS.APPROVED);
    });
  });

  describe('Anomaly Detectors', () => {
    describe('detectReferenceMismatches', () => {
      it('flags HIGH severity for completely mismatched reference numbers', () => {
        const evidence = [
          { id: '1', extractedReferenceId: 'KA-8899', sourceType: 'SMS' },
        ];
        const conflicts = detectReferenceMismatches(evidence, 'MH-10293');

        expect(conflicts).toHaveLength(1);
        expect(conflicts[0].type).toBe(CONFLICT_TYPES.REFERENCE_MISMATCH);
        expect(conflicts[0].severity).toBe(CONFLICT_SEVERITY.HIGH);
      });

      it('flags MEDIUM severity for sub-reference variations / suffixes', () => {
        const evidence = [
          { id: '2', extractedReferenceId: 'MH-10293/A', sourceType: 'PAPER_RECEIPT' },
        ];
        const conflicts = detectReferenceMismatches(evidence, 'MH-10293');

        expect(conflicts).toHaveLength(1);
        expect(conflicts[0].severity).toBe(CONFLICT_SEVERITY.MEDIUM);
        expect(conflicts[0].description).toContain('Sub-reference detected');
      });

      it('returns empty array when references match exactly', () => {
        const evidence = [
          { id: '3', extractedReferenceId: 'MH-10293', sourceType: 'PORTAL_EXPORT' },
        ];
        expect(detectReferenceMismatches(evidence, 'MH-10293')).toHaveLength(0);
      });
    });

    describe('detectTemporalInversions', () => {
      it('flags backward sequence when APPROVED on earlier date is followed by UNDER_REVIEW', () => {
        const evidence = [
          {
            id: '1',
            extractedDate: '2026-01-10',
            normalizedStatus: CANONICAL_STATUS.APPROVED,
          },
          {
            id: '2',
            extractedDate: '2026-01-20',
            normalizedStatus: CANONICAL_STATUS.UNDER_REVIEW,
          },
        ];
        const conflicts = detectTemporalInversions(evidence);

        expect(conflicts).toHaveLength(1);
        expect(conflicts[0].type).toBe(CONFLICT_TYPES.TEMPORAL_INVERSION);
        expect(conflicts[0].severity).toBe(CONFLICT_SEVERITY.HIGH);
      });

      it('does not flag normal forward progression', () => {
        const evidence = [
          {
            id: '1',
            extractedDate: '2026-01-01',
            normalizedStatus: CANONICAL_STATUS.SUBMITTED,
          },
          {
            id: '2',
            extractedDate: '2026-01-10',
            normalizedStatus: CANONICAL_STATUS.UNDER_REVIEW,
          },
          {
            id: '3',
            extractedDate: '2026-01-20',
            normalizedStatus: CANONICAL_STATUS.APPROVED,
          },
        ];
        expect(detectTemporalInversions(evidence)).toHaveLength(0);
      });
    });

    describe('detectTerminalConflicts', () => {
      it('flags high severity conflict when portal says REJECTED and SMS says APPROVED', () => {
        const evidence = [
          {
            id: '1',
            normalizedStatus: CANONICAL_STATUS.APPROVED,
            provenance: { channelLabel: 'Official SMS' },
          },
          {
            id: '2',
            normalizedStatus: CANONICAL_STATUS.REJECTED,
            provenance: { channelLabel: 'State Portal' },
          },
        ];
        const conflicts = detectTerminalConflicts(evidence);

        expect(conflicts).toHaveLength(1);
        expect(conflicts[0].type).toBe(CONFLICT_TYPES.CONTRADICTORY_TERMINAL);
        expect(conflicts[0].severity).toBe(CONFLICT_SEVERITY.HIGH);
      });
    });

    describe('detectSlaStall', () => {
      it('flags SLA stall when pending without terminal state beyond SLA threshold', () => {
        const evidence = [
          {
            id: '1',
            extractedDate: '2020-01-01',
            normalizedStatus: CANONICAL_STATUS.UNDER_REVIEW,
          },
        ];
        const conflicts = detectSlaStall(evidence, '2020-01-01', 30);

        expect(conflicts).toHaveLength(1);
        expect(conflicts[0].type).toBe(CONFLICT_TYPES.SLA_STALL);
        expect(conflicts[0].elapsedDays).toBeGreaterThan(100);
      });
    });
  });

  describe('reconcileApplicationStatus', () => {
    it('handles empty evidence list with sensible defaults', () => {
      const res = reconcileApplicationStatus({ applicationId: 'MH-10293', evidenceList: [] });
      expect(res.applicationId).toBe('MH-10293');
      expect(res.consensusStatus).toBe(CANONICAL_STATUS.SUBMITTED);
      expect(res.hasConflicts).toBe(false);
      expect(res.confidenceScore).toBe(30);
    });

    it('computes weighted consensus and deductions when contradictions exist', () => {
      const e1 = ingestStatusEvidence({
        rawText: 'Portal status: Application rejected for missing income certificate',
        sourceType: 'PORTAL_EXPORT',
        referenceId: 'MH-10293',
        date: '2026-03-01',
      });
      const e2 = ingestStatusEvidence({
        rawText: 'SMS: Application MH-10293 approved and dispatched',
        sourceType: 'SMS',
        referenceId: 'MH-10293',
        date: '2026-03-02',
      });

      const report = reconcileApplicationStatus({
        applicationId: 'MH-10293',
        evidenceList: [e1, e2],
      });

      expect(report.hasConflicts).toBe(true);
      expect(report.conflicts.some((c) => c.type === CONFLICT_TYPES.CONTRADICTORY_TERMINAL)).toBe(true);
      expect(report.guidance.actionType).toBe('VISIT_OFFICE');
      expect(report.confidenceScore).toBeLessThan(70);
    });

    it('provides high confidence when multiple sources align', () => {
      // Use recent dates within SLA threshold
      const today = new Date();
      const fiveDaysAgo = new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const e1 = ingestStatusEvidence({
        rawText: `Counter receipt: Received at Taluk office on ${fiveDaysAgo}`,
        sourceType: 'PAPER_RECEIPT',
        referenceId: 'MH-10293',
        date: fiveDaysAgo,
        rawStatus: 'Under scrutiny',
      });
      const e2 = ingestStatusEvidence({
        rawText: 'Portal export: Scrutiny pending with revenue inspector',
        sourceType: 'PORTAL_EXPORT',
        referenceId: 'MH-10293',
        date: twoDaysAgo,
        rawStatus: 'In progress review',
      });

      const report = reconcileApplicationStatus({
        applicationId: 'MH-10293',
        evidenceList: [e1, e2],
        slaDays: 30,
      });

      expect(report.consensusStatus).toBe(CANONICAL_STATUS.UNDER_REVIEW);
      expect(report.hasConflicts).toBe(false);
      expect(report.confidenceScore).toBeGreaterThan(80);
      expect(report.guidance.actionType).toBe('MONITOR');
    });
  });

  describe('generateActionableGuidance', () => {
    it('returns VISIT_OFFICE on terminal contradiction', () => {
      const guidance = generateActionableGuidance(CANONICAL_STATUS.APPROVED, [
        { type: CONFLICT_TYPES.CONTRADICTORY_TERMINAL },
      ]);
      expect(guidance.actionType).toBe('VISIT_OFFICE');
    });

    it('returns SUBMIT_DEFICIENCY on ACTION_REQUIRED without critical conflicts', () => {
      const guidance = generateActionableGuidance(CANONICAL_STATUS.ACTION_REQUIRED, []);
      expect(guidance.actionType).toBe('SUBMIT_DEFICIENCY');
    });

    it('returns ESCALATE_GRIEVANCE on REJECTED', () => {
      const guidance = generateActionableGuidance(CANONICAL_STATUS.REJECTED, []);
      expect(guidance.actionType).toBe('ESCALATE_GRIEVANCE');
    });
  });
});
