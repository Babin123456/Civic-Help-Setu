// Fine-Grained Consent Policy Engine Services
// -------------------------------------------
// Purpose-limited data sharing consent management and boundary enforcement.

export {
  createFineGrainedConsentEngine,
  fineGrainedConsentEngine,
  FG_CONSENT_FIXTURES,
  FG_ACTIVE_GRANTS,
  FG_PURPOSE_REGISTRY,
  FGConsentGrant,
  FGPolicyRule,
  FGConsentPolicy,
} from './fineGrainedConsentPolicyEngine.js';

// Volunteer Coordination and Skill-Matching Services
// --------------------------------------------------
// Re-exports all services for the verified civic volunteer coordination
// and skill-matching network.

export {
  createVolunteerProfile,
  readVolunteerProfile,
  updateVolunteerProfile,
  deleteVolunteerProfile,
  listVolunteerProfiles,
  getAuditLog as getVolunteerProfileAuditLog,
  volunteerProfiles,
  auditLog as volunteerProfileAuditLog,
} from './volunteerProfileService.js';

export {
  createSkill,
  readSkill,
  updateSkill,
  deleteSkill,
  listSkills,
  searchSkills,
} from './skillService.js';

export {
  createVolunteerTask,
  readVolunteerTask,
  updateVolunteerTask,
  deleteVolunteerTask,
  listVolunteerTasks,
  getAuditLog as getTaskAuditLog,
  taskPosts,
  auditLog as taskAuditLog,
} from './volunteerTaskService.js';

export {
  createTaskApplication,
  readTaskApplication,
  updateTaskApplicationStatus,
  withdrawTaskApplication,
  listTaskApplications,
  getAuditLog as getApplicationAuditLog,
  taskApplications,
  auditLog as applicationAuditLog,
} from './taskApplicationService.js';

export {
  createAssignment,
  readAssignment,
  updateAssignment,
  cancelAssignment,
  listAssignments,
  getAuditLog as getAssignmentAuditLog,
  assignments,
  auditLog as assignmentAuditLog,
} from './assignmentService.js';

export {
  explainMatch,
  getTopMatches,
  recordMatchingRecommendation,
  MATCHING_SCHEMA_VERSION,
  MINIMUM_MATCH_SCORE,
} from './matchingService.js';