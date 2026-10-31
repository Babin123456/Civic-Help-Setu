/**
 * Retrieval-Augmented Civic Knowledge Assistant Service (#400)
 * 
 * Provides grounded, fact-checked responses to civic queries with complete source traceability.
 * 
 * Core Architectural & Safety Rules:
 * 1. Approved Content Only: Excludes draft, unapproved, pending, or archived services.
 * 2. Grounded Excerpts: Attaches traceable citations linking back to active catalogue records.
 * 3. Confidence & Coverage: Computes explicit coverage and relevance scores.
 * 4. Transparent Uncertainty: Explicitly declines to guess when evidence is absent (never hallucinating rules).
 */

export const RAG_CONFIDENCE_LEVELS = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  UNSUPPORTED: 'UNSUPPORTED',
};

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were',
  'will', 'with', 'what', 'how', 'when', 'where', 'who', 'which', 'can', 'i'
]);

/**
 * Tokenize and normalize text into clean words
 */
export const tokenize = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
};

/**
 * Check whether a service record is approved and published
 */
export const isApprovedService = (service) => {
  if (!service || typeof service !== 'object') return false;
  if (!service.id || (!service.title && !service.name)) return false;

  // Exclude drafts, pending submissions, rejected records, and archived guides
  if (service.isDraft === true || service.draftId) return false;
  if (service.archived === true) return false;
  if (service.status === 'pending' || service.status === 'rejected') return false;

  return true;
};

/**
 * Split an approved service into searchable semantic chunks with metadata
 */
export const createServiceChunks = (service) => {
  if (!isApprovedService(service)) return [];

  const chunks = [];
  const sId = service.id;
  const sTitle = service.title || service.name;
  const officialUrl = service.officialUrl || service.url || null;
  const dept = service.department || 'Government of India';

  // Title & Summary Chunk
  chunks.push({
    chunkId: `${sId}-meta`,
    serviceId: sId,
    serviceTitle: sTitle,
    officialUrl,
    field: 'general',
    fieldLabel: 'General Scheme Overview',
    department: dept,
    text: `${sTitle}. Department: ${dept}. ${service.description || ''}`,
    tokens: tokenize(`${sTitle} ${dept} ${service.description || ''}`),
  });

  // Eligibility Criteria Chunks
  const eligibility = Array.isArray(service.eligibility)
    ? service.eligibility
    : typeof service.eligibility === 'string'
      ? [service.eligibility]
      : [];

  if (eligibility.length > 0) {
    const text = eligibility.join('; ');
    chunks.push({
      chunkId: `${sId}-eligibility`,
      serviceId: sId,
      serviceTitle: sTitle,
      officialUrl,
      field: 'eligibility',
      fieldLabel: 'Eligibility Criteria',
      department: dept,
      text,
      tokens: tokenize(`${sTitle} eligibility criteria qualifications rules who can apply ${text}`),
    });
  }

  // Required Documents Chunks
  const documents = Array.isArray(service.documents)
    ? service.documents
    : Array.isArray(service.requiredDocuments)
      ? service.requiredDocuments
      : [];

  if (documents.length > 0) {
    const text = documents.join('; ');
    chunks.push({
      chunkId: `${sId}-documents`,
      serviceId: sId,
      serviceTitle: sTitle,
      officialUrl,
      field: 'documents',
      fieldLabel: 'Required Documents',
      department: dept,
      text,
      tokens: tokenize(`${sTitle} required documents paperwork certificates needed to apply ${text}`),
    });
  }

  // Application Process Steps Chunks
  const process = Array.isArray(service.process)
    ? service.process
    : Array.isArray(service.steps)
      ? service.steps
      : [];

  if (process.length > 0) {
    const text = process.join('; ');
    chunks.push({
      chunkId: `${sId}-process`,
      serviceId: sId,
      serviceTitle: sTitle,
      officialUrl,
      field: 'process',
      fieldLabel: 'Application Procedure',
      department: dept,
      text,
      tokens: tokenize(`${sTitle} application process procedure steps how to apply submit ${text}`),
    });
  }

  // Fees Chunk
  if (service.fees || service.fee) {
    const text = service.fees || service.fee;
    chunks.push({
      chunkId: `${sId}-fees`,
      serviceId: sId,
      serviceTitle: sTitle,
      officialUrl,
      field: 'fees',
      fieldLabel: 'Statutory Fees',
      department: dept,
      text,
      tokens: tokenize(`${sTitle} statutory fee fees charges cost payment ${text}`),
    });
  }

  return chunks;
};

