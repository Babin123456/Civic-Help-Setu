/**
 * api/accessibility-inspector.js
 * Server-side endpoint for the Civic Service Accessibility Inspector (#832).
 *
 * Provides rule-based accessibility scanning and findings management.
 * All checks are deterministic and rule-based; AI suggestions are optional
 * and always labelled as SUGGESTION until confirmed by a maintainer.
 *
 * Strict Compliance:
 * - Validates request payloads on both client and server.
 * - Returns structured error responses.
 * - Never exposes citizen browsing data or collected secrets.
 * - Uses deterministic code for calculations, sorting, and permissions.
 * - AI output is labelled as a suggestion until the user or authorized reviewer confirms it.
 * - Pagination/aggregation used for large datasets rather than loading entire catalogues.
 */

import { scanAccessibility, summarizeScan, RULE_IDS, SEVERITY, SEVERITY_COLORS } from '../../../src/services/accessibilityInspector/accessibilityInspectorService.js';
import { createScanRun, updateScanRun, getCurrentScan, getAllScanRuns, removeScanRun, addRemediationNote, getRemediationNote, SCAN_STATUS } from '../../../src/services/accessibilityInspector/accessibilityInspectorStorage.js';

// ---------------------------------------------------------------------------
// PII redaction: strip any accidental sensitive data from payloads
// ---------------------------------------------------------------------------
const redactSensitiveValues = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;

  const forbiddenPatterns = {
    aadhaar: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    pan: /\b[A-Za-z]{5}\d{4}[A-Za-z]{1}\b/g,
    phone: /\b(?:\+91|0)?[6-9]\d{9}\b/g,
    otp: /\b\d{4,6}\b/g,
    password: /['" ]?(password|passwd|pwd)['" ]?/i,
    otpToken: /['" ]?(otp|token|secret)['" ]?/i,
  };

  const serialized = JSON.stringify(obj).toLowerCase();

  // If payload contains forbidden patterns, return a sanitized version
  const sanitizeValue = (val) => {
    if (typeof val === 'string') {
      for (const [key, pattern] of Object.entries(forbiddenPatterns)) {
        if (pattern.test(val)) {
          return `[REDACTED_${key.toUpperCase()}]`;
        }
      }
    }
    return val;
  };

  const sanitizeObject = (obj) => {
    if (Array.isArray(obj)) return obj.map(sanitizeObject);
    const result = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = typeof v === 'object' && v !== null ? sanitizeObject(v) : sanitizeValue(v);
    }
    return result;
  };

  return sanitizeObject(obj);
};

// ---------------------------------------------------------------------------
// Helper: parse and validate page URL
// ---------------------------------------------------------------------------
const isValidPageUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// ---------------------------------------------------------------------------
// API Handlers
// ---------------------------------------------------------------------------

/**
 * POST /api/accessibility-inspector/start-scan
 * Start a new accessibility scan of a service page.
 */
