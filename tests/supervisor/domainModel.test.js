import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from 'vitest';

// Import domain model from supervisor
import {
  SupervisorTaskStatus,
  JURISDICTION_SOURCE_TYPES,
  validateJurisdictionEvidence,
  createSupervisorTask,
  validateSupervisorTask,
  supervisorTaskToFirestore,
  supervisorTaskFromFirestore,
  AgentCapabilityContract,
  DagEdgeType,
  createDagEdge,
  SupervisorConfig,
} from '../../src/supervisor/domainModel.js';

import { TaskPriority, TaskStatus } from '../../src/tasks/schemas/taskSchema.js';

describe('supervisor domain model', () => {
  let validEvidence;

  beforeEach(() => {
    validEvidence = {
      sourceType: JURISDICTION_SOURCE_TYPES.STATUTORY_PORTAL,
      sourceId: 'Delhi',
      sourceUrl: 'https://pgportal.gov.in',
      citedBy: 'supervisor-service',
      citedAt: new Date().toISOString(),
      provenance: 'official government portal',
    };
  });

  describe('JURISDICTION_SOURCE_TYPES', () => {
    it('has all expected source type values', () => {
      expect(JURISDICTION_SOURCE_TYPES).toHaveProperty('STATUTORY_PORTAL');
      expect(JURISDICTION_SOURCE_TYPES).toHaveProperty('GOVERNMENT_DOCUMENT');
      expect(JURISDICTION_SOURCE_TYPES).toHaveProperty('OFFICIAL_PORTAL');
      expect(JURISDICTION_SOURCE_TYPES).toHaveProperty('CITIZEN_PROVIDED');
    });
  });

  describe('validateJurisdictionEvidence', () => {
    it('validates valid evidence', () => {
      const result = validateJurisdictionEvidence(validEvidence);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails without evidence', () => {
      const result = validateJurisdictionEvidence(null);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Jurisdiction evidence is required');
    });

    it('fails with invalid sourceType', () => {
      const badEvidence = { ...validEvidence, sourceType: 'invalid-type' };
      const result = validateJurisdictionEvidence(badEvidence);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Invalid sourceType. Must be one of: statutory-portal, government-document, official-portal, citizen-provided"
      );
    });

    it('fails with empty sourceId', () => {
      const badEvidence = { ...validEvidence, sourceId: '' };
      const result = validateJurisdictionEvidence(badEvidence);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('sourceId must be a non-empty string');
    });

    it('fails with invalid sourceUrl', () => {
      const badEvidence = { ...validEvidence, sourceUrl: 'not-a-url' };
      const result = validateJurisdictionEvidence(badEvidence);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('sourceUrl must be a valid URL');
    });

    it('fails with empty citedBy', () => {
      const badEvidence = { ...validEvidence, citedBy: '' };
      const result = validateJurisdictionEvidence(badEvidence);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('citedBy must be a non-empty string');
    });

    it('fails with invalid citedAt format', () => {
      const badEvidence = { ...validEvidence, citedAt: 'not-a-date' };
      const result = validateJurisdictionEvidence(badEvidence);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('citedAt must be a valid ISO timestamp');
    });

    it('fails with empty provenance', () => {
      const badEvidence = { ...validEvidence, provenance: '' };
      const result = validateJurisdictionEvidence(badEvidence);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('provenance must be a non-empty string');
    });
  });

  describe('createSupervisorTask', () => {
    it('creates a valid supervisor task with required fields', () => {
      const task = createSupervisorTask({
        type: 'grievance-decomposition',
        tenantId: 'tenant-123',
        jurisdictionEvidence: validEvidence,
      });

      expect(task.type).toBe('grievance-decomposition');
      expect(task.tenantId).toBe('tenant-123');
      expect(task.status).toBe(SupervisorTaskStatus.PENDING);
      expect(task.jurisdictionEvidence).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.priority).toBe(TaskPriority.NORMAL);
      expect(task.dependsOn).toEqual([]);
      expect(task.retryCount).toBe(0);
      expect(task.maxRetries).toBe(3);
    });

    it('creates a task with custom priority', () => {
      const task = createSupervisorTask({
        type: 'department-investigation',
        tenantId: 'tenant-123',
        priority: TaskPriority.HIGH,
        jurisdictionEvidence: validEvidence,
      });

      expect(task.priority).toBe(TaskPriority.HIGH);
    });

    it('creates a task with custom deadline', () => {
      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const task = createSupervisorTask({
        type: 'grievance-decomposition',
        tenantId: 'tenant-123',
        deadlineAt: futureDate,
        jurisdictionEvidence: validEvidence,
      });

      expect(task.deadlineAt).toBe(futureDate);
    });

    it('throws when type is empty', () => {
      expect(() =>
        createSupervisorTask({
          type: '',
          jurisdictionEvidence: validEvidence,
        })
      ).toThrow('Task type must be a non-empty string');
    });

    it('throws when type is not a string', () => {
      expect(() =>
        createSupervisorTask({
          type: 123,
          jurisdictionEvidence: validEvidence,
        })
      ).toThrow('Task type must be a non-empty string');
    });

    it('throws when jurisdiction evidence is invalid', () => {
      const badEvidence = { ...validEvidence, sourceType: 'invalid' };
      expect(() =>
        createSupervisorTask({
          type: 'grievance-decomposition',
          jurisdictionEvidence: badEvidence,
        })
      ).toThrow('Invalid jurisdiction evidence');
    });
  });

  describe('validateSupervisorTask', () => {
    it('validates a task created by createSupervisorTask', () => {
      const task = createSupervisorTask({
        type: 'grievance-decomposition',
        jurisdictionEvidence: validEvidence,
      });
      expect(validateSupervisorTask(task)).toBe(true);
    });

    it('fails when id is missing', () => {
      const { id, ...rest } = createSupervisorTask({
        type: 'grievance-decomposition',
        jurisdictionEvidence: validEvidence,
      });
      const invalidTask = { ...rest, type: 'other' };
      expect(() => validateSupervisorTask(invalidTask)).toThrow(
        'Task must have an id field'
      );
    });

    it('fails when status is invalid', () => {
      const task = createSupervisorTask({
        type: 'grievance-decomposition',
        jurisdictionEvidence: validEvidence,
        status: 'invalid_status' ,
      });
      expect(() => validateSupervisorTask(task)).toThrow(
        'Invalid task status'
      );
    });

    it('fails when priority is invalid', () => {
      const task = createSupervisorTask({
        type: 'grievance-decomposition',
        jurisdictionEvidence: validEvidence,
        priority: 999 ,
      });
      expect(() => validateSupervisorTask(task)).toThrow(
        'Invalid task priority'
      );
    });

    it('fails when retryCount is negative', () => {
      const task = createSupervisorTask({
        type: 'grievance-decomposition',
        jurisdictionEvidence: validEvidence,
        retryCount: -1,
      });
      expect(() => validateSupervisorTask(task)).toThrow(
        'retryCount must be a non-negative integer'
      );
    });

    it('fails when maxRetries is zero', () => {
      const task = createSupervisorTask({
        type: 'grievance-decomposition',
        jurisdictionEvidence: validEvidence,
        maxRetries: 0,
      });
      expect(() => validateSupervisorTask(task)).toThrow(
        'maxRetries must be a positive integer'
      );
    });

    it('validates deadlineAt format', () => {
      const task = createSupervisorTask({
        type: 'grievance-decomposition',
        jurisdictionEvidence: validEvidence,
        deadlineAt: '2026-12-31T23:59:59',
      });
      expect(validateSupervisorTask(task)).toBe(true);
    });

    it('fails when deadlineAt has bad format', () => {
      const task = createSupervisorTask({
        type: 'grievance-decomposition',
        jurisdictionEvidence: validEvidence,
        deadlineAt: 'invalid',
      });
      expect(() => validateSupervisorTask(task)).toThrow(
        'deadlineAt must be a valid ISO timestamp'
      );
    });
  });

  describe('supervisorTaskToFirestore / fromFirestore', () => {
    it('round-trips a task through Firestore format', () => {
      const original = createSupervisorTask({
        type: 'grievance-decomposition',
        tenantId: 'tenant-123',
        jurisdictionEvidence: validEvidence,
      });

      const firestoreFormat = supervisorTaskToFirestore(original);
      const roundTripped = supervisorTaskFromFirestore(firestoreFormat);

      expect(roundTripped.id).toBe(original.id);
      expect(roundTripped.type).toBe(original.type);
      expect(roundTripped.status).toBe(original.status);
      expect(roundTripped.jurisdictionEvidence).toBeDefined();
      expect(validateSupervisorTask(roundTripped)).toBe(true);
    });

    it('handles null deadlineAt in round-trip', () => {
      const original = createSupervisorTask({
        type: 'grievance-decomposition',
        jurisdictionEvidence: validEvidence,
        deadlineAt: null,
      });

      const firestoreFormat = supervisorTaskToFirestore(original);
      const roundTripped = supervisorTaskFromFirestore(firestoreFormat);

      expect(roundTripped.deadlineAt).toBeNull();
      expect(validateSupervisorTask(roundTripped)).toBe(true);
    });
  });

  describe('DagEdge', () => {
    it('creates a sequential edge', () => {
      const edge = createDagEdge('task-1', 'task-2', DagEdgeType.SEQUENTIAL);
      expect(edge.type).toBe(DagEdgeType.SEQUENTIAL);
      expect(edge.sourceTaskId).toBe('task-1');
      expect(edge.targetTaskId).toBe('task-2');
    });

    it('creates a parallel edge', () => {
      const edge = createDagEdge('task-1', 'task-2', DagEdgeType.PARALLEL);
      expect(edge.type).toBe(DagEdgeType.PARALLEL);
    });

    it('creates an alternative edge', () => {
      const edge = createDagEdge('task-1', 'task-2', DagEdgeType.ALTERNATIVE);
      expect(edge.type).toBe(DagEdgeType.ALTERNATIVE);
    });

    it('throws on invalid sourceTaskId', () => {
      expect(() => createDagEdge('', 'task-2', DagEdgeType.SEQUENTIAL)).toThrow(
        'sourceTaskId must be a non-empty string'
      );
    });

    it('throws on invalid targetTaskId', () => {
      expect(() => createDagEdge('task-1', '', DagEdgeType.SEQUENTIAL)).toThrow(
        'targetTaskId must be a non-empty string'
      );
    });

    it('throws on invalid edge type', () => {
      expect(() => createDagEdge('task-1', 'task-2', 'invalid-type')).toThrow(
        'Invalid edge type'
      );
    });
  });

  describe('SupervisorConfig', () => {
    it('has default values', () => {
      expect(SupervisorConfig.maxTasksPerGrievance).toBe(20);
      expect(SupervisorConfig.requireHumanApprovalForFiling).toBe(true);
      expect(SupervisorConfig.requireHumanApprovalForBenefitDenial).toBe(true);
      expect(SupervisorConfig.requireHumanApprovalForOfficialStatusClaim).toBe(true);
      expect(SupervisorConfig.maxModelApiCostPerGrievance).toBe(0.05);
    });
  });
});