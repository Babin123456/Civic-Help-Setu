import { useState, useMemo } from 'react';
import {
  MapPin,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  AlertTriangle,
  ShieldAlert,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { CASE_STATE_LABELS } from '../../data/roadSafetyContract';

const MAP_BOUNDS = {
  minLat: 8.0,
  maxLat: 33.0,
  minLng: 71.0,
  maxLng: 90.0,
};

function projectGeoToSvg(lat, lng, width = 800, height = 500) {
  const x = ((lng - MAP_BOUNDS.minLng) / (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng)) * width;
  const y = ((MAP_BOUNDS.maxLat - lat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * height;
  return {
    x: Math.max(40, Math.min(width - 40, x)),
    y: Math.max(40, Math.min(height - 40, y)),
  };
}

function getPriorityDetails(score) {
  if (score >= 75) {
    return {
      tier: 'Priority 1 (Critical)',
      color: '#ef4444',
      haloColor: 'rgba(239, 68, 68, 0.25)',
      radius: 14,
    };
  }
  if (score >= 50) {
    return {
      tier: 'Priority 2 (High)',
      color: '#f59e0b',
      haloColor: 'rgba(245, 158, 11, 0.25)',
      radius: 11,
    };
  }
  return {
    tier: 'Priority 3 (Moderate)',
    color: '#10b981',
    haloColor: 'rgba(16, 185, 129, 0.25)',
    radius: 9,
  };
}

export default function RoadSafetyInteractiveMap({
  cases = [],
  onSelectCase = () => {},
}) {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedCaseId, setSelectedCaseId] = useState(null);

  const svgWidth = 800;
  const svgHeight = 500;

  const projectedItems = useMemo(() => {
    return cases.map((c) => {
      const seg = c.segment;
      const start = seg?.startCoords || { lat: 20, lng: 78 };
      const end = seg?.endCoords || start;
      const midLat = (start.lat + end.lat) / 2;
      const midLng = (start.lng + end.lng) / 2;

      const pStart = projectGeoToSvg(start.lat, start.lng, svgWidth, svgHeight);
      const pEnd = projectGeoToSvg(end.lat, end.lng, svgWidth, svgHeight);
      const pMid = projectGeoToSvg(midLat, midLng, svgWidth, svgHeight);
      const priority = getPriorityDetails(c.compositeRiskScore);

      return {
        caseItem: c,
        segment: seg,
        pStart,
        pEnd,
        pMid,
        priority,
      };
    });
  }, [cases]);

  const activeItem = useMemo(() => {
    if (!selectedCaseId) return projectedItems[0] || null;
    return projectedItems.find((p) => p.caseItem.id === selectedCaseId) || projectedItems[0] || null;
  }, [selectedCaseId, projectedItems]);

  const handleZoomIn = () => setZoomLevel((z) => Math.min(z + 0.25, 2.0));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(z - 0.25, 0.75));
  const handleZoomReset = () => setZoomLevel(1);

  return (
    <div
      role="region"
      aria-label="Interactive road safety blackspot corridor map"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-main)',
        borderRadius: '0.75rem',
        overflow: 'hidden',
        marginBottom: '1.5rem',
      }}
    >
      {/* Top Map Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          padding: '0.75rem 1rem',
          background: 'var(--bg-main)',
          borderBottom: '1px solid var(--border-main)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MapPin size={18} color="var(--accent-main)" />
          <span style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            Spatial Blackspot Distribution Map
          </span>
          <span
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-tertiary)',
              background: 'var(--bg-surface)',
              padding: '0.15rem 0.5rem',
              borderRadius: '999px',
              border: '1px solid var(--border-main)',
            }}
          >
            {cases.length} Corridors
          </span>
        </div>

        {/* Legend & Zoom controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.72rem' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#ef4444' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} /> Priority 1
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#f59e0b' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} /> Priority 2
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#10b981' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} /> Priority 3
            </span>
          </div>

          <div
            role="toolbar"
            aria-label="Map zoom controls"
            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
          >
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleZoomIn}
              aria-label="Zoom in on map"
              style={{ padding: '0.3rem 0.5rem' }}
            >
              <ZoomIn size={14} />
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleZoomOut}
              aria-label="Zoom out on map"
              style={{ padding: '0.3rem 0.5rem' }}
            >
              <ZoomOut size={14} />
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleZoomReset}
              aria-label="Reset map zoom"
              style={{ padding: '0.3rem 0.5rem' }}
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-surface)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '1rem',
        }}
      >
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{
            width: '100%',
            maxHeight: '440px',
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'center center',
            transition: 'transform 0.2s ease-out',
          }}
          role="img"
          aria-label="Map showing geo-located road corridors and blackspot candidate clusters"
        >
          {/* Subtle Geographic Background Grid */}
          <defs>
            <pattern id="roadGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--border-main)" strokeWidth="0.5" strokeOpacity="0.4" />
            </pattern>
          </defs>
          <rect width={svgWidth} height={svgHeight} fill="url(#roadGrid)" />

          {/* India Regional Latitude / Longitude Guide Lines */}
          <line x1="40" y1="120" x2={svgWidth - 40} y2="120" stroke="var(--border-main)" strokeDasharray="3,3" strokeOpacity="0.5" />
          <line x1="40" y1="260" x2={svgWidth - 40} y2="260" stroke="var(--border-main)" strokeDasharray="3,3" strokeOpacity="0.5" />
          <line x1="40" y1="400" x2={svgWidth - 40} y2="400" stroke="var(--border-main)" strokeDasharray="3,3" strokeOpacity="0.5" />
          <text x="50" y="115" fontSize="10" fill="var(--text-tertiary)">28°N (Northern Arterials)</text>
          <text x="50" y="255" fontSize="10" fill="var(--text-tertiary)">19°N (Central Corridors)</text>
          <text x="50" y="395" fontSize="10" fill="var(--text-tertiary)">13°N (Southern Expressways)</text>

          {/* Render Corridor Segment Paths */}
          {projectedItems.map(({ caseItem, segment, pStart, pEnd, pMid, priority }) => {
            const isSelected = (activeItem?.caseItem?.id === caseItem.id);

            return (
              <g key={`corridor-${caseItem.id}`}>
                {/* Corridor vector segment line */}
                <line
                  x1={pStart.x}
                  y1={pStart.y}
                  x2={pEnd.x}
                  y2={pEnd.y}
                  stroke={priority.color}
                  strokeWidth={isSelected ? 6 : 3.5}
                  strokeLinecap="round"
                  strokeOpacity={isSelected ? 0.95 : 0.7}
                />

                {/* Hotspot Cluster Marker Pin */}
                <g
                  role="button"
                  tabIndex={0}
                  aria-label={`${segment?.name || 'Road Corridor'}, Risk Score ${caseItem.compositeRiskScore}/100, ${priority.tier}. Click or press Enter to inspect evidence.`}
                  style={{ cursor: 'pointer', outline: 'none' }}
                  onClick={() => {
                    setSelectedCaseId(caseItem.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedCaseId(caseItem.id);
                      onSelectCase(caseItem);
                    }
                  }}
                >
                  {/* Outer pulsating halo circle */}
                  <circle
                    cx={pMid.x}
                    cy={pMid.y}
                    r={isSelected ? priority.radius * 1.8 : priority.radius * 1.3}
                    fill={priority.haloColor}
                    stroke={priority.color}
                    strokeWidth={isSelected ? 2 : 1}
                    strokeDasharray={isSelected ? '2,2' : 'none'}
                  />

                  {/* Core blackspot pin */}
                  <circle
                    cx={pMid.x}
                    cy={pMid.y}
                    r={priority.radius}
                    fill={priority.color}
                    stroke="#ffffff"
                    strokeWidth={2}
                  />

                  {/* Risk Score Label inside pin */}
                  <text
                    x={pMid.x}
                    y={pMid.y + 4}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="10"
                    fontWeight="800"
                  >
                    {caseItem.compositeRiskScore}
                  </text>

                  {/* Corridor Short Label */}
                  <text
                    x={pMid.x}
                    y={pMid.y - (priority.radius + 6)}
                    textAnchor="middle"
                    fill="var(--text-primary)"
                    fontSize="11"
                    fontWeight={isSelected ? '700' : '600'}
                    style={{
                      paintOrder: 'stroke',
                      stroke: 'var(--bg-surface)',
                      strokeWidth: 3,
                    }}
                  >
                    {segment?.code || segment?.name?.slice(0, 18)}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Active Corridor Card & Inspector Panel */}
      {activeItem && (
        <div
          role="region"
          aria-label="Selected corridor inspector"
          style={{
            padding: '1rem',
            background: 'var(--bg-main)',
            borderTop: '1px solid var(--border-main)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
            <div
              style={{
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '0.5rem',
                background: activeItem.priority.haloColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {activeItem.caseItem.compositeRiskScore >= 75 ? (
                <ShieldAlert size={20} color={activeItem.priority.color} />
              ) : (
                <AlertTriangle size={20} color={activeItem.priority.color} />
              )}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.92rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                  {activeItem.segment?.name}
                </span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: '700',
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                    background: activeItem.priority.haloColor,
                    color: activeItem.priority.color,
                  }}
                >
                  Score: {activeItem.caseItem.compositeRiskScore}/100 ({activeItem.priority.tier})
                </span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: 'var(--text-tertiary)',
                  }}
                >
                  [{CASE_STATE_LABELS[activeItem.caseItem.status] || activeItem.caseItem.status}]
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)',
                  marginTop: '0.25rem',
                  flexWrap: 'wrap',
                }}
              >
                <span>
                  <strong>Jurisdiction:</strong> {activeItem.segment?.jurisdiction?.district}, {activeItem.segment?.jurisdiction?.state}
                </span>
                <span>
                  <strong>Length:</strong> {activeItem.segment?.lengthMeters}m
                </span>
                <span>
                  <strong>Speed Limit:</strong> {activeItem.segment?.speedLimitKmph} km/h
                </span>
                <span>
                  <strong>Severity Index:</strong> {activeItem.caseItem.severityWeightedFrequency}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onSelectCase(activeItem.caseItem)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}
          >
            <Eye size={14} />
            <span>Review Full Evidence</span>
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
