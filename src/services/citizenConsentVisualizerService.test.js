import { describe, it, expect, beforeEach } from 'vitest';
import {
  CONSENT_STATUS,
  CONSENT_PURPOSE_KEY,
  STATUTORY_DPDP_CONSENT_NOTICE,
  REGISTERED_CONSENT_PURPOSES,
  initializeCitizenConsentDossier,
  getCitizenConsentDossier,
  grantPurposeConsent,
  denyPurposeConsent,
  revokePurposeConsent,
  verifyDownstreamProcessingAllowed,
  generateDataFlowGraph,
  getAccessiblePurposeSummary,
  sanitizeConsentExportForAudit,
  getConsentAuditTrail,
  _resetConsentStore,
} from './citizenConsentVisualizerService';

describe('citizenConsentVisualizerService', () => {
  beforeEach(() => {
    _resetConsentStore();
  });

  describe('Dossier Initialization & Owner Authorization', () => {
    it('initializes a citizen consent dossier with all registered purposes', () => {
      const dossier = initializeCitizenConsentDossier('citizen_anita_44');

      expect(dossier.dossierId).toBeDefined();
      expect(dossier.ownerId).toBe('citizen_anita_44');
      expect(dossier.statutoryNotice).toBe(STATUTORY_DPDP_CONSENT_NOTICE);

      const purposeKeys = Object.keys(REGISTERED_CONSENT_PURPOSES);
      expect(Object.keys(dossier.grants).length).toBe(purposeKeys.length);

      // Verify default state is UNSPECIFIED
      const firstGrant = dossier.grants[purposeKeys[0]];
      expect(firstGrant.status).toBe(CONSENT_STATUS.UNSPECIFIED);
      expect(firstGrant.grantedAt).toBeNull();
    });

    it('enforces owner-based authorization and blocks unauthorized access', () => {
      initializeCitizenConsentDossier('legitimate_citizen');

      expect(() => {
        getCitizenConsentDossier('legitimate_citizen', 'unauthorized_snooper');
      }).toThrow('Access Denied');

      const authorized = getCitizenConsentDossier('legitimate_citizen', 'legitimate_citizen');
      expect(authorized).toBeDefined();
      expect(authorized.ownerId).toBe('legitimate_citizen');
    });

    it('throws error when ownerId is missing or invalid', () => {
      expect(() => {
        initializeCitizenConsentDossier('');
      }).toThrow('Valid ownerId is required');
    });
  });

  describe('Grant, Denial & Downstream Gate Enforcement', () => {
    it('blocks downstream processing by default before explicit consent', () => {
      const allowed = verifyDownstreamProcessingAllowed(
        'citizen_ram_10',
        CONSENT_PURPOSE_KEY.SERVICE_ELIGIBILITY_MATCHING
      );
      expect(allowed).toBe(false);
    });

    it('grants explicit consent and unblocks downstream processing', () => {
      grantPurposeConsent('citizen_ram_10', CONSENT_PURPOSE_KEY.SERVICE_ELIGIBILITY_MATCHING);

      const allowed = verifyDownstreamProcessingAllowed(
        'citizen_ram_10',
        CONSENT_PURPOSE_KEY.SERVICE_ELIGIBILITY_MATCHING
      );
      expect(allowed).toBe(true);

      const dossier = initializeCitizenConsentDossier('citizen_ram_10');
      const grant = dossier.grants[CONSENT_PURPOSE_KEY.SERVICE_ELIGIBILITY_MATCHING];
      expect(grant.status).toBe(CONSENT_STATUS.GRANTED);
      expect(grant.grantedAt).toBeDefined();
    });

    it('records explicit citizen denial and keeps downstream processing blocked', () => {
      denyPurposeConsent('citizen_ram_10', CONSENT_PURPOSE_KEY.ANONYMOUS_COMMUNITY_ANALYTICS);

      const allowed = verifyDownstreamProcessingAllowed(
        'citizen_ram_10',
        CONSENT_PURPOSE_KEY.ANONYMOUS_COMMUNITY_ANALYTICS
      );
      expect(allowed).toBe(false);

      const dossier = initializeCitizenConsentDossier('citizen_ram_10');
      const grant = dossier.grants[CONSENT_PURPOSE_KEY.ANONYMOUS_COMMUNITY_ANALYTICS];
      expect(grant.status).toBe(CONSENT_STATUS.DENIED);
      expect(grant.revokedAt).toBeDefined();
    });

    it('throws error when granting or denying an unknown purpose', () => {
      expect(() => {
        grantPurposeConsent('cit_1', 'UNKNOWN_PURPOSE_ID');
      }).toThrow('Unknown consent purpose');

      expect(() => {
        denyPurposeConsent('cit_1', 'UNKNOWN_PURPOSE_ID');
      }).toThrow('Unknown consent purpose');
    });
  });

  describe('Auditable Revocation & Restriction Directives', () => {
    it('revokes consent, blocks downstream use immediately, and emits purge directives', () => {
      grantPurposeConsent('citizen_priya_5', CONSENT_PURPOSE_KEY.OFFICE_VISIT_PREPARATION);
      expect(verifyDownstreamProcessingAllowed('citizen_priya_5', CONSENT_PURPOSE_KEY.OFFICE_VISIT_PREPARATION)).toBe(true);

      const { dossier, restrictionDirectives } = revokePurposeConsent(
        'citizen_priya_5',
        CONSENT_PURPOSE_KEY.OFFICE_VISIT_PREPARATION,
        'Appointment completed at Sub-Registrar office'
      );

      // Verify immediate gate block
      expect(verifyDownstreamProcessingAllowed('citizen_priya_5', CONSENT_PURPOSE_KEY.OFFICE_VISIT_PREPARATION)).toBe(false);

      const grant = dossier.grants[CONSENT_PURPOSE_KEY.OFFICE_VISIT_PREPARATION];
      expect(grant.status).toBe(CONSENT_STATUS.REVOKED);
      expect(grant.revocationJustification).toBe('Appointment completed at Sub-Registrar office');

      // Verify restriction directives
      expect(restrictionDirectives.purposeId).toBe(CONSENT_PURPOSE_KEY.OFFICE_VISIT_PREPARATION);
      expect(restrictionDirectives.status).toBe('DOWNSTREAM_PROCESSING_TERMINATED');
      expect(restrictionDirectives.purgeFieldScopes).toContain('appointmentDateTime');
    });
  });

  describe('Interactive Data-Flow Graph & Accessible Summary', () => {
    it('generates a directed graph linking citizen fields, purposes, processors, and retention', () => {
      grantPurposeConsent('citizen_graph_user', CONSENT_PURPOSE_KEY.DOCUMENT_OCR_PRE_SCRUTINY);

      const graph = generateDataFlowGraph('citizen_graph_user');
      expect(graph.totalNodes).toBeGreaterThan(0);
      expect(graph.totalEdges).toBeGreaterThan(0);

      const purposeNode = graph.nodes.find(
        (n) => n.id === `purpose_${CONSENT_PURPOSE_KEY.DOCUMENT_OCR_PRE_SCRUTINY}`
      );
      expect(purposeNode).toBeDefined();
      expect(purposeNode.isActive).toBe(true);

      const ungrantedPurposeNode = graph.nodes.find(
        (n) => n.id === `purpose_${CONSENT_PURPOSE_KEY.STATUTORY_NOTICES_SMS_ALERTS}`
      );
      expect(ungrantedPurposeNode.isActive).toBe(false);

      // Verifies field edge
      const fieldEdge = graph.edges.find((e) => e.target === purposeNode.id);
      expect(fieldEdge).toBeDefined();
      expect(fieldEdge.active).toBe(true);
    });

    it('generates an accessible tabular summary for assistive technologies', () => {
      grantPurposeConsent('citizen_screen_reader', CONSENT_PURPOSE_KEY.STATUTORY_NOTICES_SMS_ALERTS);

      const rows = getAccessiblePurposeSummary('citizen_screen_reader');
      expect(rows.length).toBe(Object.keys(REGISTERED_CONSENT_PURPOSES).length);

      const smsRow = rows.find((r) => r.purposeId === CONSENT_PURPOSE_KEY.STATUTORY_NOTICES_SMS_ALERTS);
      expect(smsRow.status).toBe(CONSENT_STATUS.GRANTED);
      expect(smsRow.canRevoke).toBe(true);
      expect(smsRow.fieldsList).toContain('contactPhoneNumber');

      const ocrRow = rows.find((r) => r.purposeId === CONSENT_PURPOSE_KEY.DOCUMENT_OCR_PRE_SCRUTINY);
      expect(ocrRow.status).toBe(CONSENT_STATUS.UNSPECIFIED);
      expect(ocrRow.canRevoke).toBe(false);
    });
  });

  describe('Audit Trail & Privacy Export Sanitization', () => {
    it('records an append-only audit trail for all consent lifecycle actions', () => {
      grantPurposeConsent('cit_audit_1', CONSENT_PURPOSE_KEY.SERVICE_ELIGIBILITY_MATCHING);
      revokePurposeConsent('cit_audit_1', CONSENT_PURPOSE_KEY.SERVICE_ELIGIBILITY_MATCHING, 'Citizen request');

      const auditLog = getConsentAuditTrail();
      expect(auditLog.length).toBe(2);
      expect(auditLog[0].action).toBe('CONSENT_GRANTED');
      expect(auditLog[1].action).toBe('CONSENT_REVOKED');
      expect(auditLog[1].justification).toBe('Citizen request');
    });

    it('sanitizes consent dossier for privacy-safe exports', () => {
      const dossier = grantPurposeConsent('confidential_citizen_99', CONSENT_PURPOSE_KEY.OFFICE_VISIT_PREPARATION);
      const sanitized = sanitizeConsentExportForAudit(dossier);

      expect(sanitized.ownerId).toBe('REDACTED_CITIZEN_ID');
      expect(sanitized.dossierId).toBe('CSNT_AUDIT_VERIFIED');
    });
  });
});
