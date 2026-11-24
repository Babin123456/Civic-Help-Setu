/**
 * src/components/pedestrianBarriers/InteractiveBarrierMap.jsx
 * High-contrast interactive schematic SVG map visualizer for pedestrian corridors,
 * barriers, crossings, and active computed routes (#757).
 */

import { useState } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react';
import { BARRIER_TYPES, BARRIER_SEVERITIES } from '../../data/pedestrianBarrierContract.js';

export default function InteractiveBarrierMap({
  nodes = [],
  segments = [],
  observations = [],
  temporaryObstructions = [],
  routeResult = null,
  onNodeSelect,
  onBarrierSelect,
}) {
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedBarrier, setSelectedBarrier] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  // SVG coordinate projection helper
  // Map lat/lng (Bangalore Bellandur/HSR roughly 12.910 - 12.922, 77.645 - 77.676)
  // to 800 x 500 canvas
  const minLat = 12.910;
  const maxLat = 12.922;
  const minLng = 77.645;
  const maxLng = 77.676;

  const projectCoord = (lat, lng) => {
    const x = ((lng - minLng) / (maxLng - minLng)) * 700 + 50;
    const y = 450 - ((lat - minLat) / (maxLat - minLat)) * 380 - 40;
    return {
      x: Math.max(40, Math.min(760, x)),
      y: Math.max(40, Math.min(460, y)),
    };
  };

  const nodeMap = new Map();
  nodes.forEach((n) => {
    nodeMap.set(n.id, {
      ...n,
      ...projectCoord(n.coordinates.lat, n.coordinates.lng),
    });
  });

  const routeSegmentIds = new Set(routeResult?.segments?.map((s) => s.id) || []);

  const handleNodeClick = (node) => {
    setSelectedNode(node);
    if (onNodeSelect) onNodeSelect(node);
  };

  const handleBarrierClick = (bar) => {
    setSelectedBarrier(bar);
    if (onBarrierSelect) onBarrierSelect(bar);
  };

  return (
    <div
      className="card"
      style={{
        padding: '1.25rem',
        borderRadius: '0.75rem',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Pedestrian Network &amp; Barrier Schematic Map
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Interactive vector topology. Click any junction node to set route coordinates.
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => setZoomLevel((z) => Math.min(1.6, z + 0.15))}
            aria-label="Zoom in map"
          >
            <ZoomIn size={15} />
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => setZoomLevel((z) => Math.max(0.8, z - 0.15))}
            aria-label="Zoom out map"
          >
            <ZoomOut size={15} />
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => setZoomLevel(1)}
            aria-label="Reset zoom"
          >
            <Maximize2 size={15} />
          </button>
        </div>
      </div>

      {/* SVG Canvas */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '420px',
          background: 'var(--bg-secondary, #1a202c)',
          borderRadius: '0.5rem',
          overflow: 'hidden',
          border: '1px solid var(--border-light)',
        }}
      >
        <svg
          viewBox="0 0 800 500"
          style={{
            width: '100%',
            height: '100%',
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'center center',
            transition: 'transform 0.15s ease',
          }}
          role="img"
          aria-label="Pedestrian route and barrier map"
        >
          {/* Background Grid Pattern */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            </pattern>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <rect width="800" height="500" fill="url(#grid)" />

          {/* Segments (Edges) */}
          {segments.map((seg) => {
            const n1 = nodeMap.get(seg.startNodeId);
            const n2 = nodeMap.get(seg.endNodeId);
            if (!n1 || !n2) return null;

            const isPartOfRoute = routeSegmentIds.has(seg.id);
            const isCompliant = seg.curbRampStatus === 'present_compliant' && !seg.hasStairsOrSteps;

            let strokeColor = isCompliant ? '#10b981' : '#f59e0b';
            if (seg.hasStairsOrSteps || seg.curbRampStatus === 'missing') {
              strokeColor = '#ef4444';
            }
            if (isPartOfRoute) {
              strokeColor = '#3b82f6';
            }

            return (
              <g key={seg.id}>
                {isPartOfRoute && (
                  <line
                    x1={n1.x}
                    y1={n1.y}
                    x2={n2.x}
                    y2={n2.y}
                    stroke="#60a5fa"
                    strokeWidth="10"
                    strokeOpacity="0.45"
                    filter="url(#glow)"
                  />
                )}
                <line
                  x1={n1.x}
                  y1={n1.y}
                  x2={n2.x}
                  y2={n2.y}
                  stroke={strokeColor}
                  strokeWidth={isPartOfRoute ? 5 : 3}
                  strokeDasharray={seg.hasStairsOrSteps ? '4 4' : 'none'}
                />
              </g>
            );
          })}

          {/* Barrier Markers */}
          {observations.map((obs) => {
            if (!obs.coordinates) return null;
            const pt = projectCoord(obs.coordinates.lat, obs.coordinates.lng);
            const isHigh = obs.severity === 'high_barrier' || obs.severity === 'impassable';

            return (
              <g
                key={obs.id}
                transform={`translate(${pt.x}, ${pt.y})`}
                style={{ cursor: 'pointer' }}
                onClick={() => handleBarrierClick(obs)}
              >
                <circle
                  r={isHigh ? '9' : '7'}
                  fill={isHigh ? '#ef4444' : '#f59e0b'}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
                <text
                  x="0"
                  y="3"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="8"
                  fontWeight="bold"
                >
                  !
                </text>
              </g>
            );
          })}

          {/* Temporary Obstruction Indicators */}
          {temporaryObstructions.filter((o) => o.status === 'active').map((obst) => {
            const seg = segments.find((s) => s.id === obst.segmentId);
            if (!seg) return null;
            const n1 = nodeMap.get(seg.startNodeId);
            const n2 = nodeMap.get(seg.endNodeId);
            if (!n1 || !n2) return null;
            const midX = (n1.x + n2.x) / 2;
            const midY = (n1.y + n2.y) / 2;

            return (
              <g key={obst.id} transform={`translate(${midX}, ${midY})`}>
                <rect x="-6" y="-6" width="12" height="12" fill="#f97316" stroke="#ffffff" strokeWidth="1" rx="2" />
                <text x="0" y="3" textAnchor="middle" fill="#ffffff" fontSize="7" fontWeight="bold">T</text>
              </g>
            );
          })}

          {/* Junction Nodes */}
          {nodes.map((node) => {
            const pt = nodeMap.get(node.id);
            if (!pt) return null;
            const isSelected = selectedNode?.id === node.id;

            return (
              <g
                key={node.id}
                transform={`translate(${pt.x}, ${pt.y})`}
                style={{ cursor: 'pointer' }}
                onClick={() => handleNodeClick(node)}
              >
                <circle
                  r={isSelected ? 10 : 7}
                  fill={isSelected ? '#3b82f6' : '#ffffff'}
                  stroke="#1e293b"
                  strokeWidth="2.5"
                />
                <text
                  x="0"
                  y="-12"
                  textAnchor="middle"
                  fill="var(--text-primary, #ffffff)"
                  fontSize="9.5"
                  fontWeight="600"
                  style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
                >
                  {node.name.split(' ')[0]}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Selected Overlay Inspector */}
        {(selectedNode || selectedBarrier) && (
          <div
            style={{
              position: 'absolute',
              bottom: '10px',
              left: '10px',
              right: '10px',
              background: 'rgba(15, 23, 42, 0.92)',
              backdropFilter: 'blur(8px)',
              padding: '0.65rem 0.85rem',
              borderRadius: '0.5rem',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#ffffff',
              fontSize: '0.8rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            {selectedNode && (
              <div>
                <strong>Junction: {selectedNode.name}</strong> ({selectedNode.ward})
                <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                  Signal: {selectedNode.hasSignal ? 'Pedestrian Pelican Signal' : 'Unsignalized'} | Curb Cuts: {selectedNode.hasCurbCuts ? 'Present' : 'None'}
                </div>
              </div>
            )}
            {selectedBarrier && !selectedNode && (
              <div>
                <strong>Barrier: {BARRIER_TYPES[selectedBarrier.barrierType]?.label || selectedBarrier.barrierType}</strong>
                <div style={{ fontSize: '0.74rem', color: '#cbd5e1' }}>
                  {selectedBarrier.description} ({BARRIER_SEVERITIES[selectedBarrier.severity]?.label})
                </div>
              </div>
            )}
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => {
                setSelectedNode(null);
                setSelectedBarrier(null);
              }}
              style={{ color: '#ffffff', padding: '0.2rem 0.45rem' }}
            >
              Close
            </button>
          </div>
        )}
      </div>

      {/* Map Legend */}
      <div
        style={{
          marginTop: '0.75rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          fontSize: '0.76rem',
          color: 'var(--text-secondary)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ width: 12, height: 4, background: '#10b981', display: 'inline-block', borderRadius: 2 }} />
          Compliant Footpath
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ width: 12, height: 4, background: '#f59e0b', display: 'inline-block', borderRadius: 2 }} />
          Steep Slope / Damaged Lip
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ width: 12, height: 4, background: '#ef4444', display: 'inline-block', borderRadius: 2 }} />
          Missing Ramp / Steps
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ width: 12, height: 5, background: '#3b82f6', display: 'inline-block', borderRadius: 2 }} />
          Active Calculated Route
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ width: 8, height: 8, background: '#ef4444', display: 'inline-block', borderRadius: '50%' }} />
          Verified Barrier
        </span>
      </div>
    </div>
  );
}
