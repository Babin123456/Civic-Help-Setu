import { describe, it, expect } from 'vitest';
import {
  CASE_TYPES,
  calculateEquitableMaintenance,
  validateSection23RevocationReadiness,
  calculateTribunalSla,
  generateEvidenceChecklist,
  buildTribunalPetition,
  formatPetitionAsPlainText,
} from './seniorCitizenTribunalService.js';

describe('seniorCitizenTribunalService (#858)', () => {
  describe('CASE_TYPES metadata', () => {
    it('defines the four statutory case types under Act 56 of 2007', () => {
      expect(CASE_TYPES.MAINTENANCE_AND_EXPENSES).toBeDefined();
      expect(CASE_TYPES.PROPERTY_REVOCATION_SEC23).toBeDefined();
      expect(CASE_TYPES.INTERIM_MAINTENANCE_RELIEF).toBeDefined();
      expect(CASE_TYPES.CONCILIATION_OFFICER_SETTLEMENT).toBeDefined();

      expect(CASE_TYPES.PROPERTY_REVOCATION_SEC23.statutorySection).toBe('Section 23');
      expect(CASE_TYPES.MAINTENANCE_AND_EXPENSES.formCode).toBe('FORM-A');
    });
  });

  describe('calculateEquitableMaintenance', () => {
    it('calculates total need, net deficit, and apportions liability across children based on income and inheritance', () => {
      const expenses = {
        food: 5000,
        shelter: 4000,
        medical: 6000,
        caregiver: 3000,
        other: 2000,
      };
      const existingIncome = 2000;
      const respondents = [
        { name: 'Son A', relationship: 'Son', monthlyIncome: 60000, hasInheritedProperty: true },
        { name: 'Daughter B', relationship: 'Daughter', monthlyIncome: 40000, hasInheritedProperty: false },
      ];

      const res = calculateEquitableMaintenance({ expenses, existingIncome, respondents });

      expect(res.totalMonthlyNeed).toBe(20000);
      expect(res.existingIncome).toBe(2000);
      expect(res.netDeficit).toBe(18000);
      expect(res.respondentsCount).toBe(2);
      expect(res.apportionedBreakdown).toHaveLength(2);

      // Son A has higher income + inherited property, so his share should be higher
      const sonShare = res.apportionedBreakdown.find((r) => r.name.includes('Son A'));
      const daughterShare = res.apportionedBreakdown.find((r) => r.name.includes('Daughter B'));
      expect(sonShare.recommendedMonthlyShare).toBeGreaterThan(daughterShare.recommendedMonthlyShare);
      expect(sonShare.recommendedMonthlyShare + daughterShare.recommendedMonthlyShare).toBeCloseTo(18000, -1);
    });

    it('divides liability equally when children have no reported income figures', () => {
      const expenses = { food: 6000, medical: 4000 };
      const respondents = [
        { name: 'Child 1', relationship: 'Son', monthlyIncome: 0 },
        { name: 'Child 2', relationship: 'Son', monthlyIncome: 0 },
      ];

      const res = calculateEquitableMaintenance({ expenses, respondents });
      expect(res.netDeficit).toBe(10000);
      expect(res.apportionedBreakdown[0].recommendedMonthlyShare).toBe(5000);
      expect(res.apportionedBreakdown[1].recommendedMonthlyShare).toBe(5000);
    });

    it('handles empty inputs safely without throwing', () => {
      const res = calculateEquitableMaintenance();
      expect(res.totalMonthlyNeed).toBe(0);
      expect(res.netDeficit).toBe(0);
      expect(res.respondentsCount).toBe(0);
      expect(res.apportionedBreakdown).toEqual([]);
    });

    it('notes when claim exceeds historical statutory cap of ₹10,000', () => {
      const highExpense = calculateEquitableMaintenance({ expenses: { medical: 15000 } });
      expect(highExpense.statutoryCeilingNoticed).toBe(true);
      expect(highExpense.statutoryCapNote).toContain('Delhi & Bombay HC rulings');

      const lowExpense = calculateEquitableMaintenance({ expenses: { medical: 5000 } });
      expect(lowExpense.statutoryCeilingNoticed).toBe(false);
    });
  });

  describe('validateSection23RevocationReadiness', () => {
    it('evaluates a strong Section 23 case with post-2007 gift deed, amenities condition, and documented neglect', () => {
      const deedInfo = {
        deedType: 'gift deed',
        transferYear: 2018,
        hasAmenityCondition: true,
        isSeniorCitizenAtTransfer: true,
        neglectDocumented: true,
        parentInPossession: true,
      };

      const result = validateSection23RevocationReadiness(deedInfo);
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.verdict).toBe('STRONG');
      expect(result.findings.some((f) => f.title.includes('Basic Amenities'))).toBe(true);
      expect(result.applicablePrecedents).toHaveLength(3);
    });

    it('identifies cautionary grounds for pre-2007 deeds or undocumented neglect', () => {
      const deedInfo = {
        deedType: 'settlement',
        transferYear: 2004,
        hasAmenityCondition: false,
        isSeniorCitizenAtTransfer: false,
        neglectDocumented: false,
        parentInPossession: false,
      };

      const result = validateSection23RevocationReadiness(deedInfo);
      expect(result.verdict).toBe('WEAK');
      expect(result.findings.some((f) => f.title.includes('Pre-2007'))).toBe(true);
      expect(result.findings.some((f) => f.title.includes('Dispossession'))).toBe(true);
    });
  });

  describe('calculateTribunalSla', () => {
    it('calculates remaining days within 90-day statutory resolution window', () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const sla = calculateTribunalSla({ filingDate: tenDaysAgo, currentStage: 'NOTICE_SERVED' });

      expect(sla.daysSinceFiling).toBe(10);
      expect(sla.daysRemaining).toBe(80);
      expect(sla.isOverdue).toBe(false);
      expect(sla.escalationReady).toBe(false);
      expect(sla.currentPhase).toBe('Stage 1: Filing & Notice');
    });

    it('flags overdue cases and activates Section 16 Appellate escalation when 90 days exceeded', () => {
      const hundredDaysAgo = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const sla = calculateTribunalSla({ filingDate: hundredDaysAgo, currentStage: 'INQUIRY' });

      expect(sla.daysSinceFiling).toBe(100);
      expect(sla.daysRemaining).toBe(0);
      expect(sla.isOverdue).toBe(true);
      expect(sla.escalationReady).toBe(true);
      expect(sla.escalationRemedy).toContain('Section 16 Appeal');
    });
  });

  describe('generateEvidenceChecklist', () => {
    it('provides tailored checklists for property revocation cases', () => {
      const checklist = generateEvidenceChecklist('PROPERTY_REVOCATION_SEC23');
      expect(checklist.some((item) => item.id === 'DEED_COPY')).toBe(true);
      expect(checklist.some((item) => item.id === 'REVENUE_EXTRACT')).toBe(true);
      expect(checklist.some((item) => item.id === 'NEGLECT_EVIDENCE')).toBe(true);
    });

    it('provides tailored checklists for interim maintenance claims', () => {
      const checklist = generateEvidenceChecklist('INTERIM_MAINTENANCE_RELIEF');
      expect(checklist.some((item) => item.id === 'MEDICAL_PRESCRIPTIONS')).toBe(true);
      expect(checklist.some((item) => item.id === 'URGENCY_AFFIDAVIT')).toBe(true);
    });
  });

  describe('buildTribunalPetition and formatPetitionAsPlainText', () => {
    const samplePetitionData = {
      caseType: 'PROPERTY_REVOCATION_SEC23',
      petitionerName: 'Rameshwar Dayal',
      petitionerAge: 72,
      district: 'Jaipur',
      state: 'Rajasthan',
      address: 'Plot 45, Malviya Nagar, Jaipur',
      phone: '9876543210',
      respondents: [
        {
          name: 'Sunil Dayal',
          relationship: 'Eldest Son',
          address: 'Plot 45, Malviya Nagar, Jaipur',
          monthlyIncome: 75000,
          hasInheritedProperty: true,
        },
      ],
      monthlyClaim: 12000,
      propertyDescription: 'Two storey residential house situated at Plot 45, Malviya Nagar, Jaipur',
      narrative:
        'The respondent fraudulently obtained a gift deed promising to provide food and shelter, but thereafter threw the petitioner out.',
    };

    it('builds structured statutory petition with deterministic SHA-256 seal', () => {
      const petition = buildTribunalPetition(samplePetitionData);

      expect(petition.petitioner.name).toBe('Rameshwar Dayal');
      expect(petition.statutorySection).toBe('Section 23');
      expect(petition.sha256Digest).toMatch(/^[0-9a-f]{64}$/);
      expect(petition.filingReference).toContain('MWPSC-JAI-');
    });

    it('formats legally sound plain-text draft for physical SDM filing', () => {
      const petition = buildTribunalPetition(samplePetitionData);
      const text = formatPetitionAsPlainText(petition);

      expect(text).toContain('BEFORE THE MAINTENANCE TRIBUNAL / SUB-DIVISIONAL MAGISTRATE');
      expect(text).toContain('JAIPUR');
      expect(text).toContain('PETITIONER / PARENT');
      expect(text).toContain('Sunil Dayal (Eldest Son)');
      expect(text).toContain('GROUNDS FOR SECTION 23 PROPERTY TRANSFER REVOCATION');
      expect(text).toContain('PRAYER');
      expect(text).toContain('Declare the transfer deed in respect of');
      expect(text).toContain('VERIFICATION');
    });

    it('formats plain-text safely when petition is null', () => {
      expect(formatPetitionAsPlainText(null)).toBe('');
    });
  });
});
