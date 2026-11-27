/**
 * src/pages/CivicWorkflowDigitalTwinWorkspace.jsx
 * Civic Workflow Digital Twin for End-to-End Service Journey Simulation (#1157).
 *
 * An interactive, WCAG-compliant administrative test bench allowing maintainers
 * to simulate civic service journeys with synthetic citizen personas, detect
 * dead ends and circular dependencies, compare workflow versions, and sign off
 * on catalogue changes.
 */

import { useState, useId, useMemo } from 'react';
import {
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileText,
  Users,
  Download,
  RefreshCw,
  ShieldCheck,
  Scale,
  GitCompare,
  Eye,
  Check,
  Ban,
} from 'lucide-react';
import {
  loadStoredWorkflows,
  saveStoredSimulation,
  loadStoredAuditLogs,
  saveStoredAuditLog,
  resetDigitalTwinStorage,
} from '../services/digitalTwinStorage';
import {
  validateWorkflowGraphIntegrity,
  simulatePersonaJourney,
  simulateCohort,
  compareWorkflowVersions,
  generateAccessibleTabularReport,
  sanitizeDigitalTwinExport,
} from '../services/civicWorkflowDigitalTwinService';
import { SYNTHETIC_PERSONAS } from '../data/digitalTwinPersonas';

