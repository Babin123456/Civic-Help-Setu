/**
 * src/components/costCarbonGovernor/CostCarbonGovernorWorkspace.jsx
 *
 * Mobile-first, accessible workspace for the Civic Agent Cost and Carbon
 * Budget Governor (#1185).
 *
 * Citizens and operators can:
 *  - Start a governed run for a workflow (estimates cost, tokens, energy,
 *    carbon before the call; fails closed on budget breach).
 *  * Record model calls and watch cumulative budgets and stop conditions.
 *  - Route to a deterministic fallback when budget is exhausted.
 *  - View run/workflow aggregates (aggregated metadata only — no citizen
 *    records, credentials, raw documents or sensitive prompts are displayed).
 *
 * All figures are estimates (labelled as such), never a bill.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  DollarSign,
  Activity,
  Cloud,
  ShieldAlert,
  AlertTriangle,
  Info,
  Play,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import {
  startRun,
  recordCall,
  stopRun,
  getWorkflowAggregate,
  listPolicies,
} from '../../services/costCarbonGovernorService.js';

const STATUS_COLORS = {
  pending: 'bg-amber-50 border-amber-200 text-amber-800',
  running: 'bg-blue-50 border-blue-200 text-blue-800',
  completed: 'bg-green-50 border-green-200 text-green-800',
  stopped: 'bg-rose-50 border-rose-200 text-rose-800',
  fallback: 'bg-purple-50 border-purple-200 text-purple-800',
  blocked: 'bg-orange-50 border-orange-200 text-orange-800',
  failed: 'bg-red-50 border-red-200 text-red-800',
};

function formatUsd(value) {
  try {
    return Number(value || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 6 });
  } catch {
    return `$0.000000`;
  }
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatGrams(value) {
  return Number(value || 0).toFixed(3);
}

export default function CostCarbonGovernorWorkspace() {
  const [workflowId, setWorkflowId] = useState('civic-assistant-query-flow');
  const [modelId, setModelId] = useState('gpt-4o-mini');
  const [prompt, setPrompt] = useState('');
  const [isHighImpact, setIsHighImpact] = useState(false);
  const [humanApproved, setHumanApproved] = useState(false);
  const [run, setRun] = useState(null);
  const [calls, setCalls] = useState([]);
  const [aggregate, setAggregate] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [policyId, setPolicyId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const clearMessages = useCallback(() => { setError(null); setNotice(null); }, []);

  useEffect(() => {
    let mounted = true;
    listPolicies().then((data) => {
      if (mounted) setPolicies(data || []);
    }).catch(() => {
      if (mounted) setError('Unable to load budget policies.');
    });
    return () => { mounted = false; };
  }, []);

  const handleStartRun = useCallback(async (e) => {
    e.preventDefault();
    clearMessages();
    if (!workflowId) { setError('Workflow id is required.'); return; }
    if (isHighImpact && !humanApproved) { setError('High-impact actions require explicit human approval.'); return; }
    setLoading(true);
    try {
      const result = await startRun({ workflowId, policyId: policyId || undefined, modelId, prompt: prompt || undefined, isHighImpact, humanApproved });
      if (!result.ok) { setError(result.error.message || 'Failed to start run.'); return; }
      setRun(result.run);
      setCalls([]);
      setNotice(`Run ${result.run.id} started under policy ${result.policy.id}. Cost/energy/carbon are estimates.`);
    } catch (err) {
      setError(String(err && err.message ? err.message : err));
    } finally {
      setLoading(false);
    }
  }, [workflowId, policyId, modelId, prompt, isHighImpact, humanApproved, clearMessages]);

  const handleRecordCall = useCallback(async (e) => {
    e.preventDefault();
    clearMessages();
    if (!run) { setError('Start a run first.'); return; }
    const callPrompt = prompt || 'Governed model call';
    setLoading(true);
    try {
      const result = await recordCall({
        runId: run.id,
        modelId,
        prompt: callPrompt,
        output: 'Governed assistant response (illustrative).',
        inputTokens: undefined,
        outputTokens: undefined,
        latencyMs: undefined,
        isHighImpact,
      });
      if (!result.ok) { setError(result.error.message || 'Failed to record call.'); return; }
      setCalls((prev) => [result.call, ...prev]);
      setRun((prev) => prev ? { ...prev, totals: result.runTotals, status: result.stopped ? 'stopped' : prev.status } : prev);
      setCalls((prev) => [result.call, ...prev]);
      if (result.stopped) {
        setNotice(`Run stopped: ${result.reason || 'budget or stop condition triggered.'}`);
      } else {
        setNotice(`Call recorded. Estimated cost ${result.estimate.costUSD} USD, ${result.estimate.totalTokens} tokens, ${result.estimate.carbonGCO2e} gCO2e.`);
      }
      if (result.billingMetadataGap) {
        setNotice((prev) => prev ? `${prev} Billing metadata gap: estimates only for model ${modelId}.` : `Billing metadata gap: estimates only for model ${modelId}.`);
      }
    } catch (err) {
      setError(String(err && err.message ? err.message : err));
    } finally {
      setLoading(false);
    }
  }, [run, modelId, prompt, isHighImpact, clearMessages]);

  const handleStopRun = useCallback(async (e) => {
    e.preventDefault();
    clearMessages();
    if (!run) { setError('No active run.'); return; }
    setLoading(true);
    try {
      const result = await stopRun({ runId: run.id, reason: 'Stopped by user from the governor workspace.' });
      if (!result.ok) { setError(result.error.message || 'Failed to stop run.'); return; }
      setRun((prev) => prev ? { ...prev, status: 'stopped', stopTrigger: { code: 'USER_STOP', message: 'Stopped by user.', at: new Date().toISOString() } } : prev);
      setNotice('Run stopped by user.');
    } catch (err) {
      setError(String(err && err.message ? err.message : err));
    } finally {
      setLoading(false);
    }
  }, [run, clearMessages]);

  const handleLoadAggregate = useCallback(async () => {
    clearMessages();
    if (!workflowId) { setError('Workflow id is required.'); return; }
    setLoading(true);
    try {
      const data = await getWorkflowAggregate(workflowId);
      setAggregate(data || null);
    } catch {
      setError('Unable to load workflow aggregate.');
    } finally {
      setLoading(false);
    }
  }, [workflowId, clearMessages]);

  return (
    <div className="section section-bg" id="cost-carbon-governor">
      <div className="container">
        <header className="page-header" style={{ marginBottom: '1.5rem' }}>
          <span className="content-badge content-badge--ai">Civic Agent Cost &amp; Carbon Budget Governor</span>
          <h2 className="page-header-title">Agent Budget &amp; Carbon Control</h2>
          <p className="page-header-subtitle">
            Track per-workflow model calls, tokens, latency and estimated
            energy/carbon. Enforce budgets and stop conditions, route to
            deterministic fallbacks, and view transparent estimates. All
            figures are estimates, not a bill.
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

        {/* Start a run form */}
        <section className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }} aria-labelledby="start-run-heading">
          <h3 id="start-run-heading" style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}><Play size={20} />&nbsp; Start a governed run</h3>
          <form onSubmit={handleStartRun} style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', alignItems: 'end' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={16} /> Workflow id
              </label>
              <input
                className="input-field"
                id="workflow-id"
                value={workflowId}
                onChange={(e) => setWorkflowId(e.target.value)}
                placeholder="e.g. civic-assistant-query-flow"
                aria-required="true"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <DollarSign size={16} /> Model id
              </label>
              <input
                className="input-field"
                id="model-id"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                placeholder="e.g. gpt-4o-mini"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Cloud size={16} /> Prompt (hashed before storage; no sensitive prompts kept)
              </label>
              <textarea
                className="input-field"
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Summarize the ration card eligibility rules for ward 7."
                rows={2}
                style={{ minHeight: '80px', borderRadius: 'var(--radius-md)' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldAlert size={16} /> Policy id (optional, default budget applied)
              </label>
              <input
                className="input-field"
                id="policy-id"
                value={policyId}
                onChange={(e) => setPolicyId(e.target.value)}
                placeholder="e.g. default-civic-agent-budget-v1"
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                id="high-impact"
                type="checkbox"
                checked={isHighImpact}
                onChange={(e) => setIsHighImpact(e.target.checked)}
                aria-label="Mark this run as high-impact (requires human approval)"
              />
              <label htmlFor="high-impact" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer', flex: 1 }}>
                High-impact action — explicit human approval required (no autonomous filings or denials)
              </label>
            </div>
            {isHighImpact && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                <input
                  id="human-approved"
                  type="checkbox"
                  checked={humanApproved}
                  onChange={(e) => setHumanApproved(e.target.checked)}
                  aria-label="Confirm explicit human approval for this high-impact run"
                />
                <label htmlFor="human-approved" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer', flex: 1 }}>
                  I confirm explicit human approval for this high-impact action
                </label>
              </div>
            )}
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: 'fit-content', minHeight: '44px' }} aria-busy={loading}>
              {loading ? <span><RefreshCw size={18} className="animate-spin" />&nbsp; Starting…</span> : 'Start governed run'}
            </button>
          </form>
        </section>

        {/* Record a call form */}
        {run && (
          <section className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }} aria-labelledby="record-call-heading">
            <h3 id="record-call-heading" style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}><Activity size={20} />&nbsp; Record a model call</h3>
            <form onSubmit={handleRecordCall} style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', alignItems: 'end' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <DollarSign size={16} /> Model id for this call
                </label>
                <input
                  className="input-field"
                  id="call-model-id"
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  placeholder="e.g. gpt-4o-mini"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Cloud size={16} /> Prompt (hashed; sensitive content never stored)
                </label>
                <textarea
                  className="input-field"
                  id="call-prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Retrieve official scheme details for the citizen."
                  rows={2}
                  style={{ minHeight: '80px', borderRadius: 'var(--radius-md)' }}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading || run.status !== 'running'} style={{ width: 'fit-content', minHeight: '44px' }} aria-busy={loading}>
                {loading ? 'Recording…' : run.status !== 'running' ? 'Run not active' : 'Record governed call'}
              </button>
              <button type="button" onClick={handleStopRun} className="btn btn-secondary" disabled={loading || run.status !== 'running'} style={{ width: 'fit-content', minHeight: '44px' }}>
                Stop run
              </button>
            </form>
          </section>
        )}

        {/* Run status + calls */}
        {run && (
          <section className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }} aria-labelledby="run-status-heading">
            <h3 id="run-status-heading" style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}><ShieldAlert size={20} />&nbsp; Run status</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Run id</div>
                <div style={{ fontSize: '0.9rem', fontFamily: 'monospace', color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{run.id}</div>
              </div>
              <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Status</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
                  <span className={`status-badge ${STATUS_COLORS[run.status] || STATUS_COLORS.pending}`} style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}>{run.status}</span>
                  {run.stopTrigger && <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>(stopped: {run.stopTrigger.message})</span>}
                </div>
              </div>
              <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Est. cost</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatUsd(run.totals?.costUSD ?? 0)}</div>
              </div>
              <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Est. tokens</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatNumber(run.totals?.inputTokens ?? 0) + ' in / ' + formatNumber(run.totals?.outputTokens ?? 0) + ' out'}</div>
              </div>
              <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Est. carbon</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatGrams(run.totals?.carbonGCO2e ?? 0)} gCO2e</div>
              </div>
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '0.5rem' }}>Calls ({calls.length})</div>
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-light)' }}>
                    <th style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>Model</th>
                    <th style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>Source</th>
                    <th style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>Tokens</th>
                    <th style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>Cost</th>
                    <th style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>Carbon</th>
                    <th style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call) => (
                    <tr key={call.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{call.modelId}</td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{call.callSource}</td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{formatNumber(call.totalTokens)}</td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{formatUsd(call.costUSD)}</td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{formatGrams(call.carbonGCO2e)} g</td>
                      <td style={{ padding: '0.75rem' }}><span className={`status-badge ${STATUS_COLORS[call.status] || STATUS_COLORS.completed}`} style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}>{call.status}</span></td>
                    </tr>
                  ))}
                  {calls.length === 0 && (
                    <tr><td style={{ padding: '1rem', color: 'var(--text-tertiary)', textAlign: 'center', colSpan: 6 }}>No calls recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {run.billingMetadataGap !== undefined && run.billingMetadataGap && (
              <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={16} /> Billing metadata gap: this run used estimates only (no verified provider billing metadata).
              </div>
            )}
            <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{run.disclaimer || 'Cost, energy and carbon figures are estimates only.'}</p>
          </section>
        )}

        {/* Workflow aggregate */}
        <section className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }} aria-labelledby="aggregate-heading">
          <h3 id="aggregate-heading" style={{ marginBottom: '0.75rem', color: 'var(--text-primary)' }}><TrendingUp size={20} />&nbsp; Workflow aggregate</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <input
              className="input-field"
              id="agg-workflow-id"
              value={workflowId}
              onChange={(e) => setWorkflowId(e.target.value)}
              placeholder="Workflow id to aggregate"
            />
            <button onClick={handleLoadAggregate} className="btn btn-primary" disabled={loading} style={{ width: 'fit-content', minHeight: '44px' }} aria-busy={loading}>
              {loading ? <span><RefreshCw size={18} className="animate-spin" />&nbsp; Loading…</span> : 'Load aggregate'}
            </button>
          </div>
          {aggregate && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Runs</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{aggregate.runCount}</div>
              </div>
              <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Total calls</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatNumber(aggregate.totals?.calls ?? 0)}</div>
              </div>
              <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Total cost</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatUsd(aggregate.totals?.costUSD ?? 0)}</div>
              </div>
              <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Total carbon</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatGrams(aggregate.totals?.carbonGCO2e ?? 0)} gCO2e</div>
              </div>
            </div>
          )}
          {loading && <div className="skeleton skeleton-pill" style={{ width: '40%', marginTop: '0.5rem' }} />}
        </section>

        {/* Policies */}
        <section className="card" style={{ padding: '1.5rem' }} aria-labelledby="policies-heading">
          <h3 id="policies-heading" style={{ marginBottom: '0.75rem', color: 'var(--text-primary)' }}><ShieldAlert size={20} />&nbsp; Budget policies</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Policies define per-workflow cost, token, latency and carbon ceilings.</p>
          {policies.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No policies configured. The default budget policy applies.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
              {policies.map((p) => (
                <li key={p.id} style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'var(--glass-bg-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{p.id} v{p.version}</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{p.description || ''}</p>
                </li>
              ))}
            </ul>
          )}
          <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Policies can be created/updated via the operator API at /api/civic-agent-cost-carbon/policies.</p>
        </section>
      </div>
    </div>
  );
}
