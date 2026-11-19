import { describe, it, expect, beforeEach } from 'vitest';
import {
  VALIDITY_STATUS,
  VALIDITY_TYPE,
  SERVICE_FRESHNESS_RULES,
  DEPENDENCY_LANES,
  evaluateDocumentValidity,
  generateAIExplanation,
  documentValidityStore,
  exportValidityCalendarSummary,
  getDependencyLaneForService,
  calculateAdjustedDaysRemaining,
  getLaneForDocAndService,
} from './civicDocumentValidityCalendarService.js';

const citizenId = 'usr_citizen_444';

describe('civicDocumentValidityCalendarService - Enhanced', () => {
  beforeEach(() => {
    documentValidityStore.reset();
  });

  describe('SERVICE_FRESHNESS_RULES', () => {
    it('has expected freshness rule categories', () => {
      expect(SERVICE_FRESHNESS_RULES).toBeDefined();
      expect(SERVICE_FRESHNESS_RULES.INCOME_CERTIFICATE).toBeDefined();
      expect(SERVICE_FRESHNESS_RULES.PUC_CERTIFICATE).toBeDefined();
      expect(SERVICE_FRESHNESS_RULES.PASSPORT_ADULT).toBeDefined();
      expect(SERVICE_FRESHNESS_RULES.DRIVING_LICENSE).toBeDefined();
    });

    it('INCOME_CERTIFICATE has state-specific rules', () => {
      const central = SERVICE_FRESHNESS_RULES.INCOME_CERTIFICATE.CENTRAL;
      expect(central.freshnessModifierMonths).toBe(-3);
      expect(central.description).toContain('3-month reduced validity');
      expect(central.type).toBe('reduces');

      const tn = SERVICE_FRESHNESS_RULES.INCOME_CERTIFICATE.TAMIL_NADU;
      expect(tn.freshnessModifierMonths).toBe(-6);
      expect(tn.description).toContain('6-month reduced validity');

      const mh = SERVICE_FRESHNESS_RULES.INCOME_CERTIFICATE.MAHARASHTRA;
      expect(mh.freshnessModifierMonths).toBe(-3);
      expect(mh.description).toContain('3-month reduced validity');
    });
  });

  describe('DEPENDENCY_LANES', () => {
    it('has expected dependency lane entries', () => {
      expect(DEPENDENCY_LANES).toBeDefined();
      expect(DEPENDENCY_LANES.income_certificate).toBeDefined();
      expect(DEPENDENCY_LANES.driving_license).toBeDefined();
      expect(DEPENDENCY_LANES.passport).toBeDefined();
      expect(DEPENDENCY_LANES.ration_card).toBeDefined();
      expect(DEPENDENCY_LANES.ayushman_bharat_card).toBeDefined();
      expect(DEPENDENCY_LANES.fire_noc).toBeDefined();
    });

    it('income_certificate lane has correct properties', () => {
      const lane = DEPENDENCY_LANES.income_certificate;
      expect(lane.requiresDocument).toBe('income-certificate');
      expect(lane.freshnessAdjustmentMonths).toBe(-3);
      expect(lane.description).toContain('freshness');
    });

    it('driving_license lane references income certificate', () => {
      const lane = DEPENDENCY_LANES.driving_license;
      expect(lane.requiresDocument).toBe('income-certificate');
      expect(typeof lane.freshnessAdjustmentMonths).toBe('number');
    });
  });

  describe('getDependencyLaneForService', () => {
    it('finds lane for income_certificate', () => {
      const lane = getDependencyLaneForService('income-certificate');
      expect(lane).toBeDefined();
      expect(lane.requiresDocument).toBe('income-certificate');
    });

    it('finds lane for driving_license', () => {
      const lane = getDependencyLaneForService('driving-license');
      expect(lane).toBeDefined();
      expect(lane.freshnessAdjustmentMonths).toBeDefined();
    });

    it('returns null for unknown service', () => {
      const lane = getDependencyLaneForService('unknown-service');
      expect(lane).toBeNull();
    });
  });

  describe('getLaneForDocAndService', () => {
    it('maps income certificate to income_certificate lane', () => {
      const lane = getLaneForDocAndService('INCOME_CERTIFICATE', 'income-certificate');
      expect(lane).toBeDefined();
      expect(lane.requiresDocument).toBe('income-certificate');
    });

    it('maps driving license to driving_license lane', () => {
      const lane = getLaneForDocAndService('DRIVING_LICENSE', 'driving-license');
      expect(lane).toBeDefined();
      expect(lane.freshnessAdjustmentMonths).toBeDefined();
    });

    it('returns null for unknown document type', () => {
      const lane = getLaneForDocAndService('UNKNOWN_DOC', 'income-certificate');
      expect(lane).toBeNull();
    });
  });

  describe('calculateAdjustedDaysRemaining', () => {
    it('returns null adjusted days when daysRemaining is null', () => {
      const result = calculateAdjustedDaysRemaining(
        { daysRemaining: null },
        'income-certificate'
      );
      expect(result.adjustedDays).toBeNull();
      expect(result.freshnessInfo).toBeNull();
    });

    it('applies freshness reduction when daysRemaining > 0', () => {
      const result = calculateAdjustedDaysRemaining(
        { daysRemaining: 90 },
        'income-certificate'
      );
      expect(result.adjustedDays).toBeLessThan(90);
      expect(result.freshnessInfo).toBeDefined();
      expect(result.freshnessInfo.freshnessModifierMonths).toBe(-3);
      expect(result.freshnessInfo.adjustmentDays).toBeLessThan(0);
    });

    it('applies freshness adjustment when daysRemaining is 0', () => {
      const result = calculateAdjustedDaysRemaining(
        { daysRemaining: 0 },
        'income-certificate'
      );
      // Freshness info is computed even for 0 days remaining when a lane is found
      expect(result.freshnessInfo).toBeDefined();
      expect(result.adjustedDays).toBe(0);
    });

    it('applies freshness adjustment when daysRemaining is negative', () => {
      const result = calculateAdjustedDaysRemaining(
        { daysRemaining: -5 },
        'income-certificate'
      );
      // Freshness info is computed for all statuses including expired
      expect(result.freshnessInfo).toBeDefined();
      // Adjustment is applied even for negative days
      expect(result.adjustedDays).toBeLessThan(-5);
    });

    it('uses correct modifier for income-certificate lane', () => {
      const result = calculateAdjustedDaysRemaining(
        { daysRemaining: 180 },
        'income-certificate'
      );
      expect(result.adjustedDays).toBeLessThan(180);
      expect(result.freshnessInfo.freshnessModifierMonths).toBe(-3);
    });
  });

  describe('evaluateDocumentValidity with serviceId', () => {
    it('includes freshnessInfo when serviceId is provided for income-certificate with TAMIL_NADU', () => {
      const result = evaluateDocumentValidity({
        category: 'INCOME_CERTIFICATE',
        stateKey: 'TAMIL_NADU',
        issueDate: '2026-01-01',
        serviceId: 'income-certificate',
      });

      expect(result.freshnessInfo).toBeDefined();
      expect(result.freshnessInfo.description).toContain('3-month');
      expect(result.freshnessInfo.originalDaysRemaining).toBeGreaterThan(0);
    });

    it('includes dependencyLane when serviceId is provided', () => {
      const result = evaluateDocumentValidity({
        category: 'INCOME_CERTIFICATE',
        stateKey: 'TAMIL_NADU',
        issueDate: '2026-01-01',
        serviceId: 'passport',
      });

      expect(result.dependencyLane).toBeDefined();
      expect(result.dependencyLane.requiresDocument).toBe('income-certificate');
    });

    it('preserves original validity evaluation for Tamil Nadu income certificate', () => {
      const result = evaluateDocumentValidity({
        category: 'INCOME_CERTIFICATE',
        stateKey: 'TAMIL_NADU',
        issueDate: '2026-01-01',
      });

      expect(result.status).toBeDefined();
      expect(result.validityType).toBeDefined();
      // Tamil Nadu income certificate = 12 months standard tenure
      expect(result.expiryDate).toBe('2027-01-01');
    });

    it('returns UNKNOWN when category not in state catalog', () => {
      const result = evaluateDocumentValidity({
        category: 'INCOME_CERTIFICATE',
        stateKey: 'CENTRAL',
        issueDate: '2026-01-01',
      });

      // INCOME_CERTIFICATE is not in CENTRAL catalogue, so status is UNKNOWN
      expect(result.status).toBe(VALIDITY_STATUS.UNKNOWN);
    });
  });

  describe('generateAIExplanation', () => {
    it('generates explanation with document title and issue date', () => {
      const result = generateAIExplanation({
        documentTitle: 'Income Certificate',
        issueDate: '2026-01-01',
        serviceId: 'income-certificate',
        stateKey: 'TAMIL_NADU',
      });

      expect(result).toBeDefined();
      expect(result.suggestion).toBeDefined();
      expect(result.confidence).toBeDefined();
      expect(result.source).toBeDefined();
      expect(result.dataVersion).toBeDefined();
      expect(result.disclaimer).toBeDefined();
      expect(Array.isArray(result.explanationParts)).toBe(true);
    });

    it('returns error when documentTitle is missing', () => {
      const result = generateAIExplanation({
        issueDate: '2026-01-01',
      });

      expect(result.suggestion).toContain('Please provide a document title');
      expect(result.confidence).toBe(0);
    });

    it('returns error when issueDate is missing', () => {
      const result = generateAIExplanation({
        documentTitle: 'Income Certificate',
      });

      expect(result.suggestion).toContain('Unable to assess staleness');
      expect(result.confidence).toBe(0);
    });

    it('includes explanation parts for official expiry', () => {
      const result = generateAIExplanation({
        documentTitle: 'Income Certificate',
        issueDate: '2026-01-01',
        serviceId: 'income-certificate',
        stateKey: 'TAMIL_NADU',
      });

      expect(result.explanationParts).toBeDefined();
      const hasOfficialExpiry = result.explanationParts.some(
        (p) => p.type === 'officialExpiry'
      );
      expect(hasOfficialExpiry).toBe(true);
    });

    it('includes explanation parts for freshness limit', () => {
      const result = generateAIExplanation({
        documentTitle: 'Income Certificate',
        issueDate: '2026-01-01',
        serviceId: 'income-certificate',
        stateKey: 'TAMIL_NADU',
      });

      const hasFreshness = result.explanationParts.some(
        (p) => p.type === 'freshnessLimit'
      );
      expect(hasFreshness).toBe(true);
    });

    it('includes disclaimer that output is a suggestion', () => {
      const result = generateAIExplanation({
        documentTitle: 'Income Certificate',
        issueDate: '2026-01-01',
        serviceId: 'income-certificate',
        stateKey: 'TAMIL_NADU',
      });

      expect(result.disclaimer).toBeDefined();
      expect(result.disclaimer.toLowerCase()).toContain('suggestion');
      expect(result.disclaimer.toLowerCase()).toContain('confirm with official sources');
    });

    it('has confidence based on status', () => {
      // EXPIRED should have higher confidence
      const expiredResult = generateAIExplanation({
        documentTitle: 'Income Certificate',
        issueDate: '2025-01-01',
        serviceId: 'income-certificate',
        stateKey: 'TAMIL_NADU',
      });
      expect(expiredResult.confidence).toBeGreaterThan(0.5);

      // VALID should have lower confidence
      const validResult = generateAIExplanation({
        documentTitle: 'Income Certificate',
        issueDate: '2026-01-01',
        serviceId: 'income-certificate',
        stateKey: 'TAMIL_NADU',
      });
      expect(validResult.confidence).toBeLessThanOrEqual(0.7);
    });
  });

  describe('exportValidityCalendarSummary', () => {
    it('exports summary without document file contents', () => {
      const rec1 = documentValidityStore.create(
        {
          documentTitle: 'Income Certificate',
          category: 'INCOME_CERTIFICATE',
          issueDate: '2026-01-01',
          stateKey: 'TAMIL_NADU',
        },
        citizenId
      );

      const exportData = exportValidityCalendarSummary([rec1]);
      expect(exportData.totalTrackedDocuments).toBe(1);
      expect(exportData.schedule[0].documentTitle).toBe('Income Certificate');
      expect(exportData.schedule[0].expiryDate).toBe('2027-01-01');

      // Confirm no file payload exists
      const stringified = JSON.stringify(exportData);
      expect(stringified).not.toContain('fileContent');
      expect(stringified).not.toContain('blob');
      expect(stringified).not.toContain('base64');
    });

    it('includes disclaimer about no document contents', () => {
      const rec1 = documentValidityStore.create(
        {
          documentTitle: 'Income Certificate',
          category: 'INCOME_CERTIFICATE',
          issueDate: '2026-01-01',
          stateKey: 'TAMIL_NADU',
        },
        citizenId
      );

      const exportData = exportValidityCalendarSummary([rec1]);
      expect(exportData.disclaimer).toBeDefined();
      expect(exportData.disclaimer).toContain('No document contents');
    });

    it('handles empty records array', () => {
      const exportData = exportValidityCalendarSummary([]);
      expect(exportData.totalTrackedDocuments).toBe(0);
      expect(exportData.schedule).toEqual([]);
    });
  });
});