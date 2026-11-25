// Volunteer Coordination and Skill-Matching Data Contracts
// ---------------------------------------------------------
// Re-exports all data model contracts for the verified civic volunteer
// coordination and skill-matching network.

export {
  VOLUNTEER_PROFILE_SCHEMA_VERSION,
  SUPPORTED_VOLUNTEER_PROFILE_SCHEMA_VERSIONS,
  validateVolunteerProfileRecord,
  validateVolunteerProfileEnvelope,
  applyVolunteerProfileDefaults,
  formatVolunteerProfileError,
  FORBIDDEN_VOLUNTEER_PROFILE_FIELDS,
} from './volunteerProfileContract.js';

export {
  SKILL_SCHEMA_VERSION,
  SUPPORTED_SKILL_SCHEMA_VERSIONS,
  validateSkillRecord,
  validateSkillEnvelope,
  applySkillDefaults,
  formatSkillError,
} from './skillContract.js';

export {
  SERVICE_AREA_SCHEMA_VERSION,
  SUPPORTED_SERVICE_AREA_SCHEMA_VERSIONS,
  validateServiceAreaRecord,
  validateServiceAreaEnvelope,
  applyServiceAreaDefaults,
  formatServiceAreaError,
} from './serviceAreaContract.js';

export {
  VOLUNTEER_TASK_SCHEMA_VERSION,
  SUPPORTED_VOLUNTEER_TASK_SCHEMA_VERSIONS,
  TASK_PUBLICATION_STATES,
  TASK_PRIORITY_LEVELS,
  validateVolunteerTaskRecord,
  validateVolunteerTaskEnvelope,
  applyVolunteerTaskDefaults,
  formatVolunteerTaskError,
} from './volunteerTaskContract.js';

export {
  TASK_APPLICATION_SCHEMA_VERSION,
  SUPPORTED_TASK_APPLICATION_SCHEMA_VERSIONS,
  APPLICATION_STATUSES,
  validateTaskApplicationRecord,
  validateTaskApplicationEnvelope,
  applyTaskApplicationDefaults,
  formatTaskApplicationError,
} from './taskApplicationContract.js';

export {
  ASSIGNMENT_SCHEMA_VERSION,
  SUPPORTED_ASSIGNMENT_SCHEMA_VERSIONS,
  ASSIGNMENT_STATUSES,
  validateAssignmentRecord,
  validateAssignmentEnvelope,
  applyAssignmentDefaults,
  formatAssignmentError,
} from './assignmentContract.js';

export {
  ATTENDANCE_EVENT_SCHEMA_VERSION,
  SUPPORTED_ATTENDANCE_EVENT_SCHEMA_VERSIONS,
  ATTENDANCE_MODES,
  ATTENDANCE_STATUSES,
  validateAttendanceEventRecord,
  validateAttendanceEventEnvelope,
  applyAttendanceEventDefaults,
  formatAttendanceEventError,
} from './attendanceEventContract.js';

export {
  CONSENT_RECORD_SCHEMA_VERSION,
  SUPPORTED_CONSENT_RECORD_SCHEMA_VERSIONS,
  CONSENT_TYPES,
  CONSENT_VALIDITY_PERIODS,
  validateConsentRecord,
  validateConsentRecordEnvelope,
  applyConsentRecordDefaults,
  formatConsentRecordError,
} from './consentRecordContract.js';