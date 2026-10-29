import React, { useState, useEffect, useMemo } from 'react';
import {
  Scale,
  CheckCircle2,
  AlertTriangle,
  History,
  Plus,
  ExternalLink,
  Save,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import {
  getAllSourceConflicts,
  getConflictAuditLogs,
  recordSourceConflict,
  resolveSourceConflict,
  CLAIM_FIELDS,
  CLAIM_FIELD_LABELS,
  CONFLICT_STATUS,
} from '../../services/sourceConflictService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { safeHttpUrl } from '../../utils/safeContent';

const SourceConflictReviewQueue = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [conflicts, setConflicts] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [filterStatus, setFilterStatus] = useState('unresolved'); // 'all' | 'unresolved' | 'resolved'
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedConflictForResolution, setSelectedConflictForResolution] = useState(null);

  // Resolution Form State
  const [chosenValue, setChosenValue] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');

  // New Conflict Form State
  const [newServiceId, setNewServiceId] = useState('');
  const [newServiceName, setNewServiceName] = useState('');
  const [newClaimField, setNewClaimField] = useState(CLAIM_FIELDS.FEES);
  const [newDescription, setNewDescription] = useState('');
  const [newSource1Name, setNewSource1Name] = useState('');
  const [newSource1Value, setNewSource1Value] = useState('');
  const [newSource1Url, setNewSource1Url] = useState('');
  const [newSource2Name, setNewSource2Name] = useState('');
  const [newSource2Value, setNewSource2Value] = useState('');
  const [newSource2Url, setNewSource2Url] = useState('');

  const refreshData = () => {
    setConflicts(getAllSourceConflicts());
    setAuditLogs(getConflictAuditLogs());
  };

  useEffect(() => {
    refreshData();
  }, []);

  const filteredConflicts = useMemo(() => {
    if (filterStatus === 'all') return conflicts;
    return conflicts.filter((c) => c.status === filterStatus);
  }, [conflicts, filterStatus]);

  const handleOpenResolve = (conflict) => {
    setSelectedConflictForResolution(conflict);
    setChosenValue(conflict.sources[0]?.claimedValue || '');
    setResolutionNotes('');
  };

  const handleExecuteResolution = (e) => {
    e.preventDefault();
    if (!selectedConflictForResolution) return;

    try {
      resolveSourceConflict({
        conflictId: selectedConflictForResolution.id,
        chosenValue,
        resolutionNotes,
        reviewerName: user?.username || 'Senior Reviewer',
        reviewerRole: user?.role || 'admin',
        isAutomatedScraper: false, // Strict human check
      });

      toast?.success?.('Source conflict resolved and verified value updated.');
      setSelectedConflictForResolution(null);
      refreshData();
    } catch (err) {
      toast?.error?.(err.message || 'Failed to resolve conflict.');
    }
  };

  const handleCreateConflict = (e) => {
    e.preventDefault();
    try {
      recordSourceConflict({
        serviceId: newServiceId,
        serviceName: newServiceName,
        claimField: newClaimField,
        description: newDescription,
        sources: [
          {
            sourceName: newSource1Name,
            claimedValue: newSource1Value,
            sourceUrl: newSource1Url,
            confidenceTier: 'high',
          },
          {
            sourceName: newSource2Name,
            claimedValue: newSource2Value,
            sourceUrl: newSource2Url,
            confidenceTier: 'medium',
          },
        ],
        actor: user?.username || 'Admin Maintainer',
      });

      toast?.success?.('New source discrepancy registered in review queue.');
      setShowAddModal(false);
      // Reset form
      setNewServiceId('');
      setNewServiceName('');
      setNewDescription('');
      setNewSource1Name('');
      setNewSource1Value('');
      setNewSource1Url('');
      setNewSource2Name('');
      setNewSource2Value('');
      setNewSource2Url('');
      refreshData();
    } catch (err) {
      toast?.error?.(err.message || 'Failed to record conflict.');
    }
  };

  return (
    <div
      className="source-conflict-queue card-glass animate-fade-in"
      style={{
        borderRadius: '1.25rem',
        background: 'var(--bg-card, #111827)',
        border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
        padding: '1.75rem',
        marginTop: '2rem',
      }}
      role="region"
      aria-label="Civic Source Conflict and Confidence Review Queue"
    >
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: 'var(--accent-main)',
              fontSize: '0.8rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '0.35rem',
            }}
          >
            <Scale size={16} aria-hidden="true" />
            Evidence Discrepancy Adjudication
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            Source Conflict & Confidence Review Queue
          </h3>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Compare conflicting official claims, attach gazette citations, and record auditable manual verification notes.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setShowAddModal(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Plus size={15} /> Record Discrepancy
        </button>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1.25rem',
          borderBottom: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
          paddingBottom: '0.75rem',
        }}
      >
        <button
          type="button"
          onClick={() => setFilterStatus('unresolved')}
          style={{
            padding: '0.35rem 0.85rem',
            borderRadius: '999px',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer',
            border: filterStatus === 'unresolved' ? '1px solid #f59e0b' : '1px solid var(--border-light)',
            background: filterStatus === 'unresolved' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
            color: filterStatus === 'unresolved' ? '#f59e0b' : 'var(--text-secondary)',
          }}
        >
          Unresolved Conflicts ({conflicts.filter((c) => c.status === CONFLICT_STATUS.UNRESOLVED).length})
        </button>
        <button
          type="button"
          onClick={() => setFilterStatus('resolved')}
          style={{
            padding: '0.35rem 0.85rem',
            borderRadius: '999px',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer',
            border: filterStatus === 'resolved' ? '1px solid #10b981' : '1px solid var(--border-light)',
            background: filterStatus === 'resolved' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
            color: filterStatus === 'resolved' ? '#10b981' : 'var(--text-secondary)',
          }}
        >
          Resolved Archive ({conflicts.filter((c) => c.status === CONFLICT_STATUS.RESOLVED).length})
        </button>
        <button
          type="button"
          onClick={() => setFilterStatus('all')}
          style={{
            padding: '0.35rem 0.85rem',
            borderRadius: '999px',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer',
            border: filterStatus === 'all' ? '1px solid var(--accent-main)' : '1px solid var(--border-light)',
            background: filterStatus === 'all' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
            color: filterStatus === 'all' ? 'var(--accent-main)' : 'var(--text-secondary)',
          }}
        >
          All Recorded ({conflicts.length})
        </button>
      </div>

      {/* Conflict List */}
      {filteredConflicts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-tertiary)' }}>
          <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto 0.5rem auto' }} />
          <div>No source conflicts matching this filter.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredConflicts.map((conflict) => {
            const isResolved = conflict.status === CONFLICT_STATUS.RESOLVED;
            return (
              <div
                key={conflict.id}
                style={{
                  background: isResolved
                    ? 'rgba(16, 185, 129, 0.03)'
                    : 'var(--bg-card-hover, rgba(255, 255, 255, 0.03))',
                  borderRadius: '0.85rem',
                  border: isResolved
                    ? '1px solid rgba(16, 185, 129, 0.25)'
                    : '1px solid rgba(245, 158, 11, 0.3)',
                  padding: '1.25rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '0.75rem',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.55rem',
                          borderRadius: '99px',
                          background: isResolved ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: isResolved ? '#10b981' : '#f59e0b',
                        }}
                      >
                        {isResolved ? 'Resolved' : 'Caution Active'}
                      </span>
                      <strong style={{ fontSize: '1rem' }}>{conflict.serviceName}</strong>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                        ({CLAIM_FIELD_LABELS[conflict.claimField] || conflict.claimField})
                      </span>
                    </div>

                    {conflict.description && (
                      <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {conflict.description}
                      </p>
                    )}
                  </div>

                  {!isResolved ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleOpenResolve(conflict)}
                      style={{ fontSize: '0.8rem' }}
                    >
                      Resolve Conflict
                    </button>
                  ) : (
                    <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                      <div>Verified by {conflict.resolvedBy}</div>
                      <div>Date: {new Date(conflict.resolvedAt).toLocaleDateString()}</div>
                    </div>
                  )}
                </div>

                {/* Conflicting Source References Side-by-Side */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '0.75rem',
                    marginTop: '0.75rem',
                  }}
                >
                  {conflict.sources.map((src, i) => (
                    <div
                      key={src.id || i}
                      style={{
                        padding: '0.75rem',
                        borderRadius: '0.5rem',
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px solid var(--border-light, rgba(255, 255, 255, 0.08))',
                        fontSize: '0.82rem',
                      }}
                    >
                      <div style={{ fontWeight: 700, color: 'var(--accent-main)' }}>
                        {src.sourceName}
                      </div>
                      <div style={{ margin: '0.3rem 0', fontWeight: 600 }}>
                        Claimed Value: <span style={{ color: '#f59e0b' }}>{src.claimedValue}</span>
                      </div>
                      {src.sourceUrl && (
                        <a
                          href={safeHttpUrl(src.sourceUrl) || undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: '0.72rem',
                            color: 'var(--accent-main)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                            textDecoration: 'none',
                          }}
                        >
                          View Source <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>

                {/* Resolved Decision Output */}
                {isResolved && (
                  <div
                    style={{
                      marginTop: '0.85rem',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '0.5rem',
                      background: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      fontSize: '0.82rem',
                    }}
                  >
                    <div style={{ fontWeight: 700, color: '#10b981' }}>
                      Adjudicated Value: {conflict.resolvedValue}
                    </div>
                    <div style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      Rationale: {conflict.resolutionNotes}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Resolution Adjudication Modal */}
      {selectedConflictForResolution && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="card-glass animate-fade-in"
            style={{
              width: '100%',
              maxWidth: '560px',
              borderRadius: '1.25rem',
              background: 'var(--bg-card, #111827)',
              border: '1px solid var(--border-light)',
              padding: '1.5rem',
            }}
          >
            <h4 style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: 0, marginBottom: '0.5rem' }}>
              Adjudicate Source Conflict: {selectedConflictForResolution.serviceName}
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Field: {CLAIM_FIELD_LABELS[selectedConflictForResolution.claimField]}
            </p>

            <form onSubmit={handleExecuteResolution}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Select or Enter Authoritative Reconciled Value:
                </label>
                <input
                  type="text"
                  required
                  value={chosenValue}
                  onChange={(e) => setChosenValue(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    borderRadius: '0.5rem',
                    background: 'var(--bg-input, #1e293b)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: '0.88rem',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Reviewer Resolution Rationale & Evidence Notes (Mandatory):
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain why this source was selected (e.g. Gazette notification 2025 supersedes 2023 circular, confirmed with nodal office)."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    borderRadius: '0.5rem',
                    background: 'var(--bg-input, #1e293b)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSelectedConflictForResolution(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm & Publish Resolution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record New Conflict Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="card-glass animate-fade-in"
            style={{
              width: '100%',
              maxWidth: '600px',
              borderRadius: '1.25rem',
              background: 'var(--bg-card, #111827)',
              border: '1px solid var(--border-light)',
              padding: '1.5rem',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <h4 style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: 0, marginBottom: '1rem' }}>
              Record Source Discrepancy
            </h4>

            <form onSubmit={handleCreateConflict}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Service ID:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. birth-certificate"
                    value={newServiceId}
                    onChange={(e) => setNewServiceId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      borderRadius: '0.45rem',
                      background: 'var(--bg-input, #1e293b)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Service Name:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Birth Certificate"
                    value={newServiceName}
                    onChange={(e) => setNewServiceName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      borderRadius: '0.45rem',
                      background: 'var(--bg-input, #1e293b)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Conflicting Claim Field:
                </label>
                <select
                  value={newClaimField}
                  onChange={(e) => setNewClaimField(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.55rem',
                    borderRadius: '0.45rem',
                    background: 'var(--bg-input, #1e293b)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                >
                  {Object.entries(CLAIM_FIELDS).map(([k, val]) => (
                    <option key={val} value={val}>
                      {CLAIM_FIELD_LABELS[val]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Source 1 */}
              <div
                style={{
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(0,0,0,0.2)',
                  marginBottom: '0.75rem',
                  border: '1px solid var(--border-light)',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.4rem', color: 'var(--accent-main)' }}>
                  Source Reference #1
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  <input
                    type="text"
                    required
                    placeholder="Source Name (e.g. Official Gazette 2025)"
                    value={newSource1Name}
                    onChange={(e) => setNewSource1Name(e.target.value)}
                    style={{
                      padding: '0.5rem',
                      borderRadius: '0.4rem',
                      background: 'var(--bg-input, #1e293b)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                      fontSize: '0.8rem',
                    }}
                  />
                  <input
                    type="text"
                    required
                    placeholder="Claimed Value (e.g. ₹50)"
                    value={newSource1Value}
                    onChange={(e) => setNewSource1Value(e.target.value)}
                    style={{
                      padding: '0.5rem',
                      borderRadius: '0.4rem',
                      background: 'var(--bg-input, #1e293b)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                      fontSize: '0.8rem',
                    }}
                  />
                </div>
                <input
                  type="url"
                  placeholder="Citation URL (Optional)"
                  value={newSource1Url}
                  onChange={(e) => setNewSource1Url(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '0.4rem',
                    background: 'var(--bg-input, #1e293b)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: '0.8rem',
                  }}
                />
              </div>

              {/* Source 2 */}
              <div
                style={{
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(0,0,0,0.2)',
                  marginBottom: '0.85rem',
                  border: '1px solid var(--border-light)',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.4rem', color: '#f59e0b' }}>
                  Source Reference #2 (Conflicting)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  <input
                    type="text"
                    required
                    placeholder="Source Name (e.g. Municipal Citizen Charter)"
                    value={newSource2Name}
                    onChange={(e) => setNewSource2Name(e.target.value)}
                    style={{
                      padding: '0.5rem',
                      borderRadius: '0.4rem',
                      background: 'var(--bg-input, #1e293b)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                      fontSize: '0.8rem',
                    }}
                  />
                  <input
                    type="text"
                    required
                    placeholder="Claimed Value (e.g. ₹100)"
                    value={newSource2Value}
                    onChange={(e) => setNewSource2Value(e.target.value)}
                    style={{
                      padding: '0.5rem',
                      borderRadius: '0.4rem',
                      background: 'var(--bg-input, #1e293b)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                      fontSize: '0.8rem',
                    }}
                  />
                </div>
                <input
                  type="url"
                  placeholder="Citation URL (Optional)"
                  value={newSource2Url}
                  onChange={(e) => setNewSource2Url(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '0.4rem',
                    background: 'var(--bg-input, #1e293b)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: '0.8rem',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Register Conflict
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Immutable Conflict Verification Audit Logs */}
      {auditLogs.length > 0 && (
        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            <History size={15} color="var(--accent-main)" />
            <span>Conflict Verification Audit Trail ({auditLogs.length})</span>
          </div>

          <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {auditLogs.slice(0, 5).map((log) => (
              <div
                key={log.id}
                style={{
                  fontSize: '0.78rem',
                  padding: '0.4rem 0.65rem',
                  borderRadius: '0.4rem',
                  background: 'rgba(255, 255, 255, 0.02)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: 'var(--text-secondary)',
                }}
              >
                <span>
                  <strong>[{log.action}]</strong> {log.serviceId}: {log.notes || log.chosenValue} by {log.actor}
                </span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem' }}>
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SourceConflictReviewQueue;
