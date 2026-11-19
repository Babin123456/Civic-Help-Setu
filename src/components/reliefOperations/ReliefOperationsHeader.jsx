import { useId } from 'react';
import {
  HandHeart,
  RefreshCw,
  ShieldCheck,
  UserRound,
  MapPin,
} from 'lucide-react';
import { RELIEF_ROLE_LABELS } from '../../services/reliefOperationsConstants';

const RELIEF_TABS = Object.freeze([
  { id: 'overview', label: 'Overview' },
  { id: 'needs', label: 'Need reports' },
  { id: 'forecast', label: 'Forecast & recommendations' },
  { id: 'allocations', label: 'Allocations & deliveries' },
  { id: 'inventory', label: 'Inventory & sites' },
  { id: 'public', label: 'Public status' },
  { id: 'audit', label: 'Audit trail' },
]);

const METRIC_LABELS = [
  ['openNeeds', 'Open need reports'],
  ['peopleAffected', 'People affected'],
  ['pendingApprovals', 'Awaiting approval'],
  ['activeIncidents', 'Active incidents'],
  ['reservedUnits', 'Units reserved'],
  ['staleNeeds', 'Stale reports'],
];

export default function ReliefOperationsHeader({
  metrics,
  activeTab,
  onTabChange,
  roleKey,
  onRoleChange,
  perspectives,
  jurisdictionId,
  onJurisdictionChange,
  jurisdictions,
  onRefresh,
  lastRefreshed,
  statusMessage,
  visibleTabs,
}) {
  const headingId = useId();
  const metricsAvailable = Boolean(metrics);
  const availableTabs = visibleTabs
    ? RELIEF_TABS.filter((tab) => visibleTabs.includes(tab.id))
    : RELIEF_TABS;

  return (
    <header className="relief-header">
      <div className="relief-header-top">
        <div className="relief-title-block">
          <span className="relief-title-icon" aria-hidden="true">
            <HandHeart size={24} />
          </span>
          <div>
            <h1 id={headingId}>Disaster Relief Needs &amp; Resource Allocation</h1>
            <p className="relief-subtitle">
              Verified need reports, transactional stock reservations, human-approved allocations and
              delivery confirmation. Automated recommendations are advisory and never make medical triage
              decisions.
            </p>
          </div>
        </div>

        <div className="relief-header-controls">
          <div className="relief-field relief-field--compact">
            <label htmlFor="relief-perspective">
              <UserRound size={14} aria-hidden="true" /> Viewing as
            </label>
            <select
              id="relief-perspective"
              value={roleKey}
              onChange={(event) => onRoleChange(event.target.value)}
            >
              {perspectives.map((perspective) => (
                <option key={perspective.key} value={perspective.key}>
                  {RELIEF_ROLE_LABELS[perspective.role] || perspective.label}
                </option>
              ))}
            </select>
          </div>

          <div className="relief-field relief-field--compact">
            <label htmlFor="relief-jurisdiction">
              <MapPin size={14} aria-hidden="true" /> Jurisdiction
            </label>
            <select
              id="relief-jurisdiction"
              value={jurisdictionId}
              onChange={(event) => onJurisdictionChange(event.target.value)}
            >
              {jurisdictions.map((jurisdiction) => (
                <option key={jurisdiction.id} value={jurisdiction.id}>
                  {jurisdiction.name}
                </option>
              ))}
            </select>
          </div>

          <button type="button" className="relief-button" onClick={onRefresh}>
            <RefreshCw size={15} aria-hidden="true" /> Refresh
          </button>
        </div>
      </div>

      <p className="relief-freshness">
        <ShieldCheck size={14} aria-hidden="true" />
        Last reviewed {lastRefreshed ? new Date(lastRefreshed).toLocaleString() : 'not yet'} · All
        operator actions are written to an append-only audit trail.
      </p>

      <div aria-live="polite" role="status" className="relief-announcer">
        {statusMessage}
      </div>

      {metricsAvailable && (
        <dl className="relief-kpi-grid">
          {METRIC_LABELS.map(([key, label]) => (
            <div className="relief-kpi" key={key}>
              <dt>{label}</dt>
              <dd>{Number(metrics[key] ?? 0).toLocaleString()}</dd>
            </div>
          ))}
        </dl>
      )}

      <nav className="relief-tabs" aria-label="Relief operations sections">
        {availableTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className="relief-tab"
            aria-current={activeTab === tab.id ? 'page' : undefined}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