export default function CivicWorkflowDigitalTwinWorkspace() {
  const baseSelectId = useId();
  const proposedSelectId = useId();
  const personaSelectId = useId();
  const reviewRationaleId = useId();

  const [workflows, setWorkflows] = useState(() => loadStoredWorkflows());
  const [selectedBaseId, setSelectedBaseId] = useState(workflows[0]?.id || '');
  const [selectedProposedId, setSelectedProposedId] = useState(workflows[1]?.id || '');
  const [selectedPersonaId, setSelectedPersonaId] = useState('ALL_COHORT');
  const [viewMode, setViewMode] = useState('TABLE'); // 'TABLE' | 'FLOW'
  const [isComparing, setIsComparing] = useState(false);

  const [simulationResult, setSimulationResult] = useState(null);
  const [cohortResult, setCohortResult] = useState(null);
  const [comparisonResult, setComparisonResult] = useState(null);

  const [reviewRationale, setReviewRationale] = useState('');
  const [decisionFeedback, setDecisionFeedback] = useState(null);
  const [recentAuditLogs, setRecentAuditLogs] = useState(() => loadStoredAuditLogs());

  const activeBaseWorkflow = useMemo(
    () => workflows.find((w) => w.id === selectedBaseId) || workflows[0],
    [workflows, selectedBaseId]
  );

  const activeProposedWorkflow = useMemo(
    () => workflows.find((w) => w.id === selectedProposedId) || workflows[1] || workflows[0],
    [workflows, selectedProposedId]
  );

  const activePersona = useMemo(
    () => SYNTHETIC_PERSONAS.find((p) => p.id === selectedPersonaId) || null,
    [selectedPersonaId]
  );

  const baseIntegrity = useMemo(
    () => (activeBaseWorkflow ? validateWorkflowGraphIntegrity(activeBaseWorkflow) : null),
    [activeBaseWorkflow]
  );

  // Trigger Simulation
  const handleRunSimulation = () => {
    if (!activeBaseWorkflow) return;
    setDecisionFeedback(null);

    if (selectedPersonaId === 'ALL_COHORT') {
      const cohort = simulateCohort(activeBaseWorkflow, SYNTHETIC_PERSONAS);
      setCohortResult(cohort);
      setSimulationResult(null);
      saveStoredSimulation({
        type: 'COHORT_SIMULATION',
        workflowId: activeBaseWorkflow.id,
        version: activeBaseWorkflow.version,
        successRate: cohort.successRate,
        averageDays: cohort.averageDurationDays,
        totalPersonas: cohort.totalPersonas,
      });
    } else if (activePersona) {
      const single = simulatePersonaJourney(activeBaseWorkflow, activePersona);
      setSimulationResult(single);
      setCohortResult(null);
      saveStoredSimulation({
        type: 'SINGLE_PERSONA_SIMULATION',
        personaId: activePersona.id,
        workflowId: activeBaseWorkflow.id,
        outcome: single.outcome,
        totalDays: single.totalDays,
      });
    }
  };

  // Trigger Version Comparison
  const handleCompareVersions = () => {
    if (!activeBaseWorkflow || !activeProposedWorkflow) return;
    setIsComparing(true);
    setDecisionFeedback(null);

    const comp = compareWorkflowVersions(
      activeBaseWorkflow,
      activeProposedWorkflow,
      SYNTHETIC_PERSONAS
    );
    setComparisonResult(comp);

    // Also run cohort on proposed workflow to populate views
    const proposedCohort = simulateCohort(activeProposedWorkflow, SYNTHETIC_PERSONAS);
    setCohortResult(proposedCohort);
    setSimulationResult(null);
  };

  // Record Maintainer Decision (Human in the loop)
  const handleRecordDecision = (decisionType) => {
    if (!activeProposedWorkflow) return;
    const rationaleText =
      reviewRationale.trim() ||
      (decisionType === 'APPROVED_FOR_PUBLICATION'
        ? 'Verified acceptable cohort resilience and zero dead-ends in simulation twin.'
        : 'Blocked due to breaking changes or intolerable failure rates.');

    const recorded = saveStoredAuditLog({
      workflowId: activeProposedWorkflow.id,
      version: activeProposedWorkflow.version,
      decision: decisionType,
      reviewerRole: 'CATALOGUE_MAINTAINER',
      rationale: rationaleText,
    });

    setRecentAuditLogs(loadStoredAuditLogs());
    setDecisionFeedback({
      type: decisionType === 'APPROVED_FOR_PUBLICATION' ? 'success' : 'blocked',
      message: `Audit decision recorded (Ref: ${recorded.id}): ${decisionType}`,
    });
    setReviewRationale('');
  };

  // Export Clean Report
  const handleExportReport = () => {
    const reportPayload = {
      exportedAt: new Date().toISOString(),
      baseWorkflow: activeBaseWorkflow,
      proposedWorkflow: isComparing ? activeProposedWorkflow : null,
      cohortMetrics: cohortResult,
      singlePersonaTrace: simulationResult,
      versionComparison: comparisonResult,
      recentAuditLogs,
    };

    const clean = sanitizeDigitalTwinExport(reportPayload);
    const blob = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `digital-twin-scenario-${activeBaseWorkflow?.id || 'sim'}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Reset Storage
  const handleReset = () => {
    if (window.confirm('Reset Digital Twin workflows and simulations to initial factory seed?')) {
      resetDigitalTwinStorage();
      setWorkflows(loadStoredWorkflows());
      setSimulationResult(null);
      setCohortResult(null);
      setComparisonResult(null);
      setRecentAuditLogs([]);
      setDecisionFeedback({ type: 'info', message: 'Storage reset to canonical seed workflows.' });
    }
  };

  const tabularRows = useMemo(() => {
    if (simulationResult) {
      return generateAccessibleTabularReport(simulationResult);
    }
    return [];
  }, [simulationResult]);

  return (
    <div className="section" style={{ minHeight: '80vh', padding: '2rem 1rem' }}>
      <div className="container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Scope Boundary Notice */}
        <aside
          role="region"
          aria-label="Statutory and Privacy Scope Notice"
          style={{
            backgroundColor: 'rgba(234, 179, 8, 0.1)',
            borderLeft: '4px solid #eab308',
            padding: '1rem',
            borderRadius: '4px',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
          }}
        >
          <Scale size={24} style={{ color: '#ca8a04', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ color: '#854d0e', display: 'block', marginBottom: '0.25rem' }}>
              Statutory Boundary & Synthetic Model Notice
            </strong>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#713f12', lineHeight: '1.4' }}>
              The <strong>Civic Workflow Digital Twin</strong> is an offline resilience simulation engine for catalogue maintainers.
              All personas and documents are <strong>100% synthetic models</strong>. This environment does not access live citizen files,
              does not issue official government authorizations, and does not perform autonomous benefit denials.
            </p>
          </div>
        </aside>

        {/* Page Header */}
        <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
              Civic Workflow Digital Twin
            </h1>
            <p style={{ margin: 0, color: 'var(--text-muted, #666)', fontSize: '1rem' }}>
              End-to-End Service Journey Resiliency Simulation, Dead-End Detection & Pre-Publishing Version Audit
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleExportReport}
              className="btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                border: '1px solid #ccc',
                backgroundColor: 'var(--bg-card, #fff)',
                cursor: 'pointer',
              }}
              aria-label="Export Scenario Report as JSON"
            >
              <Download size={16} /> Export Scenario
            </button>
            <button
              onClick={handleReset}
              className="btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                border: '1px solid #e5e7eb',
                backgroundColor: 'transparent',
                cursor: 'pointer',
              }}
              aria-label="Reset simulation state to defaults"
            >
              <RefreshCw size={16} /> Reset State
            </button>
          </div>
        </header>

        {/* Action Controls & Selection Panel */}
        <section
          aria-labelledby="simulation-controls-heading"
          style={{
            backgroundColor: 'var(--bg-card, #fff)',
            border: '1px solid var(--border-color, #e5e7eb)',
            borderRadius: '8px',
            padding: '1.5rem',
            marginBottom: '1.5rem',
          }}
        >
          <h2 id="simulation-controls-heading" style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: 0, marginBottom: '1rem' }}>
            Simulation Test Bench & Version Selector
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
            {/* Base Workflow Selection */}
            <div>
              <label htmlFor={baseSelectId} style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.375rem' }}>
                Baseline Workflow (Live / Benchmark)
              </label>
              <select
                id={baseSelectId}
                value={selectedBaseId}
                onChange={(e) => {
                  setSelectedBaseId(e.target.value);
                  setIsComparing(false);
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '6px',
                  border: '1px solid #ccc',
                  backgroundColor: 'var(--bg-card, #fff)',
                  color: 'inherit',
                }}
              >
                {workflows.map((wf) => (
                  <option key={wf.id} value={wf.id}>
                    {wf.title} (v{wf.version})
                  </option>
                ))}
              </select>
            </div>

            {/* Candidate / Proposed Workflow Selection */}
            <div>
              <label htmlFor={proposedSelectId} style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.375rem' }}>
                Candidate Workflow (Draft Revision to Verify)
              </label>
              <select
                id={proposedSelectId}
                value={selectedProposedId}
                onChange={(e) => setSelectedProposedId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '6px',
                  border: '1px solid #ccc',
                  backgroundColor: 'var(--bg-card, #fff)',
                  color: 'inherit',
                }}
              >
                {workflows.map((wf) => (
                  <option key={wf.id} value={wf.id}>
                    {wf.title} (v{wf.version})
                  </option>
                ))}
              </select>
            </div>

            {/* Synthetic Persona Selector */}
            <div>
              <label htmlFor={personaSelectId} style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.375rem' }}>
                Synthetic Test Persona / Cohort
              </label>
              <select
                id={personaSelectId}
                value={selectedPersonaId}
                onChange={(e) => {
                  setSelectedPersonaId(e.target.value);
                  setIsComparing(false);
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '6px',
                  border: '1px solid #ccc',
                  backgroundColor: 'var(--bg-card, #fff)',
                  color: 'inherit',
                }}
              >
                <option value="ALL_COHORT">✨ Full Synthetic Cohort (All 5 Personas)</option>
                {SYNTHETIC_PERSONAS.map((p) => (
                  <option key={p.id} value={p.id}>
                    👤 {p.name} ({p.archetype})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleRunSimulation}
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.625rem 1.25rem',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Play size={16} /> Run Journey Simulation
            </button>

            <button
              onClick={handleCompareVersions}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.625rem 1.25rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #d1d5db)',
                backgroundColor: 'var(--bg-card, #fff)',
                color: 'inherit',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <GitCompare size={16} /> Compare Old vs New Versions
            </button>
          </div>
        </section>

        {/* Graph Integrity Diagnostic Banner */}
        {baseIntegrity && (
          <div
            style={{
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              backgroundColor: baseIntegrity.isValid ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
              border: `1px solid ${baseIntegrity.isValid ? '#22c55e' : '#ef4444'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {baseIntegrity.isValid ? (
                <CheckCircle2 size={22} style={{ color: '#16a34a' }} />
              ) : (
                <AlertTriangle size={22} style={{ color: '#dc2626' }} />
              )}
              <div>
                <strong style={{ display: 'block' }}>
                  {baseIntegrity.isValid
                    ? 'Workflow Graph Integrity: Verified (No Dead-Ends or Cycles)'
                    : 'Workflow Graph Defects Detected!'}
                </strong>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted, #555)' }}>
                  Service ID: <code>{activeBaseWorkflow.serviceId}</code> | Statutory SLA: {activeBaseWorkflow.statutorySlaDays} days
                </span>
              </div>
            </div>

            {!baseIntegrity.isValid && (
              <div style={{ fontSize: '0.875rem', color: '#b91c1c' }}>
                {baseIntegrity.errors.join(' | ')}
              </div>
            )}
          </div>
        )}

        {/* Version Comparison Card (If active) */}
        {isComparing && comparisonResult && (
          <section
            aria-labelledby="comparison-heading"
            style={{
              backgroundColor: 'var(--bg-card, #fff)',
              border: `2px solid ${comparisonResult.isBreaking ? '#ef4444' : '#22c55e'}`,
              borderRadius: '8px',
              padding: '1.5rem',
              marginBottom: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h2 id="comparison-heading" style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>
                Version Comparison Audit: v{comparisonResult.baseVersion} vs v{comparisonResult.proposedVersion}
              </h2>
              <span
                style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '9999px',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  backgroundColor: comparisonResult.isBreaking ? '#fee2e2' : '#dcfce7',
                  color: comparisonResult.isBreaking ? '#991b1b' : '#166534',
                }}
              >
                {comparisonResult.severity.label} ({comparisonResult.severity.level})
              </span>
            </div>

            <p style={{ marginTop: 0, fontSize: '0.925rem' }}>
              {comparisonResult.severity.description}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
              <div style={{ padding: '0.75rem', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.03)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Success Rate Delta</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: comparisonResult.successRateDelta >= 0 ? '#16a34a' : '#dc2626' }}>
                  {comparisonResult.successRateDelta > 0 ? `+${comparisonResult.successRateDelta}%` : `${comparisonResult.successRateDelta}%`}
                </div>
              </div>

              <div style={{ padding: '0.75rem', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.03)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Avg Duration Delta</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                  {comparisonResult.slaDurationDelta > 0 ? `+${comparisonResult.slaDurationDelta} days` : `${comparisonResult.slaDurationDelta} days`}
                </div>
              </div>

              <div style={{ padding: '0.75rem', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.03)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Newly Introduced Dead Ends</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: comparisonResult.newDeadEnds.length > 0 ? '#dc2626' : '#16a34a' }}>
                  {comparisonResult.newDeadEnds.length}
                </div>
              </div>

              <div style={{ padding: '0.75rem', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.03)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Excluded Personas</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: comparisonResult.excludedPersonas.length > 0 ? '#dc2626' : '#16a34a' }}>
                  {comparisonResult.excludedPersonas.length}
                </div>
              </div>
            </div>

            {comparisonResult.excludedPersonas.length > 0 && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: '6px', backgroundColor: '#fff1f2', border: '1px solid #fecdd3' }}>
                <strong style={{ color: '#9f1239', display: 'block', marginBottom: '0.25rem' }}>
                  Regression Warning: Citizen Cohort Excluded
                </strong>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#881337' }}>
                  {comparisonResult.excludedPersonas.map((p) => (
                    <li key={p.personaId}>
                      <strong>{p.personaName}</strong>: {p.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Human in the loop decision signing */}
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color, #e5e7eb)', paddingTop: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}>
                Maintainer Governance Sign-Off (Human-in-the-Loop)
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0 0 0.75rem 0' }}>
                AI simulations produce untrusted proposals. Publishing changes to live guides requires explicit human review and recorded rationale.
              </p>

              <div style={{ marginBottom: '0.75rem' }}>
                <label htmlFor={reviewRationaleId} style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Reviewer Decision Rationale
                </label>
                <input
                  id={reviewRationaleId}
                  type="text"
                  placeholder="e.g. Verified zero regressions across all marginal personas; ready to publish."
                  value={reviewRationale}
                  onChange={(e) => setReviewRationale(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: '1px solid #ccc',
                    backgroundColor: 'var(--bg-card, #fff)',
                    color: 'inherit',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleRecordDecision('APPROVED_FOR_PUBLICATION')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    backgroundColor: '#16a34a',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Check size={16} /> Approve & Sign-Off for Publishing
                </button>
                <button
                  onClick={() => handleRecordDecision('BLOCKED_BREAKING_CHANGES')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    backgroundColor: '#dc2626',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Ban size={16} /> Block Workflow: Fix Deficiencies
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Decision Feedback Toast */}
        {decisionFeedback && (
          <div
            role="status"
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              marginBottom: '1.5rem',
              backgroundColor: decisionFeedback.type === 'success' ? '#dcfce7' : '#fee2e2',
              color: decisionFeedback.type === 'success' ? '#166534' : '#991b1b',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <ShieldCheck size={18} />
            {decisionFeedback.message}
          </div>
        )}

        {/* Cohort Aggregation Summary Cards */}
        {cohortResult && (
          <section
            aria-labelledby="cohort-summary-heading"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            <div style={{ backgroundColor: 'var(--bg-card, #fff)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-color, #e5e7eb)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                <Users size={16} /> Total Cohort
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.25rem' }}>
                {cohortResult.totalPersonas}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Diverse synthetic personas</span>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card, #fff)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-color, #e5e7eb)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#16a34a' }}>
                <CheckCircle2 size={16} /> Success Rate
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.25rem', color: cohortResult.successRate === 100 ? '#16a34a' : '#d97706' }}>
                {cohortResult.successRate}%
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {cohortResult.successCount} of {cohortResult.totalPersonas} delivered
              </span>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card, #fff)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-color, #e5e7eb)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                <Clock size={16} /> Mean Turnaround
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.25rem' }}>
                {cohortResult.averageDurationDays}d
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Statutory SLA limit: {cohortResult.statutorySlaDays}d
              </span>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card, #fff)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-color, #e5e7eb)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: cohortResult.deadEndCount > 0 ? '#dc2626' : '#16a34a' }}>
                <AlertTriangle size={16} /> Trapped Dead-Ends
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.25rem', color: cohortResult.deadEndCount > 0 ? '#dc2626' : '#16a34a' }}>
                {cohortResult.deadEndCount}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {cohortResult.deadEndCount === 0 ? 'Zero dead-ends detected' : 'Requires immediate rectification'}
              </span>
            </div>
          </section>
        )}

        {/* View Mode Switcher */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>
            Service Journey Execution Details
          </h2>

          <div style={{ display: 'inline-flex', borderRadius: '6px', border: '1px solid #ccc', overflow: 'hidden' }}>
            <button
              onClick={() => setViewMode('TABLE')}
              style={{
                padding: '0.375rem 0.75rem',
                backgroundColor: viewMode === 'TABLE' ? '#2563eb' : 'transparent',
                color: viewMode === 'TABLE' ? '#fff' : 'inherit',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                fontSize: '0.875rem',
              }}
              aria-pressed={viewMode === 'TABLE'}
            >
              <FileText size={15} /> Accessible Table (WCAG)
            </button>
            <button
              onClick={() => setViewMode('FLOW')}
              style={{
                padding: '0.375rem 0.75rem',
                backgroundColor: viewMode === 'FLOW' ? '#2563eb' : 'transparent',
                color: viewMode === 'FLOW' ? '#fff' : 'inherit',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                fontSize: '0.875rem',
              }}
              aria-pressed={viewMode === 'FLOW'}
            >
              <Eye size={15} /> Visual Journey Flow
            </button>
          </div>
        </div>

        {/* Detailed Inspection Area */}
        <section
          style={{
            backgroundColor: 'var(--bg-card, #fff)',
            border: '1px solid var(--border-color, #e5e7eb)',
            borderRadius: '8px',
            padding: '1.25rem',
            overflowX: 'auto',
            marginBottom: '2rem',
          }}
        >
          {/* Accessible Table View */}
          {viewMode === 'TABLE' && (
            <div>
              {simulationResult ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                  <caption style={{ textAlign: 'left', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                    Detailed Step-by-Step Simulation Execution Trace for {simulationResult.personaName}
                  </caption>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color, #e5e7eb)' }}>
                      <th scope="col" style={{ padding: '0.75rem 0.5rem' }}>#</th>
                      <th scope="col" style={{ padding: '0.75rem 0.5rem' }}>Step Name</th>
                      <th scope="col" style={{ padding: '0.75rem 0.5rem' }}>Office / Counter</th>
                      <th scope="col" style={{ padding: '0.75rem 0.5rem' }}>Status</th>
                      <th scope="col" style={{ padding: '0.75rem 0.5rem' }}>Days (Cumulative)</th>
                      <th scope="col" style={{ padding: '0.75rem 0.5rem' }}>Accessibility</th>
                      <th scope="col" style={{ padding: '0.75rem 0.5rem' }}>Auditor Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tabularRows.map((row) => (
                      <tr key={row.stepNumber} style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>{row.stepNumber}</td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>{row.label}</td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>{row.office}</td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <span
                            style={{
                              padding: '0.125rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              backgroundColor: row.status === 'PASSED' || row.status === 'DELIVERED' ? '#dcfce7' : '#fee2e2',
                              color: row.status === 'PASSED' || row.status === 'DELIVERED' ? '#166534' : '#991b1b',
                            }}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>{row.cumulativeDays}d</td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>{row.accessibilityIssue}</td>
                        <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)' }}>{row.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : cohortResult ? (
                <div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                    <caption style={{ textAlign: 'left', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                      Synthetic Persona Cohort Benchmark Matrix
                    </caption>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border-color, #e5e7eb)' }}>
                        <th scope="col" style={{ padding: '0.75rem 0.5rem' }}>Synthetic Citizen</th>
                        <th scope="col" style={{ padding: '0.75rem 0.5rem' }}>Archetype</th>
                        <th scope="col" style={{ padding: '0.75rem 0.5rem' }}>Outcome</th>
                        <th scope="col" style={{ padding: '0.75rem 0.5rem' }}>Duration</th>
                        <th scope="col" style={{ padding: '0.75rem 0.5rem' }}>SLA Status</th>
                        <th scope="col" style={{ padding: '0.75rem 0.5rem' }}>Failure / Friction Cause</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cohortResult.individualResults.map((res) => (
                        <tr key={res.personaId} style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                          <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>{res.personaName}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}><code>{res.archetype}</code></td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            <span
                              style={{
                                padding: '0.125rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                backgroundColor: res.isSuccess ? '#dcfce7' : '#fee2e2',
                                color: res.isSuccess ? '#166534' : '#991b1b',
                              }}
                            >
                              {res.outcome}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{res.totalDays} days</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            {res.slaBreached ? (
                              <span style={{ color: '#dc2626', fontWeight: 600 }}>BREACHED</span>
                            ) : (
                              <span style={{ color: '#16a34a' }}>WITHIN SLA</span>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)' }}>
                            {res.failureReason || 'None (Completed Successfully)'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                  <Play size={32} style={{ margin: '0 auto 0.5rem auto', opacity: 0.5 }} />
                  <p style={{ margin: 0 }}>Click <strong>"Run Journey Simulation"</strong> or <strong>"Compare Old vs New Versions"</strong> above to inspect execution steps.</p>
                </div>
              )}
            </div>
          )}

          {/* Visual Step Cards View */}
          {viewMode === 'FLOW' && (
            <div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Sequential Node Pathway for <strong>{activeBaseWorkflow.title}</strong>
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {activeBaseWorkflow.nodes
                  .filter((n) => n.type === 'SERVICE_STEP' || n.type === 'TERMINAL_STATE')
                  .map((node, index) => (
                    <div
                      key={node.id}
                      style={{
                        padding: '1rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color, #e5e7eb)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        backgroundColor: node.type === 'TERMINAL_STATE' ? 'rgba(0,0,0,0.02)' : 'var(--bg-card, #fff)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            backgroundColor: '#e0e7ff',
                            color: '#3730a3',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.875rem',
                            fontWeight: 700,
                          }}
                        >
                          {index + 1}
                        </span>
                        <div>
                          <strong>{node.label}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                            ID: <code>{node.id}</code> | Type: {node.type}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        {node.estimatedDays !== undefined && (
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                            <Clock size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} />
                            ~{node.estimatedDays}d
                          </span>
                        )}
                        {node.terminalStatus && (
                          <span
                            style={{
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              backgroundColor: node.terminalStatus === 'APPROVED' ? '#dcfce7' : '#fee2e2',
                              color: node.terminalStatus === 'APPROVED' ? '#166534' : '#991b1b',
                            }}
                          >
                            {node.terminalStatus}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </section>

        {/* Audit Log Record History */}
        {recentAuditLogs.length > 0 && (
          <section
            aria-labelledby="audit-history-heading"
            style={{
              backgroundColor: 'var(--bg-card, #fff)',
              border: '1px solid var(--border-color, #e5e7eb)',
              borderRadius: '8px',
              padding: '1.25rem',
            }}
          >
            <h2 id="audit-history-heading" style={{ fontSize: '1.125rem', fontWeight: 600, marginTop: 0, marginBottom: '0.75rem' }}>
              Maintainer Decision Audit Chain (Immutable Log)
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {recentAuditLogs.slice(0, 5).map((log) => (
                <div
                  key={log.id}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color, #e5e7eb)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.875rem',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600 }}>{log.decision}</span> on <code>{log.workflowId}</code> (v{log.version})
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                      Rationale: {log.rationale}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {new Date(log.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
