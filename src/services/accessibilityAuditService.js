/**
 * Measured Accessibility Audits & Remediation Planning Service (#948)
 *
 * Implements structured facility measurements against the 2021 Harmonised Guidelines
 * and Standards for Universal Accessibility in India & RPwD Act 2016.
 *
 * Key guarantees:
 * - Validates numerical measurements and units.
 * - Distinguishes unmeasured/unknown inputs from non-compliant failures.
 * - Shows statutory benchmark sources and applicability caveats.
 * - Generates time-bound remediation plans with target dates and priorities.
 * - Preserves immutable reassessment history across multiple audit rounds.
 * - Prominently displays the preliminary screening notice (not a certified audit).
 */

// Legacy screening checks preserved for backward compatibility
export const CHECKS = [
  { key: 'ramp', label: 'Ramp slope no steeper than 1:12', critical: true },
  { key: 'rails', label: 'Handrails at both 760 mm and 900 mm', critical: true },
  { key: 'door', label: 'Doorway clearance at least 900 mm', critical: true },
  { key: 'tactile', label: 'Tactile ground surface indicators', critical: false },
  { key: 'washroom', label: 'Washroom at least 2200 × 2000 mm with grab rails', critical: false },
  { key: 'lift', label: 'Lift has auditory and Braille indicators, if applicable', critical: false },
];

export const PRELIMINARY_SCREENING_DISCLAIMER =
  'Preliminary Screening Notice: This accessibility assessment and measured screening report is conducted against selected Harmonised Guidelines (2021) benchmarks. It is intended for civic monitoring, barrier documentation, and voluntary remediation planning. It does NOT constitute a certified architectural audit, statutory accessibility clearance, or judicial finding under the RPwD Act, 2016.';

/**
 * Structured measurement benchmarks under the Harmonised Guidelines 2021
 */
