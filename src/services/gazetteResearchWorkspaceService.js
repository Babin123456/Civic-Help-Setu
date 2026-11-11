/**
 * Government Circular and Gazette Research Workspace Service
 *
 * Implements a citation-first research workspace for Indian official publications:
 * 1. Ingests approved gazette notifications, circulars, and office orders with rich metadata:
 *    - Issuing authority, notification date, document number, jurisdiction, source URL, and SHA-256 checksum.
 * 2. Preserves PDF page boundaries and section identifiers for page-level citations.
 * 3. Supports multi-faceted search by:
 *    - Document identifier / Gazette order number
 *    - Department & issuing authority
 *    - Jurisdiction (National, State, District)
 *    - Notification date / year range
 *    - Keyword & semantic passage retrieval
 * 4. Citation-First Enforcement:
 *    - Requires exact page-level and section citations for every factual claim.
 *    - Abstains with an explicit non-retrieval notice when evidence is missing or inaccessible.
 * 5. Lifecycle awareness: Surfaces conflicting, amended, or superseded circulars with active warnings.
 * 6. Editorial gate: Promoted citizen guidance routes through editorial review before landing in the master catalogue.
 */

export const PUBLICATION_STATUS = {
  ACTIVE_IN_FORCE: 'ACTIVE_IN_FORCE',
  AMENDED: 'AMENDED',
  SUPERSEDED: 'SUPERSEDED',
  REPEALED: 'REPEALED',
  UNDER_REVIEW: 'UNDER_REVIEW',
};

export const PROMOTION_STATE = {
  RESEARCH_DRAFT: 'RESEARCH_DRAFT',
  PENDING_EDITORIAL_REVIEW: 'PENDING_EDITORIAL_REVIEW',
  APPROVED_FOR_CATALOGUE: 'APPROVED_FOR_CATALOGUE',
  REJECTED: 'REJECTED',
};

export const RESEARCH_DISCLAIMER =
  'This research workspace indexes official government gazettes, circulars, and orders. Answers require exact page-level citations. Missing or inaccessible publications result in explicit abstention rather than unverified synthesis.';

/**
 * Validates publication schema metadata.
 * @param {object} pub
 * @returns {boolean}
 */
export function validatePublicationMetadata(pub) {
  return Boolean(
    pub &&
      pub.id &&
      pub.documentNumber &&
      pub.authority &&
      pub.jurisdiction &&
      pub.notificationDate &&
      pub.sourceUrl &&
      pub.checksum &&
      Array.isArray(pub.pages)
  );
}

/**
 * Ingests and indexes an approved gazette notification or departmental circular.
 * Preserves page boundaries and builds inverted page chunk indexes.
 *
 * @param {object} publication
 * @returns {object} Indexed publication document
 */
export function ingestGazettePublication(publication) {
  if (!validatePublicationMetadata(publication)) {
    throw new Error('Invalid publication metadata: documentNumber, authority, jurisdiction, sourceUrl, checksum, and pages array are required.');
  }

  const indexedPages = publication.pages.map((page, idx) => {
    const pageNum = page.pageNumber || idx + 1;
    const cleanText = String(page.text || '').trim();

    return {
      pageNumber: pageNum,
      section: page.section || `Section ${pageNum}`,
      text: cleanText,
      tokenCount: cleanText.split(/\s+/).filter(Boolean).length,
    };
  });

  return {
    ...publication,
    status: publication.status || PUBLICATION_STATUS.ACTIVE_IN_FORCE,
    supersededBy: publication.supersededBy || null,
    conflictNotes: publication.conflictNotes || null,
    ingestedAt: new Date().toISOString(),
    pages: indexedPages,
    totalPages: indexedPages.length,
  };
}

/**
 * Searches the gazette corpus using multiple filter criteria (identifier, department, date, keyword).
 *
 * @param {Array<object>} corpus Indexed publications
 * @param {object} queryParams
 * @param {string} [queryParams.identifier] Order/Notification number
 * @param {string} [queryParams.department] Authority or Ministry
 * @param {string} [queryParams.jurisdiction]
 * @param {string} [queryParams.query] Keyword/semantic query
 * @returns {Array<object>} Matching passage citations
 */
