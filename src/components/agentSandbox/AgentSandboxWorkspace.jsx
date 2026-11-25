/**
 * src/components/agentSandbox/AgentSandboxWorkspace.jsx
 *
 * Main container for the Secure Agent Sandbox. Wires tool selection, sandbox
 * run (via API), results and scan report. Accessible, mobile-first; no PII is
 * collected or logged.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  AgentSandboxLoading,
  AgentSandboxEmpty,
  AgentSandboxError,
  AgentSandboxBlocked
} from './AgentSandboxStates';
import { ToolSelector } from './ToolSelector';
import { SandboxResults } from './SandboxResults';
import { listPolicies, listTools } from '../../data/civicAgentSandboxData.js';
import { SANDBOX_ERRORS } from '../../services/civicAgentSandboxService.js';

const API_BASE = '/api/agent-sandbox';

export default function AgentSandboxWorkspace() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const role = user?.role || 'guest';

  const [catalogue, setCatalogue] = useState(null);
  const [catalogueError, setCatalogueError] = useState(null);

  const defaultToolId = useMemo(() => {
    const pdf = listTools().find((t) => t.id === 'tool-pdf-text-extractor');
    return pdf ? pdf.id : listTools()[0]?.id || null;
  }, []);

  const defaultPolicyId = useMemo(() => {
    const strict = listPolicies().find((p) => p.id === 'policy-strict-default');
    return strict ? strict.id : listPolicies()[0]?.id || null;
  }, []);

  const [parameters, setParameters] = useState(() => {
    const strict = listPolicies().find((p) => p.id === 'policy-strict-default');
    return {
      toolId: defaultToolId,
      policyId: strict ? strict.id : defaultPolicyId,
      documentId: null,
      inputData: '',
      networkAllowed: false,
      humanApproved: false
    };
  });

  const [result, setResult] = useState(null);
  const [runError, setRunError] = useState(null);
  const [running, setRunning] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const abortRef = useRef(null);

  // Load the public catalogue on mount.
  const loadCatalogue = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}?action=catalogue`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load catalogue');
      const data = await res.json();
      setCatalogue(data.ok ? data : null);
      if (!data.ok) setCatalogueError(data.error || 'Unknown catalogue error');
    } catch (error) {
      setCatalogueError(error.message);
    }
  }, []);

  const handleParametersChange = useCallback((next) => {
    setParameters(next);
    setResult(null);
    setRunError(null);
    setBlocked(false);
  }, []);

  const runSandbox = useCallback(async () => {
    if (!parameters.toolId) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setRunning(true);
    setRunError(null);
    setBlocked(false);

    try {
      const res = await fetch(`${API_BASE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run', ...parameters }),
        signal: controller.signal
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err.blocked || err.error === SANDBOX_ERRORS.THREAT_DETECTED) {
          setBlocked(true);
          setRunError(err.error || err.message || 'Run blocked by sandbox policy.');
          return;
        }
        throw new Error(err.error || err.message || 'Sandbox run failed');
      }
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Sandbox returned no result');
      setResult(data);
    } catch (error) {
      if (error.name === 'AbortError') return;
      setRunError(error.message);
      addToast({ type: 'error', message: error.message });
    } finally {
      setRunning(false);
    }
  }, [parameters, addToast]);

  const handleSave = useCallback(async () => {
    if (role === 'guest') {
      addToast({ type: 'info', message: 'Sign in to save a sandbox run record.' });
      return;
    }
    if (!result) return;
    try {
      const res = await fetch(`${API_BASE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save-run',
          runId: result.run.runId,
          toolId: result.run.toolId,
          policyId: result.run.policyId,
          status: result.run.status,
          summary: `Sandbox run for ${result.run.toolName}`
        })
      });
      if (!res.ok) throw new Error('Save failed');
      const data = await res.json();
      if (data.ok) addToast({ type: 'success', message: 'Sandbox run record saved.' });
    } catch (error) {
      addToast({ type: 'error', message: error.message });
    }
  }, [result, role, addToast]);

  // Render states
  if (catalogue === null && !catalogueError) {
    return <AgentSandboxLoading />;
  }
  if (catalogueError) {
    return <AgentSandboxError message={catalogueError} onRetry={loadCatalogue} />;
  }
  if (!parameters.toolId) {
    return <AgentSandboxEmpty />;
  }
  if (running) {
    return <AgentSandboxLoading />;
  }
  if (blocked) {
    return <AgentSandboxBlocked threats={runError ? [{ threatName: 'Blocked', severity: 'high', description: runError }] : null} onRetry={runSandbox} />;
  }
  if (runError) {
    return <AgentSandboxError message={runError} onRetry={runSandbox} />;
  }

  return (
    <section className="agent-sandbox-workspace" aria-label="Secure agent sandbox for untrusted civic document processing">
      <div className="container">
        <header className="workspace-header">
          <h1 className="workspace-title">Secure Agent Sandbox</h1>
          <p className="workspace-subtitle">
            Run untrusted civic document parsers in isolated workers with CPU,
            memory and time limits. Network disabled by default; output is
            validated and reviewed before any civic action.
          </p>
        </header>

        <div className="workspace-body">
          <aside className="workspace-sidebar">
            <ToolSelector
              policies={catalogue.policies}
              tools={catalogue.tools}
              documents={catalogue.documents}
              onParametersChange={handleParametersChange}
              defaultToolId={defaultToolId}
              defaultPolicyId={defaultPolicyId}
            />
            {result && (
              <div className="sidebar-actions">
                <button
                  className="btn btn-outline"
                  type="button"
                  onClick={handleSave}
                  disabled={role === 'guest'}
                  title={role === 'guest' ? 'Sign in to save' : 'Save this sandbox run record'}
                >
                  Save run record
                </button>
              </div>
            )}
          </aside>

          <main className="workspace-main">
            {result ? <SandboxResults result={result} /> : <AgentSandboxEmpty />}
          </main>
        </div>

        <footer className="workspace-footer">
          <p className="workspace-disclaimer">
            Sandbox output is illustrative and untrusted. Parser results must be
            validated and reviewed by a human before any civic action. The sandbox
            never executes embedded scripts, never accesses the network by default,
            and never reveals citizen records or credentials.
          </p>
        </footer>
      </div>
    </section>
  );
}
