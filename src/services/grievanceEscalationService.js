/**
 * Service to calculate statutory turnaround SLAs and generate grievance
 * escalation notices for delayed civic applications under the Right to Public Services Act.
 */

export const SERVICE_SLA_DAYS = {
  'income-certificate': 15,
  'caste-certificate': 21,
  'domicile-certificate': 15,
  'ration-card': 30,
  'driving-license': 14,
  'birth-certificate': 14,
  'death-certificate': 14,
  'property-tax': 7,
  'voter-id': 30,
  'trade-license': 21,
  'water-connection': 15,
  'electricity-load': 15,
};

export const DEFAULT_SLA_DAYS = 21;

/**
 * Returns the statutory SLA days for a given service key or name.
 */
export const getServiceSlaDays = (serviceIdOrName = '') => {
  if (!serviceIdOrName) return DEFAULT_SLA_DAYS;
  const normalized = String(serviceIdOrName).toLowerCase().trim().replace(/\s+/g, '-');
  for (const [key, days] of Object.entries(SERVICE_SLA_DAYS)) {
    if (normalized.includes(key)) return days;
  }
  return DEFAULT_SLA_DAYS;
};

/**
 * Calculates current statutory SLA health for a tracked application.
 *
 * @param {Object} application Tracked application record
 * @param {Date} [now=new Date()] Reference date for calculations
 * @returns {Object} SLA assessment details
 */
export const calculateSlaStatus = (application, now = new Date()) => {
  if (!application) {
    return {
      urgencyLevel: 'UNKNOWN',
      isOverdue: false,
      elapsedDays: 0,
      remainingDays: 0,
      standardSlaDays: DEFAULT_SLA_DAYS,
      percentElapsed: 0,
      statutoryAct: 'Public Service Delivery Guarantee Act',
    };
  }

  const statusStr = String(application.status || '').toLowerCase();
  const isTerminal = ['approved', 'rejected', 'completed', 'delivered'].includes(statusStr);

  const standardSlaDays = application.slaDays || getServiceSlaDays(application.serviceId || application.serviceName);

  const dateValue = application.submissionDate || application.appliedDate || application.createdAt || application.updatedAt;
  const submissionTime = dateValue ? new Date(dateValue).getTime() : now.getTime();
  const currentTime = now instanceof Date ? now.getTime() : new Date(now).getTime();

  const diffMs = Math.max(0, currentTime - submissionTime);
  const elapsedDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const remainingDays = standardSlaDays - elapsedDays;
  const percentElapsed = standardSlaDays > 0 ? Math.min(200, Math.round((elapsedDays / standardSlaDays) * 100)) : 100;

  if (isTerminal) {
    return {
      urgencyLevel: 'COMPLETED',
      isOverdue: false,
      elapsedDays,
      remainingDays: Math.max(0, remainingDays),
      standardSlaDays,
      percentElapsed,
      statutoryAct: 'Citizen Services Charter',
    };
  }

  let urgencyLevel = 'ON_TRACK';
  let isOverdue = false;

  if (remainingDays < 0) {
    urgencyLevel = 'CRITICAL_BREACH';
    isOverdue = true;
  } else if (remainingDays <= 3) {
    urgencyLevel = 'IMMINENT_DEADLINE';
  } else if (percentElapsed >= 75) {
    urgencyLevel = 'APPROACHING_DEADLINE';
  }

  return {
    urgencyLevel,
    isOverdue,
    elapsedDays,
    remainingDays,
    overdueDays: remainingDays < 0 ? Math.abs(remainingDays) : 0,
    standardSlaDays,
    percentElapsed,
    statutoryAct: 'Right to Public Services Act (RTSA)',
  };
};

/**
 * Returns recommended appellate escalation portal and authority.
 */
export const getRecommendedEscalationChannel = (serviceName = '') => {
  const norm = String(serviceName).toLowerCase();
  if (norm.includes('passport') || norm.includes('central') || norm.includes('aadhaar')) {
    return {
      authority: 'First Appellate Authority (Central CPGRAMS)',
      portalName: 'CPGRAMS Citizen Portal',
      url: 'https://pgportal.gov.in',
      statutoryRule: 'Section 19(1) of RTI & Central Citizen Charter',
    };
  }
  return {
    authority: 'First Appellate Authority / Sub-Divisional Officer (SDO)',
    portalName: 'State Right to Services (RTS) Redressal Portal',
    url: 'https://pgportal.gov.in',
    statutoryRule: 'Section 6 of State Right to Public Services Act',
  };
};

/**
 * Formats a formal statutory grievance escalation letter for citizens to file or email.
 */
export const generateEscalationNoticeDraft = (application, options = {}) => {
  const { citizenName = 'Applicant Citizen', contactPhone = 'Registered Mobile' } = options;
  const sla = calculateSlaStatus(application);
  const channel = getRecommendedEscalationChannel(application?.serviceName);

  const refId = application?.id || application?.referenceNumber || '[Application Reference ID]';
  const service = application?.serviceName || 'Public Civic Service';
  const overdueNote = sla.isOverdue
    ? `The statutory turnaround time of ${sla.standardSlaDays} days has lapsed by ${sla.overdueDays} days without disposal or written reason.`
    : `The application has reached ${sla.elapsedDays} of ${sla.standardSlaDays} permitted days (${sla.remainingDays} days remaining).`;

  return `TO:
The First Appellate Authority / Grievance Redressal Officer,
Department of Public Service Delivery.

SUBJECT: Statutory Notice of Escalation — Delayed Service Delivery for Reference #${refId} under the Right to Public Services Act

RESPECTED SIR / MADAM,

I am writing to formally submit an escalation regarding my pending public service application:

1. Application Reference ID: ${refId}
2. Service Requested: ${service}
3. Statutory Timeline (Citizen's Charter): ${sla.standardSlaDays} Business Days
4. Elapsed Days Since Filing: ${sla.elapsedDays} Days
5. Current Status: ${sla.urgencyLevel} (${overdueNote})

LEGAL PROVISION & GROUNDS FOR ESCALATION:
Under the provisions of the ${sla.statutoryAct} and relevant State Citizen Guarantee Legislations, designated public authorities are mandated to either deliver the service or issue a reasoned order within the prescribed time limit. Default without reasonable cause attracts statutory review and administrative liability.

RELIEF REQUESTED:
1. Urgent processing and disposal of Application Reference #${refId}.
2. Immediate communication of any pending departmental verification steps.
3. In case of further delay, confirmation of the designated First Appeal hearing schedule before ${channel.authority}.

Yours sincerely,
${citizenName}
Contact: ${contactPhone}
Date: ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
Application Tracked via Civic Help Setu`;
};
