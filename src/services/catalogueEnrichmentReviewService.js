/**
 * AI-Generated Catalogue Enrichment Review Service (#407)
 * 
 * Provides an administrative review queue for AI-proposed service catalogue enrichments
 * (plain-language summaries, structured application steps, tags, and guidance tips).
 * 
 * Safety & Governance Rules:
 * 1. Strict Separation: Proposed content is stored separately and NEVER alters the published
 *    catalogue until an authorized administrator explicitly approves or edits it.
 * 2. Field-Level Control: Administrators can inspect before/after comparisons, accept individual
 *    fields, edit values prior to approval, or reject suggestions.
 * 3. Immutable Accountability: Records reviewer identity, timestamp, and review outcome notes.
 * 4. Zero Auto-Publication: No AI model output is ever published automatically.
 */

export const ENRICHMENT_QUEUE_STORAGE_KEY = 'civicbridge_catalogue_enrichment_queue_v1';

export const FIELD_LABELS = {
  shortDescription: 'Short Description',
  plainLanguageSummary: 'Plain-Language Citizen Summary',
  steps: 'Application Procedure Steps',
  tags: 'Discovery & Search Tags',
  applicationTips: 'Citizen Preflight & Application Tips',
};

// Default seed proposals for demonstration and test benches
export const SEED_PROPOSALS = [
  {
    id: 'prop-voter-id-01',
    serviceId: 'srv-voter-id',
    serviceName: 'Voter ID Card Registration',
    status: 'pending', // 'pending' | 'approved' | 'rejected' | 'partially_approved'
    proposedAt: '2026-10-28T10:00:00.000Z',
    reviewedAt: null,
    reviewedBy: null,
    reviewNotes: '',
    fields: {
      shortDescription: {
        fieldKey: 'shortDescription',
        label: 'Short Description',
        current: 'National electoral photo identity card issued by the Election Commission.',
        proposed: 'Official photo identity document for voting in Indian democratic elections, issued free of cost by the Election Commission of India.',
        decision: 'pending', // 'pending' | 'approved' | 'rejected' | 'edited'
        editedValue: '',
      },
      plainLanguageSummary: {
        fieldKey: 'plainLanguageSummary',
        label: 'Plain-Language Citizen Summary',
        current: '',
        proposed: 'If you are an Indian citizen aged 18 or above, you can register for a Voter ID card free of charge. You will need one proof of age and one proof of address.',
        decision: 'pending',
        editedValue: '',
      },
      tags: {
        fieldKey: 'tags',
        label: 'Discovery & Search Tags',
        current: 'elections, voter, epic',
        proposed: 'elections, voter, epic, election commission, voting card, form 6, free id',
        decision: 'pending',
        editedValue: '',
      },
      applicationTips: {
        fieldKey: 'applicationTips',
        label: 'Citizen Preflight & Application Tips',
        current: '',
        proposed: 'Ensure your name matches your Class 10 marksheet or birth certificate exactly to avoid clerical corrections later.',
        decision: 'pending',
        editedValue: '',
      },
    },
  },
  {
    id: 'prop-pension-02',
    serviceId: 'srv-old-age-pension',
    serviceName: 'Indira Gandhi National Old Age Pension',
    status: 'pending',
    proposedAt: '2026-10-29T14:30:00.000Z',
    reviewedAt: null,
    reviewedBy: null,
    reviewNotes: '',
    fields: {
      shortDescription: {
        fieldKey: 'shortDescription',
        label: 'Short Description',
        current: 'Monthly financial assistance for senior citizens living below poverty line.',
        proposed: 'Monthly statutory pension provided by central and state governments to elderly citizens living below poverty line (BPL).',
        decision: 'pending',
        editedValue: '',
      },
      plainLanguageSummary: {
        fieldKey: 'plainLanguageSummary',
        label: 'Plain-Language Citizen Summary',
        current: '',
        proposed: 'Elderly citizens aged 60 and above with a family BPL card can receive monthly statutory financial aid directly credited to their Aadhaar-linked bank account.',
        decision: 'pending',
        editedValue: '',
      },
      tags: {
        fieldKey: 'tags',
        label: 'Discovery & Search Tags',
        current: 'pension, senior citizen',
        proposed: 'pension, senior citizen, elderly, bpl, social welfare, nsap, dbt pension',
        decision: 'pending',
        editedValue: '',
      },
    },
  },
];

let inMemoryQueue = [...SEED_PROPOSALS];

const getStorage = () => {
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
};

/**
 * Retrieve current enrichment review queue
 */
export const getEnrichmentQueue = () => {
  const storage = getStorage();
  if (storage) {
    try {
      const raw = storage.getItem(ENRICHMENT_QUEUE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      return inMemoryQueue;
    }
  }
  return inMemoryQueue;
};

/**
 * Persist queue to storage
 */
export const saveEnrichmentQueue = (queue) => {
  if (!Array.isArray(queue)) return false;
  inMemoryQueue = queue;
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(ENRICHMENT_QUEUE_STORAGE_KEY, JSON.stringify(queue));
      return true;
    } catch {
      return false;
    }
  }
  return true;
};

/**
 * Create a new pending enrichment proposal
 */
