import {
  AlertOctagon,
  PhoneCall,
  Wifi,
  WifiOff,
  Filter,
  PlusCircle,
  FileText,
  Navigation,
  Inbox,
  ShieldAlert,
} from 'lucide-react';
import { UP_PILOT_DISTRICTS, INCIDENT_TYPES, SOURCE_TIERS } from '../../data/upFloodIncidentContract';

export default function FloodResponseHeader({
  filters,
  onFilterChange,
  metrics,
  lowBandwidthMode,
  onToggleLowBandwidth,
  onOpenReportModal,
  onOpenWardModal,
  onOpenRouteModal,
  onOpenDraftModal,
  draftQueueCount,
  isOnline,
}) {
  return (
    <header className="flood-response-header" style={{ marginBottom: '1.5rem' }}>
      {/* 1. MANDATORY EMERGENCY SAFEGUARD BANNER */}
      <div
        role="alert"
        aria-label="Emergency Services Helpline Notice"
        style={{
          background: 'var(--danger-bg, #7f1d1d)',
          color: '#ffffff',
          padding: '0.85rem 1.25rem',
          borderRadius: '0.75rem',
          marginBottom: '1rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '280px' }}>
          <AlertOctagon size={28} aria-hidden="true" style={{ flexShrink: 0, color: '#fca5a5' }} />
          <div>
            <strong style={{ display: 'block', fontSize: '0.95rem', letterSpacing: '0.02em' }}>
              NOT AN EMERGENCY DISPATCH SERVICE
            </strong>
            <span style={{ fontSize: '0.82rem', opacity: 0.95 }}>
              For water rescue, medical emergency, or severe life threats, contact official UP Disaster & Emergency response immediately.
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <a
            href="tel:112"
            className="btn btn-sm"
            style={{
              background: '#ffffff',
              color: '#991b1b',
              fontWeight: 700,
              fontSize: '0.82rem',
              padding: '0.4rem 0.75rem',
              borderRadius: '0.5rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              textDecoration: 'none',
            }}
          >
            <PhoneCall size={14} /> 112 (Police / Emergency)
          </a>
          <a
            href="tel:1070"
            className="btn btn-sm"
            style={{
              background: '#ffffff',
              color: '#991b1b',
              fontWeight: 700,
              fontSize: '0.82rem',
              padding: '0.4rem 0.75rem',
              borderRadius: '0.5rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              textDecoration: 'none',
            }}
          >
            <PhoneCall size={14} /> 1070 (UP State Disaster)
          </a>
          <a
            href="tel:1077"
            className="btn btn-sm"
            style={{
              background: '#fef2f2',
              color: '#991b1b',
              fontWeight: 700,
              fontSize: '0.82rem',
              padding: '0.4rem 0.75rem',
              borderRadius: '0.5rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              textDecoration: 'none',
            }}
          >
            <PhoneCall size={14} /> 1077 (District Control)
          </a>
        </div>
      </div>

      {/* 2. TITLE BAR & ACTION BUTTONS */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          padding: '1rem',
          background: 'var(--bg-card, #1e293b)',
          borderRadius: '0.75rem',
          border: '1px solid var(--border-light, #334155)',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldAlert size={26} color="var(--accent, #38bdf8)" />
            UP Flooded-Road & Drain Blockage Response Board
          </h1>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}>
            Time-bound civic waterlogging registry for Uttar Pradesh districts. Freshness decay active.
            {!isOnline && (
              <span style={{ color: '#facc15', marginLeft: '0.5rem', fontWeight: 600 }}>
                ● Offline Mode
              </span>
            )}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          {/* Low Bandwidth Toggle */}
          <button
            type="button"
            onClick={onToggleLowBandwidth}
            aria-pressed={lowBandwidthMode}
            className="btn btn-secondary btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.82rem',
              padding: '0.45rem 0.75rem',
              background: lowBandwidthMode ? 'var(--warning-bg, #854d0e)' : undefined,
              color: lowBandwidthMode ? '#fef08a' : undefined,
            }}
            title="Toggle Low-Bandwidth Mode for slow 2G connections"
          >
            {lowBandwidthMode ? <WifiOff size={15} /> : <Wifi size={15} />}
            {lowBandwidthMode ? 'Low-Bandwidth (Active)' : 'Low-Bandwidth Mode'}
          </button>

          {/* Offline Draft Queue Button */}
          <button
            type="button"
            onClick={onOpenDraftModal}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}
          >
            <Inbox size={15} />
            Offline Drafts {draftQueueCount > 0 && <span className="badge" style={{ background: '#e11d48', color: '#fff', borderRadius: '99px', padding: '0.1rem 0.4rem', fontSize: '0.75rem' }}>{draftQueueCount}</span>}
          </button>

          {/* Route Safety Checker */}
          <button
            type="button"
            onClick={onOpenRouteModal}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}
          >
            <Navigation size={15} /> Check Corridor Safety
          </button>

          {/* Ward Drain Summary & Petition */}
          <button
            type="button"
            onClick={onOpenWardModal}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}
          >
            <FileText size={15} /> Ward Drain Petition
          </button>

          {/* Report Incident */}
          <button
            type="button"
            onClick={onOpenReportModal}
            className="btn btn-primary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 700 }}
          >
            <PlusCircle size={15} /> Report Waterlogging
          </button>
        </div>
      </div>

      {/* 3. METRIC CARDS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '0.75rem',
          marginTop: '1rem',
        }}
      >
        <div style={{ padding: '0.75rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '0.5rem' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Active Severe Hazards</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f43f5e' }}>{metrics.activeHazardsCount}</div>
        </div>
        <div style={{ padding: '0.75rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '0.5rem' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Blocked Municipal Drains</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f59e0b' }}>{metrics.blockedDrainsCount}</div>
        </div>
        <div style={{ padding: '0.75rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '0.5rem' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Official Authority Alerts</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#a855f7' }}>{metrics.officialAlertsCount}</div>
        </div>
        <div style={{ padding: '0.75rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '0.5rem' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Stale Observations (Excluded)</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#64748b' }}>{metrics.staleCount}</div>
        </div>
      </div>

      {/* 4. FILTERS & SEARCH BAR */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          alignItems: 'center',
          marginTop: '1rem',
          padding: '0.75rem',
          background: 'var(--bg-card)',
          borderRadius: '0.5rem',
          border: '1px solid var(--border-light)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          <Filter size={15} /> Filters:
        </div>

        {/* District Picker */}
        <select
          value={filters.district}
          onChange={(e) => onFilterChange({ ...filters, district: e.target.value })}
          aria-label="Filter by UP District"
          style={{
            padding: '0.4rem 0.6rem',
            borderRadius: '0.4rem',
            background: 'var(--bg-card-hover, #0f172a)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-light)',
            fontSize: '0.82rem',
          }}
        >
          <option value="all">All UP Districts</option>
          {UP_PILOT_DISTRICTS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        {/* Incident Type */}
        <select
          value={filters.incidentType}
          onChange={(e) => onFilterChange({ ...filters, incidentType: e.target.value })}
          aria-label="Filter by Incident Type"
          style={{
            padding: '0.4rem 0.6rem',
            borderRadius: '0.4rem',
            background: 'var(--bg-card-hover, #0f172a)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-light)',
            fontSize: '0.82rem',
          }}
        >
          <option value="all">All Incident Types</option>
          <option value={INCIDENT_TYPES.FLOODED_ROAD}>Flooded Roads</option>
          <option value={INCIDENT_TYPES.BLOCKED_DRAIN}>Blocked Drains</option>
          <option value={INCIDENT_TYPES.PASSABLE_ROUTE}>Passable Routes</option>
        </select>

        {/* Source Tier */}
        <select
          value={filters.sourceTier}
          onChange={(e) => onFilterChange({ ...filters, sourceTier: e.target.value })}
          aria-label="Filter by Source Tier"
          style={{
            padding: '0.4rem 0.6rem',
            borderRadius: '0.4rem',
            background: 'var(--bg-card-hover, #0f172a)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-light)',
            fontSize: '0.82rem',
          }}
        >
          <option value="all">All Source Tiers</option>
          <option value={SOURCE_TIERS.OFFICIAL_EMERGENCY_ALERT}>Official Disaster Alerts Only</option>
          <option value={SOURCE_TIERS.MUNICIPAL_ADVISORY}>Municipal Advisories Only</option>
          <option value={SOURCE_TIERS.CITIZEN_REPORT}>Citizen Reports Only</option>
        </select>

        {/* Status / Freshness Filter */}
        <select
          value={filters.statusFilter}
          onChange={(e) => onFilterChange({ ...filters, statusFilter: e.target.value })}
          aria-label="Filter by Freshness Status"
          style={{
            padding: '0.4rem 0.6rem',
            borderRadius: '0.4rem',
            background: 'var(--bg-card-hover, #0f172a)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-light)',
            fontSize: '0.82rem',
          }}
        >
          <option value="all">All Reports (Current &amp; Stale)</option>
          <option value="current_only">Current / Fresh Only (&lt; 2h)</option>
          <option value="stale_only">Stale Only (Needs Reconfirmation)</option>
          <option value="hazards_only">Severe Active Hazards Only</option>
        </select>

        {/* Search Query */}
        <input
          type="search"
          placeholder="Search locality, ward, or corridor..."
          value={filters.searchQuery}
          onChange={(e) => onFilterChange({ ...filters, searchQuery: e.target.value })}
          aria-label="Search incident reports"
          style={{
            flex: 1,
            minWidth: '200px',
            padding: '0.4rem 0.75rem',
            borderRadius: '0.4rem',
            background: 'var(--bg-card-hover, #0f172a)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-light)',
            fontSize: '0.82rem',
          }}
        />
      </div>
    </header>
  );
}
