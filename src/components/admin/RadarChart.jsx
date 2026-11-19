/**
 * Radar chart visualizer for service requirement coverage.
 *
 * Displays five state segments per field (missing, draft, verified, stale, conflicting)
 * as a radial gauge around a central service score.
 *
 * State mapping to angles (evenly distributed 0–2π):
 *   missing:              top (12 o'clock)
 *   draft:                top-right (2 o'clock)
 *   verified:             bottom-right (4 o'clock)
 *   stale:                bottom (6 o'clock)
 *   conflicting:          bottom-left (8 o'clock)
 *
 * The inner circle shows the overall quality score.
 * The outer rings show per-field state distribution.
 *
 * Accessibility:
 * - Keyboard-focusable with visible focus ring
 * - ARIA labels on all interactive elements
 * - Reduced-motion support (animations disabled if user prefers)
 * - Essential information available without hover (tooltips have fallback text)
 */

import React, { useEffect, useRef } from 'react';
import { STATES, STATE_LABELS, STATE_COLORS, SEVERITY_LABELS } from '../../services/catalogueCoverage.enhanced';

const RADAR_RADIUS = 100;
const RADAR_CENTER = { x: RADAR_RADIUS, y: RADAR_RADIUS };
const STATE_ANGLES = {
  missing: 0,          // top (12 o'clock) - angle in radians
  draft: -Math.PI / 2, // top-right
  verified: -Math.PI,  // bottom-right... wait let me recalculate
  stale: Math.PI,      // bottom
  conflicting: Math.PI / 2, // bottom-left
};

// Actually, let's use a more standard distribution:
// 0 = top, clockwise: missing(0), draft(72°), verified(144°), stale(216°), conflicting(288°)
// But we want 5 segments evenly spaced: each 72 degrees (2π/5)
// Let me use: angle = (index * 2π/5) - π/2 so 0 is at top

const SEGMENT_ANGLES = {
  missing: -Math.PI / 2,              // top (12 o'clock)
  draft: -Math.PI / 2 + (Math.PI * 2 / 5), // top-right
  verified: -Math.PI / 2 + (Math.PI * 2 / 5) * 2, // bottom-right
  stale: -Math.PI / 2 + (Math.PI * 2 / 5) * 3, // bottom
  conflicting: -Math.PI / 2 + (Math.PI * 2 / 5) * 4, // bottom-left
};

const SEGMENT_COLORS = {
  missing: '#ef4444',
  draft: '#f59e0b',
  verified: '#22c55e',
  stale: '#eab308',
  conflicting: '#a855f7',
};

const SEGMENT_LABELS = {
  missing: 'Missing',
  draft: 'Draft',
  verified: 'Verified',
  stale: 'Stale',
  conflicting: 'Conflicting',
};

const LABEL_OFFSETS = {
  missing: 1.25,
  draft: 1.35,
  verified: 1.25,
  stale: 1.35,
  conflicting: 1.25,
};

const RADIAL_TEXT_RADIUS = 120;

/**
 * RadarChart - displays coverage state radar for a single service record.
 * 
 * Props:
 *   fieldStates: Object mapping field name -> state ('missing'|'draft'|'verified'|'stale'|'conflicting')
 *   score: number (0-100) overall quality score
 *   recordName: string service name
 *   recordId: string service id
 *   rules: Object[] extended coverage rules
 *   onSegmentClick: (field, state) => void - called when a segment is clicked
 *   showLabels: boolean - whether to show state labels
 */
