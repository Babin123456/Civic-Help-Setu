import {
  Lightbulb,
  AlertTriangle,
  Wrench,
  CheckCircle2,
  MapPin,
  PlusCircle,
  Search,
  Shield,
  Layers,
} from 'lucide-react';
import { STREETLIGHT_JURISDICTIONS } from '../../data/streetlightSeedData';
import { STREETLIGHT_ROLES } from '../../services/streetlightConstants';

export default function StreetlightHeader({
  metrics,
  selectedWard,
  onWardChange,
  onOpenReportModal,
  onOpenTrackModal,
  activeRole,
  onRoleChange,
}) {
  return (
    <header className="streetlight-header" style={{ marginBottom: '1.75rem' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: '#fef3c7',
                color: '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-hidden="true"
            >
              <Lightbulb size={22} />
            </div>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, margin: 0, color: 'var(--text-primary, #0f172a)' }}>
              Streetlight Outage & Repair Prioritization
            </h1>
          </div>
          <p style={{ margin: 0, color: 'var(--text-secondary, #475569)', fontSize: '0.925rem', maxWidth: '720px' }}>
            End-to-end municipal lighting maintenance: deterministic spatial clustering of citizen fault reports, public safety corridor prioritization, and technician dispatch tracking.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.6rem' }}>
          <button
            type="button"
            onClick={onOpenTrackModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              padding: '0.45rem 0.85rem',
              borderRadius: '0.5rem',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-main)',
              background: 'var(--bg-surface)',
              cursor: 'pointer',
            }}
          >
            <Search size={15} aria-hidden="true" />
            Track Status
          </button>
          <button
            type="button"
            onClick={onOpenReportModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              padding: '0.45rem 1rem',
              borderRadius: '0.5rem',
              background: 'var(--accent-main)',
              border: '1px solid var(--accent-main)',
              color: '#050505',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
            }}
          >
            <PlusCircle size={15} aria-hidden="true" />
            Report Outage
          </button>
        </div>
      </div>

      {/* Control Bar: Ward Scope & Role View Switcher */}
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
          marginBottom: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MapPin size={16} style={{ color: 'var(--text-secondary)' }} aria-hidden="true" />
          <label htmlFor="ward-scope-select" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Ward Scope:
          </label>
          <select
            id="ward-scope-select"
            value={selectedWard}
            onChange={(e) => onWardChange(e.target.value)}
            style={{
              padding: '0.35rem 0.65rem',
              borderRadius: '0.375rem',
              border: '1px solid var(--border-main)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              fontWeight: 500,
            }}
          >
            <option value="all" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>All Municipal Wards</option>
            {STREETLIGHT_JURISDICTIONS.map((j) => (
              <option key={j.id} value={j.id} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                {j.name} ({j.totalPoles} poles)
              </option>
            ))}
          </select>
        </div>

        {/* Role Perspective Switcher for Testing/Demonstrating Least Privilege */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield size={16} style={{ color: 'var(--text-secondary)' }} aria-hidden="true" />
          <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Perspective:
          </span>
          <div style={{ display: 'inline-flex', background: 'var(--bg-surface)', border: '1px solid var(--border-main)', borderRadius: '6px', padding: '2px' }}>
            {[
              { id: STREETLIGHT_ROLES.CITIZEN, label: 'Citizen' },
              { id: STREETLIGHT_ROLES.OPERATOR, label: 'Operator' },
              { id: STREETLIGHT_ROLES.TECHNICIAN, label: 'Technician' },
              { id: STREETLIGHT_ROLES.ADMIN, label: 'Admin' },
            ].map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onRoleChange(r.id)}
                style={{
                  border: 'none',
                  padding: '0.25rem 0.6rem',
                  fontSize: '0.75rem',
                  fontWeight: activeRole === r.id ? 700 : 500,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  background: activeRole === r.id ? 'var(--accent-main)' : 'transparent',
                  color: activeRole === r.id ? '#050505' : 'var(--text-secondary)',
                  boxShadow: activeRole === r.id ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div
        className="streetlight-kpi-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: '1rem',
        }}
      >
        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary, #64748b)', textTransform: 'uppercase' }}>
              Monitored Poles
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)' }}>
              {metrics.totalPoles || 0}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary, #64748b)', textTransform: 'uppercase' }}>
              Active Outage Clusters
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#dc2626' }}>
              {metrics.activeClusters || 0}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#fff7ed', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lightbulb size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary, #64748b)', textTransform: 'uppercase' }}>
              Critical Dark Zones
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ea580c' }}>
              {metrics.criticalZones || 0}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#fefce8', color: '#ca8a04', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Wrench size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary, #64748b)', textTransform: 'uppercase' }}>
              Field Work Orders
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)' }}>
              {metrics.activeWorkOrders || 0}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#ecfdf5', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary, #64748b)', textTransform: 'uppercase' }}>
              Resolved Corridors
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#16a34a' }}>
              {metrics.resolvedClusters || 0}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
