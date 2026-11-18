/**
 * Local Government Public Meeting Minutes and Decision Archive Service
 * 
 * Ingests, indexes, verifies, and surfaces public meeting minutes and resolutions
 * from local self-government institutions:
 * - Municipal Corporation / Council General Body Meetings
 * - Ward Committees & Area Sabhas (under 74th Constitutional Amendment)
 * - Gram Panchayat & Gram Sabha (under 73th Constitutional Amendment)
 * 
 * Core Features:
 * - Draft vs. Confirmed/Approved resolution state tracking
 * - Linkage to subsequent administrative orders, work tenders, and gazettes
 * - Attendance quorum verification (statutory minimum attendance requirements)
 * - Proactive disclosure indexing under RTI Act 2005 Section 4(1)(b)
 */

export const LOCAL_BODY_TIERS = {
  MUNICIPAL_CORPORATION: {
    code: 'MUNICIPAL_CORPORATION',
    label: 'Municipal Corporation General Body / Standing Committee',
    statuteRef: 'State Municipal Corporation Act',
    quorumPercent: 33
  },
  WARD_COMMITTEE: {
    code: 'WARD_COMMITTEE',
    label: 'Ward Committee / Ward Sabha',
    statuteRef: '74th Constitutional Amendment & State Municipal Rules',
    quorumPercent: 20
  },
  GRAM_PANCHAYAT: {
    code: 'GRAM_PANCHAYAT',
    label: 'Gram Panchayat Meeting / Gram Sabha',
    statuteRef: '73rd Constitutional Amendment & State Panchayati Raj Act',
    quorumPercent: 10
  }
};

export const RESOLUTION_STATUSES = {
  DRAFT: {
    code: 'DRAFT',
    label: 'Draft Minutes (Subject to confirmation in next sitting)',
    binding: false
  },
  CONFIRMED: {
    code: 'CONFIRMED',
    label: 'Confirmed / Approved Resolution (Legally operative)',
    binding: true
  },
  REFERRED_BACK: {
    code: 'REFERRED_BACK',
    label: 'Referred Back / Postponed for administrative review',
    binding: false
  },
  REJECTED: {
    code: 'REJECTED',
    label: 'Rejected / Disapproved by majority vote',
    binding: false
  }
};

export const CITIZEN_OBSERVER_GUIDELINES = {
  rights: [
    'Right to inspect approved minutes of open municipal and ward committee meetings under Section 4(1)(b) of RTI Act.',
    'Right to submit written questions or agenda suggestions 7 days prior to scheduled Ward Sabha.',
    'Right to obtain certified copies of resolutions on payment of nominal copying fees.'
  ],
  restrictions: [
    'Camera recordings subject to permission of Presiding Officer.',
    'In-camera proceedings discussing confidential vigilance matters remain restricted until conclusion.'
  ]
};

/**
 * Returns citizen inspection rules for public meetings.
 * @returns {Object}
 */
export function getCitizenObserverGuidelines() {
  return CITIZEN_OBSERVER_GUIDELINES;
}

/**
 * Validates meeting record submission and checks quorum compliance.
 * @param {Object} meetingData 
 * @returns {Object} assessment
 */
