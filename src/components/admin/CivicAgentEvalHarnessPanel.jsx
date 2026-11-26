import { useState, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Play,
  GitCompare,
  FileDown,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import {
  EVAL_CATEGORIES,
  EVAL_LANGUAGES,
  DEFAULT_RELEASE_THRESHOLDS,
} from '../../ai/evals/evalContracts.js';
import { filterScenarios } from '../../ai/evals/scenarioFixtures.js';
import {
  runScenarioEvaluationSuite,
  compareHarnessRuns,
} from '../../ai/evals/evalRunner.js';
import { useToast } from '../../context/ToastContext.jsx';

const TARGET_OPTIONS = [
  { id: 'civic-agent-pipeline', label: 'Civic Multi-Agent Pipeline (Orchestrator)' },
  { id: 'grounded-rag-assistant', label: 'Source-Grounded RAG Assistant' },
  { id: 'model-gateway', label: 'Civic Model Gateway (Residency + Circuit Breaker)' },
];

function formatPct(rate) {
  return `${Math.round(Number(rate || 0) * 100)}%`;
}

const CivicAgentEvalHarnessPanel = () => {
  const { toast } = useToast();
  const [targetId, setTargetId] = useState('civic-agent-pipeline');
  const [category, setCategory] = useState('all');
  const [language, setLanguage] = useState('all');
  const [modelVersion, setModelVersion] = useState('1.0.0');
  const [isRunning, setIsRunning] = useState(false);
  const [activeRun, setActiveRun] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [expandedScenarioId, setExpandedScenarioId] = useState(null);
  const [statusMessage, setStatusMessage] = useState(
    'Ready to run synthetic scenario-based regression evaluation.'
  );
  const [copied, setCopied] = useState(false);

  const previewScenarios = useMemo(
    () => filterScenarios({ category, language }),
    [category, language]
  );

  const traceByScenarioId = useMemo(() => {
    const map = new Map();
    for (const trace of activeRun?.traces || []) {
      map.set(trace.scenarioId, trace);
    }
    return map;
  }, [activeRun]);

  const handleRunHarness = async () => {
    setIsRunning(true);
    setStatusMessage('Running synthetic evaluation scenarios across vertical slice...');
    try {
      const run = await runScenarioEvaluationSuite({
        targetId,
        category,
        language,
        modelId: `${targetId}-eval`,
        modelVersion,
        promptVersion: 'v1.0',
        concurrency: 4,
        thresholds: DEFAULT_RELEASE_THRESHOLDS,
      });
      setActiveRun(run);
      setStatusMessage(
        `Completed ${run.metrics.totalScenarios} synthetic scenarios. Release gate ${
          run.gate.passed ? 'PASSED' : 'FAILED'
        }.`
      );
      toast?.info?.(
        `Evaluation run ${run.runId} ${run.gate.passed ? 'passed' : 'failed'} release thresholds.`
      );
    } catch (err) {
      setStatusMessage(`Evaluation failed: ${err.message}`);
      toast?.error?.(`Evaluation run failed: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleCompareModels = async () => {
    setIsRunning(true);
    setStatusMessage('Comparing baseline multi-agent pipeline vs grounded RAG candidate...');
    try {
      const [baselineRun, candidateRun] = await Promise.all([
        runScenarioEvaluationSuite({
          targetId: 'civic-agent-pipeline',
          category,
          language,
          modelId: 'baseline-orchestrator',
          modelVersion: '1.0.0',
          promptVersion: 'v1.0',
          concurrency: 4,
        }),
        runScenarioEvaluationSuite({
          targetId: 'grounded-rag-assistant',
          category,
          language,
          modelId: 'candidate-rag-direct',
          modelVersion: '1.1.0',
          promptVersion: 'v1.1',
          concurrency: 4,
        }),
      ]);
      const report = compareHarnessRuns(baselineRun, candidateRun, DEFAULT_RELEASE_THRESHOLDS);
      setActiveRun(candidateRun);
      setComparison(report);
      setStatusMessage(
        `Model comparison complete: ${report.gatePassed ? 'PASSED' : 'FAILED'} (${report.regressedScenarios.length} regressions).`
      );
      toast?.info?.('Baseline vs Candidate comparison completed.');
    } catch (err) {
      setStatusMessage(`Comparison failed: ${err.message}`);
      toast?.error?.(`Comparison failed: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopyReport = () => {
    if (!activeRun) return;
    const lines = [
      'CIVIC HELP SETU — AGENT EVALUATION HARNESS REPORT',
      `Run ID: ${activeRun.runId} | Target: ${activeRun.targetId} | Version: ${activeRun.modelVersion}`,
      `Gate Status: ${activeRun.gate.passed ? 'PASS' : 'FAIL'}`,
      `Task Success: ${formatPct(activeRun.metrics.taskSuccessRate)} | Factuality: ${formatPct(activeRun.metrics.factualityScore)}`,
      `Citation Coverage: ${formatPct(activeRun.metrics.citationCoverage)} | Refusal Accuracy: ${formatPct(activeRun.metrics.refusalAccuracy)}`,
      `Prohibited Outcomes: ${activeRun.metrics.prohibitedViolationsCount} | p95 Latency: ${activeRun.metrics.p95LatencyMs}ms`,
    ];
    navigator.clipboard?.writeText(lines.join('\n'));
    setCopied(true);
    toast?.info?.('Redacted evaluation summary copied.');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleExportJson = () => {
    if (!activeRun) return;
    const payload = comparison ? { run: activeRun, comparison } : { run: activeRun };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `civic-agent-eval-${activeRun.runId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast?.success?.('Redacted evaluation report exported as JSON.');
  };

  return (
    <section
      aria-labelledby="civic-eval-harness-heading"
      className="glass-panel"
      style={{
        padding: '1.75rem',
        borderRadius: '1rem',
        border: '1px solid var(--border-main, #e2e8f0)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <h2
            id="civic-eval-harness-heading"
            style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <ShieldCheck size={22} aria-hidden="true" />
            Civic Agent Evaluation Harness &amp; Regression Suites
          </h2>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem', color: 'var(--text-secondary, #475569)' }}>
            Reproducible synthetic scenario benchmarks with redacted trace capture, model comparison, and release threshold gates.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={isRunning}
            onClick={handleRunHarness}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Play size={15} aria-hidden="true" />
            {isRunning ? 'Running Suite...' : `Run Harness (${previewScenarios.length})`}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={isRunning}
            onClick={handleCompareModels}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <GitCompare size={15} aria-hidden="true" />
            Compare Models
          </button>
          {activeRun && (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCopyReport}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                Copy Summary
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleExportJson}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <FileDown size={15} aria-hidden="true" />
                Export JSON
              </button>
            </>
          )}
        </div>
      </div>

      {/* Scope & Privacy Guardrail Notice */}
      <div
        role="note"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.6rem',
          padding: '0.85rem 1rem',
          borderRadius: '0.65rem',
          backgroundColor: 'rgba(37, 99, 235, 0.08)',
          border: '1px solid rgba(37, 99, 235, 0.25)',
          marginBottom: '1.25rem',
          fontSize: '0.85rem',
        }}
      >
        <Lock size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
        <div>
          <strong>Synthetic-Only &amp; Untrusted Proposal Policy:</strong> Only synthetic fixtures are executed; PII and credentials are redacted prior to trace storage. Agent outputs are treated as untrusted proposals requiring verified citations and human approval for high-impact actions—no autonomous filing, benefit denial, or official-status claims.
        </div>
      </div>

      {/* Filter & Target Controls */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: '0.85rem',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <label htmlFor="eval-target-select" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
            Target Pipeline Adapter
          </label>
          <select
            id="eval-target-select"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '0.45rem', border: '1px solid var(--border-main, #cbd5e1)' }}
          >
            {TARGET_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="eval-category-select" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
            Scenario Category
          </label>
          <select
            id="eval-category-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '0.45rem', border: '1px solid var(--border-main, #cbd5e1)' }}
          >
            <option value="all">All categories</option>
            {EVAL_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="eval-language-select" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
            Language Slice
          </label>
          <select
            id="eval-language-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '0.45rem', border: '1px solid var(--border-main, #cbd5e1)' }}
          >
            <option value="all">All languages</option>
            {EVAL_LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="eval-version-input" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
            Candidate Version Tag
          </label>
          <input
            id="eval-version-input"
            type="text"
            value={modelVersion}
            onChange={(e) => setModelVersion(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '0.45rem', border: '1px solid var(--border-main, #cbd5e1)' }}
          />
        </div>
      </div>

      {/* Live Status Region */}
      <div role="status" aria-live="polite" style={{ fontSize: '0.85rem', marginBottom: '1rem', fontWeight: 500 }}>
        {statusMessage}
      </div>

      {/* Summary Metrics & Release Gate */}
      {activeRun && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: '0.6rem',
              backgroundColor: activeRun.gate.passed ? 'rgba(22, 163, 74, 0.1)' : 'rgba(220, 38, 38, 0.1)',
              border: `1px solid ${activeRun.gate.passed ? 'rgba(22, 163, 74, 0.35)' : 'rgba(220, 38, 38, 0.35)'}`,
              marginBottom: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
              {activeRun.gate.passed ? (
                <ShieldCheck size={18} aria-hidden="true" />
              ) : (
                <ShieldAlert size={18} aria-hidden="true" />
              )}
              <span>Release Gate: {activeRun.gate.passed ? 'PASSED' : 'FAILED'}</span>
            </div>
            <span style={{ fontSize: '0.8rem' }}>
              Run ID: {activeRun.runId} • {activeRun.metrics.passedScenarios}/{activeRun.metrics.totalScenarios} passed
            </span>
          </div>

          {activeRun.metrics.isSampleSizeLow && (
            <div
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 0.9rem',
                borderRadius: '0.5rem',
                backgroundColor: 'rgba(234, 179, 8, 0.14)',
                marginBottom: '1rem',
                fontSize: '0.83rem',
              }}
            >
              <AlertTriangle size={16} aria-hidden="true" />
              <span>
                Low sample size warning ({activeRun.metrics.totalScenarios} &lt; 10 scenarios). Expand filters before promotion decisions.
              </span>
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '0.75rem',
            }}
          >
            {[
              { label: 'TASK SUCCESS', value: formatPct(activeRun.metrics.taskSuccessRate) },
              { label: 'FACTUALITY', value: formatPct(activeRun.metrics.factualityScore) },
              { label: 'CITATION COVERAGE', value: formatPct(activeRun.metrics.citationCoverage) },
              { label: 'REFUSAL ACCURACY', value: formatPct(activeRun.metrics.refusalAccuracy) },
              { label: 'PROHIBITED OUTCOMES', value: String(activeRun.metrics.prohibitedViolationsCount) },
              { label: 'P95 LATENCY', value: `${activeRun.metrics.p95LatencyMs} ms` },
            ].map((card) => (
              <div
                key={card.label}
                style={{
                  padding: '0.85rem',
                  borderRadius: '0.65rem',
                  border: '1px solid var(--border-main, #e2e8f0)',
                }}
              >
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary, #64748b)' }}>
                  {card.label}
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.2rem' }}>
                  {card.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comparison Deltas */}
      {comparison && (
        <div
          style={{
            padding: '1rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-main, #e2e8f0)',
            marginBottom: '1.5rem',
          }}
        >
          <h3 style={{ margin: '0 0 0.65rem', fontSize: '1rem', fontWeight: 700 }}>
            Baseline ({comparison.baseline.targetId}) vs Candidate ({comparison.candidate.targetId})
          </h3>
          <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
            <span>Task Δ: <strong>{comparison.deltas.taskSuccessDelta >= 0 ? '+' : ''}{formatPct(comparison.deltas.taskSuccessDelta)}</strong></span>
            <span>Factuality Δ: <strong>{comparison.deltas.factualityDelta >= 0 ? '+' : ''}{formatPct(comparison.deltas.factualityDelta)}</strong></span>
            <span>Citation Δ: <strong>{comparison.deltas.citationDelta >= 0 ? '+' : ''}{formatPct(comparison.deltas.citationDelta)}</strong></span>
            <span>Regressed Scenarios: <strong>{comparison.regressedScenarios.length}</strong></span>
            <span>Comparison Gate: <strong>{comparison.gatePassed ? 'PASS' : 'FAIL'}</strong></span>
          </div>
        </div>
      )}

      {/* Scenario Catalog & Redacted Trace Table */}
      <div style={{ overflowX: 'auto' }}>
        <table
          aria-label="Synthetic Civic Agent Evaluation Scenarios and Results"
          style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}
        >
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-main, #cbd5e1)', textAlign: 'left' }}>
              <th scope="col" style={{ padding: '0.6rem' }}>Scenario ID</th>
              <th scope="col" style={{ padding: '0.6rem' }}>Category / Lang</th>
              <th scope="col" style={{ padding: '0.6rem' }}>Jurisdiction</th>
              <th scope="col" style={{ padding: '0.6rem' }}>Status</th>
              <th scope="col" style={{ padding: '0.6rem' }}>Citations / Safety</th>
              <th scope="col" style={{ padding: '0.6rem' }}>Trace</th>
            </tr>
          </thead>
          <tbody>
            {previewScenarios.map((scenario) => {
              const result = activeRun?.results?.find((r) => r.scenarioId === scenario.id);
              const trace = traceByScenarioId.get(scenario.id);
              const isExpanded = expandedScenarioId === scenario.id;
              const tracePanelId = `trace-panel-${scenario.id}`;

              return (
                <tr key={scenario.id} style={{ borderBottom: '1px solid var(--border-main, #e2e8f0)', verticalAlign: 'top' }}>
                  <td style={{ padding: '0.65rem 0.6rem', fontWeight: 600 }}>
                    <div>{scenario.id}</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-secondary, #64748b)' }}>
                      {scenario.domain}
                    </div>
                  </td>
                  <td style={{ padding: '0.65rem 0.6rem' }}>
                    {scenario.category} / {scenario.language}
                  </td>
                  <td style={{ padding: '0.65rem 0.6rem' }}>{scenario.jurisdiction}</td>
                  <td style={{ padding: '0.65rem 0.6rem', fontWeight: 600 }}>
                    {result ? (result.passed ? 'PASS' : 'FAIL') : 'PENDING'}
                    {result ? ` (${result.latencyMs} ms)` : ''}
                  </td>
                  <td style={{ padding: '0.65rem 0.6rem' }}>
                    {result ? (
                      <span>
                        Citations: {formatPct(result.citationCoverage)} • Violations: {result.prohibitedViolations.length}
                      </span>
                    ) : (
                      <span>{scenario.refusalExpected ? 'Refusal expected' : 'Grounded answer expected'}</span>
                    )}
                  </td>
                  <td style={{ padding: '0.65rem 0.6rem' }}>
                    {trace ? (
                      <div>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          aria-expanded={isExpanded}
                          aria-controls={tracePanelId}
                          onClick={() => setExpandedScenarioId(isExpanded ? null : scenario.id)}
                          style={{ padding: '0.25rem 0.55rem', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          {isExpanded ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
                          {isExpanded ? 'Hide Trace' : 'View Trace'}
                        </button>
                        {isExpanded && (
                          <div
                            id={tracePanelId}
                            style={{
                              marginTop: '0.5rem',
                              padding: '0.6rem',
                              borderRadius: '0.45rem',
                              backgroundColor: 'rgba(15, 23, 42, 0.04)',
                              fontSize: '0.78rem',
                            }}
                          >
                            <div><strong>Redacted Query:</strong> {trace.redactedQuery}</div>
                            <div><strong>Redaction Applied:</strong> {trace.redactionApplied ? `Yes (${trace.redactedCategories.join(', ')})` : 'No'}</div>
                            <div><strong>Hops:</strong> {trace.hops.map((h) => `${h.agent}(${h.attempts})`).join(' -> ')}</div>
                            <div><strong>Cited URLs:</strong> {trace.citedUrls.join(', ') || 'None'}</div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-secondary, #64748b)' }}>Run to inspect</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default CivicAgentEvalHarnessPanel;
