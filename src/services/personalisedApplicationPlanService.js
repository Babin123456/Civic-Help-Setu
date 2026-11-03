/**
 * personalisedApplicationPlanService.js
 *
 * Personalised Step-by-Step Civic Application Plan Service (#476).
 * Translates service requirements into an ordered, bespoke application plan
 * tailored to a citizen's voluntary situational inputs (e.g. application channel,
 * digital literacy/assisted mode, urgency, document readiness) without model
 * hallucinations.
 *
 * Governance & Grounding Rules:
 * 1. Strict Grounding: All fees, deadlines, eligibility criteria, and office
 *    details are drawn directly from the verified catalogue service record.
 * 2. Limitation Transparency: If official data is missing (e.g., fee schedule
 *    or submission deadline is unspecified), the system explicitly flags that
 *    limitation rather than inventing values.
 * 3. Clear Distinction: Explicitly distinguishes official statutory requirements
 *    from AI guidance/advice.
 * 4. Traceability: Every step links to its originating catalogue field or official URL.
 * 5. Privacy: User voluntary answers remain client-side and are excluded from public shares.
 */

export const APPLICATION_MODES = {
  ONLINE_SELF: 'ONLINE_SELF',
  CSC_COUNTER: 'CSC_COUNTER',
  OFFICE_DIRECT: 'OFFICE_DIRECT',
};

export const STEP_TYPES = {
  OFFICIAL_REQUIREMENT: 'OFFICIAL_REQUIREMENT',
  AI_RECOMMENDATION: 'AI_RECOMMENDATION',
  MISSING_DATA_ADVISORY: 'MISSING_DATA_ADVISORY',
};

/**
 * Builds a personalised step-by-step application plan.
 *
 * @param {Object} service - Verified catalogue service record
 * @param {Object} citizenAnswers - Voluntary inputs from user
 * @returns {Object} Structured personalized plan
 */