export function assessMeetingRecord(meetingData = {}) {
  const errors = [];
  const warnings = [];

  if (!meetingData.meetingTitle || meetingData.meetingTitle.trim().length < 3) {
    errors.push('Meeting title or agenda heading is required.');
  }

  if (!meetingData.meetingDate) {
    errors.push('Meeting date (YYYY-MM-DD) is required.');
  }

  const tier = LOCAL_BODY_TIERS[meetingData.localBodyTier] || LOCAL_BODY_TIERS.MUNICIPAL_CORPORATION;
  const status = RESOLUTION_STATUSES[meetingData.resolutionStatus] || RESOLUTION_STATUSES.DRAFT;

  // Quorum verification
  let quorumMet = true;
  if (meetingData.totalMembers && meetingData.presentMembers !== undefined) {
    const total = Number(meetingData.totalMembers);
    const present = Number(meetingData.presentMembers);
    if (total > 0) {
      const attendancePct = (present / total) * 100;
      if (attendancePct < tier.quorumPercent) {
        quorumMet = false;
        warnings.push(`Quorum deficit: Attendance is ${attendancePct.toFixed(1)}% which is below statutory minimum ${tier.quorumPercent}%. Resolutions passed may be challenged.`);
      }
    }
  }

  const resolutions = Array.isArray(meetingData.resolutions) ? meetingData.resolutions : [];
  if (resolutions.length === 0) {
    warnings.push('No agenda resolution items entered for this meeting record.');
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    tier,
    status,
    quorumMet,
    errors,
    warnings,
    resolutionCount: resolutions.length,
    publicDisclosureMandate: 'RTI Act 2005 Section 4(1)(b)(viii): Public authorities must proactively publish boards, councils, committees and other bodies constituted as its part or for the purpose of its advice, and whether meetings of those boards are open to the public, or the minutes of such meetings are accessible for public.'
  };
}

/**
 * Filters and searches archived meeting minutes by department, ward, or keyword.
 * @param {Array<Object>} archive 
 * @param {Object} filterCriteria 
 * @returns {Array<Object>}
 */
export function queryMeetingArchive(archive = [], filterCriteria = {}) {
  const keyword = (filterCriteria.keyword || '').toLowerCase();
  const targetTier = filterCriteria.localBodyTier;
  const targetWard = filterCriteria.ward ? filterCriteria.ward.toString() : '';

  return archive.filter(item => {
    const matchesKeyword =
      !keyword ||
      item.meetingTitle?.toLowerCase().includes(keyword) ||
      (item.resolutions || []).some(r => r.title?.toLowerCase().includes(keyword) || r.decision?.toLowerCase().includes(keyword));

    const matchesTier = !targetTier || item.localBodyTier === targetTier;
    const matchesWard = !targetWard || (item.ward && item.ward.toString() === targetWard);

    return matchesKeyword && matchesTier && matchesWard;
  });
}

/**
 * Exports a formal Meeting Minutes and Decision record in markdown.
 * @param {Object} meetingData 
 * @returns {string} markdown
 */
export function exportMeetingRecordDossier(meetingData = {}) {
  const assessment = assessMeetingRecord(meetingData);
  const resolutions = meetingData.resolutions || [];

  return [
    `# Local Government Public Meeting Minutes & Decisions`,
    `**Meeting:** ${meetingData.meetingTitle || 'Civic Body Assembly'}`,
    `**Date & Venue:** ${meetingData.meetingDate || 'N/A'} | ${meetingData.venue || 'Municipal Hall'}`,
    `**Local Body Tier:** ${assessment.tier.label}`,
    `**Status:** ${assessment.status.label}`,
    `**Quorum Status:** ${assessment.quorumMet ? 'QUORUM COMPLIANT' : 'QUORUM DEFICIT'}`,
    ``,
    `## Proactive Public Disclosure Mandate`,
    `> ${assessment.publicDisclosureMandate}`,
    ``,
    `## Resolutions & Decisions Passed`,
    ...(resolutions.length > 0
      ? resolutions.map(
          (r, idx) =>
            `### Resolution #${idx + 1}: ${r.title || 'Civic Resolution'}\n- **Department:** ${r.department || 'General Administration'}\n- **Outcome:** ${r.decision || 'Approved'}\n- **Implementation Action:** ${r.actionLink || 'Awaiting administrative notification'}`
        )
      : ['No resolution items recorded.']),
    ``,
    ...(assessment.warnings.length > 0 ? [`## Important Observations`, ...assessment.warnings.map(w => `- ⚠️ ${w}`), ``] : []),
    `---`,
    `*Minutes archived in compliance with citizen transparency guidelines.*`
  ].join('\n');
}
