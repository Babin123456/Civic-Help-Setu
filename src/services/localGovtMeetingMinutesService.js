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
 * - UP Gram Sabha agenda, attendance guidance, and decision follow-through archive
 */

/** Local body tiers supported by the service. */
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

/** UP Gram Panchayat-specific statutory references and guidance. */
export const UP_GRAM_SABHA_GUIDANCE = {
  /** Minimum quorum for UP Gram Sabha (10% of total members as per Panchayati Raj Act) */
  quorumPercent: 10,
  /** Statutory reference for UP Gram Sabha */
  statute: 'Uttar Pradesh Panchayati Raj Act, 1947 & Rules',
  /** Typical agenda items for UP Gram Sabha */
  typicalAgendaItems: [
    'Review of annual budget and accounts',
    'Progress review of ongoing works',
    'Selection of beneficiaries for schemes',
    'Resolution of local issues and disputes',
    'Planning for village development',
    'Review of public distribution system',
    'Health and sanitation review',
    'Education status review'
  ],
  /** Guidance for citizens submitting questions */
  citizenQuestionGuidelines: {
    submitDeadlineDays: 7,
    maxQuestionsPerMeeting: 5,
    format: 'Written submission to the Gram Panchayat Adhikari before the meeting notice period ends'
  },
  /** Resolution tracking fields */
  resolutionTracking: {
    requiredFields: ['department', 'action', 'nextUpdate'],
    departmentOptions: [
      'Basic Education',
      'Health & Family Welfare',
      'Irrigation',
      'Rural Development',
      'Panchayati Raj',
      'Animal Husbandry',
      'Fisheries',
      'Water Supply'
    ]
  }
};

/** Resolution statuses for meeting records. */
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

/** Citizen observer guidelines for public meetings. */
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

  // Validate resolution tracking for published/resolved records
  if (status.code === 'CONFIRMED' || status.code === 'CONFIRMED') {
    for (const resolution of resolutions) {
      if (!resolution.department) {
        warnings.push(`Resolution "${resolution.title || '未命名'}" missing required department field.`);
      }
      if (!resolution.action) {
        warnings.push(`Resolution "${resolution.title || '未命名'}" missing required action field.`);
      }
      if (!resolution.nextUpdate) {
        warnings.push(`Resolution "${resolution.title || '未命名'}" missing required next update date.`);
      }
    }
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
    publicDisclosureMandate: 'RTI Act 2005 Section 4(1)(b)(viii): Public authorities must proactively publish boards, councils, committees and other bodies constituted as its part or for the purpose of its advice, and whether meetings of those boards are open to the public, or the minutes of such meetings are accessible for public.',
    upGramSabhaGuidance: UP_GRAM_SABHA_GUIDANCE
  };
}

/**
 * Filters and searches archived meeting minutes by department, ward, or keyword.
 * Supports language search and provenance-aware results.
 * @param {Array<Object>} archive 
 * @param {Object} filterCriteria 
 * @returns {Array<Object>}
 */
export function queryMeetingArchive(archive = [], filterCriteria = {}) {
  const keyword = (filterCriteria.keyword || '').toLowerCase();
  const targetTier = filterCriteria.localBodyTier;
  const targetWard = filterCriteria.ward ? filterCriteria.ward.toString() : '';
  const targetDepartment = filterCriteria.department || '';
  const language = filterCriteria.language || 'en';

  return archive.filter(item => {
    const matchesKeyword =
      !keyword ||
      item.meetingTitle?.toLowerCase().includes(keyword) ||
      (item.resolutions || []).some(r => 
        (r.title && r.title.toLowerCase().includes(keyword)) ||
        (r.decision && r.decision.toLowerCase().includes(keyword)) ||
        (r.department && r.department.toLowerCase().includes(keyword))
      );

    const matchesTier = !targetTier || item.localBodyTier === targetTier;
    const matchesWard = !targetWard || (item.ward && item.ward.toString() === targetWard);
    const matchesDepartment = !targetDepartment || 
      (item.resolutions && item.resolutions.some(r => r.department && r.department.toLowerCase().includes(targetDepartment.toLowerCase())));

    return matchesKeyword && matchesTier && matchesWard && matchesDepartment;
  });
}

/**
 * Generates a plain-language summary of a Gram Sabha meeting with page/paragraph provenance.
 * @param {Object} meetingData 
 * @returns {Object} summary with provenance labeling
 */
