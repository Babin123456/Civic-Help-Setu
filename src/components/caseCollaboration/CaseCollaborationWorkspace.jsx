/**
 * src/components/caseCollaboration/CaseCollaborationWorkspace.jsx
 *
 * Main container for the Civic Case Collaboration Space. Wires share creation,
 * viewing (token-based), and owner management. Accessible, mobile-first; no
 * PII is collected or logged.
 */

import { useCallback, useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  CaseCollaborationLoading,
  CaseCollaborationEmpty,
  CaseCollaborationError,
  CaseCollaborationRevoked,
} from './CaseCollaborationStates';
import { ShareCreator } from './ShareCreator';
import { ShareViewer } from './ShareViewer';
import { ShareManager } from './ShareManager';
import { listCases } from '../../data/civicCaseCollaborationData.js';

const API_BASE = '/api/case-collaboration';

export default function CaseCollaborationWorkspace() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const role = user?.role || 'guest';
  const viewerId = user?.id || null;

  const urlToken = searchParams.get('token');
  const [token] = useState(urlToken || null);

  const [mode, setMode] = useState(urlToken ? 'view' : 'create'); // create | view | manage
  const [result, setResult] = useState(null);
  const [runError, setRunError] = useState(null);
  const [downloading, setDownloading] = useState(new Set());

  const [catalogue, setCatalogue] = useState(null);
  const [catalogueError, setCatalogueError] = useState(null);

  const defaultCaseId = useMemo(() => listCases()[0]?.id || null, []);

  // Load public catalogue (cases, items, recipients, scopes, expiry).
  const loadCatalogue = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}?action=catalogue`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load catalogue');
      const data = await res.json();
      setCatalogue(data.ok ? data : null);
      if (!data.ok) setCatalogueError(data.error || 'Unknown catalogue error');
    } catch (e) {
      setCatalogueError(e.message);
    }
  }, []);

  useMemo(() => { loadCatalogue(); }, [loadCatalogue]);

  const handleCreate = useCallback(async (params) => {
    if (role === 'guest') {
      addToast({ type: 'info', message: 'Sign in to create a case share.' });
      return;
    }
    setRunError(null);
    try {
      const res = await fetch(`${API_BASE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-share', ...params }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || 'Create failed');
      }
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Create returned no result');
      setResult(null);
      setMode('manage');
      addToast({ type: 'success', message: 'Share link created.' });
    } catch (e) {
      if (e.name === 'AbortError') return;
      setRunError(e.message);
      addToast({ type: 'error', message: e.message });
    }
  }, [role, addToast]);

  const handleResolve = useCallback(async () => {
    if (!token) return;
    setRunError(null);
    try {
      const res = await fetch(`${API_BASE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve', shareId: token, viewerId, viewerRole: role }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err.status === 'REVOKED' || err.status === 'EXPIRED' || err.status === 'VIEW_LIMIT_REACHED') {
          setResult(null);
          setRunError(err.error || err.message || 'Share access ended.');
          return;
        }
        throw new Error(err.error || err.message || 'Resolve failed');
      }
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Resolve returned no result');
      setResult(data.view);
    } catch (e) {
      if (e.name === 'AbortError') return;
      setRunError(e.message);
      addToast({ type: 'error', message: e.message });
    }
  }, [token, viewerId, role, addToast]);

  useEffect(() => {
    if (mode === 'view' && token) {
      handleResolve();
    }
  }, [mode, token, handleResolve]);

  const handleDownload = async (itemId) => {
    if (downloading.has(itemId)) return;
    setDownloading((prev) => new Set([...prev, itemId]));
    try {
      const res = await fetch(`${API_BASE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'download', shareId: token, itemId, viewerId, viewerRole: role }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || 'Download failed');
      }
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Download returned no result');
      addToast({ type: 'success', message: `Downloaded (${data.download.downloadCount} total). Watermarked copy.` });
    } catch (e) {
      if (e.name === 'AbortError') return;
      setRunError(e.message);
      addToast({ type: 'error', message: e.message });
    } finally {
      setDownloading((prev) => { const next = new Set(prev); next.delete(itemId); return next; });
    }
  };

  const handleRevoke = async (shareId) => {
    setRunError(null);
    try {
      const res = await fetch(`${API_BASE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke-share', shareId }),
      });
      if (!res.ok) throw new Error('Revoke failed');
      addToast({ type: 'success', message: 'Share revoked.' });
    } catch (e) {
      setRunError(e.message);
      addToast({ type: 'error', message: e.message });
    }
  };

  // Render
  if (catalogue === null && !catalogueError) {
    return <CaseCollaborationLoading />;
  }
  if (catalogueError) {
    return <CaseCollaborationError message={catalogueError} onRetry={loadCatalogue} />;
  }

  // Token-based view mode (public, may require auth/passcode via API)
  if (mode === 'view' || token) {
    return (
      <section className="case-collaboration-workspace" aria-label="Shared case items view">
        <div className="container">
          <header className="workspace-header">
            <h1 className="workspace-title">Shared Case Items</h1>
            <p className="workspace-subtitle">Time-bound, revocable view of items shared with you.</p>
          </header>
          {result ? <ShareViewer view={result} onDownload={handleDownload} /> : <CaseCollaborationEmpty />}
          {runError && <CaseCollaborationRevoked message={runError} />}
        </div>
      </section>
    );
  }

  // Owner create/manage mode
  return (
    <section className="case-collaboration-workspace" aria-label="Civic case collaboration space">
      <div className="container">
        <header className="workspace-header">
          <h1 className="workspace-title">Case Collaboration Space</h1>
          <p className="workspace-subtitle">
            Share selected case documents with a trusted helper — item-level,
            time-bound, revocable. Recipients authenticate; access is audited.
          </p>
        </header>

        <div className="workspace-body">
          <aside className="workspace-sidebar">
            {mode === 'create' ? (
              <ShareCreator
                cases={catalogue.cases}
                caseItems={catalogue.caseItems}
                recipients={catalogue.recipients}
                scopes={catalogue.scopes}
                expiryOptions={catalogue.expiryOptions}
                onCreate={handleCreate}
                defaultCaseId={defaultCaseId}
              />
            ) : (
              <ShareManager onRevoke={handleRevoke} />
            )}
            <div className="sidebar-actions">
              <button className="btn btn-outline" type="button" onClick={() => setMode(mode === 'create' ? 'manage' : 'create')} disabled={role === 'guest'}>
                {mode === 'create' ? 'Manage my shares' : 'Create new share'}
              </button>
            </div>
          </aside>

          <main className="workspace-main">
            {mode === 'create' ? (
              <CaseCollaborationEmpty />
            ) : (
              <ShareManager onRevoke={handleRevoke} />
            )}
          </main>
        </div>

        <footer className="workspace-footer">
          <p className="workspace-disclaimer">
            Shared case items are illustrative and untrusted. Recipients must
            authenticate; access is time-bound and revocable. Watermarked
            exports are for review only and never confer official status.
          </p>
        </footer>
      </div>
    </section>
  );
}
