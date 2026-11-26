import React from 'react';
import { SEVERITY, SEVERITY_COLORS, EVIDENCE_TYPE } from '../../services/accessibilityInspector/accessibilityInspectorService';

// ---------------------------------------------------------------------------
// IssueCard - Displays a single accessibility finding with remediation suggestions
// ---------------------------------------------------------------------------

const IssueCard = ({ finding, onSelect, onConfirmRemediation, hasAIRecommendation }) => {
  const severityColor = SEVERITY_COLORS[finding.severity] || '#64748b';
  const severityLabel = {
    [SEVERITY.CRITICAL]: 'Critical',
    [SEVERITY.HIGH]: 'High',
    [SEVERITY.MEDIUM]: 'Medium',
    [SEVERITY.LOW]: 'Low',
  }[finding.severity] || finding.severity;

  const isAI = finding.evidence?.type === EVIDENCE_TYPE.AI_SUGGESTION;

  // Generate a human-readable remediation suggestion
  const remediationSuggestion = isAI
    ? `AI Suggestion: ${finding.evidence?.message || 'Review and apply appropriate fix'}`
    : generateRemediationSuggestion(finding);

  return (
    <div
      className="
        rounded-lg border border-border p-4 mb-3
        transition-all duration-200
        hover:shadow-lg hover:-mb-1
        ${hasAIRecommendation ? 'ring-2 ring-primary-500/20' : ''}
      "
      style={{
        borderColor: finding.severity === SEVERITY.CRITICAL ? severityColor : 'transparent',
        boxShadow: finding.severity === SEVERITY.CRITICAL
          ? `0 4px 6px -1px ${severityColor}/30, 0 2px 4px -1px ${severityColor}/20`
          : undefined,
      }}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(finding)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(finding);
        }
      }}
    >
      {/* Header: severity badge + rule ID */}
      <div className="flex items-start justify-between gap-3 mb-3">
        {/* Left: severity and rule info */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '9999px',
                fontSize: '0.65rem',
                fontWeight: 600,
                color: '#fff',
                background: severityColor,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {severityLabel}
            </span>
            <span className="font-medium text-sm">
              {isAI ? 'AI Suggestion: ' : ''}{finding.ruleId}
            </span>
          </div>

          <p className="text-xs text-muted-foreground line-clamp-2">
            {finding.evidence?.message || 'No description available'}
          </p>
        </div>

        {/* Right: affected selector */}
        <div className="text-xs text-muted-foreground">
          <strong>Affected:</strong> {finding.affectedSelector || 'N/A'}
        </div>
      </div>

      {/* Remediation suggestion */}
      <div className="mt-3 pt-3 border-t border-border">
        <p className="font-semibold text-sm mb-1">
          Suggested Remediation
        </p>
        <p className="text-sm line-clamp-3">
          {remediationSuggestion}
        </p>
      </div>

      {/* Action buttons */}
      <div className="mt-3 flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onConfirmRemediation(finding);
          }}
          className={`
            rounded-md px-2 py-1 text-xs transition-colors
            bg-primary-600 text-white hover:bg-primary-500
          `}
          aria-label="Confirm remediation for this issue"
        >
          Confirm
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            // Option to dismiss/ignore
            // In a full implementation, this would mark the finding as ignored
          }}
          className={`
            rounded-md px-2 py-1 text-xs transition-colors
            bg-secondary-600 text-white hover:bg-secondary-500
          `}
          aria-label="Dismiss/ignore this issue"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Generate remediation suggestion based on rule ID
// ---------------------------------------------------------------------------
const generateRemediationSuggestion = (finding) => {
  const { ruleId } = finding;

  const suggestions = {
    [RULE_IDS.MISSING_H1]: 'Add a single H1 heading at the top of the page that describes the page purpose.',
    [RULE_IDS.TOO_MANY_H1]: 'Reduce to one H1 per page, or use appropriate heading hierarchy for collection pages.',
    [RULE_IDS.MISSING_MAIN]: 'Add a <main> landmark element wrapping the primary content.',
    [RULE_IDS.MISSING_NAV]: 'Add a <nav> landmark for navigation regions.',
    [RULE_IDS.MISSING_HEADER]: 'Add a <header> landmark for the page header.',
    [RULE_IDS.MISSING_FOOTER]: 'Add a <footer> landmark for the page footer.',
    [RULE_IDS.UNLABELED_FORM_CONTROL]: 'Add an associated <label> element or aria-label to the form control.',
    [RULE_IDS.MISSING_ALT_TEXT]: 'Add descriptive alt text to the image, or use aria="" for decorative images.',
    [RULE_IDS.INSUFFICIENT_CONTRAST]: 'Increase contrast ratio between text and background to at least 4.5:1 for normal text or 3:1 for large text.',
    [RULE_IDS.MISSING_REQUIRED_ATTR]: 'Ensure all required form controls have visible associated labels.',
    [RULE_IDS.FOCUS_NOT_VISIBLE]: 'Make focus indicators visible with a contrasting outline (e.g., :focus-visible style).',
    [RULE_IDS.MISSING_DOCTYPE]: 'Add <!DOCTYPE html> as the first line of the HTML document.',
    [RULE_IDS.LANGUAGE_DECLARATION_MISSING]: 'Add lang attribute to <html> element (e.g., lang="en").',
    [RULE_IDS.SKIPPED_HEADING_LEVELS]: 'Ensure heading levels progress sequentially without skipping more than one level.',
    [RULE_IDS.ARIA_ROLE_MISMATCH]: 'Review ARIA role usage; ensure roles match the element semantics or remove unnecessary roles.',
    DEFAULT: 'Review the affected element and apply appropriate accessibility improvements.',
  };

  return suggestions[ruleId] || suggestions.DEFAULT;
};

export default IssueCard;