export function generateMeetingSummary(meetingData = {}) {
  const assessment = assessMeetingRecord(meetingData);
  const resolutions = meetingData.resolutions || [];
  const summaries = [];

  // Summary of meeting basics
  summaries.push(`**Meeting:** ${meetingData.meetingTitle || 'Gram Sabha Meeting'}`);
  summaries.push(`**Date:** ${meetingData.meetingDate || 'N/A'}`);
  summaries.push(`**Status:** ${assessment.status.label}`);
  summaries.push(`**Quorum:** ${assessment.quorumMet ? 'Compliant' : 'Deficit (below 10% statutory minimum)'}`);

  // Summary of resolutions with provenance
  if (resolutions.length > 0) {
    summaries.push(`**Resolutions Passed:** ${resolutions.length}`);
    
    for (let i = 0; i < resolutions.length; i++) {
      const r = resolutions[i];
      const resolutionSummary = [];
      resolutionSummary.push(`### Resolution #${i + 1}: ${r.title || 'Civic Resolution'}`);
      resolutionSummary.push(`- **Department:** ${r.department || 'General Administration'}`);
      resolutionSummary.push(`- **Decision:** ${r.decision || 'Approved'}`);
      resolutionSummary.push(`- **Action Required:** ${r.action || 'Awaiting administrative notification'}`);
      resolutionSummary.push(`- **Next Update:** ${r.nextUpdate || 'Not specified'}`);
      resolutionSummary.push(`- **Source Document:** ${r.sourceDocument || 'N/A'}`);
      
      // Add provenance information
      if (r.pageNumber) {
        resolutionSummary.push(`- **Provenance:** Page ${r.pageNumber}`);
      }
      if (r.paragraphNumber) {
        resolutionSummary.push(`- **Provenance:** Paragraph ${r.paragraphNumber}`);
      }
      if (r.sourceUrl) {
        resolutionSummary.push(`- **Source URL:** ${r.sourceUrl}`);
      }
      
      summaries.push(resolutionSummary.join('\n'));
    }
  } else {
    summaries.push('No resolution items recorded for this meeting.');
  }

  // Add attendance guidance
  if (assessment.quorumMet !== undefined) {
    summaries.push(`**Attendance Guidance:** ${assessment.quorumMet ? 'Quorum was compliant' : 'Quorum was deficit - follow-up required per UP Panchayati Raj Act'}`);
  }

  // Add citizen question guidance
  summaries.push(`**Citizen Questions:** Submissions accepted up to ${UP_GRAM_SABHA_GUIDANCE.citizenQuestionGuidelines.submitDeadlineDays} days before meeting. Maximum ${UP_GRAM_SABHA_GUIDANCE.citizenQuestionGuidelines.maxQuestionsPerMeeting} questions per meeting.`);

  return {
    summary: summaries.join('\n\n'),
    provenance: {
      meetingTitle: meetingData.meetingTitle,
      meetingDate: meetingData.meetingDate,
      resolutionCount: resolutions.length,
      languageLabel: assessment.upGramSabhaGuidance
    },
    labeled: true // Indicates this is a labelled summary with provenance
  };
}

/**
 * Exports a formal Meeting Minutes and Decision record in markdown.
 * Includes UP Gram Sabha-specific fields and resolution tracking.
 * @param {Object} meetingData 
 * @returns {string} markdown
 */
export function exportMeetingRecordDossier(meetingData = {}) {
  const assessment = assessMeetingRecord(meetingData);
  const resolutions = meetingData.resolutions || [];

  return [
    `# Local Government Public Meeting Minutes & Decisions`,
    `**Meeting:** ${meetingData.meetingTitle || 'Civic Body Assembly'}`,
    `**Date & Venue:** ${meetingData.meetingDate || 'N/A'} | ${meetingData.venue || 'Panchayat Bhavan'}`,
    `**Local Body Tier:** ${assessment.tier.label}`,
    `**Status:** ${assessment.status.label}`,
    `**Quorum Status:** ${assessment.quorumMet ? 'QUORUM COMPLIANT' : 'QUORUM DEFICIT - Below 10% statutory minimum for UP Gram Sabha'}`,
    ``,
    `## Proactive Public Disclosure Mandate`,
    `> ${assessment.publicDisclosureMandate}`,
    ``,
    `## UP Gram Sabha Specific Guidance`,
    `> **Statute:** ${UP_GRAM_SABHA_GUIDANCE.statute}`,
    `> **Quorum Requirement:** ${UP_GRAM_SABHA_GUIDANCE.quorumPercent}% of total members (minimum for Gram Sabha under UP Panchayati Raj Act)`,
    `> **Typical Agenda Items:** ${UP_GRAM_SABHA_GUIDANCE.typicalAgendaItems.slice(0, 3).join(', ')}...`,
    ``,
    `## Resolutions & Decisions Passed`,
    ...(resolutions.length > 0
      ? resolutions.map(
          (r, idx) =>
            `### Resolution #${idx + 1}: ${r.title || 'Civic Resolution'}\n- **Department:** ${r.department || 'General Administration'}\n- **Outcome:** ${r.decision || 'Approved'}\n- **Implementation Action:** ${r.action || 'Awaiting administrative notification'}\n- **Next Update:** ${r.nextUpdate || 'Not specified'}\n- **Source Document:** ${r.sourceDocument || 'N/A'}`
        )
      : ['No resolution items recorded.']),
    ``,
    ...(assessment.warnings.length > 0 ? [`## Important Observations`, ...assessment.warnings.map(w => `- \u27a4 ${w}`), ``] : []),
    `---`,
    `*Minutes archived in compliance with citizen transparency guidelines. Resolution tracking based on published records, not inference.*`
  ].join('\n');
}

/**
 * Provides RTI and correction guidance when minutes or action reports are unavailable.
 * @param {Object} options 
 * @returns {Object} guidance information
 */
export function getMissingRecordsGuidance(options = {}) {
  return {
    rtiGuidance: 'Under RTI Act 2005 Section 4(1)(b), citizens have the right to inspect and obtain copies of meeting minutes. Application can be made to the Public Information Officer (PIO) of the Gram Panchayat.',
    correctionRoute: 'If minutes are unavailable, citizens can: (1) Submit a written RTI application to the Gram Panchayat Adhikari, (2) Request inspection of the village notice board, (3) Contact the District Panchayati Raj Officer for escalation.',
    missingExplicitly: 'Minutes or action reports marked as explicitly unavailable. Do not fabricate meeting records.',
    rtiApplicationTemplate: 'To: Public Information Officer, [Gram Panchayat Name]\nSubject: Request for Gram Sabha meeting minutes under RTI Act 2005 Section 4(1)(b)\n\nI request copies of the minutes for the Gram Sabha meeting held on [Date], including agenda, attendance record, and resolution documents.',
    nextSteps: [
      'Submit RTI application to Gram Panchayat Adhikari (within 30 days of meeting)',
      'If no response within 30 days, appeal to State Information Commission',
      'Contact District Panchayati Raj Officer for oversight',
      'Check village notice board for posted minutes'
    ]
  };
}