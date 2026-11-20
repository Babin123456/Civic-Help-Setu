import {
  AlertTriangle,
  Calendar,
  ThumbsUp,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Wrench,
  Eye,
  Info,
} from 'lucide-react';
import {
  HAZARD_TYPE_LABELS,
  AUDIT_STATUSES,
  AUDIT_STATUS_LABELS,
  HAZARD_SEVERITY_LEVELS,
  ROAD_AUTHORITY_METADATA,
} from '../../data/upSchoolZoneSafetyContract';

const SEVERITY_COLORS = {
  [HAZARD_SEVERITY_LEVELS.CRITICAL]: { bg: 'rgba(239, 68, 68, 0.15)', text: '#dc2626', border: '#fca5a5' },
  [HAZARD_SEVERITY_LEVELS.HIGH]: { bg: 'rgba(249, 115, 22, 0.15)', text: '#ea580c', border: '#fdba74' },
  [HAZARD_SEVERITY_LEVELS.MEDIUM]: { bg: 'rgba(245, 158, 11, 0.15)', text: '#d97706', border: '#fde68a' },
  [HAZARD_SEVERITY_LEVELS.LOW]: { bg: 'rgba(59, 130, 246, 0.15)', text: '#2563eb', border: '#bfdbfe' },
};

const STATUS_ICONS = {
  [AUDIT_STATUSES.REPORTED]: Clock,
  [AUDIT_STATUSES.ACKNOWLEDGED]: Info,
  [AUDIT_STATUSES.INSPECTION_SCHEDULED]: Calendar,
  [AUDIT_STATUSES.INSPECTED]: Eye,
  [AUDIT_STATUSES.INTERIM_MEASURE_IMPLEMENTED]: Wrench,
  [AUDIT_STATUSES.RESOLVED]: CheckCircle2,
};