export const MEASURED_BENCHMARKS = [
  {
    key: 'ramp_slope',
    label: 'Ramp Slope Gradient',
    facility: 'Ramps & Approach',
    metric: 'Slope Ratio (1:X)',
    unit: 'ratio',
    benchmarkValue: 12,
    operator: '>=',
    benchmarkDisplay: '1:12 or gentler (denominator ≥ 12)',
    critical: true,
    source: 'Harmonised Guidelines 2021, Sec 4.2.2',
    caveat: 'Gradients up to 1:10 allowed only for short kerb ramps with rise ≤ 150 mm.',
    remediationHint: 'Re-grade ramp or construct switchback landings to achieve 1:12 maximum slope.',
  },
  {
    key: 'ramp_width',
    label: 'Ramp Clear Width',
    facility: 'Ramps & Approach',
    metric: 'Clear Width',
    unit: 'mm',
    benchmarkValue: 1200,
    operator: '>=',
    benchmarkDisplay: '≥ 1200 mm',
    critical: true,
    source: 'Harmonised Guidelines 2021, Sec 4.2.1',
    caveat: '1800 mm recommended for two-way wheelchair passing bays.',
    remediationHint: 'Clear walkway obstructions and widen ramp runway to at least 1200 mm.',
  },
  {
    key: 'handrail_lower',
    label: 'Lower Handrail Height',
    facility: 'Handrails & Stairs',
    metric: 'Height above floor',
    unit: 'mm',
    benchmarkMin: 700,
    benchmarkMax: 800
,
    benchmarkDisplay: '700–800 mm (standard 760 mm)',
    critical: true,
    source: 'Harmonised Guidelines 2021, Sec 4.2.3',
    caveat: 'Continuous profile required for children and short-statured persons.',
    remediationHint: 'Install secondary parallel handrail at 760 mm above finished floor.',
  },
  {
    key: 'handrail_upper',
    label: 'Upper Handrail Height',
    facility: 'Handrails & Stairs',
    metric: 'Height above floor',
    unit: 'mm',
    benchmarkMin: 850,
    benchmarkMax: 950,
    benchmarkDisplay: '850–950 mm (standard 900 mm)',
    critical: true,
    source: 'Harmonised Guidelines 2021, Sec 4.2.3',
    caveat: 'Must extend 300 mm horizontally beyond top and bottom risers.',
    remediationHint: 'Adjust mounting brackets to position main handrail at 900 mm height.',
  },
  {
    key: 'door_clear_width',
    label: 'Doorway Clear Opening Width',
    facility: 'Entrances & Doors',
    metric: 'Clear width open at 90°',
    unit: 'mm',
    benchmarkValue: 900,
    operator: '>=',
    benchmarkDisplay: '≥ 900 mm',
    critical: true,
    source: 'Harmonised Guidelines 2021, Sec 4.3.1',
    caveat: 'Measured between face of open leaf at 90° and opposite door rebate.',
    remediationHint: 'Replace narrow door leaf with 900 mm+ leaf or install sliding door.',
  },
  {
    key: 'door_threshold',
    label: 'Door Threshold Raised Height',
    facility: 'Entrances & Doors',
    metric: 'Sill height at floor',
    unit: 'mm',
    benchmarkValue: 12,
    operator: '<=',
    benchmarkDisplay: '≤ 12 mm',
    critical: false,
    source: 'Harmonised Guidelines 2021, Sec 4.3.2',
    caveat: 'Thresholds > 6 mm must be chamfered with slope ≤ 1:2.',
    remediationHint: 'Grind down raised sill or fit beveled transition strip.',
  },
  {
    key: 'washroom_width',
    label: 'Accessible Washroom Clear Width',
    facility: 'Sanitary Facilities',
    metric: 'Internal clear room width',
    unit: 'mm',
    benchmarkValue: 2000,
    operator: '>=',
    benchmarkDisplay: '≥ 2000 mm',
    critical: false,
    source: 'Harmonised Guidelines 2021, Sec 5.1',
    caveat: 'Must accommodate internal 1500 mm wheelchair turning circle.',
    remediationHint: 'Reconfigure layout or partition walls to provide at least 2000 mm clear width.',
  },
  {
    key: 'washroom_depth',
    label: 'Accessible Washroom Clear Depth',
    facility: 'Sanitary Facilities',
    metric: 'Internal clear room length',
    unit: 'mm',
    benchmarkValue: 2200,
    operator: '>=',
    benchmarkDisplay: '≥ 2200 mm',
    critical: false,
    source: 'Harmonised Guidelines 2021, Sec 5.1',
    caveat: 'Door must swing outward or slide to prevent obstruction during medical emergencies.',
    remediationHint: 'Extend cubicle depth or convert inward-opening door to outward-swinging.',
  },
  {
    key: 'washroom_grab_rail',
    label: 'Washroom Grab Rail Height',
    facility: 'Sanitary Facilities',
    metric: 'Height above floor',
    unit: 'mm',
    benchmarkMin: 750,
    benchmarkMax: 850,
    benchmarkDisplay: '750–850 mm',
    critical: false,
    source: 'Harmonised Guidelines 2021, Sec 5.1.4',
    caveat: 'Requires fixed L-rail on side wall and hinged drop-down rail on transfer side.',
    remediationHint: 'Mount heavy-duty stainless steel grab rails at 800 mm height.',
  },
  {
    key: 'tactile_indicator_width',
    label: 'Tactile Warning Indicator Band',
    facility: 'Signage & Tactile',
    metric: 'Warning paver band width',
    unit: 'mm',
    benchmarkValue: 300,
    operator: '>=',
    benchmarkDisplay: '≥ 300 mm',
    critical: false,
    source: 'Harmonised Guidelines 2021, Sec 4.8',
    caveat: 'Install warning pavers 300 mm before flight of stairs or level drops.',
    remediationHint: 'Lay 300 mm wide contrasting blister tactile pavers across approach path.',
  },
  {
    key: 'lift_car_width',
    label: 'Lift Car Internal Width',
    facility: 'Elevators & Lifts',
    metric: 'Internal car clear width',
    unit: 'mm',
    benchmarkValue: 1100,
    operator: '>=',
    benchmarkDisplay: '≥ 1100 mm',
    critical: false,
    source: 'Harmonised Guidelines 2021, Sec 4.5.1',
    caveat: 'Car depth must also be ≥ 1400 mm for standard wheelchair accommodation.',
    remediationHint: 'Designate and upgrade accessible elevator car with wider cabin dimensions.',
  },
  {
    key: 'lift_control_height',
    label: 'Lift Control Button Height',
    facility: 'Elevators & Lifts',
    metric: 'Centerline button height',
    unit: 'mm',
    benchmarkMin: 900,
    benchmarkMax: 1000,
    benchmarkDisplay: '900–1000 mm',
    critical: false,
    source: 'Harmonised Guidelines 2021, Sec 4.5.4',
    caveat: 'Buttons must feature embossed tactile Braille numerals and audible chime.',
    remediationHint: 'Install horizontal auxiliary car operating panel at 950 mm height.',
  },
];

