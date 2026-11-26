import { useState, useMemo } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Edit3,
  GitBranch,
  ExternalLink,
  FileText,
  Clock,
} from 'lucide-react';
import {
  createReviewStudioStore,
  REVIEW_STATUS,
  REVIEW_DECISION,
} from '../../services/agentReviewStudioService.js';
import {
  SYNTHETIC_PROPOSAL_BIRTH_FEE,
  SYNTHETIC_PROPOSAL_PASSPORT_CONFLICT,
} from '../../test/fixtures/agentReviewFixtures.js';
import { useToast } from '../../context/ToastContext.jsx';

const STATUS_BADGE = {
  [REVIEW_STATUS.PENDING_REVIEW]: { label: 'Pending Review', bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' },
  [REVIEW_STATUS.APPROVED]: { label: 'Approved (Locked)', bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981' },
  [REVIEW_STATUS.EDITED_APPROVED]: { label: 'Edited & Approved (Locked)', bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981' },
  [REVIEW_STATUS.REJECTED]: { label: 'Rejected', bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' },
  [REVIEW_STATUS.ESCALATED]: { label: 'Escalated', bg: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6' },
  [REVIEW_STATUS.SUPERSEDED]: { label: 'Superseded', bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' },
};

const RISK_LABEL = {
  HIGH_RISK_FEE: 'High-Risk: Fee',
  HIGH_RISK_DEADLINE: 'High-Risk: Deadline',
  HIGH_RISK_PENALTY_LEGAL: 'High-Risk: Legal/Penalty',
  GENERAL_FACT: 'General Fact',
};

const AgentReviewStudioPanel = () => {
  const { toast } = useToast();
  const store = useMemo(() => createReviewStudioStore(), []);

  const loadInitial = () => {
    try {
      const existing = store.listItems();
      if (existing.length > 0) return existing;
      // Seed synthetic fixtures when queue is empty so reviewers have inspectable items
      store.submitProposal({ ...SYNTHETIC_PROPOSAL_PASSPORT_CONFLICT, idempotencyKey: 'seed-passport-1' });
      store.submitProposal({ ...SYNTHETIC_PROPOSAL_BIRTH_FEE, idempotencyKey: 'seed-birth-1' });
      return store.listItems();
    } catch {
      return [];
    }
  };

  const [items, setItems] = useState(loadInitial);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(() => items[0]?.id || null);
  const [decision, setDecision] = useState(REVIEW_DECISION.APPROVE);
  const [rationale, setRationale] = useState('');
  const [editedClaimsMap, setEditedClaimsMap] = useState({});
  const [forkRationale, setForkRationale] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [statusAnnouncement, setStatusAnnouncement] = useState('');

  const refreshItems = (focusId = null) => {
    try {
      const next = store.listItems();
      setItems(next);
      if (focusId) setSelectedId(focusId);
    } catch (err) {
      setErrorMsg(err.message || 'Unable to load review items.');
    }
  };

  const filteredItems = useMemo(() => {
    if (statusFilter === 'all') return items;
    return items.filter((item) => item.status === statusFilter);
  }, [items, statusFilter]);

  const activeItem = useMemo(
    () => items.find((item) => item.id === selectedId) || filteredItems[0] || null,
    [items, filteredItems, selectedId]
  );

  const metrics = useMemo(() => {
    try {
      void items;
      return store.getMetrics();
    } catch {
      return { total: 0, pending: 0, approved: 0, editedApproved: 0, rejected: 0, escalated: 0, avgConfidence: 0 };
    }
  }, [items, store]);

  const isLockedApproved =
    activeItem &&
    (activeItem.status === REVIEW_STATUS.APPROVED || activeItem.status === REVIEW_STATUS.EDITED_APPROVED);

  const handleSelectItem = (item) => {
    setSelectedId(item.id);
    setErrorMsg('');
    setRationale('');
    setForkRationale('');
    const map = {};
    for (const c of item.claims || []) map[c.id] = c.text;
    setEditedClaimsMap(map);
  };

  const handleClaimEditChange = (claimId, newText) => {
    setEditedClaimsMap((prev) => ({ ...prev, [claimId]: newText }));
  };

  const handleSubmitDecision = (e) => {
    e.preventDefault();
    if (!activeItem) return;
    setErrorMsg('');

    try {
      const editedClaims =
        decision === REVIEW_DECISION.EDIT
          ? activeItem.claims.map((c) => ({
              ...c,
              text: editedClaimsMap[c.id] ?? c.text,
            }))
          : undefined;

      const updated = store.submitDecision(activeItem.id, {
        decision,
        expectedVersion: activeItem.version,
        rationale,
        editedClaims,
        idempotencyKey: `ui-${activeItem.id}-v${activeItem.version}-${decision}`,
      });

      setRationale('');
      setStatusAnnouncement(`Recorded ${decision} for ${updated.title} (v${updated.version}).`);
      toast?.success?.(`Decision "${decision}" saved (v${updated.version}).`);
      refreshItems(updated.id);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to record review decision.');
      toast?.error?.(err.message || 'Failed to record review decision.');
    }
  };

  const handleForkNewVersion = () => {
    if (!activeItem) return;
    setErrorMsg('');
    try {
      const forked = store.forkNewVersion(activeItem.id, { rationale: forkRationale });
      setForkRationale('');
      setStatusAnnouncement(`Forked new version v${forked.version} for re-review.`);
      toast?.info?.(`Created v${forked.version} in pending review.`);
      refreshItems(forked.id);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to fork new version.');
    }
  };

  return (
    <section aria-labelledby="review-studio-heading" className="glass-panel" style={{ padding: '1.5rem', borderRadius: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h2 id="review-studio-heading" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={22} color="var(--accent-main)" />
            Human-in-the-Loop Agent Review Studio
          </h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Inspect AI-generated claims beside verified source passages. Approved outputs are immutable; changes require a version fork.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span className="badge" style={{ padding: '0.35rem 0.7rem', borderRadius: '99px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontWeight: 700, fontSize: '0.8rem' }}>
            Pending: {metrics.pending}
          </span>
          <span className="badge" style={{ padding: '0.35rem 0.7rem', borderRadius: '99px', background: 'rgba(16,185,129,0.15)', color: '#10b981', fontWeight: 700, fontSize: '0.8rem' }}>
            Approved: {metrics.approved + metrics.editedApproved}
          </span>
          <span className="badge" style={{ padding: '0.35rem 0.7rem', borderRadius: '99px', background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', fontWeight: 700, fontSize: '0.8rem' }}>
            Escalated: {metrics.escalated}
          </span>
          <span className="badge" style={{ padding: '0.35rem 0.7rem', borderRadius: '99px', background: 'var(--glass-bg)', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.8rem' }}>
            Avg Confidence: {Math.round((metrics.avgConfidence || 0) * 100)}%
          </span>
        </div>
      </div>

      <div aria-live="polite" style={{ position: 'absolute', left: '-9999px' }}>
        {statusAnnouncement}
      </div>

      {errorMsg && (
        <div role="alert" style={{ padding: '0.75rem 1rem', borderRadius: '0.5rem', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)', color: '#ef4444', marginBottom: '1rem', fontSize: '0.875rem' }}>
          {errorMsg}
        </div>
      )}

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {[
          { id: 'all', label: 'All' },
          { id: REVIEW_STATUS.PENDING_REVIEW, label: 'Pending' },
          { id: REVIEW_STATUS.ESCALATED, label: 'Escalated' },
          { id: REVIEW_STATUS.APPROVED, label: 'Approved' },
          { id: REVIEW_STATUS.EDITED_APPROVED, label: 'Edited & Approved' },
          { id: REVIEW_STATUS.REJECTED, label: 'Rejected' },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setStatusFilter(f.id)}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-light)',
              background: statusFilter === f.id ? 'var(--accent-main)' : 'transparent',
              color: statusFilter === f.id ? '#fff' : 'var(--text-secondary)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) minmax(0, 2.2fr)', gap: '1.25rem', alignItems: 'start' }}>
        {/* Queue List */}
        <div role="list" aria-label="Agent review queue" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {filteredItems.length === 0 ? (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>No review items match the selected filter.</p>
          ) : (
            filteredItems.map((item) => {
              const badge = STATUS_BADGE[item.status] || STATUS_BADGE[REVIEW_STATUS.PENDING_REVIEW];
              const isSelected = activeItem?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectItem(item)}
                  aria-current={isSelected ? 'true' : undefined}
                  style={{
                    textAlign: 'left',
                    padding: '0.85rem',
                    borderRadius: '0.75rem',
                    border: isSelected ? '2px solid var(--accent-main)' : '1px solid var(--border-light)',
                    background: isSelected ? 'rgba(56, 189, 248, 0.08)' : 'var(--bg-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '99px', background: badge.bg, color: badge.color }}>
                      {badge.label}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>v{item.version}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>{item.title}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Confidence: {Math.round((item.confidenceScore || 0) * 100)}% • {item.claims?.length || 0} claim(s)
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Side-by-Side Inspector */}
        {activeItem && (
          <div style={{ border: '1px solid var(--border-light)', borderRadius: '0.85rem', padding: '1.25rem', background: 'var(--bg-secondary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.9rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>{activeItem.title}</h3>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Query: &ldquo;{activeItem.query}&rdquo;
                </p>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'right' }}>
                <div>Agent: <code>{activeItem.provenance?.agentId}</code> ({activeItem.provenance?.modelId})</div>
                <div>Prompt: <code>{activeItem.provenance?.promptVersion}</code> • Contract: <code>{activeItem.contractVersion}</code></div>
              </div>
            </div>

            {/* Side-by-Side Claims & Source Passages */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <h4 style={{ margin: '0 0 0.6rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>
                  Generated Claims
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {(activeItem.claims || []).map((claim) => (
                    <div key={claim.id} style={{ padding: '0.75rem', borderRadius: '0.6rem', border: '1px solid var(--border-light)', background: 'var(--bg-primary)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#f59e0b' }}>
                          {RISK_LABEL[claim.riskCategory] || claim.riskCategory}
                        </span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: claim.entailmentStatus === 'SUPPORTED' ? '#10b981' : '#ef4444' }}>
                          {claim.entailmentStatus}
                        </span>
                      </div>
                      {decision === REVIEW_DECISION.EDIT && !isLockedApproved ? (
                        <textarea
                          aria-label={`Edit claim ${claim.id}`}
                          value={editedClaimsMap[claim.id] ?? claim.text}
                          onChange={(e) => handleClaimEditChange(claim.id, e.target.value)}
                          rows={3}
                          style={{ width: '100%', padding: '0.45rem', borderRadius: '0.4rem', border: '1px solid var(--border-light)', fontSize: '0.84rem' }}
                        />
                      ) : (
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{claim.text}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 style={{ margin: '0 0 0.6rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>
                  Source Passages & Provenance
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {(activeItem.sourcePassages || []).map((passage) => (
                    <div key={passage.chunkId} style={{ padding: '0.75rem', borderRadius: '0.6rem', border: '1px solid var(--border-light)', background: 'var(--bg-primary)' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-main)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <FileText size={14} /> {passage.sectionTitle}
                      </div>
                      <p style={{ margin: '0 0 0.45rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{passage.excerpt}</p>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
                        <a href={passage.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-main)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          {passage.sourceName} <ExternalLink size={11} />
                        </a>
                        {passage.lastVerified && <span>Verified: {passage.lastVerified}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Decision Form OR Locked Approved Fork Control */}
            {isLockedApproved ? (
              <div style={{ padding: '1rem', borderRadius: '0.75rem', border: '1px solid rgba(16, 185, 129, 0.35)', background: 'rgba(16, 185, 129, 0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: '#10b981', marginBottom: '0.4rem' }}>
                  <CheckCircle2 size={18} /> Output Approved & Locked (Silent Regeneration Prohibited)
                </div>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  To update or regenerate this guidance, fork a new pending version for fresh human review.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <label htmlFor="fork-rationale-input" className="sr-only">Fork rationale</label>
                  <input
                    id="fork-rationale-input"
                    type="text"
                    placeholder="Reason for forking a new version (min 8 chars)..."
                    value={forkRationale}
                    onChange={(e) => setForkRationale(e.target.value)}
                    style={{ flex: '1 1 240px', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)' }}
                  />
                  <button
                    type="button"
                    onClick={handleForkNewVersion}
                    className="btn btn-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', fontSize: '0.85rem' }}
                  >
                    <GitBranch size={15} /> Fork New Version
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitDecision} style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
                <fieldset style={{ border: 'none', padding: 0, margin: '0 0 0.85rem' }}>
                  <legend style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>Reviewer Decision</legend>
                  <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                    {[
                      { val: REVIEW_DECISION.APPROVE, label: 'Approve', icon: CheckCircle2 },
                      { val: REVIEW_DECISION.EDIT, label: 'Edit & Approve', icon: Edit3 },
                      { val: REVIEW_DECISION.ESCALATE, label: 'Escalate', icon: AlertTriangle },
                      { val: REVIEW_DECISION.REJECT, label: 'Reject', icon: XCircle },
                    ].map(({ val, label, icon: Icon }) => (
                      <label
                        key={val}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.45rem 0.85rem',
                          borderRadius: '0.5rem',
                          border: decision === val ? '2px solid var(--accent-main)' : '1px solid var(--border-light)',
                          cursor: 'pointer',
                          fontSize: '0.84rem',
                          fontWeight: 600,
                        }}
                      >
                        <input
                          type="radio"
                          name="review-decision"
                          value={val}
                          checked={decision === val}
                          onChange={() => setDecision(val)}
                        />
                        <Icon size={15} /> {label}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div style={{ marginBottom: '0.85rem' }}>
                  <label htmlFor="reviewer-rationale" style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Reviewer Rationale (Required, min 8 characters)
                  </label>
                  <textarea
                    id="reviewer-rationale"
                    rows={2}
                    required
                    value={rationale}
                    onChange={(e) => setRationale(e.target.value)}
                    placeholder="Document verification basis against official portal or reason for rejection/escalation..."
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', fontSize: '0.86rem' }}
                  />
                </div>

                <button type="submit" className="btn btn-primary" style={{ padding: '0.55rem 1.2rem', fontSize: '0.875rem', fontWeight: 700 }}>
                  Record Decision (v{activeItem.version})
                </button>
              </form>
            )}

            {/* Decision History */}
            {activeItem.decisionHistory?.length > 0 && (
              <div style={{ marginTop: '1.1rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.85rem' }}>
                <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Clock size={14} /> Version & Decision Audit Trail
                </h4>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {activeItem.decisionHistory.map((h, i) => (
                    <li key={i} style={{ marginBottom: '0.25rem' }}>
                      <strong>{h.decision.toUpperCase()}</strong> (v{h.fromVersion} → v{h.toVersion}) by {h.reviewer}: &ldquo;{h.rationale}&rdquo;
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default AgentReviewStudioPanel;
