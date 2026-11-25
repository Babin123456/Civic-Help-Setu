/**
 * AI-assisted Civic Service Terminology Relationship Graph (#830)
 *
 * Provides a searchable concept graph of civic service terms with typed edges,
 * AI-generated relationship proposals, and human review workflow.
 *
 * Core concepts:
 * - TerminologyNode: A term/concept in the civic service domain
 * - TypedEdge: A relationship between two nodes with an explicit type
 * - Relationship kind: "synonym", "prerequisite", "related-but-not-equivalent"
 * - All edges require human review before being published
 * - AI proposals are labelled and stored pending review
 */

import { CIVIC_GLOSSARY, searchGlossary, getGlossaryEntryById } from './civicGlossary.js';

/**
 * Edge types for the terminology relationship graph.
 * These are the only valid relationship types that can appear on graph edges.
 */
export const RELATIONSHIP_TYPES = {
  SYNONYM: 'synonym',
  PREREQUISITE: 'prerequisite',
  RELATED: 'related',
  CONFUSING: 'confusing',
  ALTERNATIVE: 'alternative',
};

/**
 * Human reviewer states for edge approval.
 */
export const EDGE_REVIEW_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

/**
 * TerminologyNode represents a concept/term in the civic service domain.
 * Each node has a unique ID, multilingual labels, and categorization.
 */
export const CATEGORIES = {
  CERTIFICATE: 'certificate',
  EXTRACT: 'extract',
  LICENSE: 'license',
  PERMIT: 'permit',
  RENEWAL: 'renewal',
  CORRECTION: 'correction',
  REISSUE: 'reissue',
  APPLICATION: 'application',
  SERVICE: 'service',
};

/**
 * Builds a terminology node from a glossary entry and optional extensions.
 *
 * @param {Object} glossaryEntry - The civic glossary entry
 * @param {Object} [extensions] - Additional fields for graph integration
 * @returns {Object} A terminology node
 */
export const buildTerminologyNode = (glossaryEntry, extensions = {}) => ({
  id: glossaryEntry.id,
  term: glossaryEntry.term,
  aliases: [
    ...(glossaryEntry.abbreviations || []),
    ...(extensions.aliases || []),
  ],
  languageVariants: {
    hi: glossaryEntry.hiTerm,
    bn: glossaryEntry.bnTerm,
    ta: glossaryEntry.taTerm,
    ...extensions.languageVariants,
  },
  category: extensions.category || CATEGORIES.CERTIFICATE,
  simpleMeaning: glossaryEntry.simpleMeaning,
  context: glossaryEntry.context,
  relatedServices: glossaryEntry.relatedServices,
  source: glossaryEntry.reviewedSource,
  // Graph-specific fields
  description: extensions.description,
  // Review state for AI-proposed edges involving this node
  reviewStatus: extensions.reviewStatus || 'verified',
});

// Core terminology nodes built from the civic glossary
// These form the initial graph dataset
// Using plain object literals to avoid syntax issues with function calls in array initializers

