import { useState, useMemo } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  X,
  Filter,
  ArrowRight,
  ExternalLink,
  Info,
} from 'lucide-react';
import {
  auditCatalogueRuleConflicts,
  CONFLICT_SEVERITY,
  CONFLICT_TYPES,
} from '../../services/ruleConflictDetectorService';

export default function RuleConflictInspectorModal({ isOpen, onClose, services = [] }) {
  const [filterSeverity, setFilterSeverity] = useState('ALL');

  const auditReport = useMemo(() => {
    return auditCatalogueRuleConflicts(services);
  }, [services]);

  const filteredReports = useMemo(() => {
    if (filterSeverity === 'ALL') return auditReport.reports;
    return auditReport.reports.filter((r) =>
      r.conflicts.some((c) => c.severity === filterSeverity)
    );
  }, [auditReport, filterSeverity]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        padding: '1rem',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rule-conflict-modal-title"
    >
      <div
        style={{
          background: 'var(--card-bg, #0f172a)',
          border: '1px solid var(--border-color, #334155)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '850px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-color, #334155)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                padding: '0.5rem',
                borderRadius: '8px',
                background: auditReport.totalConflicts > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                color: auditReport.totalConflicts > 0 ? '#ef4444' : '#10b981',
                display: 'flex',
              }}
            >
              {auditReport.totalConflicts > 0 ? <ShieldAlert size={22} /> : <CheckCircle2 size={22} />}
            </div>
            <div>
              <h2
                id="rule-conflict-modal-title"
                style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-main, #f8fafc)' }}
              >
                Civic Criteria & Rule Conflict Inspector
              </h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted, #94a3b8)' }}>
                Auditing {auditReport.totalServices} services • {auditReport.totalConflicts} potential rule contradictions detected
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted, #94a3b8)', cursor: 'pointer' }}
            aria-label="Close inspector"
          >
            <X size={20} />
          </button>
        </div>

        {/* Filters & Stats Bar */}
        <div
          style={{
            padding: '0.75rem 1.5rem',
            background: 'rgba(0, 0, 0, 0.2)',
            borderBottom: '1px solid var(--border-color, #334155)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <Filter size={16} color="var(--text-muted, #94a3b8)" />
            <span style={{ color: 'var(--text-muted, #94a3b8)' }}>Filter by Severity:</span>
            {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setFilterSeverity(lvl)}
                style={{
                  padding: '0.2rem 0.6rem',
                  borderRadius: '99px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: filterSeverity === lvl ? '1px solid var(--accent-main, #38bdf8)' : '1px solid var(--border-color, #475569)',
                  background: filterSeverity === lvl ? 'var(--accent-main, #38bdf8)' : 'transparent',
                  color: filterSeverity === lvl ? '#0f172a' : 'var(--text-main, #cbd5e1)',
                }}
              >
                {lvl}
              </button>
            ))}
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)' }}>
            Showing {filteredReports.length} flagged services
          </div>
        </div>

        {/* Reports Body */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredReports.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <CheckCircle2 size={48} color="#10b981" style={{ margin: '0 auto 1rem' }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.5rem' }}>No Rule Conflicts Found!</h3>
              <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto' }}>
                All service eligibility guidelines, processing times, and document prerequisites meet logical consistency standards.
              </p>
            </div>
          ) : (
            filteredReports.map((report) => (
              <div
                key={report.serviceId}
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-color, #334155)',
                  borderRadius: '12px',
                  padding: '1rem 1.25rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.25rem', color: 'var(--text-main, #f8fafc)' }}>
                      {report.serviceName}
                    </h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>ID: {report.serviceId}</span>
                  </div>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.6rem',
                      borderRadius: '99px',
                      background: report.highestSeverity === 'HIGH' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: report.highestSeverity === 'HIGH' ? '#ef4444' : '#f59e0b',
                    }}
                  >
                    {report.conflictCount} Contradiction{report.conflictCount > 1 ? 's' : ''}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {report.conflicts.map((conflict) => (
                    <div
                      key={conflict.id}
                      style={{
                        padding: '0.75rem',
                        borderRadius: '8px',
                        background: 'rgba(0, 0, 0, 0.2)',
                        borderLeft: `3px solid ${conflict.severity === 'HIGH' ? '#ef4444' : '#f59e0b'}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.85rem', color: '#f8fafc', marginBottom: '0.25rem' }}>
                        <AlertTriangle size={14} color={conflict.severity === 'HIGH' ? '#ef4444' : '#f59e0b'} />
                        <span>{conflict.title}</span>
                      </div>
                      <p style={{ margin: '0 0 0.4rem', fontSize: '0.8rem', color: 'var(--text-muted, #cbd5e1)', lineHeight: 1.4 }}>
                        {conflict.description}
                      </p>
                      <div style={{ fontSize: '0.75rem', color: 'var(--accent-main, #38bdf8)', background: 'rgba(56, 189, 248, 0.08)', padding: '0.35rem 0.6rem', borderRadius: '4px' }}>
                        💡 <strong>Recommended Fix:</strong> {conflict.resolutionSuggestion}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-color, #334155)',
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--accent-main, #38bdf8)',
              color: '#0f172a',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Done Inspecting
          </button>
        </div>
      </div>
    </div>
  );
}
