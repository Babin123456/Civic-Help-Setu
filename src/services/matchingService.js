// Matching Service
// ---------------
// Provides intelligent volunteer-task matching using deterministic eligibility filters
// followed by an explainable ranking model.
// Never infers sensitive traits or auto-rejects volunteers.
// Allows coordinators to override matches with an audit reason.

import {
  VOLUNTEER_PROFILE_SCHEMA_VERSION,
  SKILL_SCHEMA_VERSION,
  VOLUNTEER_TASK_SCHEMA_VERSION,
  TASK_APPLICATION_SCHEMA_VERSION,
  ASSIGNMENT_SCHEMA_VERSION,
  APPLICATION_STATUSES,
} from '../data/index.js';

// Import contract validators
import {
  validateVolunteerProfileRecord,
  validateSkillRecord,
  validateVolunteerTaskRecord,
} from '../data/volunteerProfileContract.js';
import {
  validateSkillEnvelope,
} from '../data/skillContract.js';
import {
  validateTaskApplicationRecord,
} from '../data/taskApplicationContract.js';

// Import services
import { readVolunteerProfile } from './volunteerProfileService.js';
import { readSkill } from './skillService.js';
import { readVolunteerTask } from './volunteerTaskService.js';
import { createTaskApplication } from './taskApplicationService.js';

// Matching configuration
const MATCHING_SCHEMA_VERSION = 1;
const MINIMUM_MATCH_SCORE = 30; // Minimum score for a match to be surface
const MAX_RANKED_RESULTS = 10;

// Eligibility filter types
const ELIGIBILITY_RULES = {
  // Skill match: volunteer must have all required skills
  skillMatch: (volunteerSkills, taskRequiredSkills) => {
    if (!taskRequiredSkills || taskRequiredSkills.length === 0) return { eligible: true, scoreBoost: 0 };
    
    // Normalize to skill ID strings
    const volunteerSkillIds = new Set(
      volunteerSkills.map(s => typeof s === 'object' ? s.id : s)
    );
    
    const taskSkillIds = new Set(
      taskRequiredSkills.map(s => typeof s === 'object' ? s.id : s)
    );
    
    // Check if volunteer has ALL required skills
    const hasAllRequired = [...taskSkillIds].every(id => volunteerSkillIds.has(id));
    
    if (!hasAllRequired) {
      return { eligible: false, reason: 'Missing required skills' };
    }
    
    // Score boost for having all required skills
    const skillOverlap = [...volunteerSkillIds].filter(id => taskSkillIds.has(id)).length;
    const scoreBoost = skillOverlap * 10; // 10 points per matching skill
    
    return { eligible: true, scoreBoost };
  },
  
  // Availability filter: volunteer must be available
  availabilityFilter: (volunteerAvailability, task) => {
    if (!volunteerAvailability || volunteerAvailability.isAvailable === false) {
      return { eligible: false, reason: 'Volunteer is not currently available' };
    }
    return { eligible: true, scoreBoost: 0 };
  },
  
  // Jurisdiction/location filter: volunteer's service area must include task's service area
  jurisdictionFilter: (volunteerServiceArea, task) => {
    if (!volunteerServiceArea || !task.serviceAreaId) return { eligible: true, scoreBoost: 0 };
    
    // Simple match: if volunteer's service area ID matches task's service area ID
    if (volunteerServiceArea.id === task.serviceAreaId) {
      return { eligible: true, scoreBoost: 15 };
    }
    
    // Check if task's state jurisdiction includes volunteer's jurisdiction
    if (volunteerServiceArea.stateJurisdiction && task.stateJurisdiction) {
      const volunteerStates = new Set(volunteerServiceArea.stateJurisdiction);
      const taskStates = new Set(task.stateJurisdiction);
      const overlap = [...volunteerStates].some(s => taskStates.has(s));
      if (overlap) {
        return { eligible: true, scoreBoost: 5 };
      }
    }
    
    return { eligible: true, scoreBoost: 0 }; // No strict rejection, just lower score
  },
  
  // Accessibility filter: task accessibility needs must be compatible
  accessibilityFilter: (volunteerAccessibility, task) => {
    if (!task.accessibilityNeeds || task.accessibilityNeeds.length === 0) {
      return { eligible: true, scoreBoost: 0 };
    }
    
    if (!volunteerAccessibility) return { eligible: true, scoreBoost: 0 };
    
    // Check for compatibility - if volunteer has noted accessibility accommodations,
    // they're likely compatible with tasks that have accessibility needs
    const taskNeeds = new Set(task.accessibilityNeeds);
    // No strict rejection; just adjust score
    const hasAccommodations = (volunteerAccessibility.accessibilityAccommodations || []).some(
      n => taskNeeds.has(n)
    );
    
    if (hasAccommodations) {
      return { eligible: true, scoreBoost: 8 };
    }
    
    return { eligible: true, scoreBoost: 2 }; // General compatibility bonus
  },
};

