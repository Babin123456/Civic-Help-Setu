import { useState } from 'react';

export const CounterDemandInteractiveChart = ({ hourlyForecast, officeName, targetDate }) => {
  const [activeHour, setActiveHour] = useState(null);

  if (!hourlyForecast || hourlyForecast.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        No chart telemetry available for {targetDate}.
      </div>
    );
  }

  const width = 640;
  const height = 260;
  const padding = { top: 25, right: 30, bottom: 45, left: 45 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxDemand = Math.max(
    40,
    ...hourlyForecast.map((h) => Math.max(h.upperBound95, h.predictedDemand))
  );

  const getX = (idx) => padding.left + (idx / (hourlyForecast.length - 1)) * chartWidth;
  const getY = (val) => padding.top + chartHeight - (val / maxDemand) * chartHeight;

  // Build SVG path for central predicted line
  const linePoints = hourlyForecast.map((h, idx) => `${getX(idx)},${getY(h.predictedDemand)}`).join(' ');

  // Build polygon ribbon for 95% Confidence Interval
  const upper95Points = hourlyForecast.map((h, idx) => `${getX(idx)},${getY(h.upperBound95)}`);
  const lower95Points = [...hourlyForecast].reverse().map((h, idx) => {
    const origIdx = hourlyForecast.length - 1 - idx;
    return `${getX(origIdx)},${getY(h.lowerBound95)}`;
  });
  const ribbon95Path = `M ${upper95Points.join(' L ')} L ${lower95Points.join(' L ')} Z`;

  // Build polygon ribbon for 80% Confidence Interval
  const upper80Points = hourlyForecast.map((h, idx) => `${getX(idx)},${getY(h.upperBound80)}`);
  const lower80Points = [...hourlyForecast].reverse().map((h, idx) => {
    const origIdx = hourlyForecast.length - 1 - idx;
    return `${getX(origIdx)},${getY(h.lowerBound80)}`;
  });
  const ribbon80Path = `M ${upper80Points.join(' L ')} L ${lower80Points.join(' L ')} Z`;

  const selectedSlot = activeHour !== null ? hourlyForecast[activeHour] : null;

  return (
    <div
      className="counter-demand-chart-container"
      style={{
        background: 'var(--bg-card)',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        padding: '1.25rem',
        margin: '1rem 0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
            Demand Trajectory &amp; Prediction Intervals
          </h4>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Showing 80% &amp; 95% Erlang-C capacity confidence bands for {officeName}
          </span>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: '12px', height: '12px', background: 'rgba(37, 99, 235, 0.15)', borderRadius: '2px', display: 'inline-block' }} />
            <span>95% CI</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: '12px', height: '12px', background: 'rgba(37, 99, 235, 0.3)', borderRadius: '2px', display: 'inline-block' }} />
            <span>80% CI</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: '16px', height: '3px', background: '#2563eb', display: 'inline-block' }} />
            <span>Predicted Arrivals</span>
          </div>
        </div>
      </div>

      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', maxWidth: '640px', height: 'auto', display: 'block', margin: '0 auto' }}
          role="img"
          aria-label={`Demand forecast line chart for ${officeName}. Peak arrives with ${maxDemand} maximum expected footfall.`}
        >
          {/* Y-Axis Grid Lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const val = Math.round(maxDemand * pct);
            const y = getY(val);
            return (
              <g key={pct}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="var(--border)"
                  strokeDasharray="3 3"
                />
                <text
                  x={padding.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="var(--text-secondary)"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* 95% Confidence Interval Ribbon */}
          <path d={ribbon95Path} fill="rgba(37, 99, 235, 0.12)" />

          {/* 80% Confidence Interval Ribbon */}
          <path d={ribbon80Path} fill="rgba(37, 99, 235, 0.24)" />

          {/* Main Central Expected Demand Line */}
          <polyline
            points={linePoints}
            fill="none"
            stroke="#2563eb"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data Points and Interaction Touch Targets */}
          {hourlyForecast.map((slot, idx) => {
            const cx = getX(idx);
            const cy = getY(slot.predictedDemand);
            const isHovered = activeHour === idx;

            return (
              <g
                key={slot.hour}
                tabIndex="0"
                role="button"
                aria-label={`${slot.hour}:00 expected ${slot.predictedDemand} citizens, ${slot.recommendedCounters} counters needed.`}
                onMouseEnter={() => setActiveHour(idx)}
                onFocus={() => setActiveHour(idx)}
                onMouseLeave={() => setActiveHour(null)}
                style={{ cursor: 'pointer', outline: 'none' }}
              >
                {/* Vertical hover guide */}
                {isHovered && (
                  <line
                    x1={cx}
                    y1={padding.top}
                    x2={cx}
                    y2={height - padding.bottom}
                    stroke="#2563eb"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                  />
                )}

                {/* Point circle */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 6 : 4}
                  fill="#ffffff"
                  stroke="#2563eb"
                  strokeWidth="2.5"
                />

                {/* X-Axis Hour Label */}
                <text
                  x={cx}
                  y={height - padding.bottom + 18}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight={isHovered ? 'bold' : 'normal'}
                  fill={isHovered ? '#2563eb' : 'var(--text-secondary)'}
                >
                  {slot.hour}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected Hour Details Callout */}
      {selectedSlot && (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            fontSize: '0.85rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
          aria-live="polite"
        >
          <div>
            <strong>Time Slot: {selectedSlot.hour}:00 – {parseInt(selectedSlot.hour, 10) + 1}:00</strong>
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <span>Demand: <strong>{selectedSlot.predictedDemand} citizens</strong></span>
            <span>80% Range: <strong>[{selectedSlot.lowerBound80} – {selectedSlot.upperBound80}]</strong></span>
            <span>Counters Needed: <strong>{selectedSlot.recommendedCounters}</strong> (Buffer: {selectedSlot.bufferCounters})</span>
            <span>Est. Wait: <strong>~{selectedSlot.expectedWaitMinutes} min</strong></span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CounterDemandInteractiveChart;

