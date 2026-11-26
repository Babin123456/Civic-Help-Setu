import { describe, it, expect, beforeEach } from 'vitest';
import {
  CLAIM_STATUS,
  COMPLETION_STATUS,
  MICRO_VOLUNTEER_SCHEMA_VERSION,
  MICRO_VOLUNTEER_STORAGE_KEY,
  TASK_STATUS,
} from '../data/microVolunteerContract.js';
import {
  applyMicroVolunteerRetentionPolicy,
  buildMicroVolunteerIndexes,
  createEmptyBoard,
  createMemoryStorage,
  createSeedBoard,
  getMicroVolunteerMigrationMetadata,
  isValidBoardShape,
  loadMicroVolunteerBoard,
  migrateMicroVolunteerData,
  persistMicroVolunteerBoard,
  resetMicroVolunteerStorageToEmpty,
  rollbackMicroVolunteerStorage,
} from './microVolunteerMigrations.js';

const NOW = new Date('2026-11-20T10:00:00.000Z');
const NOW_ISO = NOW.toISOString();

const legacyBundle = () => ({
  schemaVersion: 0,
  micro_tasks: [
    {
      id: 'legacy-task-1',
      title: 'Legacy ward notice task',
      category: 'link_check',
      ward: 'ward-042',
      description: 'Open the public link and record what the page shows.',
      status: 'mystery_status',
      dueDate: '2026-12-01',
      capacity: 2,
    },
  ],
  task_claims: [
    {
      id: 'legacy-claim-1',
      taskId: 'legacy-task-1',
      actorId: 'legacy-citizen',
      status: 'mystery_claim_status',
    },
  ],
  completion_submissions: [
    {
      id: 'legacy-submission-1',
      claimId: 'legacy-claim-1',
      status: 'mystery_completion_status',
      evidenceNote: 'Legacy evidence note.',
    },
  ],
  moderation_events: [
    {
      id: 'legacy-event-1',
      taskId: 'legacy-task-1',
      action: 'legacy_event',
      reason: 'Legacy audit entry.',
    },
  ],
});

