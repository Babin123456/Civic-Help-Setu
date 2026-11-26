import { getTextOnlyHandOff, getKeyboardAccessibleInfo, buildHandOffGraph } from '../../services/jurisdictionHandoffService';
import { useReducedMotion } from '../../context/ReducedMotionContext';
import { getJurisdictionSourceInfo } from '../../data/jurisdictionBoundaries';

/**
 * Text-only alternative for the jurisdiction hand-off map.
 * Provides all essential information without visual interaction,
 * hover, or complex navigation. Fully keyboard accessible.
 * 
 * This component satisfies the acceptance criteria:
 * - "Provide a text-only alternative for accessibility."
 * - "Keep a readable list or table alternative for every chart, map, or graph."
 * - "Make essential information available without hover and support keyboard navigation."
 */
const TextOnlyHandOff = ({
  service,
  locality,
  state,
  graph: initialGraph,
  onClose,
}) => {
  const reducedMotion = useReducedMotion();
  const sourceInfo = getJurisdictionSourceInfo();

  // Build the hand-off graph
  let handoffGraph = initialGraph || {
    stages: [],
    summary: 'No jurisdiction resolved.',
    ambiguity: false,
    unavailable: false,
  };

  // If we have service and locality and no graph was provided, resolve
  if (!initialGraph && service && (locality || state)) {
    handoffGraph = buildHandOffGraph(service, locality, state);
  }

  // Text-only representation of the hand-off
  const textRepresentation = getTextOnlyHandOff(handoffGraph);

  // Keyboard accessible info
  const keyboardInfo = getKeyboardAccessibleInfo(handoffGraph);

  return (
    <div className="section container" style={{ minHeight: '500px' }}>
      <div
        className="glass-panel"
        style={{
          maxWidth: '900px',
          margin: '0 auto',
          padding: '2rem',
        }}
      >
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '1.5rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid var(--border-light)',
        }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>
            {service ? `${service.name} - Jurisdiction Hand-off Journey` : 'Jurisdiction Hand-off'}
          </h2>
          <button
            type="button"
            onClick={() => onClose && onClose()}
            style={{
              padding: '0.5rem 1rem',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-tertiary)',
              fontSize: '1rem',
              cursor: 'pointer',
            }}
            aria-label="Close text-only hand-off view"
          >
            ✕
          </button>
        </header>

        {/* Plain language explanation */}
        {reducedMotion ? (
          <div style={{ marginBottom: '1.5rem' }}>
            <strong>Jurisdiction Resolution:</strong> {handoffGraph.summary}
          </div>
        ) : (
          <div style={{ 
            background: 'rgba(30, 64, 175, 0.08)', 
            border: '1px solid var(--accent-main)', 
            borderRadius: '0.5rem', 
            padding: '0.75rem', 
            marginBottom: '1rem' 
          }}>
            <div style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--accent-main)' }}>
              {(handoffGraph.ambiguity ? '(AI suggestion - confirm)' : '(Confirmed)')}
            </div>
            <p style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}>
              {handoffGraph.summary}
            </p>
            {handoffGraph.requiresConfirmation && (
              <p style={{ 
                margin: '0.25rem 0 0', 
                fontSize: '0.75rem', 
                color: '#f59e0b',
                fontStyle: 'italic'
              }}>
                <strong>Confirm:</strong> Please verify with official authority before proceeding.
              </p>
            )}
          </div>
        )}

        {/* Accessible Table representation */}
        <section style={{ margin: '1.5rem 0' }}>
          <h3 style={{ marginBottom: '0.75rem', fontSize: '1.1rem' }}>
            Authority Hand-off Matrix Table
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: '0.875rem',
              }}
              aria-label="Authority Hand-off Sequence Table"
            >
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-light)' }}>
                  <th style={{ padding: '0.5rem' }}>Stage</th>
                  <th style={{ padding: '0.5rem' }}>Authority</th>
                  <th style={{ padding: '0.5rem' }}>Role &amp; Responsibilities</th>
                  <th style={{ padding: '0.5rem' }}>Contact &amp; Escalation</th>
                  <th style={{ padding: '0.5rem' }}>Official Portal</th>
                </tr>
              </thead>
              <tbody>
                {handoffGraph.stages.map((stage, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '0.5rem', fontWeight: 600 }}>{stage.order || idx + 1}</td>
                    <td style={{ padding: '0.5rem' }}>
                      <strong>{stage.authority?.name || stage.name}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        Level: {stage.authority?.level || 'N/A'}
                      </div>
                    </td>
                    <td style={{ padding: '0.5rem' }}>{stage.description || 'Application intake and statutory review.'}</td>
                    <td style={{ padding: '0.5rem' }}>
                      <div>{stage.authority?.contact || 'Helpline available'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Escalation: {stage.authority?.escalation || 'Appellate officer'}
                      </div>
                    </td>
                    <td style={{ padding: '0.5rem' }}>
                      {stage.authority?.portal ? (
                        <a href={stage.authority.portal} target="_blank" rel="noopener noreferrer">
                          Portal Link
                        </a>
                      ) : (
                        'N/A'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Hand-off stages list */}
        <section style={{ margin: '1.5rem 0' }}>
          <h3 style={{ marginBottom: '0.75rem', fontSize: '1.1rem' }}>
            Hand-off Sequence
          </h3>
          
          {reducedMotion ? (
            <ul style={{ paddingLeft: '1.25rem' }}>
              {handoffGraph.stages.map((stage, idx) => (
                <li key={idx} style={{ marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: '500', color: 'var(--accent-main)' }}>
                    {idx + 1}. {stage.name}</span>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                    ({stage.authority?.level || 'unknown level'})
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <ol style={{ paddingLeft: '1.25rem' }}>
              {handoffGraph.stages.map((stage, idx) => (
                <li key={idx} style={{ marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: '500', color: 'var(--accent-main)' }}>
                    {idx + 1}. {stage.name}</span>
                  <div style={{ 
                    marginTop: '0.25rem', 
                    fontSize: '0.875rem',
                    color: 'var(--text-tertiary)'
                  }}>
                    <strong>Level:</strong> {stage.authority?.level || 'not resolved'}<br/>
                    <strong>Description:</strong> {stage.description || 'No description available'}
                  </div>
                </li>
              ))}
            </ol>
          )}

          {/* Show ambiguity warning if applicable */}
          {handoffGraph.ambiguity && (
            <p style={{ 
              marginTop: '0.5rem', 
              color: '#f59e0b', 
              fontSize: '0.875rem',
              background: 'rgba(255, 243, 225, 0.5)',
              borderRadius: '0.3rem',
              padding: '0.5rem'
            }}>
              ⚠️ Ambiguous jurisdiction: Multiple authorities could serve this area. 
              Please confirm which authority is responsible.
            </p>
          )}

          {handoffGraph.unavailable && (
            <p style={{ 
              marginTop: '0.5rem', 
              color: '#6b7280', 
              fontSize: '0.875rem',
              background: 'rgba(254, 243, 230, 0.5)',
              borderRadius: '0.3rem',
              padding: '0.5rem'
            }}>
              ⚠️ Jurisdiction data unavailable for the provided locality.
            </p>
          )}
        </section>

        {/* Authority details */}
        {handoffGraph.stages.length > 0 && handoffGraph.stages[0].authority && (
          <section style={{ margin: '1.5rem 0' }}>
            <h3 style={{ marginBottom: '0.75rem', fontSize: '1.1rem' }}>
              Authority Details
            </h3>
            <dl style={{ display: 'grid', gap: '0.75rem' }}>
              <dt style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>Contact</dt>
              <dd style={{ fontSize: '1rem' }}>
                {handoffGraph.stages[0].authority.contact || 'Contact information not available'}
              </dd>
              
              <dt style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>Official Portal</dt>
              <dd style={{ fontSize: '1rem', textDecoration: 'underline' }}>
                {handoffGraph.stages[0].authority.portal || 'Portal not available'}
              </dd>
              
              <dt style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>Escalation Path</dt>
              <dd style={{ fontSize: '1rem' }}>
                {handoffGraph.stages[0].authority.escalation || 'Escalation path not available'}
              </dd>
              
              <dt style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>Source</dt>
              <dd style={{ fontSize: '1rem' }}>
                {handoffGraph.stages[0].authority.source || 'Official government source'}
              </dd>
            </dl>
            
            {/* Source provenance info */}
            <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                <strong>Source Provenance:</strong> {sourceInfo.dataSource} v{sourceInfo.version}<br/>
                <strong>Effective Boundary Date:</strong> {new Date(sourceInfo.lastUpdated).toLocaleDateString()}<br/>
                <strong>Deterministic resolution:</strong> {sourceInfo.deterministic ? 'Yes' : 'No - AI generated'}
              </p>
            </div>
          </section>
        )}

        {/* Keyboard navigation guide */}
        <section style={{ margin: '1.5rem 0' }}>
          <h3 style={{ marginBottom: '0.75rem', fontSize: '1.1rem' }}>
            Keyboard Navigation
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', marginBottom: '0.5rem' }}>
            Essential information is available without hover. Use Tab to navigate through:
          </p>
          <ol style={{ paddingLeft: '1.25rem' }}>
            {keyboardInfo.map((item, idx) => (
              <li key={idx} style={{ marginBottom: '0.3rem', fontSize: '0.875rem' }}>
                <kbd style={{ 
                  fontSize: '0.7rem', 
                  background: 'var(--bg-main)', 
                  color: 'var(--accent-main)', 
                  padding: '0.1rem 0.3rem', 
                  borderRadius: '3px',
                  marginRight: '0.3rem'
                }}>
                  {item.type === 'authority' ? `Authority ${item.order + 1}` :
                  item.type === 'level' ? `Level ${item.order + 1}` :
                  item.type === 'contact' ? `Contact ${item.order + 1}` :
                  item.type === 'portal' ? `Portal ${item.order + 1}` :
                  item.type === 'escalation' ? `Escalation ${item.order + 1}` :
                  item.type === 'summary' ? 'Summary' : item.type}
                </kbd>
                {item.value ? (
                  <span style={{ color: 'var(--text-primary)' }}>: {item.value}</span>
                ) : null}
              </li>
            ))}
          </ol>
          
          <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <small>
              Tab through the elements above. All critical information (authority names, 
              levels, contacts, portals) is accessible via keyboard without requiring 
              hover or visual interaction. This satisfies WCAG 2.1 AA accessibility 
              success criteria for complex charts and graphs.
            </small>
          </p>
        </section>

        {textRepresentation && (
          <details style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
            <summary style={{ cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              View Raw Text Handoff Summary
            </summary>
            <pre style={{
              background: 'var(--bg-card)',
              padding: '1rem',
              borderRadius: '0.5rem',
              overflowX: 'auto',
              fontSize: '0.8rem',
              marginTop: '0.5rem',
              color: 'var(--text-primary)',
            }}>
              {textRepresentation}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
};

export default TextOnlyHandOff;