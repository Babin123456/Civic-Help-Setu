/**
 * Supervisor-Agent Architecture - Agent Registry
 * #1145: Complex Multi-Department Grievances
 *
 * Maps departments/jurisdictions to registered domain-agents.
 * The supervisor queries this registry to find available agents for a given
 * task's jurisdiction. All agent data is treated as untrusted proposals –
 * the supervisor validates agent assignments against jurisdiction evidence.
 *
 * Version: v1.0.0-agent-registry
 */

import { JURISDICTION_SOURCE_TYPES, validateJurisdictionEvidence } from './domainModel.js';

// ---------------------------------------------------------------------------
// Type: AgentRegistryEntry
// ---------------------------------------------------------------------------

/**
 * A registered domain-agent entry.
// The supervisor uses this to map departments to available agents and
 * validate that agent tool calls stay within permitted bounds.
 */
export const AgentRegistryEntry = {
  /** Unique agent identifier */
  agentId: '',

  /** Department this agent serves (e.g., "PWD", "WaterBoard", "Revenue") */
  department: '',

  /** Jurisdiction level: 'local' | 'state' | 'national' */
  jurisdictionLevel: 'local',

  /** Human-readable agent name */
  agentName: '',

  /** Contact email for the agent operator */
  contactEmail: '',

  /** Capabilities this agent can exercise */
  capabilities: [], // e.g., ['investigate', 'evidence-review', 'escalate']

  /** Tools this agent is permitted to invoke */
  permittedTools: [], // e.g., ['document-upload', 'portal-query', 'email-notify']

  /** Maximum concurrent tasks this agent can handle */
  maxConcurrentTasks: 5,

  /** SLA in days for this agent's task completion */
  slaDays: 7,

  /** Version of this registry entry for forward compatibility */
  contractVersion: 'v1.0.0',

  /** Timestamp when this entry was last validated/verified */
  lastVerifiedAt: '',

  /** Jurisdictions this agent is authorized to handle */
  authorizedJurisdictions: [], // e.g., ['Delhi', 'Mumbai', 'Bangalore']
};

/**
 * Creates a new agent registry entry.
// All fields are validated at assignment time; the supervisor performs
 * runtime validation of agent assignments.
 * @param {object} options - Registration options
 * @param {string} options.agentId - Unique agent ID
 * @param {string} options.department - Department this agent serves
 * @param {string} options.jurisdictionLevel - 'local' | 'state' | 'national'
 * @param {string} options.agentName - Human-readable name
 * @param {string} options.contactEmail - Contact email
 * @param {string[]} options.capabilities - Agent capabilities
 * @param {string[]} options.permittedTools - Permitted tools
 * @param {number} [options.maxConcurrentTasks=5] - Max concurrent tasks
 * @param {number} [options.slaDays=7] - SLA in days
 * @param {string[]} [options.authorizedJurisdictions=[]] - Authorized jurisdictions
 * @returns {object} Validated agent registry entry
 */
export function createAgentRegistryEntry({
  agentId,
  department,
  jurisdictionLevel,
  agentName,
  contactEmail,
  capabilities,
  permittedTools,
  maxConcurrentTasks = 5,
  slaDays = 7,
  authorizedJurisdictions = [],
} = {}) {
  // Validate inputs at trust boundary
  if (typeof agentId !== 'string' || agentId.trim().length === 0) {
    throw new TypeError('agentId must be a non-empty string');
  }
  if (typeof department !== 'string' || department.trim().length === 0) {
    throw new TypeError('department must be a non-empty string');
  }
  if (
    typeof jurisdictionLevel !== 'string' ||
    !['local', 'state', 'national'].includes(jurisdictionLevel)
  ) {
    throw new RangeError(
      `jurisdictionLevel must be one of: 'local', 'state', 'national'`
    );
  }
  if (typeof agentName !== 'string' || agentName.trim().length === 0) {
    throw new TypeError('agentName must be a non-empty string');
  }
  if (
    typeof contactEmail !== 'string' ||
    !contactEmail.includes('@') ||
    !contactEmail.includes('.')
  ) {
    throw new TypeError('contactEmail must be a valid email address');
  }
  if (!Array.isArray(capabilities) || capabilities.length === 0) {
    throw new TypeError('capabilities must be a non-empty array');
  }
  if (!Array.isArray(permittedTools) || permittedTools.length === 0) {
    throw new TypeError('permittedTools must be a non-empty array');
  }
  if (typeof maxConcurrentTasks !== 'number' || maxConcurrentTasks < 1) {
    throw new RangeError('maxConcurrentTasks must be a positive number');
  }
  if (typeof slaDays !== 'number' || slaDays < 1) {
    throw new RangeError('slaDays must be a positive number');
  }
  if (
    !Array.isArray(authorizedJurisdictions) ||
    !authorizedJurisdictions.every(
      (j) => typeof j === 'string' && j.trim().length > 0
    )
  ) {
    throw new TypeError('authorizedJurisdictions must be an array of non-empty strings');
  }

  return {
    agentId,
    department,
    jurisdictionLevel,
    agentName,
    contactEmail,
    capabilities,
    permittedTools,
    maxConcurrentTasks,
    slaDays,
    contractVersion: 'v1.0.0',
    lastVerifiedAt: new Date().toISOString(),
    authorizedJurisdictions,
  };
}

// ---------------------------------------------------------------------------
// SupervisorAgentRegistry Class
// ---------------------------------------------------------------------------

/**
 * Registry of domain-agents for the supervisor architecture.
// The supervisor queries this registry to find available agents for a given
 * task's jurisdiction. Supports per-department lookups, concurrent task
 * tracking, and capability-based agent selection.
 */
