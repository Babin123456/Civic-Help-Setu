import { useMemo } from 'react';
import {
  MapPin,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Layers,
  Compass,
} from 'lucide-react';
import { PROJECT_STATUSES } from '../../services/publicProjectService';

const STATUS_ICONS = {
  [PROJECT_STATUSES.PLANNED]: Clock,
  [PROJECT_STATUSES.ACTIVE]: Compass,
  [PROJECT_STATUSES.DELAYED]: AlertTriangle,
  [PROJECT_STATUSES.COMPLETED]: CheckCircle2,
  [PROJECT_STATUSES.ABANDONED]: AlertTriangle,
};

const STATUS_COLORS = {
  [PROJECT_STATUSES.PLANNED]: { bg: 'rgba(148, 163, 184, 0.2)', border: '#94a3b8', text: '#cbd5e1' },
  [PROJECT_STATUSES.ACTIVE]: { bg: 'rgba(56, 189, 248, 0.2)', border: '#38bdf8', text: '#38bdf8' },
  [PROJECT_STATUSES.DELAYED]: { bg: 'rgba(245, 158, 11, 0.2)', border: '#f59e0b', text: '#f59e0b' },
  [PROJECT_STATUSES.COMPLETED]: { bg: 'rgba(16, 185, 129, 0.2)', border: '#10b981', text: '#10b981' },
  [PROJECT_STATUSES.ABANDONED]: { bg: 'rgba(239, 68, 68, 0.2)', border: '#ef4444', text: '#ef4444' },
};

/**
 * Coordinate projector mapping Bangalore municipal bounds to SVG viewBox (0 0 800 500)
 * Min Lat: 12.92, Max Lat: 13.08
 * Min Lng: 77.52, Max Lng: 77.68
 */
const MIN_LAT = 12.92;
const MAX_LAT = 13.08;
const MIN_LNG = 77.52;
const MAX_LNG = 77.68;

