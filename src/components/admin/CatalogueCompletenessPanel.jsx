import { useState, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  EyeOff,
  RotateCcw,
  ExternalLink,
  Filter
} from 'lucide-react';
import {
  auditEntireCatalogue,
  dismissFinding,
  restoreFinding,
  clearAllDismissals,
  getDismissedFindings
} from '../../services/catalogueCompletenessService';

export default function CatalogueCompletenessPanel({ services = [], onEditService }) {
  const [filterSeverity, setFilterSeverity] = useState('all'); // 'all' | 'critical' | 'high'
  const [hideDismissed, setHideDismissed] = useState(true);
  const [expandedServiceId, setExpandedServiceId] = useState(null);
  const [dismissalNonce, setDismissalNonce] = useState(0);

  const report = useMemo(() => {
    return auditEntireCatalogue(services, { filterDismissed: hideDismissed });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, hideDismissed, dismissalNonce]);

  const dismissedMap = useMemo(() => {
    return getDismissedFindings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissalNonce]);

  const handleDismiss = (serviceId, field) => {
    dismissFinding(serviceId, field);
    setDismissalNonce((n) => n + 1);
  };

  const handleRestore = (serviceId, field) => {
    restoreFinding(serviceId, field);
    setDismissalNonce((n) => n + 1);
  };

  const handleClearDismissals = () => {
    if (window.confirm('Restore all dismissed catalogue quality advisories?')) {
      clearAllDismissals();
      setDismissalNonce((n) => n + 1);
    }
  };

  const filteredFindings = useMemo(() => {
    if (filterSeverity === 'all') return report.findings;
    return report.findings.filter((item) =>
      item.missingFields.some((f) => f.severity === filterSeverity)
    );
  }, [report.findings, filterSeverity]);

  const totalDismissedCount = Object.values(dismissedMap).reduce((acc, curr) => acc + curr.length, 0);

  return (
    <section className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <ShieldAlert size={20} color="var(--accent-main, #2563eb)" />
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
              AI Catalogue Completeness & Data Quality Audit
            </h2>
          </div>
          <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Flags missing administrative fields and explains their direct impact on the citizen user journey. No records are auto-modified.
          </p>
        </div>

        {totalDismissedCount > 0 && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleClearDismissals}
            style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <RotateCcw size={14} /> Restore Dismissed ({totalDismissedCount})
          </button>
        )}
      </div>

      {/* Metrics Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="stat-card" style={{ padding: '1rem', border: '1px solid var(--border-main)', borderRadius: '10px' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Catalogue Health
          </span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: report.averageScore >= 80 ? '#16a34a' : '#d97706' }}>
            {report.averageScore}%
          </div>
          <small style={{ color: 'var(--text-secondary)' }}>Avg Completeness Score</small>
        </div>

        <div className="stat-card" style={{ padding: '1rem', border: '1px solid var(--border-main)', borderRadius: '10px' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Complete Records
          </span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#16a34a' }}>
            {report.completeCount} / {report.totalServices}
          </div>
          <small style={{ color: 'var(--text-secondary)' }}>100% Core Fields Populated</small>
        </div>

        <div className="stat-card" style={{ padding: '1rem', border: '1px solid var(--border-main)', borderRadius: '10px' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Needs Improvement
          </span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: report.incompleteCount > 0 ? '#dc2626' : '#16a34a' }}>
            {report.incompleteCount}
          </div>
          <small style={{ color: 'var(--text-secondary)' }}>Records with missing data</small>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', paddingBottom: '1rem', borderBottom: '1px solid var(--border-main)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-secondary)' }}>
            <Filter size={14} /> Filter Severity:
          </span>
          <button
            type="button"
            className={`btn ${filterSeverity === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
            onClick={() => setFilterSeverity('all')}
          >
            All Findings ({report.findings.length})
          </button>
          <button
            type="button"
            className={`btn ${filterSeverity === 'critical' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
            onClick={() => setFilterSeverity('critical')}
          >
            Critical Only
          </button>
          <button
            type="button"
            className={`btn ${filterSeverity === 'high' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
            onClick={() => setFilterSeverity('high')}
          >
            High Severity
          </button>
        </div>

        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
          <input
            type="checkbox"
            checked={hideDismissed}
            onChange={(e) => setHideDismissed(e.target.checked)}
          />
          Hide dismissed advisories
        </label>
      </div>

      {/* Findings List */}
      <div style={{ marginTop: '1rem', display: 'grid', gap: '0.85rem' }}>
        {filteredFindings.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--bg-card, #f8fafc)', borderRadius: '10px' }}>
            <CheckCircle size={28} color="#16a34a" style={{ marginBottom: '0.5rem' }} />
            <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.05rem' }}>No Data Quality Issues Found</h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              All evaluated service records meet the required catalogue standards for this filter.
            </p>
          </div>
        ) : (
          filteredFindings.map((item) => {
            const isExpanded = expandedServiceId === item.serviceId;
            return (
              <div
                key={item.serviceId}
                style={{
                  border: '1px solid var(--border-main)',
                  borderRadius: '10px',
                  padding: '1rem 1.25rem',
                  backgroundColor: 'var(--bg-main, #ffffff)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '220px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <strong style={{ fontSize: '1rem' }}>{item.serviceName}</strong>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor:
                            item.completenessScore >= 80 ? 'rgba(22, 163, 74, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: item.completenessScore >= 80 ? '#16a34a' : '#dc2626'
                        }}
                      >
                        {item.completenessScore}% Complete
                      </span>
                    </div>
                    <small style={{ color: 'var(--text-tertiary)' }}>ID: {item.serviceId}</small>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {typeof onEditService === 'function' && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                        onClick={() => onEditService(item.serviceId)}
                      >
                        <ExternalLink size={13} /> Edit Record
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                      onClick={() => setExpandedServiceId(isExpanded ? null : item.serviceId)}
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      <span>{item.missingFields.length} Missing Field(s)</span>
                    </button>
                  </div>
                </div>

                {/* Expanded Field Details */}
                {isExpanded && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-main)', display: 'grid', gap: '0.75rem' }}>
                    {item.missingFields.map((field) => (
                      <div
                        key={field.field}
                        style={{
                          padding: '0.75rem 1rem',
                          borderRadius: '8px',
                          backgroundColor: 'var(--bg-card, #f8fafc)',
                          border: '1px solid var(--border-main)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: '1rem',
                          flexWrap: 'wrap'
                        }}
                      >
                        <div style={{ flex: 1, minWidth: '240px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor:
                                  field.severity === 'critical'
                                    ? '#fee2e2'
                                    : field.severity === 'high'
                                    ? '#fef3c7'
                                    : '#e0e7ff',
                                color:
                                  field.severity === 'critical'
                                    ? '#b91c1c'
                                    : field.severity === 'high'
                                    ? '#b45309'
                                    : '#3730a3'
                              }}
                            >
                              {field.severity}
                            </span>
                            <strong style={{ fontSize: '0.9rem' }}>{field.label}</strong>
                          </div>
                          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                            <strong>Impact on Citizen:</strong> {field.impactExplanation}
                          </p>
                        </div>

                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                          onClick={() => handleDismiss(item.serviceId, field.field)}
                          title="Dismiss advisory for this field"
                        >
                          <EyeOff size={13} /> Dismiss
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
