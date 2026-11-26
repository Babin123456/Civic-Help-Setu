import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkEmulatorEnvironment,
  generateSyntheticRulesFixtures,
  evaluateAccessRule,
  EmulatorRulesRunner,
  ACCESS_ROLES,
  EMULATOR_DEFAULTS
} from './firebaseEmulatorHarness.js';

describe('firebaseEmulatorHarness', () => {
  describe('checkEmulatorEnvironment', () => {
    it('detects Node runtime and inspects CI variables', () => {
      const diag = checkEmulatorEnvironment({ CI: 'true', FIREBASE_PROJECT_ID: 'civic-ci-test' });
      expect(diag.hasNode).toBe(true);
      expect(diag.isCI).toBe(true);
      expect(diag.projectId).toBe('civic-ci-test');
      expect(diag.ready).toBe(true);
    });

    it('warns when JAVA_HOME is missing in non-CI environment', () => {
      const diag = checkEmulatorEnvironment({});
      expect(diag.warnings.length).toBeGreaterThan(0);
      expect(diag.warnings[0]).toContain('JAVA_HOME');
    });
  });

  describe('generateSyntheticRulesFixtures', () => {
    it('creates isolated user profiles and test documents bound to runId', () => {
      const fixtures = generateSyntheticRulesFixtures('ci_job_42');
      expect(fixtures.runId).toBe('ci_job_42');
      expect(fixtures.users.length).toBe(3);
      expect(fixtures.documents.length).toBe(2);

      const citizen = fixtures.users.find(u => u.role === ACCESS_ROLES.CITIZEN);
      expect(citizen.uid).toBe('citizen_ci_job_42_001');

      const grievance = fixtures.documents.find(d => d.collection === 'grievances');
      expect(grievance.ownerId).toBe(citizen.uid);
      expect(grievance.confidential).toBe(true);
    });
  });

  describe('evaluateAccessRule', () => {
    const citizen = { uid: 'citizen_1', role: ACCESS_ROLES.CITIZEN, jurisdiction: 'KA' };
    const admin = { uid: 'admin_1', role: ACCESS_ROLES.DISTRICT_ADMIN, jurisdiction: 'ALL' };
    const stranger = { uid: 'citizen_2', role: ACCESS_ROLES.CITIZEN, jurisdiction: 'KA' };
    const confidentialDoc = { id: 'doc_1', ownerId: 'citizen_1', confidential: true };
    const publicDoc = { id: 'doc_2', ownerId: 'officer_1', confidential: false };

    it('allows anyone to read public, non-confidential documents', () => {
      const verdictAnon = evaluateAccessRule(null, publicDoc, 'read');
      expect(verdictAnon.allowed).toBe(true);
    });

    it('denies unauthenticated actors from reading confidential documents', () => {
      const verdict = evaluateAccessRule(null, confidentialDoc, 'read');
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toContain('Unauthenticated');
    });

    it('allows document owner to read and update confidential documents', () => {
      const readVerdict = evaluateAccessRule(citizen, confidentialDoc, 'read');
      const writeVerdict = evaluateAccessRule(citizen, confidentialDoc, 'write');
      expect(readVerdict.allowed).toBe(true);
      expect(writeVerdict.allowed).toBe(true);
    });

    it('denies unrelated citizens from accessing confidential records', () => {
      const verdict = evaluateAccessRule(stranger, confidentialDoc, 'read');
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toContain('Access denied');
    });

    it('permits district administrators full oversight', () => {
      const verdict = evaluateAccessRule(admin, confidentialDoc, 'read');
      expect(verdict.allowed).toBe(true);
    });
  });

  describe('EmulatorRulesRunner', () => {
    it('executes end-to-end synthetic rule assertions with 100% pass rate', () => {
      const runner = new EmulatorRulesRunner({ projectId: 'test-runner-db' });
      const summary = runner.executeRuleAssertions('batch_930');

      expect(summary.total).toBe(5);
      expect(summary.passed).toBe(5);
      expect(summary.failed).toBe(0);
      expect(runner.testResults.every(r => r.passed)).toBe(true);
    });
  });
});