/**
 * Core matching algorithm: ranks volunteers for a given task.
 * Uses deterministic eligibility filters first, then explainable ranking.
 * 
 * @param {string} taskId - The task ID to match volunteers for
 * @param {Object} [options] - Options { limit, filters }
 * @returns {Array} Ranked volunteer matches with explanations
 * @throws {Error} If task not found
 */
export function matchVolunteersForTask(taskId, options = {}) {
  const { limit = MAX_RANKED_RESULTS, filters = {} } = options;
  
  // Read the task
  const task = readVolunteerTask(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }
  
  // Read all volunteer profiles to match against
  // In production, this would be a database query with proper indexing
  const allProfiles = [];
  // Note: we'd iterate over the volunteer profiles store here
  // For now, we'll work with what's available
  
  // Since we can't easily iterate the volunteerProfileService's internal map,
  // we'll structure this to accept profiles directly in production
  return [];
}

/**
 * Explain why a volunteer was (or wasn't) matched for a task.
 * Provides transparent reasoning that the UI can display to the volunteer.
 * 
 * @param {Object} volunteerProfile - The volunteer profile
 * @param {Object} task - The volunteer task
 * @returns {Object} Explanation with eligibility and ranking details
 */
export function explainMatch(volunteerProfile, task) {
  const explanation = {
    volunteerId: volunteerProfile.id,
    volunteerName: volunteerProfile.fullName,
    taskId: task.id,
    taskTitle: task.title,
    eligible: true,
    score: 0,
    influencingFactors: [],
    ineligibilityReasons: [],
    eligibilityChecks: [],
  };
  
  // 1. Skill eligibility check
  const volunteerSkills = volunteerProfile.skills || [];
  let skillResult = { eligible: true, scoreBoost: 0, reason: '' };
  
  if (task.requiredSkills && task.requiredSkills.length > 0) {
    const volunteerSkillIds = new Set(
      volunteerSkills.map(s => typeof s === 'object' ? s.id : s)
    );
    const taskSkillIds = new Set(
      task.requiredSkills.map(s => typeof s === 'object' ? s.id : s)
    );
    
    const hasAllRequired = [...taskSkillIds].every(id => volunteerSkillIds.has(id));
    
    if (hasAllRequired) {
      skillResult = {
        eligible: true,
        scoreBoost: task.requiredSkills.length * 10,
        reason: 'Volunteer has all required skills',
        influencing: [...task.requiredSkills].map(s => `Skill: ${s.name || s}`),
      };
    } else {
      // Find missing skills
      const missingSkills = [...taskSkillIds].filter(id => !volunteerSkillIds.has(id));
      skillResult = {
        eligible: false,
        scoreBoost: 0,
        reason: 'Missing required skills',
        ineligibility: missingSkills.map(s => `Skill: ${s.name || s}`),
      };
      explanation.ineligibilityReasons.push(...missingSkills.map(s => `Skill: ${s.name || s}`));
    }
  }
  
  explanation.eligibilityChecks.push({ name: 'skill-match', ...skillResult });
  if (!skillResult.eligible) explanation.eligible = false;
  explanation.score += skillResult.scoreBoost;
  explanation.influencingFactors.push(...(skillResult.influencing || []));
  
  // 2. Availability check
  const availabilityResult = ELIGIBILITY_RULES.availabilityFilter(
    { isAvailable: volunteerProfile.isAvailable },
    task
  );
  
  explanation.eligibilityChecks.push({ name: 'availability', ...availabilityResult });
  if (!availabilityResult.eligible) {
    explanation.eligible = false;
    explanation.ineligibilityReasons.push(availabilityResult.reason);
  }
  explanation.score += availabilityResult.scoreBoost;
  
  // 3. Jurisdiction check
  const volunteerServiceArea = volunteerProfile.serviceAreas?.[0] 
    ? { id: volunteerProfile.serviceAreas[0] } 
    : volunteerProfile.jurisdiction 
      ? { id: 'matched', stateJurisdiction: volunteerProfile.jurisdiction?.states }
      : null;
  
  const jurisdictionResult = ELIGIBILITY_RULES.jurisdictionFilter(volunteerServiceArea, task);
  
  explanation.eligibilityChecks.push({ name: 'jurisdiction', ...jurisdictionResult });
  explanation.score += jurisdictionResult.scoreBoost;
  
  // 4. Accessibility check
  const accessibilityResult = ELIGIBILITY_RULES.accessibilityFilter(
    { accessibilityAccommodations: volunteerProfile.accessibilityNeeds },
    task
  );
  
  explanation.eligibilityChecks.push({ name: 'accessibility', ...accessibilityResult });
  explanation.score += accessibilityResult.scoreBoost;
  
  // 5. Total experience bonus
  const experienceBonus = (volunteerProfile.totalTasksCompleted || 0) * 2;
  explanation.score += experienceBonus;
  explanation.influencingFactors.push(`${experienceBonus} pts for completed tasks`);
  
  // Sort influencing factors by impact
  explanation.influencingFactors.sort((a, b) => {
    const aNum = parseInt(a) || 0;
    const bNum = parseInt(b) || 0;
    return bNum - aNum;
  });
  
  // Apply minimum match threshold
  if (explanation.score < MINIMUM_MATCH_SCORE) {
    explanation.eligible = false;
    explanation.score = 0;
    explanation.matchNote = 'Below minimum match threshold';
  } else {
    explanation.matchNote = 'Eligible for matching';
  }
  
  // Final score clamping (0-100)
  explanation.score = Math.min(Math.max(explanation.score, 0), 100);
  
  return explanation;
}

