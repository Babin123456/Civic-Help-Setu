import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  RefreshCw,
  XCircle,
  Eye,
  FileCheck,
  Sparkles,
} from 'lucide-react';
import accessibilityInspectorService, {
  AI_SUGGESTION_MARKER,
} from '../services/accessibilityInspectorService';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { can } from '../services/accessControl';

// Utility: safely format numbers
const fmt = (n) => (n !== null && n !== undefined ? String(n) : '–');

// —————————————————————————————————————————————————————————————————————————————————————————
// Component: AccessibilityInspectorPanel
// ————————————————————————————————————————————————————————————————————————————————————————

const AccessibilityInspectorPanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = can('services.write', user);

  // State: scan management
  const [scans, setScans] = useState([]);
  const [activeScanId, setActiveScanId] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [pageVersion, setPageVersion] = useState('');

  // State: current scan details
  const [currentFindings, setCurrentFindings] = useState([]);
  const [currentScore, setCurrentScore] = useState({ score: 0, level: 'Unknown', badge: 'No Data' });
  const [readingOrder, setReadingOrder] = useState([]);
  const [selectedFinding, setSelectedFinding] = useState(null);
  const [viewMode, setViewMode] = useState('desktop'); // 'desktop' | 'mobile'

  // State: AI suggestions
  const [aiSuggestions, setAISuggestions] = useState([]);
  const [showAIExplanations, setShowAIExplanations] = useState(false);

  // State: remediation notes (per rule ID)
  const [remediationNotes, setRemediationNotes] = useState({});

  // ——— Load scans from storage ———
  useEffect(() => {
    const all = accessibilityInspectorService.readAllScans();
    setScans(all);
    // Set active scan to the most recent, or first available
    if (all.length > 0) {
      setActiveScanId(all[0].id);
      setPageVersion(all[0].pageVersion || 'unknown');
      setCurrentFindings(all[0].findings || []);
      setCurrentScore(accessibilityInspectorService.calculateAccessibilityScore(all[0].findings || []));
      setReadingOrder(accessibilityInspectorService.generateReadingOrderOutline(all[0].elements || []));
    }
  }, []);

  // ——— When active scan changes, update UI ———
  useEffect(() => {
    if (!activeScanId) return;
    const scan = scans.find((s) => s.id === activeScanId);
    if (scan) {
      setPageVersion(scan.pageVersion || 'unknown');
      setCurrentFindings(scan.findings || []);
      setCurrentScore(
        accessibilityInspectorService.calculateAccessibilityScore(scan.findings || [])
      );
      setReadingOrder(
        accessibilityInspectorService.generateReadingOrderOutline(scan.elements || [])
      );
      // Restore remediation notes if they exist
      const notesMap = {};
      (scan.remediationNotes || {}).forEach((note) => {
        notesMap[note.ruleId] = note.text || '';
      });
      setRemediationNotes(notesMap);
    }
  }, [activeScanId, scans]);

  // ——— Run new scan ———
  const handleRunScan = useCallback(
    (domElements = []) => {
      if (!isAdmin) {
        toast?.error('Only administrators can run accessibility scans.');
        return;
      }

      setIsScanning(true);
      // Run rule-based checks
      const findings = accessibilityInspectorService.runRuleBasedChecks({
        elements: domElements,
        selectedSelector: pageVersion,
      });

      // Calculate score
      const score = accessibilityInspectorService.calculateAccessibilityScore(findings);

      // Generate reading order outline
      const outline = accessibilityInspectorService.generateReadingOrderOutline(domElements);

      // Create scan object
      const scan = accessibilityInspectorService.writeScan({
        pageVersion,
        findings,
        score,
        overallLevel: score.level,
        elements: domElements,
      });

      setActiveScanId(scan.id);
      setScans(prev => prev.map((s) => s.id === scan.id ? scan : s));

      // Generate AI suggestions (labelled as suggestions only)
      const suggestions = findings.map((f) =>
        accessibilityInspectorService.generateAISuggestion(f, findings)
      );
      setAISuggestions(suggestions);

      setIsScanning(false);
      toast?.success(`Accessibility scan completed. Score: ${fmt(score.score)}% (${score.level}).`);
    },
    [isAdmin, pageVersion, toast]
  );

  // ——— Cancel/resume: clear current scan ———
  const handleCancelScan = useCallback(() => {
    setActiveScanId(null);
    setPageVersion('');
    setCurrentFindings([]);
    setCurrentScore({ score: 0, level: 'Unknown', badge: 'No Data' });
    setReadingOrder([]);
    setFocusPath([]);
    setContrastPreview(null);
    setSelectedFinding(null);
    setAISuggestions([]);
    setRemediationNotes({});
    toast?.info('Scan cleared. No data saved permanently unless you publish a report.');
  }, []);

  // ——— Select a finding ———
  const handleSelectFinding = useCallback(
    (finding) => {
      setSelectedFinding(finding);

      // Generate contrast preview if relevant
      if (finding.ruleId === 'color-contrast' && finding.evidence) {
        // Try to extract color info from evidence or context
        setContrastPreview({
          foreground: finding.evidence?.foregroundColor || null,
          background: finding.evidence?.backgroundColor || null,
          ratio: finding.evidence?.ratio || null,
          passed: finding.evidence?.passed || null,
        });
      } else {
        setContrastPreview(null);
      }

      // Show AI explanation if enabled and finding has evidence
      if (showAIExplanations && finding.evidence) {
        const explanation = accessibilityInspectorService.generateFindingExplanation(finding);
        // Display as temporary toast or inline - for now just log
        toast?.info(explanation);
      }
    },
    [showAIExplanations, toast]
  );

  // ——— Confirm / reject AI suggestion ———
  const handleConfirmAISuggestion = useCallback(
    (suggestionId) => {
      // Mark suggestion as confirmed (in a real implementation, this would
      // update the finding's reviewerStatus or add remediation notes)
      setRemediationNotes((prev) => ({
        ...prev,
        [suggestionId]: `${prev[suggestionId] || 'Confirmed AI suggestion'}`,
      }));
      toast?.success('AI suggestion confirmed and saved to remediation notes.');
    },
    [toast]
  );

  const handleRejectAISuggestion = useCallback(
    (suggestionId) => {
      setRemediationNotes((prev) => {
        const { [suggestionId]: _, ...rest } = prev;
        return rest;
      });
      toast?.info('AI suggestion rejected. Finding remains under review.');
    },
    [toast]
  );

  // ——— Desktop / Mobile view switch ———
  const handleToggleViewMode = useCallback(() => {
    setViewMode((prev) => (prev === 'desktop' ? 'mobile' : 'desktop'));
    toast?.info(`View mode switched to ${viewMode === 'desktop' ? 'mobile' : 'desktop'}.`);
  }, [viewMode, toast]);

  // ——— AI explanations toggle ———
  const handleToggleAIExplanations = useCallback(() => {
    setShowAIExplanations((prev) => !prev);
  }, []);

  // ——— Export / generate report ———
  const handleGenerateReport = useCallback(() => {
    if (!activeScanId) {
      toast?.error('No scan data to generate report from.');
      return;
    }

    const scan = scans.find((s) => s.id === activeScanId);
    if (!scan) return;

    // Build a structured report that maintains versioning
    const report = {
      id: `report_${activeScanId}_${new Date().toISOString().slice(0, 10)}`,
      scanId: activeScanId,
      pageVersion: scan.pageVersion,
      generatedAt: new Date().toISOString(),
      overallScore: currentScore.score,
      overallLevel: currentScore.level,
      totalFindings: (scan.findings || []).length,
      passedFindings: (scan.findings || []).filter((f) => f.passed).length,
      failedFindings: (scan.findings || []).filter((f) => !f.passed).length,
      findings: scan.findings.map((f) => ({
        ruleId: f.ruleId,
        name: f.name,
        severity: f.severity,
        passed: f.passed,
        evidence: f.evidence,
        reviewerStatus: f.reviewerStatus || 'pending-review',
        remediationNotes: remediationNotes[f.ruleId] || '',
        aiSuggestion: f.aiSuggestionId
          ? { text: f.aiSuggestionText, labelledAsSuggestion: true }
          : null,
        sourceVersion: scan.timestamp,
      })),
      remediationSummary: Object.entries(remediationNotes)
        .filter(([_, text]) => text.trim())
        .map(([ruleId, text]) => ({
          ruleId,
          text,
        })),
      // Distinguish saved user progress from official status
      // 'draft' status means this is maintainer progress; 'published' would be official
      status: 'draft',
    };

    // In a real implementation, this would trigger a download or API call
    // For now, provide a downloadable JSON
    try {
      const blob = new Blob([JSON.stringify(report, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `accessibility-inspector-report-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast?.success('Accessibility report generated and downloaded as JSON.');
    } catch (err) {
      toast?.error('Failed to generate report.');
    }
  }, [activeScanId, currentScore, remediationNotes, toast]);

  // ——— Keyboard shortcuts ———
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Escape to cancel/close
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancelScan();
      }
      // Number keys 1-5 to quickly filter by severity
      if (e.key >= '1' && e.key <= '5') {
        e.preventDefault();
        const severityMap = {
          '1': 'critical',
          '2': 'high',
          '3': 'medium',
          '4': 'low',
          '5': 'info',
        };
        // Could filter findings by severity
        toast?.info(`Severity filter: ${severityMap[e.key]}`);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleCancelScan]);

  // ——— Memoize filtered findings ———
  const filteredFindings = useMemo(() => {
    if (!currentFindings.length) return [];
    // Filter by severity if needed
    return currentFindings;
  }, [currentFindings]);

  // ——— Render severity badge color ———
  const severityBadgeColor = (severity) => {
    const colors = {
      critical: '#dc2626',
      high: '#ef4444',
      medium: '#f59e0b',
      low: '#eab308',
      info: '#3b82f6',
    };
    return colors[severity] || 'var(--text-secondary)';
  };

  // ——— Render view ———
  const renderScanHistory = useMemo(() => {
    return scans.map((scan, idx) => ({
      id: scan.id,
      pageVersion: scan.pageVersion,
      timestamp: scan.timestamp,
      score: scan.score,
      findingCount: scan.findings?.length || 0,
    }));
  }, [scans]);

  // ——— Main render ———
  return (
    <section
      className="glass-panel"
      style={{
        width: '100%',
        maxWidth: '1400px',
        maxHeight: 'calc(100vh - 4rem)',
        overflow: 'auto',
        borderRadius: '1rem',
        border: '1px solid var(--border-main)',
        padding: '1.5rem',
        margin: '2rem auto',
      }}
      role="region"
      aria-label="Civic Service Accessibility Inspector"
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.3rem', fontWeight: 700 }}>
            Accessibility Inspector
          </h2>
          <p style={{ margin: '0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            AI-assisted preview of civic service page accessibility & reading order
          </p>
        </div>

        {/* Admin actions visible only to admins */}
        {isAdmin && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => handleRunScan()}
              disabled={isScanning}
              className="btn btn-primary"
              style={{
                fontSize: '0.85rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              <RefreshCw size={14} className={isScanning && 'animate-spin'} /> Scan Page
            </button>

            <button
              type="button"
              onClick={handleCancelScan}
              className="btn btn-secondary"
              style={{
                fontSize: '0.85rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              <XCircle size={14} /> Cancel
            </button>
          </div>
        )}

        {/* View mode switch (always visible for preview purposes) */}
        {isAdmin && (
          <button
            type="button"
            onClick={handleToggleViewMode}
            className="btn btn-outline"
            style={{
              fontSize: '0.8rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.2rem',
            }}
          >
            <Eye size={14} /> {viewMode === 'desktop' ? 'Mobile' : 'Desktop'}
          </button>
        )}

        {/* AI explanations toggle (admin only) */}
        {isAdmin && (
          <button
            type="button"
            onClick={handleToggleAIExplanations}
            className="btn btn-outline"
            style={{
              fontSize: '0.8rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.2rem',
            }}
          >
            <Sparkles size={12} /> AI Suggestions
          </button>
        )}

        {/* Report button */}
        {isAdmin && (
          <button
            type="button"
            onClick={handleGenerateReport}
            className="btn btn-secondary"
            style={{
              fontSize: '0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
          >
            <FileCheck size={14} /> Generate Report
          </button>
        )}
      </header>

      {/* Score Summary */}
      <div className="score-summary" style={({
        background: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border-main)',
        borderRadius: '0.75rem',
        padding: '1rem 1.25rem',
        marginBottom: '1.5rem',
      })}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>
              Accessibility Score
            </span>
            <div
              style={{
                fontSize: '2.25rem',
                fontWeight: 800,
                color: currentScore.score >= 80 ? '#10b981' : currentScore.score >= 60 ? '#f59e0b' : '#dc2626',
                marginTop: '0.15rem',
              }}
            >
              {fmt(currentScore.score)}%
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              {fmt(currentScore.level)} — {fmt(currentScore.badge)}
            </span>
          </div>

          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>
              Total Issues
            </span>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {fmt(currentFindings.length)}
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              scanned
            </span>
          </div>

          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>
              Reading Order Nodes
            </span>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {fmt(readingOrder.length)}
            </div>
          </div>
        </div>
      </div>

      {/* Findings Grid / List */}
      <div
        style={{
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-main)',
          borderRadius: '0.75rem',
          padding: '1rem',
          marginBottom: '1.5rem',
          maxHeight: '500px',
          overflow: 'auto',
        }}
      >
        <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: 600 }}>
          Accessibility Issues ({fmt(currentFindings.length)})
        </h3>

        {currentFindings.length === 0 ? (
          <p style={{ padding: '1rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
            No accessibility issues found. The page passes basic rule-based checks.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '0.6rem' }}>
            {currentFindings.map((finding) => {
              const severityColor = severityBadgeColor(finding.severity);
              const aiSuggestion = aiSuggestions.find((s) => s.findingId === finding.id);
              const hasRemediation = remediationNotes[finding.ruleId] && remediationNotes[finding.ruleId].trim();

              return (
                <div
                  key={finding.id}
                  style={{
                    padding: '0.75rem 1rem',
                    border: '1px solid var(--border-light, rgba(0, 0, 0, 0.08))',
                    borderRadius: '0.5rem',
                    background: hasRemediation ? 'rgba(16, 185, 129, 0.03)' : 'var(--bg-main, #f8fafc)',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectFinding(finding)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectFinding(finding);
                    }
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          marginBottom: '0.25rem',
                        }}
                      >
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '999px',
                            backgroundColor: severityColor,
                            flexShrink: 0,
                          }}
                        />
                        <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                          {finding.name}
                        </strong>
                      </div>

                      <p
        style={{
          margin: '0.1rem 0 0',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          whiteSpace: 'pre-wrap',
        }}
        >
          {finding.evidence?.reason || 'No description available'}
        </p>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '0.2rem',
                          backgroundColor: finding.passed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: finding.passed ? '#10b981' : '#dc2626',
                          fontWeight: 600,
                        }}
                      >
                        {finding.passed ? 'PASS' : 'FAIL'}
                      </span>

                      {/* AI suggestion badge (only visible to admins) */}
                      {isAdmin && aiSuggestion && (
                        <span
                          style={{
                            marginTop: '0.2rem',
                            fontSize: '0.65rem',
                            padding: '0.1rem 0.3rem',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            color: '#3b82f6',
                            borderRadius: '0.2rem',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {AI_SUGGESTION_MARKER} {aiSuggestion.text.slice(0, 60)}${aiSuggestion.text.length > 60 ? '...' : ''}
                        </span>
                      )}

                      {/* Remediation note indicator */}
                      {hasRemediation && (
                        <span
                          style={{
                            marginTop: '0.2rem',
                            fontSize: '0.65rem',
                            padding: '0.1rem 0.3rem',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            color: '#10b981',
                            borderRadius: '0.2rem',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          ✎ saved
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Finding Detail Panel (right side when a finding is highlighted) */}
      {selectedFinding && (
        <div
          style={{
            width: '100%',
            background: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border-main)',
            borderRadius: '0.75rem',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            overflow: 'auto',
          }}
        >
          <h3 style={{ margin: '-0.25rem 0 0.75rem 0', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ color: severityBadgeColor(selectedFinding.severity) }}>
              {selectedFinding.name}
            </span>
            {selectedFinding.passed ? ' ✓' : ' ✗'}
          </h3>

          <div style={{ marginBottom: '0.75rem' }}>
            <strong>Rule ID:</strong> {selectedFinding.ruleId}
            <br />
            <strong>Severity:</strong> {selectedFinding.severity}
            <br />
            <strong>Status:</strong> {selectedFinding.passed ? 'Passed' : 'Failed'}
            <br />
            <strong>Evidence:</strong> {selectedFinding.evidence?.reason || '—'}
            <br />
            <strong>Selector:</strong> {selectedFinding.selector || '—'}
            <br />
            <strong>Timestamp:</strong> {selectedFinding.timestamp ? new Date(selectedFinding.timestamp).toLocaleString() : '—'}
          </div>

          {/* AI Suggestion for this finding */}
          {isAdmin && (
            <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '0.5rem', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <strong style={{ fontSize: '0.75rem', color: '#3b82f6', marginRight: '0.25rem' }}>AI Suggestion:</strong>
              <p
                style={{
                  margin: '0.1rem 0 0',
                  fontSize: '0.8rem',
                  color: 'var(--text-primary)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {AI_SUGGESTION_MARKER}
                {aiSuggestions.find((s) => s.findingId === selectedFinding.id)?.text ||
                  'Review this finding for accessibility compliance. Consider semantic labeling, landmark roles, or reading-order adjustments.'}
              </p>

              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => handleConfirmAISuggestion(selectedFinding.ruleId)}
                  style={{
                    flex: 1,
                    padding: '0.3rem 0.5rem',
                    fontSize: '0.75rem',
                    borderRadius: '0.3rem',
                    border: 'none',
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => handleRejectAISuggestion(selectedFinding.ruleId)}
                  style={{
                    flex: 1,
                    padding: '0.3rem 0.5rem',
                    fontSize: '0.75rem',
                    borderRadius: '0.3rem',
                    border: '1px solid #d1d5db',
                    background: 'white',
                    color: '#6b7280',
                    cursor: 'pointer',
                  }}
                >
                  Reject
                </button>
              </div>
            </div>
          )}

          {/* Remediation notes textarea (admin only) */}
          {isAdmin && (
            <textarea
              placeholder="Add remediation notes…"
              value={remediationNotes[selectedFinding.ruleId] || ''}
              onChange={(e) =>
                setRemediationNotes((prev) => ({
                  ...prev,
                  [selectedFinding.ruleId]: e.target.value.trim(),
                }))
              }
              style={{
                width: '100%',
                padding: '0.5rem',
                fontSize: '0.85rem',
                borderRadius: '0.3rem',
                border: '1px solid var(--border-light)',
                marginTop: '0.5rem',
                minHeight: '100px',
                resize: 'vertical',
              }}
            />
          )}

          {/* Jump to element placeholder - would integrate with DOM highlighting in full implementation */}
          <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            <strong>Jump to element:</strong> In a full browser integration, selecting this would highlight the affected DOM node and add focus outlines. This inspector records the selector for later reference.
          </div>
        </div>
      )}

      {/* Reading Order Outline (bottom section) */}
      <div
        style={{
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-main)',
          borderRadius: '0.75rem',
          padding: '1rem',
          marginBottom: '1.5rem',
          maxHeight: '400px',
          overflow: 'auto',
        }}
      >
        <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: 600 }}>
          DOM Reading Order Outline
        </h3>

        {viewMode === 'desktop' ? (
          renderReadingOrderDesktop(readingOrder)
        ) : (
          renderReadingOrderMobile(readingOrder)
        )}
      </div>

      {/* AI Suggestions Summary (collapsible) */}
      {isAdmin && aiSuggestions.length > 0 && (
        <div
          style={{
            background: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border-main)',
            borderRadius: '0.75rem',
            padding: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <strong style={{ fontSize: '0.85rem' }}>AI Suggestions ({aiSuggestions.length})</strong>
            <small style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              {AI_SUGGESTION_MARKER} suggestions require maintainer review</small>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {aiSuggestions
              .slice(0, 5) // Show first 5
              .map(
                (s, i) => `${i + 1}. ${s.text.slice(0, 80)}${s.text.length > 80 ? '…' : ''}`
              )}
              {aiSuggestions.length > 5 && `+ ${aiSuggestions.length - 5} more`}
          </div>
        </div>
      )}

      {/* Footer with help links */}
      <footer
        style={{
          marginTop: '1.5rem',
          paddingTop: '1rem',
          borderTop: '1px solid var(--border-light)',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          textAlign: 'center',
        }}
      >
        <p>
          <strong>Civic Help Setu — Accessibility Inspector</strong>{' '}
          {'\u00A9'} 2026 Government maintains data version: v1.0{' '}
          {'\u00A0'}(<a href="#"
            style={{ color: 'var(--accent-main)', textDecoration: 'underline' }}
            onClick={() => {
              // In production, link to official accessibility guidelines
              toast?.info('Consult WCAG 2.1 guidelines and official authority sources.');
            }}>
            guidelines
          </a>)
        </p>
        <p>
          {AI_SUGGESTION_MARKER} All AI output is labelled as a suggestion until the user or authorized reviewer confirms it.
        </p>
      </footer>
    </section>
  );
};

/* --- Reading order sub-components --- */

const renderReadingOrderDesktop = (outline) => {
  if (!outline || outline.length === 0) {
    return <p style={{ padding: '1rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>No reading order nodes found.</p>;
  }

  return (
    <ol style={{ counterReset: 'reading-node', paddingLeft: '1.5rem', margin: 0 }}>
      {outline.map((node, idx) => {
        const number = idx + 1;
        return (
          <li
            key={node.id}
            style={{
              marginBottom: '0.5rem',
              paddingLeft: '0.75rem',
              borderLeft: `3px solid ${node.isInteractive ? 'var(--accent-main)' : 'var(--border-light)'}`,
              lineHeight: '1.5',
            }}
          >
            <span style={{ display: 'inline-block', width: '2rem', fontFamily: 'monospace', color: 'var(--text-tertiary)' }}>{number}</span>
            <strong style={{ color: 'var(--text-primary)' }}>{node.role}</strong>
            {node.tag !== 'division' && node.tag !== 'region' && (
              <span style={{ marginLeft: '0.5rem', color: 'var(--text-secondary)' }}>{node.tag}</span>
            )}
            {node.visibleText && (
              <span
                style={{
                  display: 'block',
                  marginTop: '0.2rem',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {node.visibleText.substring(0, 120)}{node.visibleText.length > 120 ? '…' : ''}
              </span>
            )}
            {node.isInteractive && (
              <span style={{ float: 'right', color: 'var(--accent-main)' }}>⚡ interactive</span>
            )}
          </li>
        );
      })}
    </ol>
  );
};

const renderReadingOrderMobile = (outline) => {
  if (!outline || outline.length === 0) {
    return <p style={{ padding: '1rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>No reading order nodes found.</p>;
  }

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      {outline.map((node, idx) => {
        return (
          <div
            key={node.id}
            style={{
              padding: '0.5rem',
              borderRadius: '0.4rem',
              background: node.isInteractive ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
              border: '1px solid var(--border-light, rgba(0, 0, 0, 0.08))',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.2rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{node.role}</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{idx + 1}</span>
            </div>
            {node.visibleText && (
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  whiteSpace: 'pre-wrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  '-webkit-line-clamp': 3,
                  '-webkit-box-orient': 'vertical',
                }}
              >
                {node.visibleText}
              </div>
            )}
            {node.isInteractive && (
              <small style={{ color: 'var(--accent-main)', display: 'block', marginTop: '0.2rem' }}>⚡ interactive</small>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default AccessibilityInspectorPanel;
