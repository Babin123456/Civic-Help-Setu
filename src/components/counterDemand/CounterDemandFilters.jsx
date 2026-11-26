import { Building2, Calendar, BarChart2, Table as TableIcon, Activity } from 'lucide-react';

export const CounterDemandFilters = ({
  offices,
  selectedOfficeId,
  onOfficeChange,
  targetDate,
  onDateChange,
  viewMode,
  onViewModeToggle,
  showDiagnostics,
  onToggleDiagnostics,
}) => {
  return (
    <div
      className="counter-demand-filters"
      style={{
        padding: '1rem',
        borderRadius: '12px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', flex: 1 }}>
        {/* Office Selection */}
        <div style={{ minWidth: '260px', flex: 1 }}>
          <label
            htmlFor="office-select"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}
          >
            <Building2 size={14} color="var(--accent-main, #2563eb)" />
            Target Civic Service Centre
          </label>
          <select
            id="office-select"
            className="form-control"
            value={selectedOfficeId}
            onChange={(e) => onOfficeChange(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
            }}
          >
            {offices.map((off) => (
              <option key={off.officeId} value={off.officeId}>
                {off.officeName} ({off.totalPhysicalCounters} counters)
              </option>
            ))}
          </select>
        </div>

        {/* Target Planning Date */}
        <div style={{ minWidth: '180px' }}>
          <label
            htmlFor="target-date-input"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}
          >
            <Calendar size={14} color="var(--accent-main, #2563eb)" />
            Planning Date
          </label>
          <input
            id="target-date-input"
            type="date"
            className="form-control"
            value={targetDate}
            onChange={(e) => onDateChange(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
            }}
          />
        </div>
      </div>

      {/* View & Diagnostics Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button
          type="button"
          className={`btn ${viewMode === 'chart' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => onViewModeToggle('chart')}
          style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          aria-pressed={viewMode === 'chart'}
        >
          <BarChart2 size={15} />
          Chart View
        </button>
        <button
          type="button"
          className={`btn ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => onViewModeToggle('table')}
          style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          aria-pressed={viewMode === 'table'}
        >
          <TableIcon size={15} />
          Accessible Table
        </button>
        <button
          type="button"
          className={`btn ${showDiagnostics ? 'btn-outline-active' : 'btn-secondary'}`}
          onClick={onToggleDiagnostics}
          style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          aria-pressed={showDiagnostics}
          title="Toggle model backtesting, MAE, and drift diagnostics"
        >
          <Activity size={15} />
          Diagnostics
        </button>
      </div>
    </div>
  );
};

export default CounterDemandFilters;