export const INITIAL_TERMINOLOGY_NODES = [
  // Certificate-related terms
  {
    id: 'certificate',
    term: 'Certificate',
    aliases: ['Cert'],
    category: CATEGORIES.CERTIFICATE,
    languageVariants: {
      hi: 'पत्र (Certificate)',
      bn: 'স(Test certificate)',
      ta: 'சான்றிதழ் (Certificate)',
    },
    simpleMeaning: 'An official document issued by a government authority that verifies a fact, status, or qualification.',
    context: 'Required when changing your name, correcting date of birth, or declaring annual family income without formal pay slips.',
    relatedServices: ['Birth Certificate', 'Income Certificate', 'Passport'],
    source: {
      name: 'Department of Legal Affairs, Ministry of Law and Justice',
      url: 'https://legalaffairs.gov.in',
      reviewDate: '2026-01-15',
    },
    description: 'An official document issued by a government authority that verifies a fact, status, or qualification.',
  },
  {
    id: 'extract',
    term: 'Extract',
    aliases: ['EC'],
    category: CATEGORIES.EXTRACT,
    languageVariants: {
      hi: 'निष्कर्षण प्रमाण पत्र (Extract)',
      bn: 'উদ্ধৃতি সনদপত্র (Extract)',
      ta: 'வெ�ிப்பு சான்றிதழ் (Extract)',
    },
    simpleMeaning: 'A document extracted from official records, often containing specific details about a entry (e.g., birth extract, land extract).',
    context: 'Indispensable before buying any resale flat or agricultural land to avoid inheriting someone else\'s debt.',
    relatedServices: ['Property Registration', 'Home Loan Verification'],
    source: {
      name: 'Department of Land Resources (DoLR)',
      url: 'https://dolr.gov.in',
      reviewDate: '2026-01-20',
    },
    description: 'A document extracted from official records, often containing specific details about a entry.',
  },
  {
    id: 'licence',
    term: 'Licence/License',
    aliases: ['License', 'Lic'],
    category: CATEGORIES.LICENSE,
    languageVariants: {
      hi: 'लाइसेंस (License)',
      bn: 'লাইসেন্স (License)',
      ta: 'பரவ légales (License)',
    },
    simpleMeaning: 'An official permit or authorization granted by a government body allowing a person or entity to perform a specific activity.',
    context: 'Required for professional practice, driving, or operating certain businesses.',
    relatedServices: ['Professional Registration', 'Driving License'],
    source: {
      name: 'Relevant Government Department',
      url: 'https://services.india.gov.in',
      reviewDate: '2026-02-10',
    },
    description: 'An official permit or authorization granted by a government body allowing a person or entity to perform a specific activity.',
  },
  {
    id: 'permit',
    term: 'Permit',
    aliases: ['Permit'],
    category: CATEGORIES.PERMIT,
    languageVariants: {
      hi: 'परमिट (Permit)',
      bn: 'নিবন্ধনপত্র (Permit)',
      ta: 'உmozment Chennai (Permit)',
    },
    simpleMeaning: 'An official document allowing something to happen or authorizing a specific action or construction.',
    context: 'Required for construction, events, or specialized transactions.',
    relatedServices: ['Planning Permission', 'Event Authorization'],
    source: {
      name: 'Relevant Government Department',
      url: 'https://services.india.gov.in',
      reviewDate: '2026-02-10',
    },
    description: 'An official document allowing something to happen or authorizing a specific action or construction.',
  },

  // Renewal and correction terms
  {
    id: 'renewal',
    term: 'Renewal',
    category: CATEGORIES.RENEWAL,
    languageVariants: {
      hi: 'नवीनीकरण (Renewal)',
      bn: ' renewal (Renewal)',
      ta: 'ப renouveau (Renewal)',
    },
    simpleMeaning: 'The process of extending the validity of a certificate, licence, or permit by reapplying or re-qualifying.',
    context: 'Must be completed before the expiry date of the original document.',
    relatedServices: ['Certificate Renewal', 'Licence Renewal'],
    source: {
      name: 'Relevant Government Department',
      url: 'https://services.india.gov.in',
      reviewDate: '2026-02-10',
    },
    description: 'The process of extending the validity of a certificate, licence, or permit.',
  },
  {
    id: 'correction',
    term: 'Correction',
    category: CATEGORIES.CORRECTION,
    languageVariants: {
      hi: 'संशोधन (Correction)',
      bn: 'সংশোধন (Correction)',
      ta: 'திருத்த Томас (Correction)',
    },
    simpleMeaning: 'The process of fixing an error or updating information in an existing official document.',
    context: 'Must be reported to the issuing authority with supporting documentation.',
    relatedServices: ['Document Update', 'Record Correction'],
    source: {
      name: 'Relevant Government Department',
      url: 'https://services.india.gov.in',
      reviewDate: '2026-02-10',
    },
    description: 'The process of fixing an error or updating information in an existing official document.',
  },
  {
    id: 'reissue',
    term: 'Reissue',
    category: CATEGORIES.REISSUE,
    languageVariants: {
      hi: 'दुबारा जारी करना (Reissue)',
      bn: 'নতুন প্রমাণপত্র (Reissue)',
      ta: 'முது மீ vigorously (Reissue)',
    },
    simpleMeaning: 'A new version of a certificate or document issued when the original is lost, damaged, or requires updated information.',
    context: 'Often requires a correction step before reissuance, or a fee for duplicate issuance.',
    relatedServices: ['Document Replacement', 'Duplicate Certificate'],
    source: {
      name: 'Relevant Government Department',
      url: 'https://services.india.gov.in',
      reviewDate: '2026-02-10',
    },
    description: 'A new version of a certificate or document issued when the original is lost, damaged, or requires updated information.',
  },

  // Application term
  {
    id: 'application',
    term: 'Application',
    category: CATEGORIES.APPLICATION,
    languageVariants: {
      hi: 'आवेदन (Application)',
      bn: 'অবেদন (Application)',
      ta: 'ஆவணம் (Application)',
    },
    simpleMeaning: 'A formal request submitted to a government authority to obtain a certificate, licence, or permit.',
    context: 'Must include required forms, fees, and supporting documentation.',
    relatedServices: ['Birth Certificate Application', 'Licence Application'],
    source: {
      name: 'National Government Services Portal',
      url: 'https://services.india.gov.in',
      reviewDate: '2026-02-10',
    },
    description: 'A formal request submitted to a government authority to obtain a certificate, licence, or permit.',
  },
];

