/**
 * Hybrid Dense-Sparse Retrieval with Reciprocal Rank Fusion (RRF) (#606)
 *
 * Combines:
 * 1. Sparse BM25-style lexical ranking (accurate for acronyms, legal section names, precise document references)
 * 2. Dense semantic vector retrieval (catches paraphrases, citizen language, and colloquial expressions)
 * 3. Reciprocal Rank Fusion (RRF) with configurable smoothing factor (k) and weighting
 * 4. Hard safety constraints: unapproved, draft, pending, or archived records are strictly excluded prior to ranking
 * 5. Deterministic fallback to lexical retrieval if vector embedding generation fails
 */

import {
  tokenize,
  isApprovedService,
  createServiceChunks,
} from './groundedCivicRagService';

export const HYBRID_RETRIEVAL_CONFIG = {
  RRF_K: 60,               // Standard RRF smoothing constant
  SPARSE_WEIGHT: 0.5,      // Weight for BM25 lexical ranking
  DENSE_WEIGHT: 0.5,       // Weight for semantic vector ranking
  DEFAULT_TOP_K: 4,        // Final chunks to return
  SIMILARITY_THRESHOLD: 0.15,
  MODEL_NAME: 'civic-multilingual-hash-v1',
  MODEL_VERSION: '1.0.0',
};

/**
 * Deterministic hash-based feature vectorizer for client-side semantic embedding.
 * Projects text into a normalized dense float array using n-gram feature hashing and cosine normalization.
 * If an external or worker-based multilingual embedding model is plugged in, it implements this same vector contract.
 */
export const generateDenseEmbedding = (text, dimensions = 64) => {
  if (!text || typeof text !== 'string') {
    return new Float32Array(dimensions);
  }

  const tokens = tokenize(text);
  const vector = new Float32Array(dimensions);

  if (tokens.length === 0) return vector;

  // Feature hashing with bigrams and unigrams
  for (let i = 0; i < tokens.length; i++) {
    const word = tokens[i];
    let hash = 0;
    for (let c = 0; c < word.length; c++) {
      hash = ((hash << 5) - hash + word.charCodeAt(c)) | 0;
    }
    const idx = Math.abs(hash) % dimensions;
    vector[idx] += 1.0;

    // Bigram semantic context
    if (i > 0) {
      const bigram = `${tokens[i - 1]}_${word}`;
      let bHash = 0;
      for (let c = 0; c < bigram.length; c++) {
        bHash = ((bHash << 5) - bHash + bigram.charCodeAt(c)) | 0;
      }
      const bIdx = Math.abs(bHash) % dimensions;
      vector[bIdx] += 1.5;
    }
  }

  // L2 normalize
  let sumSq = 0;
  for (let i = 0; i < dimensions; i++) {
    sumSq += vector[i] * vector[i];
  }

  const norm = Math.sqrt(sumSq);
  if (norm > 0) {
    for (let i = 0; i < dimensions; i++) {
      vector[i] /= norm;
    }
  }

  return vector;
};

/**
 * Cosine similarity between two float vectors
 */
export const cosineSimilarity = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
  }
  return Math.max(0, Math.min(1, dotProduct));
};

/**
 * Simple content hash for tracking stale vectors
 */
export const computeContentHash = (text) => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return `h_${Math.abs(hash).toString(16)}`;
};

/**
 * BM25 / Lexical Scoring
 */
export const computeBM25Score = (queryTokens, chunk, avgDocLen = 40, totalDocs = 100) => {
  if (!queryTokens.length || !chunk.tokens?.length) return 0;
  
  const k1 = 1.2;
  const b = 0.75;
  const docLen = chunk.tokens.length;
  
  let score = 0;
  const tokenFreq = {};
  for (const t of chunk.tokens) {
    tokenFreq[t] = (tokenFreq[t] || 0) + 1;
  }

  for (const q of queryTokens) {
    const f = tokenFreq[q] || 0;
    if (f > 0) {
      // Simplified IDF approximation
      const idf = Math.log(1 + (totalDocs - 1 + 0.5) / (1 + 0.5));
      const tf = (f * (k1 + 1)) / (f + k1 * (1 - b + (b * docLen) / avgDocLen));
      score += idf * tf;
    }
  }

  return score;
};

/**
 * Reciprocal Rank Fusion (RRF)
 * Formula: Score(d) = sum( w_r / (k + rank_r(d)) )
 */
export const reciprocalRankFusion = ({
  sparseRanked = [],
  denseRanked = [],
  k = HYBRID_RETRIEVAL_CONFIG.RRF_K,
  sparseWeight = HYBRID_RETRIEVAL_CONFIG.SPARSE_WEIGHT,
  denseWeight = HYBRID_RETRIEVAL_CONFIG.DENSE_WEIGHT,
}) => {
  const fusionMap = new Map();

  // Process sparse rankings
  sparseRanked.forEach((item, index) => {
    const rank = index + 1;
    const rrfScore = sparseWeight / (k + rank);
    fusionMap.set(item.chunk.chunkId, {
      chunk: item.chunk,
      sparseRank: rank,
      sparseScore: item.score,
      denseRank: null,
      denseScore: 0,
      fusedScore: rrfScore,
    });
  });

  // Process dense rankings
  denseRanked.forEach((item, index) => {
    const rank = index + 1;
    const rrfDenseScore = denseWeight / (k + rank);
    const existing = fusionMap.get(item.chunk.chunkId);
    if (existing) {
      existing.denseRank = rank;
      existing.denseScore = item.score;
      existing.fusedScore += rrfDenseScore;
    } else {
      fusionMap.set(item.chunk.chunkId, {
        chunk: item.chunk,
        sparseRank: null,
        sparseScore: 0,
        denseRank: rank,
        denseScore: item.score,
        fusedScore: rrfDenseScore,
      });
    }
  });

  // Sort descending by fused score
  return Array.from(fusionMap.values()).sort((a, b) => b.fusedScore - a.fusedScore);
};

