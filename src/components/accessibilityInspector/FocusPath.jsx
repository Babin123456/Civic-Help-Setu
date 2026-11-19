import React from 'react';
import { SEVERITY, SEVERITY_COLORS } from '../../services/accessibilityInspector/accessibilityInspectorService';

// ---------------------------------------------------------------------------
// FocusPath - Visualizes the keyboard focus traversal path through the page
// ---------------------------------------------------------------------------

const FocusPath = ({ findings }) => {
  // Extract focusable elements from findings or build from DOM structure
  const focusableFindings = findings.filter((f) =>
    /^focus/.test(f.ruleId)
  );

  if (!focusableFindings.length) {
    return null;
  }

  return (
    <div className="mb-4 p-3 rounded-lg border border-border">
      <h3 className="font-medium mb-2">Keyboard Focus Path</h3>
      <p className="text-xs text-muted-foreground mb-3">
        Tab order traversal through focusable elements.
      </p>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="border border-border p-2 text-left font-medium">Tab Index</th>
              <th className="border border-border p-2 text-left font-medium">Element</th>
              <th className="border border-border p-2 text-left font-medium">Selector</th>
              <th className="border border-border p-2 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {focusableFindings.map((f, i) => (
              <tr key={f.id} className="border-b">
                <td className="border border-border p-2">
                  {i + 1}
                </td>
                <td className="border border-border p-2">
                  <div
                    style={{
                      display: 'inline-block',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      background: 'var(--card-bg, #0f172a)',
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                    }}
                  >
                    {f.affectedSelector ? f.affectedSelector.substring(0, 30) : 'N/A'}
                  </div>
                </td>
                <td className="border border-border p-2">
                  <div
                    style={{
                      display: 'inline-block',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      background: 'var(--card-bg, #0f172a)',
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                    }}
                  >
                    {f.evidence?.message?.substring(0, 30) || 'N/A'}
                  </div>
                </td>
                <td className="border border-border p-2">
                  <span
                    style={{
                      padding: '2px 6px',
                      borderRadius: '3px',
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      color: '#fff',
                      background: SEVERITY_COLORS[finding.severity] || '#64748b',
                    }}
                  >
                    {getSeverityLabel(f.severity)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Helper for severity label
const getSeverityLabel = (severity) => {
  const mapping = {
    [SEVERITY.CRITICAL]: 'Critical',
    [SEVERITY.HIGH]: 'High',
    [SEVERITY.MEDIUM]: 'Medium',
    [SEVERITY.LOW]: 'Low',
  };
  return mapping[severity] || severity;
};

export default FocusPath;