/**
 * src/pages/AgentApprovalInboxWorkspace.jsx
 *
 * Accessible Civic Agent Approval Inbox and Action Simulation Mode (#1446).
 * Displays proposed tool calls, affected records, policy checks, expected side effects,
 * dry-run simulation results, and explicit approve/edit/reject controls with immutable logs.
 */

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  FileCheck2,
  Play,
  ShieldCheck,
  Sparkles,
  UserCheck,
  WifiOff,
  XCircle,
} from 'lucide-react';
import {
  ACTION_DECISION,
  ACTION_STATUS,
  verifyDecisionLogChain,
} from '../services/agentApprovalInboxService.js';
import {
  decideLocalProposal,
  loadLocalApprovalInboxState,
  runLocalDryRunSimulation,
} from '../services/agentApprovalInboxStorage.js';

export default function AgentApprovalInboxWorkspace() {
  const initial = (() => {
    try {
      const loaded = loadLocalApprovalInboxState();
      return {
        status: loaded.proposals.length === 0 ? 'empty' : 'ready',
        errorMsg: '',
        data: loaded,
        selectedId: loaded.proposals[0]?.proposalId || null,
      };
    } catch (err) {
      return {
        status: 'error',
        errorMsg: err?.message || 'Unable to load approval inbox.',
        data: null,
        selectedId: null,
      };
    }
  })();

  const [viewStatus, setViewStatus] = useState(initial.status);
  const [errorMsg, setErrorMsg] = useState(initial.errorMsg);
  const [inboxState, setInboxState] = useState(initial.data);
  const [selectedId, setSelectedId] = useState(initial.selectedId);
  const [rationale, setRationale] = useState('');
  const [editedArgsText, setEditedArgsText] = useState('');
  const [notice, setNotice] = useState('');
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine === false
  );

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    if (typeof window !== 'undefined') {
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
      }
    };
  }, []);

  const selectedProposal =
    inboxState?.proposals?.find((p) => p.proposalId === selectedId) || inboxState?.proposals?.[0] || null;

  const handleDryRun = () => {
    if (!selectedProposal) return;
    setErrorMsg('');
    try {
      const { state } = runLocalDryRunSimulation(selectedProposal.proposalId);
      setInboxState(state);
      setNotice(`Dry-run simulation completed for ${selectedProposal.proposalId} (0 external writes executed).`);
    } catch (err) {
      setErrorMsg(err?.message || 'Dry-run simulation failed.');
    }
  };

  const handleDecision = (decision) => {
    if (!selectedProposal) return;
    setErrorMsg('');
    setNotice('');
    try {
      let editedToolCalls = null;
      if (decision === ACTION_DECISION.EDIT) {
        const parsedArgs = editedArgsText.trim() ? JSON.parse(editedArgsText) : {};
        editedToolCalls = selectedProposal.toolCalls.map((tc, idx) =>
          idx === 0 ? { ...tc, args: { ...tc.args, ...parsedArgs } } : tc
        );
      }
      const { proposal, state } = decideLocalProposal(selectedProposal.proposalId, {
        actorId: 'operator-local',
        role: 'admin',
        decision,
        rationale,
        editedToolCalls,
        idempotencyKey: `ui-${selectedProposal.proposalId}-${decision}`,
      });
      setInboxState(state);
      setViewStatus('ready');
      setRationale('');
      setNotice(`Decision '${proposal.status}' recorded in immutable hash-chained log.`);
    } catch (err) {
      setErrorMsg(err?.message || 'Unable to record decision.');
    }
  };

  const chainValid = verifyDecisionLogChain(inboxState?.decisionLog || []);

  return (
    <main className="section" aria-labelledby="approval-inbox-heading">
      <div className="container" style={{ maxWidth: '1120px', margin: '0 auto' }}>
        <header className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
            <div>
              <h1 id="approval-inbox-heading" style={{ margin: 0, fontSize: '1.65rem' }}>
                Civic Agent Approval Inbox &amp; Action Simulation Mode
              </h1>
              <p style={{ marginTop: '0.4rem', opacity: 0.85 }}>
                Review proposed assistant tool calls, affected records, official policy checks, and dry-run side effects before any external write is permitted.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span className="badge" data-origin="ai_proposed_action">
                <Sparkles size={14} aria-hidden="true" /> AI Proposed Action
              </span>
              <span className="badge" data-origin="citizen_entered_fact">
                <UserCheck size={14} aria-hidden="true" /> Citizen-Entered Context
              </span>
              <span className="badge" data-origin="official_verified_policy">
                <FileCheck2 size={14} aria-hidden="true" /> Official Policy Check
              </span>
            </div>
          </div>
        </header>

        {isOffline && (
          <div role="status" aria-live="polite" className="glass-panel" style={{ padding: '0.9rem 1.2rem', marginBottom: '1rem', borderLeft: '4px solid #f59e0b', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <WifiOff size={18} aria-hidden="true" />
            <span><strong>Offline Mode:</strong> Dry-run simulations and approval decisions are persisted locally with hash-chain verification.</span>
          </div>
        )}

        {errorMsg && (
          <div role="alert" className="glass-panel" style={{ padding: '0.9rem 1.2rem', marginBottom: '1rem', borderLeft: '4px solid #ef4444', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <AlertTriangle size={18} aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
        )}

        {notice && (
          <div role="status" aria-live="polite" className="glass-panel" style={{ padding: '0.9rem 1.2rem', marginBottom: '1rem', borderLeft: '4px solid #10b981', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <CheckCircle2 size={18} aria-hidden="true" />
            <span>{notice}</span>
          </div>
        )}

        {viewStatus === 'empty' && (
          <section className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
            <h2>Approval Inbox Empty</h2>
            <p>No pending assistant action proposals require operator review.</p>
          </section>
        )}

        {viewStatus === 'ready' && inboxState && (
          <>
            <section className="glass-panel" aria-labelledby="proposals-heading" style={{ padding: '1.25rem', marginBottom: '1.25rem', overflowX: 'auto' }}>
              <h2 id="proposals-heading" style={{ marginTop: 0, fontSize: '1.15rem' }}>
                Proposed Multi-Step Actions ({inboxState.proposals.length})
              </h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <caption style={{ textAlign: 'left', marginBottom: '0.5rem', opacity: 0.8 }}>
                  Pending and decided assistant proposals with jurisdiction and write-gate status.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Proposal</th>
                    <th scope="col">Jurisdiction</th>
                    <th scope="col">Tool Calls</th>
                    <th scope="col">Status</th>
                    <th scope="col">Inspect</th>
                  </tr>
                </thead>
                <tbody>
                  {inboxState.proposals.map((p) => (
                    <tr key={p.proposalId}>
                      <th scope="row">{p.title}</th>
                      <td>{p.jurisdiction}</td>
                      <td>{p.toolCalls.length}</td>
                      <td>{p.status}</td>
                      <td>
                        <button type="button" className="btn" onClick={() => setSelectedId(p.proposalId)}>
                          Select
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {selectedProposal && (
              <section className="glass-panel" aria-labelledby="simulation-heading" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h2 id="simulation-heading" style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <ShieldCheck size={18} aria-hidden="true" />
                    Dry-Run Simulation &amp; Policy Checks: {selectedProposal.title}
                  </h2>
                  <button type="button" className="btn" onClick={handleDryRun} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Play size={14} aria-hidden="true" /> Re-run Dry-Run
                  </button>
                </div>

                <p style={{ marginTop: '0.5rem' }}>{selectedProposal.summary}</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginTop: '0.75rem' }}>
                  <div>
                    <h3 style={{ fontSize: '0.95rem' }}>Proposed Tool Calls</h3>
                    <ul>
                      {selectedProposal.toolCalls.map((tc, i) => (
                        <li key={i}>
                          <code>{tc.toolName}</code> ({tc.operationType}) → <code>{tc.targetEndpoint}</code>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 style={{ fontSize: '0.95rem' }}>Affected Records</h3>
                    <ul>
                      {selectedProposal.affectedRecords.map((rec, i) => (
                        <li key={i}>
                          <strong>{rec.recordType}</strong> ({rec.recordId}): {rec.changeSummary}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 style={{ fontSize: '0.95rem' }}>Policy Checks &amp; Dry-Run Result</h3>
                    <ul>
                      {selectedProposal.simulation?.policyChecks?.map((chk) => (
                        <li key={chk.id}>
                          <strong>{chk.name}:</strong> {chk.passed ? 'PASS' : 'FAIL'} — {chk.detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {selectedProposal.status === ACTION_STATUS.PENDING_APPROVAL && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(148,163,184,0.25)' }}>
                    <div style={{ display: 'grid', gap: '0.65rem', marginBottom: '0.75rem' }}>
                      <div>
                        <label htmlFor="apr-rationale" style={{ display: 'block', fontWeight: 600 }}>
                          Operator Decision Rationale (Required for Reject)
                        </label>
                        <input
                          id="apr-rationale"
                          value={rationale}
                          onChange={(e) => setRationale(e.target.value)}
                          placeholder="Enter approval or rejection rationale..."
                          style={{ width: '100%', padding: '0.45rem' }}
                        />
                      </div>
                      <div>
                        <label htmlFor="apr-edit-args" style={{ display: 'block', fontWeight: 600 }}>
                          Optional JSON Overrides for Edit &amp; Approve
                        </label>
                        <input
                          id="apr-edit-args"
                          value={editedArgsText}
                          onChange={(e) => setEditedArgsText(e.target.value)}
                          placeholder='e.g. {"shopId": "FPS-205"}'
                          style={{ width: '100%', padding: '0.45rem' }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button type="button" className="btn btn-primary" onClick={() => handleDecision(ACTION_DECISION.APPROVE)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <CheckCircle2 size={15} aria-hidden="true" /> Approve Write
                      </button>
                      <button type="button" className="btn" onClick={() => handleDecision(ACTION_DECISION.EDIT)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Edit3 size={15} aria-hidden="true" /> Edit &amp; Approve
                      </button>
                      <button type="button" className="btn" onClick={() => handleDecision(ACTION_DECISION.REJECT)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <XCircle size={15} aria-hidden="true" /> Reject
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}

            <section className="glass-panel" aria-labelledby="decision-log-heading" style={{ padding: '1.25rem' }}>
              <h2 id="decision-log-heading" style={{ marginTop: 0, fontSize: '1.1rem' }}>
                Immutable Decision Log ({inboxState.decisionLog.length}) — Chain Integrity: {chainValid ? 'VERIFIED' : 'INVALID'}
              </h2>
              {inboxState.decisionLog.length === 0 ? (
                <p style={{ marginBottom: 0 }}>No operator decisions recorded yet.</p>
              ) : (
                <ul style={{ marginBottom: 0 }}>
                  {inboxState.decisionLog.map((entry) => (
                    <li key={entry.id}>
                      <code>{entry.hash}</code> — {entry.proposalId}: <strong>{entry.status}</strong> by {entry.operatorId} ({entry.decidedAt})
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
