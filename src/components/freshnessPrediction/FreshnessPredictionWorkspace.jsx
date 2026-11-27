/**
 * src/components/freshnessPrediction/FreshnessPredictionWorkspace.jsx
 *
 * Mobile-first, accessible workspace for the Civic Information Freshness
 * Prediction and Review Prioritization Engine (#1189).
 *
 * Maintainers can:
 *  - Compute a review priority prediction for a service from source change
 *    history, link health and last verification.
 *  - View the priority score (0-100), band, confidence, reasons and feature
 *    breakdown — interpretable triage hints, not a public truth score.
 *  - List predictions and review them (explicit human decision, no autonomous
 *    edits of civic guidance).
 *  - View feature weights and drift events (score changes over time).
 *
 * All outputs are deterministic triage hints for maintainer review. They never
 * auto-edit guidance, file or deny applications, or claim official verification.
 * No citizen records, credentials, raw documents or sensitive prompts are
 * displayed or stored.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Info,
  RefreshCw,
  List,
  Clock,
  Link,
  UserCheck,
  Edit3,
  BarChart3
} from 'lucide-react';
import {
  predict,
  reviewPrediction,
  listPredictions,
  getReviewAudit,
  listFeatureWeights
} from '../../services/civicSourceFreshnessPredictionService.js';

const BAND_COLORS = {
  low: 'bg-green-50 border-green-200 text-green-800',
  medium: 'bg-amber-50 border-amber-200 text-amber-800',
  high: 'bg-orange-50 border-orange-200 text-orange-800',
  critical: 'bg-rose-50 border-rose-200 text-rose-800'
};

function formatScore(value) {
  return Math.round(Number(value || 0) * 100);
}

function formatPercent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function bandColor(band) {
  return BAND_COLORS[band] || BAND_COLORS.low;
}

export default function FreshnessPredictionWorkspace() {
  const [serviceId, setServiceId] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [lastVerified, setLastVerified] = useState('');
  const [linkStatus, setLinkStatus] = useState('unverified');
  const [sourceAgeDays, setSourceAgeDays] = useState('');
  const [isSuperseded, setIsSuperseded] = useState(false);
  const [changeEvents, setChangeEvents] = useState('');
  const [verificationCount, setVerificationCount] = useState('');

  const [prediction, setPrediction] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [featureWeights, setFeatureWeights] = useState({});
  const [reviewAudit, setReviewAudit] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const clearMessages = useCallback(() => { setError(null); setNotice(null); }, []);

  const loadFeatureWeights = useCallback(async () => {
    try {
      const weights = await listFeatureWeights();
      return weights || {};
    } catch {
      return {};
    }
  }, []);

  useEffect(() => {
    loadFeatureWeights().then((weights) => {
      setFeatureWeights(weights);
    }).catch(() => {
      setError('Unable to load feature weights.');
    });
  }, [loadFeatureWeights]);

  const handlePredict = useCallback(async (e) => {
    e.preventDefault();
    clearMessages();
    if (!serviceId) { setError('Service id is required.'); return; }

    const svc = {
      id: serviceId,
      name: serviceName || serviceId,
      lastVerified: lastVerified || undefined,
      officialSources: [{
        name: 'Official portal',
        url: 'https://example.gov.in/service'
      }],
      supersededBy: isSuperseded ? 'newer-order-v2' : undefined,
      isWithdrawn: false,
      changeEvents: changeEvents ? Array(parseInt(changeEvents, 10)).fill({}) : []
    };

    const linkHealthRecords = {};
    const primaryUrl = svc.officialSources[0].url;
    linkHealthRecords[`${serviceId}:${primaryUrl}`] = { status: linkStatus, checkedAt: new Date().toISOString() };

    const verificationHistory = Array(parseInt(verificationCount || '0', 10)).fill({ checkedAt: new Date().toISOString() });

    setLoading(true);
    try {
      const result = await predict({
        serviceId,
        service: svc,
        linkHealthRecords,
        verificationHistory,
        nowIso: new Date().toISOString()
      });
      if (!result.ok) {
        setError(result.error.message || 'Prediction failed.');
        return;
      }
      setPrediction(result.prediction);
      setNotice(`Computed priority ${result.score !== undefined ? formatScore(result.score) : '–'} (${result.band}). Confidence: ${formatPercent(result.confidence)}.`);
    } catch (err) {
      setError(String(err && err.message ? err.message : err));
    } finally {
      setLoading(false);
    }
  }, [serviceId, serviceName, lastVerified, linkStatus, isSuperseded, changeEvents, verificationCount, clearMessages]);

  const handleListPredictions = useCallback(async () => {
    clearMessages();
    setLoading(true);
    try {
      const result = await listPredictions({ limit: 50 });
      setPredictions(result.predictions || []);
      setNotice(`Loaded ${(result.predictions || []).length} prediction(s).`);
    } catch {
      setError('Unable to load predictions.');
    } finally {
      setLoading(false);
    }
  }, [clearMessages]);

  const handleReview = useCallback(async (e) => {
    e.preventDefault();
    clearMessages();
    if (!prediction) { setError('No prediction to review. Compute or load one first.'); return; }

    const decision = prompt('Enter review decision (pending/computed/stale/reviewed/superseded/withdrawn):', 'reviewed');
    if (decision === null) return; // cancelled

    setLoading(true);
    try {
      const result = await reviewPrediction({
        serviceId: prediction.serviceId,
        reviewerNote: 'Reviewed from freshness workspace.',
        reviewedBy: 'maintainer',
        decision
      });
      if (!result.ok) {
        setError(result.error.message || 'Review failed.');
        return;
      }
      setPrediction(result.prediction);
      setNotice(`Prediction reviewed: ${result.prediction.status}.`);
    } catch (err) {
      setError(String(err && err.message ? err.message : err));
    } finally {
      setLoading(false);
    }
  }, [prediction, clearMessages]);

  const handleLoadAudit = useCallback(async () => {
    clearMessages();
    setLoading(true);
    try {
      const events = await getReviewAudit({ limit: 50 });
      setReviewAudit(events || []);
    } catch {
      setError('Unable to load review audit.');
    } finally {
      setLoading(false);
    }
  }, [clearMessages]);

  return (
    <div className="section section-bg" id="freshness-prediction">
      <div className="container">
        <header className="page-header" style={{ marginBottom: '1.5rem' }}>
          <span className="content-badge content-badge--ai">Civic Information Freshness Prediction</span>
          <h2 className="page-header-title">Source Freshness &amp; Review Priority</h2>
          <p className="page-header-subtitle">
            Compute deterministic review priority scores for service pages from
            source change history, link health and last verification. Outputs
            triage hints with reasons and uncertainty — not a truth score, never
            an autonomous edit of civic guidance.
          </p>
        </header>

        {notice && (
          <div className="cl-alert" role="status" aria-live="polite" style={{ marginBottom: '1rem', borderLeft: '3px solid var(--accent-main)' }}>
            <Info size={18} />&nbsp; {notice}
          </div>
        )}
        {error && (
          <div className="cl-alert cl-alert-error" role="alert" aria-live="assertive" style={{ marginBottom: '1rem' }}>
            <AlertTriangle size={18} />&nbsp; {error}
          </div>
        )}

        {/* Predict form */}
        <section className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }} aria-labelledby="predict-heading">
          <h3 id="predict-heading" style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}><ShieldAlert size={20} />&nbsp; Compute priority prediction</h3>
          <form onSubmit={handlePredict} style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Link size={16} /> Service id
              </label>
              <input
                className="input-field"
                id="fp-service-id"
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                placeholder="e.g. ration-card-service"
                aria-required="true"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Link size={16} /> Service name
              </label>
              <input
                className="input-field"
                id="fp-service-name"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                placeholder="e.g. Ration Card Service"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={16} /> Last verified (YYYY-MM-DD)
              </label>
              <input
                className="input-field"
                id="fp-last-verified"
                type="date"
                value={lastVerified}
                onChange={(e) => setLastVerified(e.target.value)}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Link size={16} /> Primary link health
              </label>
              <select
                className="input-field"
                id="fp-link-status"
                value={linkStatus}
                onChange={(e) => setLinkStatus(e.target.value)}
              >
                <option value="reachable">Reachable</option>
                <option value="redirected">Redirected - needs review</option>
                <option value="unavailable">Not working</option>
                <option value="unverified">Unable to verify</option>
                <option value="invalid">Not a web link</option>
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={16} /> Source age (days)
              </label>
              <input
                className="input-field"
                id="fp-source-age"
                type="number"
                value={sourceAgeDays}
                onChange={(e) => setSourceAgeDays(e.target.value)}
                min="0"
                placeholder="e.g. 400"
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                id="fp-is-superseded"
                type="checkbox"
                checked={isSuperseded}
                onChange={(e) => setIsSuperseded(e.target.checked)}
              />
              <label htmlFor="fp-is-superseded" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                Source superseded / withdrawn
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit3 size={16} /> Change events (count)
              </label>
              <input
                className="input-field"
                id="fp-change-events"
                type="number"
                value={changeEvents}
                onChange={(e) => setChangeEvents(e.target.value)}
                min="0"
                placeholder="e.g. 3"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserCheck size={16} /> Verification count
              </label>
              <input
                className="input-field"
                id="fp-verification-count"
                type="number"
                value={verificationCount}
                onChange={(e) => setVerificationCount(e.target.value)}
                min="0"
                placeholder="e.g. 2"
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: 'fit-content', minHeight: '44px' }} aria-busy={loading}>
              {loading ? <span><RefreshCw size={18} className="animate-spin" />&nbsp; Computing…</span> : 'Compute prediction'}
            </button>
          </form>
        </section>

        {/* Prediction result */}
        {prediction && (
          <section className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }} aria-labelledby="prediction-heading">
            <h3 id="prediction-heading" style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}><BarChart3 size={20} />&nbsp; Prediction result</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Service</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{prediction.serviceName}</div>
              </div>
              <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Priority score</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{formatScore(prediction.priorityScore)} / 100</div>
              </div>
              <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Band</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
                  <span className={`status-badge ${bandColor(prediction.priorityBand)}`} style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}>{prediction.priorityBand}</span>
                </div>
              </div>
              <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Confidence</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{formatPercent(prediction.confidence)}</div>
              </div>
              <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Status</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{prediction.status}</div>
              </div>
            </div>

            <div style={{ marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}><strong>Reasons:</strong> {prediction.reasons && prediction.reasons.length > 0 ? prediction.reasons.join('; ') : 'None recorded.'}</div>
            <div style={{ marginBottom: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}><strong>Computed at:</strong> {prediction.computedAt}</div>
            <div style={{ marginBottom: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}><strong>Reviewed:</strong> {String(prediction.reviewed)} {prediction.reviewedBy ? `| by ${prediction.reviewedBy}` : ''}</div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{prediction.disclaimer}</p>

            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button onClick={handleReview} className="btn btn-primary" disabled={loading} style={{ minHeight: '44px' }} aria-busy={loading}>
                {loading ? 'Reviewing…' : 'Record review decision'}
              </button>
            </div>
          </section>
        )}

        {/* Feature weights */}
        <section className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }} aria-labelledby="weights-heading">
          <h3 id="weights-heading" style={{ marginBottom: '0.75rem', color: 'var(--text-primary)' }}><Edit3 size={20} />&nbsp; Feature weights</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Deterministic weights used to compute the priority score. Higher = more concerning.</p>
          {featureWeights && Object.keys(featureWeights).length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
              {Object.entries(featureWeights).map(([key, value]) => (
                <li key={key} style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'var(--glass-bg-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{key.replace(/_/g, ' ')}</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{(Number(value) * 100).toFixed(0)}%</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Loading feature weights…</p>
          )}
          <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{'Weights are deterministic and interpretable; operators may adjust them but must record the change and re-evaluate baselines.'}</p>
        </section>

        {/* Predictions list */}
        <section className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }} aria-labelledby="list-heading">
          <h3 id="list-heading" style={{ marginBottom: '0.75rem', color: 'var(--text-primary)' }}><List size={20} />&nbsp; Predictions</h3>
          <button onClick={handleListPredictions} className="btn btn-primary" disabled={loading} style={{ width: 'fit-content', minHeight: '44px', marginBottom: '0.75rem' }} aria-busy={loading}>
            {loading ? 'Loading…' : 'Load predictions'}
          </button>
          {predictions.length > 0 && (
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-light)' }}>
                    <th style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>Service</th>
                    <th style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>Score</th>
                    <th style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>Band</th>
                    <th style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>Status</th>
                    <th style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>Reviewed</th>
                    <th style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>Computed at</th>
                  </tr>
                </thead>
                <tbody>
                  {predictions.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{p.serviceId}</td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{formatScore(p.priorityScore)}</td>
                      <td style={{ padding: '0.75rem' }}><span className={`status-badge ${bandColor(p.priorityBand)}`} style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}>{p.priorityBand}</span></td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{p.status}</td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{String(p.reviewed)}</td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{p.computedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {predictions.length === 0 && !loading && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No predictions computed yet.</p>
          )}
        </section>

        {/* Review audit */}
        <section className="card" style={{ padding: '1.5rem' }} aria-labelledby="audit-heading">
          <h3 id="audit-heading" style={{ marginBottom: '0.75rem', color: 'var(--text-primary)' }}><UserCheck size={20} />&nbsp; Review audit</h3>
          <button onClick={handleLoadAudit} className="btn btn-primary" disabled={loading} style={{ width: 'fit-content', minHeight: '44px', marginBottom: '0.75rem' }} aria-busy={loading}>
            {loading ? 'Loading…' : 'Load audit events'}
          </button>
          {reviewAudit.length > 0 && (
            <div style={{ marginTop: '1rem', overflowX: 'auto', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-light)' }}>
                    <th style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>Action</th>
                    <th style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>Service</th>
                    <th style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>Decision</th>
                    <th style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>By</th>
                    <th style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>At</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewAudit.map((e) => (
                    <tr key={e.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{e.action}</td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{e.details?.serviceId}</td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{e.details?.decision}</td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{e.actorId}</td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{e.timestamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {reviewAudit.length === 0 && !loading && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No review audit events recorded yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
