import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ensurePublicProjectsSeedData,
  resetPublicProjectsData,
  listPublicProjects,
  getPublicProjectDetail,
  createPublicProject,
  updateProjectStatus,
  submitMilestoneProgress,
  recordVerificationReview,
  getProjectAuditTrail,
  calculateProjectProgress,
  isValidMilestoneTransition,
  getPublicProjectsSummaryMetrics,
  PROJECT_STATUSES,
  MILESTONE_STATUSES,
  SUBMISSION_STATUSES,
  REVIEW_DECISIONS,
  PROJECT_CATEGORIES,
  DomainStateError,
} from './publicProjectService';
import { setCurrentActor } from './accessControl';

const createMemoryStorage = () => {
  const map = new Map();
  return {
    getItem: vi.fn((key) => (map.has(key) ? map.get(key) : null)),
    setItem: vi.fn((key, val) => map.set(key, String(val))),
    removeItem: vi.fn((key) => map.delete(key)),
    map,
  };
};

describe('publicProjectService (#752)', () => {
  let storage;

  beforeEach(() => {
    storage = createMemoryStorage();
    setCurrentActor(null);
  });

  afterEach(() => {
    setCurrentActor(null);
  });

  describe('Seed Data & Discovery', () => {
    it('seeds default projects across categories (roads, drains, schools, healthcare)', () => {
      ensurePublicProjectsSeedData(storage);
      const projects = listPublicProjects({}, storage);
      expect(projects.length).toBeGreaterThanOrEqual(4);

      const categories = projects.map((p) => p.category);
      expect(categories).toContain(PROJECT_CATEGORIES.ROADS);
      expect(categories).toContain(PROJECT_CATEGORIES.DRAINS);
      expect(categories).toContain(PROJECT_CATEGORIES.SCHOOLS);
      expect(categories).toContain(PROJECT_CATEGORIES.HEALTHCARE);
    });

    it('filters projects by category and jurisdiction', () => {
      ensurePublicProjectsSeedData(storage);

      const roadProjects = listPublicProjects({ category: PROJECT_CATEGORIES.ROADS }, storage);
      expect(roadProjects.length).toBeGreaterThanOrEqual(1);
      expect(roadProjects.every((p) => p.category === PROJECT_CATEGORIES.ROADS)).toBe(true);

      const ward18Projects = listPublicProjects({ jurisdiction: 'Ward 18' }, storage);
      expect(ward18Projects.length).toBeGreaterThanOrEqual(1);
      expect(ward18Projects[0].jurisdiction.wardNumber).toBe('Ward 18');
    });

    it('searches projects by keyword', () => {
      ensurePublicProjectsSeedData(storage);
      const results = listPublicProjects({ search: 'Bellary' }, storage);
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].title).toContain('Bellary');
    });

    it('generates summary metrics accurately', () => {
      ensurePublicProjectsSeedData(storage);
      const metrics = getPublicProjectsSummaryMetrics(storage);
      expect(metrics.totalProjects).toBeGreaterThanOrEqual(4);
      expect(metrics.completedProjects).toBeGreaterThanOrEqual(1);
      expect(metrics.totalSanctionedBudgetInr).toBeGreaterThan(0);
      expect(metrics.completionRatePercent).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Public Projection & Data Minimization', () => {
    it('redacts sensitive contractor bank/tax IDs and private URLs in public mode', () => {
      ensurePublicProjectsSeedData(storage);
      const publicView = getPublicProjectDetail('proj-road-101', storage, false);

      expect(publicView).not.toBeNull();
      expect(publicView.milestones.length).toBe(4);

      // Verify assets have private storage URLs stripped
      const asset = publicView.evidenceAssets[0];
      if (asset) {
        expect(asset.storageUrl).toBeUndefined();
        expect(asset.publicPreviewUrl).toBeDefined();
        expect(asset.redactionStatus).toBe('REDACTED');
      }

      // Budget view reveals sanctioned amount but hides internal private tender order notes
      expect(publicView.budgetReference.sanctionedAmountInr).toBe(45000000);
      expect(publicView.budgetReference.sanctionOrderNo).toBeUndefined();
    });

    it('exposes full records when isPrivileged is true', () => {
      ensurePublicProjectsSeedData(storage);
      const privilegedView = getPublicProjectDetail('proj-road-101', storage, true);

      expect(privilegedView.budgetReference.sanctionOrderNo).toBe('BBMP/EE/RRD/WO/2026/044');
      const asset = privilegedView.evidenceAssets[0];
      if (asset) {
        expect(asset.storageUrl).toBeDefined();
      }
    });
  });

  describe('Milestone Progression & State Transition Invariants', () => {
    it('validates allowed milestone transitions', () => {
      expect(isValidMilestoneTransition(MILESTONE_STATUSES.PENDING, MILESTONE_STATUSES.IN_PROGRESS)).toBe(true);
      expect(isValidMilestoneTransition(MILESTONE_STATUSES.IN_PROGRESS, MILESTONE_STATUSES.SUBMITTED)).toBe(true);
      expect(isValidMilestoneTransition(MILESTONE_STATUSES.SUBMITTED, MILESTONE_STATUSES.VERIFIED)).toBe(true);
      expect(isValidMilestoneTransition(MILESTONE_STATUSES.SUBMITTED, MILESTONE_STATUSES.REJECTED)).toBe(true);
      expect(isValidMilestoneTransition(MILESTONE_STATUSES.REJECTED, MILESTONE_STATUSES.IN_PROGRESS)).toBe(true);

      // Disallowed transitions
      expect(isValidMilestoneTransition(MILESTONE_STATUSES.PENDING, MILESTONE_STATUSES.VERIFIED)).toBe(false);
      expect(isValidMilestoneTransition(MILESTONE_STATUSES.VERIFIED, MILESTONE_STATUSES.PENDING)).toBe(false);
    });

    it('computes weighted progress accurately', () => {
      const milestones = [
        { weightPercentage: 30, status: MILESTONE_STATUSES.VERIFIED },
        { weightPercentage: 40, status: MILESTONE_STATUSES.VERIFIED },
        { weightPercentage: 30, status: MILESTONE_STATUSES.IN_PROGRESS },
      ];
      expect(calculateProjectProgress(milestones)).toBe(70);
    });

    it('returns 100 when all milestones are verified', () => {
      const milestones = [
        { weightPercentage: 50, status: MILESTONE_STATUSES.VERIFIED },
        { weightPercentage: 50, status: MILESTONE_STATUSES.VERIFIED },
      ];
      expect(calculateProjectProgress(milestones)).toBe(100);
    });
  });

  describe('Progress Submission Intake', () => {
    it('submits progress report, stores evidence with hashes, and transitions milestone to SUBMITTED', () => {
      ensurePublicProjectsSeedData(storage);
      setCurrentActor({ id: 'citizen-user-1', role: 'citizen', username: 'Ramesh' });

      const submission = submitMilestoneProgress(
        {
          projectId: 'proj-drain-202',
          milestoneId: 'ms-drain-202-2',
          narrative: 'Completed RCC raft footing rebar tie-up and poured base concrete with cubical strength testing in progress.',
          reportedPercent: 60,
          evidenceAssets: [
            {
              id: 'asset-custom-1',
              storageUrl: 'https://storage.civicbridge.internal/drains/raft_photo1.jpg',
              caption: 'RCC Raft footing inspection photo',
            },
          ],
          idempotencyKey: 'idemp-custom-1',
        },
        storage
      );

      expect(submission.id).toBeDefined();
      expect(submission.status).toBe(SUBMISSION_STATUSES.PENDING_REVIEW);
      expect(submission.seal).toMatch(/^SEAL-PPP-[0-9A-Z]{4}-[0-9A-Z]{4}$/);

      // Verify milestone transitioned to SUBMITTED
      const detail = getPublicProjectDetail('proj-drain-202', storage, true);
      const ms = detail.milestones.find((m) => m.id === 'ms-drain-202-2');
      expect(ms.status).toBe(MILESTONE_STATUSES.SUBMITTED);
    });

    it('deduplicates identical submission with same idempotencyKey', () => {
      ensurePublicProjectsSeedData(storage);
      const payload = {
        projectId: 'proj-drain-202',
        milestoneId: 'ms-drain-202-2',
        narrative: 'Checking duplicate submission handling with exact idempotency key.',
        evidenceAssets: [{ id: 'a1', storageUrl: 'https://test.jpg' }],
        idempotencyKey: 'same-key-99',
      };

      const s1 = submitMilestoneProgress(payload, storage);
      const s2 = submitMilestoneProgress(payload, storage);
      expect(s1.id).toBe(s2.id);
    });

    it('rejects submissions with missing evidence or short narrative', () => {
      ensurePublicProjectsSeedData(storage);
      expect(() =>
        submitMilestoneProgress(
          {
            projectId: 'proj-drain-202',
            milestoneId: 'ms-drain-202-2',
            narrative: 'Too short',
            evidenceAssets: [],
          },
          storage
        )
      ).toThrow(DomainStateError);
    });
  });

  describe('Privileged Operations: Verification Reviews & Project Creation', () => {
    it('refuses unauthenticated or citizen actors from creating projects', () => {
      ensurePublicProjectsSeedData(storage);
      setCurrentActor({ id: 'u1', role: 'citizen' });

      expect(() =>
        createPublicProject(
          {
            title: 'New Stormwater Drain Corridor Construction',
            description: 'Construction of stormwater canal to prevent monsoon overflow in Low Area.',
            category: 'drains',
            jurisdiction: { wardNumber: 'Ward 25' },
          },
          storage
        )
      ).toThrow(/Not allowed/);
    });

    it('allows admins to create a project and logs audit event', () => {
      ensurePublicProjectsSeedData(storage);
      setCurrentActor({ id: 'admin-1', role: 'admin', username: 'Superintendent Engineer' });

      const newProj = createPublicProject(
        {
          title: 'Whitefield Main Road Pavement & Pedestrian Corridor',
          description: 'Reconstruction of 3.2km road corridor including utility ducts and rain-gardens.',
          category: PROJECT_CATEGORIES.ROADS,
          jurisdiction: { wardNumber: 'Ward 84', wardName: 'Hagadur', zone: 'Mahadevapura' },
        },
        storage
      );

      expect(newProj.id).toBeDefined();
      expect(newProj.status).toBe(PROJECT_STATUSES.PLANNED);

      const auditTrail = getProjectAuditTrail(newProj.id, storage);
      expect(auditTrail.length).toBe(1);
      expect(auditTrail[0].action).toBe('PROJECT_CREATED');
    });

    it('allows an authorized reviewer to record an APPROVE decision, updating milestone and project progress', () => {
      ensurePublicProjectsSeedData(storage);
      setCurrentActor({ id: 'admin-reviewer', role: 'admin', username: 'Executive Engineer Vigilance' });

      const review = recordVerificationReview(
        {
          projectId: 'proj-road-101',
          milestoneId: 'ms-road-101-3',
          submissionId: 'sub-road-101-3-01',
          decision: REVIEW_DECISIONS.APPROVE,
          findings: 'Site core cutter test verified 51.2mm thickness. Density and bitumen VG-30 extraction reports satisfy MORTH specifications.',
          automatedHint: { rulesetVersion: 'cv-1.0', discrepancyScore: 0.12 },
        },
        storage
      );

      expect(review.decision).toBe(REVIEW_DECISIONS.APPROVE);

      // Verify milestone is now VERIFIED
      const updated = getPublicProjectDetail('proj-road-101', storage, true);
      const ms = updated.milestones.find((m) => m.id === 'ms-road-101-3');
      expect(ms.status).toBe(MILESTONE_STATUSES.VERIFIED);

      // Progress increased (20 + 30 + 25 = 75%)
      expect(updated.overallProgressPercent).toBe(75);
    });

    it('marks project COMPLETED when final milestone is approved', () => {
      ensurePublicProjectsSeedData(storage);
      setCurrentActor({ id: 'admin-reviewer', role: 'admin' });

      // Approve milestone 3
      recordVerificationReview(
        {
          projectId: 'proj-road-101',
          milestoneId: 'ms-road-101-3',
          submissionId: 'sub-road-101-3-01',
          decision: REVIEW_DECISIONS.APPROVE,
          findings: 'Approved binder layer with valid laboratory test reports.',
        },
        storage
      );

      // Submit milestone 4
      setCurrentActor({ id: 'cont-1', role: 'citizen' });
      const sub4 = submitMilestoneProgress(
        {
          projectId: 'proj-road-101',
          milestoneId: 'ms-road-101-4',
          narrative: 'Completed wearing asphalt course and thermoplastic markings across full corridor.',
          evidenceAssets: [{ id: 'a4', storageUrl: 'https://test4.jpg' }],
        },
        storage
      );

      // Approve milestone 4 as admin
      setCurrentActor({ id: 'admin-reviewer', role: 'admin' });
      recordVerificationReview(
        {
          projectId: 'proj-road-101',
          milestoneId: 'ms-road-101-4',
          submissionId: sub4.id,
          decision: REVIEW_DECISIONS.APPROVE,
          findings: 'Verified final wearing course and pedestrian markings. Project successfully delivered.',
        },
        storage
      );

      const finalProject = getPublicProjectDetail('proj-road-101', storage, true);
      expect(finalProject.overallProgressPercent).toBe(100);
      expect(finalProject.status).toBe(PROJECT_STATUSES.COMPLETED);
    });
  });
});
