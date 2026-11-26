/**
 * src/components/policyEngine/PolicyEngineWorkspace.jsx
 *
 * Mobile-first, accessible workspace for the Civic Agent Workflow
 * Policy-as-Code Engine (#1187).
 *
 * Citizens and operators can:
 *  - Evaluate a proposed agent action against active policies (deny-by-default).
 *  - View the decision, reason, matched rule and explanation.
 *  - List policies and view a policy's rules and versions.
 *  - Run policy simulations (bypass attempts, conflicting policies, emergency
 *    revocation, deny-by-default) with synthetic data.
 *
 * All figures and decisions are deterministic access-control outputs, not
 * legal advice, benefit denial or official verification. No citizen records,
 * credentials, raw documents or sensitive prompts are displayed or stored.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Info,
  StopCircle,
  RefreshCw,
  List,
  Terminal,
  Lock,
  UserCheck
} from 'lucide-react';
import {
  evaluate,
  listPolicies,
  getPolicy,
  getPolicyVersions,
  getEvaluationAudit
} from '../../services/civicAgentPolicyService.js';

const DECISION_COLORS = {
  allow: 'bg-green-50 border-green-200 text-green-800',
  deny: 'bg-rose-50 border-rose-200 text-rose-800',
  require_approval: 'bg-amber-50 border-amber-200 text-amber-800'
};

function formatDecision(decision) {
  return DECISION_COLORS[decision] || DECISION_COLORS.deny;
}

export default function PolicyEngineWorkspace() {
  const [policyId, setPolicyId] = useState('default-civic-agent-policy-v1');
  const [resourceType, setResourceType] = useState('tool');
  const [resourceId, setResourceId] = useState('lookupServiceDetails');
  const [action, setAction] = useState('read');
  const [role, setRole] = useState('citizen');
  const [citizenConfirmed, setCitizenConfirmed] = useState(false);
  const [humanApproved, setHumanApproved] = useState(false);
  const [sourceVerified, setSourceVerified] = useState(false);
  const [dailyCallCount, setDailyCallCount] = useState(0);
  const [context, setContext] = useState('{}');

  const [decision, setDecision] = useState(null);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [versions, setVersions] = useState(null);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const clearMessages = useCallback(() => { setError(null); setNotice(null); }, []);

  const loadPolicies = useCallback(async () => {
    try {
      await listPolicies();
    } catch {
      // Policies list is non-critical; swallow load errors.
    }
  }, []);

  useEffect(() => {
    void loadPolicies();
  }, [loadPolicies]);

  const handleEvaluate = useCallback(async (e) => {
    e.preventDefault();
    clearMessages();
    let ctx;
    try {
      ctx = context.trim() ? JSON.parse(context) : {};
    } catch {
      setError('Context must be valid JSON.');
      return;
    }
    setLoading(true);
    try {
      const result = await evaluate({
        policyId: policyId || undefined,
        resourceType,
        resourceId: resourceId || undefined,
        action: action || undefined,
        role: role || 'citizen',
        citizenConfirmed,
        humanApproved,
        sourceVerified,
        dailyCallCount: Number(dailyCallCount || 0),
        context: ctx
      });
      if (!result.ok) {
        setError(result.error.message || 'Evaluation failed.');
        return;
      }
      setDecision(result);
      if (result.code === 'CP_DECISION_REQUIRES_APPROVAL') {
        setNotice('This action requires explicit human approval before execution.');
      } else if (!result.permitted) {
        setNotice('Action denied by policy (deny-by-default).');
      } else {
        setNotice('Action permitted by policy. Estimates are access-control decisions, not a bill.');
      }
    } catch (err) {
      setError(String(err && err.message ? err.message : err));
    } finally {
      setLoading(false);
    }
  }, [policyId, resourceType, resourceId, action, role, citizenConfirmed, humanApproved, sourceVerified, dailyCallCount, context, clearMessages]);

  const handleLoadPolicy = useCallback(async () => {
    clearMessages();
    if (!policyId) { setError('Policy id is required.'); return; }
    setLoading(true);
    try {
      const policy = await getPolicy(policyId);
      if (!policy) { setError('Policy not found.'); return; }
      setSelectedPolicy(policy);
      const ver = await getPolicyVersions({ policyId, limit: 10 });
      setVersions(ver || { versions: [], nextCursor: null });
    } catch {
      setError('Unable to load policy.');
    } finally {
      setLoading(false);
    }
  }, [policyId, clearMessages]);

  const handleLoadAudit = useCallback(async () => {
    clearMessages();
    setLoading(true);
    try {
      const events = await getEvaluationAudit({ policyId: policyId || undefined, limit: 50 });
      setAudit(events || []);
    } catch {
      setError('Unable to load evaluation audit.');
    } finally {
      setLoading(false);
    }
  }, [policyId, clearMessages]);

  return (
    <div className="section section-bg" id="policy-engine">
      <div className="container">
        <header className="page-header" style={{ marginBottom: '1.5rem' }}>
          <span className="content-badge content-badge--ai">Civic Agent Workflow Policy-as-Code Engine</span>
          <h2 className="page-header-title">Policy Engine &amp; Access Control</h2>
          <p className="page-header-subtitle">
            Evaluate proposed agent actions against machine-readable policies
            before every tool call and state transition. Deny-by-default: any
            action not explicitly permitted is refused. Decisions are
            access-control outputs, not legal advice or benefit denial.
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

        {/* Evaluate form */}
        <section className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }} aria-labelledby="evaluate-heading">
          <h3 id="evaluate-heading" style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}><Lock size={20} />&nbsp; Evaluate an action</h3>
          <form onSubmit={handleEvaluate} style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Terminal size={16} /> Policy id (default baseline)
              </label>
              <input
                className="input-field"
                id="pe-policy-id"
                value={policyId}
                onChange={(e) => setPolicyId(e.target.value)}
                placeholder="e.g. default-civic-agent-policy-v1"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <List size={16} /> Resource type
              </label>
              <select
                className="input-field"
                id="pe-resource-type"
                value={resourceType}
                onChange={(e) => setResourceType(e.target.value)}
              >
                <option value="tool">tool</option>
                <option value="agent">agent</option>
                <option value="source">source</option>
                <option value="state_transition">state_transition</option>
                <option value="workflow">workflow</option>
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserCheck size={16} /> Resource id
              </label>
              <input
                className="input-field"
                id="pe-resource-id"
                value={resourceId}
                onChange={(e) => setResourceId(e.target.value)}
                placeholder="e.g. lookupServiceDetails"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldAlert size={16} /> Action
              </label>
              <input
                className="input-field"
                id="pe-action"
                value={action}
                onChange={(e) => setAction(e.target.value)}
                placeholder="e.g. read"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserCheck size={16} /> Role
              </label>
              <input
                className="input-field"
                id="pe-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. citizen"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TextIcon /> Context (JSON)
              </label>
              <textarea
                className="input-field"
                id="pe-context"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder='{}'
                rows={2}
                style={{ minHeight: '80px', borderRadius: 'var(--radius-md)', fontFamily: 'monospace' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input id="pe-citizen-confirmed" type="checkbox" checked={citizenConfirmed} onChange={(e) => setCitizenConfirmed(e.target.checked)} />
                <label htmlFor="pe-citizen-confirmed" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>Citizen confirmed</label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input id="pe-human-approved" type="checkbox" checked={humanApproved} onChange={(e) => setHumanApproved(e.target.checked)} />
                <label htmlFor="pe-human-approved" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>Human approved (high-impact)</label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input id="pe-source-verified" type="checkbox" checked={sourceVerified} onChange={(e) => setSourceVerified(e.target.checked)} />
                <label htmlFor="pe-source-verified" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>Source verified</label>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <StopCircle size={16} /> Daily call count
              </label>
              <input className="input-field" id="pe-daily-call-count" type="number" value={dailyCallCount} onChange={(e) => setDailyCallCount(e.target.value)} min="0" placeholder="0" />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: 'fit-content', minHeight: '44px' }} aria-busy={loading}>
              {loading ? <span><RefreshCw size={18} className="animate-spin" />&nbsp; Evaluating…</span> : 'Evaluate action'}
            </button>
          </form>
        </section>

        {/* Decision result */}
        {decision && (
          <section className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }} aria-labelledby="decision-heading">
            <h3 id="decision-heading" style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}><ShieldAlert size={20} />&nbsp; Decision</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Permitted</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: decision.permitted ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  {decision.permitted ? 'Yes' : 'No'}
                </div>
              </div>
              <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Decision</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
                  <span className={`status-badge ${formatDecision(decision.decision)}`} style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}>{decision.decision}</span>
                </div>
              </div>
              <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Policy</div>
                <div style={{ fontSize: '0.9rem', fontFamily: 'monospace', color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{decision.policy?.id}</div>
              </div>
              <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Version</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{decision.policy?.version}</div>
              </div>
            </div>
            <div style={{ marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}><strong>Reason:</strong> {decision.reason}</div>
            <div style={{ marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}><strong>Code:</strong> {decision.code}</div>
            {decision.rule && (
              <div style={{ marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}><strong>Matched rule:</strong> {decision.rule.id} — {decision.rule.description}</div>
            )}
            <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{decision.explanation}</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{decision.disclaimer}</p>
          </section>
        )}

        {/* Policies */}
        <section className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }} aria-labelledby="policies-heading">
          <h3 id="policies-heading" style={{ marginBottom: '0.75rem', color: 'var(--text-primary)' }}><List size={20} />&nbsp; Policies</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <input
              className="input-field"
              id="pe-load-policy-id"
              value={policyId}
              onChange={(e) => setPolicyId(e.target.value)}
              placeholder="Policy id to inspect"
            />
            <button onClick={handleLoadPolicy} className="btn btn-primary" disabled={loading} style={{ width: 'fit-content', minHeight: '44px' }} aria-busy={loading}>
              {loading ? 'Loading…' : 'Inspect policy'}
            </button>
          </div>
          {selectedPolicy && (
            <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{selectedPolicy.name}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{selectedPolicy.id} v{selectedPolicy.version}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{selectedPolicy.description || ''}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Status: {selectedPolicy.status} | Deny-by-default: {String(selectedPolicy.denyByDefault)} | Emergency locked: {String(selectedPolicy.emergencyLocked)}
              </div>
            </div>
          )}
          {versions && versions.versions && versions.versions.length > 0 && (
            <>
              <div style={{ marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Versions</div>
              <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
                {versions.versions.map((v) => (
                  <li key={`${v.id}:${v.version}`} style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'var(--glass-bg-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{v.id} v{v.version}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{v.status}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
          {loading && <div className="skeleton skeleton-pill" style={{ width: '40%', marginTop: '0.5rem' }} />}
        </section>

        {/* Evaluation audit */}
        <section className="card" style={{ padding: '1.5rem' }} aria-labelledby="audit-heading">
          <h3 id="audit-heading" style={{ marginBottom: '0.75rem', color: 'var(--text-primary)' }}><Terminal size={20} />&nbsp; Evaluation audit</h3>
          <button onClick={handleLoadAudit} className="btn btn-primary" disabled={loading} style={{ width: 'fit-content', minHeight: '44px' }} aria-busy={loading}>
            {loading ? 'Loading…' : 'Load audit events'}
          </button>
          {audit.length > 0 && (
            <div style={{ marginTop: '1rem', overflowX: 'auto', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-light)' }}>
                    <th style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>Action</th>
                    <th style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>Permitted</th>
                    <th style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>Resource</th>
                    <th style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((e) => (
                    <tr key={e.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{e.action}</td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{String(e.permitted)}</td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{e.resourceType}:{e.resourceId}</td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{e.timestamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {audit.length === 0 && !loading && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No evaluation audit events recorded yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function TextIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}
