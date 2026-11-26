import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import AccessibilityToolbar from '../../components/common/AccessibilityToolbar';
import { scanAccessibility, summarizeScan, RULE_IDS, SEVERITY, SEVERITY_COLORS, EVIDENCE_TYPE, SCAN_STATUS } from '../../services/accessibilityInspector/accessibilityInspectorService';
import { getCurrentScan, getAllScanRuns, updateScanRun, addRemediationNote } from '../../services/accessibilityInspector/accessibilityInspectorStorage';
import IssueCard from './IssueCard';
import FocusPath from './FocusPath';
import ReadingOrderOutline from './ReadingOrderOutline';
import ContrastPreview from './ContrastPreview';

// ---------------------------------------------------------------------------
// AccessibilityInspector - Main component
// ---------------------------------------------------------------------------

const AccessibilityInspector = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // Parse scan ID from URL
  const scanId = location.pathname.replace('/inspector/', '');

  // Load scan data from storage
  const loadScanData = useCallback(() => {
    let scan;
    if (scanId) {
      scan = getAllScanRuns().find((s) => s.id === scanId);
    } else {
      scan = getCurrentScan();
    }

    if (scan) {
      return {
        currentScan: scan,
        findings: scan.findings || [],
        summary: summarizeScan(scan.findings || []),
        elementTree: scan.elementTree || [],
      };
    }

    return {
      currentScan: null,
      findings: [],
      summary: { score: null, level: 'UNKNOWN', color: '#64748b', breakdown: { total: 0, bySeverity: {}, byCategory: {} } },
      elementTree: [],
    };
  }, [scanId]);

  const { currentScan, findings, summary, elementTree } = loadScanData();

  // Toggle AI suggestions
  const [isAIEnabled, setIsAIEnabled] = useState(false);

  // State
  const [focusedFindingId, setFocusedFindingId] = useState(null);
  const [viewMode, setViewMode] = useState('desktop'); // 'desktop' | 'mobile'
  const [selectedElement, setSelectedElement] = useState(null);

  // Effect: persist scan when findings change
  useEffect(() => {
    if (currentScan && currentScan.id) {
      updateScanRun(currentScan.id, {
        findings,
        isDraft: false,
      });
    }
  }, [currentScan, findings]);

  // Select a finding - highlight the element
  const selectFinding = useCallback((finding) => {
    setFocusedFindingId(finding.ruleId);
    setSelectedElement({
      ruleId: finding.ruleId,
      selector: finding.affectedSelector,
      text: finding.evidence?.message || 'No description available',
    });
  }, []);

  // Deselect finding
  const deselectFinding = useCallback(() => {
    setFocusedFindingId(null);
    setSelectedElement(null);
  }, []);

  // Get color for severity
  const getSeverityColor = (severity) => {
    return SEVERITY_COLORS[severity] || '#64748b';
  };

  // Get severity label
  const getSeverityLabel = (severity) => {
    const mapping = {
      [SEVERITY.CRITICAL]: 'Critical',
      [SEVERITY.HIGH]: 'High',
      [SEVERITY.MEDIUM]: 'Medium',
      [SEVERITY.LOW]: 'Low',
    };
    return mapping[severity] || severity;
  };

  // Toggle between desktop and mobile view
  const toggleViewMode = useCallback(() => {
    setViewMode(prev => prev === 'desktop' ? 'mobile' : 'desktop');
  }, []);

  // Get findings grouped by category
  const getFindingsByCategory = useCallback(() => {
    const categories = {
      heading: [],
      form: [],
      contrast: [],
      landmark: [],
      media: [],
      focus: [],
      other: [],
    };

    findings.forEach((f) => {
      const baseId = f.ruleId.split('.')[0];
      if (categories[baseId] !== undefined) {
        categories[baseId].push(f);
      } else {
        categories.other.push(f);
      }
    });

    return categories;
  }, [findings]);

  // Get AI-labelled findings (separate from rule-based)
  const getAIFindings = useCallback(() => {
    return findings.filter((f) => f.evidence?.type === EVIDENCE_TYPE.AI_SUGGESTION);
  }, [findings]);

  // Get rule-based findings
  const getRuleFindings = useCallback(() => {
    return findings.filter((f) => f.evidence?.type !== EVIDENCE_TYPE.AI_SUGGESTION);
  }, [findings]);

  // Handle confirmed remediation for a finding
  const handleConfirmRemediation = useCallback((finding) => {
    // Add remediation note
    addRemediationNote(finding.id, `Remediated: ${finding.ruleId}`);

    // Update finding status
    const updatedFindings = findings.map((f) => {
      if (f.id === finding.id) {
        return { ...f, severity: 'low' };
      }
      return f;
    });

    setFindings(updatedFindings);
    setFocusedFindingId(null);
    setSelectedElement(null);

    toast({
      title: 'Remediation Confirmed',
      description: `Finding ${finding.ruleId} has been addressed.`,
    });
  }, [findings, toast]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AccessibilityToolbar />

      <div className="flex min-h-screen">
        {/* Sidebar - Findings List */}
        <aside className="w-64 bg-card bg-opacity-80 border-r border-flex overflow-y-auto">
          <div className="p-4 border-b border-border">
            <h2 className="text-xl font-semibold">
              Accessibility Findings ({findings.length})
            </h2>
          </div>

          {/* Summary stats */}
          <div className="p-3 text-sm">
            <div className="flex items-center gap-2">
              <span className={getSeverityColor(SEVERITY.CRITICAL) + ' text-sm font-medium'}>
                {summary?.bySeverity[SEVERITY.CRITICAL] || 0} Critical
              </span>
              <span className={getSeverityColor(SEVERITY.HIGH) + ' text-sm font-medium'}>
                {summary?.bySeverity[SEVERITY.HIGH] || 0} High
              </span>
              <span className={getSeverityColor(SEVERITY.MEDIUM) + ' text-sm font-medium'}>
                {summary?.bySeverity[SEVERITY.MEDIUM] || 0} Medium
              </span>
              <span className={getSeverityColor(SEVERITY.LOW) + ' text-sm font-medium'}>
                {summary?.bySeverity[SEVERITY.LOW] || 0} Low
              </span>
            </div>
          </div>

          {/* Findings list - using IssueCard components */}
          <div className="h-screen overflow-y-auto p-3 space-y-2">
            {findings.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                No findings detected. The page appears to meet basic accessibility standards.
              </div>
            ) : (
              <div>
                {getRuleFindings().map((finding) => (
                  <IssueCard
                    key={finding.id}
                    finding={finding}
                    onSelect={selectFinding}
                    onConfirmRemediation={handleConfirmRemediation}
                    hasAIRecommendation={finding.evidence?.type === EVIDENCE_TYPE.AI_SUGGESTION}
                  />
                ))}

                {/* AI suggestions section */}
                {getAIFindings().length > 0 && (
                  <>
                    <div className="pt-2 border-t border-border text-xs text-muted-foreground">
                      AI Suggestions (require maintainer review)
                    </div>
                    {getAIFindings().map((finding) => (
                      <IssueCard
                        key={finding.id}
                        finding={finding}
                        onSelect={selectFinding}
                        onConfirmRemediation={handleConfirmRemediation}
                        hasAIRecommendation={true}
                      />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Empty state when no scan */}
          {(!scanId && !currentScan) || (scanId && !currentScan) && (
            <div className="p-4 text-center text-muted-foreground">
              No scan data found. Use the service page to start a new accessibility scan.
            </div>
          )}
        </aside>

        {/* Main content area */}
        <main className="flex-1 flex flex-col overflow-hidden">

          {/* Header */}
          <header className="border-b border-border px-4 py-3 bg-card">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold">
                Accessibility Inspector
              </h1>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleViewMode}
                  className={`
                    rounded-full p-2 transition-colors ${viewMode === 'desktop' ? 'bg-primary-100' : 'bg-secondary-100'}
                    text-primary-600 hover:bg-primary-200 hover:bg-opacity-75
                  `}
                  aria-label="Switch to ${viewMode === 'desktop' ? 'mobile' : 'desktop'} preview"
                >
                  {viewMode === 'desktop' ? 'Mobile' : 'Desktop'}
                  <svg
                    className="w-3 h-3"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => setIsAIEnabled(!isAIEnabled)}
                  className={`
                    rounded-full p-2 transition-colors ${isAIEnabled ? 'bg-primary-100' : 'bg-secondary-100'}
                    text-primary-600 hover:bg-primary-200 hover:bg-opacity-75
                  `}
                  aria-label="Toggle AI suggestions"
                >
                  {isAIEnabled ? 'AI On' : 'AI Off'}
                  <svg
                    className="w-3 h-3"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="m9 9 3 3 2-6h-2l7-7" />
                  </svg>
                </button>
              </div>
            </div>
          </header>

          {/* Content based on view mode */}
          <div className="p-4 flex-1 overflow-auto">
            {viewMode === 'desktop' && (
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Left column: Reading order, focus path, contrast */}
                <div>
                  <h3 className="font-medium mb-3">DOM Reading Order</h3>
                  <p className="text-sm text-muted-foreground">
                    Screen reader reading order based on DOM structure.
                  </p>
                  <ReadingOrderOutline findings={findings} elementTree={elementTree} />
                </div>

                {/* Right column: Contrast preview */}
                <div>
                  <h3 className="font-medium mb-3">Contrast Preview</h3>
                  <p className="text-sm text-muted-foreground">
                    WCAG contrast ratios for page elements.
                  </p>
                  <ContrastPreview findings={findings} />
                </div>
              </section>
            )}

            {viewMode === 'mobile' && (
              <div>
                <h3 className="font-medium mb-3">Reading Order Preview</h3>
                <p className="text-sm text-muted-foreground">
                  Simplified linear reading order for mobile view. Elements presented in DOM order.
                </p>
                <p className="text-muted-foreground text-sm mt-2">
                  The reading order follows the DOM hierarchy, with block-level elements
                  presented before inline elements. Interactive elements are highlighted
                  for easy navigation.
                </p>
              </div>
            )}
          </div>

          {/* Footer with actions */}
          <footer className="border-t border-border px-4 py-3 bg-card">
            <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={deselectFinding}
                  className={`
                    rounded-md px-3 py-1.5 text-sm transition-colors
                    ${focusedFindingId ? 'bg-destructive/20 text-destructive' : 'hover:bg-muted-100'}
                  `}
                  aria-label="Deselect finding"
                >
                  Deselect
                </button>

                <button
                  onClick={() => {
                    // Export report
                    const reportId = scanId || (currentScan?.id || '');
                    if (reportId) {
                      const report = getAllScanRuns().find((s) => s.id === reportId);
                      if (report) {
                        const sum = summarizeScan(report.findings || []);
                        toast({
                          title: 'Report Ready',
                          description: `Accessibility report: ${sum.score}% ${sum.level.toLowerCase()}. ` +
                            ` ${sum.breakdown.total} total findings ` +
                            `(${sum.breakdown.bySeverity[SEVERITY.CRITICAL] || 0} critical, ` +
                            `${sum.breakdown.bySeverity[SEVERITY.HIGH] || 0} high, ` +
                            `${sum.breakdown.bySeverity[SEVERITY.MEDIUM] || 0} medium, ` +
                            `${sum.breakdown.bySeverity[SEVERITY.LOW] || 0} low)`,
                        });
                      }
                    }
                  }}
                  className={`
                    rounded-md px-3 py-1.5 text-sm transition-colors
                    bg-primary-600 text-white hover:bg-primary-500
                  `}
                  aria-label="Generate and export report"
                >
                  Export Report
                </button>
              </div>

              {/* Status indicator */}
              <div className={`
                rounded-md px-3 py-1.5 text-sm transition-colors
                ${currentScan?.status === SCAN_STATUS.COMPLETE ? 'bg-success-100 text-success' : 'bg-warning-100 text-warning'}
              `}>
                {currentScan?.status || 'Idle'}
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
};

export default AccessibilityInspector;