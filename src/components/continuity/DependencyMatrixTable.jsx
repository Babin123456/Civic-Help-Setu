import { useState, useId } from 'react';
import { AlertTriangle, ShieldCheck, Clock, ArrowRight, Search } from 'lucide-react';

export const DependencyMatrixTable = ({
  dependencies = [],
  services = [],
  onDelete = null,
  isAdmin = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCriticality, setSelectedCriticality] = useState('ALL');
  const searchInputId = useId();

  const serviceMap = new Map();
  services.forEach((s) => serviceMap.set(s.id, s));

  const filtered = dependencies.filter((dep) => {
    const sName = dep.serviceName || serviceMap.get(dep.serviceId)?.name || dep.serviceId;
    const matchesSearch =
      sName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (dep.manualFallbackProcedure && dep.manualFallbackProcedure.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCriticality =
      selectedCriticality === 'ALL' || dep.criticality === selectedCriticality;

    return matchesSearch && matchesCriticality;
  });

  const getTierBadge = (criticality) => {
    switch (criticality) {
      case 'TIER_1_CRITICAL':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.2rem 0.55rem',
              borderRadius: '99px',
              fontSize: '0.75rem',
              fontWeight: '700',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }}
          >
            <AlertTriangle size={12} aria-hidden="true" />
            <span>Tier 1 - Critical (≤4h)</span>
          </span>
        );
      case 'TIER_2_ESSENTIAL':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.2rem 0.55rem',
              borderRadius: '99px',
              fontSize: '0.75rem',
              fontWeight: '700',
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#d97706',
              border: '1px solid rgba(245, 158, 11, 0.3)',
            }}
          >
            <Clock size={12} aria-hidden="true" />
            <span>Tier 2 - Essential (≤24h)</span>
          </span>
        );
      default:
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.2rem 0.55rem',
              borderRadius: '99px',
              fontSize: '0.75rem',
              fontWeight: '600',
              background: 'var(--glass-bg)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-light)',
            }}
          >
            <span>Tier 3 - Deferred</span>
          </span>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
      {/* FILTER & ACCESSIBLE CONTROLS */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 240px' }}>
          <label htmlFor={searchInputId} className="sr-only">
            Filter service dependencies
          </label>
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              maxWidth: '360px',
            }}
          >
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '0.75rem',
                color: 'var(--text-tertiary)',
                pointerEvents: 'none',
              }}
              aria-hidden="true"
            />
            <input
              id={searchInputId}
              type="text"
              placeholder="Search services or SOPs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 0.75rem 0.45rem 2.2rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-main)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label htmlFor="criticality-filter" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Criticality:
          </label>
          <select
            id="criticality-filter"
            value={selectedCriticality}
            onChange={(e) => setSelectedCriticality(e.target.value)}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-main)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
            }}
          >
            <option value="ALL">All Tiers</option>
            <option value="TIER_1_CRITICAL">Tier 1 Critical</option>
            <option value="TIER_2_ESSENTIAL">Tier 2 Essential</option>
            <option value="TIER_3_DEFERRED">Tier 3 Deferred</option>
          </select>
        </div>
      </div>

      {/* ACCESSIBLE TABULAR PRESENTATION */}
      <div
        tabIndex="0"
        role="region"
        aria-label="Service dependencies and recovery matrix"
        style={{
          width: '100%',
          overflowX: 'auto',
          borderRadius: '0.65rem',
          border: '1px solid var(--border-main)',
          background: 'var(--bg-card)',
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.85rem',
            textAlign: 'left',
          }}
        >
          <thead>
            <tr style={{ background: 'var(--glass-bg)', borderBottom: '1px solid var(--border-main)' }}>
              <th scope="col" style={{ padding: '0.75rem 1rem', fontWeight: '700' }}>
                Municipal Service
              </th>
              <th scope="col" style={{ padding: '0.75rem 1rem', fontWeight: '700' }}>
                Criticality Tier
              </th>
              <th scope="col" style={{ padding: '0.75rem 1rem', fontWeight: '700' }}>
                Upstream Dependencies
              </th>
              <th scope="col" style={{ padding: '0.75rem 1rem', fontWeight: '700' }}>
                Estimated Restoration
              </th>
              <th scope="col" style={{ padding: '0.75rem 1rem', fontWeight: '700' }}>
                Redundant Alternative
              </th>
              <th scope="col" style={{ padding: '0.75rem 1rem', fontWeight: '700' }}>
                Offline Manual SOP
              </th>
              {isAdmin && onDelete && (
                <th scope="col" style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '700' }}>
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={isAdmin && onDelete ? 7 : 6}
                  style={{
                    padding: '2rem 1rem',
                    textAlign: 'center',
                    color: 'var(--text-secondary)',
                  }}
                >
                  No matching service dependencies found.
                </td>
              </tr>
            ) : (
              filtered.map((dep) => {
                const sName = dep.serviceName || serviceMap.get(dep.serviceId)?.name || dep.serviceId;
                const upstreams = (dep.upstreamDependencies || []).map(
                  (uId) => serviceMap.get(uId)?.name || uId
                );

                return (
                  <tr
                    key={dep.id}
                    style={{
                      borderBottom: '1px solid var(--border-light)',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <td style={{ padding: '0.75rem 1rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                      {sName}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>{getTierBadge(dep.criticality)}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {upstreams.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                          {upstreams.map((u, i) => (
                            <span
                              key={i}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                                padding: '0.15rem 0.45rem',
                                background: 'rgba(14, 165, 233, 0.1)',
                                color: '#0284c7',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                              }}
                            >
                              <ArrowRight size={10} aria-hidden="true" />
                              <span>{u}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>None (Primary)</span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Clock size={13} style={{ color: 'var(--text-tertiary)' }} aria-hidden="true" />
                        <span>{dep.estimatedRestorationHours || 2} hrs</span>
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {dep.redundantAlternative ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            color: '#10b981',
                            fontSize: '0.8rem',
                          }}
                        >
                          <ShieldCheck size={14} aria-hidden="true" />
                          <span>{dep.redundantAlternative}</span>
                        </span>
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            color: '#ef4444',
                            fontSize: '0.78rem',
                            fontWeight: '600',
                          }}
                        >
                          <AlertTriangle size={13} aria-hidden="true" />
                          <span>None (Single Point of Failure)</span>
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', maxWidth: '260px' }}>
                      {dep.manualFallbackProcedure ? (
                        <span
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            fontSize: '0.8rem',
                            color: 'var(--text-secondary)',
                          }}
                          title={dep.manualFallbackProcedure}
                        >
                          {dep.manualFallbackProcedure}
                        </span>
                      ) : (
                        <span style={{ color: '#ef4444', fontSize: '0.78rem' }}>⚠️ Missing manual fallback SOP</span>
                      )}
                    </td>
                    {isAdmin && onDelete && (
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => onDelete(dep.id)}
                          aria-label={`Delete dependency mapping for ${sName}`}
                          style={{
                            padding: '0.3rem 0.6rem',
                            borderRadius: '0.35rem',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            background: 'transparent',
                            color: '#ef4444',
                            cursor: 'pointer',
                            fontSize: '0.78rem',
                          }}
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
