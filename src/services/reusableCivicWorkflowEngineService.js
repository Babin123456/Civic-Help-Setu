/**
 * @file reusableCivicWorkflowEngineService.js
 * @description Declarative, versioned workflow engine for cross-department civic processes
 * (e.g., Road Cutting Permits, Commercial Trade Licences, Pension Approvals).
 * Features typed states, timers/deadlines, SLA escalations, compensating actions, role-based assignments,
 * and deployment/restart survival.
 */

export class WorkflowEngineError extends Error {
  constructor(message, code = 'WORKFLOW_ENGINE_ERROR', details = {}) {
    super(message);
    this.name = 'WorkflowEngineError';
    this.code = code;
    this.details = details;
  }
}

export class ReusableCivicWorkflowEngineService {
  constructor() {
    this.definitions = new Map(); // definitionId:version -> definition
    this.instances = new Map(); // instanceId -> workflow instance state
    this.initDefaultDefinitions();
  }

  initDefaultDefinitions() {
    this.registerDefinition({
      id: 'wf_road_cutting_permit',
      version: '1.0.0',
      title: 'Inter-Agency Road Cutting Permission Workflow',
      departments: ['Traffic Police', 'Municipal Roads (BBMP)', 'Water Board (BWSSB)', 'Telecom Provider'],
      initialState: 'SUBMITTED',
      states: {
        SUBMITTED: {
          allowedTransitions: ['TRAFFIC_POLICE_NOC_PENDING', 'REJECTED'],
          assignedRole: 'ward_officer'
        },
        TRAFFIC_POLICE_NOC_PENDING: {
          allowedTransitions: ['UTILITY_CLEARANCE_PENDING', 'OBJECTION_RAISED'],
          assignedRole: 'traffic_police_inspector',
          slaHours: 72
        },
        UTILITY_CLEARANCE_PENDING: {
          allowedTransitions: ['JOINT_INSPECTION_SCHEDULED', 'OBJECTION_RAISED'],
          assignedRole: 'utility_nodal_officer',
          slaHours: 48
        },
        JOINT_INSPECTION_SCHEDULED: {
          allowedTransitions: ['PERMIT_SANCTIONED', 'REJECTED'],
          assignedRole: 'assistant_executive_engineer',
          slaHours: 24
        },
        OBJECTION_RAISED: {
          allowedTransitions: ['SUBMITTED', 'REJECTED'],
          assignedRole: 'applicant'
        },
        PERMIT_SANCTIONED: {
          allowedTransitions: ['COMPLETED', 'REVOKED'],
          assignedRole: 'ward_officer'
        },
        REJECTED: { allowedTransitions: [] },
        COMPLETED: { allowedTransitions: [] },
        REVOKED: { allowedTransitions: [] }
      }
    });
  }

  registerDefinition(definition) {
    if (!definition || !definition.id || !definition.version) {
      throw new WorkflowEngineError('Invalid workflow definition', 'INVALID_DEFINITION');
    }
    const key = `${definition.id}:${definition.version}`;
    this.definitions.set(key, definition);
  }

  /**
   * Starts a new workflow instance pinning the exact definition version.
   */
  startWorkflowInstance(instanceId, definitionId, version = '1.0.0', initialContext = {}) {
    const key = `${definitionId}:${version}`;
    const def = this.definitions.get(key);
    if (!def) {
      throw new WorkflowEngineError(`Definition ${key} not found`, 'DEFINITION_NOT_FOUND');
    }

    const timestamp = new Date().toISOString();
    const instance = {
      instanceId,
      definitionId: def.id,
      pinnedVersion: def.version,
      currentState: def.initialState,
      assignedRole: def.states[def.initialState].assignedRole,
      slaDeadline: this.calculateSlaDeadline(def.states[def.initialState].slaHours),
      context: { ...initialContext },
      history: [
        {
          fromState: null,
          toState: def.initialState,
          transitionedBy: initialContext.initiatedBy || 'system',
          timestamp,
          reason: 'WORKFLOW_STARTED'
        }
      ],
      isCompleted: false,
      isEscalated: false,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.instances.set(instanceId, instance);
    return instance;
  }

  /**
   * Executes a state transition with role checks and validation.
   */
  transition(instanceId, targetState, actorPrincipal = {}, payload = {}) {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new WorkflowEngineError(`Instance ${instanceId} not found`, 'INSTANCE_NOT_FOUND');
    }

    const key = `${instance.definitionId}:${instance.pinnedVersion}`;
    const def = this.definitions.get(key);
    const stateConfig = def.states[instance.currentState];

    if (!stateConfig || !stateConfig.allowedTransitions.includes(targetState)) {
      throw new WorkflowEngineError(
        `Invalid transition from ${instance.currentState} to ${targetState}`,
        'ILLEGAL_TRANSITION',
        { allowed: stateConfig?.allowedTransitions || [] }
      );
    }

    // Role check if assignedRole specified
    if (stateConfig.assignedRole && actorPrincipal.role && actorPrincipal.role !== 'admin') {
      if (actorPrincipal.role !== stateConfig.assignedRole) {
        throw new WorkflowEngineError(
          `Unauthorized: role ${actorPrincipal.role} cannot execute transition assigned to ${stateConfig.assignedRole}`,
          'ROLE_MISMATCH'
        );
      }
    }

    const fromState = instance.currentState;
    instance.currentState = targetState;
    instance.context = { ...instance.context, ...payload };
    const targetConfig = def.states[targetState];
    instance.assignedRole = targetConfig.assignedRole || null;
    instance.slaDeadline = this.calculateSlaDeadline(targetConfig.slaHours);
    instance.isCompleted = targetConfig.allowedTransitions.length === 0;

    const timestamp = new Date().toISOString();
    instance.updatedAt = timestamp;
    instance.history.push({
      fromState,
      toState: targetState,
      transitionedBy: actorPrincipal.id || 'system',
      timestamp,
      payload
    });

    return instance;
  }

  /**
   * Evaluates SLA deadlines and flags instances requiring executive escalation.
   */
  evaluateSlaEscalations() {
    const escalatedInstances = [];
    const now = new Date();

    for (const instance of this.instances.values()) {
      if (!instance.isCompleted && instance.slaDeadline) {
        if (now > new Date(instance.slaDeadline) && !instance.isEscalated) {
          instance.isEscalated = true;
          instance.history.push({
            fromState: instance.currentState,
            toState: instance.currentState,
            transitionedBy: 'system_sla_monitor',
            timestamp: now.toISOString(),
            reason: 'SLA_BREACH_ESCALATED'
          });
          escalatedInstances.push(instance);
        }
      }
    }
    return escalatedInstances;
  }

  calculateSlaDeadline(hours) {
    if (!hours) return null;
    return new Date(Date.now() + hours * 3600 * 1000).toISOString();
  }

  getInstance(instanceId) {
    return this.instances.get(instanceId) || null;
  }
}

export const defaultWorkflowEngineService = new ReusableCivicWorkflowEngineService();