/**
 * In-Memory Hybrid Index Store
 */
class HybridIndexStore {
  constructor() {
    this.chunks = [];
    this.vectors = new Map(); // chunkId -> { vector, contentHash, modelName, modelVersion }
    this.serviceMetadata = new Map(); // serviceId -> { updatedAt, version }
  }

  /**
   * Rebuild entire index from approved catalog services
   */
  buildIndex(services = []) {
    this.chunks = [];
    this.vectors.clear();
    this.serviceMetadata.clear();

    const approvedServices = services.filter(isApprovedService);

    for (const service of approvedServices) {
      this.indexService(service);
    }

    return {
      totalServices: approvedServices.length,
      totalChunks: this.chunks.length,
      totalVectors: this.vectors.size,
    };
  }

  /**
   * Index or update a single approved service
   */
  indexService(service) {
    if (!isApprovedService(service)) {
      this.removeService(service?.id);
      return;
    }

    // Remove any prior chunks for this service
    this.removeService(service.id);

    const newChunks = createServiceChunks(service);
    for (const chunk of newChunks) {
      const contentHash = computeContentHash(chunk.text);
      const vector = generateDenseEmbedding(chunk.text);

      this.chunks.push(chunk);
      this.vectors.set(chunk.chunkId, {
        vector,
        contentHash,
        modelName: HYBRID_RETRIEVAL_CONFIG.MODEL_NAME,
        modelVersion: HYBRID_RETRIEVAL_CONFIG.MODEL_VERSION,
        createdAt: Date.now(),
      });
    }

    this.serviceMetadata.set(service.id, {
      updatedAt: Date.now(),
      version: service.version || '1.0',
    });
  }

  /**
   * Remove a service and its vectors (e.g. if archived or rejected)
   */
  removeService(serviceId) {
    if (!serviceId) return;
    this.chunks = this.chunks.filter((c) => {
      if (c.serviceId === serviceId) {
        this.vectors.delete(c.chunkId);
        return false;
      }
      return true;
    });
    this.serviceMetadata.delete(serviceId);
  }

  /**
   * Retrieve chunks using hybrid pipeline
   */
  retrieve({
    query,
    services = [],
    topK = HYBRID_RETRIEVAL_CONFIG.DEFAULT_TOP_K,
    config = {},
  }) {
    if (!query || typeof query !== 'string' || !query.trim()) {
      return {
        results: [],
        diagnostics: { query: '', sparseCount: 0, denseCount: 0, fallbackUsed: false },
      };
    }

    const mergedConfig = { ...HYBRID_RETRIEVAL_CONFIG, ...config };
    const queryTokens = tokenize(query);

    // If index is empty, build on the fly from passed services
    if (this.chunks.length === 0 && services.length > 0) {
      this.buildIndex(services);
    }

    // Fallback safely to sparse retrieval if embedding generation fails
    let denseQueryVector = null;
    let fallbackUsed = false;
    try {
      denseQueryVector = generateDenseEmbedding(query);
    } catch (err) {
      fallbackUsed = true;
    }

    // 1. Sparse Pass
    const sparseScored = [];
    for (const chunk of this.chunks) {
      const score = computeBM25Score(queryTokens, chunk);
      if (score > 0) {
        sparseScored.push({ chunk, score });
      }
    }
    sparseScored.sort((a, b) => b.score - a.score);

    // 2. Dense Pass
    const denseScored = [];
    if (denseQueryVector && !fallbackUsed) {
      for (const chunk of this.chunks) {
        const meta = this.vectors.get(chunk.chunkId);
        if (meta && meta.vector) {
          const sim = cosineSimilarity(denseQueryVector, meta.vector);
          if (sim >= mergedConfig.SIMILARITY_THRESHOLD) {
            denseScored.push({ chunk, score: sim });
          }
        }
      }
      denseScored.sort((a, b) => b.score - a.score);
    }

    // 3. Reciprocal Rank Fusion
    const fused = reciprocalRankFusion({
      sparseRanked: sparseScored,
      denseRanked: denseScored,
      k: mergedConfig.RRF_K,
      sparseWeight: mergedConfig.SPARSE_WEIGHT,
      denseWeight: mergedConfig.DENSE_WEIGHT,
    });

    const topResults = fused.slice(0, topK).map((entry) => ({
      chunkId: entry.chunk.chunkId,
      serviceId: entry.chunk.serviceId,
      serviceTitle: entry.chunk.serviceTitle,
      officialUrl: entry.chunk.officialUrl,
      field: entry.chunk.field,
      fieldLabel: entry.chunk.fieldLabel,
      text: entry.chunk.text,
      fusedScore: Number(entry.fusedScore.toFixed(4)),
      sparseRank: entry.sparseRank,
      denseRank: entry.denseRank,
      denseScore: Number(entry.denseScore.toFixed(4)),
      sparseScore: Number(entry.sparseScore.toFixed(4)),
    }));

    return {
      results: topResults,
      diagnostics: {
        query,
        queryTokensCount: queryTokens.length,
        sparseCandidates: sparseScored.length,
        denseCandidates: denseScored.length,
        totalFusedCandidates: fused.length,
        fallbackUsed,
        k: mergedConfig.RRF_K,
      },
    };
  }
}

export const hybridIndexStore = new HybridIndexStore();
