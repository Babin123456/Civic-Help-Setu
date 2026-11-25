import { useState, useId } from 'react';
import {
  Play,
  Pause,
  CheckCircle,
  Clock,
  FileCheck,
  Shield,
  Send,
  Award,
} from 'lucide-react';
import { EXERCISE_STATES } from '../../services/continuityPlannerService';

export const TabletopExerciseConductor = ({
  exerciseRun,
  scenario,
  onRecordDecision,
  onTransitionState,
}) => {
  const [activeInjectIdx, setActiveInjectIdx] = useState(0);
  const [decisionText, setDecisionText] = useState('');
  const [officerName, setOfficerName] = useState(exerciseRun?.leadFacilitator || '');
  const [delayMinutes, setDelayMinutes] = useState(0);

  // AAR Form state
  const [aarStrengths, setAarStrengths] = useState('');
  const [aarVulnerabilities, setAarVulnerabilities] = useState('');
  const [aarRecommendations, setAarRecommendations] = useState('');

  const decisionInputId = useId();
  const officerInputId = useId();
  const delayInputId = useId();

  if (!exerciseRun) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        No drill selected.
      </div>
    );
  }

  const injects = scenario?.timelineInjects || [];
  const currentInject = injects[activeInjectIdx] || injects[0];
  const decisionLogs = exerciseRun.decisionLogs || [];

  const handleLogDecision = (e) => {
    e.preventDefault();
    if (!decisionText.trim()) return;

    onRecordDecision(exerciseRun.id, {
      injectIndex: activeInjectIdx,
      recordedDecision: decisionText.trim(),
      responsibleOfficer: officerName.trim(),
      delayMinutes: Number(delayMinutes) || 0,
    });

    setDecisionText('');
    setDelayMinutes(0);
    if (activeInjectIdx < injects.length - 1) {
      setActiveInjectIdx((prev) => prev + 1);
    }
  };

  const handleCloseAar = (e) => {
    e.preventDefault();
    onTransitionState(exerciseRun.id, EXERCISE_STATES.CLOSED, {
      reason: 'After-Action Report approved and drill officially sealed',
      afterActionSummary: {
        strengths: aarStrengths.split('\n').map((s) => s.trim()).filter(Boolean),
        vulnerabilities: aarVulnerabilities.split('\n').map((v) => v.trim()).filter(Boolean),
        recommendations: aarRecommendations.split('\n').map((r) => r.trim()).filter(Boolean),
      },
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        padding: '1.25rem',
        background: 'var(--bg-card)',
        borderRadius: '0.75rem',
        border: '1px solid var(--border-main)',
      }}
    >
      {/* HEADER & CONTROLS */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          borderBottom: '1px solid var(--border-light)',
          paddingBottom: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.75rem',
                fontWeight: '700',
                padding: '0.2rem 0.6rem',
                borderRadius: '99px',
                background:
                  exerciseRun.status === EXERCISE_STATES.IN_PROGRESS
                    ? 'rgba(16, 185, 129, 0.15)'
                    : 'var(--glass-bg)',
                color:
                  exerciseRun.status === EXERCISE_STATES.IN_PROGRESS
                    ? '#10b981'
                    : 'var(--text-secondary)',
                border: '1px solid var(--border-light)',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background:
                    exerciseRun.status === EXERCISE_STATES.IN_PROGRESS ? '#10b981' : '#64748b',
                }}
              />
              <span>{exerciseRun.status}</span>
            </span>

            <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
              Drill ID: {exerciseRun.id}
            </span>
          </div>

          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: '800',
              margin: '0.35rem 0 0.15rem',
              color: 'var(--text-primary)',
            }}
          >
            {exerciseRun.title}
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Facilitated by <strong>{exerciseRun.leadFacilitator}</strong>
          </p>
        </div>

        {/* STATE TRANSITION CONTROLS */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {exerciseRun.status === EXERCISE_STATES.SCHEDULED && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onTransitionState(exerciseRun.id, EXERCISE_STATES.IN_PROGRESS)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
            >
              <Play size={15} aria-hidden="true" />
              <span>Commence Drill</span>
            </button>
          )}

          {exerciseRun.status === EXERCISE_STATES.IN_PROGRESS && (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onTransitionState(exerciseRun.id, EXERCISE_STATES.PAUSED)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
              >
                <Pause size={15} aria-hidden="true" />
                <span>Pause</span>
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onTransitionState(exerciseRun.id, EXERCISE_STATES.AAR_REVIEW)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
              >
                <FileCheck size={15} aria-hidden="true" />
                <span>Complete Injects & Move to AAR</span>
              </button>
            </>
          )}

          {exerciseRun.status === EXERCISE_STATES.PAUSED && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onTransitionState(exerciseRun.id, EXERCISE_STATES.IN_PROGRESS)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
            >
              <Play size={15} aria-hidden="true" />
              <span>Resume Drill</span>
            </button>
          )}
        </div>
      </div>

      {/* RECOVERY METRICS STATUS BAR */}
      <div
        role="region"
        aria-label="Real-time recovery metrics"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '0.75rem',
          padding: '0.85rem',
          background: 'var(--glass-bg)',
          borderRadius: '0.5rem',
          border: '1px solid var(--border-light)',
        }}
      >
        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'block' }}>
            Target RTO
          </span>
          <span style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)' }}>
            {exerciseRun.recoveryMetrics?.targetRTOHours || 4} hrs
          </span>
        </div>

        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'block' }}>
            Estimated Restoration Time
          </span>
          <span style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)' }}>
            {exerciseRun.recoveryMetrics?.actualEstimatedRTOHours || exerciseRun.recoveryMetrics?.targetRTOHours || 4} hrs
          </span>
        </div>

        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'block' }}>
            Response Gap
          </span>
          <span
            style={{
              fontSize: '1.1rem',
              fontWeight: '800',
              color: (exerciseRun.recoveryMetrics?.gapHours || 0) > 0 ? '#ef4444' : '#10b981',
            }}
          >
            {(exerciseRun.recoveryMetrics?.gapHours || 0) > 0 ? `+${exerciseRun.recoveryMetrics.gapHours} hrs` : '0 hrs (On Target)'}
          </span>
        </div>

        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'block' }}>
            Service Resilience Score
          </span>
          <span
            style={{
              fontSize: '1.1rem',
              fontWeight: '800',
              color: (exerciseRun.recoveryMetrics?.serviceResilienceScore || 100) >= 80 ? '#10b981' : '#d97706',
            }}
          >
            {exerciseRun.recoveryMetrics?.serviceResilienceScore ?? 100} / 100
          </span>
        </div>
      </div>

      {/* SCENARIO NARRATIVE & INJECT RUNNER */}
      {exerciseRun.status !== EXERCISE_STATES.CLOSED && exerciseRun.status !== EXERCISE_STATES.AAR_REVIEW && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem' }}>
          {/* SCENARIO CONTEXT */}
          {scenario && (
            <div
              style={{
                padding: '0.85rem',
                borderRadius: '0.5rem',
                background: 'rgba(2, 132, 199, 0.08)',
                border: '1px solid rgba(2, 132, 199, 0.2)',
                fontSize: '0.85rem',
              }}
            >
              <h3
                style={{
                  margin: '0 0 0.35rem',
                  fontSize: '0.9rem',
                  color: '#0284c7',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <Shield size={16} aria-hidden="true" />
                <span>Scenario: {scenario.title}</span>
              </h3>
              <p style={{ margin: 0, color: 'var(--text-primary)' }}>{scenario.narrative}</p>
            </div>
          )}

          {/* TIMELINE INJECT STEPS */}
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '700', margin: '0 0 0.75rem' }}>
              Scenario Injects Timeline
            </h3>

            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
              {injects.map((inj, idx) => {
                const isLogged = decisionLogs.some((d) => d.injectIndex === idx);
                const isActive = activeInjectIdx === idx;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveInjectIdx(idx)}
                    style={{
                      flex: '0 0 auto',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.4rem 0.85rem',
                      borderRadius: '99px',
                      border: `1px solid ${isActive ? 'var(--accent-main)' : 'var(--border-main)'}`,
                      background: isActive ? 'var(--accent-main)' : isLogged ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-card)',
                      color: isActive ? '#ffffff' : isLogged ? '#10b981' : 'var(--text-secondary)',
                      fontSize: '0.8rem',
                      fontWeight: isActive || isLogged ? '700' : '500',
                      cursor: 'pointer',
                    }}
                  >
                    {isLogged ? <CheckCircle size={14} aria-hidden="true" /> : <Clock size={14} aria-hidden="true" />}
                    <span>
                      T+{inj.timeOffsetMinutes}m: {inj.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ACTIVE INJECT CARD */}
          {currentInject && (
            <div
              style={{
                padding: '1rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-main)',
                background: 'var(--bg-card)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--accent-main)' }}>
                  INJECT STEP {activeInjectIdx + 1} OF {injects.length} (T+{currentInject.timeOffsetMinutes} MINS)
                </span>
              </div>

              <h4 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                {currentInject.title}
              </h4>
              <p style={{ margin: '0 0 0.85rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                {currentInject.eventDescription}
              </p>

              {/* EXPECTED DECISIONS & PERSONNEL */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '0.75rem',
                  marginBottom: '1rem',
                }}
              >
                <div
                  style={{
                    padding: '0.65rem',
                    borderRadius: '0.4rem',
                    background: 'var(--glass-bg)',
                    fontSize: '0.8rem',
                  }}
                >
                  <strong style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                    Expected Operational Decisions:
                  </strong>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-secondary)' }}>
                    {(currentInject.expectedDecisions || []).map((dec, i) => (
                      <li key={i}>{dec}</li>
                    ))}
                  </ul>
                </div>

                <div
                  style={{
                    padding: '0.65rem',
                    borderRadius: '0.4rem',
                    background: 'var(--glass-bg)',
                    fontSize: '0.8rem',
                  }}
                >
                  <strong style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                    Required Coordinating Personnel:
                  </strong>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-secondary)' }}>
                    {(currentInject.requiredPersonnel || []).map((pers, i) => (
                      <li key={i}>{pers}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* RECORD DECISION FORM */}
              {exerciseRun.status === EXERCISE_STATES.IN_PROGRESS ? (
                <form
                  onSubmit={handleLogDecision}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    borderTop: '1px solid var(--border-light)',
                    paddingTop: '0.85rem',
                  }}
                >
                  <label htmlFor={decisionInputId} style={{ fontSize: '0.85rem', fontWeight: '700' }}>
                    Record Officer Incident Decision / Action:
                  </label>
                  <textarea
                    id={decisionInputId}
                    rows="3"
                    required
                    placeholder="Describe specific tactical command action, containment decision, or backup invocation..."
                    value={decisionText}
                    onChange={(e) => setDecisionText(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-main)',
                      background: 'var(--bg-main)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                    }}
                  />

                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 200px' }}>
                      <label htmlFor={officerInputId} style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block' }}>
                        Officer in Charge:
                      </label>
                      <input
                        id={officerInputId}
                        type="text"
                        value={officerName}
                        onChange={(e) => setOfficerName(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.4rem 0.6rem',
                          borderRadius: '0.4rem',
                          border: '1px solid var(--border-main)',
                          background: 'var(--bg-main)',
                          color: 'var(--text-primary)',
                          fontSize: '0.82rem',
                        }}
                      />
                    </div>

                    <div style={{ flex: '1 1 140px' }}>
                      <label htmlFor={delayInputId} style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block' }}>
                        Response Latency / Delay (mins):
                      </label>
                      <input
                        id={delayInputId}
                        type="number"
                        min="0"
                        max="720"
                        value={delayMinutes}
                        onChange={(e) => setDelayMinutes(Number(e.target.value))}
                        style={{
                          width: '100%',
                          padding: '0.4rem 0.6rem',
                          borderRadius: '0.4rem',
                          border: '1px solid var(--border-main)',
                          background: 'var(--bg-main)',
                          color: 'var(--text-primary)',
                          fontSize: '0.82rem',
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.4rem' }}>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
                    >
                      <Send size={14} aria-hidden="true" />
                      <span>Log Decision & Next Step</span>
                    </button>
                  </div>
                </form>
              ) : (
                <div style={{ padding: '0.6rem', background: 'var(--glass-bg)', borderRadius: '0.4rem', fontSize: '0.82rem' }}>
                  Decisions can be logged once the drill is transitioned to <strong>IN_PROGRESS</strong>.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* AAR REVIEW & CLOSURE FORM */}
      {exerciseRun.status === EXERCISE_STATES.AAR_REVIEW && (
        <form
          onSubmit={handleCloseAar}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            padding: '1rem',
            background: 'var(--bg-main)',
            borderRadius: '0.5rem',
            border: '1px solid var(--border-main)',
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: '1.1rem',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: 'var(--text-primary)',
            }}
          >
            <Award size={18} aria-hidden="true" />
            <span>After-Action Report (AAR) & Drill Closure Review</span>
          </h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Document formal post-exercise findings, identify root systemic gaps, and establish actionable improvements before sealing the exercise record.
          </p>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: '700', display: 'block', marginBottom: '0.3rem' }}>
              Operational Strengths (one per line):
            </label>
            <textarea
              rows="3"
              required
              placeholder="e.g. Rapid communication within 15 mins&#10;Successful activation of backup generator"
              value={aarStrengths}
              onChange={(e) => setAarStrengths(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '0.4rem',
                border: '1px solid var(--border-main)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: '700', display: 'block', marginBottom: '0.3rem' }}>
              Vulnerabilities & Response Gaps (one per line):
            </label>
            <textarea
              rows="3"
              required
              placeholder="e.g. Unavailability of spare parts vendor after 18:00&#10;Confusion regarding manual paper token allocation"
              value={aarVulnerabilities}
              onChange={(e) => setAarVulnerabilities(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '0.4rem',
                border: '1px solid var(--border-main)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: '700', display: 'block', marginBottom: '0.3rem' }}>
              Corrective Action Recommendations (one per line):
            </label>
            <textarea
              rows="3"
              required
              placeholder="e.g. Execute 24x7 SLA with hardware replacement supplier&#10;Conduct offline drill training for ward clerks"
              value={aarRecommendations}
              onChange={(e) => setAarRecommendations(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '0.4rem',
                border: '1px solid var(--border-main)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
            >
              <CheckCircle size={15} aria-hidden="true" />
              <span>Approve AAR & Seal Exercise</span>
            </button>
          </div>
        </form>
      )}

      {/* CLOSED STATE DISPLAY */}
      {exerciseRun.status === EXERCISE_STATES.CLOSED && (
        <div
          style={{
            padding: '1rem',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', marginBottom: '0.5rem' }}>
            <CheckCircle size={18} aria-hidden="true" />
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '800' }}>
              Exercise Completed & Sealed Under AAR Review
            </h4>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', fontSize: '0.82rem' }}>
            <div>
              <strong>Documented Strengths:</strong>
              <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.2rem', color: 'var(--text-secondary)' }}>
                {(exerciseRun.afterActionSummary?.strengths || []).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>

            <div>
              <strong>Identified Gaps:</strong>
              <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.2rem', color: 'var(--text-secondary)' }}>
                {(exerciseRun.afterActionSummary?.vulnerabilities || []).map((v, i) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            </div>

            <div>
              <strong>Recommendations:</strong>
              <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.2rem', color: 'var(--text-secondary)' }}>
                {(exerciseRun.afterActionSummary?.recommendations || []).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* DECISION JOURNAL TABLE */}
      {decisionLogs.length > 0 && (
        <div style={{ marginTop: '0.5rem' }}>
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', fontWeight: '700' }}>
            Recorded Decisions Journal ({decisionLogs.length})
          </h4>
          <div style={{ overflowX: 'auto', border: '1px solid var(--border-light)', borderRadius: '0.4rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: 'var(--glass-bg)', textAlign: 'left', borderBottom: '1px solid var(--border-light)' }}>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Timestamp</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Inject Phase</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Recorded Tactical Decision</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Officer</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Latency</th>
                </tr>
              </thead>
              <tbody>
                {decisionLogs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>
                      Step {log.injectIndex + 1}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-primary)' }}>
                      {log.recordedDecision}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-secondary)' }}>
                      {log.responsibleOfficer}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', color: log.delayMinutes > 0 ? '#ef4444' : '#10b981' }}>
                      {log.delayMinutes > 0 ? `+${log.delayMinutes}m` : 'Immediate'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
