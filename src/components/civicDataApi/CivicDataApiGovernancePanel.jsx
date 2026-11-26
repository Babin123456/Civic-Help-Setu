import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, ScrollText } from 'lucide-react';

export default function CivicDataApiGovernancePanel({ usage, clients, audits, anomalies, isAdmin, onReviewAnomaly }) {
  const [reasons, setReasons] = useState({});
  const [edits, setEdits] = useState({});
  const clientNames = useMemo(() => Object.fromEntries(clients.map((client) => [client.id, client.name])), [clients]);

  return (
    <section aria-labelledby="governance-heading" style={{ display: 'grid', gap: '1.25rem' }}>
      <div>
        <h2 id="governance-heading" style={{ margin: 0 }}>Usage governance</h2>
        <p style={{ margin: '0.3rem 0 0', color: 'var(--text-secondary)' }}>
          Daily aggregate counts, deterministic anomaly alerts and append-only administrative audits.
        </p>
      </div>

      <div style={{ border: '1px solid var(--border-main)', borderRadius: '0.8rem', padding: '1rem', background: 'var(--bg-surface)' }}>
        <h3 style={{ margin: '0 0 0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Activity size={17} aria-hidden="true" /> Daily usage</h3>
        {usage.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>No API requests recorded yet. Run a sandbox request to create the first usage row.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <caption style={{ textAlign: 'left', paddingBottom: '0.5rem', color: 'var(--text-secondary)' }}>Aggregate API usage by client, dataset and day</caption>
              <thead>
                <tr>
                  {['Date', 'Client', 'Dataset', 'Requests', 'Errors', 'Bytes'].map((heading) => (
                    <th key={heading} scope="col" style={{ textAlign: 'left', padding: '0.45rem 0.6rem', borderBottom: '1px solid var(--border-main)' }}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usage.slice(-20).reverse().map((row) => (
                  <tr key={row.id}>
                    <td style={{ padding: '0.45rem 0.6rem', borderBottom: '1px solid var(--border-main)' }}>{row.date}</td>
                    <td style={{ padding: '0.45rem 0.6rem', borderBottom: '1px solid var(--border-main)' }}>{clientNames[row.clientId] || row.clientId}</td>
                    <td style={{ padding: '0.45rem 0.6rem', borderBottom: '1px solid var(--border-main)' }}>{row.datasetId}</td>
                    <td style={{ padding: '0.45rem 0.6rem', borderBottom: '1px solid var(--border-main)' }}>{row.requestCount}</td>
                    <td style={{ padding: '0.45rem 0.6rem', borderBottom: '1px solid var(--border-main)' }}>{row.errorCount}</td>
                    <td style={{ padding: '0.45rem 0.6rem', borderBottom: '1px solid var(--border-main)' }}>{row.bytes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isAdmin && (
        <div style={{ border: '1px solid var(--border-main)', borderRadius: '0.8rem', padding: '1rem', background: 'var(--bg-surface)' }}>
          <h3 style={{ margin: '0 0 0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><AlertTriangle size={17} aria-hidden="true" /> Deterministic anomaly alerts</h3>
          {anomalies.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>No usage anomaly is open. Alerts use fixed thresholds and the aggregate fields shown beside each recommendation.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.7rem' }}>
              {anomalies.map((anomaly) => (
                <li key={anomaly.id} style={{ border: '1px solid var(--border-main)', borderRadius: '0.6rem', padding: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <strong>{anomaly.ruleId.replaceAll('_', ' ')} · {anomaly.clientName}</strong>
                    <span style={{ textTransform: 'capitalize', fontSize: '0.8rem' }}>{anomaly.severity} · {anomaly.status}</span>
                  </div>
                  <p style={{ margin: '0.35rem 0', fontSize: '0.88rem' }}>{anomaly.explanation}</p>
                  <p style={{ margin: '0.35rem 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    Rule {anomaly.ruleId}@{anomaly.ruleVersion} · window {anomaly.inputWindow.from} to {anomaly.inputWindow.to} · fields {anomaly.sourceFields.join(', ')}
                  </p>
                  <p style={{ margin: '0.35rem 0', fontSize: '0.88rem' }}><strong>Recommendation:</strong> {anomaly.review?.editedRecommendation || anomaly.recommendation}</p>
                  {anomaly.status === 'open' && (
                    <div style={{ display: 'grid', gap: '0.45rem', marginTop: '0.55rem' }}>
                      <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.85rem', fontWeight: 600 }}>
                        Reason (required for edit or reject)
                        <input className="input" value={reasons[anomaly.id] || ''} maxLength={300} onChange={(event) => setReasons((previous) => ({ ...previous, [anomaly.id]: event.target.value }))} />
                      </label>
                      <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.85rem', fontWeight: 600 }}>
                        Edited recommendation (used when editing)
                        <input className="input" value={edits[anomaly.id] || ''} maxLength={300} onChange={(event) => setEdits((previous) => ({ ...previous, [anomaly.id]: event.target.value }))} />
                      </label>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-primary" onClick={() => onReviewAnomaly({ anomalyId: anomaly.id, decision: 'accepted', reason: reasons[anomaly.id] || 'Accepted after review' })}>Accept</button>
                        <button type="button" className="btn btn-secondary" onClick={() => onReviewAnomaly({ anomalyId: anomaly.id, decision: 'edited', editedRecommendation: edits[anomaly.id], reason: reasons[anomaly.id] })}>Edit</button>
                        <button type="button" className="btn btn-secondary" onClick={() => onReviewAnomaly({ anomalyId: anomaly.id, decision: 'rejected', reason: reasons[anomaly.id] })}>Reject</button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {isAdmin && (
        <div style={{ border: '1px solid var(--border-main)', borderRadius: '0.8rem', padding: '1rem', background: 'var(--bg-surface)' }}>
          <h3 style={{ margin: '0 0 0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><ScrollText size={17} aria-hidden="true" /> Append-only access audits</h3>
          {audits.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>No access audit events yet.</p>
          ) : (
            <ol style={{ margin: 0, paddingLeft: '1.2rem', display: 'grid', gap: '0.4rem', fontSize: '0.85rem' }}>
              {audits.map((audit) => (
                <li key={audit.id}>
                  <strong>{audit.action}</strong> · {new Date(audit.createdAt).toLocaleString()} · actor {audit.actorId}
                  {audit.datasetId && <> · dataset {audit.datasetId}</>}
                  {audit.reason && <> · reason: {audit.reason}</>}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
