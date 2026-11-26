import { useState } from 'react';
import { CheckCircle2, XCircle, RotateCcw, UserCheck } from 'lucide-react';

export default function CleanRoomStewardQueue({
  workspaces = [],
  onApprove,
  onReject,
  onReplenish,
  metrics = null,
}) {
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [actionType, setActionType] = useState(null); // 'approve' | 'reject' | 'replenish'
  const [reasonNotes, setReasonNotes] = useState('');
  const [additionalQueries, setAdditionalQueries] = useState(30);

  const pendingList = workspaces.filter((w) => w.status === 'pending_approval');
  const activeList = workspaces.filter((w) => w.status !== 'pending_approval');

  const handleSubmitAction = (e) => {
    e.preventDefault();
    if (!selectedWorkspace || !actionType) return;

    if (actionType === 'approve') {
      onApprove(selectedWorkspace.workspaceId, {
        stewardId: 'municipal_steward_01',
        notes: reasonNotes || 'Institutional credentials verified by Data Steward',
      });
    } else if (actionType === 'reject') {
      onReject(selectedWorkspace.workspaceId, {
        stewardId: 'municipal_steward_01',
        reason: reasonNotes,
      });
    } else if (actionType === 'replenish') {
      onReplenish(selectedWorkspace.workspaceId, {
        stewardId: 'municipal_steward_01',
        additionalQueries: Number(additionalQueries) || 30,
        additionalEpsilon: Number(additionalQueries) * 0.1,
      });
    }

    setSelectedWorkspace(null);
    setActionType(null);
    setReasonNotes('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Metrics Cards */}
      {metrics && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
          }}
        >
          <div className="card" style={{ padding: '1rem', borderRadius: '0.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Workspaces</span>
            <h4 style={{ margin: '0.25rem 0', fontSize: '1.4rem' }}>{metrics.totalWorkspaces}</h4>
            <span style={{ fontSize: '0.75rem', color: '#10b981' }}>{metrics.approvedWorkspaces} Approved</span>
          </div>

          <div className="card" style={{ padding: '1rem', borderRadius: '0.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Pending Approvals</span>
            <h4 style={{ margin: '0.25rem 0', fontSize: '1.4rem', color: metrics.pendingWorkspaces > 0 ? '#f59e0b' : 'var(--text-primary)' }}>
              {metrics.pendingWorkspaces}
            </h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Action required</span>
          </div>

          <div className="card" style={{ padding: '1rem', borderRadius: '0.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Queries Executed</span>
            <h4 style={{ margin: '0.25rem 0', fontSize: '1.4rem' }}>{metrics.totalQueriesExecuted}</h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Aggregate-only</span>
          </div>

          <div className="card" style={{ padding: '1rem', borderRadius: '0.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Attacks Neutralized</span>
            <h4 style={{ margin: '0.25rem 0', fontSize: '1.4rem', color: '#3b82f6' }}>
              {metrics.blockedDifferencingAttacks + metrics.blockedThresholdViolations}
            </h4>
            <span style={{ fontSize: '0.75rem', color: '#10b981' }}>Zero PII Exposed</span>
          </div>
        </div>
      )}

      {/* Pending Approval Section */}
      <div className="card" style={{ padding: '1.25rem', borderRadius: '0.75rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <UserCheck size={18} color="#f59e0b" />
          Pending Partner Onboarding Requests ({pendingList.length})
        </h3>

        {pendingList.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            No pending partner onboarding requests. All partner workspaces are current.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {pendingList.map((ws) => (
              <div
                key={ws.workspaceId}
                style={{
                  padding: '1rem',
                  borderRadius: '0.5rem',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div>
                  <h4 style={{ margin: '0 0 0.2rem 0', fontSize: '0.95rem' }}>{ws.partnerOrg}</h4>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Contact: {ws.partnerName} ({ws.partnerEmail}) &bull; Tier: <strong>{ws.tier}</strong>
                  </p>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Datasets Requested: {ws.approvedDatasets.join(', ')}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedWorkspace(ws);
                      setActionType('approve');
                      setReasonNotes('Institutional verification confirmed.');
                    }}
                    className="btn btn-primary"
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    <CheckCircle2 size={14} /> Approve
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedWorkspace(ws);
                      setActionType('reject');
                      setReasonNotes('');
                    }}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    <XCircle size={14} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Workspaces & Budget Management */}
      <div className="card" style={{ padding: '1.25rem', borderRadius: '0.75rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>Registered Clean Room Workspaces</h3>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                <th style={{ padding: '0.6rem 0.8rem' }}>ORGANIZATION</th>
                <th style={{ padding: '0.6rem 0.8rem' }}>TIER</th>
                <th style={{ padding: '0.6rem 0.8rem' }}>STATUS</th>
                <th style={{ padding: '0.6rem 0.8rem' }}>QUERY TOKENS</th>
                <th style={{ padding: '0.6rem 0.8rem' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {activeList.map((ws) => (
                <tr key={ws.workspaceId} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '0.6rem 0.8rem', fontWeight: 500 }}>
                    <div>{ws.partnerOrg}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{ws.partnerName}</div>
                  </td>
                  <td style={{ padding: '0.6rem 0.8rem' }}>{ws.tier}</td>
                  <td style={{ padding: '0.6rem 0.8rem' }}>
                    <span
                      style={{
                        padding: '0.15rem 0.5rem',
                        borderRadius: '999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: ws.status === 'approved' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: ws.status === 'approved' ? '#10b981' : '#ef4444',
                      }}
                    >
                      {ws.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.6rem 0.8rem' }}>
                    <strong>{ws.queryBudgetRemaining}</strong> / {ws.queryBudgetTotal}
                  </td>
                  <td style={{ padding: '0.6rem 0.8rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedWorkspace(ws);
                        setActionType('replenish');
                      }}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      <RotateCcw size={12} /> Replenish
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Modal */}
      {selectedWorkspace && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '480px',
              padding: '1.5rem',
              borderRadius: '0.75rem',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
            }}
          >
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.15rem' }}>
              {actionType === 'approve'
                ? 'Approve Partner Workspace'
                : actionType === 'reject'
                ? 'Reject Partner Workspace'
                : 'Replenish Query Tokens'}
            </h3>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Partner: <strong>{selectedWorkspace.partnerOrg}</strong> ({selectedWorkspace.partnerName})
            </p>

            <form onSubmit={handleSubmitAction}>
              {actionType === 'replenish' ? (
                <div style={{ marginBottom: '1rem' }}>
                  <label htmlFor="replenish-tokens" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                    Additional Query Tokens to Allocate:
                  </label>
                  <input
                    id="replenish-tokens"
                    type="number"
                    min="10"
                    max="100"
                    value={additionalQueries}
                    onChange={(e) => setAdditionalQueries(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: '0.4rem',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-light)',
                    }}
                  />
                </div>
              ) : (
                <div style={{ marginBottom: '1rem' }}>
                  <label htmlFor="steward-notes" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                    {actionType === 'reject' ? 'Mandatory Substantive Rejection Reason:' : 'Approval Notes (Optional):'}
                  </label>
                  <textarea
                    id="steward-notes"
                    required={actionType === 'reject'}
                    minLength={actionType === 'reject' ? 10 : 0}
                    placeholder={
                      actionType === 'reject'
                        ? 'Provide specific audit reason for rejection (min 10 characters)...'
                        : 'Institutional review summary...'
                    }
                    rows={3}
                    value={reasonNotes}
                    onChange={(e) => setReasonNotes(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: '0.4rem',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-light)',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedWorkspace(null);
                    setActionType(null);
                  }}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={actionType === 'reject' ? 'btn btn-secondary' : 'btn btn-primary'}
                  style={{
                    fontSize: '0.85rem',
                    padding: '0.5rem 1rem',
                    background: actionType === 'reject' ? '#ef4444' : undefined,
                    color: actionType === 'reject' ? '#fff' : undefined,
                  }}
                >
                  Confirm {actionType}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