/**
 * Builds the initial set of typed relationships between terminology nodes.
 * These represent known civic service term distinctions.
 * AI may propose additional relationships, but all require human review.
 */

export const INITIAL_RELATIONSHIPS = [
  // Certificate vs Licence vs Permit: distinct but related
  {
    source: 'certificate',
    target: 'licence',
    type: RELATIONSHIP_TYPES.RELATED,
    description: 'A certificate verifies a fact; a licence permits an activity.',
    sourceReference: {
      name: 'Civic Help Setu Glossary',
      version: '1.0',
    },
    reviewStatus: EDGE_REVIEW_STATUS.PENDING,
  },
  {
    source: 'certificate',
    target: 'permit',
    type: RELATIONSHIP_TYPES.RELATED,
    description: 'A certificate confirms status; a permit authorizes a specific action.',
    sourceReference: {
      name: 'Civic Help Setu Glossary',
      version: '1.0',
    },
    reviewStatus: EDGE_REVIEW_STATUS.PENDING,
  },
  {
    source: 'licence',
    target: 'permit',
    type: RELATIONSHIP_TYPES.RELATED,
    description: 'Both are official authorizations but for different purposes (professional vs transactional).',
    sourceReference: {
      name: 'Civic Help Setu Glossary',
      version: '1.0',
    },
    reviewStatus: EDGE_REVIEW_STATUS.PENDING,
  },

  // Extract vs Certificate: extract is a type of certificate detail
  {
    source: 'extract',
    target: 'certificate',
    type: RELATIONSHIP_TYPES.PREREQUISITE,
    description: 'An extract is a distilled portion of records that may accompany or derive from a full certificate.',
    sourceReference: {
      name: 'Civic Help Setu Glossary',
      version: '1.0',
    },
    reviewStatus: EDGE_REVIEW_STATUS.PENDING,
  },

  // Renewal relates to all issuance types
  {
    source: 'renewal',
    target: 'certificate',
    type: RELATIONSHIP_TYPES.PREREQUISITE,
    description: 'Renewal extends the validity of a certificate.',
    sourceReference: {
      name: 'Civic Help Setu Glossary',
      version: '1.0',
    },
    reviewStatus: EDGE_REVIEW_STATUS.PENDING,
  },
  {
    source: 'renewal',
    target: 'licence',
    type: RELATIONSHIP_TYPES.PREREQUISITE,
    description: 'Renewal extends the validity of a licence.',
    sourceReference: {
      name: 'Civic Help Setu Glossary',
      version: '1.0',
    },
    reviewStatus: EDGE_REVIEW_STATUS.PENDING,
  },
  {
    source: 'renewal',
    target: 'permit',
    type: RELATIONSHIP_TYPES.PREREQUISITE,
    description: 'Renewal extends the validity of a permit.',
    sourceReference: {
      name: 'Civic Help Setu Glossary',
      version: '1.0',
    },
    reviewStatus: EDGE_REVIEW_STATUS.PENDING,
  },

  // Correction and reissue are distinct paths
  {
    source: 'correction',
    target: 'reissue',
    type: RELATIONSHIP_TYPES.RELATED,
    description: 'Correction fixes existing document; reissue creates a new one (often when original is lost).',
    sourceReference: {
      name: 'Civic Help Setu Glossary',
      version: '1.0',
    },
    reviewStatus: EDGE_REVIEW_STATUS.PENDING,
  },
  {
    source: 'correction',
    target: 'certificate',
    type: RELATIONSHIP_TYPES.PREREQUISITE,
    description: 'A correction may be applied before reissuing a certificate.',
    sourceReference: {
      name: 'Civic Help Setu Glossary',
      version: '1.0',
    },
    reviewStatus: EDGE_REVIEW_STATUS.PENDING,
  },
  {
    source: 'reissue',
    target: 'certificate',
    type: RELATIONSHIP_TYPES.PREREQUISITE,
    description: 'Reissue produces a new certificate version.',
    sourceReference: {
      name: 'Civic Help Setu Glossary',
      version: '1.0',
    },
    reviewStatus: EDGE_REVIEW_STATUS.PENDING,
  },

  // Application is prerequisite to all issuance
  {
    source: 'application',
    target: 'certificate',
    type: RELATIONSHIP_TYPES.PREREQUISITE,
    description: 'A certificate is obtained via an application process.',
    sourceReference: {
      name: 'Civic Help Setu Glossary',
      version: '1.0',
    },
    reviewStatus: EDGE_REVIEW_STATUS.APPROVED,
  },
  {
    source: 'application',
    target: 'licence',
    type: RELATIONSHIP_TYPES.PREREQUISITE,
    description: 'A licence is obtained via an application process.',
    sourceReference: {
      name: 'Civic Help Setu Glossary',
      version: '1.0',
    },
    reviewStatus: EDGE_REVIEW_STATUS.APPROVED,
  },
  {
    source: 'application',
    target: 'permit',
    type: RELATIONSHIP_TYPES.PREREQUISITE,
    description: 'A permit is obtained via an application process.',
    sourceReference: {
      name: 'Civic Help Setu Glossary',
      version: '1.0',
    },
    reviewStatus: EDGE_REVIEW_STATUS.APPROVED,
  },

  // Confusing relationships that citizens often mix up
  {
    source: 'certificate',
    target: 'extract',
    type: RELATIONSHIP_TYPES.CONFUSING,
    description: 'Citizens often confuse certificates and extracts; this edge highlights the distinction.',
    sourceReference: {
      name: 'Civic Help Setu Glossary',
      version: '1.0',
    },
    reviewStatus: EDGE_REVIEW_STATUS.APPROVED,
  },
  {
    source: 'licence',
    target: 'permit',
    type: RELATIONSHIP_TYPES.CONFUSING,
    description: 'Citizens often confuse licences and permits; this edge clarifies the distinction.',
    sourceReference: {
      name: 'Civic Help Setu Glossary',
      version: '1.0',
    },
    reviewStatus: EDGE_REVIEW_STATUS.APPROVED,
  },

  // Alternative relationships
  {
    source: 'extract',
    target: 'certificate',
    type: RELATIONSHIP_TYPES.ALTERNATIVE,
    description: 'An extract can serve as an alternative to a full certificate in some contexts.',
    sourceReference: {
      name: 'Civic Help Setu Glossary',
      version: '1.0',
    },
    reviewStatus: EDGE_REVIEW_STATUS.PENDING,
  },
];

