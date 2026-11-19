export const CounterDemandAccessibleTable = ({ hourlyForecast, officeName, targetDate }) => {
  if (!hourlyForecast || hourlyForecast.length === 0) {
    return (
      <p style={{ color: 'var(--text-secondary)', padding: '1rem' }}>
        No hourly forecast records available for {targetDate}.
      </p>
    );
  }

  return (
    <div className="table-responsive" style={{ overflowX: 'auto', margin: '1rem 0' }}>
      <table
        className="data-table"
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.875rem',
          textAlign: 'left',
          background: 'var(--bg-card)',
          borderRadius: '8px',
          border: '1px solid var(--border)',
        }}
        aria-label={`Detailed Hourly Counter Demand and Staffing Forecast for ${officeName} on ${targetDate}`}
      >
        <caption className="sr-only">
          Hourly forecast showing expected citizen arrivals, 80% and 95% confidence intervals, recommended counters, and estimated waiting time.
        </caption>
        <thead>
          <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
            <th scope="col" style={{ padding: '0.75rem 1rem' }}>Operating Hour</th>
            <th scope="col" style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Expected Demand</th>
            <th scope="col" style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>80% Interval</th>
            <th scope="col" style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>95% Interval</th>
            <th scope="col" style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Staff Required</th>
            <th scope="col" style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Buffer Staff</th>
            <th scope="col" style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Est. Utilization</th>
            <th scope="col" style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Est. Wait (min)</th>
          </tr>
        </thead>
        <tbody>
          {hourlyForecast.map((slot) => {
            const isPeak = slot.predictedDemand >= 30;
            return (
              <tr
                key={slot.hour}
                style={{
                  borderBottom: '1px solid var(--border)',
                  background: isPeak ? 'var(--accent-subtle-translucent, rgba(59, 130, 246, 0.04))' : 'transparent',
                }}
              >
                <th
                  scope="row"
                  style={{
                    padding: '0.75rem 1rem',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {slot.hour}:00 - {parseInt(slot.hour, 10) + 1}:00
                  {isPeak && (
                    <span
                      style={{
                        marginLeft: '0.5rem',
                        fontSize: '0.7rem',
                        padding: '0.1rem 0.4rem',
                        borderRadius: '4px',
                        background: 'var(--accent-subtle, #dbeafe)',
                        color: 'var(--accent-main, #1d4ed8)',
                        fontWeight: 600,
                      }}
                      title="Peak operational volume"
                    >
                      Peak
                    </span>
                  )}
                </th>
                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600 }}>
                  {slot.predictedDemand} citizens/hr
                </td>
                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--text-secondary)' }}>
                  [{slot.lowerBound80} – {slot.upperBound80}]
                </td>
                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--text-secondary)' }}>
                  [{slot.lowerBound95} – {slot.upperBound95}]
                </td>
                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600 }}>
                  {slot.recommendedCounters} {slot.recommendedCounters === 1 ? 'counter' : 'counters'}
                </td>
                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--text-secondary)' }}>
                  {slot.bufferCounters} counters
                </td>
                <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                  {(slot.utilization * 100).toFixed(0)}%
                </td>
                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 500 }}>
                  ~{slot.expectedWaitMinutes} min
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default CounterDemandAccessibleTable;

