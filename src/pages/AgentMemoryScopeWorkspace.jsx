/**
 * src/pages/AgentMemoryScopeWorkspace.jsx
 *
 * Accessible Civic Agent Memory Scope and Per-Case Context Isolation Workspace (#1447).
 * Provides explicit user-visible context controls:
 * - Tenant & Case partition selector
 * - Deterministic No-Memory Mode toggle
 * - Allowlisted category filters
 * - Per-entry & partition deletion
 * - Visibly distinct Citizen-Entered Fact, Official Record, and AI/Community Suggestion badges
 * - Loading, empty, error, and offline states
 */

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  EyeOff,
  FileCheck2,
  Lock,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  WifiOff,
} from 'lucide-react';
import {
  DEFAULT_ALLOWLISTED_CATEGORIES,
  MEMORY_ORIGINS,
  MEMORY_SCOPE_MODES,
  createScopedMemoryEntry,
} from '../services/agentMemory/memoryScopeIsolationLayer.js';
import {
  getPartitionSnapshot,
  loadLocalMemoryScopeState,
  saveLocalMemoryScopeState,
} from '../services/agentMemory/memoryScopeStorage.js';

export default function AgentMemoryScopeWorkspace() {
  const initial = (() => {
    try {
      const snap = getPartitionSnapshot('up-lucknow', 'case-passport-01');
      return { status: 'ready', errorMsg: '', snap };
    } catch (err) {
      return { status: 'error', errorMsg: err?.message || 'Failed to load memory partitions.', snap: null };
    }
  })();

  const [tenantId, setTenantId] = useState('up-lucknow');
  const [caseId, setCaseId] = useState('case-passport-01');
  const [snapshot, setSnapshot] = useState(initial.snap);
  const [errorMsg, setErrorMsg] = useState(initial.errorMsg);
  const [notice, setNotice] = useState('');
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine === false
  );

  // Add entry form
  const [origin, setOrigin] = useState(MEMORY_ORIGINS.CITIZEN_FACT);
  const [category, setCategory] = useState('interaction_summary');
  const [content, setContent] = useState('');

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

  const refreshPartition = (nextTenant = tenantId, nextCase = caseId) => {
    setErrorMsg('');
    try {
      const snap = getPartitionSnapshot(nextTenant, nextCase);
      setSnapshot(snap);
    } catch (err) {
      setErrorMsg(err?.message || 'Invalid tenant or case identifier.');
    }
  };

  const handleToggleNoMemory = () => {
    if (!snapshot) return;
    const state = loadLocalMemoryScopeState();
    const key = `${tenantId}:${caseId}`;
    const nextMode =
      snapshot.partition.mode === MEMORY_SCOPE_MODES.NO_MEMORY
        ? MEMORY_SCOPE_MODES.CASE_SCOPED_ALLOWLIST
        : MEMORY_SCOPE_MODES.NO_MEMORY;
    saveLocalMemoryScopeState({
      ...state,
      partitions: {
        ...state.partitions,
        [key]: { ...snapshot.partition, mode: nextMode },
      },
    });
    refreshPartition();
    setNotice(
      nextMode === MEMORY_SCOPE_MODES.NO_MEMORY
        ? 'Deterministic No-Memory Mode enabled: zero context will be stored or retrieved.'
        : 'Case-scoped allowlisted memory enabled.'
    );
  };

  const handleToggleCategory = (cat) => {
    if (!snapshot) return;
    const state = loadLocalMemoryScopeState();
    const key = `${tenantId}:${caseId}`;
    const current = new Set(snapshot.partition.allowlistedCategories || []);
    if (current.has(cat)) current.delete(cat);
    else current.add(cat);
    saveLocalMemoryScopeState({
      ...state,
      partitions: {
        ...state.partitions,
        [key]: { ...snapshot.partition, allowlistedCategories: Array.from(current) },
      },
    });
    refreshPartition();
  };

  const handleAddEntry = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setNotice('');
    if (!snapshot) return;
    if (snapshot.partition.mode === MEMORY_SCOPE_MODES.NO_MEMORY) {
      setNotice('Deterministic No-Memory Mode is active; entry was not persisted.');
      setContent('');
      return;
    }
    try {
      const entry = createScopedMemoryEntry({
        tenantId,
        caseId,
        origin,
        category,
        content,
        sourceReference:
          origin === MEMORY_ORIGINS.OFFICIAL_RECORD
            ? {
                source: 'Departmental Service Guide',
                jurisdiction: 'IN-UP',
                effectiveDate: '2026-11-01',
                lastVerifiedAt: new Date().toISOString(),
              }
            : { source: 'Case session note', jurisdiction: 'IN-UP' },
      });
      const state = loadLocalMemoryScopeState();
      const key = `${tenantId}:${caseId}`;
      saveLocalMemoryScopeState({
        ...state,
        partitions: {
          ...state.partitions,
          [key]: {
            ...snapshot.partition,
            entries: [entry, ...(snapshot.partition.entries || [])],
          },
        },
      });
      setContent('');
      refreshPartition();
      setNotice(`Added scoped memory entry ${entry.entryId} to ${key}.`);
    } catch (err) {
      setErrorMsg(err?.message || 'Unable to store memory entry.');
    }
  };

  const handleDeletePartition = () => {
    const state = loadLocalMemoryScopeState();
    const key = `${tenantId}:${caseId}`;
    const nextPartitions = { ...state.partitions };
    delete nextPartitions[key];
    saveLocalMemoryScopeState({ ...state, partitions: nextPartitions });
    refreshPartition();
    setNotice(`Deleted all memory entries in partition ${key}.`);
  };

  const isNoMemory = snapshot?.partition?.mode === MEMORY_SCOPE_MODES.NO_MEMORY;
  const visibleEntries = snapshot?.retrieval?.entries || [];

  return (
    <main className="section" aria-labelledby="memory-scope-heading">
      <div className="container" style={{ maxWidth: '1120px', margin: '0 auto' }}>
        <header className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
            <div>
              <h1 id="memory-scope-heading" style={{ margin: 0, fontSize: '1.65rem' }}>
                Civic Agent Memory Scope &amp; Per-Case Context Isolation
              </h1>
              <p style={{ marginTop: '0.4rem', opacity: 0.85 }}>
                Explicit tenant- and case-scoped memory partitions with allowlisted retrieval, deterministic no-memory mode, and automatic exclusion of secrets, Aadhaar, PAN, OTPs, and biometrics.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span className="badge" data-origin="citizen_entered_fact">
                <UserCheck size={14} aria-hidden="true" /> Citizen-Entered Fact
              </span>
              <span className="badge" data-origin="official_record">
                <FileCheck2 size={14} aria-hidden="true" /> Official Record
              </span>
              <span className="badge" data-origin="ai_community_suggestion">
                <Sparkles size={14} aria-hidden="true" /> AI / Community Suggestion
              </span>
            </div>
          </div>
        </header>

        {isOffline && (
          <div role="status" aria-live="polite" className="glass-panel" style={{ padding: '0.9rem 1.2rem', marginBottom: '1rem', borderLeft: '4px solid #f59e0b', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <WifiOff size={18} aria-hidden="true" />
            <span><strong>Offline Mode:</strong> Memory partitions are isolated locally with zero cross-case leakage.</span>
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

        {/* User-Visible Context Controls */}
        <section className="glass-panel" aria-labelledby="controls-heading" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
          <h2 id="controls-heading" style={{ marginTop: 0, fontSize: '1.15rem' }}>
            User-Visible Context Controls
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', alignItems: 'end' }}>
            <div>
              <label htmlFor="mem-tenant-id" style={{ display: 'block', fontWeight: 600 }}>Tenant Scope</label>
              <input
                id="mem-tenant-id"
                value={tenantId}
                onChange={(e) => {
                  setTenantId(e.target.value);
                  refreshPartition(e.target.value, caseId);
                }}
                style={{ width: '100%', padding: '0.45rem' }}
              />
            </div>
            <div>
              <label htmlFor="mem-case-id" style={{ display: 'block', fontWeight: 600 }}>Case Partition ID</label>
              <input
                id="mem-case-id"
                value={caseId}
                onChange={(e) => {
                  setCaseId(e.target.value);
                  refreshPartition(tenantId, e.target.value);
                }}
                style={{ width: '100%', padding: '0.45rem' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary"
                aria-pressed={isNoMemory}
                onClick={handleToggleNoMemory}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                {isNoMemory ? <EyeOff size={16} aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}
                {isNoMemory ? 'No-Memory Mode: ON' : 'No-Memory Mode: OFF'}
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleDeletePartition}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Trash2 size={16} aria-hidden="true" />
                Delete Case Partition
              </button>
            </div>
          </div>

          <fieldset style={{ marginTop: '1rem', border: '1px solid rgba(148, 163, 184, 0.3)', borderRadius: '0.5rem', padding: '0.75rem' }}>
            <legend style={{ fontWeight: 600 }}>Allowlisted Retrieval Categories</legend>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {DEFAULT_ALLOWLISTED_CATEGORIES.map((cat) => {
                const checked = snapshot?.partition?.allowlistedCategories?.includes(cat) || false;
                return (
                  <label key={cat} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <input type="checkbox" checked={checked} onChange={() => handleToggleCategory(cat)} />
                    <span>{cat}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </section>

        {/* Add Scoped Entry */}
        <section className="glass-panel" aria-labelledby="add-entry-heading" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
          <h2 id="add-entry-heading" style={{ marginTop: 0, fontSize: '1.1rem' }}>
            Add Scoped Context Note (Secrets &amp; Sensitive PII Excluded)
          </h2>
          <form onSubmit={handleAddEntry} style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label htmlFor="mem-origin" style={{ display: 'block', fontWeight: 600 }}>Data Origin</label>
                <select id="mem-origin" value={origin} onChange={(e) => setOrigin(e.target.value)} style={{ width: '100%', padding: '0.45rem' }}>
                  <option value={MEMORY_ORIGINS.CITIZEN_FACT}>Citizen-Entered Fact</option>
                  <option value={MEMORY_ORIGINS.OFFICIAL_RECORD}>Official Record</option>
                  <option value={MEMORY_ORIGINS.AI_SUGGESTION}>AI / Community Suggestion</option>
                </select>
              </div>
              <div>
                <label htmlFor="mem-category" style={{ display: 'block', fontWeight: 600 }}>Category</label>
                <select id="mem-category" value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: '100%', padding: '0.45rem' }}>
                  {DEFAULT_ALLOWLISTED_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="mem-content" style={{ display: 'block', fontWeight: 600 }}>Context Content</label>
              <input
                id="mem-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter non-sensitive case context..."
                required
                style={{ width: '100%', padding: '0.45rem' }}
              />
            </div>
            <div>
              <button type="submit" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <Plus size={16} aria-hidden="true" />
                Save to Scoped Partition
              </button>
            </div>
          </form>
        </section>

        {/* Retrieved Partition Context */}
        <section className="glass-panel" aria-labelledby="retrieved-heading" style={{ padding: '1.25rem', overflowX: 'auto' }}>
          <h2 id="retrieved-heading" style={{ marginTop: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <ShieldCheck size={18} aria-hidden="true" />
            Retrieved Context for {tenantId}:{caseId} ({visibleEntries.length})
          </h2>

          {isNoMemory ? (
            <p role="status">
              <strong>Deterministic No-Memory Mode Active:</strong> 0 entries retrieved; assistant operates statelessly.
            </p>
          ) : visibleEntries.length === 0 ? (
            <p>No allowlisted, non-expired memory entries in this case partition.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <caption style={{ textAlign: 'left', marginBottom: '0.5rem', opacity: 0.8 }}>
                Isolated memory entries for partition {snapshot?.retrieval?.partitionKey}.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Origin</th>
                  <th scope="col">Category</th>
                  <th scope="col">Content</th>
                  <th scope="col">Source Reference</th>
                  <th scope="col">Expires</th>
                </tr>
              </thead>
              <tbody>
                {visibleEntries.map((item) => (
                  <tr key={item.entryId}>
                    <th scope="row">{item.origin}</th>
                    <td>{item.category}</td>
                    <td>{item.content}</td>
                    <td>
                      {item.sourceReference?.source} ({item.sourceReference?.jurisdiction} •{' '}
                      {item.sourceReference?.verified ? `Verified ${item.sourceReference.effectiveDate}` : 'Unverified'})
                    </td>
                    <td>{item.expiresAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}
