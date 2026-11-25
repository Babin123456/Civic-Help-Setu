/**
 * src/components/waterQuality/SamplingHistoryModal.jsx
 * Modal detailing complete water-point historical sampling chronology,
 * lab certifications, parameter results, and corrective actions.
 */

import { useState } from 'react';
import { X, Shield, Calendar, RefreshCw, PlusCircle, Wrench } from 'lucide-react';
import ParameterResultsTable from './ParameterResultsTable.jsx';
import { RESULT_STATUSES, CORRECTIVE_ACTION_TYPES } from '../../data/waterQualityContract.js';

export default function SamplingHistoryModal({
  waterPoint,
  onClose,
  onAddResults,
  onPublishCorrection,
  onAddCorrectiveAction,
  userRole = 'public',
}) {
  const [activeTab, setActiveTab] = useState('samples'); // 'samples' | 'corrective'

  if (!waterPoint) return null;

  const samplingHistory = waterPoint.samplingHistory || [];
  const correctiveActions = waterPoint.correctiveActions || [];

  return (
    <div
      className="wq-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-wp-title"
    >
      <div className="wq-modal-dialog" style={{ maxWidth: '850px' }}>
        {/* Header */}
        <div className="wq-modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
              <span className="wq-card-id">
                {waterPoint.id}
              </span>
              <span className="wq-badge wq-badge-neutral">
                {waterPoint.ward}
              </span>
            </div>
            <h2 id="modal-wp-title" style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0.2rem 0', color: 'var(--text-primary)' }}>
              {waterPoint.name}
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
              {waterPoint.city} • Source: <strong style={{ color: 'var(--text-primary)' }}>{waterPoint.sourceType}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary text-xs"
            style={{ padding: '0.35rem 0.65rem' }}
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-light)', padding: '0 1.5rem', background: 'var(--bg-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>
          <button
            type="button"
            onClick={() => setActiveTab('samples')}
            style={{
              padding: '0.75rem 1rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'samples' ? '2px solid #10b981' : '2px solid transparent',
              color: activeTab === 'samples' ? '#10b981' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <Calendar size={16} />
            <span>Sampling Events &amp; Results ({samplingHistory.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('corrective')}
            style={{
              padding: '0.75rem 1rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'corrective' ? '2px solid #10b981' : '2px solid transparent',
              color: activeTab === 'corrective' ? '#10b981' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <Wrench size={16} />
            <span>Remedial Interventions ({correctiveActions.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="wq-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {activeTab === 'samples' && (
            <>
              {samplingHistory.length === 0 ? (
                <div className="wq-empty-state">
                  No sampling history recorded for this water point yet.
                </div>
              ) : (
                samplingHistory.map((event) => {
                  const statusDef = RESULT_STATUSES[event.status] || { label: event.status, badgeClass: 'wq-badge-neutral' };
                  const activeResults = (event.results || []).filter((r) => r.status !== 'superseded');
                  const supersededResults = (event.results || []).filter((r) => r.status === 'superseded');

                  return (
                    <div
                      key={event.id}
                      style={{
                        padding: '1.25rem',
                        borderRadius: '0.75rem',
                        border: '1px solid var(--border-light)',
                        background: 'var(--bg-secondary)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                      }}
                    >
                      {/* Event Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.65rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem' }}>
                              {event.id}
                            </span>
                            <span className="wq-badge wq-badge-neutral">
                              {event.sampleType.replace(/_/g, ' ')}
                            </span>
                            <span className={`wq-badge ${
                              event.status === 'verified_compliant' ? 'wq-badge-success' : event.status === 'flagged_out_of_range' ? 'wq-badge-danger' : 'wq-badge-neutral'
                            }`}>
                              {statusDef.label}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                            Collected: <strong>{new Date(event.collectionDate).toLocaleDateString()}</strong> • Container ID: <span style={{ fontFamily: 'monospace' }}>{event.sealedContainerCode}</span>
                          </p>
                        </div>

                        {/* Cryptographic Seal */}
                        {event.cryptographicSeal && (
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', padding: '0.25rem 0.5rem', borderRadius: '0.35rem', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                              <Shield size={14} />
                              {event.cryptographicSeal}
                            </span>
                            <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                              Cryptographic Seal
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Lab Info */}
                      {event.lab && (
                        <div style={{ fontSize: '0.8rem', background: 'var(--bg-card)', padding: '0.6rem 0.85rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div>
                            <strong>Testing Lab: </strong>
                            <span>{event.lab.name}</span>
                          </div>
                          <div style={{ fontFamily: 'monospace', color: '#10b981' }}>
                            NABL: {event.lab.nablAccreditationNo}
                          </div>
                        </div>
                      )}

                      {/* Active Results Table */}
                      <div>
                        <h4 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', margin: '0 0 0.4rem 0' }}>
                          Verified Parameters (IS 10500:2012)
                        </h4>
                        <ParameterResultsTable results={activeResults} />
                      </div>

                      {/* Superseded Results Accordion/Section if exists */}
                      {supersededResults.length > 0 && (
                        <div style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px dashed var(--border-light)', background: 'rgba(0,0,0,0.15)' }}>
                          <h5 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem', margin: '0 0 0.4rem 0' }}>
                            <RefreshCw size={14} />
                            <span>Superseded Prior Readings (Audit History)</span>
                          </h5>
                          <ParameterResultsTable results={supersededResults} isSuperseded={true} />
                        </div>
                      )}

                      {/* Notes / Reason */}
                      {event.notes && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', margin: 0 }}>
                          Notes: {event.notes}
                        </p>
                      )}

                      {/* Reviewer / Operator Action Buttons */}
                      {['lab_analyst', 'official_reviewer', 'admin'].includes(userRole) && (
                        <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {event.status === 'pending' && (
                            <button
                              type="button"
                              onClick={() => onAddResults(event.id)}
                              className="btn btn-primary text-xs"
                              style={{ padding: '0.35rem 0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                            >
                              <PlusCircle size={14} />
                              <span>Record Lab Measurements</span>
                            </button>
                          )}
                          {['official_reviewer', 'admin'].includes(userRole) && event.status !== 'pending' && (
                            <button
                              type="button"
                              onClick={() => onPublishCorrection(event.id)}
                              className="btn btn-secondary text-xs"
                              style={{ padding: '0.35rem 0.65rem', color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                            >
                              <RefreshCw size={14} />
                              <span>Publish Official Correction</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}

          {activeTab === 'corrective' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {correctiveActions.length === 0 ? (
                <div className="wq-empty-state">
                  No remedial interventions logged for this water point.
                </div>
              ) : (
                correctiveActions.map((action) => {
                  const typeDef = CORRECTIVE_ACTION_TYPES[action.actionType] || { label: action.actionType };
                  return (
                    <div
                      key={action.id}
                      style={{
                        padding: '1.25rem',
                        borderRadius: '0.75rem',
                        border: '1px solid var(--border-light)',
                        background: 'var(--bg-secondary)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <span className="wq-card-id">
                          {action.id}
                        </span>
                        <span className="wq-badge wq-badge-warning">
                          Status: {action.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                        {typeDef.label}
                      </h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                        {action.description}
                      </p>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-light)' }}>
                        <span>Assigned: {action.assignedDepartment}</span>
                        <span>Target: {action.targetCompletionDate}</span>
                      </div>
                    </div>
                  );
                })
              )}

              {['official_reviewer', 'admin'].includes(userRole) && (
                <div>
                  <button
                    type="button"
                    onClick={() => onAddCorrectiveAction(waterPoint.id)}
                    className="btn btn-secondary text-xs"
                    style={{ padding: '0.5rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <Wrench size={16} style={{ color: '#f59e0b' }} />
                    <span>Sanction New Remedial Intervention</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="wq-modal-footer" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Standard: Bureau of Indian Standards IS 10500:2012</span>
          <button type="button" onClick={onClose} className="btn btn-secondary text-xs" style={{ padding: '0.4rem 0.85rem' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
