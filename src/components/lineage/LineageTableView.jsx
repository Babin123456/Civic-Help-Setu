import { Info } from 'lucide-react';

const LineageTableView = ({ nodes = [], edges = [], onSelectNode }) => {
  if (nodes.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
        No nodes in current lineage path.
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto', width: '100%' }}>
      <table
        className="accessible-table"
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.875rem',
          textAlign: 'left',
        }}
        aria-label="Authoritative Data Lineage and Provenance Records"
      >
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border-light)', background: 'var(--glass-bg)' }}>
            <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Stage / Type</th>
            <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Entity Name / Reference</th>
            <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Publisher / Origin</th>
            <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Effective Date</th>
            <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Confidence</th>
            <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((node) => {
            const data = node.data || {};
            // find incoming edges to compute confidence
            const inEdge = edges.find((e) => e.targetEntityId === node.id);
            const confidence = inEdge?.confidenceScore !== undefined ? `${Math.round(inEdge.confidenceScore * 100)}%` : '100%';

            return (
              <tr
                key={node.id}
                style={{
                  borderBottom: '1px solid var(--border-light)',
                  transition: 'background 0.2s ease',
                }}
              >
                <td style={{ padding: '0.75rem 1rem' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      background:
                        node.type === 'source'
                          ? 'rgba(16, 185, 129, 0.15)'
                          : node.type === 'snapshot'
                            ? 'rgba(99, 102, 241, 0.15)'
                            : node.type === 'transformation'
                              ? 'rgba(245, 158, 11, 0.15)'
                              : 'rgba(239, 68, 68, 0.15)',
                      color:
                        node.type === 'source'
                          ? '#10b981'
                          : node.type === 'snapshot'
                            ? 'var(--accent-main)'
                            : node.type === 'transformation'
                              ? '#d97706'
                              : '#ef4444',
                    }}
                  >
                    {node.type}
                  </span>
                </td>
                <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {node.label || node.id}
                </td>
                <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                  {data.publisher || (data.parserVersion ? `Parser: ${data.parserVersion}` : 'Derived Civic Fact')}
                </td>
                <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                  {data.effectiveDate || data.createdAt?.split('T')[0] || 'N/A'}
                </td>
                <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                  <span style={{ color: inEdge?.confidenceScore < 0.9 ? '#d97706' : '#10b981' }}>
                    {confidence}
                  </span>
                </td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <button
                    type="button"
                    onClick={() => onSelectNode(node)}
                    className="btn btn-secondary"
                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                    aria-label={`Inspect details for ${node.label || node.id}`}
                  >
                    <Info size={14} />
                    Inspect
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default LineageTableView;
