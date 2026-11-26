/**
 * src/components/recommendationExperimentation/RecommendationExperimentationWorkspace.jsx
 *
 * Mobile-first accessible workspace UI for the Civic Service Recommendation
 * Experimentation Platform with Guardrails (#1193).
 *
 * Provides maintainers with:
 * 1. Experiments catalog with status badges and strategy configs.
 * 2. Experiment registration with guardrail threshold configuration.
 * 3. Deterministic assignment simulator with opt-in and safety fallbacks.
 * 4. Guardrail health metrics and cohort size enforcement.
 * 5. Immediate rollback trigger and audit history.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  FlaskConical,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  CheckCircle,
  XCircle,
  Info,
  Play,
  List,
  Lock
} from 'lucide-react';
import {
  listExperiments,
  upsertExperiment,
  assignVariant,
  recordMetric,
  rollbackExperiment,
  getExperimentMetrics,
  getAuditLog,
  EXPERIMENT_STATUS,
  CIVIC_EXPERIMENTATION_DISCLAIMER
} from '../../services/civicRecommendationExperimentationService.js';

export default function RecommendationExperimentationWorkspace() {
  const [experiments, setExperiments] = useState([]);
  const [selectedExperiment, setSelectedExperiment] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'create' | 'simulator' | 'audit'

  // Creation form state
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [minRelevance, setMinRelevance] = useState(0.60);
  const [minLangCoverage, setMinLangCoverage] = useState(0.80);
  const [maxErrorRate, setMaxErrorRate] = useState(0.05);
  const [minCohortSize, setMinCohortSize] = useState(20);
  const [optInRequired, setOptInRequired] = useState(true);

  // Simulation state
  const [simCitizenId, setSimCitizenId] = useState('citizen-urban-01');
  const [simOptIn, setSimOptIn] = useState(true);
  const [simLang, setSimLang] = useState('hi');
  const [simResult, setSimResult] = useState(null);

  // Feedback state
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const clearMessages = () => {
    setNotice(null);
    setError(null);
  };

  const loadData = useCallback(async () => {
    try {
      const exps = await listExperiments();
      setExperiments(exps || []);
      if (exps && exps.length > 0 && !selectedExperiment) {
        setSelectedExperiment(exps[0]);
      }
      const audits = await getAuditLog({ limit: 30 });
      setAuditLog(audits || []);
    } catch {
      setError('Unable to load experimentation data.');
    }
  }, [selectedExperiment]);

  const loadSelectedMetrics = useCallback(async (expId) => {
    if (!expId) return;
    try {
      const data = await getExperimentMetrics(expId);
      setMetrics(data);
    } catch {
      // Metrics can be empty on new experiments
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (selectedExperiment?.id) {
      loadSelectedMetrics(selectedExperiment.id);
    }
  }, [selectedExperiment, loadSelectedMetrics]);

  const handleCreateExperiment = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!newId || !newName) {
      setError('ID and Name are required.');
      return;
    }
    setLoading(true);
    try {
      const res = await upsertExperiment({
        id: newId,
        name: newName,
        description: newDesc,
        status: EXPERIMENT_STATUS.ACTIVE,
        variants: [
          {
            id: 'control',
            name: 'Standard Rule-Based',
            weight: 50,
            strategyConfig: { intentWeight: 0.35, documentWeight: 0.25 }
          },
          {
            id: 'treatment-enhanced',
            name: 'Enhanced Strategy',
            weight: 50,
            strategyConfig: { intentWeight: 0.40, documentWeight: 0.30 }
          }
        ],
        guardrails: {
          minRelevanceScore: Number(minRelevance),
          minLanguageCoverage: Number(minLangCoverage),
          maxErrorRate: Number(maxErrorRate),
          minCohortSize: Number(minCohortSize)
        },
        optInRequired
      });

      if (!res.ok) {
        setError(res.error?.message || 'Failed to create experiment.');
      } else {
        setNotice(`Experiment ${newId} created and active.`);
        setNewId('');
        setNewName('');
        setNewDesc('');
        await loadData();
        setActiveTab('catalog');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateAssignment = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!selectedExperiment) {
      setError('Select an experiment first.');
      return;
    }
    setLoading(true);
    try {
      const res = await assignVariant({
        experimentId: selectedExperiment.id,
        citizenId: simCitizenId,
        context: { preferredLanguage: simLang, deviceType: 'mobile' },
        optIn: simOptIn
      });
      setSimResult(res);

      // Record a synthetic metric evaluation based on assignment
      await recordMetric({
        experimentId: selectedExperiment.id,
        variantId: res.variant.id,
        relevanceScore: res.assigned ? 0.88 : 0.70,
        hasLanguageCoverage: simLang === 'hi' || simLang === 'en',
        isError: false
      });

      await loadSelectedMetrics(selectedExperiment.id);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (expId) => {
    clearMessages();
    setLoading(true);
    try {
      const res = await rollbackExperiment({
        experimentId: expId,
        reason: 'Operator triggered emergency rollback from workspace UI'
      });
      if (res.ok) {
        setNotice(`Experiment ${expId} rolled back successfully.`);
        await loadData();
        await loadSelectedMetrics(expId);
      } else {
        setError(res.error?.message || 'Rollback failed.');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="section section-bg" id="recommendation-experimentation-workspace">
      <div className="container">
        {/* Header */}
        <header className="page-header" style={{ marginBottom: '1.5rem' }}>
          <span className="content-badge content-badge--ai">Civic Recommendation Guardrails (#1193)</span>
          <h2 className="page-header-title">Recommendation Experimentation Platform</h2>
          <p className="page-header-subtitle">
            Compare recommendation algorithms with deterministic feature flags, privacy-safe cohort
            aggregation, opt-in consent, and strict guardrails.
          </p>
        </header>

        {/* Disclaimer Alert */}
        <div className="alert alert-info" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <Info size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
          <p style={{ margin: 0, fontSize: '0.9rem' }}>{CIVIC_EXPERIMENTATION_DISCLAIMER}</p>
        </div>

        {/* Feedback Notices */}
        {notice && (
          <div className="alert alert-success" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
            <CheckCircle size={18} />
            <span>{notice}</span>
          </div>
        )}
        {error && (
          <div className="alert alert-danger" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
            <XCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Workspace Navigation Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'catalog' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => { clearMessages(); setActiveTab('catalog'); }}
          >
            <FlaskConical size={16} style={{ marginRight: '6px' }} />
            Experiments Catalog
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'create' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => { clearMessages(); setActiveTab('create'); }}
          >
            <ShieldAlert size={16} style={{ marginRight: '6px' }} />
            New Experiment
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'simulator' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => { clearMessages(); setActiveTab('simulator'); }}
          >
            <Play size={16} style={{ marginRight: '6px' }} />
            Assignment Simulator
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'audit' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => { clearMessages(); setActiveTab('audit'); }}
          >
            <List size={16} style={{ marginRight: '6px' }} />
            Audit Trail
          </button>
        </div>

        {/* TAB 1: EXPERIMENTS CATALOG */}
        {activeTab === 'catalog' && (
          <div className="grid grid-2" style={{ gap: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Active & Registered Experiments</h3>
              {experiments.length === 0 ? (
                <p style={{ color: '#64748b' }}>No experiments found.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {experiments.map((exp) => (
                    <div
                      key={exp.id}
                      onClick={() => setSelectedExperiment(exp)}
                      style={{
                        padding: '1rem',
                        borderRadius: '8px',
                        border: selectedExperiment?.id === exp.id ? '2px solid #2563eb' : '1px solid #cbd5e1',
                        background: '#ffffff',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong>{exp.name}</strong>
                        <span className={`badge ${exp.status === 'active' ? 'badge-success' : exp.status === 'rolled_back' ? 'badge-danger' : 'badge-secondary'}`}>
                          {exp.status}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.5rem 0' }}>{exp.description}</p>
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: '#475569' }}>
                        <span>ID: <code>{exp.id}</code></span>
                        <span>Variants: {exp.variantCount}</span>
                        {exp.guardrailBreachesCount > 0 && (
                          <span style={{ color: '#dc2626', fontWeight: 600 }}>Breaches: {exp.guardrailBreachesCount}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Experiment Inspector & Guardrails */}
            <div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Guardrail Health & Performance</h3>
              {selectedExperiment ? (
                <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <h4>{selectedExperiment.name}</h4>
                  <p style={{ fontSize: '0.85rem', color: '#64748b' }}>{selectedExperiment.description}</p>

                  <div style={{ margin: '1rem 0', display: 'flex', gap: '0.5rem' }}>
                    {selectedExperiment.status === 'active' && (
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        disabled={loading}
                        onClick={() => handleRollback(selectedExperiment.id)}
                      >
                        <RotateCcw size={14} style={{ marginRight: '4px' }} />
                        Trigger Immediate Rollback
                      </button>
                    )}
                  </div>

                  {metrics && (
                    <div style={{ marginTop: '1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Comparative Variant Metrics</span>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          Min Cohort: {metrics.minCohortSize} samples
                        </span>
                      </div>

                      {Object.entries(metrics.variants || {}).map(([variantId, v]) => (
                        <div key={variantId} style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', marginBottom: '0.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <strong>Variant: {variantId}</strong>
                            <span style={{ fontSize: '0.8rem' }}>Assignments: {v.assignments}</span>
                          </div>
                          {!v.cohortSizeMet ? (
                            <p style={{ margin: '0.25rem 0', fontSize: '0.75rem', color: '#b45309' }}>
                              <Lock size={12} style={{ display: 'inline', marginRight: '4px' }} />
                              Cohort size threshold not met. Aggregates masked for privacy.
                            </p>
                          ) : (
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem', fontSize: '0.8rem' }}>
                              <span>Mean Relevance: {(v.meanRelevance * 100).toFixed(1)}%</span>
                              <span>Lang Coverage: {(v.languageCoverageRatio * 100).toFixed(1)}%</span>
                              <span>Error Rate: {(v.errorRate * 100).toFixed(1)}%</span>
                            </div>
                          )}
                        </div>
                      ))}

                      {metrics.guardrailBreaches && metrics.guardrailBreaches.length > 0 && (
                        <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#991b1b', fontWeight: 600 }}>
                            <AlertTriangle size={16} />
                            <span>Guardrail Breaches Detected</span>
                          </div>
                          <ul style={{ margin: '0.5rem 0 0 1.25rem', fontSize: '0.8rem', color: '#991b1b' }}>
                            {metrics.guardrailBreaches.map((b, i) => (
                              <li key={i}>
                                Variant <code>{b.variantId}</code>: {b.breaches.map((x) => x.type).join(', ')} ({new Date(b.timestamp).toLocaleTimeString()})
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ color: '#64748b' }}>Select an experiment to view metrics.</p>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: CREATE EXPERIMENT */}
        {activeTab === 'create' && (
          <div style={{ maxWidth: '650px', background: '#ffffff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Register New Experiment with Guardrails</h3>
            <form onSubmit={handleCreateExperiment}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  Experiment Slug ID
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. exp-distance-boost"
                  value={newId}
                  onChange={(e) => setNewId(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  Display Name
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Ward-Level Proximity Prioritization"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  Description & Hypothesis
                </label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="State the hypothesis and strategy trade-offs..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
              </div>

              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '6px', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                  <ShieldCheck size={18} color="#16a34a" />
                  <span>Mandatory Guardrail Thresholds</span>
                </div>

                <div className="grid grid-2" style={{ gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', display: 'block' }}>Min Relevance Floor (0-1)</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      className="form-control"
                      value={minRelevance}
                      onChange={(e) => setMinRelevance(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', display: 'block' }}>Min Language Coverage (0-1)</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      className="form-control"
                      value={minLangCoverage}
                      onChange={(e) => setMinLangCoverage(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', display: 'block' }}>Max Error Rate (0-1)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="0.5"
                      className="form-control"
                      value={maxErrorRate}
                      onChange={(e) => setMaxErrorRate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', display: 'block' }}>Min Cohort Threshold</label>
                    <input
                      type="number"
                      min="10"
                      max="500"
                      className="form-control"
                      value={minCohortSize}
                      onChange={(e) => setMinCohortSize(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={optInRequired}
                    onChange={(e) => setOptInRequired(e.target.checked)}
                  />
                  <span style={{ fontSize: '0.85rem' }}>Require explicit citizen opt-in before assigning to experiment</span>
                </label>
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Creating...' : 'Register & Activate Experiment'}
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: ASSIGNMENT SIMULATOR */}
        {activeTab === 'simulator' && (
          <div style={{ maxWidth: '650px', background: '#ffffff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Deterministic Assignment Sandbox</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
              Simulate citizen recommendation requests to verify deterministic hashing, opt-in enforcement, and
              safe control fallback.
            </p>

            <form onSubmit={handleSimulateAssignment}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  Target Experiment
                </label>
                <select
                  className="form-control"
                  value={selectedExperiment?.id || ''}
                  onChange={(e) => {
                    const match = experiments.find((x) => x.id === e.target.value);
                    if (match) setSelectedExperiment(match);
                  }}
                >
                  {experiments.map((x) => (
                    <option key={x.id} value={x.id}>{x.name} ({x.id})</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  Citizen Pseudonymous Identifier
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={simCitizenId}
                  onChange={(e) => setSimCitizenId(e.target.value)}
                  placeholder="e.g. citizen-991"
                  required
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  Preferred Language Context
                </label>
                <select className="form-control" value={simLang} onChange={(e) => setSimLang(e.target.value)}>
                  <option value="en">English (en)</option>
                  <option value="hi">Hindi (hi)</option>
                  <option value="ta">Tamil (ta)</option>
                  <option value="bn">Bengali (bn)</option>
                </select>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={simOptIn}
                    onChange={(e) => setSimOptIn(e.target.checked)}
                  />
                  <span style={{ fontSize: '0.85rem' }}>Citizen has explicitly opted in to experimental features</span>
                </label>
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading}>
                Run Assignment Evaluation
              </button>
            </form>

            {simResult && (
              <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem' }}>Assignment Result</h4>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                  <span>Assigned Variant: <strong>{simResult.variant?.name}</strong> (<code>{simResult.variant?.id}</code>)</span>
                  <span>Bucket: <code>{simResult.bucket ?? 'N/A'}</code></span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Reason: <code>{simResult.reason}</code>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: AUDIT TRAIL */}
        {activeTab === 'audit' && (
          <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Governance Audit Trail</h3>
            {auditLog.length === 0 ? (
              <p style={{ color: '#64748b' }}>No audit events recorded.</p>
            ) : (
              <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem' }}>Timestamp</th>
                    <th style={{ padding: '0.5rem' }}>Action</th>
                    <th style={{ padding: '0.5rem' }}>Experiment</th>
                    <th style={{ padding: '0.5rem' }}>Actor</th>
                    <th style={{ padding: '0.5rem' }}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.5rem', color: '#64748b' }}>{new Date(log.timestamp).toLocaleString()}</td>
                      <td style={{ padding: '0.5rem' }}><code>{log.action}</code></td>
                      <td style={{ padding: '0.5rem' }}>{log.entityId}</td>
                      <td style={{ padding: '0.5rem' }}>{log.actorRole} ({log.actorId})</td>
                      <td style={{ padding: '0.5rem' }}>{log.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
