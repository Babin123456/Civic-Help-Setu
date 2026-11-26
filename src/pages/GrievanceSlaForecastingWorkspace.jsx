import { useState, useMemo } from 'react';
import {
  JURISDICTIONS,
  GRIEVANCE_CATEGORIES,
  BOTTLENECK_STAGES,
  STATUTORY_SLA_DAYS,
  ACTION_RECOMMENDATION_STATUS,
} from '../data/grievanceSlaContract';
import {
  forecastGrievanceSla,
  analyzeStageBottlenecks,
  evaluateForecastDriftAndCalibration,
  proposeBottleneckIntervention,
  approveBottleneckIntervention,
  rejectBottleneckIntervention,
  listBottleneckInterventions,
  listInterventionAuditLogs,
} from '../services/grievanceSlaForecastingService';
import {
  Clock,
  AlertTriangle,
  ShieldCheck,
  Info,
  Activity,
} from 'lucide-react';

export default function GrievanceSlaForecastingWorkspace() {
  const [selectedJurisdiction, setSelectedJurisdiction] = useState(JURISDICTIONS.DELHI_CENTRAL);
  const [selectedCategory, setSelectedCategory] = useState(GRIEVANCE_CATEGORIES.MUNICIPAL_WATER_SANITATION);
  const [activeTab, setActiveTab] = useState('forecast'); // 'forecast' | 'bottlenecks' | 'governance' | 'drift'

  // Governance action form states
  const [actionStage, setActionStage] = useState(BOTTLENECK_STAGES.FIELD_INSPECTION);
  const [actionTitle, setActionTitle] = useState('');
  const [actionDetails, setActionDetails] = useState('');
  const [officerId, setOfficerId] = useState('OFFICER_INSPECTOR_412');
  const [rejectionReason, setRejectionReason] = useState('');
  const [activeRejectingId, setActiveRejectingId] = useState(null);

  // Intervention and audit triggers
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Forecast computation
  const forecastResult = useMemo(() => {
    try {
      return forecastGrievanceSla({
        jurisdiction: selectedJurisdiction,
        category: selectedCategory,
      });
    } catch (err) {
      return { status: 'ERROR', message: err.message };
    }
  }, [selectedJurisdiction, selectedCategory]);

  // Bottleneck breakdown computation
  const bottleneckResult = useMemo(() => {
    return analyzeStageBottlenecks(selectedJurisdiction, selectedCategory);
  }, [selectedJurisdiction, selectedCategory]);

  // Drift and calibration computation (using validation sample)
  const driftResult = useMemo(() => {
    if (!forecastResult || !forecastResult.cohortId) return null;
    try {
      // Mock validation observations (recent sample batch)
      const mockValidationSample = [5, 6, 7, 7, 8, 9, 11, 13];
      return evaluateForecastDriftAndCalibration(forecastResult.cohortId, mockValidationSample);
    } catch {
      return null;
    }
  }, [forecastResult]);

  // Stored actions and audit logs
  const interventions = useMemo(() => {
    if (refreshTrigger < 0) return [];
    return listBottleneckInterventions();
  }, [refreshTrigger]);

  const auditLogs = useMemo(() => {
    if (refreshTrigger < 0) return [];
    return listInterventionAuditLogs();
  }, [refreshTrigger]);

  const handleProposeAction = (e) => {
    e.preventDefault();
    if (!actionTitle.trim()) return;

    try {
      proposeBottleneckIntervention({
        stage: actionStage,
        title: actionTitle,
        details: actionDetails,
        recommendedBy: officerId || 'OFFICER_TRIAGE_USER',
      });
      setActionTitle('');
      setActionDetails('');
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      alert(`Failed to propose action: ${err.message}`);
    }
  };

  const handleApproveAction = (id) => {
    try {
      approveBottleneckIntervention(id, officerId);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      alert(`Approval error: ${err.message}`);
    }
  };

  const handleRejectAction = (id) => {
    if (!rejectionReason.trim()) {
      alert('Rejection reason is required.');
      return;
    }
    try {
      rejectBottleneckIntervention(id, officerId, rejectionReason);
      setActiveRejectingId(null);
      setRejectionReason('');
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      alert(`Rejection error: ${err.message}`);
    }
  };

  return (
    <div className="container" style={{ padding: '2rem 1rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header and Disclaimers */}
      <header style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Activity size={28} color="var(--primary, #0284c7)" />
          <h1 style={{ margin: 0, fontSize: '1.875rem', fontWeight: '700' }}>
            Public Grievance SLA Forecasting & Bottleneck Analytics
          </h1>
        </div>
        <p style={{ margin: 0, color: 'var(--text-muted, #64748b)', fontSize: '1rem' }}>
          Cohort-based empirical turnaround distributions, operational bottleneck diagnosis, and human-in-the-loop intervention governance.
        </p>

        {/* Non-Guarantee Legal Notice */}
        <div
          role="note"
          aria-label="Statistical Estimate Disclaimer"
          style={{
            marginTop: '1rem',
            padding: '0.85rem 1.25rem',
            backgroundColor: 'rgba(2, 132, 199, 0.08)',
            borderLeft: '4px solid #0284c7',
            borderRadius: '4px',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <Info size={20} color="#0284c7" style={{ flexShrink: 0 }} />
          <div>
            <strong>Zero-Guarantee Principle:</strong> Historical turnaround projections represent cohort statistical intervals and are <em>NOT legal guarantees</em> of individual case resolution.
          </div>
        </div>
      </header>

      {/* Control Bar: Jurisdiction & Category Selection */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
          padding: '1.25rem',
          backgroundColor: 'var(--card-bg, #ffffff)',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <label htmlFor="jurisdiction-select" style={{ display: 'block', fontWeight: '600', marginBottom: '0.35rem' }}>
            Jurisdiction / Administrative District
          </label>
          <select
            id="jurisdiction-select"
            value={selectedJurisdiction}
            onChange={(e) => setSelectedJurisdiction(e.target.value)}
            style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
          >
            {Object.entries(JURISDICTIONS).map(([key, val]) => (
              <option key={key} value={val}>
                {val.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="category-select" style={{ display: 'block', fontWeight: '600', marginBottom: '0.35rem' }}>
            Grievance Category / Public Service
          </label>
          <select
            id="category-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
          >
            {Object.entries(GRIEVANCE_CATEGORIES).map(([key, val]) => (
              <option key={key} value={val}>
                {val.replace(/_/g, ' ')} (Statutory: {STATUTORY_SLA_DAYS[val]}d)
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Navigation Tabs */}
      <nav style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid #e2e8f0', marginBottom: '1.5rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('forecast')}
          style={{
            padding: '0.75rem 1.25rem',
            border: 'none',
            background: 'none',
            fontWeight: '600',
            cursor: 'pointer',
            borderBottom: activeTab === 'forecast' ? '3px solid #0284c7' : '3px solid transparent',
            color: activeTab === 'forecast' ? '#0284c7' : '#64748b',
          }}
        >
          SLA Distribution & Forecast
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('bottlenecks')}
          style={{
            padding: '0.75rem 1.25rem',
            border: 'none',
            background: 'none',
            fontWeight: '600',
            cursor: 'pointer',
            borderBottom: activeTab === 'bottlenecks' ? '3px solid #0284c7' : '3px solid transparent',
            color: activeTab === 'bottlenecks' ? '#0284c7' : '#64748b',
          }}
        >
          Lifecycle Bottleneck Diagnostics
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('governance')}
          style={{
            padding: '0.75rem 1.25rem',
            border: 'none',
            background: 'none',
            fontWeight: '600',
            cursor: 'pointer',
            borderBottom: activeTab === 'governance' ? '3px solid #0284c7' : '3px solid transparent',
            color: activeTab === 'governance' ? '#0284c7' : '#64748b',
          }}
        >
          Human Approval & Actions ({interventions.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('drift')}
          style={{
            padding: '0.75rem 1.25rem',
            border: 'none',
            background: 'none',
            fontWeight: '600',
            cursor: 'pointer',
            borderBottom: activeTab === 'drift' ? '3px solid #0284c7' : '3px solid transparent',
            color: activeTab === 'drift' ? '#0284c7' : '#64748b',
          }}
        >
          Drift & Calibration Evaluation
        </button>
      </nav>

      {/* Tab 1: Forecast & Uncertainty Intervals */}
      {activeTab === 'forecast' && (
        <section aria-labelledby="forecast-section-title">
          <h2 id="forecast-section-title" className="sr-only" style={{ display: 'none' }}>Forecast Section</h2>

          {forecastResult.status === 'PRIVACY_SUPPRESSED' ? (
            <div
              style={{
                padding: '2rem',
                backgroundColor: '#fffbeb',
                border: '1px solid #fef3c7',
                borderRadius: '8px',
                textAlign: 'center',
              }}
            >
              <ShieldCheck size={36} color="#d97706" style={{ margin: '0 auto 1rem' }} />
              <h3 style={{ margin: '0 0 0.5rem', color: '#b45309' }}>Privacy Suppression Active (k-Anonymity)</h3>
              <p style={{ margin: '0 0 1rem', color: '#78350f' }}>{forecastResult.disclaimer}</p>
              <span style={{ fontSize: '0.9rem', color: '#92400e' }}>
                Sample size ({forecastResult.sampleSize}) is below minimum privacy protection threshold (10).
              </span>
            </div>
          ) : forecastResult.status === 'NO_COHORT_DATA' ? (
            <div
              style={{
                padding: '2rem',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                textAlign: 'center',
              }}
            >
              <Clock size={36} color="#94a3b8" style={{ margin: '0 auto 1rem' }} />
              <h3 style={{ margin: '0 0 0.5rem' }}>No Historical Cohort Records</h3>
              <p style={{ margin: 0, color: '#64748b' }}>{forecastResult.message}</p>
            </div>
          ) : forecastResult.status === 'ACTIVE' ? (
            <div>
              {/* Summary Metric Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '1rem',
                  marginBottom: '1.5rem',
                }}
              >
                <div style={{ padding: '1.25rem', backgroundColor: '#ffffff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>
                    Statutory SLA (Target)
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#0f172a', margin: '0.25rem 0' }}>
                    {forecastResult.statutorySlaDays} Days
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>State Public Service Guarantee</div>
                </div>

                <div style={{ padding: '1.25rem', backgroundColor: '#ffffff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>
                    Predicted Median Duration
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#0284c7', margin: '0.25rem 0' }}>
                    {forecastResult.forecast.medianDays} Days
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>IQR: {forecastResult.forecast.iqr.p25Days}d – {forecastResult.forecast.iqr.p75Days}d</div>
                </div>

                <div style={{ padding: '1.25rem', backgroundColor: '#ffffff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>
                    80% Prediction Interval
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#0f172a', margin: '0.25rem 0' }}>
                    {forecastResult.forecast.confidenceInterval80.lowerDays}d – {forecastResult.forecast.confidenceInterval80.upperDays}d
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>95% PI: {forecastResult.forecast.confidenceInterval95.lowerDays}d – {forecastResult.forecast.confidenceInterval95.upperDays}d</div>
                </div>

                <div style={{ padding: '1.25rem', backgroundColor: '#ffffff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>
                    Breach Risk Probability
                  </div>
                  <div
                    style={{
                      fontSize: '1.75rem',
                      fontWeight: '700',
                      color:
                        forecastResult.forecast.riskLevel === 'CRITICAL'
                          ? '#ef4444'
                          : forecastResult.forecast.riskLevel === 'HIGH'
                          ? '#f97316'
                          : '#10b981',
                      margin: '0.25rem 0',
                    }}
                  >
                    {(forecastResult.forecast.predictedBreachProbability * 100).toFixed(0)}%
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Risk Level: {forecastResult.forecast.riskLevel}
                  </div>
                </div>
              </div>

              {/* Data Transparency & Missingness Disclosure */}
              <div
                style={{
                  padding: '1.25rem',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  marginBottom: '1.5rem',
                }}
              >
                <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem', fontWeight: '600' }}>
                  Cohort Provenance & Sample Disclosures
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', fontSize: '0.9rem' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Cohort ID:</span> <strong>{forecastResult.cohortId}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Analyzed Sample:</span> <strong>{forecastResult.sampleSize} resolved cases</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Missing/Unrecorded Fields:</span>{' '}
                    <strong>{forecastResult.missingDataCount} cases ({(forecastResult.missingnessRate * 100).toFixed(1)}%)</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Historical Breach Rate:</span>{' '}
                    <strong>{(forecastResult.observedBreachRate * 100).toFixed(1)}%</strong>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      )}

      {/* Tab 2: Lifecycle Bottleneck Diagnostics */}
      {activeTab === 'bottlenecks' && (
        <section aria-labelledby="bottleneck-section-title">
          <h2 id="bottleneck-section-title" style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>
            End-to-End Processing Stages Breakdown
          </h2>

          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '1.5rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.95rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '0.85rem 1rem' }}>Processing Stage</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Benchmark (Days)</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Observed Average</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Excess Delay</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {bottleneckResult.stages.map((stage) => (
                  <tr key={stage.stage} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: '600' }}>
                      {stage.stage.replace(/_/g, ' ')}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>{stage.benchmarkDays}d</td>
                    <td style={{ padding: '0.85rem 1rem' }}>{stage.averageDurationDays}d</td>
                    <td style={{ padding: '0.85rem 1rem', color: stage.excessDays > 0 ? '#ef4444' : '#10b981', fontWeight: '600' }}>
                      {stage.excessDays > 0 ? `+${stage.excessDays}d` : 'On track'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '12px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          backgroundColor:
                            stage.severity === 'SEVERE'
                              ? '#fee2e2'
                              : stage.severity === 'MODERATE'
                              ? '#fef3c7'
                              : '#dcfce7',
                          color:
                            stage.severity === 'SEVERE'
                              ? '#991b1b'
                              : stage.severity === 'MODERATE'
                              ? '#92400e'
                              : '#166534',
                        }}
                      >
                        {stage.severity}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {bottleneckResult.primaryBottleneckStage && (
            <div
              style={{
                padding: '1.25rem',
                backgroundColor: '#fff7ed',
                border: '1px solid #ffedd5',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <AlertTriangle size={24} color="#ea580c" />
              <div>
                <strong>Primary Bottleneck Identified: </strong>
                <span>
                  The <strong>{bottleneckResult.primaryBottleneckStage.replace(/_/g, ' ')}</strong> stage is the highest contributor to SLA breaches. Consider deploying targeted triage actions in the Human Approval tab.
                </span>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Tab 3: Human Approval & Actions Governance Gate */}
      {activeTab === 'governance' && (
        <section aria-labelledby="governance-section-title">
          <h2 id="governance-section-title" style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
            Human-in-the-Loop Interventions & Audit Trail
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Automated recommendations are untrusted until an authorized public officer reviews and approves them. No autonomous enforcement or denial is executed without human sign-off.
          </p>

          {/* Proposal Form */}
          <div style={{ backgroundColor: '#ffffff', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '2rem' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Propose Targeted Bottleneck Intervention</h3>
            <form onSubmit={handleProposeAction}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label htmlFor="action-stage" style={{ display: 'block', fontWeight: '600', marginBottom: '0.35rem' }}>Target Stage</label>
                  <select
                    id="action-stage"
                    value={actionStage}
                    onChange={(e) => setActionStage(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  >
                    {Object.values(BOTTLENECK_STAGES).map((st) => (
                      <option key={st} value={st}>{st.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="officer-id" style={{ display: 'block', fontWeight: '600', marginBottom: '0.35rem' }}>Authorizing Officer ID</label>
                  <input
                    id="officer-id"
                    type="text"
                    value={officerId}
                    onChange={(e) => setOfficerId(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="action-title" style={{ display: 'block', fontWeight: '600', marginBottom: '0.35rem' }}>Action Title</label>
                <input
                  id="action-title"
                  type="text"
                  placeholder="e.g., Deploy 2 additional verification officers to Ward 12"
                  value={actionTitle}
                  onChange={(e) => setActionTitle(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="action-details" style={{ display: 'block', fontWeight: '600', marginBottom: '0.35rem' }}>Operational Details & Scope</label>
                <textarea
                  id="action-details"
                  rows={2}
                  placeholder="Provide rationale, expected SLA reduction, and affected sub-zones."
                  value={actionDetails}
                  onChange={(e) => setActionDetails(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <button
                type="submit"
                style={{
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  padding: '0.65rem 1.25rem',
                  borderRadius: '6px',
                  border: 'none',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Propose Action
              </button>
            </form>
          </div>

          {/* Action List with Approval Gate */}
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Active & Proposed Interventions</h3>
          {interventions.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '8px', color: '#64748b' }}>
              No bottleneck interventions recorded yet. Use the form above to propose one.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
              {interventions.map((act) => (
                <div
                  key={act.actionId}
                  style={{
                    backgroundColor: '#ffffff',
                    padding: '1.25rem',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div>
                      <span
                        style={{
                          display: 'inline-block',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          backgroundColor:
                            act.status === ACTION_RECOMMENDATION_STATUS.APPROVED
                              ? '#dcfce7'
                              : act.status === ACTION_RECOMMENDATION_STATUS.REJECTED
                              ? '#fee2e2'
                              : '#fef3c7',
                          color:
                            act.status === ACTION_RECOMMENDATION_STATUS.APPROVED
                              ? '#166534'
                              : act.status === ACTION_RECOMMENDATION_STATUS.REJECTED
                              ? '#991b1b'
                              : '#92400e',
                          marginBottom: '0.5rem',
                        }}
                      >
                        {act.status}
                      </span>
                      <h4 style={{ margin: '0 0 0.25rem', fontSize: '1.05rem' }}>{act.title}</h4>
                      <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        Target: {act.stage.replace(/_/g, ' ')} • Proposed by {act.recommendedBy}
                      </div>
                    </div>

                    {act.status === ACTION_RECOMMENDATION_STATUS.PROPOSED && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => handleApproveAction(act.actionId)}
                          style={{
                            backgroundColor: '#16a34a',
                            color: '#ffffff',
                            padding: '0.4rem 0.85rem',
                            borderRadius: '4px',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                          }}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveRejectingId(act.actionId)}
                          style={{
                            backgroundColor: '#dc2626',
                            color: '#ffffff',
                            padding: '0.4rem 0.85rem',
                            borderRadius: '4px',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>

                  {act.details && <p style={{ margin: '0.5rem 0', fontSize: '0.9rem', color: '#334155' }}>{act.details}</p>}

                  {act.approvedBy && (
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem' }}>
                      Sign-off Officer: <strong>{act.approvedBy}</strong> ({act.approvedAt})
                    </div>
                  )}

                  {act.rejectionReason && (
                    <div style={{ fontSize: '0.8rem', color: '#dc2626', marginTop: '0.5rem' }}>
                      Rejection Rationale: {act.rejectionReason}
                    </div>
                  )}

                  {activeRejectingId === act.actionId && (
                    <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: '#fef2f2', borderRadius: '6px' }}>
                      <label htmlFor={`rejection-reason-${act.actionId}`} style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                        Specify reason for rejection:
                      </label>
                      <input
                        id={`rejection-reason-${act.actionId}`}
                        type="text"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="e.g. Budget allocation exhausted, refer to statutory appeals board"
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #f87171', marginBottom: '0.5rem' }}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => handleRejectAction(act.actionId)}
                          style={{ backgroundColor: '#dc2626', color: '#ffffff', padding: '0.35rem 0.75rem', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Confirm Rejection
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveRejectingId(null)}
                          style={{ backgroundColor: '#94a3b8', color: '#ffffff', padding: '0.35rem 0.75rem', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Audit Logs */}
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Governance Audit Trail</h3>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Timestamp</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Event</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Actor</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.slice(0, 10).map((log) => (
                  <tr key={log.logId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{new Date(log.timestamp).toLocaleTimeString()}</td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>{log.eventType}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{log.actor}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{log.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Tab 4: Drift & Calibration Evaluation */}
      {activeTab === 'drift' && (
        <section aria-labelledby="drift-section-title">
          <h2 id="drift-section-title" style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>
            Model Drift & Calibration Evaluation
          </h2>

          {driftResult ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ padding: '1.25rem', backgroundColor: '#ffffff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Distribution Drift Status</div>
                  <div
                    style={{
                      fontSize: '1.5rem',
                      fontWeight: '700',
                      color: driftResult.driftDetected ? '#ef4444' : '#10b981',
                      margin: '0.25rem 0',
                    }}
                  >
                    {driftResult.driftStatus}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Mean shift: {driftResult.meanShiftDays} days</div>
                </div>

                <div style={{ padding: '1.25rem', backgroundColor: '#ffffff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Calibration Quality</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#0284c7', margin: '0.25rem 0' }}>
                    {driftResult.calibrationStatus}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b' }}>ECE (Calibration Error): {driftResult.calibrationError}</div>
                </div>

                <div style={{ padding: '1.25rem', backgroundColor: '#ffffff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Historical vs Validation Mean</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#0f172a', margin: '0.25rem 0' }}>
                    {driftResult.historicalMeanDays}d vs {driftResult.validationMeanDays}d
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Empirical breach rate: {(driftResult.empiricalBreachRate * 100).toFixed(0)}%</div>
                </div>
              </div>

              <div style={{ padding: '1.25rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', color: '#334155' }}>
                <h4 style={{ margin: '0 0 0.5rem' }}>Evaluation Methodology</h4>
                <p style={{ margin: 0 }}>
                  Drift is monitored by computing distribution shifts between the baseline training cohort and recent validation periods. Calibration assesses whether predicted breach likelihoods accurately match empirical breach rates across rolling evaluation windows.
                </p>
              </div>
            </div>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '8px', color: '#64748b' }}>
              No cohort selected or insufficient validation data for evaluation.
            </div>
          )}
        </section>
      )}
    </div>
  );
}
