import { useState } from 'react';
import { Navigation } from 'lucide-react';
import {
  DEPTH_CATEGORIES,
  SOURCE_TIERS,
  REPORT_STATUS,
  INCIDENT_TYPES,
} from '../../data/upFloodIncidentContract';

export default function FloodInteractiveMap({
  incidents,
  selectedIncidentId,
  onSelectIncident,
}) {
  const [activePinDetail, setActivePinDetail] = useState(null);

  // Fallback lat/lng center for UP is Lucknow (~26.85, 80.94)
  // We project latitude (25.0 - 27.5) and longitude (80.0 - 83.5) to SVG canvas (800x500)
  const minLat = 24.5;
  const maxLat = 28.0;
  const minLng = 79.5;
  const maxLng = 83.5;

  const projectToSvg = (lat, lng, index = 0) => {
    // If coords are missing or default, generate deterministic locality layout
    const validLat = typeof lat === 'number' ? lat : 26.85 + (index % 4) * 0.2;
    const validLng = typeof lng === 'number' ? lng : 80.94 + ((index * 3) % 5) * 0.25;

    const x = Math.max(40, Math.min(760, ((validLng - minLng) / (maxLng - minLng)) * 720 + 40));
    const y = Math.max(40, Math.min(460, (1 - (validLat - minLat) / (maxLat - minLat)) * 420 + 40));
    return { x, y };
  };

  const getPinColor = (item) => {
    if (item.effectiveStatus === REPORT_STATUS.CLEARED) return '#10b981'; // Green
    if (item.isStale) return '#64748b'; // Slate gray for stale
    if (item.sourceTier === SOURCE_TIERS.OFFICIAL_EMERGENCY_ALERT || item.depthCategory === DEPTH_CATEGORIES.WAIST_DEEP_OR_HIGHER) {
      return '#ef4444'; // Red
    }
    if (item.depthCategory === DEPTH_CATEGORIES.KNEE_DEEP) {
      return '#f97316'; // Orange
    }
    if (item.incidentType === INCIDENT_TYPES.BLOCKED_DRAIN) {
      return '#eab308'; // Amber
    }
    return '#3b82f6'; // Blue
  };

  return (
    <div
      className="flood-interactive-map"
      style={{
        background: 'var(--bg-card, #0f172a)',
        borderRadius: '0.75rem',
        border: '1px solid var(--border-light, #334155)',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Navigation size={18} color="var(--accent, #38bdf8)" />
            UP Geographic Hazard Grid (Map/List Parity)
          </h2>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Total Visible Map Pins: <strong>{incidents.length}</strong> (100% matched with incident list)
          </span>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }}></span> Waist-deep / Alert
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f97316' }}></span> Knee-deep
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#eab308' }}></span> Blocked Drain
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#64748b' }}></span> Stale Observation
          </span>
        </div>
      </div>

      {/* SVG Map Canvas */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '420px',
          background: 'linear-gradient(180deg, #0b1329 0%, #030712 100%)',
          borderRadius: '0.5rem',
          border: '1px solid var(--border-light, #1e293b)',
          overflow: 'hidden',
        }}
      >
        <svg
          viewBox="0 0 800 500"
          style={{ width: '100%', height: '100%' }}
          role="img"
          aria-label="UP Waterlogging Map Grid"
        >
          {/* Subtle Grid Lines for Regional Orientation */}
          <line x1="40" y1="125" x2="760" y2="125" stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />
          <line x1="40" y1="250" x2="760" y2="250" stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />
          <line x1="40" y1="375" x2="760" y2="375" stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />
          <line x1="200" y1="40" x2="200" y2="460" stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />
          <line x1="400" y1="40" x2="400" y2="460" stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />
          <line x1="600" y1="40" x2="600" y2="460" stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />

          {/* Regional Reference Labels */}
          <text x="280" y="240" fill="rgba(148, 163, 184, 0.25)" fontSize="18" fontWeight="700">LUCKNOW ZONE</text>
          <text x="180" y="320" fill="rgba(148, 163, 184, 0.25)" fontSize="18" fontWeight="700">KANPUR ZONE</text>
          <text x="560" y="380" fill="rgba(148, 163, 184, 0.25)" fontSize="18" fontWeight="700">VARANASI ZONE</text>
          <text x="440" y="420" fill="rgba(148, 163, 184, 0.25)" fontSize="18" fontWeight="700">PRAYAGRAJ ZONE</text>

          {/* Incident Pins */}
          {incidents.map((item, index) => {
            const { x, y } = projectToSvg(item.coordinates?.lat, item.coordinates?.lng, index);
            const isSelected = selectedIncidentId === item.id;
            const color = getPinColor(item);

            return (
              <g
                key={item.id}
                onClick={() => {
                  setActivePinDetail(item);
                  if (onSelectIncident) onSelectIncident(item.id);
                }}
                style={{ cursor: 'pointer' }}
                tabIndex={0}
                role="button"
                aria-label={`${item.locality}: ${item.depthCategory}`}
              >
                {/* Pulsing ring for severe hazards */}
                {!item.isStale && item.depthCategory === DEPTH_CATEGORIES.WAIST_DEEP_OR_HIGHER && (
                  <circle cx={x} cy={y} r="18" fill="rgba(239, 68, 68, 0.25)">
                    <animate attributeName="r" values="10;22;10" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.8;0.1;0.8" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}

                {/* Marker Body */}
                <circle
                  cx={x}
                  cy={y}
                  r={isSelected ? 10 : 7}
                  fill={color}
                  stroke="#ffffff"
                  strokeWidth={isSelected ? 3 : 1.5}
                />

                {/* Label */}
                <text
                  x={x + 12}
                  y={y + 4}
                  fill="#f8fafc"
                  fontSize="11"
                  fontWeight={isSelected ? '700' : '500'}
                  style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
                >
                  {item.locality.split(',')[0].slice(0, 24)}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Selected Pin Overlay Card */}
        {activePinDetail && (
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '12px',
              right: '12px',
              background: 'rgba(15, 23, 42, 0.95)',
              backdropFilter: 'blur(8px)',
              border: '1px solid var(--border-light, #334155)',
              borderRadius: '0.5rem',
              padding: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              zIndex: 10,
            }}
          >
            <div>
              <strong style={{ fontSize: '0.9rem', display: 'block', color: '#ffffff' }}>
                {activePinDetail.locality} ({activePinDetail.district})
              </strong>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {activePinDetail.depthCategory} • {activePinDetail.freshnessLabel}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActivePinDetail(null)}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
