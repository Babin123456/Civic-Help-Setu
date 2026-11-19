import { describe, it, expect, beforeEach } from 'vitest';
import {
  getContinuityPlanById,
  saveContinuityPlan,
  transitionPlanState,
  saveDependency,
  listExerciseRuns,
  createExerciseRun,
  recordInjectDecision,
  transitionExerciseState,
  listActionItems,
  saveActionItem,
  transitionActionItemState,
  getPlanRecommendations,
  recordRecommendationDecision,
  maskPhoneNumber,
  maskEmailAddress,
  clearContinuityMemoryStore,
  createContinuityBackupSnapshot,
  rollbackContinuityStores,
  migrateContinuityStores,
  exportContinuityPlanOfflinePackage,
  writeStore,
  readStore,
  STORAGE_KEYS,
  PLAN_STATES,
  EXERCISE_STATES,
  ACTION_ITEM_STATES,
} from './continuityPlannerService';
import { queryContinuityAuditLogs } from './continuityAuditService';
import { setCurrentActor } from './accessControl';

describe('Continuity Planner Domain Service (#780)', () => {
  const adminActor = { id: 'admin_1', name: 'Commissioner Sharma', role: 'admin' };
  const operatorActor = { id: 'op_1', name: 'Officer Patil', role: 'operator' };
  const citizenActor = { id: 'cit_1', name: 'Citizen Citizen', role: 'citizen' };

  beforeEach(() => {
    clearContinuityMemoryStore();
    setCurrentActor(adminActor);
  });

  describe('Contact Tree Privacy Masking', () => {
    it('masks phone numbers preserving only the last 4 digits', () => {
      expect(maskPhoneNumber('9822012345')).toBe('XXXXXX2345');
      expect(maskPhoneNumber('1234')).toBe('1234');
      expect(maskPhoneNumber('')).toBe('');
    });

    it('masks email addresses preserving the first/last character and domain', () => {
      expect(maskEmailAddress('officer@ward.gov.in')).toBe('o***r@ward.gov.in');
      expect(maskEmailAddress('me@test.com')).toBe('***@test.com');
      expect(maskEmailAddress('')).toBe('');
    });

    it('redacts contact tree phone and email for non-privileged citizen actors', () => {
      const plan = saveContinuityPlan(
        {
          title: 'Zonal Continuity Plan',
          contactTree: [
            { role: 'Incident Commander', officerName: 'Chief Mehta', phone: '9822099999', email: 'mehta@civic.gov.in' },
          ],
        },
        { actor: adminActor }
      );

      const privilegedView = getContinuityPlanById(plan.id, { actor: adminActor });
      expect(privilegedView.contactTree[0].phone).toBe('9822099999');
      expect(privilegedView.contactTree[0].email).toBe('mehta@civic.gov.in');

      const publicView = getContinuityPlanById(plan.id, { actor: citizenActor });
      expect(publicView.contactTree[0].phone).toBe('XXXXXX9999');
      expect(publicView.contactTree[0].email).toBe('m***a@civic.gov.in');
    });
  });

  describe('Continuity Plan Lifecycle & State Transitions', () => {
    it('creates, transitions and archives a plan through valid states', () => {
      const plan = saveContinuityPlan(
        {
          title: 'Ward 14 Flood Contingency Plan',
          jurisdictionId: 'ward-14',
          recoveryObjectives: { rtoHours: 4, rpoHours: 1 },
        },
        { actor: adminActor }
      );

      expect(plan.status).toBe(PLAN_STATES.DRAFT);

      // DRAFT -> IN_REVIEW
      const inReview = transitionPlanState(plan.id, PLAN_STATES.IN_REVIEW, { actor: operatorActor, reason: 'Submitted for review' });
      expect(inReview.status).toBe(PLAN_STATES.IN_REVIEW);

      // IN_REVIEW -> APPROVED (requires admin)
      const approved = transitionPlanState(plan.id, PLAN_STATES.APPROVED, { actor: adminActor, reason: 'Approved by commissioner' });
      expect(approved.status).toBe(PLAN_STATES.APPROVED);

      // APPROVED -> ACTIVE
      const active = transitionPlanState(plan.id, PLAN_STATES.ACTIVE, { actor: adminActor });
      expect(active.status).toBe(PLAN_STATES.ACTIVE);
    });

    it('rejects invalid state transitions with actionable error code', () => {
      const plan = saveContinuityPlan({ title: 'Strict Plan' }, { actor: adminActor });

      // Direct jump DRAFT -> ACTIVE is forbidden
      expect(() =>
        transitionPlanState(plan.id, PLAN_STATES.ACTIVE, { actor: adminActor })
      ).toThrowError(/Cannot transition Continuity Plan from DRAFT to ACTIVE/);
    });

    it('enforces RBAC: non-admin cannot approve continuity plans', () => {
      const plan = saveContinuityPlan({ title: 'Approval Test' }, { actor: adminActor });
      transitionPlanState(plan.id, PLAN_STATES.IN_REVIEW, { actor: adminActor });

      setCurrentActor(citizenActor);
      expect(() =>
        transitionPlanState(plan.id, PLAN_STATES.APPROVED, { actor: citizenActor })
      ).toThrowError(/Not allowed: continuity.approve/);
    });

    it('supersedes previously active plans within the same jurisdiction upon activation', () => {
      const planA = saveContinuityPlan(
        { title: 'Plan A', jurisdictionId: 'ward-10', status: PLAN_STATES.APPROVED },
        { actor: adminActor }
      );
      transitionPlanState(planA.id, PLAN_STATES.ACTIVE, { actor: adminActor });
      expect(getContinuityPlanById(planA.id).status).toBe(PLAN_STATES.ACTIVE);

      const planB = saveContinuityPlan(
        { title: 'Plan B', jurisdictionId: 'ward-10', status: PLAN_STATES.APPROVED },
        { actor: adminActor }
      );
      transitionPlanState(planB.id, PLAN_STATES.ACTIVE, { actor: adminActor });

      expect(getContinuityPlanById(planB.id).status).toBe(PLAN_STATES.ACTIVE);
      expect(getContinuityPlanById(planA.id).status).toBe(PLAN_STATES.SUPERSEDED);
    });

    it('prevents replay/duplicate writes via idempotency keys', () => {
      const key = 'idem_unique_123';
      saveContinuityPlan({ title: 'Idempotent Plan' }, { actor: adminActor, idempotencyKey: key });

      expect(() =>
        saveContinuityPlan({ title: 'Idempotent Plan' }, { actor: adminActor, idempotencyKey: key })
      ).toThrowError(/Duplicate transaction prevented by idempotency key/);
    });
  });

  describe('Service Dependencies & Cycle Validation on Write', () => {
    it('blocks saving dependencies that would introduce a cycle', () => {
      saveDependency(
        { id: 'dep_1', serviceId: 'svc_a', serviceName: 'Service A', upstreamDependencies: ['svc_b'] },
        { actor: adminActor }
      );

      // Attempting to make B depend on A forms cycle A -> B -> A
      expect(() =>
        saveDependency(
          { id: 'dep_2', serviceId: 'svc_b', serviceName: 'Service B', upstreamDependencies: ['svc_a'] },
          { actor: adminActor }
        )
      ).toThrowError(/circular dependency/);
    });
  });

  describe('Tabletop Incident Drill Exercises', () => {
    it('runs an end-to-end drill: schedule, inject decisions, measure gaps, close with AAR', () => {
      const run = createExerciseRun(
        {
          title: 'Ward 12 Cyber Outage Tabletop',
          planId: 'plan_test',
          targetRTOHours: 4,
          drillType: 'TABLETOP',
        },
        { actor: operatorActor }
      );

      expect(run.status).toBe(EXERCISE_STATES.SCHEDULED);

      // Start drill
      const started = transitionExerciseState(run.id, EXERCISE_STATES.IN_PROGRESS, { actor: operatorActor });
      expect(started.status).toBe(EXERCISE_STATES.IN_PROGRESS);

      // Record decisions on injects with delay
      recordInjectDecision(
        run.id,
        {
          injectIndex: 0,
          recordedDecision: 'Isolated substation network and called DR vendor',
          responsibleOfficer: 'Officer Deshmukh',
          delayMinutes: 30,
        },
        { actor: operatorActor }
      );

      recordInjectDecision(
        run.id,
        {
          injectIndex: 1,
          recordedDecision: 'Restored offline paper tokens and deployed manual logs',
          responsibleOfficer: 'Officer Deshmukh',
          delayMinutes: 60,
        },
        { actor: operatorActor }
      );

      const runs = listExerciseRuns();
      const updatedRun = runs.find((r) => r.id === run.id);
      expect(updatedRun.decisionLogs.length).toBe(2);
      expect(updatedRun.recoveryMetrics.actualEstimatedRTOHours).toBe(5.5); // 4 + 1.5h
      expect(updatedRun.recoveryMetrics.gapHours).toBe(1.5);
      expect(updatedRun.recoveryMetrics.serviceResilienceScore).toBeLessThan(100);

      // Transition to AAR review
      transitionExerciseState(run.id, EXERCISE_STATES.AAR_REVIEW, { actor: operatorActor });

      // Close drill with AAR summary
      const closed = transitionExerciseState(run.id, EXERCISE_STATES.CLOSED, {
        actor: adminActor,
        afterActionSummary: {
          strengths: ['Rapid network isolation in under 15 minutes'],
          vulnerabilities: ['Vendor SLA delay added 90 minutes of downtime'],
          recommendations: ['Contract secondary on-call backup team'],
        },
      });

      expect(closed.status).toBe(EXERCISE_STATES.CLOSED);
      expect(closed.afterActionSummary.strengths).toHaveLength(1);
      expect(closed.afterActionSummary.completedAt).toBeDefined();

      // Verify that recommendations automatically generated action items
      const generatedActions = listActionItems({ exerciseRunId: run.id });
      expect(generatedActions.length).toBe(1);
      expect(generatedActions[0].title).toBe('Contract secondary on-call backup team');
      expect(generatedActions[0].status).toBe(ACTION_ITEM_STATES.OPEN);
    });
  });

  describe('Corrective Action Items', () => {
    it('manages corrective action items from open to verified', () => {
      const item = saveActionItem(
        {
          title: 'Upgrade standby diesel generator capacity at Sector 4',
          ownerDepartment: 'Water Works',
          priority: 'URGENT',
        },
        { actor: adminActor }
      );

      expect(item.status).toBe(ACTION_ITEM_STATES.OPEN);

      const inProgress = transitionActionItemState(item.id, ACTION_ITEM_STATES.IN_PROGRESS, { actor: operatorActor });
      expect(inProgress.status).toBe(ACTION_ITEM_STATES.IN_PROGRESS);

      const implemented = transitionActionItemState(item.id, ACTION_ITEM_STATES.IMPLEMENTED, {
        actor: operatorActor,
        closureNotes: '750kVA generator procured and tested',
      });
      expect(implemented.status).toBe(ACTION_ITEM_STATES.IMPLEMENTED);

      const verified = transitionActionItemState(item.id, ACTION_ITEM_STATES.VERIFIED, {
        actor: adminActor,
        closureNotes: 'Site inspection verified by Executive Engineer',
      });
      expect(verified.status).toBe(ACTION_ITEM_STATES.VERIFIED);
      expect(verified.closureNotes).toContain('Site inspection verified');
    });
  });

  describe('Human-in-the-Loop Explainable Recommendations', () => {
    it('records and overrides automated recommendations with officer audit justification', () => {
      const plan = saveContinuityPlan({ title: 'Recommendation Plan' }, { actor: adminActor });
      saveDependency(
        {
          planId: plan.id,
          serviceId: 'svc_crit',
          serviceName: 'Critical Valve',
          criticality: 'TIER_1_CRITICAL',
          estimatedRestorationHours: 10, // > 4h
        },
        { actor: adminActor }
      );

      const recs = getPlanRecommendations(plan.id);
      expect(recs.length).toBeGreaterThan(0);

      const targetRec = recs[0];
      const decision = recordRecommendationDecision(targetRec.id, 'ACCEPTED', {
        actor: adminActor,
        reason: 'Authorized emergency budget for generator',
      });

      expect(decision.status).toBe('ACCEPTED');

      const auditEntries = queryContinuityAuditLogs({ entityType: 'Recommendation' });
      expect(auditEntries.length).toBeGreaterThan(0);
      expect(auditEntries[0].action).toBe('RECOMMENDATION_ACCEPTED');
      expect(auditEntries[0].reason).toContain('Authorized emergency budget');
    });
  });

  describe('Schema Migration & Rollback Strategy', () => {
    it('executes clean migration against an empty database without throwing', () => {
      clearContinuityMemoryStore();
      const report = migrateContinuityStores();
      expect(report.currentVersion).toBe(1);
      expect(report.migratedCount).toBe(0);
      expect(report.totalInspected).toBe(0);
    });

    it('migrates a representative legacy dataset missing schemaVersion to current version', () => {
      clearContinuityMemoryStore();

      // Seed legacy records lacking schemaVersion
      const legacyPlans = [
        { id: 'plan_leg_1', title: 'Legacy Monsoon Plan' },
        { id: 'plan_leg_2', title: 'Legacy Fire Plan', jurisdictionId: 'ward-5' },
      ];
      const legacyDeps = [
        { id: 'dep_leg_1', serviceId: 'svc_1', serviceName: 'Water Pump' },
      ];
      const legacyExercises = [
        { id: 'ex_leg_1', title: 'Old Drill 2024' },
      ];
      const legacyActions = [
        { id: 'act_leg_1', title: 'Fix Backup Line' },
      ];

      writeStore(STORAGE_KEYS.PLANS, legacyPlans);
      writeStore(STORAGE_KEYS.DEPENDENCIES, legacyDeps);
      writeStore(STORAGE_KEYS.EXERCISES, legacyExercises);
      writeStore(STORAGE_KEYS.ACTION_ITEMS, legacyActions);

      // Perform forward migration
      const report = migrateContinuityStores();
      expect(report.currentVersion).toBe(1);
      expect(report.migratedCount).toBe(5); // 2 plans + 1 dep + 1 exercise + 1 action

      // Verify upgraded records have standard schemaVersion and defaults
      const migratedPlans = readStore(STORAGE_KEYS.PLANS, []);
      expect(migratedPlans[0].schemaVersion).toBe(1);
      expect(migratedPlans[0].status).toBe(PLAN_STATES.DRAFT);
      expect(migratedPlans[0].recoveryObjectives).toBeDefined();

      const migratedDeps = readStore(STORAGE_KEYS.DEPENDENCIES, []);
      expect(migratedDeps[0].schemaVersion).toBe(1);
      expect(migratedDeps[0].upstreamDependencies).toEqual([]);

      const migratedEx = readStore(STORAGE_KEYS.EXERCISES, []);
      expect(migratedEx[0].schemaVersion).toBe(1);
      expect(migratedEx[0].decisionLogs).toEqual([]);
      expect(migratedEx[0].recoveryMetrics.serviceResilienceScore).toBe(100);

      const migratedAct = readStore(STORAGE_KEYS.ACTION_ITEMS, []);
      expect(migratedAct[0].schemaVersion).toBe(1);
      expect(migratedAct[0].status).toBe(ACTION_ITEM_STATES.OPEN);

      // Second migration pass is idempotent: skips already migrated records
      const secondPass = migrateContinuityStores();
      expect(secondPass.migratedCount).toBe(0);
      expect(secondPass.skippedCount).toBe(5);
    });

    it('captures backup snapshot and successfully rolls back on demand', () => {
      clearContinuityMemoryStore();
      const initialPlan = saveContinuityPlan({ title: 'Pre-migration baseline' }, { actor: adminActor });
      const snapshot = createContinuityBackupSnapshot();
      const baselineCount = snapshot.stores[STORAGE_KEYS.PLANS].length;
      expect(baselineCount).toBeGreaterThanOrEqual(1);

      // Mutate storage
      saveContinuityPlan({ title: 'Post-migration plan that caused regression' }, { actor: adminActor });
      expect(readStore(STORAGE_KEYS.PLANS, [])).toHaveLength(baselineCount + 1);

      // Execute rollback
      const rollbackResult = rollbackContinuityStores(snapshot);
      expect(rollbackResult.restoredStores).toContain(STORAGE_KEYS.PLANS);

      // Verify baseline was restored
      const restoredPlans = readStore(STORAGE_KEYS.PLANS, []);
      expect(restoredPlans).toHaveLength(baselineCount);
      expect(restoredPlans.some((p) => p.id === initialPlan.id)).toBe(true);
    });
  });

  describe('Offline Disaster Runbook Export', () => {
    it('packages plan, dependencies, and instructions with PII privacy rules enforced', () => {
      clearContinuityMemoryStore();
      const plan = saveContinuityPlan(
        {
          title: 'Offline Grid Outage Runbook',
          jurisdictionId: 'ward-emergency-zone-3',
          contactTree: [
            { role: 'Incident Commander', officerName: 'Chief Patil', phone: '9822088888', email: 'patil@city.gov.in' },
          ],
        },
        { actor: adminActor }
      );

      saveDependency(
        {
          planId: plan.id,
          serviceId: 'svc_generator',
          serviceName: 'Auxiliary Diesel Plant',
          criticality: 'TIER_1_CRITICAL',
        },
        { actor: adminActor }
      );

      // Privileged export (Admin) retains contact info
      const privilegedPkg = exportContinuityPlanOfflinePackage(plan.id, { actor: adminActor });
      expect(privilegedPkg.exportMetadata.packageType).toBe('CIVIC_CONTINUITY_OFFLINE_RUNBOOK');
      expect(privilegedPkg.exportMetadata.isPrivilegedAccess).toBe(true);
      expect(privilegedPkg.plan.contactTree[0].phone).toBe('9822088888');
      expect(privilegedPkg.dependencies.length).toBeGreaterThanOrEqual(1);
      expect(privilegedPkg.offlineExecutionInstructions.length).toBeGreaterThan(0);

      // Unprivileged export (Citizen) masks contact info
      const citizenPkg = exportContinuityPlanOfflinePackage(plan.id, { actor: citizenActor });
      expect(citizenPkg.exportMetadata.isPrivilegedAccess).toBe(false);
      expect(citizenPkg.plan.contactTree[0].phone).toBe('XXXXXX8888');
      expect(citizenPkg.plan.contactTree[0].email).toBe('p***l@city.gov.in');
    });
  });
});
