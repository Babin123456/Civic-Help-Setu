import {
  ShieldCheck,
  AlertTriangle,
  School,
  FileText,
  Plus,
  Search,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import {
  HAZARD_TYPE_LABELS,
  AUDIT_STATUS_LABELS,
  ROAD_AUTHORITY_METADATA,
} from '../../data/upSchoolZoneSafetyContract';

export default function SchoolZoneSafetyHeader({
  stats = { totalSchools: 0, activeHazards: 0, inProgress: 0, resolved: 0 },
  searchQuery,
  onSearchChange,
  selectedDistrict,
  onDistrictChange,
  selectedLocationType,
  onLocationTypeChange,
  selectedHazardType,
  onHazardTypeChange,
  selectedStatus,
  onStatusChange,
  selectedAuthority,
  onAuthorityChange,
  onOpenAuditModal,
  onOpenSmcExportModal,
  activeTab,
  onTabChange,
}) {
  return (
    <header className="school-safety-header" style={{ marginBottom: '1.5rem' }}>
      {/* Scope & Institutional Notice */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          padding: '0.5rem 0.85rem',
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: '0.5rem',
          marginBottom: '1rem',
          fontSize: '0.85rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldCheck size={18} style={{ color: 'var(--primary, #2563eb)' }} />
          <span>
            <strong>Uttar Pradesh Pilot Initiative:</strong> Government School Zones (UDISE+ Grounded) in Lucknow & Kanpur Municipal Wards and Rural Approach Corridors.
          </span>
        </div>
        <span
          style={{
            fontSize: '0.75rem',
            padding: '0.2rem 0.5rem',
            background: 'var(--bg-card, #ffffff)',
            borderRadius: '999px',
            border: '1px solid var(--border-light, #e2e8f0)',
            fontWeight: 600,
          }}
        >
          IRC:SP:88 & RTE Act Sec 21 Compliant
        </span>
      </div>

      {/* Main Title & Action Row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              margin: '0 0 0.4rem 0',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <School size={28} style={{ color: 'var(--primary, #2563eb)' }} />
            School-Zone Road Safety Audit System
          </h1>
          <p
            style={{
              margin: 0,
              color: 'var(--text-secondary, #64748b)',
              fontSize: '0.95rem',
              maxWidth: '750px',
            }}
          >
            Empowering communities, caregivers, and School Management Committees (SMCs) to document crossing hazards, protect child privacy, route evidence to the correct road-owning authority, and verify safety infrastructure resolutions.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onOpenSmcExportModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.55rem 0.95rem',
              fontSize: '0.88rem',
              fontWeight: 600,
            }}
          >
            <FileText size={16} />
            Export SMC Audit Dossier
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onOpenAuditModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.55rem 1rem',
              fontSize: '0.88rem',
              fontWeight: 600,
              background: 'var(--primary, #2563eb)',
              color: '#ffffff',
            }}
          >
            <Plus size={16} />
            Conduct Safety Audit
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.85rem',
          marginBottom: '1.25rem',
        }}
      >
        <div
          style={{
            padding: '0.85rem 1rem',
            background: 'var(--bg-card, #ffffff)',
            borderRadius: '0.5rem',
            border: '1px solid var(--border-light, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <div
            style={{
              padding: '0.5rem',
              background: 'rgba(59, 130, 246, 0.1)',
              borderRadius: '0.375rem',
              color: 'var(--primary, #2563eb)',
            }}
          >
            <School size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{stats.totalSchools}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #64748b)' }}>
              Registered School Zones
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '0.85rem 1rem',
            background: 'var(--bg-card, #ffffff)',
            borderRadius: '0.5rem',
            border: '1px solid var(--border-light, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <div
            style={{
              padding: '0.5rem',
              background: 'rgba(239, 68, 68, 0.1)',
              borderRadius: '0.375rem',
              color: '#ef4444',
            }}
          >
            <AlertTriangle size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{stats.activeHazards}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #64748b)' }}>
              Reported Active Hazards
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '0.85rem 1rem',
            background: 'var(--bg-card, #ffffff)',
            borderRadius: '0.5rem',
            border: '1px solid var(--border-light, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <div
            style={{
              padding: '0.5rem',
              background: 'rgba(245, 158, 11, 0.1)',
              borderRadius: '0.375rem',
              color: '#f59e0b',
            }}
          >
            <Clock size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{stats.inProgress}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #64748b)' }}>
              Inspected / Interim Measures
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '0.85rem 1rem',
            background: 'var(--bg-card, #ffffff)',
            borderRadius: '0.5rem',
            border: '1px solid var(--border-light, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <div
            style={{
              padding: '0.5rem',
              background: 'rgba(16, 185, 129, 0.1)',
              borderRadius: '0.375rem',
              color: '#10b981',
            }}
          >
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{stats.resolved}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #64748b)' }}>
              Permanent Infrastructure Fixed
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Row */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-light, #e2e8f0)',
          marginBottom: '1rem',
        }}
      >
        <button
          type="button"
          onClick={() => onTabChange('audits')}
          style={{
            padding: '0.5rem 1rem',
            border: 'none',
            borderBottom: activeTab === 'audits' ? '2px solid var(--primary, #2563eb)' : '2px solid transparent',
            background: 'none',
            fontWeight: activeTab === 'audits' ? 700 : 500,
            color: activeTab === 'audits' ? 'var(--primary, #2563eb)' : 'var(--text-secondary, #64748b)',
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          Audit Reports & Live Feed
        </button>
        <button
          type="button"
          onClick={() => onTabChange('schools')}
          style={{
            padding: '0.5rem 1rem',
            border: 'none',
            borderBottom: activeTab === 'schools' ? '2px solid var(--primary, #2563eb)' : '2px solid transparent',
            background: 'none',
            fontWeight: activeTab === 'schools' ? 700 : 500,
            color: activeTab === 'schools' ? 'var(--primary, #2563eb)' : 'var(--text-secondary, #64748b)',
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          School Zones Register Directory
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.65rem',
          alignItems: 'center',
          padding: '0.75rem',
          background: 'var(--bg-card, #ffffff)',
          borderRadius: '0.5rem',
          border: '1px solid var(--border-light, #e2e8f0)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', flex: '1 1 220px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.65rem', color: 'var(--text-tertiary, #94a3b8)' }} />
          <input
            type="text"
            placeholder="Search school name, UDISE+, or locality..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              width: '100%',
              padding: '0.45rem 0.75rem 0.45rem 2rem',
              borderRadius: '0.375rem',
              border: '1px solid var(--border-light, #e2e8f0)',
              background: 'var(--bg-input, #f8fafc)',
              color: 'var(--text-primary, #0f172a)',
              fontSize: '0.85rem',
            }}
          />
        </div>

        <select
          value={selectedDistrict}
          onChange={(e) => onDistrictChange(e.target.value)}
          aria-label="Filter by district"
          style={{
            padding: '0.45rem 0.65rem',
            borderRadius: '0.375rem',
            border: '1px solid var(--border-light, #e2e8f0)',
            background: 'var(--bg-card, #ffffff)',
            color: 'var(--text-primary, #0f172a)',
            fontSize: '0.85rem',
          }}
        >
          <option value="">All Districts</option>
          <option value="Lucknow">Lucknow</option>
          <option value="Kanpur Nagar">Kanpur Nagar</option>
        </select>

        <select
          value={selectedLocationType}
          onChange={(e) => onLocationTypeChange(e.target.value)}
          aria-label="Filter by location type"
          style={{
            padding: '0.45rem 0.65rem',
            borderRadius: '0.375rem',
            border: '1px solid var(--border-light, #e2e8f0)',
            background: 'var(--bg-card, #ffffff)',
            color: 'var(--text-primary, #0f172a)',
            fontSize: '0.85rem',
          }}
        >
          <option value="">All Scopes</option>
          <option value="urban">Urban Municipal</option>
          <option value="rural">Rural Link Approach</option>
          <option value="semi_urban">Semi-Urban Flank</option>
        </select>

        <select
          value={selectedHazardType}
          onChange={(e) => onHazardTypeChange(e.target.value)}
          aria-label="Filter by hazard category"
          style={{
            padding: '0.45rem 0.65rem',
            borderRadius: '0.375rem',
            border: '1px solid var(--border-light, #e2e8f0)',
            background: 'var(--bg-card, #ffffff)',
            color: 'var(--text-primary, #0f172a)',
            fontSize: '0.85rem',
          }}
        >
          <option value="">All Hazard Categories</option>
          {Object.entries(HAZARD_TYPE_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => onStatusChange(e.target.value)}
          aria-label="Filter by lifecycle status"
          style={{
            padding: '0.45rem 0.65rem',
            borderRadius: '0.375rem',
            border: '1px solid var(--border-light, #e2e8f0)',
            background: 'var(--bg-card, #ffffff)',
            color: 'var(--text-primary, #0f172a)',
            fontSize: '0.85rem',
          }}
        >
          <option value="">All Statuses</option>
          {Object.entries(AUDIT_STATUS_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={selectedAuthority}
          onChange={(e) => onAuthorityChange(e.target.value)}
          aria-label="Filter by road authority"
          style={{
            padding: '0.45rem 0.65rem',
            borderRadius: '0.375rem',
            border: '1px solid var(--border-light, #e2e8f0)',
            background: 'var(--bg-card, #ffffff)',
            color: 'var(--text-primary, #0f172a)',
            fontSize: '0.85rem',
          }}
        >
          <option value="">All Road Authorities</option>
          {Object.entries(ROAD_AUTHORITY_METADATA).map(([k, meta]) => (
            <option key={k} value={k}>
              {meta.shortName}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}
