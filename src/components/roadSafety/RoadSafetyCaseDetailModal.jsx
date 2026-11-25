import { useState, useEffect } from 'react';
import {
  X,
  MapPin,
  Layers,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  ClipboardList,
  Info,
} from 'lucide-react';
import {
  CASE_STATE_LABELS,
  ALLOWED_STATE_TRANSITIONS,
} from '../../data/roadSafetyContract';
import { can } from '../../services/accessControl';

export default function RoadSafetyCaseDetailModal({
  caseDetail,
  onClose,
  onTransitionState,
}) {
  const [selectedNextState, setSelectedNextState] = useState('');
  const [transitionNote, setTransitionNote] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canReview = can('roadSafety.review');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!caseDetail) return null;

  const allowedTransitions = ALLOWED_STATE_TRANSITIONS[caseDetail.status] || [];

  const handleStateSubmit = async (e) => {
    e.preventDefault();
    if (!selectedNextState) {
      setErrorMsg('Please select a target transition state.');
      return;
    }
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      await onTransitionState(caseDetail.id, selectedNextState, {
        notes: transitionNote,
      });
      setSelectedNextState('');
      setTransitionNote('');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to transition case state.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="case-detail-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-main)',
          borderRadius: '1rem',
          width: '100%',
          maxWidth: '850px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-main)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem',
            background: 'var(--bg-main)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '0.35rem',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#ef4444',
                }}
              >
                Risk Score: {caseDetail.compositeRiskScore}/100
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                Case ID: {caseDetail.id}
              </span>
            </div>
            <h2
              id="case-detail-modal-title"
              style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}
            >
              {caseDetail.segment?.name || 'Road Corridor Evidence Review'}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
              <MapPin size={14} />
              <span>
                {caseDetail.segment?.jurisdiction?.ward}, {caseDetail.segment?.jurisdiction?.district}, {caseDetail.segment?.jurisdiction?.state}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close case detail modal"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '0.4rem',
              borderRadius: '0.5rem',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {errorMsg && (
            <div
              role="alert"
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: '0.82rem',
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* Section 1: Explainability & AI Recommendation Rationale */}
          <div
            style={{
              padding: '1rem',
              borderRadius: '0.75rem',
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
              <Info size={16} color="var(--accent-main)" />
              <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                Explainable Risk Assessment Factors (MoRTH / IRC SP:88 Model)
              </strong>
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              {caseDetail.primaryRiskFactors?.map((factor, idx) => (
                <li key={idx} style={{ marginBottom: '0.25rem' }}>
                  {factor}
                </li>
              ))}
            </ul>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
              Ruleset Version: MoRTH-IRC-SP88-v1.2 • Confidence: {caseDetail.confidenceLevel?.toUpperCase()} • Denominator Uncertainty: {caseDetail.exposureUncertainty ? 'HIGH (Estimated Baseline)' : 'LOW (Census Verified)'}
            </div>
          </div>

          {/* Section 2: Corridor Physical Geometry & Features */}
          <div>
            <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Layers size={16} color="var(--accent-main)" />
              Corridor Physical & Geometric Specifications
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '0.75rem',
                fontSize: '0.8rem',
              }}
            >
              <div style={{ padding: '0.65rem 0.85rem', background: 'var(--bg-main)', borderRadius: '0.5rem', border: '1px solid var(--border-main)' }}>
                <span style={{ color: 'var(--text-tertiary)', display: 'block', fontSize: '0.72rem' }}>Speed Limit</span>
                <strong style={{ color: 'var(--text-primary)' }}>{caseDetail.segment?.speedLimitKmph} km/h</strong>
              </div>
              <div style={{ padding: '0.65rem 0.85rem', background: 'var(--bg-main)', borderRadius: '0.5rem', border: '1px solid var(--border-main)' }}>
                <span style={{ color: 'var(--text-tertiary)', display: 'block', fontSize: '0.72rem' }}>Carriageway Width</span>
                <strong style={{ color: 'var(--text-primary)' }}>{caseDetail.segment?.carriagewayWidthMeters} meters</strong>
              </div>
              <div style={{ padding: '0.65rem 0.85rem', background: 'var(--bg-main)', borderRadius: '0.5rem', border: '1px solid var(--border-main)' }}>
                <span style={{ color: 'var(--text-tertiary)', display: 'block', fontSize: '0.72rem' }}>Surface Type</span>
                <strong style={{ color: 'var(--text-primary)' }}>{caseDetail.segment?.surfaceType}</strong>
              </div>
              <div style={{ padding: '0.65rem 0.85rem', background: 'var(--bg-main)', borderRadius: '0.5rem', border: '1px solid var(--border-main)' }}>
                <span style={{ color: 'var(--text-tertiary)', display: 'block', fontSize: '0.72rem' }}>Segment Length</span>
                <strong style={{ color: 'var(--text-primary)' }}>{caseDetail.segment?.lengthMeters} meters</strong>
              </div>
              <div style={{ padding: '0.65rem 0.85rem', background: 'var(--bg-main)', borderRadius: '0.5rem', border: '1px solid var(--border-main)' }}>
                <span style={{ color: 'var(--text-tertiary)', display: 'block', fontSize: '0.72rem' }}>Lighting Quality</span>
                <strong style={{ color: 'var(--text-primary)' }}>{caseDetail.feature?.lightingQuality?.toUpperCase()}</strong>
              </div>
              <div style={{ padding: '0.65rem 0.85rem', background: 'var(--bg-main)', borderRadius: '0.5rem', border: '1px solid var(--border-main)' }}>
                <span style={{ color: 'var(--text-tertiary)', display: 'block', fontSize: '0.72rem' }}>Pedestrian Crossing</span>
                <strong style={{ color: 'var(--text-primary)' }}>{caseDetail.feature?.crossingType?.replace('_', ' ').toUpperCase()}</strong>
              </div>
            </div>
          </div>

          {/* Section 3: Crash History Aggregates */}
          <div>
            <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <ShieldAlert size={16} color="#ef4444" />
              Verified Public Crash Aggregates & Exposure Denominators
            </h3>
            {caseDetail.crashes?.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-main)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Period</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Fatal</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Severe</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Minor</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Total</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>ADT Volume</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Source Agency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {caseDetail.crashes.map((cr) => (
                      <tr key={cr.id} style={{ borderBottom: '1px solid var(--border-main)' }}>
                        <td style={{ padding: '0.5rem 0.75rem' }}>{cr.periodStart} to {cr.periodEnd}</td>
                        <td style={{ padding: '0.5rem 0.75rem', color: '#ef4444', fontWeight: '700' }}>{cr.fatalCount}</td>
                        <td style={{ padding: '0.5rem 0.75rem', color: '#f59e0b', fontWeight: '700' }}>{cr.severeInjuryCount}</td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>{cr.minorInjuryCount}</td>
                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700' }}>{cr.totalCrashes}</td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>{cr.trafficVolumeADT ? cr.trafficVolumeADT.toLocaleString() : 'Estimated'}</td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            {cr.sourceAgency}
                            {cr.sourceNoticeUrl && (
                              <a href={cr.sourceNoticeUrl} target="_blank" rel="noopener noreferrer" title="View Source Agency Record">
                                <ExternalLink size={12} />
                              </a>
                            )}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>No crash aggregates recorded.</p>
            )}
          </div>

          {/* Section 4: Site Inspections & Interventions History */}
          <div>
            <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <ClipboardList size={16} color="#10b981" />
              Documented Site Inspections ({caseDetail.inspectionRecords?.length || 0})
            </h3>
            {caseDetail.inspectionRecords?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {caseDetail.inspectionRecords.map((insp) => (
                  <div key={insp.id} style={{ padding: '0.75rem', background: 'var(--bg-main)', borderRadius: '0.5rem', border: '1px solid var(--border-main)', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontWeight: '600' }}>
                      <span style={{ color: 'var(--text-primary)' }}>Auditor: {insp.inspectedBy}</span>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem' }}>Date: {insp.inspectionDate}</span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      <strong>Findings:</strong> {insp.findings}
                    </div>
                    {insp.crossingObservations && (
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                        <strong>Crossings:</strong> {insp.crossingObservations}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>No site inspections documented yet.</p>
            )}
          </div>

          {/* Section 5: State Machine Transition (Planners/Admins) */}
          {canReview && (
            <div
              style={{
                marginTop: '0.5rem',
                padding: '1.25rem',
                borderRadius: '0.75rem',
                background: 'var(--bg-main)',
                border: '1px solid var(--border-main)',
              }}
            >
              <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <ArrowRight size={16} color="var(--accent-main)" />
                State Machine & Governance Transition
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                Current State: <strong style={{ color: 'var(--accent-main)' }}>{CASE_STATE_LABELS[caseDetail.status]}</strong>
              </p>

              {allowedTransitions.length > 0 ? (
                <form onSubmit={handleStateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <label htmlFor="next-case-state" style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                      Select Next Permitted State
                    </label>
                    <select
                      id="next-case-state"
                      value={selectedNextState}
                      onChange={(e) => setSelectedNextState(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.45rem 0.65rem',
                        borderRadius: '0.45rem',
                        border: '1px solid var(--border-main)',
                        background: 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                        fontSize: '0.82rem',
                      }}
                    >
                      <option value="">-- Choose Next State --</option>
                      {allowedTransitions.map((nextSt) => (
                        <option key={nextSt} value={nextSt}>
                          {CASE_STATE_LABELS[nextSt] || nextSt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="transition-note" style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                      Mandatory Justification / Reviewer Notes
                    </label>
                    <textarea
                      id="transition-note"
                      rows={3}
                      value={transitionNote}
                      onChange={(e) => setTransitionNote(e.target.value)}
                      placeholder="Enter engineering rationale, site observations, or justification for status change..."
                      style={{
                        width: '100%',
                        padding: '0.45rem 0.65rem',
                        borderRadius: '0.45rem',
                        border: '1px solid var(--border-main)',
                        background: 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                        fontSize: '0.82rem',
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || !selectedNextState}
                    style={{
                      alignSelf: 'flex-start',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.5rem 1rem',
                      borderRadius: '0.5rem',
                      background: 'var(--accent-main)',
                      border: 'none',
                      color: '#fff',
                      fontSize: '0.82rem',
                      fontWeight: '700',
                      cursor: isSubmitting || !selectedNextState ? 'not-allowed' : 'pointer',
                      opacity: isSubmitting || !selectedNextState ? 0.6 : 1,
                    }}
                  >
                    {isSubmitting ? 'Updating...' : 'Commit State Transition'}
                  </button>
                </form>
              ) : (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  This review case is in a terminal state ({caseDetail.status}) with no immediate transitions available.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