export class SupervisorAgentRegistry {
  constructor(initialEntries = []) {
    // Internal map: department -> array of registry entries
    this._entries = new Map();
    // Internal map: agentId -> entry (for quick lookup)
    this._byAgentId = new Map();
    // Internal map: (department, jurisdictionLevel) -> entries
    this._byJurisdiction = new Map();

    // Seed with initial entries
    for (const entry of initialEntries) {
      this.register(entry);
    }
  }

  /**
   * Register a new agent entry.
   * @param {object} entry - Agent registry entry (as returned by createAgentRegistryEntry)
   */
  register(entry) {
    const { agentId, department, jurisdictionLevel } = entry;

    // Initialize department map if needed
    if (!this._entries.has(department)) {
      this._entries.set(department, []);
    }
    this._entries.get(department).push(entry);

    // Index by agentId
    this._byAgentId.set(agentId, entry);

    // Index by (department, jurisdictionLevel)
    const jurisdictionKey = `${department}:${jurisdictionLevel}`;
    if (!this._byJurisdiction.has(jurisdictionKey)) {
      this._byJurisdiction.set(jurisdictionKey, []);
    }
    // Avoid duplicates
    const existing = this._byJurisdiction
      .get(jurisdictionKey)
      .some((e) => e.agentId === agentId);
    if (!existing) {
      this._byJurisdiction.get(jurisdictionKey).push(entry);
    }
  }

  /**
   * Unregister an agent by agentId.
   * @param {string} agentId - The agent to unregister
   * @returns {boolean} Whether the agent was found and unregistered
   */
  unregister(agentId) {
    const entry = this._byAgentId.get(agentId);
    if (!entry) return false;

    const { department, jurisdictionLevel } = entry;
    const depEntries = this._entries.get(department);
    if (depEntries) {
      this._entries.set(
        department,
        depEntries.filter((e) => e.agentId !== agentId)
      );
    }

    this._byAgentId.delete(agentId);

    const jurisdictionKey = `${department}:${jurisdictionLevel}`;
    const jEntries = this._byJurisdiction.get(jurisdictionKey);
    if (jEntries) {
      this._byJurisdiction.set(
        jurisdictionKey,
        jEntries.filter((e) => e.agentId !== agentId)
      );
    }

    return true;
  }

  /**
   * Get all agents for a given department.
   * @param {string} department - The department name
   * @returns {Array<object>} Array of registry entries for this department
   */
  getAgentsByDepartment(department) {
    return this._entries.get(department) || [];
  }

  /**
   * Get agents authorized for a specific jurisdiction level and department.
   * @param {string} department - The department name
   * @param {string} jurisdictionLevel - 'local' | 'state' | 'national'
   * @returns {Array<object>} Array of matching registry entries
   */
  getAgentsByJurisdiction(department, jurisdictionLevel) {
    const key = `${department}:${jurisdictionLevel}`;
    return this._byJurisdiction.get(key) || [];
  }

  /**
   * Find agents that can handle a task with given jurisdiction evidence.
   * Validates the evidence against authorized jurisdictions in the registry.
   * @param {object} jurisdictionEvidence - Jurisdiction evidence (as validated by validateJurisdictionEvidence)
   * @param {string} department - The department the grievance relates to
   * @returns {Array<object>} Agents that are authorized for this jurisdiction
   */
  findAgentsForEvidence(jurisdictionEvidence, department) {
    // Validate evidence at boundary
    const evValidation = validateJurisdictionEvidence(jurisdictionEvidence);
    if (!evValidation.isValid) {
      return []; // No agents can serve invalid evidence
    }

    const { sourceType, sourceId } = jurisdictionEvidence;
    const agents = [];

    // Get agents for this department
    const departmentAgents = this.getAgentsByDepartment(department);

    for (const agent of departmentAgents) {
      // Check if the agent is authorized for the jurisdiction in the evidence
      const isAuthorized = agent.authorizedJurisdictions.length === 0 ||
        agent.authorizedJurisdictions.some(
          (authId) => authId.toLowerCase() === sourceId.toLowerCase()
        );

      if (isAuthorized) {
        agents.push(agent);
      }
    }

    return agents;
  }

  /**
   * Get all registered departments.
   * @returns {Array<string>} List of department names
   */
  getDepartments() {
    return [...this._entries.keys()];
  }

  /**
   * Get the number of registered agents.
   * @returns {number} Count of registered agents
   */
  getAgentCount() {
    return this._byAgentId.size;
  }

  /**
   * Check if an agent is available (below max concurrent tasks).
   * @param {string} agentId - The agent to check
   * @param {number} currentLoad - Current number of tasks assigned to this agent
   * @returns {boolean} Whether the agent is available
   */
  isAgentAvailable(agentId, currentLoad = 0) {
    const entry = this._byAgentId.get(agentId);
    if (!entry) return false;
    return currentLoad < entry.maxConcurrentTasks;
  }

  /**
   * Get agents sorted by SLA (best first) for a given department and jurisdiction.
   * @param {string} department - The department name
   * @param {string} jurisdictionLevel - 'local' | 'state' | 'national'
   * @returns {Array<object>} Agents sorted by SLA (ascending = best first)
   */
  getAgentsSortedBySla(department, jurisdictionLevel) {
    const agents = this.getAgentsByJurisdiction(department, jurisdictionLevel);
    return agents.sort((a, b) => a.slaDays - b.slaDays);
  }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export default SupervisorAgentRegistry;