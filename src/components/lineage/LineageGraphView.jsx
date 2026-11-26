import { Fragment } from 'react';
import { ArrowRight, BookOpen, Camera, Cpu, CheckCircle2, ShieldCheck } from 'lucide-react';

const getNodeIcon = (type) => {
  switch (type) {
    case 'source':
      return <BookOpen size={18} color="#10b981" />;
    case 'snapshot':
      return <Camera size={18} color="var(--accent-main)" />;
    case 'transformation':
      return <Cpu size={18} color="#f59e0b" />;
    case 'fact':
      return <CheckCircle2 size={18} color="#6366f1" />;
    default:
      return <ShieldCheck size={18} color="var(--text-secondary)" />;
  }
};

const LineageGraphView = ({ nodes = [], edges = [], onSelectNode, reviews = [] }) => {
  if (nodes.length === 0) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
        No provenance nodes to display.
      </div>
    );
  }

  // Group nodes by stage for clear horizontal / columnar layout
  const sources = nodes.filter((n) => n.type === 'source');
  const snapshots = nodes.filter((n) => n.type === 'snapshot');
  const transformations = nodes.filter((n) => n.type === 'transformation');
  const facts = nodes.filter((n) => n.type === 'fact');

  const stages = [
    { name: '1. Authoritative Source', items: sources },
    { name: '2. Document Snapshot', items: snapshots },
    { name: '3. Extraction / Parser', items: transformations },
    { name: '4. Public Civic Fact', items: facts },
  ].filter((s) => s.items.length > 0);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: '1rem',
        overflowX: 'auto',
        padding: '1.5rem 0.5rem',
        width: '100%',
      }}
      aria-label={`Interactive Provenance Lineage Graph with ${nodes.length} nodes and ${edges.length} causal edges`}
    >
      {stages.map((stage, idx) => (
        <Fragment key={stage.name}>
          <div
            style={{
              flex: '1 1 240px',
              minWidth: '220px',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div
              style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--text-tertiary)',
                letterSpacing: '0.5px',
                marginBottom: '0.25rem',
              }}
            >
              {stage.name}
            </div>

            {stage.items.map((node) => {
              const review = reviews.find((r) => r.targetEntityId === node.id);
              const data = node.data || {};

              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => onSelectNode(node)}
                  className="card"
                  style={{
                    padding: '1rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    transition: 'transform 0.15s ease, border-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent-main)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-light)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                  aria-label={`View details for ${node.label || node.id}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {getNodeIcon(node.type)}
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          color: 'var(--text-tertiary)',
                        }}
                      >
                        {node.type}
                      </span>
                    </div>
                    {data.status && (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          padding: '0.1rem 0.4rem',
                          borderRadius: '4px',
                          background: data.status === 'active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: data.status === 'active' ? '#10b981' : '#d97706',
                        }}
                      >
                        {data.status}
                      </span>
                    )}
                  </div>

                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                    {node.label || node.id}
                  </div>

                  {data.publisher && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {data.publisher}
                    </div>
                  )}

                  {data.effectiveDate && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                      Date: {data.effectiveDate}
                    </div>
                  )}

                  {review && (
                    <div
                      style={{
                        marginTop: '0.25rem',
                        fontSize: '0.75rem',
                        padding: '0.2rem 0.4rem',
                        borderRadius: '4px',
                        background: 'rgba(16, 185, 129, 0.1)',
                        color: '#10b981',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      <CheckCircle2 size={12} />
                      Reviewed: {review.reviewDecision}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {idx < stages.length - 1 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-tertiary)',
                padding: '0 0.25rem',
              }}
            >
              <ArrowRight size={22} />
            </div>
          )}
        </Fragment>
      ))}
    </div>
  );
};

export default LineageGraphView;