/**
 * Score relevance of a chunk to a list of query tokens
 */
export const scoreChunkRelevance = (chunk, queryTokens) => {
  if (!queryTokens.length || !chunk.tokens.length) return 0;

  const chunkTokenSet = new Set(chunk.tokens);
  let matched = 0;

  for (const q of queryTokens) {
    if (chunkTokenSet.has(q)) {
      matched += 1;
    } else {
      // Substring match for prefixes/suffixes
      for (const c of chunkTokenSet) {
        if (c.includes(q) || q.includes(c)) {
          matched += 0.5;
          break;
        }
      }
    }
  }

  // Score normalized by query token count
  return Number((matched / queryTokens.length).toFixed(3));
};

/**
 * Retrieve top relevant chunks for a user query
 */
export const retrieveKnowledge = (query, services = [], options = {}) => {
  const { topK = 4 } = options;
  const qTokens = tokenize(query);

  if (!qTokens.length || !Array.isArray(services)) {
    return [];
  }

  // Filter approved services ONLY
  const approved = services.filter(isApprovedService);

  // Flatten chunks across all approved services
  const allChunks = approved.flatMap(createServiceChunks);

  // Score each chunk
  const scoredChunks = allChunks.map((chunk) => {
    const score = scoreChunkRelevance(chunk, qTokens);
    return { ...chunk, score };
  });

  // Filter out chunks with 0 score and sort descending
  return scoredChunks
    .filter((c) => c.score > 0.15)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
};

/**
 * Generate a grounded answer with traceable citations or an explicit uncertainty response
 */
export const queryCivicKnowledge = (query, services = []) => {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return {
      status: 'UNSUPPORTED',
      confidenceLevel: RAG_CONFIDENCE_LEVELS.UNSUPPORTED,
      coverageScore: 0,
      answer: 'Please enter a specific question about a civic service, required document, or eligibility rule.',
      citations: [],
      uncertaintyAcknowledged: true,
      query: '',
    };
  }

  const retrieved = retrieveKnowledge(query, services, { topK: 4 });

  // If no chunks matched or relevance is too low
  if (retrieved.length === 0 || retrieved[0].score < 0.20) {
    return {
      status: 'UNSUPPORTED',
      confidenceLevel: RAG_CONFIDENCE_LEVELS.UNSUPPORTED,
      coverageScore: 0,
      answer:
        'No verified catalogue sources found matching this inquiry. We cannot confirm the requirements without verified documentation. Please consult the responsible government department directly.',
      citations: [],
      uncertaintyAcknowledged: true,
      query,
    };
  }

  const topScore = retrieved[0].score;
  const primaryChunk = retrieved[0];

  // Build traceable citations
  const citations = retrieved.map((c, idx) => ({
    citationId: `cit-${idx + 1}`,
    serviceId: c.serviceId,
    serviceTitle: c.serviceTitle,
    field: c.field,
    fieldLabel: c.fieldLabel,
    excerpt: c.text,
    officialUrl: c.officialUrl,
    department: c.department,
    relevance: c.score,
  }));

  // Determine confidence & support status
  let status = 'SUPPORTED';
  let confidenceLevel = RAG_CONFIDENCE_LEVELS.HIGH;

  if (topScore >= 0.55) {
    status = 'SUPPORTED';
    confidenceLevel = RAG_CONFIDENCE_LEVELS.HIGH;
  } else {
    status = 'PARTIALLY_SUPPORTED';
    confidenceLevel = RAG_CONFIDENCE_LEVELS.MEDIUM;
  }

  // Synthesize grounded answer
  let answerText = '';

  if (status === 'SUPPORTED') {
    answerText = `Based on verified records for "${primaryChunk.serviceTitle}" (${primaryChunk.fieldLabel}):\n\n${primaryChunk.text}`;
    if (retrieved.length > 1 && retrieved[1].serviceId === primaryChunk.serviceId) {
      answerText += `\n\nAdditionally, under ${retrieved[1].fieldLabel}: ${retrieved[1].text}`;
    }
  } else {
    answerText = `Partially matching verified information was found for "${primaryChunk.serviceTitle}":\n\n${primaryChunk.text}\n\nNote: Some specific details or regional rules may not be fully covered in our catalogue. Please verify with official authorities.`;
  }

  return {
    status,
    confidenceLevel,
    coverageScore: Number((topScore * 100).toFixed(0)),
    answer: answerText,
    citations,
    uncertaintyAcknowledged: status === 'PARTIALLY_SUPPORTED',
    query,
  };
};
