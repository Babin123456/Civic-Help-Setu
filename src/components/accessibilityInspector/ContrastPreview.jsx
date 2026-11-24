import React from 'react';
import { SEVERITY_COLORS } from '../../services/accessibilityInspector/accessibilityInspectorService';

// ---------------------------------------------------------------------------
// ContrastPreview - Visualizes contrast ratios for page elements
// ---------------------------------------------------------------------------

const ContrastPreview = ({ findings }) => {
  const contrastFindings = findings.filter(
    (f) => f.ruleId === 'contrast.insufficient'
  );

  if (!contrastFindings.length) {
    return (
      <div className="p-3 text-muted-foreground">
        <p>No contrast issues detected. All page elements meet WCAG contrast requirements.</p>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-lg border border-border mb-4">
      <h3 className="font-medium mb-2">Contrast Ratio Preview</h3>
      <p className="text-xs text-muted-foreground">
        WCAG 2.1 contrast ratios for text and UI elements.
      </p>

      <div className="space-y-2">
        {contrastFindings.map((f, i) => {
          const ratio = f.evidence?.computedRatio || 0;
          const wcagLevel = f.evidence?.wcagLevel || 'fail';
          const severityColor = SEVERITY_COLORS[f.severity] || '#64748b';

          return (
            <div
              key={f.id}
              style={{
                background: 'var(--card-bg, #0f172a)',
                border: '1px solid var(--border-color, #334155)',
                borderRadius: '6px',
                padding: '0.75rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span className="text-sm font-medium">
                Element: {f.affectedSelector || 'N/A'}
              </span>
              <div className="flex items-center gap-2">
                <span
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#fff',
                    background: severityColor,
                  }}
                >
                  {ratio.toFixed(2)}:1
                </span>
                <span
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '0.65rem',
                    color: '#64748b',
                  }}
                >
                  {wcagLevel}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ContrastPreview;