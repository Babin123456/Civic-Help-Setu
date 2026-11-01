import { useState, useMemo } from 'react';
import {
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Copy,
  Check,
  FileDown,
  Info,
  ChevronDown,
  ChevronUp,
  Search,
} from 'lucide-react';
import {
  BENCHMARK_CASES,
  runAiEvaluationSuite,
} from '../../services/aiEvaluationSuiteService.js';
import { useToast } from '../../context/ToastContext.jsx';

const AiEvaluationSuitePanel = () => {
  const { toast } = useToast();
  const [testMode, setTestMode] = useState('correct'); // 'correct' | 'hallucinated'
  const [isRunning, setIsRunning] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'passed' | 'failed'
  const [expandedCaseId, setExpandedCaseId] = useState(null);
  const [copied, setCopied] = useState(false);

  // Initial report execution
  const [report, setReport] = useState(() => runAiEvaluationSuite(null, 'correct'));

  const handleRunSuite = (mode) => {
    setIsRunning(true);
    setTestMode(mode);
    setTimeout(() => {
      const newReport = runAiEvaluationSuite(null, mode);
      setReport(newReport);
      setIsRunning(false);
      toast?.info?.(
        mode === 'correct'
          ? 'Standard grounding evaluation completed.'
          : 'Adversarial hallucination injection benchmark completed.'
      );
    }, 400);
  };

  const filteredResults = useMemo(() => {
    if (!report?.results) return [];
    if (activeFilter === 'passed') return report.results.filter((r) => r.passed);
    if (activeFilter === 'failed') return report.results.filter((r) => !r.passed);
    return report.results;
  }, [report, activeFilter]);

  const handleCopySummary = () => {
    if (!report) return;
    const summary = [
      `CIVIC HELP SETU - AI EVALUATION SUITE REPORT`,
      `Executed At: ${report.executedAt}`,
      `Total Cases: ${report.totalCases} | Passed: ${report.passedCases} | Failed: ${report.failedCases}`,
      `Pass Rate: ${report.passRate}% | Avg Grounding: ${report.avgGroundingScore}%`,
      `Total Hallucinations Flagged: ${report.totalHallucinationsDetected}`,
      '',
      ...report.results.map((r, i) => [
        `[${r.passed ? 'PASS' : 'FAIL'}] ${r.id} (${r.domain})`,
        `Query: ${r.query}`,
        `Grounding Score: ${r.groundingScore}%`,
        r.findings.length > 0 ? `Findings: ${r.findings.join('; ')}` : 'Findings: Grounded without defect',
        '',
      ].join('\n')),
    ].join('\n');

    navigator.clipboard?.writeText(summary);
    setCopied(true);
    toast?.info?.('Evaluation summary report copied to clipboard.');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleDownloadJson = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-evaluation-report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast?.success?.('Evaluation report downloaded as JSON.');
  };

  return (
    <section className="glass-panel" style={{ padding: '1.75rem', borderRadius: '1rem', border: '1px solid var(--border-main)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Sparkles size={22} color="var(--accent-main, #2563eb)" />
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>
              AI Grounding & Hallucination Evaluation Suite
            </h2>
          </div>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Benchmark civic-answer accuracy, detect fabricated fees, unverified dates, and phantom schemes
          </p>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => handleRunSuite('correct')}
            disabled={isRunning}
            className={`btn ${testMode === 'correct' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            <RefreshCw size={15} className={isRunning && testMode === 'correct' ? 'animate-spin' : ''} />
            Run Standard Benchmark
          </button>
          <button
            type="button"
            onClick={() => handleRunSuite('hallucinated')}
            disabled={isRunning}
            className={`btn ${testMode === 'hallucinated' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: testMode === 'hallucinated' ? '#fff' : '#b45309' }}
          >
            <AlertTriangle size={15} />
            Test Hallucination Detection
          </button>
          <button
            type="button"
            onClick={handleCopySummary}
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}
          >
            {copied ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy Report'}
          </button>
          <button
            type="button"
            onClick={handleDownloadJson}
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}
          >
            <FileDown size={14} /> JSON
          </button>
        </div>
      </div>

      {/* Metrics Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border-main)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>TEST PASS RATE</span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: report.passRate >= 80 ? '#16a34a' : '#dc2626', marginTop: '0.25rem' }}>
            {report.passRate}%
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {report.passedCases} of {report.totalCases} cases passed
          </span>
        </div>

        <div className="card" style={{ padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border-main)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>AVG GROUNDING SCORE</span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-main, #2563eb)', marginTop: '0.25rem' }}>
            {report.avgGroundingScore}%
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Fact recall across official sources
          </span>
        </div>

        <div className="card" style={{ padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border-main)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>HALLUCINATIONS DETECTED</span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: report.totalHallucinationsDetected > 0 ? '#ea580c' : '#16a34a', marginTop: '0.25rem' }}>
            {report.totalHallucinationsDetected}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Unverified fees, contacts, or dates
          </span>
        </div>

        <div className="card" style={{ padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border-main)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>BENCHMARK DOMAINS</span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
            {report.domainsCovered.length}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Welfare, Elections, Land, Civil, Municipal
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button
          type="button"
          onClick={() => setActiveFilter('all')}
          className={`btn ${activeFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
        >
          All Cases ({report.totalCases})
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('passed')}
          className={`btn ${activeFilter === 'passed' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
        >
          Passed ({report.passedCases})
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('failed')}
          className={`btn ${activeFilter === 'failed' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
        >
          Flagged / Hallucinations ({report.failedCases})
        </button>
      </div>

      {/* Itemized Results List */}
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {filteredResults.map((result) => {
          const isExpanded = expandedCaseId === result.id;

          return (
            <div
              key={result.id}
              className="card"
              style={{
                borderRadius: '0.75rem',
                border: result.passed ? '1px solid var(--border-main)' : '1px solid rgba(239, 68, 68, 0.4)',
                overflow: 'hidden',
                backgroundColor: result.passed ? 'var(--bg-card, #ffffff)' : 'rgba(239, 68, 68, 0.02)',
              }}
            >
              {/* Row Summary */}
              <div
                onClick={() => setExpandedCaseId(isExpanded ? null : result.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setExpandedCaseId(isExpanded ? null : result.id);
                  }
                }}
                style={{
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  backgroundColor: 'var(--bg-secondary, #f8fafc)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {result.passed ? (
                    <CheckCircle2 size={20} color="#16a34a" style={{ flexShrink: 0 }} />
                  ) : (
                    <XCircle size={20} color="#dc2626" style={{ flexShrink: 0 }} />
                  )}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <strong style={{ fontSize: '0.9rem' }}>{result.id}</strong>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.1rem 0.45rem',
                          borderRadius: '0.3rem',
                          backgroundColor: 'var(--bg-main, #e2e8f0)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {result.domain}
                      </span>
                    </div>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Query: {result.query}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Grounding: {result.groundingScore}%</div>
                    <div style={{ fontSize: '0.75rem', color: result.isHallucinationFree ? '#16a34a' : '#dc2626' }}>
                      {result.isHallucinationFree ? 'No Hallucinations' : 'Hallucinations Found'}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </div>

              {/* Detailed Breakdown */}
              {isExpanded && (
                <div style={{ padding: '1.25rem', borderTop: '1px solid var(--border-main)', display: 'grid', gap: '0.75rem' }}>
                  {result.findings.length > 0 ? (
                    <div
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '0.5rem',
                        backgroundColor: 'rgba(239, 68, 68, 0.05)',
                        borderLeft: '4px solid #dc2626',
                        display: 'grid',
                        gap: '0.35rem',
                      }}
                    >
                      <strong style={{ fontSize: '0.8rem', color: '#b91c1c' }}>Evaluation Findings & Violations:</strong>
                      {result.findings.map((f, idx) => (
                        <div key={idx} style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                          • {f}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '0.5rem',
                        backgroundColor: 'rgba(22, 163, 74, 0.05)',
                        borderLeft: '4px solid #16a34a',
                        fontSize: '0.85rem',
                        color: '#15803d',
                      }}
                    >
                      ✓ Fully grounded in verified sources. Zero hallucinations or fabricated numbers detected.
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '0.75rem', marginTop: '0.25rem' }}>
                    <div>
                      <strong style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Matched Facts ({result.matchedFacts.length}):</strong>
                      <div style={{ fontSize: '0.8rem', marginTop: '0.25rem', color: '#15803d' }}>
                        {result.matchedFacts.join(', ') || 'None'}
                      </div>
                    </div>
                    <div>
                      <strong style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Missing Facts ({result.missingFacts.length}):</strong>
                      <div style={{ fontSize: '0.8rem', marginTop: '0.25rem', color: result.missingFacts.length > 0 ? '#b91c1c' : 'var(--text-secondary)' }}>
                        {result.missingFacts.join(', ') || 'None (100% matched)'}
                      </div>
                    </div>
                  </div>

                  {result.verifiedSources.length > 0 && (
                    <div style={{ marginTop: '0.25rem' }}>
                      <strong style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Verified Grounding Sources:</strong>
                      <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.2rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {result.verifiedSources.map((src, i) => (
                          <li key={i}>{src}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default AiEvaluationSuitePanel;