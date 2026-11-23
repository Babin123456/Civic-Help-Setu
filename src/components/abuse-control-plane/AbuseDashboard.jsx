/**
 * src/components/abuse-control-plane/AbuseDashboard.jsx
 *
 * Operator dashboard for the Abuse Control Plane (#1174).
 *
 * Mobile-first, accessible operator view for:
 *  - Reviewing abuse signals (rapid fire, error bursts, blocked retries).
 *  - Listing and acting on appeals (approve / reject) with human review.
 *  - Allowlisting / blocklisting hashed identifiers per route.
 *
 * Raw caller addresses are never displayed: only privacy-minimized HMAC
 * hashes are shown. No citizen records, credentials, or sensitive prompts
 * are rendered or logged.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  UserCheck,
  UserX,
  List,
  Search,
  ChevronRight,
} from 'lucide-react';
import {
  getSchemaVersion,
  listSignals,
  listAppeals,
  updateAppeal,
  blocklist,
  allowlist,
  AbuseControlPlaneError,
} from '../../services/abuseControlPlaneService.js';

const STATUS_COLORS = {
  pending: 'bg-amber-50 border-amber-200 text-amber-800',
  approved: 'bg-green-50 border-green-200 text-green-800',
  rejected: 'bg-rose-50 border-rose-200 text-rose-800',
};

const SEVERITY_COLORS = {
  low: 'text-green-600',
  medium: 'text-amber-600',
  high: 'text-orange-600',
  critical: 'text-rose-600',
};

function formatMs(ms) {
  if (!Number.isFinite(ms)) return '-';
  const d = new Date(ms);
  return d.toISOString().replace('T', ' ').slice(0, 16);
}

function truncateHash(hash) {
  if (!hash) return '-';
  return `${hash.slice(0, 8)}…${hash.slice(-8)}`;
}

export default function AbuseDashboard() {
  const [tab, setTab] = useState('signals');
  const [signals, setSignals] = useState([]);
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [bucketFilter, setBucketFilter] = useState('');
  const [nextCursor, setNextCursor] = useState(null);
  const [schemaVersion, setSchemaVersion] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sv, sigs] = await Promise.all([
        getSchemaVersion(),
        listSignals({ bucket: bucketFilter || undefined }),
      ]);
      setSchemaVersion(sv);
      setSignals(sigs.signals || []);
    } catch (err) {
      setError(err instanceof AbuseControlPlaneError ? err.message : 'Failed to load signals');
    }
    try {
      const result = await listAppeals({ status: statusFilter, limit: 20, cursor: nextCursor });
      setAppeals(result.appeals || []);
      setNextCursor(result.nextCursor || null);
    } catch (err) {
      setError(err instanceof AbuseControlPlaneError ? err.message : 'Failed to load appeals');
    }
    setLoading(false);
  }, [bucketFilter, statusFilter, nextCursor]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await load();
      if (!mounted) return;
    })();
    return () => { mounted = false; };
  }, [load]);

  const handleAppealDecision = useCallback(async (appeal, decision) => {
    if (!window.confirm(`Review appeal ${appeal.id} as ${decision}? This requires explicit human approval.`)) return;
    try {
      await updateAppeal(appeal.id, { status: decision, reviewerNote: `Operator review: ${decision}` });
      setAppeals(appeals.map((a) => (a.id === appeal.id ? { ...a, status: decision } : a)));
    } catch (err) {
      setError(err instanceof AbuseControlPlaneError ? err.message : 'Failed to update appeal');
    }
  }, [appeals]);

  const handleList = useCallback(async (kind, identifierHash, route) => {
    const reason = window.prompt(`Reason for ${kind}ing ${truncateHash(identifierHash)} on ${route}:`);
    if (!reason) return;
    try {
      if (kind === 'block') await blocklist({ identifierHash, route, reason, expiresAt: null });
      else await allowlist({ identifierHash, route, reason, expiresAt: null });
      setError(null);
    } catch (err) {
      setError(err instanceof AbuseControlPlaneError ? err.message : `Failed to ${kind}list`);
    }
  }, []);

  return (
    <div className="section" role="region" aria-label="Abuse Control Plane operator dashboard">
      <div className="container">
        <header className="page-header">
          <h1>Abuse Control Plane</h1>
          <p className="text-muted">
            Rate-limit quotas, abuse signals, and appeal review. Only privacy-minimized
            identifiers are shown; raw caller addresses are never stored or displayed.
          </p>
          {schemaVersion !== null && (
            <span className="badge">Schema v{schemaVersion}</span>
          )}
        </header>

        {error && (
          <div className="alert alert-error" role="alert">
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        <nav className="tabs" aria-label="Abuse control views">
          <button
            role="tab"
            aria-selected={tab === 'signals'}
            className={tab === 'signals' ? 'tab-active' : 'tab'}
            onClick={() => setTab('signals')}
          >
            <ShieldAlert size={16} /> Signals
          </button>
          <button
            role="tab"
            aria-selected={tab === 'appeals'}
            className={tab === 'appeals' ? 'tab-active' : 'tab'}
            onClick={() => setTab('appeals')}
          >
            <List size={16} /> Appeals
          </button>
        </nav>

        <main className="dashboard-grid">
          {tab === 'signals' && (
            <section className="card">
              <div className="card-header">
                <h2>Abuse signals</h2>
                <div className="toolbar">
                  <label htmlFor="bucket-filter">Bucket</label>
                  <input
                    id="bucket-filter"
                    value={bucketFilter}
                    onChange={(e) => setBucketFilter(e.target.value)}
                    placeholder="e.g. addr:abc123"
                  />
                  <button className="btn btn-primary" onClick={load}>
                    <Search size={14} /> Refresh
                  </button>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Bucket</th>
                      <th>Kind</th>
                      <th>Severity</th>
                      <th>Route</th>
                      <th>At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={5} className="text-muted">Loading signals…</td></tr>
                    ) : signals.length === 0 ? (
                      <tr><td colSpan={5} className="text-muted">No abuse signals recorded.</td></tr>
                    ) : (
                      signals.map((s) => (
                        <tr key={`${s.bucket}:${s.at}:${s.kind}`}>
                          <td className="text-mono text-sm">{truncateHash(s.bucket.split(':')[1] || s.bucket)}</td>
                          <td><span className={`badge badge-${s.kind}`}>{s.kind}</span></td>
                          <td><span className={SEVERITY_COLORS[s.severity] || ''}>{s.severity}</span></td>
                          <td className="text-mono text-sm">{s.route || '-'}</td>
                          <td className="text-mono text-sm">{formatMs(s.at)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === 'appeals' && (
            <>
              <section className="card">
                <div className="card-header">
                  <h2>Appeal review</h2>
                  <div className="toolbar">
                    <label htmlFor="status-filter">Status</label>
                    <select id="status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                    <button className="btn btn-primary" onClick={load}>
                      <Search size={14} /> Refresh
                    </button>
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Appeal ID</th>
                        <th>Identifier</th>
                        <th>Route</th>
                        <th>Reason</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={6} className="text-muted">Loading appeals…</td></tr>
                      ) : appeals.length === 0 ? (
                        <tr><td colSpan={6} className="text-muted">No appeals.</td></tr>
                      ) : (
                        appeals.map((a) => (
                          <tr key={a.id}>
                            <td className="text-mono text-sm">{a.id}</td>
                            <td className="text-mono text-sm">{truncateHash(a.identifierHash)}</td>
                            <td className="text-mono text-sm">{a.route}</td>
                            <td className="text-sm" title={a.reason}>{a.reason.slice(0, 60)}{a.reason.length > 60 ? '…' : ''}</td>
                            <td><span className={`badge ${STATUS_COLORS[a.status] || ''}`}>{a.status}</span></td>
                            <td>
                              {a.status === 'pending' && (
                                <>
                                  <button
                                    className="btn btn-sm btn-success"
                                    onClick={() => handleAppealDecision(a, 'approved')}
                                    aria-label={`Approve appeal ${a.id}`}
                                  >
                                    <UserCheck size={14} />
                                  </button>
                                  <button
                                    className="btn btn-sm btn-danger"
                                    onClick={() => handleAppealDecision(a, 'rejected')}
                                    aria-label={`Reject appeal ${a.id}`}
                                  >
                                    <UserX size={14} />
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {nextCursor && (
                  <button className="btn btn-outline" onClick={load}>
                    <ChevronRight size={14} /> Load more
                  </button>
                )}
              </section>

              <section className="card">
                <div className="card-header"><h2>List management</h2></div>
                <div className="form-grid">
                  <div className="field">
                    <label>Identifier hash</label>
                    <input id="list-hash" placeholder="64-char hex hash" />
                  </div>
                  <div className="field">
                    <label>Route</label>
                    <input id="list-route" placeholder="GET:/api/report" />
                  </div>
                  <div className="field">
                    <label>Reason</label>
                    <input id="list-reason" placeholder="Why" />
                  </div>
                  <div className="field actions">
                    <button
                      className="btn btn-danger"
                      onClick={() => {
                        const h = document.getElementById('list-hash').value;
                        const r = document.getElementById('list-route').value;
                        handleList('block', h, r);
                      }}
                    >
                      <ShieldAlert size={14} /> Blocklist
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        const h = document.getElementById('list-hash').value;
                        const r = document.getElementById('list-route').value;
                        handleList('allow', h, r);
                      }}
                    >
                      <UserCheck size={14} /> Allowlist
                    </button>
                  </div>
                </div>
                <p className="caption">
                  Blocklisting is a high-impact operator action. It is recorded in the audit
                  trail and requires explicit human review before taking effect.
                </p>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