/**
 * Searches the terminology graph for nodes matching a query.
 *
 * @param {string} query - The search term
 * @param {Object} [options] - Search options
 * @param {boolean} [options.includeAliases=true] - Whether to search aliases
 * @returns {Array} Matching terminology nodes
 */
export const searchTerminology = (query, options = {}) => {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return [...INITIAL_TERMINOLOGY_NODES];
  }

  const q = query.toLowerCase().trim();
  const includeAliases = options.includeAliases !== false;

  return INITIAL_TERMINOLOGY_NODES.filter((node) => {
    // Match against term id
    if (node.id.toLowerCase().includes(q)) return true;

    // Match against term
    if (node.term.toLowerCase().includes(q)) return true;

    // Match against aliases if enabled
    if (includeAliases) {
      if (node.aliases && node.aliases.some((abbr) => abbr.toLowerCase().includes(q))) return true;
    }

    // Match against category
    if (Object.values(CATEGORIES).some((cat) => cat.toLowerCase().includes(q))) return true;

    // Match against simple meaning keywords
    if (node.simpleMeaning && node.simpleMeaning.toLowerCase().includes(q)) return true;

    // Match against context
    if (node.context && node.context.toLowerCase().includes(q)) return true;

    // Match against related services
    if (
      node.relatedServices &&
      node.relatedServices.some((svc) => svc.toLowerCase().includes(q))
    )
      return true;

    return false;
  });
};

