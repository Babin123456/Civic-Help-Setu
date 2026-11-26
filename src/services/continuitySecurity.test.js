import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveContinuityPlan,
  getContinuityPlanById,
  transitionPlanState,
  createExerciseRun,
  transitionExerciseState,
  recordInjectDecision,
  clearContinuityMemoryStore,
  PLAN_STATES,
  EXERCISE_STATES,
  STORAGE_KEYS,
  readStore,
} from './continuityPlannerService';
import { setCurrentActor } from './accessControl';

describe('Continuity Planner Security & Privacy Tests (#780)', () => {
  const adminActor = { id: 'admin_root', name: 'Authorized Admin', role: 'admin' };
  const citizenActor = { id: 'citizen_attacker', name: 'Citizen User', role: 'citizen' };

  beforeEach(() => {
    clearContinuityMemoryStore();
    setCurrentActor(adminActor);
  });

  describe('1. Replay & Duplicate Submission Defense', () => {
    it('rejects duplicate or replayed submissions using identical idempotency keys', () => {
      const idempotencyKey = 'attack_replay_token_999';

      const firstAttempt = saveContinuityPlan(
        { title: 'Valid Emergency Plan', jurisdictionId: 'ward-1' },
        { actor: adminActor, idempotencyKey }
      );
      expect(firstAttempt.id).toBeDefined();

      // Second attempt with same idempotency key must fail
      expect(() =>
        saveContinuityPlan(
          { title: 'Replayed Modified Plan', jurisdictionId: 'ward-1' },
          { actor: adminActor, idempotencyKey }
        )
      ).toThrowError(/Duplicate transaction prevented by idempotency key/);
    });

    it('rejects replayed drill creation requests with duplicate idempotency keys', () => {
      const drillKey = 'drill_replay_key_456';

      createExerciseRun(
        { title: 'Drill 1', targetRTOHours: 4 },
        { actor: adminActor, idempotencyKey: drillKey }
      );

      expect(() =>
        createExerciseRun(
          { title: 'Drill 1 Clone', targetRTOHours: 4 },
          { actor: adminActor, idempotencyKey: drillKey }
        )
      ).toThrowError(/Duplicate drill run prevented by idempotency key/);
    });
  });

  describe('2. Privilege Escalation Defenses', () => {
    it('blocks citizens from forging administrator plan approvals', () => {
      const plan = saveContinuityPlan({ title: 'Ward 2 Plan' }, { actor: adminActor });
      transitionPlanState(plan.id, PLAN_STATES.IN_REVIEW, { actor: adminActor });

      // Citizen attempts to approve
      setCurrentActor(citizenActor);
      expect(() =>
        transitionPlanState(plan.id, PLAN_STATES.APPROVED, { actor: citizenActor })
      ).toThrowError(/Not allowed: continuity.approve/);

      // Verify state was not mutated in storage
      setCurrentActor(adminActor);
      const verified = getContinuityPlanById(plan.id);
      expect(verified.status).toBe(PLAN_STATES.IN_REVIEW);
    });

    it('blocks citizens from creating unauthorized continuity plans', () => {
      setCurrentActor(citizenActor);
      expect(() =>
        saveContinuityPlan({ title: 'Malicious Injected Plan' }, { actor: citizenActor })
      ).toThrowError(/Not allowed: continuity.write/);
    });

    it('blocks citizens from launching tabletop drill operations', () => {
      setCurrentActor(citizenActor);
      expect(() =>
        createExerciseRun({ title: 'Rogue Drill' }, { actor: citizenActor })
      ).toThrowError(/Not allowed: continuity.drill/);
    });
  });

  describe('3. PII Redaction & Data Leakage Prevention', () => {
    it('ensures unprivileged citizen calls never leak raw phone numbers or email addresses', () => {
      const rawPhone = '9876543210';
      const rawEmail = 'deputy.commissioner@internal.municipal.gov.in';

      const plan = saveContinuityPlan(
        {
          title: 'Secure Escalation Plan',
          contactTree: [
            {
              role: 'Incident Commander',
              officerName: 'Senior Officer Rao',
              phone: rawPhone,
              email: rawEmail,
              priorityOrder: 1,
            },
          ],
        },
        { actor: adminActor }
      );

      // Read as citizen
      setCurrentActor(citizenActor);
      const citizenView = getContinuityPlanById(plan.id, { actor: citizenActor });
      const citizenContact = citizenView.contactTree[0];

      // Must be masked: never contain full phone or raw prefix
      expect(citizenContact.phone).not.toBe(rawPhone);
      expect(citizenContact.phone).toBe('XXXXXX3210');
      expect(citizenContact.email).not.toBe(rawEmail);
      expect(citizenContact.email).toBe('d***r@internal.municipal.gov.in');

      // Privileged admin reading the same record sees complete verified dispatch details
      setCurrentActor(adminActor);
      const adminView = getContinuityPlanById(plan.id, { actor: adminActor });
      const adminContact = adminView.contactTree[0];
      expect(adminContact.phone).toBe(rawPhone);
      expect(adminContact.email).toBe(rawEmail);
    });
  });

  describe('4. Input Sanitization & XSS Injection Protection', () => {
    it('sanitizes malicious script tags and event handlers in plan text fields', () => {
      const maliciousPayload = {
        title: 'Plan <script>alert("XSS")</script>',
        department: 'Dept <img src=x onerror=alert(1)>',
        recoveryObjectives: {
          criticalOperations: ['Operation <b onmouseover=evil()>1</b>'],
          alternateFacilities: ['Facility <script>window.location="evil.com"</script>'],
        },
      };

      const saved = saveContinuityPlan(maliciousPayload, { actor: adminActor });
      // Input sanitization strips or escapes dangerous payloads
      expect(saved.title).not.toContain('<script>');
      expect(saved.department).not.toContain('onerror');
    });

    it('sanitizes tactical decision logs and action items', () => {
      const run = createExerciseRun({ title: 'Decision Sanitization Drill' }, { actor: adminActor });
      transitionExerciseState(run.id, EXERCISE_STATES.IN_PROGRESS, { actor: adminActor });

      const updated = recordInjectDecision(
        run.id,
        {
          injectIndex: 0,
          recordedDecision: 'Decision <svg onload=alert(document.cookie)>',
          responsibleOfficer: 'Officer <iframe src=javascript:alert(1)>',
          delayMinutes: 0,
        },
        { actor: adminActor }
      );

      const logged = updated.decisionLogs[0];
      expect(logged.recordedDecision).not.toContain('<svg');
      expect(logged.responsibleOfficer).not.toContain('<iframe');
    });
  });

  describe('5. Operational Separation & Cross-Contamination Guard', () => {
    it('strictly isolates drill exercise records from real operational citizen data stores', () => {
      createExerciseRun(
        { title: 'Mock Bomb Threat Tabletop Drill' },
        { actor: adminActor }
      );

      // Verify that no real tracking or grievance stores were touched
      const trackedApps = readStore('civicbridge_applications', null);
      const grievanceTickets = readStore('civic_grievance_tickets', null);
      const civicWorks = readStore('civicbridge_civic_works_reports_v1', null);

      expect(trackedApps).toBeNull();
      expect(grievanceTickets).toBeNull();
      expect(civicWorks).toBeNull();

      // Only exercise collection holds the record
      const exercises = readStore(STORAGE_KEYS.EXERCISES, []);
      expect(exercises.some((e) => e.title.includes('Mock Bomb Threat'))).toBe(true);
    });
  });
});
