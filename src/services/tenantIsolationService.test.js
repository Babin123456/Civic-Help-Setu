/**
 * src/services/tenantIsolationService.test.js
 * Verification suite for Multi-Authority Civic Administration Workspace Isolation (#779).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  initializeTenantStorage,
  assertTenantScope,
  resolveActorMembership,
  listAccessibleTenants,
  getTenantDetails,
  listTenantMembers,
  addTenantMember,
  updateMemberRole,
  revokeTenantMember,
  getTenantSettings,
  updateTenantSettings,
  listTenantDataset,
  getTenantDatasetRecord,
  createTenantDatasetRecord,
  updateTenantDatasetRecord,
  deleteTenantDatasetRecord,
  sanitizePayloadForPublicCatalogue,
  submitRecordForPublication,
  approveRecordPublication,
  retractRecordPublication,
  listSharedPublicCatalogue,
  evaluateTenantRecommendations,
  resolveRecommendation,
  logTenantAuditEvent,
  getTenantAuditTrail,
  verifyAuditChainIntegrity,
  runTenantDataMigration,
  rollbackTenantDataMigration,
  executeTenantTransaction,
  getTenantDatasetIndex,
  getRawStorage,
  setRawStorage,
  TENANT_ERROR_CODES,
  TENANT_ROLES,
  STORAGE_KEYS,
  GENESIS_AUDIT_HASH,
} from './tenantIsolationService';

describe('Tenant Isolation Service (#779)', () => {
  const adminActor = { id: 'default_admin', email: 'admin@bmc.gov.in' };
  const bmcOperatorActor = { id: 'bmc_operator_1', email: 'operator1@bmc.gov.in' };
  const pmcAdminActor = { id: 'pmc_commissioner', email: 'commissioner@punecorporation.org' };
  const unauthorizedActor = { id: 'unauthorized_citizen', email: 'citizen@example.com' };

  beforeEach(() => {
    // Reset test storage to clean seed baseline
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      globalThis.localStorage.clear();
    }
    initializeTenantStorage(true);
  });

  describe('Tenant Scope Assertions & Context Guards', () => {
    it('allows authorized actor to access their assigned authority workspace', () => {
      const { tenant, membership } = assertTenantScope(adminActor, 'tenant-bmc', 'tenant:read');
      expect(tenant.id).toBe('tenant-bmc');
      expect(tenant.name).toContain('Brihanmumbai');
      expect(membership.role).toBe(TENANT_ROLES.ADMIN);
    });

    it('rejects an actor attempting to access an authority workspace where they have no membership', () => {
      expect(() => {
        assertTenantScope(adminActor, 'tenant-pmc', 'tenant:read');
      }).toThrowError();

      try {
        assertTenantScope(adminActor, 'tenant-pmc', 'tenant:read');
      } catch (err) {
        expect(err.code).toBe(TENANT_ERROR_CODES.FORBIDDEN_TENANT_ACCESS);
      }
    });

    it('rejects access to a non-existent authority workspace', () => {
      expect(() => {
        assertTenantScope(adminActor, 'non-existent-authority', 'tenant:read');
      }).toThrowError();

      try {
        assertTenantScope(adminActor, 'non-existent-authority', 'tenant:read');
      } catch (err) {
        expect(err.code).toBe(TENANT_ERROR_CODES.TENANT_NOT_FOUND);
      }
    });

    it('enforces granular permission checks within the tenant boundary', () => {
      // bmc_operator_1 is an OPERATOR in tenant-bmc; they lack 'staff:manage' permission
      expect(() => {
        assertTenantScope(bmcOperatorActor, 'tenant-bmc', 'staff:manage');
      }).toThrowError();

      try {
        assertTenantScope(bmcOperatorActor, 'tenant-bmc', 'staff:manage');
      } catch (err) {
        expect(err.code).toBe(TENANT_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
      }
    });

    it('lists only the authority workspaces accessible to the authenticated actor', () => {
      const adminTenants = listAccessibleTenants(adminActor);
      // adminActor has memberships in BMC and BBMP, but not PMC
      const ids = adminTenants.map((t) => t.id);
      expect(ids).toContain('tenant-bmc');
      expect(ids).toContain('tenant-bbmp');
      expect(ids).not.toContain('tenant-pmc');

      const pmcTenants = listAccessibleTenants(pmcAdminActor);
      expect(pmcTenants.map((t) => t.id)).toEqual(['tenant-pmc']);

      const unauthorizedTenants = listAccessibleTenants(unauthorizedActor);
      expect(unauthorizedTenants).toEqual([]);
    });
  });

  describe('Anti-IDOR Protection & Dataset Isolation', () => {
    it('isolates operational datasets strictly by tenant ID', () => {
      const bmcRecords = listTenantDataset(adminActor, 'tenant-bmc');
      expect(bmcRecords.length).toBeGreaterThan(0);
      bmcRecords.forEach((r) => {
        expect(r.tenantId).toBe('tenant-bmc');
      });

      // adminActor is also operator in BBMP
      const bbmpRecords = listTenantDataset(adminActor, 'tenant-bbmp');
      expect(bbmpRecords.length).toBeGreaterThan(0);
      bbmpRecords.forEach((r) => {
        expect(r.tenantId).toBe('tenant-bbmp');
      });
    });

    it('blocks Insecure Direct Object Reference (IDOR) across tenant boundaries', () => {
      // ds-pmc-01 belongs to PMC
      // Attempting to fetch it through BMC must fail with RECORD_NOT_FOUND
      expect(() => {
        getTenantDatasetRecord(adminActor, 'tenant-bmc', 'ds-pmc-01');
      }).toThrowError();

      try {
        getTenantDatasetRecord(adminActor, 'tenant-bmc', 'ds-pmc-01');
      } catch (err) {
        expect(err.code).toBe(TENANT_ERROR_CODES.RECORD_NOT_FOUND);
      }
    });

    it('blocks updating records belonging to another tenant', () => {
      expect(() => {
        updateTenantDatasetRecord(adminActor, 'tenant-bmc', 'ds-bbmp-01', { title: 'Hacked Title' });
      }).toThrowError();

      try {
        updateTenantDatasetRecord(adminActor, 'tenant-bmc', 'ds-bbmp-01', { title: 'Hacked Title' });
      } catch (err) {
        expect(err.code).toBe(TENANT_ERROR_CODES.RECORD_NOT_FOUND);
      }
    });

    it('allows authorized staff to create, update, and delete operational records in their tenant', () => {
      const newRec = createTenantDatasetRecord(adminActor, 'tenant-bmc', {
        title: 'Colaba Water Tank Valve Replacement',
        category: 'water_services',
        wardCode: 'Ward A',
        priority: 'urgent',
        privateNotes: 'Sensitive engineer direct mobile: 9820011223',
      });

      expect(newRec.id).toBeDefined();
      expect(newRec.tenantId).toBe('tenant-bmc');

      const fetched = getTenantDatasetRecord(adminActor, 'tenant-bmc', newRec.id);
      expect(fetched.title).toBe('Colaba Water Tank Valve Replacement');

      // Update
      const updated = updateTenantDatasetRecord(adminActor, 'tenant-bmc', newRec.id, {
        status: 'in_progress',
      });
      expect(updated.status).toBe('in_progress');

      // Delete (requires dataset:delete permission, granted to tenant_admin)
      const deleted = deleteTenantDatasetRecord(adminActor, 'tenant-bmc', newRec.id, 'Test cleanup');
      expect(deleted).toBe(true);

      // Verify gone
      expect(() => {
        getTenantDatasetRecord(adminActor, 'tenant-bmc', newRec.id);
      }).toThrowError();
    });
  });

  describe('Staff & RBAC Administration', () => {
    it('lists and manages staff members within an authority', () => {
      const members = listTenantMembers(adminActor, 'tenant-bmc');
      expect(members.length).toBeGreaterThan(0);

      const added = addTenantMember(adminActor, 'tenant-bmc', {
        userEmail: 'new_reviewer@bmc.gov.in',
        userName: 'Aarti Patil',
        role: TENANT_ROLES.REVIEWER,
        jurisdictionScope: { wards: ['Ward A'], zones: [] },
      });

      expect(added.role).toBe(TENANT_ROLES.REVIEWER);

      // Change role
      const updated = updateMemberRole(
        adminActor,
        'tenant-bmc',
        added.id,
        TENANT_ROLES.OPERATOR,
        'Reassignment'
      );
      expect(updated.role).toBe(TENANT_ROLES.OPERATOR);

      // Revoke
      const revoked = revokeTenantMember(adminActor, 'tenant-bmc', added.id, 'Project end');
      expect(revoked).toBe(true);
    });

    it('prevents non-admins from adding or modifying staff roles', () => {
      expect(() => {
        addTenantMember(bmcOperatorActor, 'tenant-bmc', {
          userEmail: 'intruder@bmc.gov.in',
          userName: 'Intruder',
          role: TENANT_ROLES.ADMIN,
        });
      }).toThrowError();
    });
  });

  describe('Cross-Tenant Public Catalogue Exchange & PII Sanitization', () => {
    it('redacts private notes and internal officer data upon public catalogue submission', () => {
      const record = getTenantDatasetRecord(adminActor, 'tenant-bmc', 'ds-bmc-02');
      const { publicData, redactedManifest } = sanitizePayloadForPublicCatalogue(record);

      expect(publicData.title).toBe(record.title);
      expect(publicData.privateNotes).toBeUndefined();
      expect(redactedManifest.redactedFields).toContain('privateNotes');
      expect(redactedManifest.redactedFields).toContain('assignedOfficer');
    });

    it('aborts catalogue publication if source record contains unredacted Aadhaar or PAN PII', () => {
      const dirtyRecord = {
        title: 'Grievance submission for 4123 4567 8901 Aadhaar holder',
        category: 'welfare',
        privateNotes: 'Applicant PAN is ABCDE1234F',
      };

      expect(() => {
        sanitizePayloadForPublicCatalogue(dirtyRecord);
      }).toThrowError();

      try {
        sanitizePayloadForPublicCatalogue(dirtyRecord);
      } catch (err) {
        expect(err.code).toBe(TENANT_ERROR_CODES.PII_DETECTED);
      }
    });

    it('completes the full publication workflow: submit -> approve -> public listing -> retract', () => {
      // 1. Submit
      const submission = submitRecordForPublication(adminActor, 'tenant-bmc', 'ds-bmc-01');
      expect(submission.publicationStatus).toBe('pending_approval');
      expect(submission.publicData.title).toContain('Ward G-North Main Conduit Leakage');

      // 2. Unapproved record should NOT appear in public catalogue
      let publicCatalogue = listSharedPublicCatalogue();
      expect(publicCatalogue.some((c) => c.id === submission.id)).toBe(false);

      // 3. Approve
      const approved = approveRecordPublication(adminActor, 'tenant-bmc', submission.id);
      expect(approved.publicationStatus).toBe('published');

      // 4. Approved record appears in public catalogue
      publicCatalogue = listSharedPublicCatalogue();
      expect(publicCatalogue.some((c) => c.id === submission.id)).toBe(true);

      // 5. Retract
      const retracted = retractRecordPublication(
        adminActor,
        'tenant-bmc',
        submission.id,
        'Maintenance completed'
      );
      expect(retracted.publicationStatus).toBe('retracted');

      // 6. Retracted record disappears from public catalogue
      publicCatalogue = listSharedPublicCatalogue();
      expect(publicCatalogue.some((c) => c.id === submission.id)).toBe(false);
    });
  });

  describe('Tamper-Evident SHA-256 Audit Trail', () => {
    it('creates an unbroken, verifiable hash chain for tenant audit events', () => {
      logTenantAuditEvent(adminActor, 'tenant-bmc', {
        action: 'TEST_AUDIT_ACTION_1',
        targetResource: 'dataset',
        targetId: 'ds-test-01',
        details: { step: 1 },
      });

      logTenantAuditEvent(adminActor, 'tenant-bmc', {
        action: 'TEST_AUDIT_ACTION_2',
        targetResource: 'dataset',
        targetId: 'ds-test-02',
        details: { step: 2 },
      });

      const auditTrail = getTenantAuditTrail(adminActor, 'tenant-bmc');
      expect(auditTrail.length).toBeGreaterThanOrEqual(3); // Genesis + 2 events

      const integrity = verifyAuditChainIntegrity('tenant-bmc');
      expect(integrity.valid).toBe(true);
      expect(integrity.tamperedIndex).toBeNull();
    });

    it('detects tampering in audit trail history with exact index pinpointing', () => {
      logTenantAuditEvent(adminActor, 'tenant-bmc', {
        action: 'ACTION_ALPHA',
        targetResource: 'dataset',
        targetId: 'ds-01',
        details: { note: 'Original' },
      });

      logTenantAuditEvent(adminActor, 'tenant-bmc', {
        action: 'ACTION_BETA',
        targetResource: 'dataset',
        targetId: 'ds-02',
        details: { note: 'Second' },
      });

      // Intentionally tamper with the raw storage array
      const rawEvents = getRawStorage(STORAGE_KEYS.AUDIT_EVENTS, []);
      const bmcEvents = rawEvents.filter((e) => e.tenantId === 'tenant-bmc');
      // Tamper with second entry's action
      bmcEvents[1].action = 'MALICIOUS_TAMPERED_ACTION';
      setRawStorage(STORAGE_KEYS.AUDIT_EVENTS, rawEvents);

      const integrity = verifyAuditChainIntegrity('tenant-bmc');
      expect(integrity.valid).toBe(false);
      expect(integrity.tamperedIndex).toBe(1);
    });
  });

  describe('Bounded Explainable AI & Local Heuristics', () => {
    it('evaluates recommendations strictly bounded to the target tenant', () => {
      const recommendations = evaluateTenantRecommendations(adminActor, 'tenant-bmc');
      expect(Array.isArray(recommendations)).toBe(true);

      recommendations.forEach((rec) => {
        expect(rec.tenantId).toBe('tenant-bmc');
        expect(rec.rulesetVersion).toBeDefined();
        expect(rec.reasoning.explanationSummary).toBeDefined();
        expect(Array.isArray(rec.reasoning.influencingFactors)).toBe(true);
        expect(rec.reasoning.influencingFactors.length).toBeGreaterThan(0);
      });
    });

    it('allows an authorized staff member to accept, edit, or reject a recommendation', () => {
      const recommendations = evaluateTenantRecommendations(adminActor, 'tenant-bmc');
      if (recommendations.length > 0) {
        const targetRec = recommendations[0];
        const accepted = resolveRecommendation(
          adminActor,
          'tenant-bmc',
          targetRec.id,
          'accepted',
          null,
          'Concur with SLA breach assessment'
        );
        expect(accepted).toBe(true);

        const audit = getTenantAuditTrail(adminActor, 'tenant-bmc');
        expect(audit[0].action).toBe('RECOMMENDATION_ACCEPTED');
      }
    });
  });

  describe('Schema Evolution & Migration Rollback', () => {
    it('applies schema migration v2 cleanly and supports rollback', () => {
      const migration = runTenantDataMigration(adminActor, 2);
      expect(migration.success).toBe(true);
      expect(migration.targetVersion).toBe(2);

      const datasets = listTenantDataset(adminActor, 'tenant-bmc');
      expect(datasets[0].schemaVersion).toBe(2);

      // Rollback
      const rollback = rollbackTenantDataMigration(adminActor);
      expect(rollback.success).toBe(true);

      const restoredDatasets = listTenantDataset(adminActor, 'tenant-bmc');
      expect(restoredDatasets[0].schemaVersion).toBe(1);
    });

    it('handles schema migration cleanly against an empty database', () => {
      setRawStorage(STORAGE_KEYS.DATASETS, []);
      setRawStorage(STORAGE_KEYS.TENANTS, []);

      const migration = runTenantDataMigration(adminActor, 2);
      expect(migration.success).toBe(true);
      expect(migration.recordsUpgraded).toBe(0);

      const rollback = rollbackTenantDataMigration(adminActor);
      expect(rollback.success).toBe(true);
    });
  });

  describe('Transactions, Idempotency & Bounded Pagination', () => {
    it('enforces idempotency when duplicate creation requests carry the same idempotencyKey', () => {
      const key = 'idem-req-4567';
      const record1 = createTenantDatasetRecord(adminActor, 'tenant-bmc', {
        title: 'Ward G Pothole Emergency Patching',
        category: 'infrastructure',
        wardCode: 'Ward G-North',
        idempotencyKey: key,
      });

      const record2 = createTenantDatasetRecord(adminActor, 'tenant-bmc', {
        title: 'Ward G Pothole Emergency Patching (Retry)',
        category: 'infrastructure',
        wardCode: 'Ward G-North',
        idempotencyKey: key,
      });

      expect(record1.id).toBe(record2.id);
    });

    it('rolls back atomic multi-record mutations when a transaction step fails', () => {
      const beforeCount = listTenantDataset(adminActor, 'tenant-bmc').length;

      expect(() => {
        executeTenantTransaction(adminActor, 'tenant-bmc', () => {
          createTenantDatasetRecord(adminActor, 'tenant-bmc', {
            title: 'Step 1: Successful Record',
            category: 'water_services',
            wardCode: 'Ward A',
          });
          // Step 2 triggers failure
          throw new Error('Simulated mid-transaction failure');
        });
      }).toThrow(/Simulated mid-transaction failure/);

      const afterCount = listTenantDataset(adminActor, 'tenant-bmc').length;
      expect(afterCount).toBe(beforeCount);
    });

    it('supports bounded pagination and category/status/ward indexing', () => {
      const paginated = listTenantDataset(adminActor, 'tenant-bmc', { page: 1, limit: 1 });
      expect(paginated.length).toBe(1);
      expect(paginated.pagination.page).toBe(1);
      expect(paginated.pagination.limit).toBe(1);
      expect(paginated.pagination.totalPages).toBeGreaterThanOrEqual(2);

      const index = getTenantDatasetIndex(adminActor, 'tenant-bmc');
      expect(index.byCategory).toBeDefined();
      expect(index.byStatus).toBeDefined();
      expect(index.byWard).toBeDefined();
      expect(index.total).toBeGreaterThanOrEqual(2);
    });
  });
});