/**
 * Gets all edges for a given node (both incoming and outgoing).
 *
 * @param {string} nodeId - The node ID
 * @returns {Array} Array of edges involving this node
 */
export const getEdgesForNode = (nodeId) => {
  const allEdges = [...INITIAL_RELATIONSHIPS];
  return allEdges.filter(
    (edge) => edge.source === nodeId || edge.target === nodeId
  );
};

/**
 * Gets outgoing edges from a node.
 *
 * @param {string} nodeId - The node ID
 * @returns {Array} Outgoing edges
 */
export const getOutgoingEdges = (nodeId) => {
  return INITIAL_RELATIONSHIPS.filter((edge) => edge.source === nodeId);
};

/**
 * Gets incoming edges to a node.
 *
 * @param {string} nodeId - The node ID
 * @returns {Array} Incoming edges
 */
export const getIncomingEdges = (nodeId) => {
  return INITIAL_RELATIONSHIPS.filter((edge) => edge.target === nodeId);
};

/**
 * Gets all edges of a specific type.
 *
 * @param {string} type - The relationship type
 * @returns {Array} Edges of that type
 */
export const getEdgesByType = (type) => {
  return INITIAL_RELATIONSHIPS.filter((edge) => edge.type === type);
};

/**
 * Adds a new relationship edge to the graph.
 * The edge starts in PENDING review status.
 *
 * @param {Object} edge - The edge to add { source, target, type, description, sourceReference }
 * @returns {Object} The added edge with review status
 */
