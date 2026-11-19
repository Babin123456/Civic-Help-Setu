/**
 * src/data/wardBudgetContract.js
 * Domain model, enums, schema validation, and lifecycle contracts for
 * the Participatory Ward Budget Proposal and Public Deliberation Platform (#765).
 */

export const SCHEMA_VERSION = '1.0.0';

export const PROPOSAL_CATEGORIES = Object.freeze({
  roads_footpaths: {
    id: 'roads_footpaths',
    label: 'Roads & Footpaths',
    description: 'Pavement repairs, pedestrian crossings, pothole rectification, and tactile pavers.',
  },
  parks_greenery: {
    id: 'parks_greenery',
    label: 'Parks & Urban Greenery',
    description: 'Tree planting, open gym equipment, walking tracks, and park maintenance.',
  },
  sanitation_drainage: {
    id: 'sanitation_drainage',
    label: 'Sanitation & Drainage',
    description: 'Stormwater drain desilting, waste segregation kiosks, and public toilet rehabilitation.',
  },
  street_lighting: {
    id: 'street_lighting',
    label: 'Street Lighting & Safety',
    description: 'Solar lighting, LED streetlight retrofits, and high-mast installations for dark stretches.',
  },
  public_facilities: {
    id: 'public_facilities',
    label: 'Public Facilities & Centers',
    description: 'Community reading rooms, senior citizen gazebos, and municipal hall maintenance.',
  },
  traffic_safety: {
    id: 'traffic_safety',
    label: 'Traffic & Pedestrian Safety',
    description: 'Speed calming table tops, school zone warning blinkers, and signage.',
  },
});

export const PROPOSAL_STATUSES = Object.freeze({
  draft: {
    id: 'draft',
    label: 'Draft',
    description: 'Resident draft, not yet published to deliberation pool.',
    badgeClass: 'badge-draft',
  },
  submitted: {
    id: 'submitted',
    label: 'Submitted for Deliberation',
    description: 'Open for public neighborhood comments and duplicate identification.',
    badgeClass: 'badge-info',
  },
  under_review: {
    id: 'under_review',
    label: 'Under Technical Review',
    description: 'Municipal engineers and ward committee scrutinizing technical feasibility and cost estimates.',
    badgeClass: 'badge-warning',
  },
  eligible: {
    id: 'eligible',
    label: 'Eligible for Ballot',
    description: 'Passed technical scrutiny and qualifies for citizen advisory voting.',
    badgeClass: 'badge-success',
  },
  ineligible: {
    id: 'ineligible',
    label: 'Ineligible',
    description: 'Does not fall within municipal jurisdiction or exceeds statutory scope.',
    badgeClass: 'badge-danger',
  },
  consolidated_duplicate: {
    id: 'consolidated_duplicate',
    label: 'Consolidated Duplicate',
    description: 'Merged into an existing canonical proposal covering the same location/works.',
    badgeClass: 'badge-secondary',
  },
  approved_for_voting: {
    id: 'approved_for_voting',
    label: 'Active on Ballot',
    description: 'Eligible for resident voting in the current budget cycle.',
    badgeClass: 'badge-primary',
  },
  funded: {
    id: 'funded',
    label: 'Funded & Approved',
    description: 'Selected for budget allocation by Ward Committee.',
    badgeClass: 'badge-success',
  },
  rejected: {
    id: 'rejected',
    label: 'Not Funded',
    description: 'Not prioritized in final ward budget allocation.',
    badgeClass: 'badge-muted',
  },
  work_in_progress: {
    id: 'work_in_progress',
    label: 'Work in Progress',
    description: 'Tender awarded and ground execution underway.',
    badgeClass: 'badge-info',
  },
  completed: {
    id: 'completed',
    label: 'Completed & Audited',
    description: 'Works finished and community inspection certified.',
    badgeClass: 'badge-success',
  },
});

export const CYCLE_STATUSES = Object.freeze({
  draft: 'draft',
  submission_open: 'submission_open',
  deliberation_open: 'deliberation_open',
  review_in_progress: 'review_in_progress',
  voting_open: 'voting_open',
  allocation_finalized: 'allocation_finalized',
  archived: 'archived',
});

export const IMPLEMENTATION_STAGES = Object.freeze([
  { id: 'tender_published', label: 'Tender Published' },
  { id: 'contractor_assigned', label: 'Contractor Assigned' },
  { id: 'work_in_progress', label: 'Work in Progress' },
  { id: 'inspection_complete', label: 'Social Audit & Inspection Complete' },
  { id: 'handed_over', label: 'Handed Over to Community' },
]);

