import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, RotateCcw, AlertOctagon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { createWorkflowClient } from '../../services/workflowClient';

export default function WorkflowDeadLetterPanel() {
  const { getToken } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadDlq = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const client = createWorkflowClient({ getToken });
      const res = await client.listDeadLetters();
      setItems(res.items || []);
    } catch (err) {
      setError(err.message || 'Unable to load dead-letter queue.');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    let active = true;
    const client = createWorkflowClient({ getToken });
    client.listDeadLetters()
      .then((res) => {
        if (active) setItems(res.items || []);
      })
      .catch((err) => {
        if (active) setError(err.message || 'Unable to load dead-letter queue.');
      });
    return () => {
      active = false;
    };
  }, [getToken]);

  async function handleReplay(workflowId) {
    setError('');
    setMessage('');
    try {
      const client = createWorkflowClient({ getToken });
      await client.replayDeadLetter({ workflowId });
      setMessage(`Replayed workflow ${workflowId} from checkpoint.`);
      await loadDlq();
    } catch (err) {
      setError(err.message || 'Replay failed.');
    }
  }

  return (
    <section
      aria-labelledby="dlq-heading"
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 id="dlq-heading" className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
          <AlertOctagon className="h-4 w-4 text-rose-600" aria-hidden="true" />
          Durable Workflow Dead-Letter Queue
        </h3>
        <button
          type="button"
          onClick={loadDlq}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Refresh
        </button>
      </div>

      <div aria-live="polite" className="mt-2 text-xs">
        {message && <p className="text-emerald-700 dark:text-emerald-400">{message}</p>}
        {error && <p role="alert" className="text-red-700 dark:text-red-400">{error}</p>}
      </div>

      {items.length === 0 ? (
        <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">
          No open dead-lettered agent workflows.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li
              key={item.workflowId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-2.5 text-xs dark:border-slate-700"
            >
              <div>
                <p className="font-mono font-medium text-slate-900 dark:text-slate-100">
                  {item.workflowId} — {item.errorCode}
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  Seq #{item.failedSequence} | Retries: {item.retryCount} | {item.sanitizedReason}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleReplay(item.workflowId)}
                className="inline-flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Replay from Checkpoint
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