export const createEnrichmentProposal = (service, proposedFields = {}) => {
  if (!service || !service.id) return null;

  const proposalId = `prop-${service.id}-${Date.now()}`;
  const fieldsMap = {};

  Object.entries(proposedFields).forEach(([key, proposedVal]) => {
    fieldsMap[key] = {
      fieldKey: key,
      label: FIELD_LABELS[key] || key,
      current: typeof service[key] === 'string' ? service[key] : (service[key] ? JSON.stringify(service[key]) : ''),
      proposed: typeof proposedVal === 'string' ? proposedVal : (proposedVal ? JSON.stringify(proposedVal) : ''),
      decision: 'pending',
      editedValue: '',
    };
  });

  const proposal = {
    id: proposalId,
    serviceId: service.id,
    serviceName: service.name || 'Civic Service',
    status: 'pending',
    proposedAt: new Date().toISOString(),
    reviewedAt: null,
    reviewedBy: null,
    reviewNotes: '',
    fields: fieldsMap,
  };

  const queue = [proposal, ...getEnrichmentQueue()];
  saveEnrichmentQueue(queue);
  return proposal;
};

/**
 * Review an individual field within a proposal (Approve, Edit, Reject)
 */
export const reviewFieldProposal = (proposalId, fieldKey, decision, editedValue = '') => {
  if (!['approved', 'rejected', 'edited', 'pending'].includes(decision)) {
    return { success: false, error: 'Invalid decision type' };
  }

  const queue = getEnrichmentQueue();
  const proposalIndex = queue.findIndex((p) => p.id === proposalId);
  if (proposalIndex === -1) {
    return { success: false, error: 'Proposal not found' };
  }

  const proposal = { ...queue[proposalIndex] };
  if (!proposal.fields[fieldKey]) {
    return { success: false, error: 'Field not found in proposal' };
  }

  proposal.fields[fieldKey] = {
    ...proposal.fields[fieldKey],
    decision,
    editedValue: decision === 'edited' ? String(editedValue).trim() : '',
  };

  queue[proposalIndex] = proposal;
  saveEnrichmentQueue(queue);
  return { success: true, proposal };
};

/**
 * Finalize review for a proposal:
 * - Computes overall status ('approved', 'rejected', or 'partially_approved')
 * - Records reviewer ID, timestamp, and notes
 * - Returns the payload of accepted fields ready to update the service record
 */
export const finalizeProposalReview = (proposalId, reviewerId, reviewNotes = '') => {
  const queue = getEnrichmentQueue();
  const proposalIndex = queue.findIndex((p) => p.id === proposalId);
  if (proposalIndex === -1) {
    return { success: false, error: 'Proposal not found' };
  }

  const proposal = { ...queue[proposalIndex] };
  const fieldEntries = Object.values(proposal.fields);

  // Check decisions
  const approvedFields = fieldEntries.filter((f) => f.decision === 'approved' || f.decision === 'edited');
  const rejectedFields = fieldEntries.filter((f) => f.decision === 'rejected');

  let overallStatus = 'pending';
  if (approvedFields.length === fieldEntries.length) {
    overallStatus = 'approved';
  } else if (rejectedFields.length === fieldEntries.length) {
    overallStatus = 'rejected';
  } else if (approvedFields.length > 0) {
    overallStatus = 'partially_approved';
  } else {
    // If some fields are still pending, reject remaining by default or keep pending
    overallStatus = 'partially_approved';
  }

  proposal.status = overallStatus;
  proposal.reviewedAt = new Date().toISOString();
  proposal.reviewedBy = reviewerId || 'authorized_admin';
  proposal.reviewNotes = reviewNotes;

  // Extract changes to apply
  const appliedChanges = {};
  approvedFields.forEach((f) => {
    appliedChanges[f.fieldKey] = f.decision === 'edited' ? f.editedValue : f.proposed;
  });

  queue[proposalIndex] = proposal;
  saveEnrichmentQueue(queue);

  return {
    success: true,
    overallStatus,
    appliedChanges,
    proposal,
  };
};

/**
 * Reject entire proposal at once
 */
export const rejectEntireProposal = (proposalId, reviewerId, reason = '') => {
  const queue = getEnrichmentQueue();
  const proposalIndex = queue.findIndex((p) => p.id === proposalId);
  if (proposalIndex === -1) {
    return { success: false, error: 'Proposal not found' };
  }

  const proposal = { ...queue[proposalIndex] };
  Object.keys(proposal.fields).forEach((k) => {
    proposal.fields[k].decision = 'rejected';
  });

  proposal.status = 'rejected';
  proposal.reviewedAt = new Date().toISOString();
  proposal.reviewedBy = reviewerId || 'authorized_admin';
  proposal.reviewNotes = reason || 'Rejected by administrator';

  queue[proposalIndex] = proposal;
  saveEnrichmentQueue(queue);

  return { success: true, proposal };
};

/**
 * Summary metrics of queue
 */
export const getEnrichmentStats = () => {
  const queue = getEnrichmentQueue();
  const pending = queue.filter((p) => p.status === 'pending').length;
  const approved = queue.filter((p) => p.status === 'approved' || p.status === 'partially_approved').length;
  const rejected = queue.filter((p) => p.status === 'rejected').length;
  return {
    total: queue.length,
    pending,
    approved,
    rejected,
  };
};
