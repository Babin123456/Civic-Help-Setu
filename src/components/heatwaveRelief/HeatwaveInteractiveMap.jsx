import React, { useState } from 'react';
import {
  MapPin,
  Building2,
  Droplets,
  HeartPulse,
  Sun,
  AlertTriangle,
  Clock,
  ExternalLink,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import {
  RELIEF_FACILITY_TYPES,
  OPERATIONAL_STATUS,
} from '../../data/upHeatwaveReliefContract';

export default function HeatwaveInteractiveMap({
  facilities,
  selectedFacility,
  onSelectFacility,
  onOpenObservationModal,
  isLowBandwidth,
  district = 'Lucknow',
}) {
  const [hoveredFacility, setHoveredFacility] = useState(null);

  // If low bandwidth mode is enabled, provide an ultra-lightweight schematic view
  if (isLowBandwidth) {
    return (
      <div
        role="region"
        aria-label="Low-Bandwidth Schematic Heat Relief Map"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          borderRadius: '0.75rem',
          padding: '1.25rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '0.95rem', margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>
              {district} Schematic Heat-Relief Grid (Low-Bandwidth Mode)
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Heavy vector tiles disabled. Showing {facilities.length} verified cooling locations.
            </span>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '0.75rem',
          }}
        >
          {facilities.map((fac) => {
            const isSelected = selectedFacility?.id === fac.id;
            const isOpen = fac.effectiveOperationalStatus === OPERATIONAL_STATUS.OPEN;
            const isDisputed = fac.isDisputed;
            const isStale = fac.isStale;

            return (
              <div
                key={fac.id}
                onClick={() => onSelectFacility(fac)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectFacility(fac);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-pressed={isSelected}
                style={{
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  border: isSelected ? '2px solid var(--accent-main)' : '1px solid var(--border-light)',
                  background: isSelected ? 'var(--accent-subtle, rgba(59, 130, 246, 0.08))' : 'var(--bg-main)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{fac.name}</strong>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      padding: '0.15rem 0.45rem',
                      borderRadius: '99px',
                      background: isDisputed
                        ? 'rgba(234, 88, 12, 0.15)'
                        : isOpen
                        ? 'rgba(22, 163, 74, 0.15)'
                        : 'rgba(220, 38, 38, 0.15)',
                      color: isDisputed ? '#ea580c' : isOpen ? '#16a34a' : '#dc2626',
                      flexShrink: 0,
                    }}
                  >
                    {isDisputed ? 'Disputed' : isOpen ? 'Open' : 'Closed'}
                  </span>
                </div>

                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  📍 {fac.wardOrVillage}
                </div>

                {isStale && (
                  <span style={{ fontSize: '0.72rem', color: '#d97706', fontWeight: 600 }}>
                    ⚠️ Verification Stale (Needs update)
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Standard interactive visual schematic map
  return (
    <div
      role="region"
      aria-label="Interactive Heat Relief Coordination Map"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        borderRadius: '0.75rem',
        padding: '1.25rem',
        marginBottom: '1.5rem',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h3 style={{ fontSize: '0.95rem', margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>
            {district} Ward Heat-Relief & Cooling Spatial Map
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Click any pin to inspect verified facilities, operational hours, and submit time-stamped status corrections.
          </span>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
            Open & Fresh
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ea580c', display: 'inline-block' }} />
            Disputed / Crowded
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />
            Temporarily Closed
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#9ca3af', display: 'inline-block' }} />
            Stale Verification
          </span>
        </div>
      </div>

      {/* SVG Canvas Map Schematic */}
      <div
        style={{
          width: '100%',
          height: '340px',
          background: 'var(--bg-main)',
          border: '1px solid var(--border-light)',
          borderRadius: '0.5rem',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <svg
          viewBox="0 0 800 340"
          style={{ width: '100%', height: '100%', display: 'block' }}
          role="img"
          aria-label={`Interactive map of heatwave facilities in ${district}`}
        >
          {/* Subtle Grid Lines */}
          <defs>
            <pattern id="heatMapGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--border-light)" strokeWidth="0.5" opacity="0.4" />
            </pattern>
          </defs>
          <rect width="800" height="340" fill="url(#heatMapGrid)" />

          {/* District Outline Placeholder Graphic */}
          <path
            d="M 120 60 Q 240 40 400 50 T 680 80 Q 720 180 650 260 T 350 300 Q 180 280 120 200 Z"
            fill="var(--accent-subtle, rgba(59, 130, 246, 0.04))"
            stroke="var(--border-light)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <text x="400" y="30" textAnchor="middle" fill="var(--text-tertiary)" fontSize="12" fontWeight="600">
            {district.toUpperCase()} ADMINISTRATIVE JURISDICTION
          </text>

          {/* Facility Pins mapped deterministically across canvas */}
          {facilities.map((fac, idx) => {
            // Project relative coordinates to canvas space
            // Reference center around Lucknow approx (26.85, 80.94)
            const latDelta = (fac.coordinates?.lat || 26.85) - 26.8;
            const lngDelta = (fac.coordinates?.lng || 80.94) - 80.85;

            // Clamped coordinates to canvas
            const posX = Math.max(80, Math.min(720, 200 + lngDelta * 2200 + (idx % 3) * 60));
            const posY = Math.max(60, Math.min(290, 260 - latDelta * 2200 - (idx % 2) * 50));

            const isSelected = selectedFacility?.id === fac.id;
            const isHovered = hoveredFacility?.id === fac.id;
            const isOpen = fac.effectiveOperationalStatus === OPERATIONAL_STATUS.OPEN;
            const isDisputed = fac.isDisputed;
            const isStale = fac.isStale;

            let pinColor = '#16a34a'; // Green
            if (isDisputed) pinColor = '#ea580c'; // Orange
            else if (!isOpen) pinColor = '#dc2626'; // Red
            else if (isStale) pinColor = '#9ca3af'; // Gray

            return (
              <g
                key={fac.id}
                transform={`translate(${posX}, ${posY})`}
                cursor="pointer"
                onClick={() => onSelectFacility(fac)}
                onMouseEnter={() => setHoveredFacility(fac)}
                onMouseLeave={() => setHoveredFacility(null)}
                tabIndex={0}
                role="button"
                aria-label={`${fac.name}, ${fac.wardOrVillage}, Status: ${isOpen ? 'Open' : 'Closed'}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectFacility(fac);
                  }
                }}
              >
                {/* Highlight Circle if selected */}
                {isSelected && (
                  <circle r="18" fill="none" stroke="var(--accent-main)" strokeWidth="2.5" className="animate-pulse" />
                )}

                {/* Pin Circle */}
                <circle r={isSelected || isHovered ? "12" : "9"} fill={pinColor} stroke="#ffffff" strokeWidth="2" />

                {/* Inner Symbol */}
                <circle r="3" fill="#ffffff" />

                {/* Label text */}
                <text
                  y="22"
                  textAnchor="middle"
                  fill="var(--text-primary)"
                  fontSize="11"
                  fontWeight={isSelected ? "700" : "500"}
                  style={{ pointerEvents: 'none' }}
                >
                  {fac.wardOrVillage.split(' ')[0]}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating Quick Tooltip / Selection Inspector */}
        {(selectedFacility || hoveredFacility) && (
          <div
            style={{
              position: 'absolute',
              bottom: '10px',
              left: '10px',
              right: '10px',
              maxWidth: '500px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: '0.5rem',
              padding: '0.75rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
            }}
          >
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {(selectedFacility || hoveredFacility).name}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                📍 {(selectedFacility || hoveredFacility).wardOrVillage} • {(selectedFacility || hoveredFacility).operatingHours}
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onOpenObservationModal(selectedFacility || hoveredFacility)}
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem', flexShrink: 0 }}
            >
              Report / Update Status
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
