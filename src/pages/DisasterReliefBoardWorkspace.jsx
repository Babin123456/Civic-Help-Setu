import { useState, useMemo, useEffect } from 'react';
import {
  DEFAULT_VERIFIED_CAMPS,
  VERIFIED_RELIEF_ENTITLEMENTS,
  ENTITLEMENT_STALE_DAYS,
  evaluateReliefRecordFreshness,
  listVerifiedReliefCampsAndEntitlements,
  getOfflineBoardEssentials,
  saveOfflineBoardSnapshot,
  loadOfflineBoardSnapshot,
} from '../services/disasterReliefBoardService';

export default function DisasterReliefBoardWorkspace() {
  const [disasterType, setDisasterType] = useState('ALL');
  const [jurisdiction, setJurisdiction] = useState('');
  const [accessibleOnly, setAccessibleOnly] = useState(false);
  const [includeExpired, setIncludeExpired] = useState(false);
  const [lowBandwidthMode, setLowBandwidthMode] = useState(false);
  const [search, setSearch] = useState('');
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine === false : false
  );
  const [cachedAt] = useState(() => loadOfflineBoardSnapshot()?.cachedAt || null);

  const essentials = useMemo(() => getOfflineBoardEssentials(), []);

  useEffect(() => {
    saveOfflineBoardSnapshot({
      camps: DEFAULT_VERIFIED_CAMPS,
      entitlements: VERIFIED_RELIEF_ENTITLEMENTS,
    });

    if (typeof window === 'undefined') return undefined;
    const onOffline = () => setIsOffline(true);
    const onOnline = () => setIsOffline(false);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  const camps = useMemo(
    () =>
      listVerifiedReliefCampsAndEntitlements(
        DEFAULT_VERIFIED_CAMPS,
        { disasterType, jurisdiction, accessibleOnly, includeExpired, search },
        new Date()
      ),
    [disasterType, jurisdiction, accessibleOnly, includeExpired, search]
  );

  const entitlements = useMemo(
    () =>
      VERIFIED_RELIEF_ENTITLEMENTS.map((ent) => ({
        ...ent,
        freshness: evaluateReliefRecordFreshness(ent, new Date(), {
          staleHours: ENTITLEMENT_STALE_DAYS * 24,
        }),
      })),
    []
  );

  return (
    <main style={{ maxWidth: '1080px', margin: '0 auto', padding: '1.5rem 1rem' }}>
      <header style={{ marginBottom: '1.25rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ margin: '0 0 0.35rem', fontSize: '1.5rem' }}>
              Disaster Relief Entitlement &amp; Camp Information Board
            </h1>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Authority-published shelters, emergency helplines, and relief entitlement rules with source &amp; freshness timestamps.
            </p>
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={lowBandwidthMode}
              onChange={(e) => setLowBandwidthMode(e.target.checked)}
            />
            Low-Bandwidth Text Mode
          </label>
        </div>
      </header>

      {isOffline && (
        <div
          role="status"
          style={{
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: '0.5rem',
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            fontSize: '0.85rem',
          }}
        >
          <strong>Offline Mode:</strong> Showing cached official relief camps, helplines (112 / 1077 / 1070), and survival essentials.
          {cachedAt ? ` Last cached: ${cachedAt}` : ''}
        </div>
      )}

      {/* Offline Emergency Helplines */}
      <section aria-label="Emergency Helplines" style={{ marginBottom: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '0.75rem', padding: '1rem' }}>
        <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.65rem' }}>Offline Emergency Helplines &amp; Survival Essentials</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
          {essentials.helplines.map((h) => (
            <span key={h.number} style={{ padding: '0.35rem 0.65rem', borderRadius: '0.4rem', background: 'var(--bg-main)', fontSize: '0.82rem', fontWeight: 600 }}>
              {h.label}: <strong>{h.number}</strong>
            </span>
          ))}
        </div>
        {!lowBandwidthMode && (
          <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            {essentials.survivalChecklist.slice(0, 4).map((item) => (
              <li key={item.id}>{item.item}</li>
            ))}
          </ul>
        )}
      </section>

      {/* Filters */}
      <section aria-label="Camp Filters" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem', alignItems: 'center' }}>
        <select
          aria-label="Disaster Type"
          value={disasterType}
          onChange={(e) => setDisasterType(e.target.value)}
          style={{ padding: '0.45rem 0.6rem', borderRadius: '0.4rem' }}
        >
          <option value="ALL">All Disasters</option>
          <option value="FLOOD">Flood</option>
          <option value="HEATWAVE">Heatwave</option>
          <option value="CYCLONE">Cyclone</option>
          <option value="CIVIL_DEFENCE">Civil Defence</option>
        </select>

        <input
          type="search"
          aria-label="Search camps or jurisdiction"
          placeholder="Search city, camp, or authority..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '0.45rem 0.7rem', borderRadius: '0.4rem', minWidth: '220px' }}
        />

        <input
          type="text"
          aria-label="Filter by jurisdiction"
          placeholder="Jurisdiction (e.g. Lucknow)"
          value={jurisdiction}
          onChange={(e) => setJurisdiction(e.target.value)}
          style={{ padding: '0.45rem 0.7rem', borderRadius: '0.4rem', width: '170px' }}
        />

        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem' }}>
          <input type="checkbox" checked={accessibleOnly} onChange={(e) => setAccessibleOnly(e.target.checked)} />
          Accessible Only
        </label>

        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem' }}>
          <input type="checkbox" checked={includeExpired} onChange={(e) => setIncludeExpired(e.target.checked)} />
          Show Expired
        </label>
      </section>

      {/* Verified Relief Camps */}
      <section aria-label="Verified Relief Camps" style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>
          Authority-Published Relief Camps ({camps.length})
        </h2>
        {camps.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', border: '1px solid var(--border-light)', borderRadius: '0.5rem' }}>
            No matching relief camps found. Clear filters or call DEOC helpline 1077.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.85rem' }}>
            {camps.map((camp) => (
              <article
                key={camp.id}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '0.65rem',
                  padding: '1rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>{camp.name}</h3>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.18rem 0.5rem', borderRadius: '999px', background: 'rgba(16, 185, 129, 0.12)', color: '#047857' }}>
                      Official Authority Record
                    </span>
                    {camp.freshness.isStale && (
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.18rem 0.5rem', borderRadius: '999px', background: 'rgba(245, 158, 11, 0.15)', color: '#b45309' }}>
                        Stale Data Warning
                      </span>
                    )}
                    {camp.freshness.isExpired && (
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.18rem 0.5rem', borderRadius: '999px', background: 'rgba(220, 38, 38, 0.12)', color: '#dc2626' }}>
                        Expired
                      </span>
                    )}
                  </div>
                </div>
                <p style={{ margin: '0 0 0.4rem', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                  {camp.address} • Jurisdiction: <strong>{camp.jurisdiction}</strong> • Helpline: <strong>{camp.contact}</strong>
                </p>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Authority: {camp.authority} | Effective: {camp.effectiveDate} | Last Verified: {camp.verifiedAt}
                </p>
                {camp.freshness.warning && (
                  <p style={{ margin: '0.4rem 0 0', fontSize: '0.78rem', color: '#b45309' }}>
                    ⚠️ {camp.freshness.warning}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Relief Entitlements */}
      <section aria-label="Relief Entitlements">
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>
          Official Relief Entitlements &amp; Norms ({entitlements.length})
        </h2>
        <div style={{ display: 'grid', gap: '0.85rem' }}>
          {entitlements.map((ent) => (
            <article
              key={ent.id}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                borderRadius: '0.65rem',
                padding: '1rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.98rem' }}>{ent.title}</h3>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    padding: '0.18rem 0.5rem',
                    borderRadius: '999px',
                    background: ent.freshness.isUnverified ? 'rgba(220, 38, 38, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                    color: ent.freshness.isUnverified ? '#dc2626' : '#1d4ed8',
                  }}
                >
                  {ent.freshness.isUnverified ? 'Unverified Rule' : 'Verified Official Norm'}
                </span>
              </div>
              <p style={{ margin: '0 0 0.35rem', fontSize: '0.84rem' }}>{ent.summary}</p>
              <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                Jurisdiction: {ent.jurisdiction} | Authority: {ent.authority} | Source: {ent.source || 'Unverified'} | Verified: {ent.verifiedAt || 'Unverified'}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
