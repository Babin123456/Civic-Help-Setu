import { useState, useMemo } from 'react';
import {
  MapPin,
  Navigation,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Clock,
  ExternalLink,
  Calendar,
  Layers,
} from 'lucide-react';
import { formatDistance } from '../../services/locationService';
import { safeHttpUrl } from '../../utils/safeContent';

// Geographic bounding box for coordinate to SVG projection (India Region)
const MAP_BOUNDS = {
  minLat: 8.0,
  maxLat: 33.0,
  minLng: 71.0,
  maxLng: 90.0,
};

const getCategoryColor = (category = '') => {
  const cat = category.toLowerCase();
  if (cat.includes('transport')) return '#3b82f6'; // Blue
  if (cat.includes('passport')) return '#8b5cf6'; // Purple
  if (cat.includes('aadhaar') || cat.includes('identity')) return '#f59e0b'; // Amber
  if (cat.includes('revenue') || cat.includes('certificate')) return '#10b981'; // Green
  return '#ec4899'; // Pink / Default
};

// Category colours are fine as pin fills, but too light to read as text on a light panel.
// Mixing them with the theme's text colour keeps the hue and gets the contrast back.
const getCategoryTextColor = (category) =>
  `color-mix(in srgb, ${getCategoryColor(category)} 60%, var(--text-primary))`;

// Outline in the canvas colour so SVG labels stay readable over grid lines and other pins
const LABEL_HALO = {
  stroke: 'var(--map-halo)',
  strokeWidth: 3,
  strokeLinejoin: 'round',
  paintOrder: 'stroke',
};

const LABEL_GAP_PX = 12;