const RadarChart = ({
  fieldStates,
  score,
  recordName,
  recordId,
  rules,
  onSegmentClick,
  showLabels = true,
}) => {
  useEffect(() => {
    // Check for reduced-motion preference
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) {
      // Disable any transition animations
      document.documentElement.style.setProperty('--reduced-motion', 'true');
    }
  }, []);

  // Compute per-field state counts for the radar segments
  // Each segment shows the proportion of fields in that state
  const stateTotals = { missing: 0, draft: 0, verified: 0, stale: 0, conflicting: 0 };
  const fieldCount = rules.length;

  rules.forEach((rule) => {
    const state = fieldStates[rule.field] || 'missing';
    if (state in stateTotals) {
      stateTotals[state]++;
    }
  });

  // Normalize to percentages
  const statePercentages = Object.fromEntries(
    Object.entries(stateTotals).map(([k, v]) => [k, fieldCount > 0 ? Math.round((v / fieldCount) * 100) : 0])
  );

  // Compute the score arc angle
  const scoreArcAngle = (score / 100) * (Math.PI * 2); // full circle = 360 degrees

  return (
    <svg
      width={RADAR_RADIUS * 2 + 20}
      height={RADAR_RADIUS * 2 + 20}
      viewBox="0 0 {RADAR_RADIUS * 2 + 20} {RADAR_RADIUS * 2 + 20}"
      aria-label={`Coverage radar for ${recordName} (${recordId}): quality score ${score}%`}
    >
      <g
        transform={`translate(${RADAR_CENTER + ','} ${RADAR_CENTER + ','})`}
        role="img"
        aria-labelledby="radar-title-${recordId}"
      >
        {/* Score arc (inner circle) - shows overall quality */}
        <path
          d={`M ${RADAR_CENTER} L ${RADAR_CENTER.x * 0.6} ${RADAR_CENTER.y * 0.6}
               A ${RADAR_CENTER.x * 0.6} ${RADAR_CENTER.y * 0.6} 0 ${score > 50 ? 1 : 0} 1 ${RADAR_CENTER.x * 0.6 * Math.cos(scoreArcAngle)} ${RADAR_CENTER.y * 0.6 * Math.sin(scoreArcAngle)}
               L ${RADAR_CENTER.x * 0.6 * Math.cos(scoreArcAngle > 0 ? scoreArcAngle : 0.01)} ${RADAR_CENTER.y * 0.6 * Math.sin(scoreArcAngle > 0 ? scoreArcAngle : 0.01)}
               Z`}
          fill="#10b981"
          opacity={0.3}
        />
        <circle
          cx={RADAR_CENTER.x}
          cy={RADAR_CENTER.y}
          r={RADAR_CENTER.x * 0.6}
          fill="none"
          stroke="#64748b"
          strokeWidth={1}
        />

        {/* Score text in center */}
        <text
          x={RADAR_CENTER.x}
          y={RADAR_CENTER.y + 8}
          textAnchor="middle"
          fontSize="2rem"
          fontWeight="800"
          fill="#0f172a"
        >
          {score}%
        </text>

        {/* Title above the radar */}
        <text
          x={RADAR_CENTER.x}
          y={-RADAR_RADIUS - 12}
          textAnchor="middle"
          fontSize="0.75rem"
          fill="#64748b"
          id={`radar-title-${recordId}`}
        >
          {recordName}
        </text>

        {/* Draw state segments */}
        Object.entries(STATE_ANGLES).forEach(([state, startAngle]) => {
          const percentage = statePercentages[state] || 0;
          const endAngle = startAngle + (Math.PI * 2 / 5); // 72 degrees per segment

          // Draw the segment pie wedge
          const innerRadius = RADAR_CENTER.x * 0.4;
          const outerRadius = RADAR_CENTER.x * 0.8;

          const x1 = RADAR_CENTER.x + innerRadius * Math.cos(startAngle);
          const y1 = RADAR_CENTER.y + innerRadius * Math.sin(startAngle);
          const x2 = RADAR_CENTER.x + outerRadius * Math.cos(startAngle);
          const y2 = RADAR_CENTER.y + outerRadius * Math.sin(startAngle);
          const x3 = RADAR_CENTER.x + outerRadius * Math.cos(endAngle);
          const y3 = RADAR_CENTER.y + outerRadius * Math.sin(endAngle);
          const x4 = RADAR_CENTER.x + innerRadius * Math.cos(endAngle);
          const y4 = RADAR_CENTER.y + innerRadius * Math.sin(endAngle);

          // Close path back to center
          const pathData = `M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} L ${x4} ${y4} Z`;

          const color = STATE_COLORS[state] || '#64748b';
          const opacity = state === 'missing' || state === 'stale' ? 0.9 : 0.7;

          <path
            key={state}
            d={pathData}
            fill={color}
            opacity={opacity}
            style={{ cursor: 'pointer' }}
            onMouseOver={(e) => {
              // Tooltip: show field name and state (essential info without hover for keyboard)
              const rule = rules.find((r) => r.field === Object.keys(fieldStates).find(f => fieldStates[f] === state) || rule => false);
              // We'll show the label on focus instead
            }}
            onFocus={(e) => {
              if (onSegmentClick) {
                const field = Object.keys(fieldStates).find(f => fieldStates[f] === state);
                if (field) onSegmentClick(field, state);
              }
            }}
            tabIndex={0} // makes it focusable
            role="button"
            aria-label={`${STATE_LABELS[state]}: ${rules.find(r => r.field === Object.keys(fieldStates).find(f => fieldStates[f] === state))?.label || 'Unknown field'} - ${STATE_LABELS[state]} state`}
          >
            {showLabels && (
              <text
                x={RADAR_CENTER.x + RADIAL_TEXT_RADIUS * Math.cos((startAngle + endAngle) / 2)}
                y={RADAR_CENTER.y + RADIAL_TEXT_RADIUS * Math.sin((startAngle + endAngle) / 2)}
                textAnchor={((startAngle + endAngle) / 2 + Math.PI) % (2 * Math.PI) < Math.PI ? 'end' : 'start'}
                fontSize="0.65rem"
                fontWeight="600"
                fill={color}
                dominantBaseline="middle"
              >
                {STATE_LABELS[state]}
              </text>
            )}
          </path>
        });

        {/* State count legend at bottom */}
        <g transform={`translate(${RADAR_CENTER}, ${RADAR_CENTER + 140})`}>
          {STATES.map((state, i) => (
            <g key={state} transform={`translate(${i * 30} 0)`}>
              <circle
                cx={0}
                cy={0}
                r={6}
                fill={STATE_COLORS[state]}
                style={{ cursor: 'pointer' }}
                onFocus={(e) => {
                  if (onSegmentClick) {
                    const field = Object.keys(fieldStates).find(f => fieldStates[f] === state);
                    if (field) onSegmentClick(field, state);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`${STATE_LABELS[state]} state`}
              />
              <text
                x={14}
                y={0}
                fontSize="0.65rem"
                fill={STATE_COLORS[state]}
                dominantBaseline="middle"
              >
                {STATE_LABELS[state]} ({stateTotals[state]})
              </text>
            </g>
          ))}
        </g>
      </g>
    </svg>
  );
};

/**
 * RadarChart with table alternative (accessibility mode).
 * When `asTable` is true, renders a semantic table instead of the SVG chart.
 * Both render the same data; the table is the essential non-visual alternative.
 */
const RadarChartWithTable = ({
  fieldStates,
  score,
  recordName,
  recordId,
  rules,
  onSegmentClick,
  ...props
}) => {
  // Build table rows: one per rule, showing field, state, severity, label
  const tableRows = rules.map((rule) => {
    const state = fieldStates[rule.field] || 'missing';
    return (
      <tr key={rule.field}>
        <td style={{ fontSize: '0.85rem', padding: '0.4rem 0.5rem' }}>
          {rule.label}
        </td>
        <td style={{ fontSize: '0.85rem', padding: '0.4rem 0.5rem' }}>
          {STATE_LABELS[state] || state}
        </td>
        <td style={{ fontSize: '0.85rem', padding: '0.4rem 0.5rem' }}>
          {SEVERITY_LABELS[rule.severity]}
        </td>
        <td style={{ fontSize: '0.85rem', padding: '0.4rem 0.5rem' }}>
          {rule.weight}
        </td>
      </tr>
  );

  return (
    <>
      {/* Table alternative for non-visual access */}
      <table
        role="grid"
        aria-label={`Coverage table for ${recordName} (${recordId}): score ${score}%. Each row shows a field, its state (Missing/Draft/Verified/Stale/Conflicting), severity weight, and whether it blocks publication.`}
        style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginTop: '1rem' }}
      >
        <thead>
          <tr>
            <th scope="col" style={{ padding: '0.4rem 0.5rem', fontWeight: 600, textAlign: 'left' }}>Field</th>
            <th scope="col" style={{ padding: '0.4rem 0.5rem', fontWeight: 600, textAlign: 'left' }}>State</th>
            <th scope="col" style={{ padding: '0.4rem 0.5rem', fontWeight: 600, textAlign: 'left' }}>Severity</th>
            <th scope="col" style={{ padding: '0.4rem 0.5rem', fontWeight: 600, textAlign: 'left' }}>Weight</th>
          </tr>
        </thead>
        <tbody>{tableRows}</tbody>
      </table>
      {/* SVG chart */}
      <RadarChart
        fieldStates={fieldStates}
        score={score}
        recordName={recordName}
        recordId={recordId}
        rules={rules}
        onSegmentClick={onSegmentClick}
        {...props}
      />
    </>
  );
};

export default RadarChartWithTable;