import crypto from 'crypto';

/**
 * @file civicKnowledgeWatchtowerService.js
 * @description Monitors allowlisted official civic knowledge sources, detects content drift or outages,
 * computes source health scores, and gates automated knowledge updates behind human editorial review.
 */

export class CivicKnowledgeWatchtowerService {
  constructor(initialSources = []) {
    this.allowlistedSources = new Map();
    this.auditHistory = [];

    initialSources.forEach(s => this.registerSource(s));
  }

  registerSource(source) {
    if (!source || !source.id || !source.url) {
      throw new Error('Valid source object with id and url required');
    }

    this.allowlistedSources.set(source.id, {
      id: source.id,
      name: source.name || 'Unnamed Source',
      url: source.url,
      jurisdictionId: source.jurisdictionId || 'IN-CENTRAL',
      lastKnownHash: source.lastKnownHash || null,
      lastCheckedAt: null,
      consecutiveFailures: 0,
      totalChecks: 0,
      successfulChecks: 0,
      status: 'ACTIVE'
    });
  }

  getSource(id) {
    return this.allowlistedSources.get(id) || null;
  }

  listSources() {
    return Array.from(this.allowlistedSources.values());
  }

  /**
   * Ingests a new content snapshot, compares hashes, and updates source health.
   */
  processContentCheck(sourceId, fetchResult) {
    const source = this.allowlistedSources.get(sourceId);
    if (!source) {
      throw new Error(`Source not registered: ${sourceId}`);
    }

    const checkTimestamp = new Date().toISOString();
    source.totalChecks += 1;
    source.lastCheckedAt = checkTimestamp;

    if (!fetchResult.isSuccess) {
      source.consecutiveFailures += 1;
      const healthScore = this.computeHealthScore(source);
      const auditEntry = {
        checkId: `chk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        sourceId,
        timestamp: checkTimestamp,
        isSuccess: false,
        error: fetchResult.error || 'NETWORK_FAILURE',
        healthScore
      };
      this.auditHistory.unshift(auditEntry);
      return { status: 'CHECK_FAILED', sourceId, healthScore };
    }

    // Success
    source.consecutiveFailures = 0;
    source.successfulChecks += 1;
    const content = fetchResult.content || '';
    const currentHash = crypto.createHash('sha256').update(content).digest('hex');

    let driftDetected = false;
    let reviewRequired = false;

    if (source.lastKnownHash && source.lastKnownHash !== currentHash) {
      driftDetected = true;
      reviewRequired = true; // Content drift requires editorial review
    }

    const healthScore = this.computeHealthScore(source);

    const auditEntry = {
      checkId: `chk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sourceId,
      timestamp: checkTimestamp,
      isSuccess: true,
      currentHash,
      previousHash: source.lastKnownHash,
      driftDetected,
      reviewRequired,
      healthScore
    };
    this.auditHistory.unshift(auditEntry);

    // If drift detected, do not blindly overwrite without editorial gate
    if (!driftDetected) {
      source.lastKnownHash = currentHash;
    }

    return {
      status: driftDetected ? 'CONTENT_DRIFT_PENDING_REVIEW' : 'VERIFIED_UNCHANGED',
      sourceId,
      driftDetected,
      reviewRequired,
      proposedHash: currentHash,
      healthScore
    };
  }

  /**
   * Calculates health score (0 - 100) based on uptime ratio and recent failures.
   */
  computeHealthScore(source) {
    if (source.totalChecks === 0) return 100;
    const uptimeRatio = source.successfulChecks / source.totalChecks;
    let score = uptimeRatio * 100;

    // Penalty for consecutive recent failures
    if (source.consecutiveFailures > 0) {
      score -= Math.min(source.consecutiveFailures * 15, 60);
    }

    return Math.max(0, Math.round(score));
  }

  /**
   * Editorial gate: human maintainer reviews and approves the updated content hash.
   */
  approveDriftUpdate(sourceId, approvedHash, editorNotes = '') {
    const source = this.allowlistedSources.get(sourceId);
    if (!source) throw new Error(`Source not found: ${sourceId}`);

    source.lastKnownHash = approvedHash;

    const approvalAudit = {
      id: `appr_${Date.now()}`,
      sourceId,
      approvedHash,
      approvedAt: new Date().toISOString(),
      editorNotes
    };
    this.auditHistory.unshift(approvalAudit);

    return {
      sourceId,
      status: 'DRIFT_APPROVED_AND_COMMITTED',
      newHash: approvedHash
    };
  }
}

export const defaultWatchtowerService = new CivicKnowledgeWatchtowerService();