/**
 * Evaluates legacy yes/no answers for backwards compatibility.
 */
export function evaluateAudit(answers = {}) {
  const assessed = CHECKS.filter(c => answers[c.key] === 'yes' || answers[c.key] === 'no');
  const passed = assessed.filter(c => answers[c.key] === 'yes').length;
  return {
    score: assessed.length ? Math.round((passed * 100) / assessed.length) : null,
    assessed: assessed.length,
    hazards: CHECKS.filter(c => c.critical && answers[c.key] === 'no').map(c => c.label),
    failures: CHECKS.filter(c => answers[c.key] === 'no').map(c => c.label),
  };
}

/**
 * Validates and evaluates a single numerical measurement against its benchmark.
 * Distinguishes unmeasured/unknown inputs from non-compliant failures.
 *
 * @param {Object} benchmark
 * @param {string|number} rawValue
 * @returns {Object} Evaluation outcome
 */
export function evaluateMeasurement(benchmark, rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === '' || rawValue === 'unknown') {
    return {
      key: benchmark.key,
      facility: benchmark.facility,
      label: benchmark.label,
      status: 'UNKNOWN',
      isCompliant: null,
      value: null,
      gap: null,
      unit: benchmark.unit,
      benchmarkDisplay: benchmark.benchmarkDisplay,
      source: benchmark.source,
      caveat: benchmark.caveat,
      remediationHint: benchmark.remediationHint,
      critical: benchmark.critical,
      message: 'Measurement not recorded / unassessed',
    };
  }

  if (rawValue === 'na' || rawValue === 'NA') {
    return {
      key: benchmark.key,
      facility: benchmark.facility,
      label: benchmark.label,
      status: 'NOT_APPLICABLE',
      isCompliant: null,
      value: null,
      gap: null,
      unit: benchmark.unit,
      benchmarkDisplay: benchmark.benchmarkDisplay,
      source: benchmark.source,
      caveat: benchmark.caveat,
      remediationHint: benchmark.remediationHint,
      critical: benchmark.critical,
      message: 'Feature not applicable to this facility',
    };
  }

  const num = Number(rawValue);
  if (!Number.isFinite(num) || num < 0) {
    return {
      key: benchmark.key,
      facility: benchmark.facility,
      label: benchmark.label,
      status: 'INVALID',
      isCompliant: false,
      value: null,
      gap: null,
      unit: benchmark.unit,
      benchmarkDisplay: benchmark.benchmarkDisplay,
      source: benchmark.source,
      caveat: benchmark.caveat,
      remediationHint: benchmark.remediationHint,
      critical: benchmark.critical,
      message: 'Invalid numerical measurement entered',
    };
  }

  let isCompliant = false;
  let gap = 0;

  if (benchmark.operator === '>=') {
    isCompliant = num >= benchmark.benchmarkValue;
    gap = isCompliant ? 0 : benchmark.benchmarkValue - num;
  } else if (benchmark.operator === '<=') {
    isCompliant = num <= benchmark.benchmarkValue;
    gap = isCompliant ? 0 : num - benchmark.benchmarkValue;
  } else if (benchmark.benchmarkMin !== undefined && benchmark.benchmarkMax !== undefined) {
    isCompliant = num >= benchmark.benchmarkMin && num <= benchmark.benchmarkMax;
    if (num < benchmark.benchmarkMin) {
      gap = benchmark.benchmarkMin - num;
    } else if (num > benchmark.benchmarkMax) {
      gap = num - benchmark.benchmarkMax;
    } else {
      gap = 0;
    }
  }

  const roundedGap = Math.round(gap * 10) / 10;
  return {
    key: benchmark.key,
    facility: benchmark.facility,
    label: benchmark.label,
    status: isCompliant ? 'COMPLIANT' : 'NON_COMPLIANT',
    isCompliant,
    value: num,
    gap: roundedGap,
    unit: benchmark.unit,
    benchmarkDisplay: benchmark.benchmarkDisplay,
    source: benchmark.source,
    caveat: benchmark.caveat,
    remediationHint: benchmark.remediationHint,
    critical: benchmark.critical,
    message: isCompliant
      ? `Complies with benchmark (${benchmark.benchmarkDisplay})`
      : `Non-compliant by ${roundedGap} ${benchmark.unit} (Benchmark: ${benchmark.benchmarkDisplay})`,
  };
}

