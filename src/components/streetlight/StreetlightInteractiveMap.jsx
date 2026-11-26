import { useState, useMemo } from 'react';
import {
  Table as TableIcon,
  Map as MapIcon,
} from 'lucide-react';
import { SAFETY_CORRIDOR_ANCHORS } from '../../data/streetlightSeedData';
import { StreetlightPriorityBadge, StreetlightStatusBadge } from './StreetlightStates';

export default function StreetlightInteractiveMap({
  clusters = [],
  assets = [],
  onSelectCluster,
}) {
  const [showTableAlternative, setShowTableAlternative] = useState(false);
  const [hoveredCluster, setHoveredCluster] = useState(null);

  // Compute map bounds to fit coordinates into SVG coordinate space
  const bounds = useMemo(() => {
    let minLat = 12.90;
    let maxLat = 13.01;
    let minLng = 77.58;
    let maxLng = 77.75;

    const coords = [];
    clusters.forEach((c) => {
      if (c.centroid?.lat && c.centroid?.lng) coords.push(c.centroid);
    });
    assets.forEach((a) => {
      if (a.coordinates?.lat && a.coordinates?.lng) coords.push(a.coordinates);
    });

    if (coords.length > 0) {
      minLat = Math.min(...coords.map((c) => c.lat)) - 0.005;
      maxLat = Math.max(...coords.map((c) => c.lat)) + 0.005;
      minLng = Math.min(...coords.map((c) => c.lng)) - 0.005;
      maxLng = Math.max(...coords.map((c) => c.lng)) + 0.005;
    }

    return { minLat, maxLat, minLng, maxLng };
  }, [clusters, assets]);

  // Project lat/lng to SVG (800x500)
  const project = (lat, lng) => {
    const width = 800;
    const height = 500;
    const padding = 40;

    const x = padding + ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng || 0.001)) * (width - 2 * padding);
    // Invert Y because SVG 0 is top
    const y = height - (padding + ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat || 0.001)) * (height - 2 * padding));

    return { x: Math.max(padding, Math.min(width - padding, x)), y: Math.max(padding, Math.min(height - padding, y)) };
  };

  return (
    <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          borderBottom: '1px solid var(--border-main)',
          paddingBottom: '0.75rem',
          marginBottom: '1rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            Geospatial Outage Corridors & Streetlight Clusters
          </h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
            Clusters are mapped with proximity radius and safety anchor associations.
          </p>
        </div>

        {/* Accessible Alternative Toggle */}
        <button
          type="button"
          onClick={() => setShowTableAlternative(!showTableAlternative)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.8rem',
            fontWeight: 600,
            padding: '0.4rem 0.75rem',
            borderRadius: '0.375rem',
            border: '1px solid var(--border-main)',
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
          aria-pressed={showTableAlternative}
        >
          {showTableAlternative ? (
            <>
              <MapIcon size={14} aria-hidden="true" />
              Switch to Visual Map
            </>
          ) : (
            <>
              <TableIcon size={14} aria-hidden="true" />
              Accessible Table Alternative
            </>
          )}
        </button>
      </div>

      {showTableAlternative ? (
        /* Accessible Table Alternative for Screen Readers & Keyboard Users */
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left', color: 'var(--text-primary)' }}
            aria-label="Accessible Streetlight Outage Clusters Table"
          >
            <thead>
              <tr style={{ background: 'var(--bg-surface)', borderBottom: '2px solid var(--border-main)', color: 'var(--text-primary)' }}>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 700 }}>Cluster ID</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 700 }}>Corridor Name</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 700 }}>Ward</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 700 }}>Poles</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 700 }}>Priority</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 700 }}>Status</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 700 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {clusters.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border-main)' }}>
                  <td style={{ padding: '0.6rem 0.75rem', fontFamily: 'monospace', fontWeight: 600 }}>{c.id}</td>
                  <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>{c.corridorName}</td>
                  <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-secondary)' }}>{c.jurisdictionId}</td>
                  <td style={{ padding: '0.6rem 0.75rem' }}>{c.poleCount || 1}</td>
                  <td style={{ padding: '0.6rem 0.75rem' }}>
                    <StreetlightPriorityBadge tier={c.priorityTier} score={c.priorityScore} />
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem' }}>
                    <StreetlightStatusBadge status={c.status} type="cluster" />
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => onSelectCluster(c.id)}
                      style={{
                        padding: '0.3rem 0.65rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        borderRadius: '4px',
                        border: '1px solid var(--border-main)',
                        background: 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                      }}
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Visual Interactive SVG Map */
        <div>
          <div
            style={{
              position: 'relative',
              width: '100%',
              background: '#0f172a',
              borderRadius: '0.75rem',
              overflow: 'hidden',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)',
            }}
          >
            <svg
              viewBox="0 0 800 500"
              style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '460px' }}
              aria-label="Interactive map of streetlight outages"
            >
              {/* Municipal Grid Lines */}
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="800" height="500" fill="url(#grid)" />

              {/* Safety Anchors (Hospitals, Transit Corridors) */}
              {SAFETY_CORRIDOR_ANCHORS.map((anchor) => {
                const pt = project(anchor.lat, anchor.lng);
                return (
                  <g key={anchor.id} opacity="0.6">
                    <circle cx={pt.x} cy={pt.y} r="18" fill="#3b82f6" fillOpacity="0.15" stroke="#3b82f6" strokeDasharray="3 3" />
                    <circle cx={pt.x} cy={pt.y} r="3" fill="#60a5fa" />
                    <text x={pt.x} y={pt.y - 8} fill="#94a3b8" fontSize="9" textAnchor="middle">
                      {anchor.name}
                    </text>
                  </g>
                );
              })}

              {/* Individual Streetlight Poles */}
              {assets.map((asset) => {
                const pt = project(asset.coordinates.lat, asset.coordinates.lng);
                const isDark = asset.operationalStatus === 'dark' || asset.operationalStatus === 'damaged';
                const isFlickering = asset.operationalStatus === 'flickering';

                return (
                  <circle
                    key={asset.id}
                    cx={pt.x}
                    cy={pt.y}
                    r={isDark ? 4 : 3}
                    fill={isDark ? '#ef4444' : isFlickering ? '#f59e0b' : '#10b981'}
                    opacity={isDark ? 0.9 : 0.4}
                  >
                    <title>{`${asset.id} (${asset.street}) - ${asset.operationalStatus}`}</title>
                  </circle>
                );
              })}

              {/* Outage Clusters (Centroids & Proximity Bounding Radii) */}
              {clusters.map((cluster) => {
                if (!cluster.centroid?.lat || !cluster.centroid?.lng) return null;
                const pt = project(cluster.centroid.lat, cluster.centroid.lng);
                const isHovered = hoveredCluster?.id === cluster.id;
                const isCritical = cluster.priorityTier === 'critical';

                return (
                  <g
                    key={cluster.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => onSelectCluster(cluster.id)}
                    onMouseEnter={() => setHoveredCluster(cluster)}
                    onMouseLeave={() => setHoveredCluster(null)}
                  >
                    {/* Pulsing ring for critical clusters */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 26 : 20}
                      fill={isCritical ? '#dc2626' : '#ea580c'}
                      fillOpacity={isHovered ? 0.35 : 0.2}
                      stroke={isCritical ? '#f87171' : '#fb923c'}
                      strokeWidth={isHovered ? 2 : 1}
                    />

                    {/* Centroid Pin */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="8"
                      fill={isCritical ? '#b91c1c' : '#c2410c'}
                      stroke="#ffffff"
                      strokeWidth="2"
                    />

                    {/* Pole count label */}
                    <text
                      x={pt.x}
                      y={pt.y + 3}
                      fill="#ffffff"
                      fontSize="9"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {cluster.poleCount || 1}
                    </text>

                    {/* Text Label on hover or high priority */}
                    {(isHovered || isCritical) && (
                      <g>
                        <rect
                          x={pt.x - 70}
                          y={pt.y - 28}
                          width="140"
                          height="18"
                          rx="4"
                          fill="#1e293b"
                          fillOpacity="0.9"
                        />
                        <text
                          x={pt.x}
                          y={pt.y - 16}
                          fill="#ffffff"
                          fontSize="9"
                          fontWeight="600"
                          textAnchor="middle"
                        >
                          {cluster.corridorName.slice(0, 22)}...
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Map Legend */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1.25rem',
              marginTop: '0.85rem',
              fontSize: '0.775rem',
              color: 'var(--text-secondary, #64748b)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
              <span>Dark Streetlight Pole</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
              <span>Operational Pole</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#dc2626', border: '1px solid #ffffff' }} />
              <span>Critical Outage Cluster (Poles Grouped)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', border: '1px dashed #3b82f6' }} />
              <span>Safety Anchor (Hospital/Transit)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
