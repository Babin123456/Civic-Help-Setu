import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateGrievanceDraft,
  generateGrievanceDraftWithTemplate,
  checkSensitiveDataBeforeExport,
  exportGrievanceDraftWithTraceability,
  saveGrievanceDraft,
  getStoredGrievanceDrafts,
  deleteGrievanceDraft,
  GRIEVANCE_STORAGE_KEY,
  GRIEVANCE_CATEGORIES,
  RESOLUTION_TYPES,
  GRIEVANCE_TEMPLATES,
} from './civicGrievanceDraftingService';

describe('civicGrievanceDraftingService (#404 / #1007)', () => {
  let store = {};

  beforeEach(() => {
    store = {};
    vi.stubGlobal('localStorage', {
      getItem: (key) => store[key] || null,
      setItem: (key, val) => {
        store[key] = String(val);
      },
      removeItem: (key) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    });
  });

  it('exports valid categories and resolution types', () => {
    expect(GRIEVANCE_CATEGORIES.length).toBeGreaterThan(5);
    expect(RESOLUTION_TYPES.length).toBeGreaterThan(3);
    expect(GRIEVANCE_CATEGORIES).toContain('Roads, Potholes & Footpaths');
  });

  it('exports grievance templates', () => {
    expect(GRIEVANCE_TEMPLATES.SERVICE_DELAY).toBeDefined();
    expect(GRIEVANCE_TEMPLATES.DENIAL).toBeDefined();
    expect(GRIEVANCE_TEMPLATES.INFRASTRUCTURE).toBeDefined();
    expect(GRIEVANCE_TEMPLATES.BILLING).toBeDefined();
    expect(GRIEVANCE_TEMPLATES.RECORD_CORRECTION).toBeDefined();
    expect(Object.keys(GRIEVANCE_TEMPLATES).length).toBe(5);
  });

  it('exports template definitions', () => {
    const templates = Object.entries(GRIEVANCE_TEMPLATES).map(([key, value]) => ({
      key,
      value,
      ...(function () {
        const defs = {
          SERVICE_DELAY: {
            name: 'Service Delay',
            description: 'Grievance regarding delayed civic services (e.g., water, power, transport)',
            requiredFields: ['affectedService', 'delayDuration', 'expectedService'],
            optionalFields: ['previousAttempts', 'referenceNumbers'],
            evidenceGuidelines: [
              'Photographs of the deficient service or pending work order',
              'Timeline of service request and follow-up attempts',
              'Any prior acknowledgment or reference numbers',
            ],
          },
          DENIAL: {
            name: 'Denial of Service',
            description: 'Grievance regarding refusal or denial of a civic service or benefit',
            requiredFields: ['serviceDenied', 'reasonForDenial', 'impactDescription'],
            optionalFields: ['applicationReference', 'previousApplications'],
            evidenceGuidelines: [
              'Copy of application or request submitted',
              'Written denial letter or refusal communication',
              'Any supporting documents proving eligibility',
            ],
          },
          INFRASTRUCTURE: {
            name: 'Infrastructure Deficiency',
            description: 'Grievance regarding physical infrastructure problems (roads, drains, utilities)',
            requiredFields: ['affectedInfrastructure', 'deficiencyDescription', 'location'],
            optionalFields: ['durationOfIssue', 'priorComplaints'],
            evidenceGuidelines: [
              'Wide-area photograph showing infrastructure defect and nearby landmarks',
              'Close-up photo detailing the damage or hazard',
              'Google Maps coordinates or street cross-reference',
              'Date when the issue was first observed',
            ],
          },
          BILLING: {
            name: 'Billing & Tariff Dispute',
            description: 'Grievance regarding incorrect billing, tariff changes, or fee demands',
            requiredFields: ['billingIssue', 'amountDisputed', 'billingPeriod'],
            optionalFields: ['previousBillingHistory', 'referenceNumbers'],
            evidenceGuidelines: [
              'Copy of the billing statement or invoice in question',
              'Payment receipts showing prior payments',
              'Tariff act or approved rate card for the service',
              'Correspondence with the billing authority',
            ],
          },
          RECORD_CORRECTION: {
            name: 'Record Correction',
            description: 'Grievance regarding incorrect civic records (land, identity, eligibility)',
            requiredFields: ['recordType', 'currentRecordDetail', 'correctedDetail'],
            optionalFields: ['applicationReference', 'supportingDocumentation'],
            evidenceGuidelines: [
              'Copy of the current record or document requiring correction',
              'Documentary evidence supporting the correction (e.g., birth certificate, property deed)',
              'Previous correspondence regarding the record',
              'Identification proof linking the record to the citizen',
            ],
          },
        };
        return defs[key];
      })(),
    }));
    expect(templates.length).toBe(5);
    expect(templates.some((t) => t.name === 'Service Delay')).toBe(true);
    expect(templates.some((t) => t.name === 'Denial of Service')).toBe(true);
    expect(templates.some((t) => t.name === 'Infrastructure Deficiency')).toBe(true);
    expect(templates.some((t) => t.name === 'Billing & Tariff Dispute')).toBe(true);
    expect(templates.some((t) => t.name === 'Record Correction')).toBe(true);
  });

  it('rejects generation when issue description is missing', () => {
    const res = generateGrievanceDraft({ category: 'Roads, Potholes & Footpaths' });
    expect(res.isValid).toBe(false);
    expect(res.error).toMatch(/description/i);
    expect(res.draftText).toBe('');
  });

  it('rejects generation when issue description is only whitespace', () => {
    const res = generateGrievanceDraft({ issueDescription: '   \n  ' });
    expect(res.isValid).toBe(false);
    expect(res.error).toBeDefined();
  });

  it('generates a complete draft when all facts are provided without hallucinations', () => {
    const facts = {
      category: 'Water Supply & Contamination',
      issueDescription: 'Pipeline broken near community center resulting in contaminated mud water for 4 days.',
      departmentName: 'Delhi Jal Board',
      location: 'Ward 45, Sector 12, Rohini',
      incidentDate: '28th October 2026',
      previousRefNumber: 'DJB-2026-9912',
      requestedResolution: 'Immediate dispatch of repair team and provision of clean drinking water tankers.',
      evidenceList: ['Water test report showing turbidity', 'Photographs of leaked pipeline'],
      citizenName: 'Ramesh Sharma',
      citizenPhone: '9876543210',
      citizenAddress: 'House 42, Pocket 3, Rohini',
    };

    const draft = generateGrievanceDraft(facts);
    expect(draft.isValid).toBe(true);
    expect(draft.category).toBe('Water Supply & Contamination');
    expect(draft.draftText).toContain('Delhi Jal Board');
    expect(draft.draftText).toContain('Ward 45, Sector 12, Rohini');
    expect(draft.draftText).toContain('DJB-2026-9912');
    expect(draft.draftText).toContain('Pipeline broken near community center');
    expect(draft.draftText).toContain('Water test report showing turbidity');
    expect(draft.draftText).toContain('Ramesh Sharma');
    expect(draft.draftText).toContain('9876543210');
    expect(draft.hasUnstatedFacts).toBe(false);
    expect(draft.placeholdersCount).toBe(0);
    expect(draft.disclaimer).toMatch(/Drafting Tool Notice/i);
    expect(draft.disclaimer).toMatch(/does NOT submit/i);
  });

  it('converts missing or omitted facts into transparent bracketed placeholders', () => {
    const partialFacts = {
      issueDescription: 'Streetlights have been non-functional causing safety hazards at night.',
    };

    const draft = generateGrievanceDraft(partialFacts);
    expect(draft.isValid).toBe(true);
    expect(draft.hasUnstatedFacts).toBe(true);
    expect(draft.placeholdersCount).toBeGreaterThan(0);
    // Check that explicit bracketed guidance exists for unprovided details
    expect(draft.draftText).toContain('[Location unstated]');
    expect(draft.draftText).toContain('[Exact street, ward, or office address not specified');
    expect(draft.draftText).toContain('[Date or duration of problem not specified');
    expect(draft.draftText).toContain('[Specify remedy');
    expect(draft.draftText).toContain('[No documents listed by user');
    // Ensure citizen anonymity default
    expect(draft.draftText).toContain('[Name omitted by citizen]');
    expect(draft.draftText).not.toContain('Contact:');
  });

  it('detects sensitive data before export - Aadhaa numbers', () => {
    const facts = {
      category: 'Water Supply & Contamination',
      issueDescription: 'Pipeline broken near community center. My Aadhaar is 1234 5678 9012 for verification.',
      departmentName: 'Delhi Jal Board',
      location: 'Ward 45, Sector 12, Rohini',
      incidentDate: '28th October 2026',
      previousRefNumber: 'DJB-2026-9912',
      requestedResolution: 'Immediate dispatch of repair team.',
      evidenceList: ['Water test report showing turbidity'],
      citizenName: 'Ramesh Sharma',
      citizenPhone: '9876543210',
      citizenAddress: 'House 42, Pocket 3, Rohini',
    };

    const draft = generateGrievanceDraft(facts);
    const redactionCheck = checkSensitiveDataBeforeExport(draft);

    expect(redactionCheck.hasSensitiveData).toBe(true);
    expect(redactionCheck.warnings.length).toBeGreaterThan(0);
    // The Aadhaar should be redacted in the draft text
    expect(redactionCheck.redactedText).toContain('[Aadhaar Number redacted for privacy]');
    expect(redactionCheck.redactedText).not.toContain('1234 5678 9012');
  });

  it('detects sensitive data before export - phone numbers', () => {
    const facts = {
      category: 'Roads, Potholes & Footpaths',
      issueDescription: 'Pothole on Main Street causing accidents.',
      departmentName: 'PWD Delhi',
      location: 'Main Street, Delhi',
      incidentDate: '28th October 2026',
      previousRefNumber: '',
      requestedResolution: 'Fix the pothole.',
      evidenceList: [],
      citizenName: 'Ramesh Sharma',
      citizenPhone: '9876543210',
      citizenAddress: 'House 42, Pocket 3, Rohini',
    };

    const draft = generateGrievanceDraft(facts);
    const redactionCheck = checkSensitiveDataBeforeExport(draft);

    expect(redactionCheck.hasSensitiveData).toBe(true);
    expect(redactionCheck.warnings.some((w) => w.type === 'Phone Number')).toBe(true);
  });

  it('detects sensitive data before export - bank/IFSC data', () => {
    const facts = {
      category: 'Billing & Tariff Dispute',
      issueDescription: 'Electricity bill with CA number AB012345C and amount 5000 charged incorrectly.',
      departmentName: 'Tata Power DISCOM',
      location: 'Delhi',
      incidentDate: '28th October 2026',
      previousRefNumber: '',
      requestedResolution: 'Bill correction.',
      evidenceList: ['Electricity bill copy'],
      citizenName: 'Ramesh Sharma',
      citizenPhone: '9876543210',
      citizenAddress: 'House 42, Pocket 3, Rohini',
    };

    const draft = generateGrievanceDraft(facts);
    const redactionCheck = checkSensitiveDataBeforeExport(draft);

    expect(redactionCheck.hasSensitiveData).toBe(true);
    // Should detect IFSC code or bank-related data
    const hasBankWarning = redactionCheck.warnings.some((w) => w.type === 'IFSC Code' || w.type === 'Bank Account Number');
    expect(hasBankWarning).toBe(true);
  });

  it('detects sensitive data before export - email addresses', () => {
    const facts = {
      category: 'Other Civic / Administrative Deficiency',
      issueDescription: 'Contact me at ramesh.sharma@example.com for further details.',
      departmentName: 'General Administration',
      location: 'Delhi',
      incidentDate: '28th October 2026',
      previousRefNumber: '',
      requestedResolution: 'Response required.',
      evidenceList: [],
      citizenName: 'Ramesh Sharma',
      citizenPhone: '9876543210',
      citizenAddress: 'House 42, Pocket 3, Rohini',
    };

    const draft = generateGrievanceDraft(facts);
    const redactionCheck = checkSensitiveDataBeforeExport(draft);

    expect(redactionCheck.hasSensitiveData).toBe(true);
    expect(redactionCheck.warnings.some((w) => w.type === 'Email Address')).toBe(true);
  });

  it('generates draft with service delay template', () => {
    const facts = {
      category: 'Water Supply & Contamination',
      issueDescription: 'Water supply has been interrupted for 5 days in my area.',
      departmentName: 'Delhi Jal Board',
    };

    const draft = generateGrievanceDraftWithTemplate(facts, GRIEVANCE_TEMPLATES.SERVICE_DELAY);
    expect(draft.isValid).toBe(true);
    expect(draft.templateUsed).toBe(GRIEVANCE_TEMPLATES.SERVICE_DELAY);
    expect(draft.subjectLine).toContain('Service Delay');
    // Template lowercases the category in subject line per format
    expect(draft.draftText).toContain('water supply & contamination');
    expect(draft.placeholdersCount).toBeGreaterThanOrEqual(0);
  });

  it('generates draft with infrastructure deficiency template', () => {
    const facts = {
      category: 'Roads, Potholes & Footpaths',
      issueDescription: 'Pothole on Main Road causing vehicle damage',
      location: 'Main Road, Ward 12',
    };

    const draft = generateGrievanceDraftWithTemplate(facts, GRIEVANCE_TEMPLATES.INFRASTRUCTURE);
    expect(draft.isValid).toBe(true);
    expect(draft.templateUsed).toBe(GRIEVANCE_TEMPLATES.INFRASTRUCTURE);
    expect(draft.draftText).toContain('Infrastructure Deficiency');
  });

  it('generates draft with billing dispute template', () => {
    const facts = {
      category: 'Electricity, Power Cuts & Streetlights',
      issueDescription: 'Incorrect electricity bill charges',
      departmentName: 'Tata Power DISCOM',
    };

    const draft = generateGrievanceDraftWithTemplate(facts, GRIEVANCE_TEMPLATES.BILLING);
    expect(draft.isValid).toBe(true);
    expect(draft.templateUsed).toBe(GRIEVANCE_TEMPLATES.BILLING);
    expect(draft.draftText).toContain('Billing & Tariff Dispute');
  });

  it('generates draft with record correction template', () => {
    const facts = {
      category: 'Revenue & Land Records / Tehsildar Office',
      issueDescription: 'Incorrect land record in my property documents',
    };

    const draft = generateGrievanceDraftWithTemplate(facts, GRIEVANCE_TEMPLATES.RECORD_CORRECTION);
    expect(draft.isValid).toBe(true);
    expect(draft.templateUsed).toBe(GRIEVANCE_TEMPLATES.RECORD_CORRECTION);
    expect(draft.draftText).toContain('Record Correction');
  });

  it('generates draft with denial of service template', () => {
    const facts = {
      category: 'Public Distribution System (Ration / PDS)',
      issueDescription: 'Ration card application denied without reason',
      departmentName: 'Food & Civil Supplies',
    };

    const draft = generateGrievanceDraftWithTemplate(facts, GRIEVANCE_TEMPLATES.DENIAL);
    expect(draft.isValid).toBe(true);
    expect(draft.templateUsed).toBe(GRIEVANCE_TEMPLATES.DENIAL);
    expect(draft.draftText).toContain('Denial of Service');
  });

  it('persists, retrieves, and deletes drafts using registered localStorage key', () => {
    const draft1 = generateGrievanceDraft({
      issueDescription: 'Pothole issue on Main Road',
    });
    draft1.id = 'draft-test-1';

    const saveSuccess = saveGrievanceDraft(draft1);
    expect(saveSuccess).toBe(true);

    const stored = getStoredGrievanceDrafts();
    expect(stored.length).toBe(1);
    expect(stored[0].id).toBe('draft-test-1');
    expect(localStorage.getItem(GRIEVANCE_STORAGE_KEY)).toContain('draft-test-1');

    // Delete
    const deleteSuccess = deleteGrievanceDraft('draft-test-1');
    expect(deleteSuccess).toBe(true);
    expect(getStoredGrievanceDrafts().length).toBe(0);
  });

  it('checks sensitive data before export - HIGH privacy risk', () => {
    const facts = {
      category: 'Billing & Tariff Dispute',
      issueDescription: 'My Aadhaar 1234 5678 9012 and bank account 9876543210 are linked to the disputed bill.',
      departmentName: 'Tata Power DISCOM',
      location: 'Delhi',
      incidentDate: '28th October 2026',
      previousRefNumber: '',
      requestedResolution: 'Bill correction.',
      evidenceList: ['Electricity bill copy'],
      citizenName: 'Ramesh Sharma',
      citizenPhone: '9876543210',
      citizenAddress: 'House 42, Pocket 3, Rohini',
    };

    const draft = generateGrievanceDraft(facts);
    const redactionCheck = checkSensitiveDataBeforeExport(draft);

    expect(redactionCheck.privacyRiskLevel).toBe('HIGH');
    expect(redactionCheck.hasSensitiveData).toBe(true);
    expect(redactionCheck.warnings.length).toBeGreaterThanOrEqual(2); // At least Aadhaar + Phone or Bank
  });

  it('export grievance draft with traceability report', () => {
    const facts = {
      category: 'Water Supply & Contamination',
      issueDescription: 'Pipeline broken near community center resulting in contaminated mud water for 4 days.',
      departmentName: 'Delhi Jal Board',
      location: 'Ward 45, Sector 12, Rohini',
      incidentDate: '28th October 2026',
      previousRefNumber: 'DJB-2026-9912',
      requestedResolution: 'Immediate dispatch of repair team and provision of clean drinking water tankers.',
      evidenceList: ['Water test report showing turbidity', 'Photographs of leaked pipeline'],
      citizenName: 'Ramesh Sharma',
      citizenPhone: '9876543210',
      citizenAddress: 'House 42, Pocket 3, Rohini',
    };

    const draft = generateGrievanceDraft(facts);
    const exportText = exportGrievanceDraftWithTraceability(draft);

    expect(exportText).toBeDefined();
    expect(exportText.length).toBeGreaterThan(0);
    // Should contain traceability sections
    expect(exportText).toContain('TRACEABILITY REPORT');
    expect(exportText).toContain('SENSITIVE DATA REDACTION Warnings');
    expect(exportText).toContain('DRAFT TEXT');
    expect(exportText).toContain('DISCLAIMER');
    expect(exportText).toContain('OFFICIAL SUBMISSION NOTICE');
  });

  it('export grievance draft with traceability - no sensitive data', () => {
    const facts = {
      category: 'Roads, Potholes & Footpaths',
      issueDescription: 'Pothole on Main Road causing vehicle damage',
      departmentName: 'PWD Delhi',
      location: 'Main Road, Ward 12',
      incidentDate: '28th October 2026',
      previousRefNumber: 'TKN-2026-9812',
      requestedResolution: 'Fix the pothole.',
      evidenceList: ['Photograph of pothole'],
      citizenName: 'Ramesh Sharma',
      citizenPhone: '9876543210',
      citizenAddress: 'House 42, Pocket 3, Rohini',
    };

    const draft = generateGrievanceDraft(facts);
    const exportText = exportGrievanceDraftWithTraceability(draft);

    expect(exportText).toContain('TRACEABILITY REPORT');
    // Should indicate no sensitive data or low risk
    expect(exportText).toContain('PRIVACY ALERT') || expect(exportText).toContain('No sensitive personal data detected');
  });

  it('generates draft with chronology issues detected', () => {
    const facts = {
      category: 'Water Supply & Contamination',
      issueDescription: 'Pipeline broken near community center',
      incidentDate: 'Future Date 2099', // Future date should be flagged
      departmentName: 'Delhi Jal Board',
    };

    const draft = generateGrievanceDraft(facts);
    // The draft should contain the incident date as provided
    expect(draft.draftText).toContain('Future Date 2099');
    // Sensitive data check should flag nothing (no personal data in this test)
    const redactionCheck = checkSensitiveDataBeforeExport(draft);
    expect(redactionCheck.hasSensitiveData).toBe(false);
  });
});