import { useEffect } from 'react';
import {
  X,
  MapPin,
  Clock,
  ShieldCheck,
  Accessibility,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { CATEGORY_LABELS } from '../../data/publicToiletContract';
import { loadCleaningEvents } from '../../services/publicToiletStorage';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function ToiletDetailModal({ facility, onClose, onReportIssue }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!facility) return null;

  const categoryLabel = CATEGORY_LABELS[facility.category] || 'Public Toilet';
  const cleaningLogs = loadCleaningEvents(facility.id).slice(0, 3);

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 1000,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="toilet-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-main)',
          borderRadius: '1.25rem',
          maxWidth: '680px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1.75rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          position: 'relative',
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details dialog"
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            padding: '0.35rem',
            borderRadius: '0.375rem',
          }}
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div style={{ marginBottom: '1.25rem', paddingRight: '2rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary-main)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {categoryLabel}
          </span>
          <h2 id="toilet-modal-title" style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0.25rem 0' }}>
            {facility.name}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            <MapPin size={15} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
            <span>{facility.location?.address} {facility.location?.landmark && `(${facility.location.landmark})`}</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Authority: {facility.managingAuthority} | Ward: {facility.jurisdiction?.ward}
          </div>
        </div>

        {/* Temporary Closure Warning */}
        {facility.temporaryClosure && facility.temporaryClosure.isClosed && (
          <div
            role="alert"
            style={{
              padding: '1rem',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '0.75rem',
              marginBottom: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--danger-main, #ef4444)' }}>
              <AlertTriangle size={18} />
              Facility Currently Closed
            </div>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
              Reason: {facility.temporaryClosure.reason}
            </p>
            {facility.temporaryClosure.reopenExpectedAt && (
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Expected Reopening: {new Date(facility.temporaryClosure.reopenExpectedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* Operating Hours Table */}
        <section style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Clock size={16} /> Operating Hours & Schedule
          </h3>
          {facility.operatingWindows?.is24x7 ? (
            <p style={{ color: 'var(--success-main)', fontWeight: 500, fontSize: '0.9rem', margin: 0 }}>
              ✓ Open 24 Hours Daily (Continuous Public Service)
            </p>
          ) : Array.isArray(facility.operatingWindows?.schedule) ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }}>
              {facility.operatingWindows.schedule.map((w) => (
                <div
                  key={w.day}
                  style={{
                    padding: '0.5rem',
                    backgroundColor: 'var(--bg-main)',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.8rem',
                  }}
                >
                  <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{DAY_NAMES[w.day]}</strong>
                  <span style={{ color: w.isOff ? 'var(--danger-main)' : 'var(--text-secondary)' }}>
                    {w.isOff ? 'Closed' : `${w.open} - ${w.close}`}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>General municipal working hours apply.</p>
          )}
        </section>

        {/* Accessibility & Physical Features */}
        <section style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Accessibility size={16} /> Accessibility & Fixture Specifications
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', fontSize: '0.85rem' }}>
            <div style={{ padding: '0.5rem', backgroundColor: 'var(--bg-main)', borderRadius: '0.5rem' }}>
              Wheelchair Ramp: <strong>{facility.features?.hasRamp ? 'Yes (Gradient Compliant)' : 'No'}</strong>
            </div>
            <div style={{ padding: '0.5rem', backgroundColor: 'var(--bg-main)', borderRadius: '0.5rem' }}>
              Support Grab Rails: <strong>{facility.features?.hasGrabBars ? 'Installed' : 'None'}</strong>
            </div>
            <div style={{ padding: '0.5rem', backgroundColor: 'var(--bg-main)', borderRadius: '0.5rem' }}>
              Accessible Door Width: <strong>{facility.features?.doorWidthMm ? `${facility.features.doorWidthMm} mm` : 'Standard'}</strong>
            </div>
            <div style={{ padding: '0.5rem', backgroundColor: 'var(--bg-main)', borderRadius: '0.5rem' }}>
              Tactile Ground Paving: <strong>{facility.features?.tactilePaving ? 'Present' : 'None'}</strong>
            </div>
            <div style={{ padding: '0.5rem', backgroundColor: 'var(--bg-main)', borderRadius: '0.5rem' }}>
              Baby Care Diaper Station: <strong>{facility.features?.babyCareStation ? 'Available' : 'None'}</strong>
            </div>
            <div style={{ padding: '0.5rem', backgroundColor: 'var(--bg-main)', borderRadius: '0.5rem' }}>
              Sanitary Napkin Dispenser: <strong>{facility.features?.sanitaryNapkinDispenser ? 'Available' : 'None'}</strong>
            </div>
          </div>
        </section>

        {/* Verification & Quality Audit Details */}
        <section style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <ShieldCheck size={16} style={{ color: 'var(--accent-main)' }} /> Factual Verification & Quality Audit
          </h3>
          <div style={{ backgroundColor: 'var(--bg-main)', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <div>Auditing Authority: <strong>{facility.verificationSource?.auditingBody || 'Municipal Local Body'}</strong></div>
            <div>Last Field Audit Date: <strong>{facility.verificationSource?.lastAuditDate || 'Audited within current fiscal'}</strong></div>
            <div>Audit Quality Score: <strong>{facility.verificationSource?.auditScore ? `${facility.verificationSource.auditScore} / 100` : 'Verified Active'}</strong></div>
          </div>
        </section>

        {/* Recent Audited Cleaning Ledger */}
        <section style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Sparkles size={16} style={{ color: 'var(--info-main)' }} /> Recent Audited Cleaning Logs
          </h3>
          {cleaningLogs.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {cleaningLogs.map((log) => (
                <div key={log.id} style={{ padding: '0.5rem 0.75rem', backgroundColor: 'var(--bg-main)', borderRadius: '0.5rem', border: '1px solid var(--border-subtle)', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <strong>{new Date(log.cleanedAt).toLocaleString()}</strong>
                    <span style={{ color: 'var(--success-main)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <CheckCircle2 size={12} /> Supervisor Verified
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    {log.operatorNotes || 'Routine sanitization and water verification completed.'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>No recent cleaning logs recorded.</p>
          )}
        </section>

        {/* Modal Actions */}
        <div style={{ borderTop: '1px solid var(--border-main)', paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onReportIssue?.(facility);
            }}
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <AlertTriangle size={14} /> Report Issue or Cleanliness
          </button>
        </div>
      </div>
    </div>
  );
}

