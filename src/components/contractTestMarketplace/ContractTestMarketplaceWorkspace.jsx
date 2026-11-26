/**
 * src/components/contractTestMarketplace/ContractTestMarketplaceWorkspace.jsx
 *
 * Mobile-first, accessible workspace for the Civic Service Integration
 * Contract Test Marketplace (#1191).
 *
 * Maintainers can:
 *  - Register provider adapters (REST, SOAP, GraphQL, file, database, message queue).
 *  - Create contract suites grouping related tests (auth, schema, pagination,
 *    freshness, error behavior, breaking change, malicious payload).
 *  * Run contract suites against adapters and view conformance scores.
 *  - Review test results, breaking changes and malicious payload detections.
 *  - View audit log and feature weights.
 *
 * All outputs are deterministic conformance checks for maintainer review.
 * They never autonomously edit provider configurations, file applications,
 * deny benefits, or claim official verification. No citizen records,
 * credentials, raw documents or sensitive prompts are displayed or stored.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Info,
  Play,
  RefreshCw,
  List,
  Link,
  UserCheck,
  Edit3,
  BarChart3,
  ShieldCheck
} from 'lucide-react';
import {
  upsertAdapter,
  listAdapters,
  upsertSuite,
  listSuites,
  runSuite,
  getRunResults,
  getAuditLog,
  listFeatureWeights,
  ADAPTER_TYPE,
  CONTRACT_SUITE_STATUS
} from '../../services/civicContractTestMarketplaceService.js';

const RESULT_COLORS = {
  pass: 'bg-green-50 border-green-200 text-green-800',
  fail: 'bg-rose-50 border-rose-200 text-rose-800',
  skip: 'bg-amber-50 border-amber-200 text-amber-800',
  error: 'bg-indigo-50 border-indigo-200 text-indigo-800',
  warn: 'bg-orange-50 border-orange-200 text-orange-800'
};

function formatScore(value) {
  return Math.round(Number(value || 0));
}

function resultColor(result) {
  return RESULT_COLORS[result] || RESULT_COLORS.pass;
}

export default function ContractTestMarketplaceWorkspace() {
  const [adapterId, setAdapterId] = useState('');
  const [adapterName, setAdapterName] = useState('');
  const [adapterType, setAdapterType] = useState(ADAPTER_TYPE.REST);
  const [baseUrl, setBaseUrl] = useState('');
  const [suiteId, setSuiteId] = useState('');
  const [suiteName, setSuiteName] = useState('');

  const [adapters, setAdapters] = useState([]);
  const [suites, setSuites] = useState([]);
  const [selectedAdapter, setSelectedAdapter] = useState(null);
  const [selectedSuite, setSelectedSuite] = useState(null);
  const [currentRun, setCurrentRun] = useState(null);
  const [runResults, setRunResults] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [featureWeights, setFeatureWeights] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const clearMessages = useCallback(() => { setError(null); setNotice(null); }, []);

  const loadAdapters = useCallback(async () => {
    try {
      const data = await listAdapters();
      setAdapters(data || []);
    } catch {
      setError('Unable to load adapters.');
    }
  }, [listAdapters]);

  const loadSuites = useCallback(async () => {
    try {
      const data = await listSuites();
      setSuites(data || []);
    } catch {
      setError('Unable to load suites.');
    }
  }, [listSuites]);

  const loadFeatureWeights = useCallback(async () => {
    try {
      const weights = await listFeatureWeights();
      setFeatureWeights(weights || {});
    } catch {
      setError('Unable to load feature weights.');
    }
  }, [listFeatureWeights]);

  const loadAuditLog = useCallback(async () => {
    try {
      const data = await getAuditLog({ limit: 50 });
      setAuditLog(data || []);
    } catch {
      setError('Unable to load audit log.');
    }
  }, [getAuditLog]);

  useEffect(() => {
    loadAdapters();
    loadSuites();
    loadFeatureWeights();
    loadAuditLog();
  }, [loadAdapters, loadSuites, loadFeatureWeights, loadAuditLog]);

  const handleRegisterAdapter = useCallback(async (e) => {
    e.preventDefault();
    clearMessages();
    if (!adapterId) { setError('Adapter id is required.'); return; }
    if (!adapterName) { setError('Adapter name is required.'); return; }
    setLoading(true);
    try {
      const result = await upsertAdapter({
        id: adapterId,
        name: adapterName,
        type: adapterType,
        baseUrl: baseUrl || undefined,
        authType: 'none',
        authConfig: {},
        headers: {},
        timeoutMs: 10000,
        retryCount: 2,
        isActive: true,
        description: `Adapter for ${adapterName}`,
        createdBy: 'maintainer',
        nowIso: new Date().toISOString()
      });
      if (!result.ok) {
        setError(result.error.message || 'Failed to register adapter.');
        return;
      }
      setSelectedAdapter(result.adapter);
      setAdapters([...adapters, result.adapter]);
      setNotice(`Adapter ${adapterId} registered.`);
    } catch (err) {
      setError(String(err && err.message ? err.message : err));
    } finally {
      setLoading(false);
    }
  }, [adapterId, adapterName, adapterType, baseUrl, upsertAdapter, adapters, clearMessages]);

  const handleRegisterSuite = useCallback(async (e) => {
    e.preventDefault();
    clearMessages();
    if (!suiteId) { setError('Suite id is required.'); return; }
    if (!suiteName) { setError('Suite name is required.'); return; }
    if (!selectedAdapter) { setError('Select an adapter first.'); return; }
    setLoading(true);
    try {
      const result = await upsertSuite({
        id: suiteId,
        adapterId: selectedAdapter.id,
        name: suiteName,
        description: `Suite for ${suiteName}`,
        status: CONTRACT_SUITE_STATUS.DRAFT,
        tests: [],
        schedule: 'manual',
        createdBy: 'maintainer',
        nowIso: new Date().toISOString()
      });
      if (!result.ok) {
        setError(result.error.message || 'Failed to register suite.');
        return;
      }
      setSelectedSuite(result.suite);
      setSuites([...suites, result.suite]);
      setNotice(`Suite ${suiteId} registered.`);
    } catch (err) {
      setError(String(err && err.message ? err.message : err));
    } finally {
      setLoading(false);
    }
  }, [suiteId, suiteName, selectedAdapter, upsertSuite, suites, clearMessages]);

  const handleRunSuite = useCallback(async (e) => {
    e.preventDefault();
    clearMessages();
    if (!selectedSuite) { setError('Select a suite first.'); return; }
    setLoading(true);
    try {
      const result = await runSuite({
        suiteId: selectedSuite.id,
        adapterId: selectedAdapter.id,
        forceRecompute: false,
        nowIso: new Date().toISOString()
      });
      if (!result.ok) {
        setError(result.error.message || 'Failed to run suite.');
        return;
      }
      setCurrentRun(result.run);
      setRunResults(result.results || []);
      setNotice(`Suite run completed: score ${result.conformanceScore}.`);
      // Refresh suites to get updated lastRunStatus
      await loadSuites();
    } catch (err) {
      setError(String(err && err.message ? err.message : err));
    } finally {
      setLoading(false);
    }
  }, [selectedSuite, selectedAdapter, runSuite, loadSuites, clearMessages]);

  const handleGetRunResults = useCallback(async () => {
    clearMessages();
    if (!currentRun) { setError('No run selected.'); return; }
    setLoading(true);
    try {
      const results = await getRunResults({ runId: currentRun.id, limit: 1000 });
      setRunResults(results || []);
    } catch {
      setError('Unable to load run results.');
    } finally {
      setLoading(false);
    }
  }, [currentRun, getRunResults, clearMessages]);

  return (
    <div className="section section-bg" id="contract-test-marketplace">
      <div className="container">
        <header className="page-header" style={{ marginBottom: '1.5rem' }}>
          <span className="content-badge content-badge--ai">Civic Service Integration Contract Test Marketplace</span>
          <h2 className="page-header-title">Contract Test Marketplace</h2>
          <p className="page-header-subtitle">
            Define provider adapters and reusable contract suites; validate
            authentication, schema, pagination, freshness and error behavior;
            run scheduled sandbox checks; publish redacted conformance reports.
            Tests are deterministic triage hints for maintainer review — never
            an autonomous change.
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

        {/* Register adapter */}
        <section className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }} aria-labelledby="register-adapter-heading">
          <h3 id="register-adapter-heading" style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}><ShieldCheck size={20} />&nbsp; Register Provider Adapter</h3>
          <form onSubmit={handleRegisterAdapter} style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Link size={16} /> Adapter id
              </label>
              <input
                className="input-field"
                id="ctm-adapter-id"
                value={adapterId}
                onChange={(e) => setAdapterId(e.target.value)}
                placeholder="e.g. ration-card-api"
                aria-required="true"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldAlert size={16} /> Adapter name
              </label>
              <input
                className="input-field"
                id="ctm-adapter-name"
                value={adapterName}
                onChange={(e) => setAdapterName(e.target.value)}
                placeholder="e.g. Ration Card API"
                aria-required="true"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <List size={16} /> Adapter type
              </label>
              <select
                className="input-field"
                id="ctm-adapter-type"
                value={adapterType}
                onChange={(e) => setAdapterType(e.target.value)}
              >
                {Object.values(ADAPTER_TYPE).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Link size={16} /> Base URL
              </label>
              <input
                className="input-field"
                id="ctm-base-url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="e.g. https://api.example.gov.in"
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: 'fit-content', minHeight: '44px' }} aria-busy={loading}>
              {loading ? <span><RefreshCw size={18} className="animate-spin" />&nbsp; Registering…</span> : 'Register adapter'}
            </button>
          </form>
        </section>

        {/* Register suite */}
        <section className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }} aria-labelledby="register-suite-heading">
          <h3 id="register-suite-heading" style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}><List size={20} />&nbsp; Register Contract Suite</h3>
          <form onSubmit={handleRegisterSuite} style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Link size={16} /> Adapter
              </label>
              <select
                className="input-field"
                id="ctm-suite-adapter"
                value={selectedAdapter?.id || ''}
                onChange={(e) => {
                  const adapter = adapters.find((a) => a.id === e.target.value);
                  setSelectedAdapter(adapter || null);
                }}
              >
                <option value="">Select an adapter</option>
                {adapters.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={16} /> Suite id
              </label>
              <input
                className="input-field"
                id="ctm-suite-id"
                value={suiteId}
                onChange={(e) => setSuiteId(e.target.value)}
                placeholder="e.g. ration-card-suite"
                aria-required="true"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserCheck size={16} /> Suite name
              </label>
              <input
                className="input-field"
                id="ctm-suite-name"
                value={suiteName}
                onChange={(e) => setSuiteName(e.target.value)}
                placeholder="e.g. Ration Card Contract Suite"
                aria-required="true"
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading || !selectedAdapter} style={{ width: 'fit-content', minHeight: '44px' }} aria-busy={loading}>
              {loading ? <span><RefreshCw size={18} className="animate-spin" />&nbsp; Registering…</span> : 'Register suite'}
            </button>
          </form>
        </section>

        {/* Run suite */}
        {selectedSuite && (
          <section className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }} aria-labelledby="run-suite-heading">
            <h3 id="run-suite-heading" style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}><Play size={20} />&nbsp; Run Suite: {selectedSuite.name}</h3>
            <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Adapter: {selectedAdapter?.name} ({selectedAdapter.id}) | Status: {selectedSuite.status}
            </div>
            <button onClick={handleRunSuite} className="btn btn-primary" disabled={loading || !selectedAdapter} style={{ width: 'fit-content', minHeight: '44px' }} aria-busy={loading}>
              {loading ? <span><RefreshCw size={18} className="animate-spin" />&nbsp; Running…</span> : 'Run contract suite'}
            </button>
          </section>
        )}

        {/* Current run result */}
        {currentRun && (
          <section className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }} aria-labelledby="run-result-heading">
            <h3 id="run-result-heading" style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}><BarChart3 size={20} />&nbsp; Run Result</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Suite</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{currentRun.suiteId}</div>
              </div>
              <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Conformance Score</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{formatScore(currentRun.conformanceScore)} / 100</div>
              </div>
              <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Status</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{currentRun.status}</div>
              </div>
              <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Total Tests</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{currentRun.summary?.total || 0}</div>
              </div>
              <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Passed</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{currentRun.summary?.passed || 0}</div>
              </div>
              <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Failed</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{currentRun.summary?.failed || 0}</div>
              </div>
            </div>
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button onClick={handleGetRunResults} className="btn btn-primary" disabled={loading} style={{ minHeight: '44px' }} aria-busy={loading}>
                {loading ? 'Loading…' : 'View Test Results'}
              </button>
            </div>
          </section>
        )}

        {/* Run results */}
        {runResults.length > 0 && (
          <section className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }} aria-labelledby="run-results-heading">
            <h3 id="run-results-heading" style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}><ShieldAlert size={20} />&nbsp; Test Results</h3>
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-light)' }}>
                    <th style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>Test</th>
                    <th style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>Type</th>
                    <th style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>Result</th>
                    <th style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {runResults.map((r) => (
                    <tr key={r.testId} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{r.testName || r.testId}</td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{r.testType}</td>
                      <td style={{ padding: '0.75rem' }}><span className={`status-badge ${resultColor(r.result)}`} style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}>{r.result}</span></td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{r.issues?.length || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Feature weights */}
        <section className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }} aria-labelledby="weights-heading">
          <h3 id="weights-heading" style={{ marginBottom: '0.75rem', color: 'var(--text-primary)' }}><Edit3 size={20} />&nbsp; Feature Weights</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Deterministic weights used to compute priority scores.</p>
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
        </section>

        {/* Audit log */}
        <section className="card" style={{ padding: '1.5rem' }} aria-labelledby="audit-heading">
          <h3 id="audit-heading" style={{ marginBottom: '0.75rem', color: 'var(--text-primary)' }}><UserCheck size={20} />&nbsp; Audit Log</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>{auditLog.length} audit event(s) recorded.</p>
          {auditLog.length > 0 && (
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-light)' }}>
                    <th style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>Action</th>
                    <th style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>Entity</th>
                    <th style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>Actor</th>
                    <th style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>At</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map((e) => (
                    <tr key={e.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{e.action}</td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{e.details?.adapterId || e.details?.suiteId || e.details?.runId || e.entityId}</td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{e.actorId}</td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{e.timestamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
