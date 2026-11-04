import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Search,
  Filter,
  Download,
  EyeOff,
  RotateCcw,
  Sparkles,
  Edit3,
  HelpCircle,
  Clock,
  Layers,
} from 'lucide-react';
import {
  runCatalogueCompletenessAudit,
  dismissAuditorFinding,
  resetAuditorDismissals,
  getAuditorDismissedIds,
  exportAuditFindings,
} from '../../services/catalogueCompletenessAuditorService';

export default function CatalogueCompletenessAuditorPanel({
  services = [],
  onRefresh,
  onEditService,
}) {
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDismissed, setShowDismissed] = useState(false);
  const [dismissedIds, setDismissedIds] = useState(() => getAuditorDismissedIds());
  const [actionNotice, setActionNotice] = useState(null);

  // Full scan report
  const auditReport = useMemo(() => {
    return runCatalogueCompletenessAudit(services, { includeDismissed: true });
  }, [services, dismissedIds]);

  // Filtered findings view
  const visibleFindings = useMemo(() => {
    return auditReport.activeFindings.filter((item) => {
      const isDismissed = dismissedIds.includes(item.id);
      if (!showDismissed && isDismissed) return false;
      if (showDismissed && !isDismissed) return false;

      if (severityFilter !== 'ALL' && item.severity !== severityFilter) return false;
      if (typeFilter !== 'ALL' && item.type !== typeFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.serviceTitle?.toLowerCase().includes(q);
        const matchesField = item.fieldLabel?.toLowerCase().includes(q);
        const matchesImpact = item.impactExplanation?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesField && !matchesImpact) return false;
      }

      return true;
    });
  }, [auditReport, dismissedIds, showDismissed, severityFilter, typeFilter, searchQuery]);

  const handleDismiss = (id) => {
    dismissAuditorFinding(id);
    const updated = getAuditorDismissedIds();
    setDismissedIds(updated);
    setActionNotice('Quality finding dismissed from active review queue.');
    setTimeout(() => setActionNotice(null), 3000);
  };

  const handleResetDismissals = () => {
    resetAuditorDismissals();
    setDismissedIds([]);
    setActionNotice('All dismissed findings have been restored to active queue.');
    setTimeout(() => setActionNotice(null), 3000);
  };

  const handleExport = (format) => {
    const data = exportAuditFindings(visibleFindings, format);
    const blob = new Blob([data], { type: format === 'csv' ? 'text/csv' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `catalogue-completeness-audit-${Date.now()}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="catalogue-completeness-auditor" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
            AI-Assisted Catalogue Completeness Auditor
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem', marginBottom: 0 }}>
            Deep audit inspecting records for missing descriptions, audience tags, checklist documents, and ambiguous terminology.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => handleExport('csv')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.5rem 0.85rem',
              borderRadius: '0.45rem',
              border: '1px solid var(--border-color)',
              background: 'var(--card-bg)',
              color: 'var(--text-primary)',
              fontSize: '0.825rem',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>

          {dismissedIds.length > 0 && (
            <button
              type="button"
              onClick={handleResetDismissals}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.5rem 0.85rem',
                borderRadius: '0.45rem',
                border: '1px solid var(--border-color)',
                background: 'var(--card-bg)',
                color: 'var(--text-secondary)',
                fontSize: '0.825rem',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Dismissed ({dismissedIds.length})
            </button>
          )}
        </div>
      </div>

      {/* Safety Notice */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.85rem 1rem',
          borderRadius: '0.55rem',
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          color: '#2563eb',
          fontSize: '0.85rem',
        }}
      >
        <Sparkles className="w-5 h-5 flex-shrink-0" />
        <span>
          <strong>AI Assistance Guardrail:</strong> Recommendations are advisory diagnostics for administrator review.
          No catalogue entries or official requirements are published or invented automatically.
        </span>
      </div>

      {/* Feedback Toast */}
      {actionNotice && (
        <div
          style={{
            padding: '0.65rem 1rem',
            borderRadius: '0.5rem',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#059669',
            fontSize: '0.85rem',
            fontWeight: '600',
          }}
        >
          {actionNotice}
        </div>
      )}

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        <div style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '0.65rem', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Scanned Records
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', marginTop: '0.35rem', color: 'var(--text-primary)' }}>
            {auditReport.totalScanned}
          </div>
        </div>

        <div style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '0.65rem', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Active Quality Defects
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', marginTop: '0.35rem', color: auditReport.activeCount > 0 ? '#ef4444' : '#10b981' }}>
            {auditReport.activeCount}
          </div>
        </div>

        <div style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '0.65rem', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Critical Omissions
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', marginTop: '0.35rem', color: '#dc2626' }}>
            {auditReport.severityBreakdown.CRITICAL}
          </div>
        </div>

        <div style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '0.65rem', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Dismissed Findings
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', marginTop: '0.35rem', color: 'var(--text-secondary)' }}>
            {auditReport.dismissedCount}
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--card-bg)',
          padding: '0.85rem 1rem',
          borderRadius: '0.65rem',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 240px' }}>
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by service name, field, or impact description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.45rem 0.65rem',
              borderRadius: '0.4rem',
              border: '1px solid var(--border-color)',
              background: 'transparent',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            style={{
              padding: '0.45rem 0.65rem',
              borderRadius: '0.4rem',
              border: '1px solid var(--border-color)',
              background: 'var(--card-bg)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
            }}
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{
              padding: '0.45rem 0.65rem',
              borderRadius: '0.4rem',
              border: '1px solid var(--border-color)',
              background: 'var(--card-bg)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
            }}
          >
            <option value="ALL">All Issue Types</option>
            <option value="MISSING_FIELD">Missing Required Field</option>
            <option value="VAGUE_LANGUAGE">Vague Phrasing</option>
          </select>

          <button
            type="button"
            onClick={() => setShowDismissed(!showDismissed)}
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: '0.4rem',
              fontSize: '0.85rem',
              fontWeight: '600',
              border: '1px solid var(--border-color)',
              background: showDismissed ? 'var(--accent-main)' : 'transparent',
              color: showDismissed ? '#ffffff' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            {showDismissed ? 'Viewing Dismissed' : `Dismissed (${auditReport.dismissedCount})`}
          </button>
        </div>
      </div>

      {/* Findings List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {visibleFindings.length === 0 ? (
          <div
            style={{
              padding: '3rem 1.5rem',
              textAlign: 'center',
              background: 'var(--card-bg)',
              borderRadius: '0.65rem',
              border: '1px dashed var(--border-color)',
            }}
          >
            <CheckCircle2 className="w-10 h-10 text-emerald-500" style={{ margin: '0 auto 0.75rem' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
              {showDismissed ? 'No Dismissed Audit Findings' : 'All Scanned Records Meet Quality Thresholds'}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.35rem', maxWidth: '440px', margin: '0.35rem auto 0' }}>
              {showDismissed
                ? 'There are no dismissed findings currently recorded in local storage.'
                : 'Every catalogue record possesses complete descriptions, target audiences, checklist documents, and clear non-vague guidance.'}
            </p>
          </div>
        ) : (
          visibleFindings.map((finding) => {
            const isDismissed = dismissedIds.includes(finding.id);

            return (
              <div
                key={finding.id}
                style={{
                  background: 'var(--card-bg)',
                  borderRadius: '0.65rem',
                  border: '1px solid var(--border-color)',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '0.35rem',
                        background:
                          finding.severity === 'CRITICAL'
                            ? 'rgba(239, 68, 68, 0.12)'
                            : finding.severity === 'HIGH'
                              ? 'rgba(245, 158, 11, 0.12)'
                              : 'rgba(59, 130, 246, 0.12)',
                        color:
                          finding.severity === 'CRITICAL'
                            ? '#ef4444'
                            : finding.severity === 'HIGH'
                              ? '#d97706'
                              : '#2563eb',
                      }}
                    >
                      {finding.severity}
                    </span>

                    <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                      Deficiency: {finding.fieldLabel}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {onEditService && finding.serviceId && (
                      <button
                        type="button"
                        onClick={() => onEditService(finding.serviceId)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.35rem 0.65rem',
                          borderRadius: '0.4rem',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          border: '1px solid var(--border-color)',
                          background: 'transparent',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                        }}
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Edit Record
                      </button>
                    )}

                    {!isDismissed ? (
                      <button
                        type="button"
                        onClick={() => handleDismiss(finding.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.35rem 0.65rem',
                          borderRadius: '0.4rem',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          border: '1px solid var(--border-color)',
                          background: 'transparent',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                        }}
                      >
                        <EyeOff className="w-3.5 h-3.5" /> Dismiss
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', alignSelf: 'center' }}>
                        Dismissed
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                    {finding.serviceTitle}
                  </h4>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                    Service Record ID: <code>{finding.serviceId}</code>
                  </div>
                </div>

                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <strong>Impact on Citizen Journey:</strong> {finding.impactExplanation}
                </div>

                {finding.suggestedFix && (
                  <div
                    style={{
                      fontSize: '0.825rem',
                      color: 'var(--text-primary)',
                      background: 'rgba(59, 130, 246, 0.05)',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.4rem',
                      borderLeft: '3px solid #3b82f6',
                    }}
                  >
                    <strong>Recommended Fix:</strong> {finding.suggestedFix}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
