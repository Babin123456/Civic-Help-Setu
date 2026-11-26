import { useState, useMemo } from 'react';
import {
  Clock,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Layers,
  History,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Scale,
} from 'lucide-react';
import {
  getStoredRules,
  getStoredEvaluationSnapshots,
  saveEvaluationSnapshotRecord,
  resetRulesToDefault,
} from '../services/temporalPolicyStorage';
import {
  resolveAsOfRule,
  evaluateEffectiveDatedPolicy,
  detectTemporalAnomalies,
  createEvaluationSnapshot,
  simulatePolicyAcrossDates,
  EVALUATION_OUTCOME,
  STATUTORY_DISCLAIMER,
} from '../services/temporalPolicyEngineService';

export default function TemporalPolicyWorkspace() {
  const [rules, setRules] = useState(() => getStoredRules());
  const [selectedFamily, setSelectedFamily] = useState('scheme_ews_certificate');
  const [selectedJurisdiction, setSelectedJurisdiction] = useState('IN-MH');
  const [eventDate, setEventDate] = useState('2022-06-15');
  const [eventDateType, setEventDateType] = useState('APPLICATION_DATE');
  const [activeTab, setActiveTab] = useState('simulator'); // 'simulator' | 'timeline' | 'anomalies' | 'audit'

  // Input facts for evaluation
  const [facts, setFacts] = useState({
    annualFamilyIncome: 750000,
    agriculturalLandAcres: 3,
    residentialPlotSqYards: 150,
    aadhaarSeededBankAccount: true,
    age: 62,
    residenceYears: 4,
  });

  const [evaluationResult, setEvaluationResult] = useState(null);
  const [simulationResult, setSimulationResult] = useState(null);
  const [snapshots, setSnapshots] = useState(() => getStoredEvaluationSnapshots());
  const [copiedSnapshotId, setCopiedSnapshotId] = useState(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

  // Extract distinct families
  const distinctFamilies = useMemo(() => {
    const map = new Map();
    rules.forEach((r) => {
      if (!map.has(r.ruleFamilyId)) {
        map.set(r.ruleFamilyId, r.title.split('(')[0].trim());
      }
    });
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [rules]);

  // Extract jurisdictions for chosen family
  const distinctJurisdictions = useMemo(() => {
    const list = [];
    rules
      .filter((r) => r.ruleFamilyId === selectedFamily)
      .forEach((r) => {
        if (!list.includes(r.jurisdictionCode)) list.push(r.jurisdictionCode);
      });
    return list;
  }, [rules, selectedFamily]);

  // Family timeline rules sorted chronologically
  const familyTimeline = useMemo(() => {
    return rules
      .filter(
        (r) =>
          r.ruleFamilyId === selectedFamily &&
          (r.jurisdictionCode === selectedJurisdiction || r.jurisdictionCode === 'CENTRAL')
      )
      .sort((a, b) => new Date(a.effectiveFrom).getTime() - new Date(b.effectiveFrom).getTime());
  }, [rules, selectedFamily, selectedJurisdiction]);

  // Anomaly detection
  const anomalies = useMemo(() => {
    return detectTemporalAnomalies(rules, selectedFamily, selectedJurisdiction);
  }, [rules, selectedFamily, selectedJurisdiction]);

  const handleFactChange = (field, value) => {
    setFacts((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleEvaluateAsOf = () => {
    const asOfIso = new Date(`${eventDate}T12:00:00.000Z`).toISOString();
    const resolution = resolveAsOfRule({
      rules,
      ruleFamilyId: selectedFamily,
      jurisdictionCode: selectedJurisdiction,
      asOfDate: asOfIso,
      fallbackToCentral: true,
    });

    if (!resolution.rule) {
      setEvaluationResult({
        error: resolution.error || 'No governing policy rule resolved for this event date.',
        status: resolution.status,
        gapDetails: resolution.gapDetails,
      });
      setLiveAnnouncement(`Evaluation completed: No rule found. Status: ${resolution.status}`);
      return;
    }

    const evalRes = evaluateEffectiveDatedPolicy({
      rule: resolution.rule,
      citizenFacts: facts,
      asOfDate: asOfIso,
      operatorOrCitizenId: 'citizen_session',
    });

    // Save snapshot in immutable ledger
    const snapshot = createEvaluationSnapshot({
      evaluationResult: evalRes,
      citizenFacts: facts,
      asOfDate: asOfIso,
      rule: resolution.rule,
    });
    saveEvaluationSnapshotRecord(snapshot);
    setSnapshots(getStoredEvaluationSnapshots());

    setEvaluationResult({
      ...evalRes,
      ruleMeta: resolution.rule,
      isFallback: resolution.isFallback,
      jurisdictionUsed: resolution.jurisdictionUsed,
      snapshotHash: snapshot.snapshotHash,
    });

    setLiveAnnouncement(
      `Evaluation complete: Outcome is ${evalRes.outcome} for rule version ${evalRes.ruleVersion}.`
    );
  };

  const handleRunMultiDateSimulation = () => {
    // Generate dates across key years (e.g. 2019, 2022, 2025)
    const dates = [
      '2019-06-01T00:00:00.000Z',
      '2022-06-01T00:00:00.000Z',
      '2025-06-01T00:00:00.000Z',
    ];

    const sim = simulatePolicyAcrossDates({
      rules,
      ruleFamilyId: selectedFamily,
      jurisdictionCode: selectedJurisdiction,
      citizenFacts: facts,
      dates,
    });

    setSimulationResult(sim);
    setLiveAnnouncement('Multi-date policy shift simulation completed.');
  };

  const handleResetData = () => {
    const reset = resetRulesToDefault();
    setRules(reset);
    setEvaluationResult(null);
    setSimulationResult(null);
    setSnapshots([]);
    setLiveAnnouncement('Temporal policy engine rules and snapshots reset to defaults.');
  };

  const handleCopySnapshot = (snap) => {
    const str = JSON.stringify(snap, null, 2);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(str);
      setCopiedSnapshotId(snap.evaluationId);
      setTimeout(() => setCopiedSnapshotId(null), 2000);
    }
  };

  return (
    <div className="section animate-fade-in" style={{ paddingBottom: '6rem' }}>
      {/* Screen-reader live region */}
      <div className="sr-only" aria-live="polite" role="status">
        {liveAnnouncement}
      </div>

      <div className="container" style={{ maxWidth: '1080px' }}>
        {/* Header Banner */}
        <header style={{ marginBottom: '2rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--accent-main)',
              fontSize: '0.875rem',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '0.5rem',
            }}
          >
            <Clock size={18} aria-hidden="true" />
            <span>Temporal Policy Engine (#1155)</span>
          </div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: '800', margin: '0 0 0.5rem 0' }}>
            Effective-Dated Civic Rules & As-Of Simulator
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', margin: 0, maxWidth: '850px' }}>
            Statutory criteria, fees, and required checklists evolve over time. Evaluate civic procedures
            as of an exact historical event date, detect regulatory timeline gaps, and trace immutable decision provenance.
          </p>
        </header>

        {/* Global Statutory Disclaimer Callout */}
        <div
          role="note"
          aria-label="Statutory Non-Legal Advice Disclaimer"
          style={{
            padding: '1rem 1.25rem',
            backgroundColor: 'var(--bg-secondary)',
            borderLeft: '4px solid var(--accent-main)',
            borderRadius: '6px',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
          }}
        >
          <Scale size={22} style={{ color: 'var(--accent-main)', flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
          <div style={{ fontSize: '0.875rem', lineHeight: 1.5, color: 'var(--text-main)' }}>
            <strong>Official Advisory Notice:</strong> {STATUTORY_DISCLAIMER}
          </div>
        </div>

        {/* Controls: Scheme, Jurisdiction, Event Date */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1.25rem',
            padding: '1.5rem',
            backgroundColor: 'var(--card-bg, #fff)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-sm)',
            marginBottom: '2rem',
          }}
        >
          <div>
            <label
              htmlFor="scheme-family-select"
              style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.4rem' }}
            >
              Civic Rule Family
            </label>
            <select
              id="scheme-family-select"
              value={selectedFamily}
              onChange={(e) => {
                setSelectedFamily(e.target.value);
                setEvaluationResult(null);
                setSimulationResult(null);
              }}
              style={{
                width: '100%',
                padding: '0.6rem 0.8rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
              }}
            >
              {distinctFamilies.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title} ({f.id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="jurisdiction-select"
              style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.4rem' }}
            >
              Jurisdiction (ISO 3166-2:IN)
            </label>
            <select
              id="jurisdiction-select"
              value={selectedJurisdiction}
              onChange={(e) => {
                setSelectedJurisdiction(e.target.value);
                setEvaluationResult(null);
                setSimulationResult(null);
              }}
              style={{
                width: '100%',
                padding: '0.6rem 0.8rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
              }}
            >
              {distinctJurisdictions.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="event-date-type-select"
              style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.4rem' }}
            >
              Event Date Trigger
            </label>
            <select
              id="event-date-type-select"
              value={eventDateType}
              onChange={(e) => setEventDateType(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem 0.8rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
              }}
            >
              <option value="APPLICATION_DATE">Application Submission Date</option>
              <option value="INCIDENT_DATE">Demise / Calamity / Event Date</option>
              <option value="NOTIFICATION_DATE">Statutory Gazette Date</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="event-date-input"
              style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.4rem' }}
            >
              As-Of Event Date (YYYY-MM-DD)
            </label>
            <input
              id="event-date-input"
              type="date"
              value={eventDate}
              onChange={(e) => {
                setEventDate(e.target.value);
                setEvaluationResult(null);
              }}
              style={{
                width: '100%',
                padding: '0.55rem 0.8rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
              }}
            />
          </div>
        </div>

        {/* Tab Navigation */}
        <div
          role="tablist"
          aria-label="Temporal Policy Engine Workspace Tabs"
          style={{
            display: 'flex',
            gap: '0.5rem',
            borderBottom: '2px solid var(--border-color)',
            marginBottom: '1.5rem',
            overflowX: 'auto',
          }}
        >
          <button
            role="tab"
            aria-selected={activeTab === 'simulator'}
            aria-controls="tab-panel-simulator"
            id="tab-simulator"
            onClick={() => setActiveTab('simulator')}
            style={{
              padding: '0.75rem 1.25rem',
              fontWeight: activeTab === 'simulator' ? '700' : '500',
              borderBottom: activeTab === 'simulator' ? '3px solid var(--accent-main)' : '3px solid transparent',
              background: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              color: activeTab === 'simulator' ? 'var(--accent-main)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Sparkles size={16} aria-hidden="true" />
            <span>As-Of Simulator & Facts</span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'timeline'}
            aria-controls="tab-panel-timeline"
            id="tab-timeline"
            onClick={() => setActiveTab('timeline')}
            style={{
              padding: '0.75rem 1.25rem',
              fontWeight: activeTab === 'timeline' ? '700' : '500',
              borderBottom: activeTab === 'timeline' ? '3px solid var(--accent-main)' : '3px solid transparent',
              background: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              color: activeTab === 'timeline' ? 'var(--accent-main)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Layers size={16} aria-hidden="true" />
            <span>Version Timeline ({familyTimeline.length})</span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'anomalies'}
            aria-controls="tab-panel-anomalies"
            id="tab-anomalies"
            onClick={() => setActiveTab('anomalies')}
            style={{
              padding: '0.75rem 1.25rem',
              fontWeight: activeTab === 'anomalies' ? '700' : '500',
              borderBottom: activeTab === 'anomalies' ? '3px solid var(--accent-main)' : '3px solid transparent',
              background: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              color: activeTab === 'anomalies' ? 'var(--accent-main)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <AlertTriangle size={16} aria-hidden="true" />
            <span>Timeline Anomalies ({anomalies.gaps.length + anomalies.conflicts.length})</span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'audit'}
            aria-controls="tab-panel-audit"
            id="tab-audit"
            onClick={() => setActiveTab('audit')}
            style={{
              padding: '0.75rem 1.25rem',
              fontWeight: activeTab === 'audit' ? '700' : '500',
              borderBottom: activeTab === 'audit' ? '3px solid var(--accent-main)' : '3px solid transparent',
              background: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              color: activeTab === 'audit' ? 'var(--accent-main)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <History size={16} aria-hidden="true" />
            <span>Historical Audit Ledger ({snapshots.length})</span>
          </button>
        </div>

        {/* TAB 1: AS-OF SIMULATOR */}
        {activeTab === 'simulator' && (
          <div id="tab-panel-simulator" role="tabpanel" aria-labelledby="tab-simulator">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '2rem' }}>
              {/* Left Column: Applicant Inputs */}
              <div
                style={{
                  padding: '1.5rem',
                  backgroundColor: 'var(--card-bg, #fff)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                }}
              >
                <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem' }}>
                  Applicant Synthetic Facts
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                  Provide synthetic case attributes to test condition thresholds under the resolved statutory version.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label
                      htmlFor="input-annual-income"
                      style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.25rem' }}
                    >
                      Annual Gross Family Income (₹ INR)
                    </label>
                    <input
                      id="input-annual-income"
                      type="number"
                      value={facts.annualFamilyIncome}
                      onChange={(e) => handleFactChange('annualFamilyIncome', Number(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                      }}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="input-land-acres"
                      style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.25rem' }}
                    >
                      Agricultural Land Holding (Acres)
                    </label>
                    <input
                      id="input-land-acres"
                      type="number"
                      step="0.1"
                      value={facts.agriculturalLandAcres}
                      onChange={(e) => handleFactChange('agriculturalLandAcres', Number(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                      }}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="input-plot-yards"
                      style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.25rem' }}
                    >
                      Municipal Residential Plot (Sq. Yards)
                    </label>
                    <input
                      id="input-plot-yards"
                      type="number"
                      value={facts.residentialPlotSqYards}
                      onChange={(e) => handleFactChange('residentialPlotSqYards', Number(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <input
                      id="input-aadhaar-seed"
                      type="checkbox"
                      checked={Boolean(facts.aadhaarSeededBankAccount)}
                      onChange={(e) => handleFactChange('aadhaarSeededBankAccount', e.target.checked)}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <label htmlFor="input-aadhaar-seed" style={{ fontSize: '0.85rem', fontWeight: '600' }}>
                      Active Aadhaar-Seeded Bank Account (DBT)
                    </label>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                    <button
                      onClick={handleEvaluateAsOf}
                      className="btn btn-primary"
                      style={{
                        flex: 1,
                        padding: '0.75rem 1rem',
                        fontWeight: '700',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <Clock size={16} aria-hidden="true" />
                      <span>Evaluate As-Of Date</span>
                    </button>

                    <button
                      onClick={handleRunMultiDateSimulation}
                      className="btn btn-secondary"
                      title="Run comparative simulation across multiple historical dates"
                      style={{
                        padding: '0.75rem 1rem',
                        fontWeight: '600',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <Sparkles size={16} aria-hidden="true" />
                      <span>Simulate Shift</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Evaluation & Shift Results */}
              <div>
                {evaluationResult && (
                  <div
                    style={{
                      padding: '1.5rem',
                      backgroundColor: 'var(--card-bg, #fff)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      boxShadow: 'var(--shadow-sm)',
                      marginBottom: '1.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)' }}>
                        AS-OF RESULT ({eventDate})
                      </span>
                      {evaluationResult.outcome === EVALUATION_OUTCOME.ELIGIBLE && (
                        <span
                          style={{
                            padding: '0.35rem 0.75rem',
                            borderRadius: '999px',
                            backgroundColor: '#e6f4ea',
                            color: '#137333',
                            fontSize: '0.85rem',
                            fontWeight: '700',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                        >
                          <CheckCircle2 size={16} /> ELIGIBLE
                        </span>
                      )}
                      {evaluationResult.outcome === EVALUATION_OUTCOME.INELIGIBLE && (
                        <span
                          style={{
                            padding: '0.35rem 0.75rem',
                            borderRadius: '999px',
                            backgroundColor: '#fce8e6',
                            color: '#c5221f',
                            fontSize: '0.85rem',
                            fontWeight: '700',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                        >
                          <XCircle size={16} /> INELIGIBLE
                        </span>
                      )}
                      {evaluationResult.outcome === EVALUATION_OUTCOME.INDETERMINATE && (
                        <span
                          style={{
                            padding: '0.35rem 0.75rem',
                            borderRadius: '999px',
                            backgroundColor: '#fef7e0',
                            color: '#b06000',
                            fontSize: '0.85rem',
                            fontWeight: '700',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                        >
                          <ShieldAlert size={16} /> INDETERMINATE
                        </span>
                      )}
                    </div>

                    <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '0.4rem' }}>
                      {evaluationResult.ruleMeta?.title || evaluationResult.ruleFamilyId}
                    </h3>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                      Version: <strong>{evaluationResult.ruleVersion}</strong> &bull; Jurisdiction:{' '}
                      <strong>{evaluationResult.jurisdictionCode}</strong>
                      {evaluationResult.isFallback && ' (Fallback to Central baseline)'}
                    </div>

                    <p style={{ fontSize: '0.9rem', marginBottom: '1rem', lineHeight: 1.5 }}>
                      <strong>Summary Reason:</strong> {evaluationResult.reason}
                    </p>

                    {/* Condition Decision Path Table */}
                    {evaluationResult.decisionPath?.length > 0 && (
                      <div style={{ marginBottom: '1rem' }}>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                          Evaluated Statutory Conditions:
                        </h4>
                        <table
                          style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontSize: '0.85rem',
                            textAlign: 'left',
                          }}
                        >
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                              <th style={{ padding: '0.5rem' }}>Condition / Field</th>
                              <th style={{ padding: '0.5rem' }}>Threshold</th>
                              <th style={{ padding: '0.5rem' }}>Applicant Fact</th>
                              <th style={{ padding: '0.5rem' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {evaluationResult.decisionPath.map((dp, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '0.5rem' }}>{dp.description || dp.field}</td>
                                <td style={{ padding: '0.5rem' }}>
                                  {dp.operator} {String(dp.expected)} {dp.unit || ''}
                                </td>
                                <td style={{ padding: '0.5rem' }}>
                                  {dp.actual !== null ? String(dp.actual) : 'MISSING'}
                                </td>
                                <td style={{ padding: '0.5rem' }}>
                                  {dp.passed ? (
                                    <span style={{ color: '#137333', fontWeight: '700' }}>Passed</span>
                                  ) : (
                                    <span style={{ color: '#c5221f', fontWeight: '700' }}>Failed</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Fees & Mandatory Documents */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                      <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          Statutory Fee
                        </div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '800' }}>
                          ₹{evaluationResult.feesApplicable?.amount ?? 0} {evaluationResult.feesApplicable?.currency || 'INR'}
                        </div>
                      </div>

                      <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          Mandatory Checklists
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: '700' }}>
                          {evaluationResult.mandatoryDocuments?.length || 0} Documents
                        </div>
                      </div>
                    </div>

                    {/* Citations */}
                    {evaluationResult.citations?.length > 0 && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                        <strong>Statutory Provenance:</strong> {evaluationResult.citations[0].authority} &bull;{' '}
                        {evaluationResult.citations[0].notificationNumber} ({evaluationResult.citations[0].date})
                      </div>
                    )}

                    {/* Snapshot SHA-256 Hash */}
                    {evaluationResult.snapshotHash && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        Audit Digest: {evaluationResult.snapshotHash.slice(0, 24)}...
                      </div>
                    )}
                  </div>
                )}

                {/* Multi-Date Simulation Shift Card */}
                {simulationResult && (
                  <div
                    style={{
                      padding: '1.5rem',
                      backgroundColor: 'var(--card-bg, #fff)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                    }}
                  >
                    <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '0.75rem' }}>
                      Multi-Date Policy Shift Matrix
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {simulationResult.simulations.map((sim, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '0.75rem 1rem',
                            borderRadius: '8px',
                            backgroundColor: 'var(--bg-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>
                              {sim.asOfDate.slice(0, 10)}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              Version {sim.rule?.version} ({sim.rule?.id})
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div
                              style={{
                                fontWeight: '700',
                                color: sim.evaluation?.outcome === 'ELIGIBLE' ? '#137333' : '#c5221f',
                              }}
                            >
                              {sim.evaluation?.outcome}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              Fee: ₹{sim.evaluation?.feesApplicable?.amount ?? 0}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {simulationResult.shifts?.length > 0 && (
                      <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--accent-main)', marginBottom: '0.4rem' }}>
                          Detected Regulatory Shifts:
                        </h4>
                        {simulationResult.shifts.map((s, idx) => (
                          <div key={idx} style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                            &bull; {s.details} {s.outcomeShift ? `[Outcome: ${s.outcomeShift}]` : ''}{' '}
                            {s.feeShift ? `[Fee: ₹${s.feeShift}]` : ''}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TIMELINE VIEW */}
        {activeTab === 'timeline' && (
          <div id="tab-panel-timeline" role="tabpanel" aria-labelledby="tab-timeline">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {familyTimeline.map((rule) => {
                const isActive = rule.effectiveTo === null;
                return (
                  <div
                    key={rule.id}
                    style={{
                      padding: '1.25rem 1.5rem',
                      backgroundColor: 'var(--card-bg, #fff)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      display: 'grid',
                      gridTemplateColumns: 'auto 1fr auto',
                      gap: '1.5rem',
                      alignItems: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        backgroundColor: isActive ? 'var(--accent-main)' : 'var(--bg-secondary)',
                        color: isActive ? '#fff' : 'var(--text-main)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '800',
                      }}
                    >
                      v{rule.version.split('.')[0]}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0 }}>{rule.title}</h3>
                        {isActive ? (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: '700',
                              backgroundColor: '#e6f4ea',
                              color: '#137333',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                            }}
                          >
                            ACTIVE
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: '700',
                              backgroundColor: 'var(--bg-secondary)',
                              color: 'var(--text-muted)',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                            }}
                          >
                            SUPERSEDED
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                        Effective:{' '}
                        <strong>
                          {rule.effectiveFrom.slice(0, 10)} to {rule.effectiveTo ? rule.effectiveTo.slice(0, 10) : 'Present (Active)'}
                        </strong>{' '}
                        &bull; Authority: {rule.sourceMetadata.issuingAuthority}
                      </div>

                      <div style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>
                        Gazette Circular: <strong>{rule.sourceMetadata.notificationNumber}</strong> ({rule.sourceMetadata.gazetteDate})
                        {rule.supersededByRuleId && (
                          <span style={{ marginLeft: '0.5rem', color: 'var(--accent-main)' }}>
                            &rarr; Superseded by {rule.supersededByRuleId}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: '700' }}>
                        ₹{rule.feeStructure.amount} {rule.feeStructure.currency}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {rule.conditions?.length || 0} criteria
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: TIMELINE ANOMALIES */}
        {activeTab === 'anomalies' && (
          <div id="tab-panel-anomalies" role="tabpanel" aria-labelledby="tab-anomalies">
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                Continuous Interval Integrity Scan
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                Scans effective dates for gaps (unlegislated periods) and conflicting overlaps within jurisdiction{' '}
                <strong>{selectedJurisdiction}</strong>.
              </p>
            </div>

            {anomalies.gaps.length === 0 && anomalies.conflicts.length === 0 ? (
              <div
                style={{
                  padding: '2rem',
                  backgroundColor: '#e6f4ea',
                  color: '#137333',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                }}
              >
                <ShieldCheck size={32} />
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '700', margin: '0 0 0.25rem 0' }}>
                    Zero Anomalies Detected
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>
                    The temporal policy timeline is continuous and unbroken. All supersessions link seamlessly with
                    zero uncoordinated gaps or overlapping conflicts.
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {anomalies.gaps.map((gap, i) => (
                  <div
                    key={`gap-${i}`}
                    style={{
                      padding: '1.25rem',
                      backgroundColor: '#fef7e0',
                      borderLeft: '4px solid #b06000',
                      borderRadius: '8px',
                    }}
                  >
                    <div style={{ fontWeight: '700', color: '#b06000', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <AlertTriangle size={18} />
                      <span>Temporal Coverage Gap Detected</span>
                    </div>
                    <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}>{gap.description}</p>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Gap Window: {gap.gapStart} &rarr; {gap.gapEnd}
                    </div>
                  </div>
                ))}

                {anomalies.conflicts.map((conf, i) => (
                  <div
                    key={`conf-${i}`}
                    style={{
                      padding: '1.25rem',
                      backgroundColor: '#fce8e6',
                      borderLeft: '4px solid #c5221f',
                      borderRadius: '8px',
                    }}
                  >
                    <div style={{ fontWeight: '700', color: '#c5221f', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <ShieldAlert size={18} />
                      <span>Conflicting Overlapping Rules</span>
                    </div>
                    <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}>{conf.description}</p>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Overlap: {conf.overlapStart} &rarr; {conf.overlapEnd}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: HISTORICAL AUDIT LEDGER */}
        {activeTab === 'audit' && (
          <div id="tab-panel-audit" role="tabpanel" aria-labelledby="tab-audit">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.25rem' }}>
                  Immutable Historical Evaluation Ledger
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                  Tamper-evident record of past evaluations with rule digests and verified citations.
                </p>
              </div>

              <button
                onClick={handleResetData}
                className="btn btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
              >
                <RefreshCw size={14} />
                <span>Reset Rules & Snapshots</span>
              </button>
            </div>

            {snapshots.length === 0 ? (
              <div
                style={{
                  padding: '3rem',
                  textAlign: 'center',
                  backgroundColor: 'var(--card-bg, #fff)',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-muted)',
                }}
              >
                <History size={36} style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                  No Historical Snapshots Yet
                </h3>
                <p style={{ fontSize: '0.9rem', margin: 0 }}>
                  Run an As-Of evaluation in the Simulator tab to automatically record an immutable audit snapshot.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {snapshots.map((snap) => (
                  <div
                    key={snap.evaluationId}
                    style={{
                      padding: '1.25rem',
                      backgroundColor: 'var(--card-bg, #fff)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>{snap.evaluationId}</span>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            backgroundColor: snap.outcome === 'ELIGIBLE' ? '#e6f4ea' : '#fce8e6',
                            color: snap.outcome === 'ELIGIBLE' ? '#137333' : '#c5221f',
                          }}
                        >
                          {snap.outcome}
                        </span>
                      </div>

                      <button
                        onClick={() => handleCopySnapshot(snap)}
                        style={{
                          background: 'none',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          padding: '0.35rem 0.6rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          fontSize: '0.8rem',
                          color: 'var(--text-main)',
                        }}
                      >
                        {copiedSnapshotId === snap.evaluationId ? (
                          <>
                            <Check size={14} color="#137333" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={14} />
                            <span>Copy JSON</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Evaluated At: <strong>{snap.evaluatedAt}</strong> &bull; As-Of Event Date:{' '}
                      <strong>{snap.asOfDate?.slice(0, 10)}</strong> &bull; Rule Version: <strong>{snap.ruleVersion}</strong>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
                      <strong>Decision Reason:</strong> {snap.reason}
                    </div>

                    <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                      SHA-256 Snapshot Digest: {snap.snapshotHash}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
