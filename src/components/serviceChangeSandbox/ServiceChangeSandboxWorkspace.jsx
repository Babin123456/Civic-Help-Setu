/**
 * src/components/serviceChangeSandbox/ServiceChangeSandboxWorkspace.jsx
 *
 * Main container for the Civic Service Change Sandbox with Shadow Traffic
 * Evaluation. Wires snapshot selection, shadow-traffic run (via API), results
 * and comparison report. Accessible, mobile-first; no PII is collected or
 * logged.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  ServiceChangeLoading,
  ServiceChangeEmpty,
  ServiceChangeError,
  ServiceChangeBlocked
} from './ServiceChangeStates';
import { SnapshotSelector } from './SnapshotSelector';
import { ComparisonResults } from './ComparisonResults';
import { listStagingSnapshots, listSyntheticJourneyPatterns } from '../../data/civicServiceChangeSandboxData.js';
import { SERVICE_CHANGE_ERRORS } from '../../services/civicServiceChangeSandboxService.js';

const API_BASE = '/api/service-change-sandbox';

export default function ServiceChangeSandboxWorkspace() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const role = user?.role || 'guest';

  const [catalogue, setCatalogue] = useState(null);
  const [catalogueError, setCatalogueError] = useState(null);

  const [parameters, setParameters] = useState(() => {
    const snapshots = listStagingSnapshots();
    const defaultSnap = snapshots.find((s) => s.id === 'snapshot-income-certificate-v2-rollout') || snapshots[0] || null;
    const patterns = listSyntheticJourneyPatterns().filter(
      (p) => p.serviceId === (defaultSnap?.serviceId || '')
    );
    return {
      snapshotId: defaultSnap ? defaultSnap.id : null,
      journeyPatternIds: patterns.length > 0 ? patterns.map((p) => p.id) : [],
      replayCount: 1000,
      seed: defaultSnap?.deterministicSeed ?? null
    };
  });

  const [result, setResult] = useState(null);
  const [runError, setRunError] = useState(null);
  const [running, setRunning] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const abortRef = useRef(null);

  const defaultSnapshotId = useMemo(() => {
    const reviewing = listStagingSnapshots().find((s) => s.id === 'snapshot-income-certificate-v2-rollout');
    return reviewing ? reviewing.id : listStagingSnapshots()[0]?.id || null;
  }, []);

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

  const runShadowTraffic = useCallback(async () => {
    if (!parameters.snapshotId) return;
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
        if (err.blocked || err.error === SERVICE_CHANGE_ERRORS.PRODUCTION_WRITE_BLOCKED) {
          setBlocked(true);
          setRunError(err.error || err.message || 'Production writes are blocked during an active shadow run.');
          return;
        }
        throw new Error(err.error || err.message || 'Shadow traffic run failed');
      }
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Shadow traffic returned no result');
      setResult(data.run);
    } catch (error) {
      if (error.name === 'AbortError') return;
      setRunError(error.message);
      addToast({ type: 'error', message: error.message });
    } finally {
      setRunning(false);
    }
  }, [parameters, addToast]);

  const handlePublish = useCallback(async () => {
    if (role === 'guest') {
      addToast({ type: 'info', message: 'Sign in to publish a snapshot.' });
      return;
    }
    if (!parameters.snapshotId) return;
    try {
      const res = await fetch(`${API_BASE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish-snapshot', snapshotId: parameters.snapshotId, humanApproved: true })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err.blocked || err.error === SERVICE_CHANGE_ERRORS.PRODUCTION_WRITE_BLOCKED) {
          setBlocked(true);
          setRunError(err.error || err.message || 'Production writes are blocked during an active shadow run.');
          return;
        }
        throw new Error(err.error || err.message || 'Publish failed');
      }
      addToast({ type: 'success', message: 'Snapshot published to production.' });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setRunError(error.message);
      addToast({ type: 'error', message: error.message });
    }
  }, [parameters.snapshotId, role, addToast]);

  const handleRollback = useCallback(async () => {
    if (role === 'guest') {
      addToast({ type: 'info', message: 'Sign in to roll back a snapshot.' });
      return;
    }
    if (!parameters.snapshotId) return;
    try {
      const res = await fetch(`${API_BASE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rollback-snapshot', snapshotId: parameters.snapshotId, humanApproved: true })
      });
      if (!res.ok) throw new Error('Rollback failed');
      addToast({ type: 'success', message: 'Snapshot rolled back.' });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setRunError(error.message);
      addToast({ type: 'error', message: error.message });
    }
  }, [parameters.snapshotId, role, addToast]);

  // Render states
  if (catalogue === null && !catalogueError) {
    return <ServiceChangeLoading />;
  }
  if (catalogueError) {
    return <ServiceChangeError message={catalogueError} onRetry={loadCatalogue} />;
  }
  if (!parameters.snapshotId) {
    return <ServiceChangeEmpty />;
  }
  if (running) {
    return <ServiceChangeLoading />;
  }
  if (blocked) {
    return <ServiceChangeBlocked message={runError} onRetry={runShadowTraffic} />;
  }
  if (runError) {
    return <ServiceChangeError message={runError} onRetry={runShadowTraffic} />;
  }

  return (
    <section className="service-change-sandbox-workspace" aria-label="Civic service change sandbox with shadow traffic evaluation">
      <div className="container">
        <header className="workspace-header">
          <h1 className="workspace-title">Service Change Sandbox</h1>
          <p className="workspace-subtitle">
            Compare a proposed service workflow against current behavior before
            publishing. Versioned staging snapshots, synthetic shadow-traffic
            replay, and completion / validation / accessibility comparison.
          </p>
        </header>

        <div className="workspace-body">
          <aside className="workspace-sidebar">
            <SnapshotSelector
              snapshots={catalogue.stagingSnapshots}
              serviceVersions={catalogue.serviceVersions}
              journeyPatterns={catalogue.journeyPatterns}
              onParametersChange={handleParametersChange}
              defaultSnapshotId={defaultSnapshotId}
            />
            {result && (
              <div className="sidebar-actions">
                <button
                  className="btn btn-outline"
                  type="button"
                  onClick={handlePublish}
                  disabled={role === 'guest'}
                  title={role === 'guest' ? 'Sign in to publish' : 'Publish this snapshot to production'}
                >
                  Publish snapshot
                </button>
                <button
                  className="btn btn-outline"
                  type="button"
                  onClick={handleRollback}
                  disabled={role === 'guest'}
                  title={role === 'guest' ? 'Sign in to roll back' : 'Roll back this snapshot'}
                >
                  Roll back snapshot
                </button>
              </div>
            )}
          </aside>

          <main className="workspace-main">
            {result ? <ComparisonResults result={result} /> : <ServiceChangeEmpty />}
          </main>
        </div>

        <footer className="workspace-footer">
          <p className="workspace-disclaimer">
            Shadow-traffic comparison output is illustrative and untrusted. It
            must be reviewed by a human before any production change is
            published. The sandbox never writes to production during shadow runs
            and never exposes citizen records or credentials.
          </p>
        </footer>
      </div>
    </section>
  );
}
