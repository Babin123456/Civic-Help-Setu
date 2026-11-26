/**
 * Supervisor-Agent Architecture - Conflict Detection
 * #1145: Complex Multi-Department Grievances
 *
 * Detects conflicting ownership between agents for the same task or overlapping
 * jurisdiction. All conflict detection is based on jurisdiction evidence overlap
 * and agent capability boundaries. Human approval required for resolution.
 *
 * Version: v1.0.0-conflict-detection
 */

import { validateJurisdictionEvidence } from './domainModel.js';

// ---------------------------------------------------------------------------
// Type: ConflictInfo
// ---------------------------------------------------------------------------

/**
 * Information about a detected conflict between agents.
// Triggered when two or more agents claim overlapping jurisdiction for the
// same task, or when agents cite contradictory jurisdiction evidence.
 */
export const ConflictStatus = {
  NONE: 'none',           // No conflict detected
  OVERLAPPING_JURISDICTION: 'overlapping_jurisdiction', // Agents claim same task scope
  CONTRADICTORY_EVIDENCE: 'contradictory_evidence', // Cited evidence conflicts
  UNSUPPORTED_AUTHORITY: 'unsupported_authority', // Agent claims unsupported jurisdiction
};

// /**
//  * Structure of a conflict record.
//  * Emitted as a supervisor domain event when conflict is detected.
//  */
// export const ConflictRecord = {
//   eventType: 'conflict_detected',
//   taskId: '',           // The task with the conflict
//   conflictingAgents: [], // Agent IDs involved
//   conflictType: ConflictStatus.NONE, // Type of conflict
//   evidenceDetails: [], // Jurisdiction evidence cited by each agent
//   resolution: {
//     status: 'pending', // 'pending' | 'human_resolved' | 'agent_resolved' | 'escalated'
//     resolvedBy: '',    // Human ID or 'auto-resolved'
//     resolvedAt: '',    // ISO timestamp
//     decision: '',      // 'assign-to-agent-A' | 'reassign-to-agent-B' | 'split-jurisdiction' | 'human-review'
//   },
//   createdAt: '',        // When conflict was detected
// };

// ---------------------------------------------------------------------------
// SupervisorConflictDetector Class
// ---------------------------------------------------------------------------

/**
 * Detects conflicts in supervisor task assignments and jurisdiction evidence.
// The detector runs periodic checks or is triggered on task state changes.
// It identifies when multiple agents claim the same jurisdictional scope
// or when evidence cited by agents is contradictory or unsupported.
 */
export class SupervisorConflictDetector {
  constructor(registry) {
    if (!registry) {
      throw new TypeError('SupervisorConflictDetector requires a registry instance');
    }
    this.registry = registry;
    this._detectedConflicts = new Map(); // taskId -> conflict record
  }

  /**
   * Detect conflicts for a given task.
   * Analyzes the task's jurisdiction evidence and assigned agent(s) against
   * the registry to find overlapping or contradictory claims.
   *
   * @param {object} task - The supervisor task to check for conflicts
   * @param {Array<object>} [assignedAgents=[]] - Optional list of agent IDs assigned to this task
   * @returns {object} Conflict detection result
   */
  detectConflicts(task, assignedAgents = []) {
    const taskId = task.id;
    const result = {
      taskId,
      hasConflict: false,
      conflictType: ConflictStatus.NONE,
      conflictingAgents: [],
      evidenceDetails: [],
      resolution: {
        status: 'pending',
        resolvedBy: null,
        resolvedAt: null,
        decision: null,
      },
    };

    // Validate task jurisdiction evidence at boundary
    let taskEvidence = null;
    if (task.jurisdictionEvidence) {
      const evValidation = validateJurisdictionEvidence(task.jurisdictionEvidence);
      if (evValidation.isValid) {
        taskEvidence = task.jurisdictionEvidence;
      }
    }

    // If no agents provided, get them from registry based on task evidence
    const agentsToCheck = assignedAgents.filter(
      (id) => typeof id === 'string' && id.trim().length > 0
    );

    if (agentsToCheck.length === 0 && taskEvidence) {
      // Infer department from evidence sourceId or use a default
      const dept = this._inferDepartmentFromEvidence(taskEvidence);
      agentsToCheck.push(
        ...this.registry.getAgentsByDepartment(dept)
          .filter((a) => this.registry.isAgentAvailable(a.agentId))
          .map((a) => a.agentId)
      );
    }

    // If still no agents, no conflict to detect
    if (agentsToCheck.length === 0) {
      return result;
    }

    // Collect evidence details from each agent's claimed scope
    // (In a real system, each agent would submit their evidence analysis;
    // here we simulate by checking registry-authorized jurisdictions)
    const agentClaims = [];

    for (const agentId of agentsToCheck) {
      const agent = this.registry._byAgentId.get(agentId);
      if (!agent) continue;

      // Check if this agent is authorized for the task's jurisdiction evidence
      const agentIsAuthorized = this._isAgentAuthorizedForEvidence(
        agent,
        taskEvidence
      );

      agentClaims.push({
        agentId,
        agentName: agent.agentName,
        department: agent.department,
        jurisdictionLevel: agent.jurisdictionLevel,
        isAuthorizedForEvidence: agentIsAuthorized,
        permittedTools: agent.permittedTools,
      });

      if (!agentIsAuthorized) {
        // Agent is not authorized for this evidence - potential conflict
        result.hasConflict = true;
        result.conflictType = ConflictStatus.UNSUPPORTED_AUTHORITY;
        result.conflictingAgents.push(agentId);
        result.evidenceDetails.push({
          agentId,
          source: 'unauthorized_for_evidence',
        });
      }
    }

    // If we have multiple agents, check for overlapping jurisdiction
    if (agentClaims.length >= 2) {
      // Check for overlap in authorized jurisdictions
      const jurisdictions = agentClaims.map((ac) => ac.department + ':' + ac.jurisdictionLevel);
      const uniqueJurisdictions = new Set(jurisdictions);

      // If all agents are for the same department/jurisdiction level, it's not necessarily a conflict
      // unless they're both claiming the exact same task scope
      if (uniqueJurisdictions.size < agentClaims.length) {
        // Some agents share the same department/jurisdiction level => potential overlap
        result.hasConflict = true;

        // Determine the conflict type
        // Check if any evidence is contradictory
        const hasContradictory = agentClaims.some((ac) => !ac.isAuthorizedForEvidence);
        if (hasContradictory) {
          result.conflictType = ConflictStatus.CONTRADICTORY_EVIDENCE;
        } else {
          result.conflictType = ConflictStatus.OVERLAPPING_JURISDICTION;
        }
      }
    }

    // Store the detected conflict
    this._detectedConflicts.set(taskId, result);

    return result;
  }

