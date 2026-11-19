import React, { useState } from 'react';
import {
  X,
  Activity,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Info,
  ShieldAlert,
  Download,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  getDiagnostics,
  reviewDiagnosticRecommendation,
  exportAnonymizedResponses,
} from '../../services/surveyService.js';

const SurveyDiagnosticsPanel = ({ survey, onClose }) => {
  const [report, setReport] = useState(() => getDiagnostics(survey.id));
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'missingness' | 'demographics' | 'recommendations'
  const [reviewNoteInputs, setReviewNoteInputs] = useState({});
  const [actionSuccess, setActionSuccess] = useState('');

  const metrics = report?.metrics || {
    totalResponses: 0,
    targetQuota: 100,
    targetProgressPct: 0,
    completionRatePct: 0,
    missingness: [],
    stratumCoverage: [],
    maskedSubgroups: {},
  };

  const handleReviewAction = (recId, decision) => {
    const notes = reviewNoteInputs[recId] || '';
    const updated = reviewDiagnosticRecommendation(survey.id, report, recId, decision, notes);
    setReport({ ...updated });
    setActionSuccess(`Recommendation marked as ${decision}.`);
    setTimeout(() => setActionSuccess(''), 3000);
  };

  const handleExportData = () => {
    const data = exportAnonymizedResponses(survey.id, { threshold: 5 });
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${survey.id}_anonymized_responses.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 1000,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="diagnostics-modal-title"
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '920px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-main)',
          border: '1px solid var(--border-light)',
          borderRadius: '1rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(59, 130, 246, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-main)',
              }}
            >
              <Activity size={20} />
            </div>
            <div>
              <h2 id="diagnostics-modal-title" style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                Sampling Quality &amp; Response-Bias Diagnostics
              </h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {survey.title} • Ruleset: {report?.rulesetVersion}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '0.25rem' }}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Statistical Disclaimer Banner */}
        <div
          style={{
            background: 'rgba(59, 130, 246, 0.08)',
            borderBottom: '1px solid var(--border-light)',
            padding: '0.65rem 1.25rem',
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
          }}
        >
          <Info size={14} color="var(--accent-main)" />
          <span>{report?.disclaimer}</span>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-light)',
            background: 'var(--glass-bg)',
            padding: '0 1.25rem',
            gap: '0.5rem',
          }}
        >
          {[
            { id: 'overview', label: 'Overview & Quota' },
            { id: 'missingness', label: `Item Missingness (${metrics.missingness.length})` },
            { id: 'demographics', label: 'Voluntary Strata Coverage' },
            { id: 'recommendations', label: `Explainable Advice (${report?.recommendations?.length || 0})` },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '0.75rem 0.9rem',
                  fontSize: '0.82rem',
                  fontWeight: active ? 700 : 500,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: active ? 'var(--accent-main)' : 'var(--text-secondary)',
                  borderBottom: active ? '2px solid var(--accent-main)' : '2px solid transparent',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1 }}>
          {actionSuccess && (
            <div
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                background: 'rgba(16, 185, 129, 0.1)',
                color: '#10b981',
                fontSize: '0.82rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <CheckCircle size={14} /> {actionSuccess}
            </div>
          )}

          {activeTab === 'overview' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ padding: '1rem', borderRadius: '0.75rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Total Responses</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{metrics.totalResponses}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Target Quota: {metrics.targetQuota}</div>
                </div>

                <div style={{ padding: '1rem', borderRadius: '0.75rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Sampling Target Progress</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: metrics.targetProgressPct >= 80 ? '#10b981' : 'var(--accent-main)' }}>
                    {metrics.targetProgressPct}%
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    {metrics.totalResponses >= metrics.targetQuota ? 'Quota Achieved' : `${metrics.targetQuota - metrics.totalResponses} remaining`}
                  </div>
                </div>

                <div style={{ padding: '1rem', borderRadius: '0.75rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Completion Rate</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>{metrics.completionRatePct}%</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Submissions completing all required fields</div>
                </div>
              </div>

              <div style={{ padding: '1rem', borderRadius: '0.75rem', background: 'var(--glass-bg)', border: '1px solid var(--border-light)' }}>
                <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', fontWeight: 700 }}>Diagnostics Engine Integrity &amp; Fallback</h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  This diagnostic report is computed purely deterministically via ruleset {report?.rulesetVersion}. No external black-box models or third-party AI APIs are used to evaluate civic submissions. Private attributes are neither inferred nor scored.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'missingness' && (
            <div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Evaluates item non-response per registered variable. High missingness rates indicate question ambiguity, citizen fatigue, or privacy hesitance.
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '0.5rem' }}>Variable</th>
                      <th style={{ padding: '0.5rem' }}>Question Prompt</th>
                      <th style={{ padding: '0.5rem' }}>Status</th>
                      <th style={{ padding: '0.5rem' }}>Missing Count</th>
                      <th style={{ padding: '0.5rem' }}>Non-Response %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.missingness.map((m) => {
                      const isHigh = m.missingPct >= 30;
                      return (
                        <tr key={m.questionId} style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '0.6rem 0.5rem' }}>
                            <code>{m.variableName}</code>
                          </td>
                          <td style={{ padding: '0.6rem 0.5rem', maxWidth: '300px' }}>{m.prompt}</td>
                          <td style={{ padding: '0.6rem 0.5rem' }}>
                            <span
                              style={{
                                padding: '0.15rem 0.4rem',
                                borderRadius: '4px',
                                fontSize: '0.72rem',
                                background: m.required ? 'rgba(59, 130, 246, 0.1)' : 'var(--glass-bg)',
                                color: m.required ? 'var(--accent-main)' : 'var(--text-tertiary)',
                              }}
                            >
                              {m.required ? 'Required' : 'Optional'}
                            </span>
                          </td>
                          <td style={{ padding: '0.6rem 0.5rem' }}>{m.missingCount}</td>
                          <td style={{ padding: '0.6rem 0.5rem' }}>
                            <span style={{ fontWeight: 700, color: isHigh ? '#ef4444' : 'var(--text-primary)' }}>
                              {m.missingPct}%
                            </span>
                            {isHigh && (
                              <span style={{ marginLeft: '0.4rem', fontSize: '0.72rem', color: '#ef4444' }}>
                                (High Non-Response)
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'demographics' && (
            <div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Evaluates representation across voluntarily reported community strata. Strata with fewer than 5 respondents are masked under k-anonymity rules.
              </p>

              {metrics.stratumCoverage.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  No specific sampling strata quotas configured for this project.
                </div>
              ) : (
                <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '0.5rem' }}>Stratum Category</th>
                        <th style={{ padding: '0.5rem' }}>Target Quota %</th>
                        <th style={{ padding: '0.5rem' }}>Actual Submissions</th>
                        <th style={{ padding: '0.5rem' }}>Actual %</th>
                        <th style={{ padding: '0.5rem' }}>Deviation</th>
                        <th style={{ padding: '0.5rem' }}>Balance Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.stratumCoverage.map((s) => {
                        const underrepresented = s.deviation <= -15;
                        return (
                          <tr key={s.label} style={{ borderBottom: '1px solid var(--border-light)' }}>
                            <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600 }}>{s.label}</td>
                            <td style={{ padding: '0.6rem 0.5rem' }}>{s.targetPercent}%</td>
                            <td style={{ padding: '0.6rem 0.5rem' }}>{s.actualCount}</td>
                            <td style={{ padding: '0.6rem 0.5rem' }}>{s.actualPercent}%</td>
                            <td style={{ padding: '0.6rem 0.5rem' }}>
                              <span style={{ color: s.deviation < 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                                {s.deviation > 0 ? `+${s.deviation}%` : `${s.deviation}%`}
                              </span>
                            </td>
                            <td style={{ padding: '0.6rem 0.5rem' }}>
                              {underrepresented ? (
                                <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.75rem' }}>
                                  Under-Sampled (Shortfall: {s.shortfall})
                                </span>
                              ) : (
                                <span style={{ color: '#10b981', fontSize: '0.75rem' }}>Balanced</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Privacy Threshold Masked Subgroups */}
              <div style={{ padding: '1rem', borderRadius: '0.75rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem', fontWeight: 700, fontSize: '0.85rem' }}>
                  <ShieldAlert size={16} color="var(--accent-main)" /> k-Anonymity Demographic Suppression
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  Subgroups with counts below the minimum privacy floor (5 respondents) are suppressed from public outputs and research aggregations to prevent re-identification.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                  {Object.entries(metrics.maskedSubgroups).map(([label, count]) => (
                    <span
                      key={label}
                      style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '4px',
                        background: 'var(--glass-bg)',
                        fontSize: '0.75rem',
                        border: '1px solid var(--border-light)',
                      }}
                    >
                      {label}: <strong>{count}</strong>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'recommendations' && (
            <div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Automated recommendations generated by ruleset {report?.rulesetVersion}. Every recommendation includes full provenance of influencing source fields. An authorized human can accept or reject actions.
              </p>

              {report?.recommendations?.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  <CheckCircle size={28} color="#10b981" style={{ marginBottom: '0.5rem' }} />
                  <p>All quality thresholds are currently balanced. No immediate corrective actions detected.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {report.recommendations.map((rec) => {
                    return (
                      <div
                        key={rec.id}
                        style={{
                          padding: '1rem',
                          borderRadius: '0.75rem',
                          background: 'var(--bg-card)',
                          border: `1px solid ${
                            rec.humanDecision === 'accepted'
                              ? '#10b981'
                              : rec.humanDecision === 'rejected'
                                ? '#ef4444'
                                : 'var(--border-light)'
                          }`,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.4rem' }}>
                          <div>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                padding: '0.15rem 0.4rem',
                                borderRadius: '4px',
                                background: rec.severity === 'warning' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                color: rec.severity === 'warning' ? '#f59e0b' : 'var(--accent-main)',
                                marginRight: '0.5rem',
                              }}
                            >
                              {rec.type}
                            </span>
                            <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{rec.title}</strong>
                          </div>

                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.5rem',
                              borderRadius: '99px',
                              background:
                                rec.humanDecision === 'accepted'
                                  ? 'rgba(16, 185, 129, 0.15)'
                                  : rec.humanDecision === 'rejected'
                                    ? 'rgba(239, 68, 68, 0.15)'
                                    : 'var(--glass-bg)',
                              color:
                                rec.humanDecision === 'accepted'
                                  ? '#10b981'
                                  : rec.humanDecision === 'rejected'
                                    ? '#ef4444'
                                    : 'var(--text-tertiary)',
                            }}
                          >
                            Status: {rec.humanDecision.toUpperCase()}
                          </span>
                        </div>

                        <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: '1.45' }}>
                          {rec.message}
                        </p>

                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', background: 'var(--glass-bg)', padding: '0.5rem', borderRadius: '4px' }}>
                          <div><strong>Rationale:</strong> {rec.rationale}</div>
                          <div style={{ marginTop: '0.25rem' }}>
                            <strong>Influencing Source Fields:</strong> <code>{rec.influencingFields.join(', ')}</code>
                          </div>
                        </div>

                        {/* Human Decision Controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', borderTop: '1px solid var(--border-light)', paddingTop: '0.65rem' }}>
                          <input
                            type="text"
                            placeholder="Add audit rationale or review notes..."
                            value={reviewNoteInputs[rec.id] !== undefined ? reviewNoteInputs[rec.id] : rec.reviewNotes || ''}
                            onChange={(e) =>
                              setReviewNoteInputs({ ...reviewNoteInputs, [rec.id]: e.target.value })
                            }
                            style={{
                              flex: '1 1 200px',
                              padding: '0.35rem 0.6rem',
                              fontSize: '0.78rem',
                              borderRadius: '4px',
                              border: '1px solid var(--border-light)',
                              background: 'var(--bg-main)',
                              color: 'var(--text-primary)',
                            }}
                            aria-label={`Review notes for ${rec.title}`}
                          />
                          <button
                            type="button"
                            onClick={() => handleReviewAction(rec.id, 'accepted')}
                            className="btn btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', color: '#10b981' }}
                          >
                            Accept Advice
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReviewAction(rec.id, 'rejected')}
                            className="btn btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', color: '#ef4444' }}
                          >
                            Reject Advice
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderTop: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
            background: 'var(--glass-bg)',
          }}
        >
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Report generated at {new Date(report.calculatedAt).toLocaleString()}
          </span>

          <button
            type="button"
            onClick={handleExportData}
            className="btn btn-primary"
            style={{ fontSize: '0.8rem', padding: '0.45rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Download size={14} /> Export Anonymized Responses (k=5)
          </button>
        </div>
      </div>
    </div>
  );
};

export default SurveyDiagnosticsPanel;