export default function SchoolZoneAuditFeed({
  audits = [],
  onSelectAuditForTracking,
  onEndorseAudit,
  onOpenSmcExportForSchool,
}) {
  if (audits.length === 0) {
    return (
      <div
        style={{
          padding: '3rem 1.5rem',
          textAlign: 'center',
          background: 'var(--bg-card, #ffffff)',
          borderRadius: '0.75rem',
          border: '1px dashed var(--border-light, #cbd5e1)',
          marginTop: '1rem',
        }}
      >
        <AlertTriangle size={36} style={{ color: 'var(--text-tertiary, #94a3b8)', margin: '0 auto 0.75rem auto' }} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
          No Matching School Zone Audits
        </h3>
        <p style={{ color: 'var(--text-secondary, #64748b)', fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto' }}>
          No hazard reports found matching your current filter criteria. Try adjusting the search query or report a new school-zone audit.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
      {audits.map((audit) => {
        const severityStyle = SEVERITY_COLORS[audit.severity] || SEVERITY_COLORS.medium;
        const authorityInfo = ROAD_AUTHORITY_METADATA[audit.assignedAuthority] || {
          label: audit.assignedAuthority,
          shortName: audit.assignedAuthority,
        };
        const StatusIcon = STATUS_ICONS[audit.status] || Clock;

        return (
          <article
            key={audit.id}
            style={{
              padding: '1.25rem',
              background: 'var(--bg-card, #ffffff)',
              borderRadius: '0.625rem',
              border: '1px solid var(--border-light, #e2e8f0)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
            }}
          >
            {/* Header: School Name, UDISE+, Status Pill */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '0.25rem',
                      background: 'rgba(59, 130, 246, 0.1)',
                      color: 'var(--primary, #2563eb)',
                      fontFamily: 'monospace',
                    }}
                  >
                    UDISE: {audit.udiseCode}
                  </span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary, #64748b)',
                    }}
                  >
                    • {audit.gateId}
                  </span>
                </div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0.25rem 0 0 0' }}>
                  {audit.schoolName || audit.schoolId}
                </h2>
              </div>

              {/* Status Pill */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '999px',
                  background:
                    audit.status === AUDIT_STATUSES.RESOLVED
                      ? 'rgba(16, 185, 129, 0.12)'
                      : audit.status === AUDIT_STATUSES.INTERIM_MEASURE_IMPLEMENTED
                      ? 'rgba(245, 158, 11, 0.12)'
                      : 'rgba(59, 130, 246, 0.12)',
                  color:
                    audit.status === AUDIT_STATUSES.RESOLVED
                      ? '#059669'
                      : audit.status === AUDIT_STATUSES.INTERIM_MEASURE_IMPLEMENTED
                      ? '#d97706'
                      : '#2563eb',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                }}
              >
                <StatusIcon size={14} />
                {AUDIT_STATUS_LABELS[audit.status] || audit.status}
              </div>
            </div>

            {/* Hazard Title & Severity */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', flexWrap: 'wrap' }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '0.25rem',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  background: severityStyle.bg,
                  color: severityStyle.text,
                  border: `1px solid ${severityStyle.border}`,
                }}
              >
                {audit.severity} Severity
              </span>

              <span
                style={{
                  display: 'inline-block',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '0.25rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  background: 'var(--bg-tag, #f1f5f9)',
                  color: 'var(--text-secondary, #475569)',
                }}
              >
                {HAZARD_TYPE_LABELS[audit.hazardType] || audit.hazardType}
              </span>

              <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, flex: '1 1 100%' }}>
                {audit.hazardTitle}
              </h3>
            </div>

            {/* Severity Rationale & Description */}
            <p
              style={{
                margin: 0,
                fontSize: '0.86rem',
                color: 'var(--text-secondary, #475569)',
                lineHeight: 1.45,
              }}
            >
              {audit.severityRationale}
            </p>

            {/* Authority Routing Box (AC-3) */}
            <div
              style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '0.375rem',
                background: 'rgba(15, 23, 42, 0.03)',
                border: '1px solid var(--border-light, #e2e8f0)',
                fontSize: '0.82rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <span>
                  <strong>Assigned Road Authority:</strong> {authorityInfo.label}
                </span>
                {audit.isAuthorityManuallyOverridden && (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.1rem 0.4rem',
                      borderRadius: '0.25rem',
                      background: 'rgba(234, 88, 12, 0.1)',
                      color: '#ea580c',
                    }}
                  >
                    Local Manual Correction
                  </span>
                )}
              </div>
              <div style={{ color: 'var(--text-tertiary, #64748b)', fontSize: '0.76rem' }}>
                <strong>Routing Provenance Source:</strong> {audit.authoritySource}
              </div>
            </div>

            {/* Privacy Redacted Evidence Photo (AC-2) */}
            {audit.publicImageUrl && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div
                  style={{
                    position: 'relative',
                    maxHeight: '190px',
                    borderRadius: '0.375rem',
                    overflow: 'hidden',
                    border: '1px solid var(--border-light, #e2e8f0)',
                    background: '#0f172a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <img
                    src={audit.publicImageUrl}
                    alt="Privacy-redacted school hazard evidence"
                    style={{ width: '100%', height: 'auto', maxHeight: '190px', objectFit: 'contain' }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '0.4rem',
                      left: '0.4rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.2rem 0.5rem',
                      background: 'rgba(0,0,0,0.75)',
                      borderRadius: '0.25rem',
                      fontSize: '0.7rem',
                      color: '#ffffff',
                      backdropFilter: 'blur(4px)',
                    }}
                  >
                    <ShieldCheck size={12} style={{ color: '#60a5fa' }} />
                    AC-2 Privacy Redacted: Faces & Plates Blurred
                  </div>
                </div>
              </div>
            )}

            {/* Footer Row: Metadata, Endorsement, and Actions */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
                paddingTop: '0.5rem',
                borderTop: '1px solid var(--border-light, #f1f5f9)',
                fontSize: '0.8rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', color: 'var(--text-tertiary, #64748b)' }}>
                <span>Reported: {audit.auditDate}</span>
                <span>Role: {audit.reporterRole}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => onEndorseAudit(audit.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                  }}
                  title="Co-sign this audit report to elevate priority"
                >
                  <ThumbsUp size={13} />
                  Co-sign ({audit.endorsementCount || 1})
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => onOpenSmcExportForSchool(audit.schoolId)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.78rem',
                  }}
                >
                  SMC Dossier
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => onSelectAuditForTracking(audit)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    background: 'var(--primary, #2563eb)',
                    color: '#ffffff',
                  }}
                >
                  Track Lifecycle
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