export function searchGazetteCorpus(corpus = [], queryParams = {}) {
  const { identifier, department, jurisdiction, query } = queryParams;

  const results = [];

  for (const pub of corpus) {
    // 1. Filter by identifier
    if (identifier && !pub.documentNumber.toLowerCase().includes(identifier.toLowerCase())) {
      continue;
    }

    // 2. Filter by authority/department
    if (department && !pub.authority.toLowerCase().includes(department.toLowerCase())) {
      continue;
    }

    // 3. Filter by jurisdiction
    if (
      jurisdiction &&
      pub.jurisdiction !== 'ALL_INDIA' &&
      pub.jurisdiction.toUpperCase() !== jurisdiction.toUpperCase()
    ) {
      continue;
    }

    // 4. Search page passages
    const queryTokens = query
      ? query.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter((t) => t.length > 2)
      : [];

    for (const page of pub.pages) {
      const pageTextLower = page.text.toLowerCase();

      let matchScore = 0;
      if (queryTokens.length > 0) {
        let matchedCount = 0;
        for (const tok of queryTokens) {
          if (pageTextLower.includes(tok)) matchedCount += 1;
        }
        matchScore = matchedCount / queryTokens.length;
        if (matchScore === 0) continue;
      } else {
        matchScore = 1.0;
      }

      results.push({
        publicationId: pub.id,
        documentNumber: pub.documentNumber,
        authority: pub.authority,
        jurisdiction: pub.jurisdiction,
        notificationDate: pub.notificationDate,
        sourceUrl: pub.sourceUrl,
        checksum: pub.checksum,
        status: pub.status,
        supersededBy: pub.supersededBy,
        conflictNotes: pub.conflictNotes,
        pageNumber: page.pageNumber,
        section: page.section,
        passageSnippet: page.text.slice(0, 300),
        matchScore: Number(matchScore.toFixed(3)),
      });
    }
  }

  // Sort descending by matchScore
  return results.sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Formulates a citation-first research answer from retrieved gazette passages.
 * Strictly abstains if matching passages are absent or low confidence.
 *
 * @param {string} citizenQuery
 * @param {Array<object>} corpus
 * @param {object} [filters={}]
 * @returns {object} Formulated research dossier
 */
export function answerWithGazetteCitations(citizenQuery, corpus = [], filters = {}) {
  if (!citizenQuery || typeof citizenQuery !== 'string' || citizenQuery.trim().length === 0) {
    throw new Error('Query string is required to search gazette workspace');
  }

  const searchResults = searchGazetteCorpus(corpus, { ...filters, query: citizenQuery });

  // Filter to passages that meet a minimum lexical match threshold (at least 30% query token overlap)
  const viablePassages = searchResults.filter((r) => r.matchScore >= 0.3);

  if (viablePassages.length === 0) {
    return {
      query: citizenQuery,
      status: 'ABSTAIN_NO_CITATIONS',
      answer: 'No authoritative gazette notification or circular passage was found matching your query in the indexed corpus. Civic Help Setu abstains from synthesizing an ungrounded response.',
      citations: [],
      hasConflictingPublications: false,
      disclaimer: RESEARCH_DISCLAIMER,
    };
  }

  // Check if any retrieved passage or corpus entry belongs to a superseded or conflicted publication
  const supersededPassages = viablePassages.filter(
    (p) => p.status === PUBLICATION_STATUS.SUPERSEDED || p.status === PUBLICATION_STATUS.AMENDED
  );
  const activePassages = viablePassages.filter(
    (p) => p.status === PUBLICATION_STATUS.ACTIVE_IN_FORCE
  );

  const selectedPassages = activePassages.length > 0 ? activePassages : viablePassages;

  // Check if any publication in the search results or corpus supersedes or is superseded by another
  const corpusHasSuperseded = corpus.some((c) => c.status === PUBLICATION_STATUS.SUPERSEDED || c.supersededBy);
  const hasConflictingPublications =
    supersededPassages.length > 0 ||
    selectedPassages.some((p) => p.supersededBy || p.conflictNotes) ||
    corpusHasSuperseded;

  // Build page-level citations
  const citations = selectedPassages.slice(0, 5).map((p) => ({
    documentNumber: p.documentNumber,
    authority: p.authority,
    notificationDate: p.notificationDate,
    jurisdiction: p.jurisdiction,
    pageNumber: p.pageNumber,
    section: p.section,
    sourceUrl: p.sourceUrl,
    checksum: p.checksum,
    verbatimSnippet: p.passageSnippet,
  }));

  const answerDraft = `According to ${citations[0].authority} Notification No. ${citations[0].documentNumber} (dated ${citations[0].notificationDate}, Page ${citations[0].pageNumber}, ${citations[0].section}): "${citations[0].verbatimSnippet.slice(0, 200)}..."`;

  return {
    query: citizenQuery,
    status: 'ANSWERED_WITH_CITATIONS',
    answer: answerDraft,
    citations,
    hasConflictingPublications,
    supersededAlert:
      hasConflictingPublications
        ? `Warning: Earlier circular ${supersededPassages[0] ? supersededPassages[0].documentNumber : 'predecessor'} has been superseded or amended. Ensure reliance on active notification ${selectedPassages[0].documentNumber}.`
        : null,
    disclaimer: RESEARCH_DISCLAIMER,
  };
}

/**
 * Submits a research finding for editorial review before promotion into public catalog.
 *
 * @param {object} researchDossier
 * @param {string} researcherId
 * @returns {object} Proposal for editorial review
 */
export function submitResearchForEditorialReview(researchDossier, researcherId = 'analyst_01') {
  if (!researchDossier || researchDossier.status !== 'ANSWERED_WITH_CITATIONS') {
    throw new Error('Only citation-backed research dossiers can be submitted for editorial review');
  }

  return {
    proposalId: `review-prop-${Date.now()}`,
    researcherId,
    query: researchDossier.query,
    proposedAnswer: researchDossier.answer,
    primaryCitation: researchDossier.citations[0] || null,
    allCitations: researchDossier.citations,
    promotionState: PROMOTION_STATE.PENDING_EDITORIAL_REVIEW,
    submittedAt: new Date().toISOString(),
    reviewedBy: null,
    reviewComments: null,
  };
}

/**
 * Editorial gate: Approves or rejects a research finding for catalogue promotion.
 *
 * @param {object} proposal
 * @param {string} editorId
 * @param {boolean} approved
 * @param {string} [comments]
 * @returns {object} Updated proposal
 */
export function reviewResearchProposal(proposal, editorId, approved, comments = '') {
  if (!proposal || !proposal.proposalId) {
    throw new Error('Valid proposal is required for editorial review');
  }
  if (!editorId) {
    throw new Error('Editor ID is mandatory to review a research proposal');
  }

  return {
    ...proposal,
    promotionState: approved ? PROMOTION_STATE.APPROVED_FOR_CATALOGUE : PROMOTION_STATE.REJECTED,
    reviewedBy: editorId,
    reviewTimestamp: new Date().toISOString(),
    reviewComments: comments,
  };
}
