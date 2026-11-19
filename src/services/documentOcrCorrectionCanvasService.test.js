import { describe, it, expect, beforeEach } from 'vitest';
import {
  CONFIDENCE_TIER,
  FIELD_EXTRACTION_STATUS,
  SUPPORTED_DOCUMENT_TYPE,
  STATUTORY_OCR_DISCLAIMER,
  classifyConfidenceTier,
  createDocumentOcrSession,
  getDocumentOcrSession,
  correctExtractedField,
  confirmExtractedField,
  removeExtractedField,
  updateCanvasTransform,
  getAccessibleOcrFieldsTable,
  deleteDocumentAndExtractions,
  sanitizeOcrSessionForExport,
  _resetDocumentOcrSessionStore,
} from './documentOcrCorrectionCanvasService.js';

describe('DocumentOcrCorrectionCanvasService', () => {
  beforeEach(() => {
    _resetDocumentOcrSessionStore();
  });

  describe('classifyConfidenceTier', () => {
    it('classifies confidence scores into appropriate tiers', () => {
      expect(classifyConfidenceTier(0.95)).toBe(CONFIDENCE_TIER.HIGH_CONFIDENCE);
      expect(classifyConfidenceTier(0.85)).toBe(CONFIDENCE_TIER.HIGH_CONFIDENCE);
      expect(classifyConfidenceTier(0.75)).toBe(CONFIDENCE_TIER.MEDIUM_REVIEW_RECOMMENDED);
      expect(classifyConfidenceTier(0.60)).toBe(CONFIDENCE_TIER.MEDIUM_REVIEW_RECOMMENDED);
      expect(classifyConfidenceTier(0.45)).toBe(CONFIDENCE_TIER.LOW_CORRECTION_REQUIRED);
      expect(classifyConfidenceTier(0.10)).toBe(CONFIDENCE_TIER.LOW_CORRECTION_REQUIRED);
    });

    it('throws error for invalid or out-of-range confidence scores', () => {
      expect(() => classifyConfidenceTier(1.5)).toThrow('Invalid confidence score');
      expect(() => classifyConfidenceTier(-0.1)).toThrow('Invalid confidence score');
      expect(() => classifyConfidenceTier('invalid')).toThrow('Invalid confidence score');
    });
  });

  describe('createDocumentOcrSession & Consent Gatekeeper', () => {
    const validRawExtractions = [
      {
        fieldKey: 'applicantName',
        label: 'Applicant Full Name',
        extractedValue: 'RAHUL SHARMA',
        confidenceScore: 0.92,
        boundingBox: { x: 50, y: 120, width: 250, height: 35 },
      },
      {
        fieldKey: 'monthlyGrossSalary',
        label: 'Gross Monthly Earnings',
        extractedValue: '4500O', // OCR confusion of '0' with 'O'
        confidenceScore: 0.52,
        boundingBox: { x: 50, y: 180, width: 180, height: 35 },
      },
    ];

    it('requires explicit citizen consent to process document scans', () => {
      expect(() =>
        createDocumentOcrSession({
          ownerId: 'citizen_123',
          documentType: SUPPORTED_DOCUMENT_TYPE.INCOME_SALARY_SLIP,
          explicitConsentGiven: false,
        })
      ).toThrow('Explicit citizen consent is strictly required');
    });

    it('throws error for missing ownerId or unsupported document type', () => {
      expect(() =>
        createDocumentOcrSession({
          explicitConsentGiven: true,
          documentType: SUPPORTED_DOCUMENT_TYPE.INCOME_SALARY_SLIP,
        })
      ).toThrow('Valid ownerId is required');

      expect(() =>
        createDocumentOcrSession({
          ownerId: 'citizen_123',
          explicitConsentGiven: true,
          documentType: 'UNSUPPORTED_TYPE',
        })
      ).toThrow('Unsupported documentType');
    });

    it('creates session with bounding boxes, confidence tiers, and advisory disclaimer', () => {
      const session = createDocumentOcrSession({
        ownerId: 'citizen_123',
        documentType: SUPPORTED_DOCUMENT_TYPE.INCOME_SALARY_SLIP,
        documentFileName: 'salary_slip_oct2026.pdf',
        pageCount: 2,
        explicitConsentGiven: true,
        rawExtractions: validRawExtractions,
      });

      expect(session.documentId).toBeDefined();
      expect(session.fields).toHaveLength(2);
      expect(session.statutoryDisclaimer).toBe(STATUTORY_OCR_DISCLAIMER);

      const highConf = session.fields[0];
      expect(highConf.confidenceTier).toBe(CONFIDENCE_TIER.HIGH_CONFIDENCE);
      expect(highConf.status).toBe(FIELD_EXTRACTION_STATUS.PROPOSED_BY_OCR);

      const lowConf = session.fields[1];
      expect(lowConf.confidenceTier).toBe(CONFIDENCE_TIER.LOW_CORRECTION_REQUIRED);
    });
  });

  describe('Interactive Canvas Transformations', () => {
    it('manages stepped 90-degree rotations', () => {
      const session = createDocumentOcrSession({
        ownerId: 'citizen_123',
        documentType: SUPPORTED_DOCUMENT_TYPE.PROPERTY_TAX_RECEIPT,
        explicitConsentGiven: true,
      });

      const rotated = updateCanvasTransform(session.documentId, 'citizen_123', { rotationDegrees: 90 });
      expect(rotated.canvasTransform.rotationDegrees).toBe(90);

      expect(() =>
        updateCanvasTransform(session.documentId, 'citizen_123', { rotationDegrees: 45 })
      ).toThrow('Rotation must be a multiple of 90 degrees');
    });

    it('bounds zoom between 0.5x and 3.0x', () => {
      const session = createDocumentOcrSession({
        ownerId: 'citizen_123',
        documentType: SUPPORTED_DOCUMENT_TYPE.PROPERTY_TAX_RECEIPT,
        explicitConsentGiven: true,
      });

      const zoomed = updateCanvasTransform(session.documentId, 'citizen_123', { zoomLevel: 2.0 });
      expect(zoomed.canvasTransform.zoomLevel).toBe(2.0);

      expect(() =>
        updateCanvasTransform(session.documentId, 'citizen_123', { zoomLevel: 5.0 })
      ).toThrow('Zoom level must be between 0.5x and 3.0x');
    });

    it('validates multi-page navigation', () => {
      const session = createDocumentOcrSession({
        ownerId: 'citizen_123',
        documentType: SUPPORTED_DOCUMENT_TYPE.PROPERTY_TAX_RECEIPT,
        pageCount: 3,
        explicitConsentGiven: true,
      });

      const paged = updateCanvasTransform(session.documentId, 'citizen_123', { pageIndex: 2 });
      expect(paged.currentPageIndex).toBe(2);

      expect(() =>
        updateCanvasTransform(session.documentId, 'citizen_123', { pageIndex: 5 })
      ).toThrow('Page index must be between 0 and 2');
    });
  });

  describe('Human Correction & Confirmation Workflow', () => {
    it('updates proposed value with citizen correction', () => {
      const session = createDocumentOcrSession({
        ownerId: 'citizen_123',
        documentType: SUPPORTED_DOCUMENT_TYPE.INCOME_SALARY_SLIP,
        explicitConsentGiven: true,
        rawExtractions: [
          {
            fieldId: 'fld_salary',
            fieldKey: 'monthlySalary',
            extractedValue: '4500O',
            confidenceScore: 0.5,
          },
        ],
      });

      const updated = correctExtractedField(session.documentId, 'citizen_123', 'fld_salary', '45000');
      const field = updated.fields.find((f) => f.fieldId === 'fld_salary');

      expect(field.confirmedValue).toBe('45000');
      expect(field.status).toBe(FIELD_EXTRACTION_STATUS.USER_CORRECTED);
    });

    it('confirms field value without change', () => {
      const session = createDocumentOcrSession({
        ownerId: 'citizen_123',
        documentType: SUPPORTED_DOCUMENT_TYPE.INCOME_SALARY_SLIP,
        explicitConsentGiven: true,
        rawExtractions: [
          {
            fieldId: 'fld_name',
            fieldKey: 'applicantName',
            extractedValue: 'RAHUL SHARMA',
            confidenceScore: 0.95,
          },
        ],
      });

      const confirmed = confirmExtractedField(session.documentId, 'citizen_123', 'fld_name');
      const field = confirmed.fields.find((f) => f.fieldId === 'fld_name');

      expect(field.status).toBe(FIELD_EXTRACTION_STATUS.USER_CONFIRMED);
    });

    it('removes erroneous OCR field detection', () => {
      const session = createDocumentOcrSession({
        ownerId: 'citizen_123',
        documentType: SUPPORTED_DOCUMENT_TYPE.INCOME_SALARY_SLIP,
        explicitConsentGiven: true,
        rawExtractions: [
          {
            fieldId: 'fld_spurious',
            fieldKey: 'watermarkText',
            extractedValue: 'CONFIDENTIAL DRAFT',
            confidenceScore: 0.2,
          },
        ],
      });

      const removed = removeExtractedField(session.documentId, 'citizen_123', 'fld_spurious');
      const field = removed.fields.find((f) => f.fieldId === 'fld_spurious');

      expect(field.status).toBe(FIELD_EXTRACTION_STATUS.USER_REMOVED);
    });
  });

  describe('Accessible Tabular Representation', () => {
    it('produces linearized WCAG compliant table with coordinates and confidence', () => {
      const session = createDocumentOcrSession({
        ownerId: 'citizen_123',
        documentType: SUPPORTED_DOCUMENT_TYPE.INCOME_SALARY_SLIP,
        explicitConsentGiven: true,
        rawExtractions: [
          {
            fieldId: 'fld_1',
            fieldKey: 'name',
            extractedValue: 'RAHUL',
            confidenceScore: 0.92,
            boundingBox: { x: 10, y: 20, width: 100, height: 30 },
          },
          {
            fieldId: 'fld_2',
            fieldKey: 'panNumber',
            extractedValue: 'ABCDE1234F',
            confidenceScore: 0.55,
            boundingBox: { x: 10, y: 60, width: 120, height: 30 },
          },
        ],
      });

      const fullTable = getAccessibleOcrFieldsTable(session);
      expect(fullTable).toHaveLength(2);
      expect(fullTable[0].coordinates).toBe('X:10, Y:20, W:100, H:30');
      expect(fullTable[0].confidencePercentage).toBe('92%');

      // Test low-confidence filter
      const lowConfTable = getAccessibleOcrFieldsTable(session, { lowConfidenceOnly: true });
      expect(lowConfTable).toHaveLength(1);
      expect(lowConfTable[0].fieldId).toBe('fld_2');
    });

    it('throws error on invalid session object', () => {
      expect(() => getAccessibleOcrFieldsTable(null)).toThrow('Valid session with fields array is required');
    });
  });

  describe('Privacy, Session Security & Irrevocable Purge', () => {
    it('enforces privacy boundary against unauthorized citizen access', () => {
      const session = createDocumentOcrSession({
        ownerId: 'citizen_123',
        documentType: SUPPORTED_DOCUMENT_TYPE.INCOME_SALARY_SLIP,
        explicitConsentGiven: true,
      });

      expect(() => getDocumentOcrSession(session.documentId, 'unauthorized_citizen')).toThrow('Access Denied');
    });

    it('irrevocably deletes document and derived extractions upon citizen request', () => {
      const session = createDocumentOcrSession({
        ownerId: 'citizen_123',
        documentType: SUPPORTED_DOCUMENT_TYPE.INCOME_SALARY_SLIP,
        explicitConsentGiven: true,
        rawExtractions: [{ fieldKey: 'income', extractedValue: '50000', confidenceScore: 0.9 }],
      });

      const deleted = deleteDocumentAndExtractions(session.documentId, 'citizen_123');
      expect(deleted).toBe(true);

      const retrieved = getDocumentOcrSession(session.documentId, 'citizen_123');
      expect(retrieved).toBeNull();
    });

    it('sanitizes OCR session for compliance export without revealing private values', () => {
      const session = createDocumentOcrSession({
        ownerId: 'citizen_123',
        documentType: SUPPORTED_DOCUMENT_TYPE.INCOME_SALARY_SLIP,
        explicitConsentGiven: true,
        rawExtractions: [
          {
            fieldId: 'fld_pan',
            fieldKey: 'panNumber',
            extractedValue: 'ABCDE1234F',
            confidenceScore: 0.9,
          },
        ],
      });

      const exported = sanitizeOcrSessionForExport(session);
      expect(exported.documentId).toBe('REDACTED_DOC_ID');
      expect(exported.ownerId).toBe('REDACTED_CITIZEN_ID');
      expect(exported.fields[0].extractedValue).toBe('[REDACTED_CONFIDENTIAL_INPUT]');
    });

    it('returns null when exporting invalid session object', () => {
      expect(sanitizeOcrSessionForExport(null)).toBeNull();
    });
  });
});
