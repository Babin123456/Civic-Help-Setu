/**
 * src/services/openContractingService.js
 * Business logic and data access service for Open Contracting Red-Flag Analytics (#751).
 *
 * Provides:
 * - Scoped queries and lifecycle assembly (Notice -> Bids -> Award -> Amendments -> Flags -> Reviews).
 * - RBAC enforcement across citizen, analyst, auditor, and admin personas.
 * - Idempotent audit review submissions with cryptographic seals.
 * - Least-privilege projection (redacting confidential auditor notes for citizen role).
 * - Offline queue synchronization.
 */

import {
  validateAuditReviewPayload,
  validateProcurementNotice,
  generateAuditSeal,
  sanitizeText,
} from '../data/openContractingContract.js';
import {
  loadStoredNotices,
  saveStoredNotices,
  loadStoredBids,
  loadStoredAwards,
  loadStoredAmendments,
  loadStoredVendors,
  loadStoredReviews,
  saveStoredReviews,
  loadAuditLogs,
  appendAuditLog,
  loadOfflineQueue,
  enqueueOfflineAction,
  clearOfflineQueue,
} from './openContractingStorage.js';
import { runProcurementRedFlagAnalytics } from './openContractingAnalyticsService.js';

export const openContractingService = {
  /**
   * Lists procurement notices with search, filtering, and pagination.
   */
  listNotices({ jurisdiction, category, search, page = 1, limit = 10 } = {}) {
    const allNotices = loadStoredNotices();
    let filtered = [...allNotices];

    if (jurisdiction && jurisdiction !== 'all') {
      filtered = filtered.filter((n) => n.jurisdiction === jurisdiction);
    }

    if (category && category !== 'all') {
      filtered = filtered.filter((n) => n.category === category);
    }

    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (n) =>
          n.title?.toLowerCase().includes(q) ||
          n.tenderRefNumber?.toLowerCase().includes(q) ||
          n.issuingAuthority?.toLowerCase().includes(q)
      );
    }

    const total = filtered.length;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      notices: paginated,
    };
  },

  /**
   * Retrieves a single notice by ID.
   */
  getNoticeById(id) {
    const notices = loadStoredNotices();
    return notices.find((n) => n.id === id) || null;
  },

  /**
   * Assembles the complete linked procurement lifecycle for a given notice.
   */
  getLinkedProcurementLifecycle(noticeId, userRole = 'citizen') {
    const notice = this.getNoticeById(noticeId);
    if (!notice) return null;

    const allBids = loadStoredBids();
    const allAwards = loadStoredAwards();
    const allAmendments = loadStoredAmendments();
    const allVendors = loadStoredVendors();
    const allReviews = loadStoredReviews();

    const bids = allBids
      .filter((b) => b.noticeId === noticeId)
      .map((b) => {
        const vendor = allVendors.find((v) => v.id === b.vendorId);
        return {
          ...b,
          vendorName: vendor ? vendor.name : b.vendorId,
        };
      });

    const award = allAwards.find((a) => a.noticeId === noticeId) || null;
    let winningVendor = null;
    let amendments = [];

    if (award) {
      winningVendor = allVendors.find((v) => v.id === award.vendorId) || null;
      amendments = allAmendments.filter((am) => am.awardId === award.id);
    }

    // Run analytics specifically for this notice
    const analytics = runProcurementRedFlagAnalytics({
      notices: [notice],
      bids,
      awards: award ? [award] : [],
      amendments,
      vendors: allVendors,
    });

    // Attach human review cases
    const noticeReviews = allReviews.filter((r) => r.noticeId === noticeId);

    // Apply least privilege: if role is citizen, redact confidential internal notes
    const sanitizedReviews = noticeReviews.map((r) => {
      if (userRole === 'citizen') {
        return {
          id: r.id,
          disposition: r.disposition,
          timestamp: r.timestamp,
          auditSeal: r.auditSeal,
          justification: 'Reviewed and certified by official oversight auditor.',
        };
      }
      return r;
    });

    return {
      notice,
      bids,
      award: award ? { ...award, vendor: winningVendor } : null,
      amendments,
      redFlags: analytics.redFlags.map((flag) => {
        const review = noticeReviews.find((r) => r.flagId === flag.id);
        return {
          ...flag,
          status: review ? review.disposition : flag.status,
          currentReview: review || null,
        };
      }),
      reviews: sanitizedReviews,
    };
  },

  /**
   * Runs the full analytics suite across all loaded data.
   */
  runAnalytics({ jurisdiction = null } = {}) {
    const notices = loadStoredNotices();
    const bids = loadStoredBids();
    const awards = loadStoredAwards();
    const amendments = loadStoredAmendments();
    const vendors = loadStoredVendors();
    const reviews = loadStoredReviews();

    const analysis = runProcurementRedFlagAnalytics({
      notices,
      bids,
      awards,
      amendments,
      vendors,
      jurisdictionFilter: jurisdiction,
    });

    // Merge existing human reviews into flags
    const enrichedFlags = analysis.redFlags.map((flag) => {
      const match = reviews.find((r) => r.flagId === flag.id || (flag.noticeId && r.noticeId === flag.noticeId));
      return {
        ...flag,
        status: match ? match.disposition : flag.status,
        auditReview: match || null,
      };
    });

    return {
      ...analysis,
      redFlags: enrichedFlags,
    };
  },

  /**
   * Submits an auditor review or false-positive disposition.
   */
  submitAuditReview({
    flagId,
    noticeId,
    reviewerId = 'AUD-OFFICER-001',
    reviewerRole = 'auditor',
    jurisdiction = 'Bengaluru Urban, Karnataka',
    disposition,
    justification,
    evidenceDocumentUrl = '',
    isOffline = false,
  }) {
    // RBAC validation: Citizen role is not permitted to submit audit reviews
    if (reviewerRole === 'citizen') {
      const err = new Error('PERMISSION_DENIED: Citizens have read-only access. Only auditors or analysts can record review outcomes.');
      err.code = 'PERMISSION_DENIED';
      throw err;
    }

    if (reviewerRole === 'analyst' && disposition === 'marked_false_positive') {
      const err = new Error('PERMISSION_DENIED: Only certified auditors can formally clear or mark red flags as false positives.');
      err.code = 'PERMISSION_DENIED';
      throw err;
    }

    // Validate review payload
    const validationErrors = validateAuditReviewPayload({
      flagId,
      disposition,
      justification,
      reviewerRole,
      evidenceDocumentUrl: evidenceDocumentUrl || undefined,
    });

    if (validationErrors.length > 0) {
      const err = new Error(validationErrors.join(' '));
      err.code = 'INVALID_PAYLOAD';
      err.errors = validationErrors;
      throw err;
    }

    const timestamp = new Date().toISOString();
    const auditSeal = generateAuditSeal(flagId, reviewerId, disposition, timestamp);

    const reviewRecord = {
      id: `REV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      flagId,
      noticeId,
      reviewerId,
      reviewerRole,
      jurisdiction,
      disposition,
      justification: sanitizeText(justification),
      evidenceDocumentUrl: evidenceDocumentUrl ? sanitizeText(evidenceDocumentUrl) : null,
      timestamp,
      auditSeal,
    };

    if (isOffline) {
      enqueueOfflineAction({
        type: 'SUBMIT_AUDIT_REVIEW',
        payload: reviewRecord,
      });
      return {
        review: reviewRecord,
        status: 'queued_offline',
        message: 'Review saved locally. It will sync automatically when your connection is restored.',
      };
    }

    // Persist review record
    const existingReviews = loadStoredReviews();
    const updatedReviews = [
      reviewRecord,
      ...existingReviews.filter((r) => r.flagId !== flagId),
    ];
    saveStoredReviews(updatedReviews);

    // Append to tamper-evident audit log
    appendAuditLog({
      action: 'SUBMIT_AUDIT_REVIEW',
      flagId,
      noticeId,
      reviewerId,
      reviewerRole,
      disposition,
      auditSeal,
      justificationSummary: sanitizeText(justification, 100),
    });

    return {
      review: reviewRecord,
      status: 'persisted',
      message: 'Audit review recorded successfully with tamper-evident seal.',
    };
  },

  /**
   * Helper for marking false positives with mandatory justification.
   */
  markFalsePositive({ flagId, noticeId, reviewerId, reviewerRole, jurisdiction, justification, evidenceDocumentUrl }) {
    return this.submitAuditReview({
      flagId,
      noticeId,
      reviewerId,
      reviewerRole,
      jurisdiction,
      disposition: 'marked_false_positive',
      justification,
      evidenceDocumentUrl,
    });
  },

  /**
   * Retrieves audit logs for the tamper-evident activity view.
   */
  getAuditLogs() {
    return loadAuditLogs();
  },

  /**
   * Imports a new procurement notice into the system.
   */
  importProcurementNotice(noticePayload) {
    const errors = validateProcurementNotice(noticePayload);
    if (errors.length > 0) {
      const err = new Error(errors.join(' '));
      err.code = 'INVALID_NOTICE';
      err.errors = errors;
      throw err;
    }

    const notices = loadStoredNotices();
    const exists = notices.some((n) => n.id === noticePayload.id || n.tenderRefNumber === noticePayload.tenderRefNumber);
    if (exists) {
      const err = new Error(`Notice with ID "${noticePayload.id}" or tenderRefNumber "${noticePayload.tenderRefNumber}" already exists.`);
      err.code = 'DUPLICATE_NOTICE';
      throw err;
    }

    const updated = [noticePayload, ...notices];
    saveStoredNotices(updated);

    appendAuditLog({
      action: 'IMPORT_PROCUREMENT_NOTICE',
      noticeId: noticePayload.id,
      tenderRefNumber: noticePayload.tenderRefNumber,
    });

    return noticePayload;
  },

  /**
   * Exports an audit dossier for transparency or official filing.
   */
  exportAuditDossier({ jurisdiction = 'all', userRole = 'citizen' } = {}) {
    const analysis = this.runAnalytics({ jurisdiction: jurisdiction === 'all' ? null : jurisdiction });
    const notices = loadStoredNotices();
    const awards = loadStoredAwards();
    const reviews = loadStoredReviews();

    const sanitizedReviews = reviews.map((r) => {
      if (userRole === 'citizen') {
        return {
          id: r.id,
          disposition: r.disposition,
          timestamp: r.timestamp,
          auditSeal: r.auditSeal,
        };
      }
      return r;
    });

    return {
      dossierTitle: 'Open Contracting Red-Flag Analytics & Audit Review Dossier',
      generatedAt: new Date().toISOString(),
      userRoleScope: userRole,
      jurisdictionScope: jurisdiction,
      summary: {
        totalNotices: notices.length,
        totalAwards: awards.length,
        redFlagsCount: analysis.totalRedFlagsDetected,
        severityBreakdown: analysis.flagsBySeverity,
      },
      redFlags: analysis.redFlags,
      auditReviews: sanitizedReviews,
      provenance: {
        rulesetVersion: analysis.rulesetVersion,
        statutoryStandards: 'Open Contracting Data Standard (OCDS) / CVC Vigilance Norms',
      },
    };
  },

  /**
   * Synchronizes queued offline actions.
   */
  syncOfflineQueue() {
    const queue = loadOfflineQueue();
    if (queue.length === 0) return { syncedCount: 0 };

    let synced = 0;
    queue.forEach((action) => {
      if (action.type === 'SUBMIT_AUDIT_REVIEW') {
        const existing = loadStoredReviews();
        saveStoredReviews([action.payload, ...existing.filter((r) => r.flagId !== action.payload.flagId)]);
        appendAuditLog({
          action: 'SYNCED_OFFLINE_REVIEW',
          flagId: action.payload.flagId,
          auditSeal: action.payload.auditSeal,
        });
        synced += 1;
      }
    });

    clearOfflineQueue();
    return { syncedCount: synced };
  },
};