/**
 * Evaluates all structured measurements and legacy answers for a facility.
 *
 * @param {Object} measurements Map of benchmark keys to numbers or 'unknown'/'na'
 * @param {Object} [answers={}] Legacy checklist answers
 * @returns {Object} Comprehensive evaluation summary
 */
export function evaluateMeasuredAudit(measurements = {}, answers = {}) {
  const evaluatedItems = MEASURED_BENCHMARKS.map(b => evaluateMeasurement(b, measurements[b.key]));

  const assessed = evaluatedItems.filter(item => item.status === 'COMPLIANT' || item.status === 'NON_COMPLIANT');
  const compliant = evaluatedItems.filter(item => item.status === 'COMPLIANT');
  const nonCompliant = evaluatedItems.filter(item => item.status === 'NON_COMPLIANT');
  const unknown = evaluatedItems.filter(item => item.status === 'UNKNOWN' || item.status === 'INVALID');
  const notApplicable = evaluatedItems.filter(item => item.status === 'NOT_APPLICABLE');

  const criticalHazards = nonCompliant.filter(item => item.critical);

  const score = assessed.length ? Math.round((compliant.length * 100) / assessed.length) : null;

  return {
    score,
    totalBenchmarks: MEASURED_BENCHMARKS.length,
    assessedCount: assessed.length,
    compliantCount: compliant.length,
    nonCompliantCount: nonCompliant.length,
    unknownCount: unknown.length,
    notApplicableCount: notApplicable.length,
    criticalHazards,
    items: evaluatedItems,
    legacyAudit: evaluateAudit(answers),
  };
}

/**
 * Generates a prioritized, time-bound remediation plan from non-compliant audit findings.
 *
 * @param {Object} evaluatedAudit Outcome from evaluateMeasuredAudit
 * @param {Object} [options={}] Custom responsible party or days override
 * @returns {Array<Object>} Remediation action items
 */
export function generateRemediationPlan(evaluatedAudit, options = {}) {
  if (!evaluatedAudit || !Array.isArray(evaluatedAudit.items)) return [];

  const nonCompliantItems = evaluatedAudit.items.filter(item => item.status === 'NON_COMPLIANT');

  const plan = nonCompliantItems.map(item => {
    const targetDays = item.critical ? 30 : 60;
    const targetDate = new Date(Date.now() + targetDays * 86400000).toISOString().split('T')[0];

    return {
      id: item.key,
      key: item.key,
      facility: item.facility,
      label: item.label,
      measuredValue: item.value,
      unit: item.unit,
      benchmarkDisplay: item.benchmarkDisplay,
      gap: item.gap,
      critical: item.critical,
      priority: item.critical ? 'CRITICAL' : 'HIGH',
      recommendedAction: item.remediationHint,
      targetDays,
      targetDate,
      responsibleParty: options.responsibleParty || 'Facility In-Charge / Engineering Division',
      status: 'IDENTIFIED', // 'IDENTIFIED' | 'PLANNED' | 'IN_PROGRESS' | 'REMEDIATED' | 'VERIFIED'
      notes: '',
    };
  });

  // Sort CRITICAL first, then HIGH
  return plan.sort((a, b) => {
    if (a.critical && !b.critical) return -1;
    if (!a.critical && b.critical) return 1;
    return a.label.localeCompare(b.label);
  });
}