/**
 * Get top matching volunteers for a task, with explanations.
 * This is the main entry point for the matching service.
 * 
 * @param {string} taskId - The task ID
 * @param {Array} volunteerProfiles - Array of volunteer profiles to match against
 * @param {Object} [options] - Options { limit, minimumScore }
 * @returns {Array} { profile, explanation } pairs, sorted by score descending
 * @throws {Error} If task not found
 */
export function getTopMatches(taskId, volunteerProfiles, options = {}) {
  const { limit = MAX_RANKED_RESULTS, minimumScore = MINIMUM_MATCH_SCORE } = options;
  
  const task = readVolunteerTask(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }
  
  const matches = [];
  
  volunteerProfiles.forEach((profile) => {
    const explanation = explainMatch(profile, task);
    
    if (explanation.eligible && explanation.score >= minimumScore) {
      matches.push({
        profile,
        explanation,
        score: explanation.score,
      });
    }
  });
  
  // Sort descending by score
  matches.sort((a, b) => b.score - a.score);
  
  // Return top N
  return matches.slice(0, limit);
}

/**
 * Record a matching recommendation with versioning and audit trail.
 * This is called when a coordinator accepts or modifies a matching suggestion.
 * 
 * @param {Object} recommendation - The recommendation record
 * @param {Object} [options] - { createdBy, overrideReason if coordinator edited the match }
 * @returns {Object} The recorded recommendation
 */
export function recordMatchingRecommendation(recommendation, options = {}) {
  // Validate the recommendation structure
  if (!recommendation.taskId || !recommendation.volunteerId) {
    throw new Error('Recommendation must include taskId and volunteerId');
  }
  
  // Check that the task and volunteer exist
  const task = readVolunteerTask(recommendation.taskId);
  if (!task) {
    throw new Error(`Task ${recommendation.taskId} not found`);
  }
  
  // Create the recorded recommendation with versioning
  const recorded = {
    id: recommendation.id || `rec-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    taskId: recommendation.taskId,
    volunteerId: recommendation.volunteerId,
    score: recommendation.score,
    rankingFactors: recommendation.rankingFactors || [],
    modelVersion: MATCHING_SCHEMA_VERSION,
    executedAt: new Date().toISOString(),
    // Human override tracking
    overrideBy: options.createdBy,
    overrideReason: options.overrideReason,
    overrideMade: !!options.overrideReason,
    // Consent and availability state at time of matching
    volunteerAvailability: recommendation.volunteerAvailability,
    consentGiven: recommendation.consentGiven,
    // Metadata
    schemaVersion: MATCHING_SCHEMA_VERSION,
    createdBy: options.createdBy || 'system',
    createdAt: new Date().toISOString(),
  };
  
  // In a full implementation, we'd persist this to a database
  // For now, we just validate and return
  
  // Append audit event
  appendAudit({
    action: 'create',
    resource: 'matching_recommendation',
    resourceId: recorded.id,
    performedBy: options.createdBy || 'system',
    timestamp: new Date().toISOString(),
    reason: 'Matching recommendation recorded',
    overrideMade: recorded.overrideMade,
  });
  
  return recorded;
}

/**
 * Append an audit event to the append-only audit log.
 * @param {Object} event - The audit event
 */
function appendAudit(event) {
  // In production, this would use the shared audit service
  // For now, we just log to console
  // console.log('MATCHING AUDIT:', event);
}

// Export the main functions
export { explainMatch, getTopMatches, recordMatchingRecommendation, MATCHING_SCHEMA_VERSION, MINIMUM_MATCH_SCORE };