  /**
   * Check if an agent is authorized for a task's jurisdiction evidence.
   * @param {object} agent - Agent registry entry
   * @param {object} [jurisdictionEvidence] - Task jurisdiction evidence
   * @returns {boolean} Whether the agent is authorized
   * @private
   */
  _isAgentAuthorizedForEvidence(agent, jurisdictionEvidence) {
    if (!jurisdictionEvidence) {
      // No evidence to validate against; assume authorized for department
      return true;
    }

    const { sourceType, sourceId } = jurisdictionEvidence;

    // If agent has no authorized jurisdictions listed, authorize for all in its department
    if (agent.authorizedJurisdictions.length === 0) {
      return true;
    }

    // Check if the evidence's sourceId matches any of the agent's authorized jurisdictions
    return agent.authorizedJurisdictions.some(
      (authId) => authId.toLowerCase() === sourceId.toLowerCase()
    );
  }

  /**
   * Infer the department from jurisdiction evidence.
   * @param {object} jurisdictionEvidence - The evidence to infer from
   * @returns {string} Department name
   * @private
   */
  _inferDepartmentFromEvidence(jurisdictionEvidence) {
    const { sourceId } = jurisdictionEvidence;

    // Map common jurisdiction identifiers to departments
    const deptMap = {
      'delhi': 'Public Works',
      'mumbai': 'Municipal Sanitation',
      'bangalore': 'Water Board',
      'chennai': 'Electricity DISCOM',
      'pune': 'Transport Authority',
      'hyd': 'Health Department',
      'kol': 'Revenue Department',
    };

    // Try to match sourceId to a known department
    const lowerSource = sourceId.toLowerCase();
    for (const [key, dept] of Object.entries(deptMap)) {
      if (lowerSource.includes(key)) {
        return dept;
      }
    }

    // Default fallback
    return 'Multi-Department Coordination';
  }

  /**
   * Get the detected conflict for a task, if any.
   * @param {string} taskId - The task ID
   * @returns {object|null} Conflict record or null if no conflict detected
   */
  getConflict(taskId) {
    return this._detectedConflicts.get(taskId) || null;
  }

  /**
   * Resolve a detected conflict.
   * Records human resolution of the conflict.
   * @param {string} taskId - The task with the conflict
   * @param {string} resolvedBy - Human operator ID who resolved it
   * @param {string} decision - The resolution decision
   * @param {string} [decisionOptions] - One of: 'assign-to-agent-A', 'assign-to-agent-B', 'split-jurisdiction', 'human-review'
   */
  resolveConflict(taskId, resolvedBy, decision) {
    const conflict = this._detectedConflicts.get(taskId);
    if (!conflict) {
      console.warn(`No conflict detected for task ${taskId}`);
      return;
    }

    conflict.resolution.status = 'human_resolved';
    conflict.resolution.resolvedBy = resolvedBy;
    conflict.resolution.resolvedAt = new Date().toISOString();
    conflict.resolution.decision = decision;

    // Emit resolution event (in a real system, this would publish to an event bus)
    // this._emitResolutionEvent(conflict);

    return conflict;
  }

  /**
   * Get all currently detected conflicts.
   * @returns {Map<string, object>} Map of taskId -> conflict record
   */
  getAllConflicts() {
    return new Map(this._detectedConflicts);
  }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export default SupervisorConflictDetector;