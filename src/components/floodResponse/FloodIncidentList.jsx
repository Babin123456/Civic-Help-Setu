import {
  Clock,
  MapPin,
  CheckCircle,
  ThumbsUp,
  Building2,
  Users,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import {
  SOURCE_TIERS,
  DEPTH_LABELS,
  REPORT_STATUS,
} from '../../data/upFloodIncidentContract';

export default function FloodIncidentList({
  incidents,
  lowBandwidthMode,
  onReconfirm,
  onSelectIncident,
  selectedIncidentId,
}) {
  if (!incidents || incidents.length === 0) {
    return (
      <div
        style={{
          padding: '2.5rem 1rem',
          textAlign: 'center',
          background: 'var(--bg-card)',
          borderRadius: '0.75rem',
          border: '1px solid var(--border-light)',
          color: 'var(--text-secondary)',
        }}
      >
        <AlertCircle size={32} style={{ margin: '0 auto 0.5rem auto', color: '#94a3b8' }} />
        <p style={{ margin: 0, fontWeight: 600 }}>No incident reports match the current filters.</p>
        <span style={{ fontSize: '0.8rem' }}>Try clearing filters or switching districts.</span>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // LOW BANDWIDTH MODE: Clean, Ultra-light Semantic Table
  // -------------------------------------------------------------------------
  if (lowBandwidthMode) {
    return (
      <div
        className="low-bandwidth-container"
        style={{
          background: 'var(--bg-card)',
          borderRadius: '0.5rem',
          border: '1px solid var(--border-light)',
          padding: '0.75rem',
          overflowX: 'auto',
        }}
      >
        <div style={{ fontSize: '0.8rem', color: '#eab308', marginBottom: '0.5rem', fontWeight: 600 }}>
          ⚡ Low-Bandwidth Mode Active: Images and map tiles disabled for fast transmission.
        </div>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.82rem',
            textAlign: 'left',
          }}
        >
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '0.5rem' }}>Locality / Ward</th>
              <th style={{ padding: '0.5rem' }}>District</th>
              <th style={{ padding: '0.5rem' }}>Type &amp; Depth</th>
              <th style={{ padding: '0.5rem' }}>Source</th>
              <th style={{ padding: '0.5rem' }}>Freshness</th>
              <th style={{ padding: '0.5rem' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {incidents.map((item) => (
              <tr
                key={item.id}
                style={{
                  borderBottom: '1px solid var(--border-light)',
                  background: item.isStale ? 'rgba(100, 116, 139, 0.08)' : undefined,
                }}
              >
                <td style={{ padding: '0.5rem', fontWeight: 600 }}>
                  {item.locality}
                  {item.ward && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.ward}</div>}
                </td>
                <td style={{ padding: '0.5rem' }}>{item.district}</td>
                <td style={{ padding: '0.5rem' }}>
                  <div>{item.incidentType.replace('_', ' ').toUpperCase()}</div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                    {DEPTH_LABELS[item.depthCategory] || item.depthCategory}
                  </span>
                </td>
                <td style={{ padding: '0.5rem' }}>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      padding: '0.15rem 0.4rem',
                      borderRadius: '0.25rem',
                      background:
                        item.sourceTier === SOURCE_TIERS.OFFICIAL_EMERGENCY_ALERT
                          ? '#7f1d1d'
                          : item.sourceTier === SOURCE_TIERS.MUNICIPAL_ADVISORY
                          ? '#78350f'
                          : '#1e3a8a',
                      color: '#ffffff',
                    }}
                  >
                    {item.sourceTier === SOURCE_TIERS.OFFICIAL_EMERGENCY_ALERT
                      ? 'OFFICIAL ALERT'
                      : item.sourceTier === SOURCE_TIERS.MUNICIPAL_ADVISORY
                      ? 'MUNICIPAL'
                      : 'CITIZEN'}
                  </span>
                </td>
                <td style={{ padding: '0.5rem', fontSize: '0.75rem' }}>
                  <span style={{ color: item.isStale ? '#f59e0b' : '#10b981', fontWeight: item.isStale ? 700 : 500 }}>
                    {item.freshnessLabel}
                  </span>
                </td>
                <td style={{ padding: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => onReconfirm(item.id, 'still_flooded')}
                    style={{
                      fontSize: '0.72rem',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.25rem',
                      background: 'var(--btn-bg, #334155)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-light)',
                      cursor: 'pointer',
                    }}
                  >
                    Reconfirm
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // STANDARD INTERACTIVE CARD FEED
  // -------------------------------------------------------------------------
  return (
    <div className="incident-card-feed" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {incidents.map((item) => {
        const isSelected = selectedIncidentId === item.id;
        const isOfficial = item.sourceTier === SOURCE_TIERS.OFFICIAL_EMERGENCY_ALERT;
        const isMunicipal = item.sourceTier === SOURCE_TIERS.MUNICIPAL_ADVISORY;

        return (
          <article
            key={item.id}
            onClick={() => onSelectIncident && onSelectIncident(item.id)}
            style={{
              padding: '1rem',
              borderRadius: '0.75rem',
              background: isSelected ? 'var(--bg-card-hover, #1e293b)' : 'var(--bg-card, #0f172a)',
              border: isSelected
                ? '2px solid var(--accent, #38bdf8)'
                : isOfficial
                ? '1px solid #ef4444'
                : '1px solid var(--border-light, #334155)',
              transition: 'border 0.2s ease',
              position: 'relative',
            }}
          >
            {/* Header row with badges */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                {/* Source Tier Badge */}
                {isOfficial ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.5rem',
                      borderRadius: '0.35rem',
                      background: '#ef4444',
                      color: '#ffffff',
                    }}
                  >
                    <ShieldCheck size={13} /> OFFICIAL ALERT
                  </span>
                ) : isMunicipal ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.5rem',
                      borderRadius: '0.35rem',
                      background: '#d97706',
                      color: '#ffffff',
                    }}
                  >
                    <Building2 size={13} /> MUNICIPAL ADVISORY
                  </span>
                ) : (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      padding: '0.2rem 0.5rem',
                      borderRadius: '0.35rem',
                      background: '#2563eb',
                      color: '#ffffff',
                    }}
                  >
                    <Users size={13} /> CITIZEN REPORT
                  </span>
                )}

                {/* Status / Dispute Badge */}
                {item.effectiveStatus === REPORT_STATUS.DISPUTED && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.5rem',
                      borderRadius: '0.35rem',
                      background: '#e11d48',
                      color: '#ffffff',
                    }}
                  >
                    CONTRADICTORY REPORTS: UNDER DISPUTE
                  </span>
                )}

                {item.effectiveStatus === REPORT_STATUS.CLEARED && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.5rem',
                      borderRadius: '0.35rem',
                      background: '#10b981',
                      color: '#ffffff',
                    }}
                  >
                    WATER RECEDED / PASSABLE
                  </span>
                )}
              </div>

              {/* Freshness Badge */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontSize: '0.75rem',
                  color: item.isStale ? '#f59e0b' : '#34d399',
                  background: item.isStale ? 'rgba(245, 158, 11, 0.1)' : 'rgba(52, 211, 153, 0.1)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '0.35rem',
                  fontWeight: item.isStale ? 700 : 500,
                }}
              >
                <Clock size={12} />
                {item.freshnessLabel}
              </div>
            </div>

            {/* Stale Warning Banner */}
            {item.isStale && item.effectiveStatus !== REPORT_STATUS.CLEARED && (
              <div
                style={{
                  background: 'rgba(245, 158, 11, 0.15)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  color: '#fbbf24',
                  fontSize: '0.76rem',
                  padding: '0.35rem 0.6rem',
                  borderRadius: '0.4rem',
                  marginBottom: '0.6rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                <span>
                  <strong>Stale Observation:</strong> This report is older than the 2-hour observation window and is
                  excluded from active hazard routing. Please reconfirm if water is still present.
                </span>
              </div>
            )}

            {/* Locality & Details */}
            <div style={{ marginBottom: '0.6rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <MapPin size={16} color="var(--accent, #38bdf8)" />
                {item.locality}
              </h3>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {item.district}, UP {item.ward && `• ${item.ward}`}
                {item.corridorName && ` • Corridor: ${item.corridorName}`}
              </div>
            </div>

            {/* Depth & Notes */}
            <div style={{ fontSize: '0.85rem', marginBottom: '0.75rem', lineHeight: '1.4' }}>
              <div style={{ marginBottom: '0.25rem' }}>
                <strong style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>WATER DEPTH / PASSABILITY: </strong>
                <span style={{ fontWeight: 600 }}>{DEPTH_LABELS[item.depthCategory] || item.depthCategory}</span>
              </div>
              {item.notes && <p style={{ margin: '0.25rem 0', color: 'var(--text-primary)' }}>{item.notes}</p>}
            </div>

            {/* Issuing Authority Link if Official */}
            {item.issuingAuthority && (
              <div
                style={{
                  fontSize: '0.78rem',
                  background: 'var(--bg-card-hover, rgba(255,255,255,0.03))',
                  padding: '0.4rem 0.6rem',
                  borderRadius: '0.4rem',
                  marginBottom: '0.75rem',
                  border: '1px solid var(--border-light)',
                }}
              >
                <strong>Issuing Authority:</strong> {item.issuingAuthority}
                {item.officialBulletinRef && (
                  <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    Bulletin Ref: {item.officialBulletinRef}
                  </span>
                )}
              </div>
            )}

            {/* Action Buttons: Community Reconfirmation */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.5rem',
                borderTop: '1px solid var(--border-light)',
                paddingTop: '0.6rem',
              }}
            >
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {item.reconfirmationsCount || 0} community reconfirmations
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReconfirm(item.id, 'still_flooded');
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{
                    fontSize: '0.78rem',
                    padding: '0.3rem 0.6rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                  title="Reconfirm that water is still standing"
                >
                  <ThumbsUp size={13} /> Still Flooded
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReconfirm(item.id, 'water_receded');
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{
                    fontSize: '0.78rem',
                    padding: '0.3rem 0.6rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                  title="Report that water has cleared"
                >
                  <CheckCircle size={13} /> Cleared / Passable
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
