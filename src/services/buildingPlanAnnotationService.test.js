import { describe, it, expect, beforeEach } from 'vitest';
import {
  ANNOTATION_STATUS,
  CHECKLIST_COMPLIANCE_KEY,
  STATUTORY_ANNOTATION_DISCLAIMER,
  validateNormalizedCoordinates,
  createDrawingSession,
  getDrawingSession,
  addAnnotation,
  generateAiSuggestedAnnotations,
  reviewAiAnnotation,
  undoLastAnnotation,
  deleteAnnotation,
  getAccessibleChecklistSummary,
  exportAnnotationReviewPacket,
  sanitizeAnnotationPacketForExport,
  _resetDrawingSessionStore,
} from './buildingPlanAnnotationService';

describe('buildingPlanAnnotationService', () => {
  beforeEach(() => {
    _resetDrawingSessionStore();
  });

  describe('Coordinate Validation & Session Creation', () => {
    it('validates normalized coordinate boundaries (0-100%)', () => {
      expect(validateNormalizedCoordinates({ x: 10, y: 10, width: 20, height: 30 })).toBe(true);
      expect(validateNormalizedCoordinates({ x: 0, y: 0, width: 100, height: 100 })).toBe(true);

      // Invalid negative
      expect(validateNormalizedCoordinates({ x: -5, y: 10, width: 20, height: 20 })).toBe(false);
      // Invalid overflow
      expect(validateNormalizedCoordinates({ x: 90, y: 10, width: 20, height: 20 })).toBe(false);
      // Invalid zero or negative width
      expect(validateNormalizedCoordinates({ x: 10, y: 10, width: 0, height: 20 })).toBe(false);
      expect(validateNormalizedCoordinates(null)).toBe(false);
    });

    it('creates an initialized drawing review session', () => {
      const session = createDrawingSession({
        ownerId: 'architect_sharma_99',
        drawingTitle: 'Site Layout & Ground Floor Sanction Plan',
        fileType: 'image/svg+xml',
        pageCount: 3,
        jurisdictionKey: 'KARNATAKA_BENGALURU',
      });

      expect(session.sessionId).toBeDefined();
      expect(session.ownerId).toBe('architect_sharma_99');
      expect(session.pageCount).toBe(3);
      expect(session.annotations.length).toBe(0);
      expect(session.statutoryDisclaimer).toBe(STATUTORY_ANNOTATION_DISCLAIMER);
    });

    it('rejects unsupported drawing file types', () => {
      expect(() => {
        createDrawingSession({
          ownerId: 'user_1',
          fileType: 'application/x-executable',
        });
      }).toThrow('Unsupported drawing fileType');
    });

    it('requires valid ownerId', () => {
      expect(() => {
        createDrawingSession({ ownerId: '' });
      }).toThrow('Valid ownerId is required');
    });
  });

  describe('Annotation Creation, Boundaries & Ownership Authorization', () => {
    it('adds valid user annotation mapped to statutory checklist', () => {
      const session = createDrawingSession({
        ownerId: 'owner_cit_45',
        fileType: 'image/png',
      });

      const updated = addAnnotation(session.sessionId, 'owner_cit_45', {
        checklistKey: CHECKLIST_COMPLIANCE_KEY.FRONT_SETBACK,
        coordinates: { x: 5, y: 5, width: 90, height: 10 },
        userNotes: 'Front setback 3.5m shown abutting 12m road',
        page: 1,
      });

      expect(updated.annotations.length).toBe(1);
      const ann = updated.annotations[0];
      expect(ann.checklistKey).toBe(CHECKLIST_COMPLIANCE_KEY.FRONT_SETBACK);
      expect(ann.status).toBe(ANNOTATION_STATUS.USER_MARKED);
      expect(ann.statutoryRule).toContain('NBC 2016');
      expect(ann.confidenceScore).toBe(1.0);
    });

    it('enforces owner-based authorization and blocks unauthorized access', () => {
      const session = createDrawingSession({
        ownerId: 'legitimate_owner',
      });

      expect(() => {
        getDrawingSession(session.sessionId, 'unauthorized_hacker');
      }).toThrow('Access Denied');

      expect(() => {
        addAnnotation(session.sessionId, 'unauthorized_hacker', {
          checklistKey: CHECKLIST_COMPLIANCE_KEY.REAR_SETBACK,
          coordinates: { x: 5, y: 80, width: 90, height: 15 },
        });
      }).toThrow('Access Denied');
    });

    it('rejects invalid checklist keys or malformed coordinates', () => {
      const session = createDrawingSession({ ownerId: 'user_val' });

      expect(() => {
        addAnnotation(session.sessionId, 'user_val', {
          checklistKey: 'INVALID_UNKNOWN_KEY',
          coordinates: { x: 5, y: 5, width: 10, height: 10 },
        });
      }).toThrow('Invalid or unsupported checklistKey');

      expect(() => {
        addAnnotation(session.sessionId, 'user_val', {
          checklistKey: CHECKLIST_COMPLIANCE_KEY.PARKING_AREA,
          coordinates: { x: 95, y: 95, width: 20, height: 20 }, // out of bounds
        });
      }).toThrow('Coordinates must be valid normalized percentages');
    });
  });

  describe('Bounded AI Vision Proposals & Human-in-the-Loop Review', () => {
    it('generates provisional AI proposals with confidence scores and clause citations', () => {
      const session = createDrawingSession({ ownerId: 'draughtsman_1' });

      const proposals = generateAiSuggestedAnnotations(session.sessionId, 'draughtsman_1');
      expect(proposals.length).toBeGreaterThan(0);

      const refreshed = getDrawingSession(session.sessionId, 'draughtsman_1');
      expect(refreshed.annotations.length).toBe(proposals.length);

      const aiAnn = refreshed.annotations.find((a) => a.checklistKey === CHECKLIST_COMPLIANCE_KEY.FRONT_SETBACK);
      expect(aiAnn.status).toBe(ANNOTATION_STATUS.AI_SUGGESTED);
      expect(aiAnn.confidenceScore).toBeGreaterThanOrEqual(0.70);
      expect(aiAnn.aiExplanation).toContain('NBC 2016 front margin criteria');
    });

    it('allows human applicant to confirm AI suggested annotation', () => {
      const session = createDrawingSession({ ownerId: 'architect_ver' });
      generateAiSuggestedAnnotations(session.sessionId, 'architect_ver');

      const target = session.annotations[0];
      const updated = reviewAiAnnotation(
        session.sessionId,
        'architect_ver',
        target.annotationId,
        'CONFIRMED',
        'Verified on CAD drawing by Architect Sharma.'
      );

      const reviewedAnn = updated.annotations.find((a) => a.annotationId === target.annotationId);
      expect(reviewedAnn.status).toBe(ANNOTATION_STATUS.CONFIRMED);
      expect(reviewedAnn.confirmedAt).toBeDefined();
      expect(reviewedAnn.userNotes).toContain('Verified on CAD drawing');
    });

    it('allows human applicant to reject inaccurate AI proposal', () => {
      const session = createDrawingSession({ ownerId: 'user_rej' });
      generateAiSuggestedAnnotations(session.sessionId, 'user_rej');

      const target = session.annotations[0];
      const updated = reviewAiAnnotation(
        session.sessionId,
        'user_rej',
        target.annotationId,
        'REJECTED',
        'Incorrect boundary; this is an internal courtyard.'
      );

      const reviewedAnn = updated.annotations.find((a) => a.annotationId === target.annotationId);
      expect(reviewedAnn.status).toBe(ANNOTATION_STATUS.REJECTED);
    });
  });

  describe('Undo, Delete & Accessible Screen-Reader Summary', () => {
    it('supports undoing the most recent annotation addition', () => {
      const session = createDrawingSession({ ownerId: 'user_undo' });

      addAnnotation(session.sessionId, 'user_undo', {
        checklistKey: CHECKLIST_COMPLIANCE_KEY.SIDE_SETBACKS,
        coordinates: { x: 5, y: 10, width: 10, height: 80 },
      });
      expect(session.annotations.length).toBe(1);

      undoLastAnnotation(session.sessionId, 'user_undo');
      expect(session.annotations.length).toBe(0);
    });

    it('deletes specific annotation by ID', () => {
      const session = createDrawingSession({ ownerId: 'user_del' });

      addAnnotation(session.sessionId, 'user_del', {
        checklistKey: CHECKLIST_COMPLIANCE_KEY.RAINWATER_HARVESTING,
        coordinates: { x: 75, y: 75, width: 15, height: 15 },
      });

      const annId = session.annotations[0].annotationId;
      const success = deleteAnnotation(session.sessionId, 'user_del', annId);
      expect(success).toBe(true);
      expect(session.annotations.length).toBe(0);
    });

    it('provides accessible checklist tabular summary with location descriptions', () => {
      const session = createDrawingSession({ ownerId: 'user_acc' });

      addAnnotation(session.sessionId, 'user_acc', {
        checklistKey: CHECKLIST_COMPLIANCE_KEY.FRONT_SETBACK,
        coordinates: { x: 10, y: 5, width: 80, height: 12 },
        status: ANNOTATION_STATUS.CONFIRMED,
      });

      const summary = getAccessibleChecklistSummary(session.sessionId, 'user_acc');
      expect(summary.length).toBe(8);

      const frontItem = summary.find((i) => i.checklistKey === CHECKLIST_COMPLIANCE_KEY.FRONT_SETBACK);
      expect(frontItem.complianceState).toBe(ANNOTATION_STATUS.CONFIRMED);
      expect(frontItem.locationDescription).toContain('Page 1, X: 10%, Y: 5%');

      const rearItem = summary.find((i) => i.checklistKey === CHECKLIST_COMPLIANCE_KEY.REAR_SETBACK);
      expect(rearItem.complianceState).toBe(ANNOTATION_STATUS.UNRESOLVED);
      expect(rearItem.locationDescription).toBe('Not marked on drawing');
    });
  });

  describe('Pre-Scrutiny Export Packet & Privacy Redaction', () => {
    it('generates structured pre-scrutiny export packet with readiness verdict and legend', () => {
      const session = createDrawingSession({
        ownerId: 'user_packet',
        drawingTitle: 'Residential Villa Sanction G+1',
        jurisdictionKey: 'MAHARASHTRA_MUMBAI',
      });

      addAnnotation(session.sessionId, 'user_packet', {
        checklistKey: CHECKLIST_COMPLIANCE_KEY.FRONT_SETBACK,
        coordinates: { x: 5, y: 5, width: 90, height: 10 },
        status: ANNOTATION_STATUS.CONFIRMED,
      });

      const packet = exportAnnotationReviewPacket(session.sessionId, 'user_packet');
      expect(packet.exportId).toBeDefined();
      expect(packet.metrics.totalAnnotations).toBe(1);
      expect(packet.metrics.confirmedCount).toBe(1);
      expect(packet.legend).toBeDefined();
      expect(packet.statutoryDisclaimer).toBe(STATUTORY_ANNOTATION_DISCLAIMER);
    });

    it('sanitizes export packet removing sensitive identifiers and notes', () => {
      const session = createDrawingSession({
        ownerId: 'confidential_user_id',
        drawingTitle: 'Private High-Security Data Center Plan',
      });

      addAnnotation(session.sessionId, 'confidential_user_id', {
        checklistKey: CHECKLIST_COMPLIANCE_KEY.FIRE_EGRESS_AND_STAIRS,
        coordinates: { x: 60, y: 40, width: 25, height: 30 },
        userNotes: 'Confidential security door passcode 1234',
      });

      const rawPacket = exportAnnotationReviewPacket(session.sessionId, 'confidential_user_id');
      const sanitized = sanitizeAnnotationPacketForExport(rawPacket);

      expect(sanitized.sessionId).toBe('REDACTED_SESSION_ID');
      expect(sanitized.drawingTitle).toBe('CONFIDENTIAL_BUILDING_PLAN');
      expect(sanitized.annotationsList[0].userNotes).toBe('[REDACTED_USER_NOTES]');
    });
  });
});