const InteractiveOfficeMap = ({
  offices = [],
  userCoords = null,
  selectedOffice = null,
  onSelectOffice = () => {},
  onBookAppointment = () => {},
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [activePin, setActivePin] = useState(null);

  // SVG dimensions
  const width = 800;
  const height = 520;

  // Convert GPS Coordinates (lat/lng) to SVG Canvas (x, y)
  const projectCoords = useMemo(() => {
    return (lat, lng) => {
      const xRatio = (lng - MAP_BOUNDS.minLng) / (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng);
      // Invert Y because latitude increases northward while SVG Y increases downward
      const yRatio = (MAP_BOUNDS.maxLat - lat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat);
      return {
        x: Math.max(30, Math.min(width - 30, xRatio * width)),
        y: Math.max(30, Math.min(height - 30, yRatio * height)),
      };
    };
  }, [width, height]);

  const userPoint = useMemo(() => {
    if (!userCoords || !userCoords.lat || !userCoords.lng) return null;
    return projectCoords(userCoords.lat, userCoords.lng);
  }, [userCoords, projectCoords]);

  const projectedOffices = useMemo(() => {
    const placed = [];
    offices.forEach((office) => {
      const pt = projectCoords(office.coordinates.lat, office.coordinates.lng);
      // Pins in the same city land on (almost) the same spot. Skip a label that repeats the
      // one already drawn there and push a different label down so the two do not overlap.
      const near = placed.filter((o) => Math.abs(o.svgX - pt.x) < 60 && Math.abs(o.svgY - pt.y) < 14);
      const duplicate = near.find((o) => o.city === office.city);
      const stacked = new Set(near.filter((o) => o.showLabel).map((o) => o.labelY)).size;
      placed.push({
        ...office,
        svgX: pt.x,
        svgY: pt.y,
        color: getCategoryColor(office.category),
        showLabel: !duplicate,
        labelY: duplicate ? duplicate.labelY : 20 + stacked * LABEL_GAP_PX,
      });
    });
    return placed;
  }, [offices, projectCoords]);

  const currentActive = selectedOffice || activePin;

  return (
    <div
      className="glass-panel"
      style={{
        position: 'relative',
        borderRadius: '1rem',
        overflow: 'hidden',
        border: '1px solid var(--border-main)',
        background: 'var(--map-panel-bg)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      {/* Map Header Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.875rem 1.25rem',
          borderBottom: '1px solid var(--border-light)',
          background: 'var(--map-bar-bg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Layers size={18} color="var(--accent-main)" />
          <span style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
            Civic Centers Geographic Map
          </span>
          <span
            style={{
              fontSize: '0.75rem',
              padding: '0.15rem 0.6rem',
              borderRadius: '99px',
              background: 'var(--map-badge-bg)',
              color: 'var(--map-accent-text)',
              fontWeight: '600',
            }}
          >
            {offices.length} Pins
          </span>
        </div>

        {/* Zoom & Reset Controls */}
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(1.8, z + 0.2))}
            title="Zoom In"
            className="btn"
            style={{
              padding: '0.4rem 0.6rem',
              background: 'var(--glass-bg)',
              border: '1px solid var(--border-light)',
              borderRadius: '0.4rem',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            <ZoomIn size={16} />
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(0.8, z - 0.2))}
            title="Zoom Out"
            className="btn"
            style={{
              padding: '0.4rem 0.6rem',
              background: 'var(--glass-bg)',
              border: '1px solid var(--border-light)',
              borderRadius: '0.4rem',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            <ZoomOut size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              setZoomLevel(1);
              setActivePin(null);
            }}
            title="Reset Map View"
            className="btn"
            style={{
              padding: '0.4rem 0.6rem',
              background: 'var(--glass-bg)',
              border: '1px solid var(--border-light)',
              borderRadius: '0.4rem',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Map Viewport Area */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '420px',
          overflow: 'hidden',
          background: 'var(--map-canvas-bg)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{
            width: '100%',
            height: '100%',
            transform: `scale(${zoomLevel})`,
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            cursor: 'grab',
          }}
          aria-label="Interactive map showing nearby civic offices and facilitation centers"
        >
          {/* Subtle Grid Lines for Coordinates */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="var(--map-grid)"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Regional Territory Mock Guide Lines */}
          <path
            d="M 120 120 Q 250 80 400 90 T 700 130 Q 650 280 500 350 T 300 480 Q 200 380 150 260 Z"
            fill="rgba(56, 189, 248, 0.03)"
            stroke="rgba(56, 189, 248, 0.12)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />

          {/* User Location Radar / Pin */}
          {userPoint && (
            <g transform={`translate(${userPoint.x}, ${userPoint.y})`}>
              <circle r="22" fill="rgba(56, 189, 248, 0.15)" className="animate-ping" />
              <circle r="12" fill="rgba(56, 189, 248, 0.3)" />
              <circle r="6" fill="#38bdf8" stroke="#ffffff" strokeWidth="2" />
              <text
                y="-14"
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                style={{ fill: 'var(--map-accent-text)', ...LABEL_HALO }}
              >
                You Are Here
              </text>
            </g>
          )}

          {/* Office Pins */}
          {projectedOffices.map((office) => {
            const isSelected = currentActive?.id === office.id;
            return (
              <g
                key={office.id}
                transform={`translate(${office.svgX}, ${office.svgY})`}
                onClick={() => {
                  setActivePin(office);
                  onSelectOffice(office);
                }}
                style={{ cursor: 'pointer' }}
                tabIndex={0}
                role="button"
                aria-label={`Select ${office.name}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setActivePin(office);
                    onSelectOffice(office);
                  }
                }}
              >
                {/* Glow ring when selected */}
                {isSelected && (
                  <circle
                    r="18"
                    fill="none"
                    stroke={office.color}
                    strokeWidth="2.5"
                    strokeDasharray="3 3"
                    className="animate-spin"
                    style={{ animationDuration: '6s' }}
                  />
                )}

                {/* Marker Body */}
                <circle
                  r={isSelected ? '10' : '7'}
                  fill={office.color}
                  stroke="#ffffff"
                  strokeWidth="2"
                  style={{
                    filter: isSelected ? 'drop-shadow(0 0 8px rgba(255,255,255,0.7))' : 'none',
                    transition: 'all 0.2s',
                  }}
                />

                {/* Short Office Label */}
                <text
                  y={office.labelY}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight={isSelected ? '700' : '500'}
                  style={{
                    fill: 'var(--map-label)',
                    ...LABEL_HALO,
                    pointerEvents: 'none',
                    userSelect: 'none',
                  }}
                >
                  {office.showLabel || isSelected ? office.city : null}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Selected Office Overlay Popover Card */}
        {currentActive && (
          <div
            className="glass-panel animate-fade-in"
            style={{
              position: 'absolute',
              bottom: '1rem',
              left: '1rem',
              right: '1rem',
              maxWidth: '460px',
              padding: '1rem 1.25rem',
              borderRadius: '0.75rem',
              border: `1px solid ${getCategoryColor(currentActive.category)}`,
              background: 'var(--map-popover-bg)',
              backdropFilter: 'blur(16px)',
              zIndex: 10,
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
              <div>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    color: getCategoryTextColor(currentActive.category),
                    letterSpacing: '0.5px',
                  }}
                >
                  {currentActive.category}
                </span>
                <h4 style={{ fontSize: '1rem', fontWeight: '700', margin: '0.2rem 0', color: 'var(--text-primary)' }}>
                  {currentActive.name}
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  {currentActive.address}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActivePin(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '1.25rem',
                  lineHeight: '1',
                }}
                aria-label="Close office preview"
              >
                &times;
              </button>
            </div>

            {/* Quick Metrics Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                margin: '0.4rem 0 0.8rem 0',
                flexWrap: 'wrap',
              }}
            >
              {currentActive.distanceKm != null && (
                <span style={{ color: 'var(--map-accent-text)', fontWeight: '600' }}>
                  📍 {formatDistance(currentActive.distanceKm)}
                </span>
              )}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <Clock size={12} /> {currentActive.officeHours?.hours}
              </span>
              <span
                style={{
                  padding: '0.1rem 0.5rem',
                  borderRadius: '99px',
                  fontWeight: '600',
                  background: currentActive.isOpenNow ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: currentActive.isOpenNow ? 'var(--map-ok)' : 'var(--map-bad)',
                }}
              >
                {currentActive.isOpenNow ? 'Open Now' : 'Closed'}
              </span>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <a
                href={safeHttpUrl(currentActive.directionsUrl) || undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{
                  flex: 1,
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.8rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                }}
              >
                <Navigation size={14} /> Get Directions
              </a>
              <button
                type="button"
                onClick={() => onBookAppointment(currentActive)}
                className="btn btn-primary"
                style={{
                  flex: 1,
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.8rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                }}
              >
                <Calendar size={14} /> Book Token
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Map Legend */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '0.75rem 1.25rem',
          borderTop: '1px solid var(--border-light)',
          background: 'var(--map-bar-bg)',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
        }}
      >
        <span style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>Legend:</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} /> Revenue & Certificates
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3b82f6' }} /> Transport & RTO
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#8b5cf6' }} /> Passport Seva
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }} /> Aadhaar & Identity
        </span>
      </div>
    </div>
  );
};

export default InteractiveOfficeMap;