function projectCoords(lat, lng) {
  const x = ((lng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * 740 + 30;
  const y = (1 - (lat - MIN_LAT) / (MAX_LAT - MIN_LAT)) * 440 + 30;
  return [Math.max(30, Math.min(770, x)), Math.max(30, Math.min(470, y))];
}

const ProjectMapViewer = ({
  projects = [],
  selectedProjectId = null,
  onSelectProject,
}) => {
  const projectedProjects = useMemo(() => {
    return projects.map((p) => {
      const geom = p.locationGeometry || {};
      const centerLat = geom.centerLat || 12.9716;
      const centerLng = geom.centerLng || 77.5946;
      const [cx, cy] = projectCoords(centerLat, centerLng);

      let pathD = '';
      if (geom.type === 'LineString' && Array.isArray(geom.coordinates)) {
        const points = geom.coordinates.map(([lng, lat]) => projectCoords(lat, lng));
        pathD = points.reduce((acc, [px, py], idx) => {
          return idx === 0 ? `M ${px} ${py}` : `${acc} L ${px} ${py}`;
        }, '');
      }

      return {
        ...p,
        svgX: cx,
        svgY: cy,
        svgPath: pathD,
      };
    });
  }, [projects]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div
      className="project-map-viewer"
      style={{
        background: 'var(--bg-card, #1e293b)',
        border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
        borderRadius: '12px',
        padding: '1.25rem',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Layers size={18} style={{ color: 'var(--accent-main, #38bdf8)' }} />
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary, #f8fafc)' }}>
            Geospatial Infrastructure Map
          </h3>
          <span
            style={{
              fontSize: '0.75rem',
              padding: '0.15rem 0.5rem',
              borderRadius: '999px',
              background: 'rgba(56, 189, 248, 0.15)',
              color: 'var(--accent-main, #38bdf8)',
              fontWeight: 600,
            }}
          >
            {projects.length} Active Corridors
          </span>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.75rem' }}>
          {Object.entries(PROJECT_STATUSES).map(([key, val]) => {
            const Icon = STATUS_ICONS[val];
            const col = STATUS_COLORS[val];
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: col.text }}>
                <Icon size={13} />
                <span>{val}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* SVG Canvas Map */}
      <div
        style={{
          width: '100%',
          height: '420px',
          background: 'radial-gradient(ellipse at center, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 1) 100%)',
          borderRadius: '8px',
          position: 'relative',
          border: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        <svg
          viewBox="0 0 800 500"
          style={{ width: '100%', height: '100%', display: 'block' }}
          role="img"
          aria-label="Map showing locations of public infrastructure works across municipal wards"
        >
          {/* Subtle Grid Lines */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="800" height="500" fill="url(#grid)" />

          {/* Municipal Outer Ring Guidance */}
          <path
            d="M 120 180 Q 280 80 500 120 T 720 280 Q 640 440 400 420 T 120 180"
            fill="none"
            stroke="rgba(56, 189, 248, 0.12)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />

          {/* Linear Corridor Paths (Roads / Drains) */}
          {projectedProjects.map((proj) => {
            if (!proj.svgPath) return null;
            const isSelected = proj.id === selectedProjectId;
            const col = STATUS_COLORS[proj.status] || STATUS_COLORS.ACTIVE;

            return (
              <g key={`path-${proj.id}`}>
                <path
                  d={proj.svgPath}
                  fill="none"
                  stroke={isSelected ? '#38bdf8' : col.border}
                  strokeWidth={isSelected ? '6' : '3.5'}
                  strokeLinecap="round"
                  strokeOpacity={isSelected ? 1 : 0.75}
                  style={{ transition: 'stroke-width 0.2s ease, stroke-opacity 0.2s ease' }}
                />
              </g>
            );
          })}

          {/* Project Pins & Labels */}
          {projectedProjects.map((proj) => {
            const isSelected = proj.id === selectedProjectId;
            const col = STATUS_COLORS[proj.status] || STATUS_COLORS.ACTIVE;

            return (
              <g
                key={`node-${proj.id}`}
                transform={`translate(${proj.svgX}, ${proj.svgY})`}
                style={{ cursor: 'pointer' }}
                onClick={() => onSelectProject && onSelectProject(proj.id)}
                role="button"
                tabIndex={0}
                aria-label={`Project: ${proj.title}, Category: ${proj.category}, Status: ${proj.status}, Progress: ${proj.overallProgressPercent}%`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectProject && onSelectProject(proj.id);
                  }
                }}
              >
                {/* Glow ring if selected */}
                {isSelected && (
                  <circle
                    r="24"
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="2"
                    strokeOpacity="0.8"
                    strokeDasharray="3 3"
                  />
                )}

                {/* Pin Circle */}
                <circle
                  r={isSelected ? 14 : 11}
                  fill={col.bg}
                  stroke={isSelected ? '#ffffff' : col.border}
                  strokeWidth={isSelected ? 3 : 2}
                />

                {/* Progress Text inside circle */}
                <text
                  textAnchor="middle"
                  dy="4"
                  fill="#ffffff"
                  fontSize={isSelected ? '9' : '8'}
                  fontWeight="bold"
                >
                  {`${proj.overallProgressPercent}%`}
                </text>

                {/* Tooltip / Label Card */}
                <g transform="translate(0, -22)">
                  <rect
                    x="-65"
                    y="-18"
                    width="130"
                    height="18"
                    rx="4"
                    fill="rgba(15, 23, 42, 0.92)"
                    stroke={isSelected ? '#38bdf8' : 'rgba(255, 255, 255, 0.15)'}
                    strokeWidth="1"
                  />
                  <text
                    x="0"
                    y="-6"
                    textAnchor="middle"
                    fill="var(--text-primary, #f8fafc)"
                    fontSize="7.5"
                    fontWeight="600"
                  >
                    {proj.jurisdiction?.wardNumber || 'Ward'} • {proj.category}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>

        {/* Selected Project Callout Overlay */}
        {selectedProject && (
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '12px',
              right: '12px',
              background: 'rgba(15, 23, 42, 0.92)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                <MapPin size={14} style={{ color: 'var(--accent-main, #38bdf8)' }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-main, #38bdf8)' }}>
                  {selectedProject.jurisdiction?.wardNumber} - {selectedProject.jurisdiction?.wardName}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
                  • {selectedProject.locationGeometry?.landmark || 'Bangalore Urban'}
                </span>
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary, #f8fafc)' }}>
                {selectedProject.title}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary, #94a3b8)', display: 'block' }}>
                  Progress
                </span>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#10b981' }}>
                  {selectedProject.overallProgressPercent}% Complete
                </span>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                onClick={() => onSelectProject && onSelectProject(selectedProject.id)}
              >
                Inspect Timeline
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectMapViewer;