describe('microVolunteerMigrations (#759)', () => {
  let storage;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it('creates an empty board and a reviewed seed with every collection present', () => {
    const empty = createEmptyBoard({ now: NOW_ISO });
    expect(empty.schemaVersion).toBe(MICRO_VOLUNTEER_SCHEMA_VERSION);
    expect(empty.tasks).toEqual([]);
    expect(empty.taskCategories.length).toBeGreaterThan(0);
    expect(isValidBoardShape(empty)).toBe(true);

    const seeded = createSeedBoard({ now: NOW_ISO });
    expect(seeded.tasks.length).toBeGreaterThan(0);
    expect(seeded.claims.length).toBeGreaterThan(0);
    expect(seeded.submissions.length).toBeGreaterThan(0);
    expect(seeded.moderationEvents.length).toBeGreaterThan(0);
    expect(isValidBoardShape(seeded)).toBe(true);
  });

  it('migrates the pre-#759 prototype shape without dropping records', () => {
    const result = migrateMicroVolunteerData(legacyBundle(), { now: NOW_ISO });

    expect(result.migrated).toBe(true);
    expect(result.historyEntry).toMatchObject({
      from: 0,
      to: MICRO_VOLUNTEER_SCHEMA_VERSION,
      kind: 'upgrade',
    });
    expect(result.warnings.length).toBeGreaterThanOrEqual(3);

    const [task] = result.data.tasks;
    expect(task.id).toBe('legacy-task-1');
    expect(task.publicRef).toMatch(/^MVT-LEGACY-\d{3}$/);
    expect(task.status).toBe(TASK_STATUS.OPEN);
    expect(task.jurisdictionId).toBe('WARD-042');
    expect(task.capacity).toBe(2);

    const [claim] = result.data.claims;
    expect(claim.publicRef).toMatch(/^MVC-LEGACY-\d{3}$/);
    expect(claim.status).toBe(CLAIM_STATUS.ACTIVE);
    expect(claim.citizenId).toBe('legacy-citizen');

    const [submission] = result.data.submissions;
    expect(submission.publicRef).toMatch(/^MVS-LEGACY-\d{3}$/);
    expect(submission.status).toBe(COMPLETION_STATUS.SUBMITTED);
    expect(submission.note).toBe('Legacy evidence note.');

    expect(result.data.moderationEvents[0].action).toBe('legacy_event');
    expect(result.data.meta.migrationHistory.at(-1).from).toBe(0);
    expect(isValidBoardShape(result.data)).toBe(true);
  });

  it('loads and persists a migrated bundle from storage, then reports its metadata', () => {
    storage.setItem(MICRO_VOLUNTEER_STORAGE_KEY, JSON.stringify(legacyBundle()));

    const board = loadMicroVolunteerBoard({ storage, now: NOW_ISO });
    expect(board.schemaVersion).toBe(MICRO_VOLUNTEER_SCHEMA_VERSION);
    expect(board.tasks).toHaveLength(1);
    expect(board.indexes.tasksById.size).toBe(1);

    const persisted = JSON.parse(storage.getItem(MICRO_VOLUNTEER_STORAGE_KEY));
    expect(persisted.schemaVersion).toBe(MICRO_VOLUNTEER_SCHEMA_VERSION);
    expect(persisted.meta.migrationHistory.length).toBeGreaterThan(0);

    const metadata = getMicroVolunteerMigrationMetadata(persisted);
    expect(metadata.schemaVersion).toBe(MICRO_VOLUNTEER_SCHEMA_VERSION);
    expect(metadata.migrationHistory.length).toBeGreaterThan(0);
    expect(metadata.warnings.length).toBeGreaterThanOrEqual(3);
  });

  it('recovers from corrupt storage by restoring the reviewed seed', () => {
    storage.setItem(MICRO_VOLUNTEER_STORAGE_KEY, '{not-valid-json');
    const board = loadMicroVolunteerBoard({ storage, now: NOW_ISO });
    expect(board.meta.seeded).toBe(true);
    expect(board.tasks.length).toBeGreaterThan(0);
    expect(JSON.parse(storage.getItem(MICRO_VOLUNTEER_STORAGE_KEY)).schemaVersion).toBe(
      MICRO_VOLUNTEER_SCHEMA_VERSION
    );
  });

  it('rolls back to the seed and resets to an empty board atomically', () => {
    const seeded = rollbackMicroVolunteerStorage({ storage, now: NOW_ISO });
    expect(seeded.meta.seeded).toBe(true);
    expect(seeded.tasks.length).toBeGreaterThan(0);

    const empty = resetMicroVolunteerStorageToEmpty({ storage, now: NOW_ISO });
    expect(empty.tasks).toHaveLength(0);
    expect(empty.claims).toHaveLength(0);
    expect(empty.submissions).toHaveLength(0);
    expect(empty.meta.seeded).toBe(false);
  });

  it('rebuilds the jurisdiction, status, category and createdAt indexes', () => {
    const board = createSeedBoard({ now: NOW_ISO });
    const indexes = buildMicroVolunteerIndexes(board);

    expect(indexes.tasksById.size).toBe(board.tasks.length);
    expect(indexes.tasksByPublicRef.get('MVT-2026-001')).toBeTruthy();
    expect(indexes.tasksByStatus.get(TASK_STATUS.OPEN)?.length).toBeGreaterThan(0);
    expect(indexes.tasksByCategory.get('link_check')?.length).toBeGreaterThan(0);
    expect(indexes.tasksByJurisdiction.get('WARD-042')?.length).toBeGreaterThan(0);
    expect(indexes.tasksByJurisdictionStatus.get('WARD-042|open')?.length).toBeGreaterThan(0);
    expect(indexes.tasksSortedByCreatedAt[0].createdAt >= indexes.tasksSortedByCreatedAt.at(-1).createdAt).toBe(
      true
    );
    expect(indexes.claimsByTask.get('mvt_2026_005')).toHaveLength(1);
    expect(indexes.submissionsByClaim.get('mvc_seed_006')).toHaveLength(1);
  });

  it('applies the documented retention policy and records what it changed', () => {
    const old = '2024-01-01T00:00:00.000Z';
    const board = createEmptyBoard({ now: old });
    board.tasks.push(
      {
        id: 'task-completed-old',
        publicRef: 'MVT-2024-001',
        title: 'Old completed task',
        categoryId: 'link_check',
        jurisdictionId: 'WARD-042',
        locality: 'Indiranagar',
        instructions: 'Old task instructions that are long enough to be valid.',
        timeEstimateMinutes: 10,
        dueDate: '2024-02-01',
        capacity: 1,
        status: TASK_STATUS.COMPLETED,
        evidenceRequirements: ['Evidence'],
        safetyNote: 'Safe.',
        source: 'Seed',
        safetyAcknowledgements: {},
        createdBy: 'operator',
        createdAt: old,
        updatedAt: old,
        schemaVersion: MICRO_VOLUNTEER_SCHEMA_VERSION,
      },
      {
        id: 'task-open-old',
        publicRef: 'MVT-2024-002',
        title: 'Old open task',
        categoryId: 'link_check',
        jurisdictionId: 'WARD-042',
        locality: 'Indiranagar',
        instructions: 'Old task instructions that are long enough to be valid.',
        timeEstimateMinutes: 10,
        dueDate: '2024-02-01',
        capacity: 1,
        status: TASK_STATUS.OPEN,
        evidenceRequirements: ['Evidence'],
        safetyNote: 'Safe.',
        source: 'Seed',
        safetyAcknowledgements: {},
        createdBy: 'operator',
        createdAt: old,
        updatedAt: old,
        schemaVersion: MICRO_VOLUNTEER_SCHEMA_VERSION,
      }
    );
    board.claims.push(
      {
        id: 'claim-approved-old',
        publicRef: 'MVC-2024-001',
        taskId: 'task-completed-old',
        taskPublicRef: 'MVT-2024-001',
        citizenId: 'citizen-old',
        jurisdictionId: 'WARD-042',
        status: CLAIM_STATUS.APPROVED,
        idempotencyKey: 'old-claim-1',
        createdAt: old,
        updatedAt: old,
        schemaVersion: MICRO_VOLUNTEER_SCHEMA_VERSION,
      },
      {
        id: 'claim-withdrawn-old',
        publicRef: 'MVC-2024-002',
        taskId: 'task-open-old',
        taskPublicRef: 'MVT-2024-002',
        citizenId: 'citizen-old',
        jurisdictionId: 'WARD-042',
        status: CLAIM_STATUS.WITHDRAWN,
        idempotencyKey: 'old-claim-2',
        createdAt: old,
        updatedAt: old,
        schemaVersion: MICRO_VOLUNTEER_SCHEMA_VERSION,
      }
    );
    board.submissions.push({
      id: 'submission-approved-old',
      publicRef: 'MVS-2024-001',
      taskId: 'task-completed-old',
      taskPublicRef: 'MVT-2024-001',
      claimId: 'claim-approved-old',
      claimPublicRef: 'MVC-2024-001',
      citizenId: 'citizen-old',
      jurisdictionId: 'WARD-042',
      status: COMPLETION_STATUS.APPROVED,
      note: 'Old evidence note with a citizen reference.',
      link: 'https://example.gov.in/old',
      files: [],
      publicOutcomeNote: 'Old approved outcome.',
      moderationReason: 'Old private reason.',
      moderatedByRole: 'reviewer',
      moderatedAt: old,
      idempotencyKey: 'old-submission-1',
      payloadHash: 'old-hash',
      createdAt: old,
      updatedAt: old,
      schemaVersion: MICRO_VOLUNTEER_SCHEMA_VERSION,
    });
    board.moderationEvents.push({
      id: 'old-event',
      taskId: 'task-completed-old',
      taskPublicRef: 'MVT-2024-001',
      claimId: 'claim-approved-old',
      submissionId: 'submission-approved-old',
      action: 'old_event',
      actorRole: 'reviewer',
      actorRef: 'reviewer-old',
      reason: 'Old event.',
      details: {},
      visibility: 'internal',
      createdAt: old,
      schemaVersion: MICRO_VOLUNTEER_SCHEMA_VERSION,
    });
    persistMicroVolunteerBoard(board, { storage, now: old });

    const counts = applyMicroVolunteerRetentionPolicy({ now: NOW_ISO }, { storage });
    expect(counts).toMatchObject({
      archivedTasks: 1,
      redactedClaims: 1,
      redactedSubmissions: 1,
      purgedClaims: 1,
      removedEvents: 1,
    });

    const after = loadMicroVolunteerBoard({ storage, now: NOW_ISO });
    expect(after.tasks.find((task) => task.id === 'task-completed-old').status).toBe(
      TASK_STATUS.ARCHIVED
    );
    expect(after.claims.find((claim) => claim.id === 'claim-approved-old').citizenId).toBe(
      'archived.contributor'
    );
    expect(after.claims.some((claim) => claim.id === 'claim-withdrawn-old')).toBe(false);
    expect(after.submissions[0].note).toContain('redacted');
    expect(after.submissions[0].files).toEqual([]);
    expect(after.moderationEvents.some((event) => event.id === 'old-event')).toBe(false);
    expect(after.moderationEvents.at(-1).action).toBe('retention_applied');
    expect(after.meta.retention.policy.taskRetentionDays).toBe(180);
  });

  it('refuses to persist a bundle with a missing collection', () => {
    const broken = createEmptyBoard({ now: NOW_ISO });
    delete broken.claims;
    expect(() => persistMicroVolunteerBoard(broken, { storage, now: NOW_ISO })).toThrow(
      /incomplete board/
    );
  });
});
