import React from 'react';
import { SEVERITY_COLORS } from '../../services/accessibilityInspector/accessibilityInspectorService';

// ---------------------------------------------------------------------------
// ReadingOrderOutline - Visual outline of the DOM reading order
// ---------------------------------------------------------------------------

const ReadingOrderOutline = ({ findings, elementTree }) => {
  if (!elementTree || elementTree.length === 0) {
    return null;
  }

  // Get heading elements for the reading order outline
  const headings = elementTree.filter(
    (el) => el.tagName && ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(el.tagName.toLowerCase())
  );

  if (!headings.length) {
    return (
      <div className="p-3 text-muted-foreground">
        <p>No heading structure found for reading order outline.</p>
      </div>
    );
  }

  // Sort by depth (DOM order)
  const sortedHeadings = [...headings].sort((a, b) => a.depth - b.depth);

  return (
    <div className="p-3 rounded-lg border border-border mb-4">
      <h3 className="font-medium mb-2">DOM Reading Order Outline</h3>
      <p className="text-xs text-muted-foreground">
        Screen reader reading order based on DOM structure.
      </p>

      <ol className="list-decimal list-inside space-y-1 text-sm">
        {sortedHeadings.map((el, i) => (
          <li key={el.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '9999px',
                fontSize: '0.65rem',
                fontWeight: 600,
                color: '#fff',
                background: SEVERITY_COLORS[SEVERITY.MEDIUM] || '#f59e0b',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {i + 1}
            </span>
            <span className="font-medium">
              <strong>{el.tagName.toUpperCase()}</strong> {el.textContent.substring(0, 50) +
                (el.textContent.length > 50 ? '...' : '')}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
};

export default ReadingOrderOutline;