import { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  History,
  FileCheck,
  Eye,
  PlusCircle,
  ExternalLink,
  Shield,
  Layers,
} from 'lucide-react';
import {
  isSourceStale,
  VERSION_STATUSES,
  TEMPLATE_REGISTRY,
} from '../../services/legalSourceService.js';

export default function LegalSourceRegistryTable({
  sources = [],
  onSelectSource,
  onAction,
  canReview = false,
  canManage = false,
  onAddNewDraft,
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [templateFilter, setTemplateFilter] = useState('ALL');
  const [jurisdictionFilter, setJurisdictionFilter] = useState('ALL');
  const [staleOnly, setStaleOnly] = useState(false);

  // Distinct jurisdictions from sources
  const jurisdictions = useMemo(() => {
    const set = new Set(['ALL', 'National']);
    sources.forEach((s) => {
      if (s.jurisdiction) set.add(s.jurisdiction);
    });
    return Array.from(set);
  }, [sources]);

  // Filtered sources
  const filteredSources = useMemo(() => {
    return sources.filter((s) => {
      if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
      if (templateFilter !== 'ALL' && !s.applicableTemplates?.includes(templateFilter)) return false;
      if (jurisdictionFilter !== 'ALL' && s.jurisdiction !== jurisdictionFilter) return false;
      if (staleOnly && !isSourceStale(s)) return false;

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchTitle = (s.title || '').toLowerCase().includes(q);
        const matchAct = (s.actName || '').toLowerCase().includes(q);
        const matchProv = (s.provision || '').toLowerCase().includes(q);
        const matchSummary = (s.summary || '').toLowerCase().includes(q);
        if (!matchTitle && !matchAct && !matchProv && !matchSummary) return false;
      }

      return true;
    });
  }, [sources, statusFilter, templateFilter, jurisdictionFilter, staleOnly, search]);

  const getStatusBadge = (source) => {
    const isStale = isSourceStale(source);

    if (source.status === VERSION_STATUSES.DRAFT) {
      return (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#f59e0b',
              padding: '0.2rem 0.5rem',
              borderRadius: '0.375rem',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            <Clock size={12} /> DRAFT
          </span>
        </div>
      );
    }

    if (source.status === VERSION_STATUSES.SUPERSEDED) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            background: 'rgba(239, 68, 68, 0.15)',
            color: '#ef4444',
            padding: '0.2rem 0.5rem',
            borderRadius: '0.375rem',
            fontSize: '0.75rem',
            fontWeight: 600,
          }}
        >
          <AlertTriangle size={12} /> SUPERSEDED
        </span>
      );
    }

    return (
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            background: 'rgba(34, 197, 94, 0.15)',
            color: '#22c55e',
            padding: '0.2rem 0.5rem',
            borderRadius: '0.375rem',
            fontSize: '0.75rem',
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={12} /> REVIEWED
        </span>
        {isStale && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              background: 'rgba(234, 179, 8, 0.2)',
              color: '#eab308',
              padding: '0.2rem 0.5rem',
              borderRadius: '0.375rem',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
            title="Last reviewed over 365 days ago"
          >
            <Clock size={12} /> Stale (&gt;365d)
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        background: 'var(--bg-card, #1e293b)',
        borderRadius: '1rem',
        padding: '1.5rem',
        border: '1px solid var(--border-light, #334155)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* Top Filter and Action Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 280px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
              }}
            />
            <input
              type="text"
              placeholder="Search by Act, Section, Citation or keywords..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search legal citations"
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem 0.6rem 2.25rem',
                borderRadius: '0.5rem',
                background: 'var(--bg-input, #0f172a)',
                border: '1px solid var(--border-light, #334155)',
                color: 'var(--text-main, #f8fafc)',
                fontSize: '0.875rem',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Status Select */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Filter size={14} style={{ color: '#94a3b8' }} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '0.5rem',
                background: 'var(--bg-input, #0f172a)',
                border: '1px solid var(--border-light, #334155)',
                color: 'var(--text-main, #f8fafc)',
                fontSize: '0.85rem',
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="REVIEWED">Reviewed Only</option>
              <option value="DRAFT">Drafts Only</option>
              <option value="SUPERSEDED">Superseded Only</option>
            </select>
          </div>

          {/* Template Select */}
          <select
            value={templateFilter}
            onChange={(e) => setTemplateFilter(e.target.value)}
            aria-label="Filter by workspace template"
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-input, #0f172a)',
              border: '1px solid var(--border-light, #334155)',
              color: 'var(--text-main, #f8fafc)',
              fontSize: '0.85rem',
            }}
          >
            <option value="ALL">All Templates</option>
            {Object.entries(TEMPLATE_REGISTRY).map(([id, t]) => (
              <option key={id} value={id}>
                {t.name}
              </option>
            ))}
          </select>

          {/* Jurisdiction Select */}
          <select
            value={jurisdictionFilter}
            onChange={(e) => setJurisdictionFilter(e.target.value)}
            aria-label="Filter by jurisdiction"
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-input, #0f172a)',
              border: '1px solid var(--border-light, #334155)',
              color: 'var(--text-main, #f8fafc)',
              fontSize: '0.85rem',
            }}
          >
            {jurisdictions.map((j) => (
              <option key={j} value={j}>
                {j === 'ALL' ? 'All Jurisdictions' : j}
              </option>
            ))}
          </select>

          {/* Stale Only Toggle */}
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.85rem',
              color: '#cbd5e1',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={staleOnly}
              onChange={(e) => setStaleOnly(e.target.checked)}
            />
            <span>Stale only</span>
          </label>

          {/* Add New Draft Button */}
          {canManage && (
            <button
              onClick={onAddNewDraft}
              type="button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.85rem',
                borderRadius: '0.5rem',
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              <PlusCircle size={15} /> Add Draft Source
            </button>
          )}
        </div>
      </div>

      {/* Results Count Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75rem',
          fontSize: '0.85rem',
          color: '#94a3b8',
        }}
      >
        <span>
          Showing <strong>{filteredSources.length}</strong> of {sources.length} legal sources
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          <Shield size={13} style={{ color: '#38bdf8' }} />
          Zero outcome inference • Official gazettes linked
        </span>
      </div>

      {/* Table Container */}
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            textAlign: 'left',
            fontSize: '0.875rem',
          }}
          aria-label="Versioned Legal Sources Table"
        >
          <thead>
            <tr
              style={{
                borderBottom: '1px solid var(--border-light, #334155)',
                color: '#94a3b8',
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              <th style={{ padding: '0.75rem' }}>Citation & Provision</th>
              <th style={{ padding: '0.75rem' }}>Act Name</th>
              <th style={{ padding: '0.75rem' }}>Jurisdiction</th>
              <th style={{ padding: '0.75rem' }}>Version</th>
              <th style={{ padding: '0.75rem' }}>Review Status</th>
              <th style={{ padding: '0.75rem' }}>Templates</th>
              <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSources.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    padding: '2.5rem',
                    textAlign: 'center',
                    color: '#94a3b8',
                    fontStyle: 'italic',
                  }}
                >
                  No legal sources found matching the selected filters.
                </td>
              </tr>
            ) : (
              filteredSources.map((source) => {
                const hasHistory = (source.versionHistory || []).length > 0;
                return (
                  <tr
                    key={source.id}
                    style={{
                      borderBottom: '1px solid rgba(51, 65, 85, 0.4)',
                      transition: 'background 0.15s ease',
                    }}
                    className="legal-source-row"
                  >
                    {/* Title & Provision */}
                    <td style={{ padding: '0.75rem', maxWidth: '280px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-main, #f8fafc)' }}>
                        {source.provision}
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: '#94a3b8',
                          marginTop: '0.15rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={source.title}
                      >
                        {source.title}
                      </div>
                      {source.officialUrl && (
                        <a
                          href={source.officialUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                            color: '#38bdf8',
                            fontSize: '0.7rem',
                            marginTop: '0.2rem',
                            textDecoration: 'none',
                          }}
                        >
                          Official Link <ExternalLink size={10} />
                        </a>
                      )}
                    </td>

                    {/* Act Name */}
                    <td style={{ padding: '0.75rem', color: '#cbd5e1', fontSize: '0.8rem' }}>
                      {source.actName}
                    </td>

                    {/* Jurisdiction */}
                    <td style={{ padding: '0.75rem' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '0.375rem',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          background:
                            source.jurisdiction === 'National'
                              ? 'rgba(56, 189, 248, 0.1)'
                              : 'rgba(168, 85, 247, 0.1)',
                          color: source.jurisdiction === 'National' ? '#38bdf8' : '#c084fc',
                        }}
                      >
                        {source.jurisdiction}
                      </span>
                    </td>

                    {/* Version */}
                    <td style={{ padding: '0.75rem' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                          fontFamily: 'monospace',
                          fontSize: '0.8rem',
                          background: 'rgba(255, 255, 255, 0.05)',
                          padding: '0.15rem 0.4rem',
                          borderRadius: '0.25rem',
                          color: '#e2e8f0',
                        }}
                      >
                        v{source.currentVersion}
                      </span>
                    </td>

                    {/* Review Status & Staleness */}
                    <td style={{ padding: '0.75rem' }}>
                      {getStatusBadge(source)}
                      <div
                        style={{
                          fontSize: '0.7rem',
                          color: '#94a3b8',
                          marginTop: '0.25rem',
                        }}
                      >
                        {source.reviewedAt
                          ? `Reviewed: ${new Date(source.reviewedAt).toLocaleDateString()}`
                          : 'Pending initial review'}
                      </div>
                    </td>

                    {/* Applicable Templates */}
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                        {(source.applicableTemplates || []).map((tId) => {
                          const tDef = TEMPLATE_REGISTRY[tId];
                          return (
                            <span
                              key={tId}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                                background: 'rgba(99, 102, 241, 0.12)',
                                color: '#a5b4fc',
                                fontSize: '0.7rem',
                                padding: '0.15rem 0.35rem',
                                borderRadius: '0.25rem',
                              }}
                              title={tDef?.name || tId}
                            >
                              <Layers size={10} />
                              {tDef ? tDef.name.slice(0, 16) + '…' : tId}
                            </span>
                          );
                        })}
                      </div>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                        }}
                      >
                        <button
                          onClick={() => onSelectSource(source)}
                          type="button"
                          style={{
                            padding: '0.35rem 0.6rem',
                            borderRadius: '0.375rem',
                            background: 'rgba(255, 255, 255, 0.08)',
                            color: '#f8fafc',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                          title="Inspect provision details and revision history"
                        >
                          <Eye size={12} /> Inspect
                        </button>

                        {canReview && (
                          <>
                            <button
                              onClick={() => onAction('review', source)}
                              type="button"
                              style={{
                                padding: '0.35rem 0.6rem',
                                borderRadius: '0.375rem',
                                background: '#15803d',
                                color: '#ffffff',
                                border: 'none',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                              }}
                              title="Review and Publish new version"
                            >
                              <FileCheck size={12} /> Review
                            </button>

                            {source.status === VERSION_STATUSES.REVIEWED && (
                              <button
                                onClick={() => onAction('supersede', source)}
                                type="button"
                                style={{
                                  padding: '0.35rem 0.6rem',
                                  borderRadius: '0.375rem',
                                  background: 'rgba(239, 68, 68, 0.15)',
                                  color: '#ef4444',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  fontSize: '0.75rem',
                                  cursor: 'pointer',
                                }}
                                title="Mark source as superseded"
                              >
                                Supersede
                              </button>
                            )}

                            {hasHistory && (
                              <button
                                onClick={() => onAction('rollback', source)}
                                type="button"
                                style={{
                                  padding: '0.35rem 0.6rem',
                                  borderRadius: '0.375rem',
                                  background: 'rgba(234, 179, 8, 0.15)',
                                  color: '#eab308',
                                  border: '1px solid rgba(234, 179, 8, 0.3)',
                                  fontSize: '0.75rem',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                }}
                                title="Roll back to previous revision"
                              >
                                <History size={12} /> Rollback
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