/**
 * Adds a new reassessment record to preserve audit history across time.
 * Tracks which barriers were resolved and which remain non-compliant.
 *
 * @param {Object} existingRecord The saved audit record
 * @param {Object} reassessmentData New measurements, answers, notes
 * @returns {Object} Updated record with appended reassessment
 */
export function addReassessmentRecord(existingRecord, { reassessedMeasurements = {}, reassessedAnswers = {}, assessorNotes = '' }) {
  if (!existingRecord || typeof existingRecord !== 'object') {
    throw new Error('Invalid existing audit record');
  }

  const previousMeasurements = existingRecord.measurements || {};
  const prevEval = evaluateMeasuredAudit(previousMeasurements, existingRecord.answers || {});
  const nextEval = evaluateMeasuredAudit(reassessedMeasurements, reassessedAnswers);

  const prevFailedKeys = new Set(prevEval.items.filter(i => i.status === 'NON_COMPLIANT').map(i => i.key));
  const nextCompliantKeys = new Set(nextEval.items.filter(i => i.status === 'COMPLIANT').map(i => i.key));

  const resolvedBarriers = Array.from(prevFailedKeys)
    .filter(k => nextCompliantKeys.has(k))
    .map(k => {
      const benchmark = MEASURED_BENCHMARKS.find(b => b.key === k);
      return benchmark ? benchmark.label : k;
    });

  const unresolvedBarriers = nextEval.items
    .filter(i => i.status === 'NON_COMPLIANT')
    .map(i => i.label);

  const entry = {
    reassessmentId: `reassess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    reassessedAt: new Date().toISOString(),
    assessorNotes: String(assessorNotes || '').slice(0, 500),
    measurements: reassessedMeasurements,
    evaluation: {
      score: nextEval.score,
      compliantCount: nextEval.compliantCount,
      nonCompliantCount: nextEval.nonCompliantCount,
      criticalHazardsCount: nextEval.criticalHazards.length,
    },
    resolvedBarriers,
    unresolvedBarriers,
  };

  const existingHistory = Array.isArray(existingRecord.reassessments) ? existingRecord.reassessments : [];

  return {
    ...existingRecord,
    updatedAt: new Date().toISOString(),
    measurements: reassessedMeasurements,
    answers: reassessedAnswers,
    reassessments: [...existingHistory, entry],
  };
}

/**
 * Generates an accessible, printable Markdown report for public distribution or Commissioner submission.
 */
export function generatePrintableRemediationReport(auditRecord, evaluatedAudit, remediationPlan = []) {
  const facility = auditRecord.facilityName || 'Public Facility';
  const district = auditRecord.district || 'Unspecified District';
  const scoreText = evaluatedAudit.score !== null ? `${evaluatedAudit.score}%` : 'Incomplete (Score unavailable)';

  const lines = [
    `# Universal Accessibility Screening & Remediation Report`,
    `**Facility Name:** ${facility}`,
    `**Location / District:** ${district}`,
    `**Audit Timestamp:** ${auditRecord.createdAt || new Date().toISOString()}`,
    `**Screening Score:** ${scoreText} (${evaluatedAudit.compliantCount} of ${evaluatedAudit.assessedCount} assessed benchmarks met)`,
    '',
    `> **Statutory Caveat:** ${PRELIMINARY_SCREENING_DISCLAIMER}`,
    '',
    '## 1. Measured Benchmarks Matrix (Harmonised Guidelines 2021)',
    '',
    '| Facility / Element | Check & Metric | Measured Value | Standard Benchmark | Gap | Status | Statutory Source |',
    '|---|---|---|---|---|---|---|',
  ];

  evaluatedAudit.items.forEach(item => {
    const valText = item.value !== null ? `${item.value} ${item.unit}` : item.status;
    const gapText = item.gap !== null && item.gap > 0 ? `${item.gap} ${item.unit}` : '-';
    lines.push(
      `| ${item.facility} | ${item.label} | ${valText} | ${item.benchmarkDisplay} | ${gapText} | **${item.status}** | ${item.source} |`
    );
  });

  lines.push('', '## 2. Priority Remediation Action Plan', '');
  if (!remediationPlan.length) {
    lines.push('No non-compliant barriers currently identified under assessed benchmarks.');
  } else {
    lines.push(
      '| Priority | Facility Barrier | Measurement Gap | Corrective Action | Target Date | Responsible Party | Status |',
      '|---|---|---|---|---|---|---|'
    );
    remediationPlan.forEach(plan => {
      lines.push(
        `| **${plan.priority}** | ${plan.label} | ${plan.gap} ${plan.unit} | ${plan.recommendedAction} | ${plan.targetDate} | ${plan.responsibleParty} | ${plan.status} |`
      );
    });
  }

  if (Array.isArray(auditRecord.reassessments) && auditRecord.reassessments.length > 0) {
    lines.push('', '## 3. Reassessment & Progress History', '');
    auditRecord.reassessments.forEach((r, idx) => {
      lines.push(`### Round ${idx + 1} — ${new Date(r.reassessedAt).toLocaleDateString()}`);
      lines.push(`- **Score:** ${r.evaluation.score !== null ? `${r.evaluation.score}%` : 'N/A'}`);
      lines.push(`- **Resolved Barriers:** ${r.resolvedBarriers.length ? r.resolvedBarriers.join(', ') : 'None'}`);
      lines.push(`- **Remaining Barriers:** ${r.unresolvedBarriers.length ? r.unresolvedBarriers.join(', ') : 'None'}`);
      if (r.assessorNotes) lines.push(`- **Notes:** ${r.assessorNotes}`);
      lines.push('');
    });
  }

  lines.push('', '---', '*Report prepared via CivicBridge Accessibility Module under RPwD Act 2016 civic screening framework.*');
  return lines.join('\n');
}

