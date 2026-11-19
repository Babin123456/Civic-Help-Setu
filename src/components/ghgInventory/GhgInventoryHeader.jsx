import {
  Leaf,
  PlusCircle,
  Calculator,
  Download,
  TrendingUp,
  Users,
  ShieldCheck,
} from 'lucide-react';
import { GHG_ROLES, PERIOD_STATUS_LABELS } from '../../services/ghgInventoryConstants.js';

const ROLE_OPTIONS = [
  { id: GHG_ROLES.CITIZEN, label: 'Citizen / public' },
  { id: GHG_ROLES.OPERATOR, label: 'Operator' },
  { id: GHG_ROLES.REVIEWER, label: 'Reviewer' },
  { id: GHG_ROLES.ADMIN, label: 'Administrator' },
];

export default function GhgInventoryHeader({
  periods,
  selectedPeriodId,
  onPeriodChange,
  activeRole,
  onRoleChange,
  canCreateSubmission,
  onCreateSubmission,
  canRunCalculation,
  onRunCalculation,
  canExport,
  onExport,
  onExportCsv,
  canGenerateEstimates,
  onGenerateEstimates,
  jurisdictionLabel,
}) {
  const selectedPeriod = (periods || []).find((period) => period.id === selectedPeriodId);
  return (
    <header style={{ marginBottom: '1.5rem' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1rem',
          marginBottom: '1rem',
        }}
      >
        <div>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
            }}
          >
            Municipal climate accountability
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginTop: '0.2rem' }}>
            <span
              aria-hidden="true"
              style={{
                width: 38,
                height: 38,
                borderRadius: 9,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(22, 163, 74, 0.12)',
                color: '#15803d',
              }}
            >
              <Leaf size={22} />
            </span>
            <h1 style={{ margin: 0, fontSize: '1.65rem', lineHeight: 1.2 }}>
              Local Government Greenhouse-Gas Inventory
            </h1>
          </div>
          <p style={{ margin: '0.45rem 0 0', maxWidth: '760px', color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            Review department activity data, compare reporting periods, inspect versioned
            calculation formulas and export a source-linked municipal inventory.
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {canCreateSubmission && (
            <button type="button" className="btn btn-primary" onClick={onCreateSubmission}>
              <PlusCircle size={15} aria-hidden="true" /> New submission
            </button>
          )}
          {canRunCalculation && (
            <button type="button" className="btn btn-secondary" onClick={onRunCalculation}>
              <Calculator size={15} aria-hidden="true" /> Run calculation
            </button>
          )}
          {canGenerateEstimates && (
            <button type="button" className="btn btn-secondary" onClick={onGenerateEstimates}>
              <TrendingUp size={15} aria-hidden="true" /> Generate estimates
            </button>
          )}
          {canExport && (
            <button type="button" className="btn btn-secondary" onClick={onExport}>
              <Download size={15} aria-hidden="true" /> Export inventory
            </button>
          )}
          {canExport && onExportCsv && (
            <button type="button" className="btn btn-secondary" onClick={onExportCsv}>
              <Download size={15} aria-hidden="true" /> Download CSV
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          padding: '0.75rem 1rem',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-main)',
          borderRadius: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <label htmlFor="ghg-period-select" style={{ fontSize: '0.85rem', fontWeight: 700 }}>
            Reporting period
          </label>
          <select
            id="ghg-period-select"
            value={selectedPeriodId || ''}
            onChange={(event) => onPeriodChange(event.target.value)}
            style={{
              padding: '0.4rem 0.6rem',
              borderRadius: 6,
              border: '1px solid var(--border-main)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
            }}
          >
            {(periods || []).map((period) => (
              <option key={period.id} value={period.id}>
                {period.label} - {PERIOD_STATUS_LABELS[period.status] || period.status}
              </option>
            ))}
          </select>
          {selectedPeriod && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {selectedPeriod.startDate} to {selectedPeriod.endDate}
              {jurisdictionLabel ? ` · ${jurisdictionLabel}` : ''}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <ShieldCheck size={16} aria-hidden="true" style={{ color: 'var(--text-secondary)' }} />
          <label htmlFor="ghg-role-select" style={{ fontSize: '0.82rem', fontWeight: 700 }}>
            Role perspective
          </label>
          <select
            id="ghg-role-select"
            value={activeRole}
            onChange={(event) => onRoleChange(event.target.value)}
            style={{
              padding: '0.4rem 0.6rem',
              borderRadius: 6,
              border: '1px solid var(--border-main)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
            }}
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role.id} value={role.id}>
                {role.label}
              </option>
            ))}
          </select>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', maxWidth: '40ch' }}>
            <Users size={12} aria-hidden="true" /> Demonstration perspective. Production roles come
            from the signed-in account; the service still enforces every permission.
          </span>
        </div>
      </div>
    </header>
  );
}