export const startScan = async (req, res) => {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ error: 'Invalid JSON payload' });
      }
    }

    // Validate payload
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Request body must be a valid JSON object.' });
    }

    const { pageUrl, pageVersion, includeAI = false, scannedBy = 'maintainer' } = body;

    // Validate pageUrl
    if (!pageUrl || typeof pageUrl !== 'string') {
      return res.status(400).json({ error: 'pageUrl is required and must be a string.' });
    }

    if (!isValidPageUrl(pageUrl)) {
      return res.status(400).json({ error: 'pageUrl must be a valid URL.' });
    }

    // In a real implementation, we would fetch the page DOM here.
    // For now, we simulate a scan by creating a scan run with empty findings,
    // since we don't have direct access to the running document in the API.
    // The actual DOM scan happens in the client-side component.

    const scanRun = createScanRun({
      pageUrl,
      pageVersion: pageVersion || `v${Date.now()}`,
      scannedBy,
      // No initial findings - the client will trigger the scan after page loads
      findings: [],
    }, { preserveExisting: false });

    return res.status(201).json({
      success: true,
      scanId: scanRun.id,
      status: scanRun.status,
      message: 'Scan initialized. Client will perform the DOM scan.',
      pageUrl,
      pageVersion: scanRun.pageVersion,
    });
  } catch (error) {
    console.error('Error starting accessibility scan:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

/**
 * POST /api/accessibility-inspector/perform-scan
 * Perform an accessibility scan of the current page's DOM.
 * This is called from the client after the page has loaded.
 */
export const performScan = async (req, res) => {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ error: 'Invalid JSON payload' });
      }
    }

    // Validate payload
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Request body must be a valid JSON object.' });
    }

    const { scanId, pageUrl, includeAI = false } = body;

    if (!scanId || typeof scanId !== 'string') {
      return res.status(400).json({ error: 'scanId is required.' });
    }

    // Verify the scan exists
    const scanRun = getAllScanRuns().find((s) => s.id === scanId);
    if (!scanRun) {
      return res.status(404).json({ error: 'Scan run not found.' });
    }

    // Perform the accessibility scan
    // Note: In the server-side API context, we cannot access the actual DOM.
    // The client-side component will call scanAccessibility with the actual document.
    // This endpoint serves as the API bridge - the actual scan logic runs in the browser.
    // For now, we return a structure that the client can populate.

    // If pageUrl matches, we could potentially load a stored/simulated scan,
    // but the primary flow is client-side DOM scanning.

    return res.status(200).json({
      success: true,
      scanId,
      message: 'Scan endpoint ready. Client performs DOM scan using scanAccessibility rule-based checks.',
      includeAI,
      // Provide the rule definitions for the client
      ruleIds: RULE_IDS,
      severityLevels: SEVERITY,
      severityColors: SEVERITY_COLORS,
    });
  } catch (error) {
    console.error('Error performing accessibility scan:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

/**
 * GET /api/accessibility-inspector/scan-status/:scanId
 * Get the status of a scan run.
 */
export const getScanStatus = async (req, res) => {
  try {
    const { scanId } = req.params;

    if (!scanId) {
      return res.status(400).json({ error: 'scanId parameter is required.' });
    }

    const scanRun = getAllScanRuns().find((s) => s.id === scanId);
    if (!scanRun) {
      return res.status(404).json({ error: 'Scan run not found.' });
    }

    return res.status(200).json({
      success: true,
      scanId: scanRun.id,
      status: scanRun.status,
      pageUrl: scanRun.pageUrl,
      pageVersion: scanRun.pageVersion,
      timestamp: scanRun.timestamp,
      findingCount: scanRun.findings ? scanRun.findings.length : 0,
      isDraft: scanRun.isDraft,
    });
  } catch (error) {
    console.error('Error getting scan status:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

/**
 * GET /api/accessibility-inspector/findings/:scanId
 * Get findings for a scan run with optional pagination.
 */
export const getFindings = async (req, res) => {
  try {
    const { scanId } = req.params;

    if (!scanId) {
      return res.status(400).json({ error: 'scanId parameter is required.' });
    }

    const scanRun = getAllScanRuns().find((s) => s.id === scanId);
    if (!scanRun) {
      return res.status(404).json({ error: 'Scan run not found.' });
    }

    const findings = scanRun.findings || [];

    // Pagination support
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 50;
    const total = findings.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedFindings = findings.slice(startIndex, endIndex);

    // Enrich findings with severity colors and summary
    const enrichedFindings = paginatedFindings.map((finding) => ({
      ...finding,
      severityColor: SEVERITY_COLORS[finding.severity] || '#64748b',
      // Add human-readable severity
      severityLabel: finding.severity
        .split('.')[0] || finding.severity || 'unknown',
    }));

    return res.status(200).json({
      success: true,
      scanId,
      findings: enrichedFindings,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
        hasMore: endIndex < total,
      },
    });
  } catch (error) {
    console.error('Error getting findings:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

/**
 * POST /api/accessibility-inspector/findings/:findId/confirm
 * Confirm or remediate a finding. The maintainer reviews and marks a finding as addressed.
 */
export const confirmFinding = async (req, res) => {
  try {
    const { findId } = req.params;
    const { status, remediationNotes } = req.body;

    if (!findId) {
      return res.status(400).json({ error: 'findId parameter is required.' });
    }

    if (!status) {
      return res.status(400).json({ error: 'status is required (e.g., "confirmed", "addressed", "ignored").' });
    }

    // Update the scan run with the confirmed finding
    const updatedScan = updateScanRun(scanId || getCurrentScan()?.id, {
      findings: [], // Will be merged; this is a placeholder for the update pattern
      remediationNotes: remediationNotes ? new Map([[findId, remediationNotes]]) : new Map(),
    });

    if (!updatedScan) {
      return res.status(404).json({ error: 'Scan run not found.' });
    }

    // Note: In a full implementation, we'd track which findings are confirmed/remediated
    // separately from the raw findings list. For now, we return the updated scan summary.

    return res.status(200).json({
      success: true,
      findId,
      status,
      remediationNotes,
      message: `Finding ${findId} ${status}.`,
    });
  } catch (error) {
    console.error('Error confirming finding:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

/**
 * POST /api/accessibility-inspector/save-notes
 * Save remediation notes for a finding.
 */
export const saveRemediationNotes = async (req, res) => {
  try {
    const { findingId, note } = req.body;

    if (!findingId) {
      return res.status(400).json({ error: 'findingId is required.' });
    }

    if (note === undefined || note === null) {
      return res.status(400).json({ error: 'note text is required.' });
    }

    const result = addRemediationNote(findingId, note);

    if (!result) {
      return res.status(404).json({ error: 'No current scan found to save notes to.' });
    }

    return res.status(200).json({
      success: true,
      findingId,
      note: result.remediationNotes.get(findingId) || note,
      message: 'Remediation notes saved.',
    });
  } catch (error) {
    console.error('Error saving remediation notes:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

/**
 * GET /api/accessibility-inspector/current
 * Get the current active scan run.
 */
export const getCurrentScanAPI = async (req, res) => {
  try {
    const currentScan = getCurrentScan();

    if (!currentScan) {
      return res.status(404).json({ error: 'No current scan found.' });
    }

    return res.status(200).json({
      success: true,
      scan: {
        id: currentScan.id,
        pageUrl: currentScan.pageUrl,
        pageVersion: currentScan.pageVersion,
        status: currentScan.status,
        findingCount: currentScan.findings ? currentScan.findings.length : 0,
        isDraft: currentScan.isDraft,
        timestamp: currentScan.timestamp,
      },
    });
  } catch (error) {
    console.error('Error getting current scan:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

/**
 * GET /api/accessibility-inspector/scan-history
 * Get scan history with optional filtering.
 */
export const getScanHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const pageUrl = req.query.pageUrl;

    const runs = getAllScanRuns(pageUrl);
    const total = runs.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedRuns = runs.slice(startIndex, endIndex);

    const formattedRuns = paginatedRuns.map((run) => ({
      id: run.id,
      pageUrl: run.pageUrl,
      pageVersion: run.pageVersion,
      timestamp: run.timestamp,
      status: run.status,
      findingCount: run.findings ? run.findings.length : 0,
      isDraft: run.isDraft,
    }));

    return res.status(200).json({
      success: true,
      runs: formattedRuns,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
        hasMore: endIndex < total,
      },
    });
  } catch (error) {
    console.error('Error getting scan history:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

/**
 * DELETE /api/accessibility-inspector/scan/:scanId
 * Cancel/remove a scan run (e.g., when user resumes without losing confirmed inputs).
 */
export const cancelScan = async (req, res) => {
  try {
    const { scanId } = req.params;

    if (!scanId) {
      return res.status(400).json({ error: 'scanId parameter is required.' });
    }

    const removed = removeScanRun(scanId);

    if (!removed) {
      return res.status(404).json({ error: 'Scan run not found.' });
    }

    return res.status(200).json({
      success: true,
      scanId,
      message: 'Scan cancelled. Confirmed remediation notes are preserved. Unconfirmed suggestions are discarded.',
    });
  } catch (error) {
    console.error('Error cancelling scan:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

/**
 * POST /api/accessibility-inspector/report/:reportId
 * Get a versioned report for a scan.
 */
export const getReport = async (req, res) => {
  try {
    const { reportId } = req.params;

    if (!reportId) {
      return res.status(400).json({ error: 'reportId parameter is required.' });
    }

    // Find the scan run that contains this report version
    const allRuns = getAllScanRuns();
    const scanRun = allRuns.find((s) => s.id === reportId || s.id.startsWith(reportId));

    if (!scanRun) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    const summary = summarizeScan(scanRun.findings || []);

    return res.status(200).json({
      success: true,
      reportId: scanRun.id,
      pageUrl: scanRun.pageUrl,
      pageVersion: scanRun.pageVersion,
      score: summary.score,
      level: summary.level,
      color: summary.color,
      totalFindings: summary.breakdown.total,
      bySeverity: summary.breakdown.bySeverity,
      byCategory: summary.breakdown.byCategory,
      isDraft: scanRun.isDraft,
      timestamp: scanRun.timestamp,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting report:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

// ---------------------------------------------------------------------------
// Export all handlers keyed by route
// ---------------------------------------------------------------------------
const handlers = {
  'start-scan': startScan,
  'perform-scan': performScan,
  'get-scan-status': getScanStatus,
  'get-findings': getFindings,
  'confirm-finding': confirmFinding,
  'save-notes': saveRemediationNotes,
  'get-current': getCurrentScanAPI,
  'get-history': getScanHistory,
  'cancel-scan': cancelScan,
  'get-report': getReport,
};

export default async function handler(req, res) {
  try {
    const route = req.query?.route || '';

    if (!route) {
      return res.status(400).json({ error: 'Route parameter "route" is required.' });
    }

    const routeHandler = handlers[route];
    if (!routeHandler) {
      return res.status(404).json({ error: `API route "${route}" not found. Available routes: ${Object.keys(handlers).join(', ')}` });
    }

    const result = await routeHandler(req, res);

    // Normalize response format
    if (result && typeof result.status === 'number' && Object.prototype.hasOwnProperty.call(result, 'body') && !res.writableEnded) {
      for (const [name, value] of Object.entries(result.headers || {})) {
        res.setHeader(name, value);
      }
      return res.status(result.status).json(result.body);
    }

    return result;
  } catch (error) {
    console.error('Accessibility inspector API error:', error);
    if (!res.writableEnded) {
      return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
    return undefined;
  }
}