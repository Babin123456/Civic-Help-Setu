// Skill Service
// -----------
// Provides CRUD operations for skill records.
// Skills are categorical identifiers for volunteer capabilities.

import {
  SKILL_SCHEMA_VERSION,
  SUPPORTED_SKILL_SCHEMA_VERSIONS,
  validateSkillRecord,
  validateSkillEnvelope,
  applySkillDefaults,
  formatSkillError,
} from '../data/skillContract.js';

// In-memory storage for demonstration
const skills = new Map();

/** Generate a unique ID */
function generateId(prefix = 'skill') {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new skill.
 * @param {Object} skill - The skill data
 * @returns {Object} The created skill with generated ID
 * @throws {Error} If validation fails
 */
export function createSkill(skill) {
  const prepared = {
    ...skill,
    id: skill.id || generateId(),
    schemaVersion: skill.schemaVersion ?? SKILL_SCHEMA_VERSION,
  };

  // Validate
  const envelope = { schemaVersion: SKILL_SCHEMA_VERSION, skills: [prepared] };
  const validation = validateSkillEnvelope(envelope);
  if (!validation.valid) {
    const errors = validation.errors.map(formatSkillError).join('; ');
    throw new Error(`Skill validation failed: ${errors}`);
  }

  // Check for duplicate ID
  if (skills.has(prepared.id)) {
    throw new Error(`Skill with id ${prepared.id} already exists`);
  }

  skills.set(prepared.id, prepared);
  return prepared;
}

/**
 * Read a skill by ID.
 * @param {string} skillId - The skill ID
 * @returns {Object|null} The skill or null if not found
 */
export function readSkill(skillId) {
  return skills.get(skillId) || null;
}

/**
 * Update an existing skill.
 * @param {string} skillId - The skill ID
 * @param {Object} updates - The fields to update
 * @returns {Object|undefined} The updated skill, or undefined if not found
 * @throws {Error} If validation fails
 */
export function updateSkill(skillId, updates) {
  const existing = skills.get(skillId);
  if (!existing) {
    throw new Error(`Skill ${skillId} not found`);
  }

  const updated = { ...existing, ...updates };
  // Re-validate
  const envelope = { schemaVersion: SKILL_SCHEMA_VERSION, skills: [updated] };
  const validation = validateSkillEnvelope(envelope);
  if (!validation.valid) {
    const errors = validation.errors.map(formatSkillError).join('; ');
    throw new Error(`Skill update validation failed: ${errors}`);
  }

  skills.set(skillId, updated);
  return updated;
}

/**
 * Delete a skill.
 * @param {string} skillId - The skill ID
 * @returns {boolean} true if deleted, false if not found
 */
export function deleteSkill(skillId) {
  return skills.delete(skillId);
}

/**
 * List all skills.
 * @param {Object} [filters] - Optional filters
 * @returns {Array} List of skills
 */
export function listSkills(filters = {}) {
  const results = Array.from(skills.values());

  // Filter by category if present
  if (filters.category) {
    return results.filter((s) => s.category === filters.category);
  }

  return results;
}

/**
 * Search skills by name (substring match).
 * @param {string} query - The search query
 * @returns {Array} Matching skills
 */
export function searchSkills(query) {
  if (!query || typeof query !== 'string') return [];
  const lowerQuery = query.toLowerCase();
  return Array.from(skills.values()).filter(
    (s) => s.name.toLowerCase().includes(lowerQuery)
  );
}

// Export the storage for testing
export { skills };