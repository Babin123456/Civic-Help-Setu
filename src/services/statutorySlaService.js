import { STATUTORY_SLA_DATA } from '../data/slaEscalationData';

/**
 * Calculates business days elapsed between two dates (excluding weekends)
 */
export function calculateBusinessDays(startDate, endDate = new Date()) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  if (start > end) return 0;

  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dayOfWeek = cur.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Not Sunday (0) or Saturday (6)
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/**
 * Determines SLA status for an application based on submission date and service rules
 */
export function evaluateApplicationSla(application = {}) {
  const serviceKey = (application.serviceId || application.serviceName || 'default')
    .toLowerCase()
    .replace(/\s+/g, '-');

  const slaRule = STATUTORY_SLA_DATA[serviceKey] || STATUTORY_SLA_DATA['default'];
  const submissionDate = application.submissionDate || application.date || application.createdAt || new Date();
  const businessDaysElapsed = calculateBusinessDays(submissionDate);
  const daysRemaining = slaRule.statutoryDays - businessDaysElapsed;

  let status = 'WITHIN_SLA';
  if (daysRemaining < 0) {
    status = 'SLA_BREACHED';
  } else if (daysRemaining <= 3) {
    status = 'APPROACHING_DEADLINE';
  }

  return {
    serviceKey,
    serviceName: slaRule.serviceName,
    statutoryDays: slaRule.statutoryDays,
    businessDaysElapsed,
    daysRemaining,
    overdueDays: daysRemaining < 0 ? Math.abs(daysRemaining) : 0,
    status,
    firstAppellateAuthority: slaRule.firstAppellateAuthority,
    secondAppellateAuthority: slaRule.secondAppellateAuthority,
    actName: slaRule.actName,
    penaltyClause: slaRule.penaltyClause
  };
}

/**
 * Returns the statutory 3-tier appellate escalation hierarchy for a civic service
 */
export function getAppellateEscalationHierarchy(serviceKey = 'default') {
  const normalized = (serviceKey || 'default').toLowerCase().replace(/\s+/g, '-');
  const slaRule = STATUTORY_SLA_DATA[normalized] || STATUTORY_SLA_DATA['default'];

  return [
    {
      tier: 1,
      title: 'Designated Public Officer / Service Desk',
      authority: `${slaRule.serviceName} Designated Processing Officer`,
      jurisdiction: 'Local Municipal / Tehsil Office',
      windowDays: slaRule.statutoryDays,
      legalBasis: `${slaRule.actName} - Initial Delivery Window`,
      appealMode: 'Standard Online / In-Person Application Receipt',
      filingFee: 'Prescribed Application Fee / Free',
      description: `Original authority responsible for processing and issuing the certificate within ${slaRule.statutoryDays} working days.`
    },
    {
      tier: 2,
      title: 'First Appellate Authority (FAA)',
      authority: slaRule.firstAppellateAuthority,
      jurisdiction: 'Sub-Divisional / District Grievance Cell',
      windowDays: 30,
      legalBasis: `${slaRule.actName} - Section 15 / First Appeal`,
      appealMode: 'State e-District Portal / Form 1 Appeal via Speed Post',
      filingFee: 'Free (or ₹10 Court Fee Stamp)',
      description: `Statutory officer empowered to review departmental inaction, summon application records, and order service disposal with penalty.`
    },
    {
      tier: 3,
      title: 'Second Appellate Authority (SAA) & State Commission',
      authority: slaRule.secondAppellateAuthority,
      jurisdiction: 'Divisional / State Commission / Lokayukta',
      windowDays: 60,
      legalBasis: `${slaRule.actName} - Second Appeal & Penal Sanctions`,
      appealMode: 'State Administrative Tribunal / Right to Services Commission',
      filingFee: 'Free',
      description: `Apex appellate body with civil court powers. Can impose personal salary deductions (${slaRule.penaltyClause}) and grant direct compensation.`
    }
  ];
}

/**
 * Evaluates active tier status and next legal escalation step for an application
 */
export function evaluateEscalationLadder(application = {}) {
  const sla = evaluateApplicationSla(application);
  const ladder = getAppellateEscalationHierarchy(sla.serviceKey);

  let activeTier = 1;
  let tierStatus = 'WITHIN_TIER_1';

  if (sla.status === 'SLA_BREACHED') {
    if (sla.overdueDays >= 30) {
      activeTier = 3;
      tierStatus = 'ELIGIBLE_FOR_SECOND_APPEAL';
    } else {
      activeTier = 2;
      tierStatus = 'ELIGIBLE_FOR_FIRST_APPEAL';
    }
  }

  return {
    ...sla,
    activeTier,
    tierStatus,
    ladder
  };
}

/**
 * Generates official First Appeal Petition memorandum text under Right to Public Services Act
 */
export function generateFirstAppealNotice(application = {}, citizenName = 'Concerned Citizen') {
  const evalResult = evaluateApplicationSla(application);
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  return `FIRST APPEAL PETITION UNDER SECTION 15 OF THE ${evalResult.actName.toUpperCase()}

To,
The First Appellate Authority,
${evalResult.firstAppellateAuthority}

Subject: First Appeal against non-delivery / statutory SLA breach of '${evalResult.serviceName}' (Application ID: ${application.id || application.applicationNumber || 'N/A'}).

Sir/Madam,

1. Particulars of the Appellant:
   Name: ${citizenName}
   Application Tracking ID: ${application.id || application.applicationNumber || 'N/A'}
   Date of Original Application: ${new Date(application.submissionDate || new Date()).toLocaleDateString('en-IN')}

2. Statutory Timeline Violation:
   The notified Citizen Charter statutory limit for disposal of this service is ${evalResult.statutoryDays} working days.
   Total business days elapsed to date: ${evalResult.businessDaysElapsed} working days.
   Application is currently overdue by: ${evalResult.overdueDays} working days without any communicated justification.

3. Statutory Relief Prayed For:
   Under the provisions of the ${evalResult.actName}, I pray that the Appellate Authority may be pleased to:
   (a) Direct the Designated Officer to immediately issue the certificate / service.
   (b) Take cognizance of the statutory delay of ${evalResult.overdueDays} working days.
   (c) Award penalty / interim compensation as stipulated: "${evalResult.penaltyClause}".

Date: ${today}
Place: ________________________

Respectfully submitted,

Appellant Signature:
(${citizenName})`;
}