// Anti-PII patterns for privacy safeguarding
export const AADHAAR_REGEX = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
export const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
export const PHONE_REGEX = /\b(\+91[-\s]?)?[6-9]\d{9}\b/;
export const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;

export const sanitizeText = (val, maxLen = 2000) => {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<[^>]*>/g, '') // Strip HTML tags to avoid XSS
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .trim()
    .slice(0, maxLen);
};

export const checkForForbiddenPII = (val) => {
  if (typeof val !== 'string') return null;
  if (AADHAAR_REGEX.test(val)) return 'Contains 12-digit Aadhaar number pattern';
  if (PAN_REGEX.test(val)) return 'Contains PAN identifier pattern';
  if (PHONE_REGEX.test(val)) return 'Contains 10-digit telephone contact number';
  if (EMAIL_REGEX.test(val)) return 'Contains private email address';
  return null;
};

export const validateProposalPayload = (body) => {
  const errors = [];
  if (!body || typeof body !== 'object') {
    return ['Request body must be an object.'];
  }

  const title = sanitizeText(body.title || '', 120);
  if (!title || title.length < 10) {
    errors.push('Proposal title must be between 10 and 120 characters.');
  }

  const titlePii = checkForForbiddenPII(title);
  if (titlePii) {
    errors.push(`Title ${titlePii}. Please do not submit personal contact details.`);
  }

  const description = sanitizeText(body.description || '', 2000);
  if (!description || description.length < 30) {
    errors.push('Proposal description must be at least 30 characters explaining public benefit.');
  }

  const descPii = checkForForbiddenPII(description);
  if (descPii) {
    errors.push(`Description ${descPii}. Private PII is not permitted in public proposals.`);
  }

  if (!body.category || !PROPOSAL_CATEGORIES[body.category]) {
    errors.push(`Category must be one of: ${Object.keys(PROPOSAL_CATEGORIES).join(', ')}.`);
  }

  const ward = sanitizeText(body.ward || '', 60);
  if (!ward || ward.length < 2) {
    errors.push('Ward name or number is required (e.g., "Ward 150 - Bellandur").');
  }

  const location = sanitizeText(body.approximateLocation || '', 200);
  if (!location || location.length < 5) {
    errors.push('Approximate location or landmark is required (min 5 characters).');
  }

  const minCost = Number(body.costEstimateRange?.min);
  const maxCost = Number(body.costEstimateRange?.max);

  if (Number.isNaN(minCost) || Number.isNaN(maxCost) || minCost <= 0 || maxCost < minCost) {
    errors.push('Cost estimate range must contain valid min and max amounts (max >= min > 0).');
  }

  if (maxCost > 50000000) {
    errors.push('Ward budget proposals cannot exceed ₹5,00,00,000 per statutory municipal cap.');
  }

  return errors;
};

export const validateCommentPayload = (body) => {
  const errors = [];
  if (!body || typeof body !== 'object') {
    return ['Request body must be an object.'];
  }

  if (!body.proposalId || typeof body.proposalId !== 'string') {
    errors.push('Valid proposalId is required.');
  }

  const content = sanitizeText(body.content || '', 800);
  if (!content || content.length < 5) {
    errors.push('Deliberation comment must be between 5 and 800 characters.');
  }

  const pii = checkForForbiddenPII(content);
  if (pii) {
    errors.push(`Comment ${pii}. Do not post personal contact information.`);
  }

  return errors;
};

export const validateReviewDecisionPayload = (body) => {
  const errors = [];
  if (!body || typeof body !== 'object') {
    return ['Request body must be an object.'];
  }

  if (!body.proposalId) {
    errors.push('proposalId is required.');
  }

  const validDecisions = [
    'eligible',
    'ineligible',
    'technical_revision_needed',
    'merged_as_duplicate',
    'approved_for_voting',
    'funded',
    'rejected',
  ];

  if (!validDecisions.includes(body.decision)) {
    errors.push(`Decision must be one of: ${validDecisions.join(', ')}.`);
  }

  if (body.decision === 'merged_as_duplicate' && !body.canonicalProposalId) {
    errors.push('canonicalProposalId is required when marking a proposal as duplicate.');
  }

  const summary = sanitizeText(body.publicSummary || '', 1000);
  if (!summary || summary.length < 15) {
    errors.push('A public summary justifying the technical review decision is required (min 15 chars).');
  }

  return errors;
};

