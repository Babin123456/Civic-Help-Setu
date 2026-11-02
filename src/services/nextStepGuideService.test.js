import { describe, it, expect } from 'vitest';
import { generateNextStepGuide, SOURCE_FIELDS } from './nextStepGuideService';
import { MOCK_SERVICES } from '../data/services';

const completeService = MOCK_SERVICES.find((s) => s.id === 'birth-certificate');
const recentDate = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10); // 30 days ago
const serviceWithContacts = {
  ...completeService,
  contacts: [
    {
      type: 'helpdesk',
      method: 'phone',
      value: '1800-123-4567',
      sourceUrl: 'https://services.india.gov.in',
      lastVerified: recentDate,
    },
  ],
};
const completeServiceWithContacts = {
  ...completeService,
  contacts: [
    {
      type: 'helpdesk',
      method: 'phone',
      value: '1800-123-4567',
      sourceUrl: 'https://services.india.gov.in',
      lastVerified: recentDate,
    },
  ],
};

describe('generateNextStepGuide', () => {
  describe('Complete service record', () => {
    it('generates a guide with all steps for a complete service with contacts', () => {
      const guide = generateNextStepGuide(completeServiceWithContacts);

      expect(guide.serviceId).toBe('birth-certificate');
      expect(guide.serviceName).toBe('Birth Certificate');
      expect(guide.hasData).toBe(true);
      expect(guide.steps.length).toBeGreaterThan(5);
      expect(guide.summary.traceableSteps).toBeGreaterThan(0);
      expect(guide.summary.confirmationSteps).toBe(0);
    });

    it('generates a guide for a service without contacts (has confirmation step)', () => {
      const guide = generateNextStepGuide(completeService);

      expect(guide.hasData).toBe(true);
      expect(guide.summary.confirmationSteps).toBe(1); // contacts missing
    });

    it('includes official source step with verified URL', () => {
      const guide = generateNextStepGuide(completeService);
      const sourceStep = guide.steps.find((s) => s.sourceField === SOURCE_FIELDS.OFFICIAL_SOURCE);

      expect(sourceStep).toBeDefined();
      expect(sourceStep.needsConfirmation).toBe(false);
      expect(sourceStep.officialUrl).toBe('https://services.india.gov.in');
      expect(sourceStep.sourceLabel).toBe('National Government Services Portal');
    });

    it('includes documents step', () => {
      const guide = generateNextStepGuide(completeService);
      const docStep = guide.steps.find((s) => s.sourceField === SOURCE_FIELDS.DOCUMENTS);

      expect(docStep).toBeDefined();
      expect(docStep.needsConfirmation).toBe(false);
      expect(docStep.description).toContain('Proof of birth from hospital');
      expect(docStep.sourceLabel).toContain('documents');
    });

    it('includes service steps in order', () => {
      const guide = generateNextStepGuide(completeService);
      const stepSteps = guide.steps.filter((s) => s.sourceField === SOURCE_FIELDS.STEPS);

      expect(stepSteps.length).toBe(3);
      expect(stepSteps[0].title).toBe('Register the birth');
      expect(stepSteps[1].title).toBe('Gather documents');
      expect(stepSteps[2].title).toBe('Apply online/offline');
    });

    it('includes contacts step when contacts are available and verified', () => {
      const guide = generateNextStepGuide(completeServiceWithContacts);
      const contactStep = guide.steps.find((s) => s.sourceField === SOURCE_FIELDS.CONTACTS);

      expect(contactStep).toBeDefined();
      expect(contactStep.needsConfirmation).toBe(false);
      expect(contactStep.officialUrl).toBe('tel:18001234567');
    });

    it('includes eligibility step', () => {
      const guide = generateNextStepGuide(completeService);
      const eligStep = guide.steps.find((s) => s.sourceField === SOURCE_FIELDS.ELIGIBILITY);

      expect(eligStep).toBeDefined();
      expect(eligStep.needsConfirmation).toBe(false);
      expect(eligStep.description).toContain('Parents of the newborn');
    });

    it('includes fees step', () => {
      const guide = generateNextStepGuide(completeService);
      const feeStep = guide.steps.find((s) => s.sourceField === SOURCE_FIELDS.FEES);

      expect(feeStep).toBeDefined();
      expect(feeStep.needsConfirmation).toBe(false);
      expect(feeStep.description).toContain('₹20 - ₹100');
    });

    it('includes processing time step', () => {
      const guide = generateNextStepGuide(completeService);
      const timeStep = guide.steps.find((s) => s.sourceField === SOURCE_FIELDS.PROCESSING_TIME);

      expect(timeStep).toBeDefined();
      expect(timeStep.needsConfirmation).toBe(false);
      expect(timeStep.description).toContain('7 - 30 days');
    });

    it('includes warnings step', () => {
      const guide = generateNextStepGuide(completeService);
      const warnStep = guide.steps.find((s) => s.sourceField === SOURCE_FIELDS.WARNINGS);

      expect(warnStep).toBeDefined();
      expect(warnStep.needsConfirmation).toBe(false);
      expect(warnStep.description).toContain('Late registration');
    });

    it('ends with submit and track step', () => {
      const guide = generateNextStepGuide(completeService);
      const lastStep = guide.steps[guide.steps.length - 1];

      expect(lastStep.title).toBe('Submit your application and track progress');
      expect(lastStep.sourceLabel).toBe('General guidance');
      expect(lastStep.needsConfirmation).toBe(false);
    });
  });

  describe('Missing officialSources', () => {
    it('marks official source step as needing confirmation', () => {
      const service = { ...completeService, officialSources: [] };
      const guide = generateNextStepGuide(service);

      const sourceStep = guide.steps.find((s) => s.order === 1);
      expect(sourceStep.needsConfirmation).toBe(true);
      expect(sourceStep.confirmationReason).toContain('officialSources');
      expect(sourceStep.officialUrl).toBeNull();
    });

    it('handles missing officialSources array', () => {
      const service = { ...completeService };
      delete service.officialSources;
      const guide = generateNextStepGuide(service);

      const sourceStep = guide.steps.find((s) => s.order === 1);
      expect(sourceStep.needsConfirmation).toBe(true);
    });

    it('handles unverified official sources', () => {
      const service = {
        ...completeService,
        officialSources: [{ name: 'Unverified Portal', url: 'https://example.com', verified: false }],
      };
      const guide = generateNextStepGuide(service);

      const sourceStep = guide.steps.find((s) => s.order === 1);
      expect(sourceStep.needsConfirmation).toBe(false);
      expect(sourceStep.officialUrl).toBe('https://example.com');
    });
  });

  describe('Missing documents', () => {
    it('marks documents step as needing confirmation', () => {
      const service = { ...completeService, documents: [] };
      const guide = generateNextStepGuide(service);

      const docStep = guide.steps.find((s) => s.sourceField === SOURCE_FIELDS.DOCUMENTS || s.needsConfirmation);
      expect(docStep.needsConfirmation).toBe(true);
      expect(docStep.confirmationReason).toContain('documents');
    });

    it('handles missing documents array', () => {
      const service = { ...completeService };
      delete service.documents;
      const guide = generateNextStepGuide(service);

      const docStep = guide.steps.find((s) => s.needsConfirmation && s.confirmationReason?.includes('documents'));
      expect(docStep).toBeDefined();
    });
  });

  describe('Missing steps', () => {
    it('marks steps as needing confirmation', () => {
      const service = { ...completeService, steps: [] };
      const guide = generateNextStepGuide(service);

      const stepStep = guide.steps.find((s) => s.needsConfirmation && s.confirmationReason?.includes('steps'));
      expect(stepStep).toBeDefined();
    });

    it('handles missing steps array', () => {
      const service = { ...completeService };
      delete service.steps;
      const guide = generateNextStepGuide(service);

      const stepStep = guide.steps.find((s) => s.needsConfirmation && s.confirmationReason?.includes('steps'));
      expect(stepStep).toBeDefined();
    });
  });

  describe('Missing contacts', () => {
    it('marks contacts step as needing confirmation', () => {
      const service = { ...completeService, contacts: [] };
      const guide = generateNextStepGuide(service);

      const contactStep = guide.steps.find((s) => s.needsConfirmation && s.confirmationReason?.includes('contacts'));
      expect(contactStep).toBeDefined();
    });

    it('handles missing contacts array', () => {
      const service = { ...completeService };
      delete service.contacts;
      const guide = generateNextStepGuide(service);

      const contactStep = guide.steps.find((s) => s.needsConfirmation && s.confirmationReason?.includes('contacts'));
      expect(contactStep).toBeDefined();
    });

    it('marks expired contacts as needing confirmation', () => {
      const service = {
        ...completeService,
        contacts: [
          {
            type: 'helpdesk',
            method: 'phone',
            value: '1800-123-4567',
            sourceUrl: 'https://services.india.gov.in',
            lastVerified: '2020-01-15', // Expired
          },
        ],
      };
      const guide = generateNextStepGuide(service);

      const contactStep = guide.steps.find((s) => s.sourceField === SOURCE_FIELDS.CONTACTS);
      expect(contactStep.needsConfirmation).toBe(true);
      expect(contactStep.confirmationReason).toContain('verified');
    });

    it('marks invalid contacts as needing confirmation', () => {
      const service = {
        ...completeService,
        contacts: [
          {
            type: 'helpdesk',
            method: 'phone',
            value: 'invalid',
            sourceUrl: 'https://services.india.gov.in',
            lastVerified: '2024-01-15',
          },
        ],
      };
      const guide = generateNextStepGuide(service);

      const contactStep = guide.steps.find((s) => s.needsConfirmation && s.confirmationReason?.includes('contacts'));
      expect(contactStep).toBeDefined();
    });
  });

  describe('Empty or incomplete catalogue records', () => {
    it('returns empty guide for null service', () => {
      const guide = generateNextStepGuide(null);

      expect(guide.hasData).toBe(false);
      expect(guide.serviceId).toBeNull();
      expect(guide.steps.length).toBe(1);
      expect(guide.steps[0].needsConfirmation).toBe(true);
      expect(guide.steps[0].title).toBe('Service information unavailable');
    });

    it('returns empty guide for undefined service', () => {
      const guide = generateNextStepGuide(undefined);

      expect(guide.hasData).toBe(false);
    });

    it('returns empty guide for empty object', () => {
      const guide = generateNextStepGuide({});

      expect(guide.hasData).toBe(false);
      expect(guide.steps[0].needsConfirmation).toBe(true);
    });

    it('returns empty guide for service with only id', () => {
      const guide = generateNextStepGuide({ id: 'test' });

      expect(guide.hasData).toBe(false);
      expect(guide.serviceId).toBe('test');
    });

    it('handles service with minimal fields', () => {
      const service = {
        id: 'minimal',
        name: 'Minimal Service',
        officialSources: [],
        documents: [],
        steps: [],
        contacts: [],
      };
      const guide = generateNextStepGuide(service);

      expect(guide.hasData).toBe(false);
      expect(guide.summary.confirmationSteps).toBeGreaterThanOrEqual(4);
    });
  });

  describe('No fabrication of unsupported information', () => {
    it('does not invent fees when not in service record', () => {
      const service = { ...completeService };
      delete service.fees;
      const guide = generateNextStepGuide(service);

      const feeStep = guide.steps.find((s) => s.sourceField === SOURCE_FIELDS.FEES);
      expect(feeStep).toBeUndefined();
    });

    it('does not invent processing time when not in service record', () => {
      const service = { ...completeService };
      delete service.processingTime;
      const guide = generateNextStepGuide(service);

      const timeStep = guide.steps.find((s) => s.sourceField === SOURCE_FIELDS.PROCESSING_TIME);
      expect(timeStep).toBeUndefined();
    });

    it('does not invent office addresses', () => {
      const guide = generateNextStepGuide(completeService);

      guide.steps.forEach((step) => {
        // Check that we don't add made-up physical addresses (numbered street/road/avenue etc.)
        // The original service data may contain words like "office" in legitimate context
        expect(step.description).not.toMatch(/\d+\s+(street|road|avenue|lane|block|sector|floor|room)\b/i);
        // Should not contain fabricated address patterns like "123 Main Street" or "Room 404"
        expect(step.description).not.toMatch(/\b(room|floor)\s+\d+/i);
      });
    });

    it('does not invent eligibility criteria', () => {
      const service = { ...completeService };
      delete service.eligibility;
      const guide = generateNextStepGuide(service);

      const eligStep = guide.steps.find((s) => s.sourceField === SOURCE_FIELDS.ELIGIBILITY);
      expect(eligStep).toBeUndefined();
    });

    it('does not invent document requirements', () => {
      const service = { ...completeService };
      delete service.documents;
      const guide = generateNextStepGuide(service);

      const docStep = guide.steps.find((s) => s.sourceField === SOURCE_FIELDS.DOCUMENTS);
      expect(docStep).toBeUndefined();
      // Should have a confirmation step instead
      const confirmStep = guide.steps.find((s) => s.needsConfirmation && s.confirmationReason?.includes('documents'));
      expect(confirmStep).toBeDefined();
    });
  });

  describe('Step traceability', () => {
    it('every step has a sourceField or is marked as needing confirmation', () => {
      const guide = generateNextStepGuide(completeService);

      guide.steps.forEach((step) => {
        if (step.needsConfirmation) {
          expect(step.confirmationReason).toBeDefined();
          expect(step.sourceLabel).toBe('Confirmation needed');
        } else {
          expect(step.sourceField).toBeDefined();
          expect(step.sourceLabel).toBeDefined();
        }
      });
    });

    it('official source step links to verified URL when available', () => {
      const guide = generateNextStepGuide(completeService);
      const sourceStep = guide.steps.find((s) => s.sourceField === SOURCE_FIELDS.OFFICIAL_SOURCE);

      expect(sourceStep.officialUrl).toBeDefined();
      expect(sourceStep.officialUrl).toMatch(/^https?:\/\//);
    });

    it('contact step includes actionable href when available', () => {
      const guide = generateNextStepGuide(serviceWithContacts);
      const contactStep = guide.steps.find((s) => s.sourceField === SOURCE_FIELDS.CONTACTS);

      expect(contactStep.officialUrl).toBeDefined();
      expect(contactStep.officialUrl).toMatch(/^(tel:|mailto:|https?:)/);
    });
  });

  describe('Summary metadata', () => {
    it('includes accurate summary counts', () => {
      const guide = generateNextStepGuide(completeService);

      expect(guide.summary.totalSteps).toBe(guide.steps.length);
      expect(guide.summary.traceableSteps).toBe(guide.steps.filter((s) => s.sourceField && !s.needsConfirmation).length);
      expect(guide.summary.confirmationSteps).toBe(guide.steps.filter((s) => s.needsConfirmation).length);
      expect(guide.summary.hasOfficialSource).toBe(true);
      expect(guide.summary.hasDocuments).toBe(true);
      expect(guide.summary.hasSteps).toBe(true);
    });

    it('summary reflects missing data', () => {
      const service = { ...completeService, officialSources: [], documents: [], steps: [], contacts: [] };
      const guide = generateNextStepGuide(service);

      expect(guide.summary.hasOfficialSource).toBe(false);
      expect(guide.summary.hasDocuments).toBe(false);
      expect(guide.summary.hasSteps).toBe(false);
      expect(guide.summary.hasContacts).toBe(false);
      expect(guide.summary.confirmationSteps).toBeGreaterThanOrEqual(4);
    });
  });
});

describe('SOURCE_FIELDS export', () => {
  it('exports all source field constants', () => {
    expect(SOURCE_FIELDS.OFFICIAL_SOURCE).toBe('officialSources');
    expect(SOURCE_FIELDS.DOCUMENTS).toBe('documents');
    expect(SOURCE_FIELDS.CONTACTS).toBe('contacts');
    expect(SOURCE_FIELDS.STEPS).toBe('steps');
    expect(SOURCE_FIELDS.ELIGIBILITY).toBe('eligibility');
    expect(SOURCE_FIELDS.FEES).toBe('fees');
    expect(SOURCE_FIELDS.PROCESSING_TIME).toBe('processingTime');
    expect(SOURCE_FIELDS.WARNINGS).toBe('warnings');
  });
});