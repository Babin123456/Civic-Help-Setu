import { useState } from 'react';
import { CheckCircle2, Clock, AlertTriangle, Play, ShieldAlert, Trash2, XCircle } from 'lucide-react';
import { ALLOWED_WORKFLOW_TYPES, WORKFLOW_STATUS } from '../../workflows/workflowContracts';
import { createWorkflowClient } from '../../services/workflowClient';
import { useAuth } from '../../context/AuthContext';

const STATUS_LABEL = {
  [WORKFLOW_STATUS.RUNNING]: 'Running',
  [WORKFLOW_STATUS.AWAITING_HUMAN_APPROVAL]: 'Awaiting Human Approval',
  [WORKFLOW_STATUS.COMPLETED]: 'Completed',
  [WORKFLOW_STATUS.DEAD_LETTERED]: 'Dead-Lettered (Needs Operator)',
  [WORKFLOW_STATUS.CANCELLED]: 'Rejected / Cancelled',
};

export default function DurableWorkflowPanel({ serviceId = null }) {
  const { getToken, isSignedIn } = useAuth();
  const [workflowType, setWorkflowType] = useState(ALLOWED_WORKFLOW_TYPES[0]);
  const [query, setQuery] = useState('');
  const [activeState, setActiveState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [approvalNote, setApprovalNote] = useState('');

  const client = createWorkflowClient({ getToken });

  async function handleStart(e) {
    e.preventDefault();
    if (!query.trim() || busy) return;
    setBusy(true);
    setErrorMessage('');
    setStatusMessage('Starting durable workflow...');
    try {
      const started = await client.startWorkflow({ workflowType, query: query.trim(), serviceId });
      setActiveState(started.state);
      const advanced = await client.advanceWorkflow({
        workflowId: started.state.workflowId,
        expectedSequence: started.state.lastSequence,
      });
      setActiveState(advanced.state);
      setStatusMessage('Workflow step recorded. Human review required before completion.');
    } catch (err) {
      setErrorMessage(err.message || 'Unable to start durable workflow.');
      setStatusMessage('');
    } finally {
      setBusy(false);
    }
  }

  async function handleRetryStep() {
    if (!activeState || busy) return;
    setBusy(true);
    setErrorMessage('');
    try {
      const res = await client.advanceWorkflow({
        workflowId: activeState.workflowId,
        expectedSequence: activeState.lastSequence,
      });
      setActiveState(res.state);
      setStatusMessage('Workflow resumed from last committed sequence.');
    } catch (err) {
      setErrorMessage(err.message || 'Retry failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleApproval(decision) {
    if (!activeState || busy) return;
    setBusy(true);
    setErrorMessage('');
    try {
      const res = await client.approveWorkflow({
        workflowId: activeState.workflowId,
        expectedSequence: activeState.lastSequence,
        decision,
        note: approvalNote,
      });
      setActiveState(res.state);
      setApprovalNote('');
      setStatusMessage(
        decision === 'approved'
          ? 'Proposal approved and workflow completed.'
          : 'Proposal rejected and workflow cancelled.'
      );
    } catch (err) {
      setErrorMessage(err.message || 'Could not record approval decision.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePurge() {
    if (!activeState || busy) return;
    setBusy(true);
    setErrorMessage('');
    try {
      await client.deleteWorkflow(activeState.workflowId);
      setActiveState(null);
      setStatusMessage('Workflow deleted in accordance with retention controls.');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to delete workflow.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="durable-workflow-heading"
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="durable-workflow-heading" className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Durable Civic Agent Workflow (Event-Sourced)
        </h2>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
          Human Approval Required
        </span>
      </div>

      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
        AI proposals are untrusted drafts grounded in verified catalogue entries. They do not file applications or issue official government decisions.
      </p>

      {!isSignedIn && (
        <p className="mt-3 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Sign in to persist and resume durable workflows across sessions.
        </p>
      )}

      <form onSubmit={handleStart} className="mt-3 space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="wf-type-select">Workflow type</label>
          <select
            id="wf-type-select"
            value={workflowType}
            onChange={(e) => setWorkflowType(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="service_readiness_check">Service Readiness Check</option>
            <option value="document_checklist_review">Document Checklist Review</option>
            <option value="grievance_draft_prep">Grievance Draft Preparation</option>
          </select>

          <label className="sr-only" htmlFor="wf-query-input">Describe your civic task</label>
          <input
            id="wf-query-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Describe your civic workflow goal (no Aadhaar/PAN/phone)..."
            maxLength={2000}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />

          <button
            type="submit"
            disabled={busy || !isSignedIn || !query.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            Start Run
          </button>
        </div>
      </form>

      <div aria-live="polite" className="mt-2 min-h-[1.25rem] text-xs">
        {statusMessage && <p className="text-emerald-700 dark:text-emerald-400">{statusMessage}</p>}
        {errorMessage && (
          <p role="alert" className="flex items-center gap-1 text-red-700 dark:text-red-400">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            {errorMessage}
          </p>
        )}
      </div>

      {activeState && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-mono text-slate-700 dark:text-slate-300">
              Run: {activeState.workflowId} (seq #{activeState.lastSequence})
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 font-medium text-slate-800 shadow-xs dark:bg-slate-900 dark:text-slate-200">
              {activeState.status === WORKFLOW_STATUS.COMPLETED ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              ) : (
                <Clock className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
              )}
              {STATUS_LABEL[activeState.status] || activeState.status}
            </span>
          </div>

          {activeState.pendingProposal && (
            <div className="mt-2 rounded border border-slate-200 bg-white p-2.5 text-xs dark:border-slate-700 dark:bg-slate-900">
              <p className="font-medium text-slate-900 dark:text-slate-100">Proposed Guidance (Untrusted Draft):</p>
              <p className="mt-1 text-slate-700 dark:text-slate-300">{activeState.pendingProposal.summary}</p>
              {activeState.pendingProposal.citations?.length > 0 && (
                <ul className="mt-1.5 list-disc pl-4 text-slate-600 dark:text-slate-400">
                  {activeState.pendingProposal.citations.map((c, idx) => (
                    <li key={c.id || idx}>
                      {c.title} {c.url ? `(${c.url})` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeState.status === WORKFLOW_STATUS.AWAITING_HUMAN_APPROVAL && (
            <div className="mt-3 space-y-2">
              <label htmlFor="wf-approval-note" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Reviewer Note (optional)
              </label>
              <input
                id="wf-approval-note"
                type="text"
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                maxLength={500}
                placeholder="Record verification note..."
                className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleApproval('approved')}
                  className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Approve Draft
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleApproval('rejected')}
                  className="inline-flex items-center gap-1 rounded bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  Reject Draft
                </button>
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            {activeState.status === WORKFLOW_STATUS.RUNNING && (
              <button
                type="button"
                disabled={busy}
                onClick={handleRetryStep}
                className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              >
                Resume / Retry Step
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={handlePurge}
              className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Delete Run
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