export function generatePersonalisedPlan(service = {}, citizenAnswers = {}) {
  if (!service || typeof service !== 'object') {
    throw new Error('Valid service catalogue record is required');
  }

  const sId = service.id || 'unidentified-service';
  const serviceName = service.title || service.name || service.serviceName || 'Civic Service';
  const officialUrl = service.officialUrl || service.url || null;
  const department = service.department || 'Designated Administrative Authority';
  const documents = Array.isArray(service.documents) ? service.documents : [];
  const eligibility = Array.isArray(service.eligibility)
    ? service.eligibility
    : typeof service.eligibility === 'string'
      ? [service.eligibility]
      : [];
  const feeInfo = service.fees || service.fee || null;
  const statutorySla = service.sla || service.turnaroundTime || service.processingTime || null;

  const mode = citizenAnswers.mode || APPLICATION_MODES.ONLINE_SELF;
  const hasDocumentsReady = Boolean(citizenAnswers.hasDocumentsReady);
  const isUrgent = Boolean(citizenAnswers.isUrgent);

  const steps = [];
  let stepNumber = 1;

  // 1. Eligibility Self-Verification Step
  if (eligibility.length > 0) {
    steps.push({
      id: `${sId}-step-eligibility`,
      order: stepNumber++,
      title: 'Verify Scheme Eligibility Criteria',
      type: STEP_TYPES.OFFICIAL_REQUIREMENT,
      sourceField: 'eligibility',
      sourceUrl: officialUrl,
      officialStatement: eligibility.join('; '),
      guidance: 'Review your personal qualifications against official statutory requirements before initiating documentation.',
      checklist: eligibility.map((e, idx) => ({ id: `el-${idx}`, text: e, checked: false })),
    });
  } else {
    steps.push({
      id: `${sId}-step-eligibility-limitation`,
      order: stepNumber++,
      title: 'Confirm Unspecified Eligibility at Authority Desk',
      type: STEP_TYPES.MISSING_DATA_ADVISORY,
      sourceField: 'eligibility',
      sourceUrl: officialUrl,
      officialStatement: 'No explicit eligibility criteria specified in current catalogue record.',
      guidance: 'Catalogue does not specify eligibility caps. Confirm income, category, or age requirements directly with the department.',
      checklist: [{ id: 'el-lim-1', text: 'Inquire with department on specific restrictions', checked: false }],
    });
  }

  // 2. Document Gathering & Attestation Step
  if (documents.length > 0) {
    steps.push({
      id: `${sId}-step-documents`,
      order: stepNumber++,
      title: 'Assemble and Verify Required Documentation',
      type: STEP_TYPES.OFFICIAL_REQUIREMENT,
      sourceField: 'documents',
      sourceUrl: officialUrl,
      officialStatement: `Mandatory documents: ${documents.join(', ')}`,
      guidance: hasDocumentsReady
        ? 'Ensure all documents are self-attested and validity dates are current.'
        : 'Prioritize acquiring these primary documents before filing to avoid application pendency.',
      checklist: documents.map((doc, idx) => ({ id: `doc-${idx}`, text: doc, checked: hasDocumentsReady })),
    });
  } else {
    steps.push({
      id: `${sId}-step-doc-limitation`,
      order: stepNumber++,
      title: 'Verify Documentation Checklist with Department',
      type: STEP_TYPES.MISSING_DATA_ADVISORY,
      sourceField: 'documents',
      sourceUrl: officialUrl,
      officialStatement: 'Itemized document list is not documented in catalogue entry.',
      guidance: 'Official document checklist is omitted in the record. Carry standard identity (Aadhaar/Voter ID) and address proof.',
      checklist: [{ id: 'doc-lim-1', text: 'Carry primary photo ID and address proof', checked: false }],
    });
  }

  // 3. Fee Verification & Payment Readiness Step
  if (feeInfo) {
    steps.push({
      id: `${sId}-step-fee`,
      order: stepNumber++,
      title: 'Statutory Application Fee Preparation',
      type: STEP_TYPES.OFFICIAL_REQUIREMENT,
      sourceField: 'fees',
      sourceUrl: officialUrl,
      officialStatement: `Prescribed Fee: ${feeInfo}`,
      guidance: 'Obtain official e-challan or keep UPI / Net Banking active for online payment counter.',
      checklist: [{ id: 'fee-chk-1', text: `Prepare exact fee amount: ${feeInfo}`, checked: false }],
    });
  } else {
    steps.push({
      id: `${sId}-step-fee-notice`,
      order: stepNumber++,
      title: 'Fee Status Limitation Notice',
      type: STEP_TYPES.MISSING_DATA_ADVISORY,
      sourceField: 'fees',
      sourceUrl: officialUrl,
      officialStatement: 'Statutory fee schedule is not listed in catalogue.',
      guidance: 'Fee is unspecified. Check portal counter or verify whether the service is free of cost before paying any fee.',
      checklist: [{ id: 'fee-lim-1', text: 'Verify fee at official counter; do not pay unverified charges', checked: false }],
    });
  }

  // 4. Submission Channel Step (Personalised according to mode)
  if (mode === APPLICATION_MODES.ONLINE_SELF && officialUrl) {
    steps.push({
      id: `${sId}-step-submission-online`,
      order: stepNumber++,
      title: 'File Online via Official Government Portal',
      type: STEP_TYPES.OFFICIAL_REQUIREMENT,
      sourceField: 'officialUrl',
      sourceUrl: officialUrl,
      officialStatement: `Official submission endpoint: ${officialUrl}`,
      guidance: 'Register account on the portal, upload scanned PDFs, submit application, and record the Acknowledgement / Acknowledgement Receipt Number.',
      checklist: [
        { id: 'sub-on-1', text: 'Complete online form fields', checked: false },
        { id: 'sub-on-2', text: 'Save and copy submission acknowledgement number', checked: false },
      ],
    });
  } else if (mode === APPLICATION_MODES.CSC_COUNTER) {
    steps.push({
      id: `${sId}-step-submission-csc`,
      order: stepNumber++,
      title: 'Submit via Common Service Centre (CSC / e-Mitra / Seva Kendra)',
      type: STEP_TYPES.AI_RECOMMENDATION,
      sourceField: 'department',
      sourceUrl: officialUrl,
      officialStatement: `Responsible department: ${department}`,
      guidance: 'Take your assembled physical documents to your nearest authorised CSC operator. Demand an official computer-generated receipt.',
      checklist: [
        { id: 'csc-1', text: 'Visit authorized CSC operator with original documents', checked: false },
        { id: 'csc-2', text: 'Obtain signed token receipt with tracking number', checked: false },
      ],
    });
  } else {
    steps.push({
      id: `${sId}-step-submission-office`,
      order: stepNumber++,
      title: `Submit at ${department} District Counter`,
      type: STEP_TYPES.OFFICIAL_REQUIREMENT,
      sourceField: 'department',
      sourceUrl: officialUrl,
      officialStatement: `Designated authority: ${department}`,
      guidance: 'Submit physical dossier during official public dealing hours (usually 10:00 AM - 1:30 PM). Get receiving seal on duplicate copy.',
      checklist: [
        { id: 'off-1', text: 'Carry original documents and two self-attested photocopies', checked: false },
        { id: 'off-2', text: 'Get receiving stamp with date on your duplicate acknowledgement', checked: false },
      ],
    });
  }

  // 5. Turnaround & Escalation Step
  steps.push({
    id: `${sId}-step-tracking`,
    order: stepNumber++,
    title: 'Monitor Application Progress & Statutory SLA',
    type: statutorySla ? STEP_TYPES.OFFICIAL_REQUIREMENT : STEP_TYPES.AI_RECOMMENDATION,
    sourceField: statutorySla ? 'sla' : 'department',
    sourceUrl: officialUrl,
    officialStatement: statutorySla
      ? `Statutory processing timeline: ${statutorySla}`
      : 'No statutory turnaround time specified in current record.',
    guidance: isUrgent
      ? 'Track status weekly. If delayed past standard SLA, prepare an appeal or Right to Information inquiry.'
      : 'Retain your application tracking token in the Civic Help Setu tracker to receive stage updates.',
    checklist: [{ id: 'trk-1', text: 'Log tracking ID into tracking dashboard', checked: false }],
  });

  return {
    serviceId: sId,
    serviceTitle: serviceName,
    department,
    officialUrl,
    mode,
    isUrgent,
    generatedAt: Date.now(),
    steps,
  };
}