export const addRelationship = (edge) => {
  const normalizedEdge = {
    source: edge.source,
    target: edge.target,
    type: edge.type,
    description: edge.description,
    sourceReference: edge.sourceReference || { name: 'Civic Help Setu', version: '1.0' },
    reviewStatus: EDGE_REVIEW_STATUS.PENDING,
    id: `edge-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  };

  // In a real implementation, this would persist to a database
  // For now, we return the normalized edge
  return normalizedEdge;
};

/**
 * Approves a pending relationship edge.
 *
 * @param {string} edgeId - The ID of the edge to approve
 * @returns {Object} The approved edge
 */
export const approveRelationship = (edgeId) => {
  // In a real implementation, this would update a database
  // For now, we return a mock approved edge
  return {
    id: edgeId,
    reviewStatus: EDGE_REVIEW_STATUS.APPROVED,
    approvedAt: new Date().toISOString(),
  };
};

/**
 * Rejects a pending relationship edge.
 *
 * @param {string} edgeId - The ID of the edge to reject
 * @returns {Object} The rejected edge
 */
export const rejectRelationship = (edgeId) => {
  // In a real implementation, this would update a database
  // For now, we return a mock rejected edge
  return {
    id: edgeId,
    reviewStatus: EDGE_REVIEW_STATUS.REJECTED,
    rejectedAt: new Date().toISOString(),
  };
};

/**
 * Gets all pending (unreviewed) edges that need human review.
 *
 * @returns {Array} Pending edges
 */
export const getPendingEdges = () => {
  return INITIAL_RELATIONSHIPS.filter(
    (edge) => edge.reviewStatus === EDGE_REVIEW_STATUS.PENDING
  );
};

/**
 * Gets all approved edges.
 *
 * @returns {Array} Approved edges
 */
export const getApprovedEdges = () => {
  return INITIAL_RELATIONSHIPS.filter(
    (edge) => edge.reviewStatus === EDGE_REVIEW_STATUS.APPROVED
  );
};

/**
 * Transforms a glossary entry into a terminology node suitable for the graph.
 * This is the primary conversion function for integrating new terms.
 *
 * @param {string} identifier - Glossary entry identifier (id, term, or abbreviation)
 * @param {Object} [options] - Conversion options
 * @returns {Object|undefined} The terminology node, or undefined if not found
 */
export const glossaryEntryToNode = (identifier, options = {}) => {
  const entry = getGlossaryEntryById(identifier);
  if (!entry) return undefined;

  return buildTerminologyNode(entry, options);
};

/**
 * Finds terminology nodes related to a given node through approved edges.
 *
 * @param {string} nodeId - The starting node ID
 * @param {Object} [options] - Filter options
 * @param {string} [options.type] - Filter by relationship type
 * @param {boolean} [options.onlyApproved=true] - Only follow approved edges
 * @returns {Array} Related nodes with edge information
 */
export const getRelatedNodes = (nodeId, options = {}) => {
  const onlyApproved = options.onlyApproved !== false;
  const targetType = options.type;
  const edges = onlyApproved
    ? getApprovedEdges()
    : getPendingEdges();

  const related = [];

  edges.forEach((edge) => {
    const edgeType = edge.type;
    if (targetType && edgeType !== targetType) return;

    let relatedNodeId;
    let edgeDirection;

    if (edge.source === nodeId) {
      relatedNodeId = edge.target;
      edgeDirection = 'outgoing';
    } else if (edge.target === nodeId) {
      relatedNodeId = edge.source;
      edgeDirection = 'incoming';
    } else {
      return;
    }

    // Find the related node
    const relatedNode = INITIAL_TERMINOLOGY_NODES.find(
      (node) => node.id === relatedNodeId
    );
    if (!relatedNode) return;

    related.push({
      node: relatedNode,
      edge,
      direction: edgeDirection,
      type: edgeType,
    });
  });

  return related;
};

/**
 * Validates that a relationship edge has all required fields and valid types.
 *
 * @param {Object} edge - The edge to validate
 * @returns {Object} { valid: boolean, errors: Array<string> }
 */
export const validateEdge = (edge) => {
  const errors = [];

  if (!edge) {
    return { valid: false, errors: ['Edge object is required'] };
  }

  // Validate required fields
  if (typeof edge.source !== 'string' || edge.source.trim() === '') {
    errors.push('Edge must have a non-empty source node ID');
  }
  if (typeof edge.target !== 'string' || edge.target.trim() === '') {
    errors.push('Edge must have a non-empty target node ID');
  }
  if (
    !edge.type ||
    !Object.values(RELATIONSHIP_TYPES).includes(edge.type)
  ) {
    errors.push(
      `Edge type must be one of: ${Object.values(
        RELATIONSHIP_TYPES
      ).join(', ')}`
    );
  }
  if (typeof edge.description !== 'string' || edge.description.trim() === '') {
    errors.push('Edge must have a non-empty description');
  }
  if (
    !edge.sourceReference ||
    typeof edge.sourceReference.name !== 'string' ||
    edge.sourceReference.name.trim() === ''
  ) {
    errors.push('Edge must have a sourceReference with a name');
  }
  if (
    !edge.sourceReference ||
    typeof edge.sourceReference.version !== 'string' ||
    edge.sourceReference.version.trim() === ''
  ) {
    errors.push('Edge must have a sourceReference with a version');
  }

  // Validate that source and target are not the same
  if (edge.source === edge.target) {
    errors.push('Source and target nodes must be different');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Extracts all terminology nodes from the civic glossary that are relevant
 * to the service categories mentioned in the issue (certificate, extract, licence, permit, renewal, correction, reissue).
 *
 * @returns {Array} Relevant terminology nodes
 */
export const getRelevantTermsForIssue = () => {
  const relevantIds = [
    'certificate',
    'extract',
    'licence',
    'permit',
    'renewal',
    'correction',
    'reissue',
    'application',
  ];

  return INITIAL_TERMINOLOGY_NODES.filter((node) =>
    relevantIds.includes(node.id)
  );
};

/**
 * Gets the graph version/state metadata.
 *
 * @returns {Object} Graph metadata including node count, edge count, and last update
 */
export const getGraphMetadata = () => {
  const relevantNodes = getRelevantTermsForIssue();
  const pendingEdges = getPendingEdges();
  const approvedEdges = getApprovedEdges();

  return {
    version: '1.0.0',
    nodeCount: relevantNodes.length,
    edgeCount: INITIAL_RELATIONSHIPS.length,
    approvedEdgeCount: approvedEdges.length,
    pendingEdgeCount: pendingEdges.length,
    categories: Object.values(CATEGORIES),
    lastUpdated: new Date().toISOString(),
    description:
      'AI-assisted civic service terminology relationship graph. Edges marked PENDING require human review before publication.',
  };
};

/**
 * Returns the terminology graph interface for backwards compatibility with graph routes and panels.
 */
export const getTerminologyGraph = () => ({
  graphMetadata: getGraphMetadata(),
  getPendingEdges,
  getApprovedEdges,
  searchTerminology,
  getRelevantTermsForIssue,
  glossaryEntryToNode,
});