/**
 * Section 89 penalty guidance (backward compatible).
 */
export function estimatePenalty(offence) {
  if (offence === 'first') return 'Up to ₹10,000 for a first contravention, subject to Section 89 and adjudication.';
  if (offence === 'subsequent') return '₹50,000 to ₹5,00,000 for a subsequent contravention, subject to Section 89 and adjudication.';
  return 'Select a contravention history. Penalties are not automatic; subsequent contravention is not the same as each day of continuing failure.';
}

/**
 * Drafts formal representation to Commissioner for Persons with Disabilities (backward compatible).
 */
export function draftAccessibilityPetition({ authority, facility, district, facts, audit }) {
  const failedList = audit.failures && audit.failures.length ? audit.failures.join('; ') : '[describe specific barriers]';
  return `To: ${authority === 'chief' ? 'Chief Commissioner' : 'State Commissioner'} for Persons with Disabilities\n\nSubject: Request for inquiry into accessibility barriers under the Rights of Persons with Disabilities Act, 2016\n\nFacility: ${facility || '[facility name]'}\nDistrict and State: ${district || '[district and state]'}\nDescription and dates: ${facts || '[describe barriers and dates]'}\n\nReported failed checks: ${failedList}\n\nI request an inquiry and on-site accessibility inspection, a time-bound plan to remedy identified barriers, and appropriate action under the Act. Please consider Sections 75 and 80 as applicable to the chosen authority, and Section 89 where warranted.\n\n[Add evidence, prior correspondence, contact details, date and signature. Verify applicable law, jurisdiction and standards before filing.]`;
}