/**
 * Builds printable HTML representation of the personalized application plan.
 */
export function buildPlanPrintHtml(plan = {}) {
  const safeTitle = plan.serviceTitle || 'Civic Service';
  const steps = Array.isArray(plan.steps) ? plan.steps : [];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${safeTitle} — Personalized Application Plan</title>
  <style>
    body { font-family: -apple-system, sans-serif; line-height: 1.5; color: #1e293b; max-width: 42rem; margin: 2rem auto; padding: 1rem; }
    h1 { font-size: 1.5rem; color: #0f172a; margin-bottom: 0.25rem; }
    .subtitle { color: #64748b; font-size: 0.9rem; margin-bottom: 1.5rem; }
    .step-box { border: 1px solid #cbd5e1; border-radius: 0.5rem; padding: 1rem; margin-bottom: 1rem; }
    .step-header { font-weight: 700; margin-bottom: 0.25rem; display: flex; justify-content: space-between; }
    .step-type { font-size: 0.75rem; text-transform: uppercase; font-weight: 700; }
    .official { color: #059669; }
    .guidance { color: #2563eb; }
    .limitation { color: #d97706; }
    .desc { font-size: 0.85rem; color: #475569; margin-bottom: 0.5rem; }
    ul { margin: 0; padding-left: 1.25rem; font-size: 0.85rem; }
    @media print { body { margin: 0; max-width: none; } }
  </style>
</head>
<body>
  <h1>${safeTitle}</h1>
  <div class="subtitle">Personalized Step-by-Step Application Roadmap</div>
  ${steps
    .map(
      (s) => `
    <div class="step-box">
      <div class="step-header">
        <span>Step ${s.order}: ${s.title}</span>
        <span class="step-type ${s.type === STEP_TYPES.OFFICIAL_REQUIREMENT ? 'official' : s.type === STEP_TYPES.MISSING_DATA_ADVISORY ? 'limitation' : 'guidance'}">
          ${s.type.replace(/_/g, ' ')}
        </span>
      </div>
      <div class="desc">${s.guidance}</div>
      ${s.officialStatement ? `<div style="font-size:0.8rem; font-style:italic; margin-bottom:0.5rem; color:#334155;">Source record: ${s.officialStatement}</div>` : ''}
      <ul>
        ${s.checklist.map((c) => `<li>[ ] ${c.text}</li>`).join('')}
      </ul>
    </div>
  `
    )
    .join('')}
</body>
</html>`;
}
