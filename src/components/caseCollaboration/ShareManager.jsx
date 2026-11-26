/**
 * src/components/caseCollaboration/ShareManager.jsx
 *
 * Owner-facing share manager: list active/revoked shares, revoke links, view
 * audit log. Accessible, mobile-first.
 */

import { useCallback, useEffect, useState } from 'react';
import { Lock, List, ShieldAlert } from 'lucide-react';

export function ShareManager({ onRevoke }) {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/case-collaboration?action=list-shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list-shares' }),
      });
      if (!res.ok) throw new Error('Failed to load shares');
      const data = await res.json();
      setShares(data.ok ? data.shares : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRevoke = async (shareId) => {
    if (!window.confirm('Revoke this share link? Revoked links are refused immediately, even if cached.')) return;
    try {
      const res = await fetch('/api/case-collaboration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke-share', shareId }),
      });
      if (!res.ok) throw new Error('Revoke failed');
      const data = await res.json();
      if (data.ok) {
        onRevoke?.(shareId);
        load();
      } else {
        throw new Error(data.error || 'Revoke failed');
      }
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading) {
    return <div className="section" role="status" aria-live="polite"><div className="container"><p>Loading shares…</p></div></div>;
  }
  if (error) {
    return <div className="section" role="alert" aria-live="polite"><div className="container"><p>{error}</p></div></div>;
  }

  return (
    <section className="cc-manager" aria-label="My case shares">
      <div className="manager-card">
        <div className="manager-header">
          <List aria-hidden="true" />
          <h2 className="manager-title">My case shares</h2>
        </div>

        {shares.length === 0 && (
          <div className="cc-state cc-state-empty">
            <h3>No shares yet</h3>
            <p>Create your first granular, revocable share from the creator.</p>
          </div>
        )}

        <div className="share-list">
          {shares.map((s) => (
            <div key={s.shareId} className="share-row">
              <div className="share-row-info">
                <div className="share-row-title">{s.title}</div>
                <div className="share-row-meta">
                  <span>{s.itemCount} item(s)</span>
                  <span>•</span>
                  <span>{s.scope === 'view-download' ? 'View &amp; Download' : 'View Only'}</span>
                  <span>•</span>
                  <span>{s.viewsRemaining === null ? '∞ views' : `${s.viewsRemaining} views left`}</span>
                </div>
              </div>
              <div className="share-row-actions">
                <span className={`status-pill status-${s.status}`}>{s.status}</span>
                <button className="btn btn-outline" type="button" onClick={() => handleRevoke(s.shareId)} disabled={s.status === 'REVOKED'} aria-label={`Revoke ${s.title}`}>
                  <Lock aria-hidden="true" /> Revoke
                </button>
              </div>
            </div>
          ))}
        </div>

        <p className="manager-note">
          <ShieldAlert aria-hidden="true" /> Revoking a link blocks access immediately,
          including any previously cached view. Shares expire automatically per
          their expiry setting.
        </p>
      </div>
    </section>
  );
}
