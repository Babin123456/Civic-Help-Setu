import { useState, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  EyeOff,
  RefreshCw,
  Search,
  Filter,
  ShieldCheck,
  Edit3,
  ExternalLink,
  Info,
  Scale,
  FileQuestion,
  Coins,
} from 'lucide-react';
import {
  detectCatalogueConflicts,
  dismissConflict,
  resetDismissedConflicts,
  getDismissedConflictIds,
  CONFLICT_TYPES,
} from '../../services/catalogueConflictDetectorService';

export default function CatalogueConflictDetectorPanel({
  services = [],
  onRefresh,
  onEditService,
}) {
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDismissed, setShowDismissed] = useState(false);
  const [dismissedIds, setDismissedIds] = useState(() => getDismissedConflictIds());
  const [actionNotice, setActionNotice] = useState(null);

  // Re-run scan with dismissed inclusion
  const allConflicts = useMemo(() => {
    return detectCatalogueConflicts(services, { includeDismissed: true });
  }, [services, dismissedIds]);

  // Derived stats
  const stats = useMemo(() => {
    const active = allConflicts.filter((c) => !dismissedIds.includes(c.id));
    const feeCount = active.filter((c) => c.type === CONFLICT_TYPES.FEE_CONTRADICTION).length;
    const docCount = active.filter((c) => c.type === CONFLICT_TYPES.DOCUMENT_CONTRADICTION).length;
    const eligCount = active.filter((c) => c.type === CONFLICT_TYPES.ELIGIBILITY_CONTRADICTION).length;
    const crossCount = active.filter((c) => c.type === CONFLICT_TYPES.CROSS_JURISDICTION_DISPARITY).length;

    return {
      totalScanned: services.length,
      activeCount: active.length,
      dismissedCount: allConflicts.filter((c) => dismissedIds.includes(c.id)).length,
      feeCount,
      docCount,
      eligCount,
      crossCount,
    };
  }, [allConflicts, services.length, dismissedIds]);

  // Filtered view
  const filteredConflicts = useMemo(() => {
    return allConflicts.filter((item) => {
      const isDismissed = dismissedIds.includes(item.id);
      if (!showDismissed && isDismissed) return false;
      if (showDismissed && !isDismissed) return false;

      if (typeFilter !== 'ALL' && item.type !== typeFilter) return false;
      if (severityFilter !== 'ALL' && item.severity !== severityFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.serviceTitle?.toLowerCase().includes(q);
        const matchesExplanation = item.explanation?.toLowerCase().includes(q);
        const matchesField = item.conflictingFields?.some((f) => f.toLowerCase().includes(q));
        if (!matchesTitle && !matchesExplanation && !matchesField) return false;
      }

      return true;
    });
  }, [allConflicts, dismissedIds, showDismissed, typeFilter, severityFilter, searchQuery]);

  const handleDismiss = (conflictId) => {
    dismissConflict(conflictId);
    const updated = getDismissedConflictIds();
    setDismissedIds(updated);
    setActionNotice('Inconsistency flagged as reviewed/dismissed.');
    setTimeout(() => setActionNotice(null), 3500);
  };

  const handleResetDismissals = () => {
    resetDismissedConflicts();
    setDismissedIds([]);
    setActionNotice('All dismissed conflict flags have been restored to the active queue.');
    setTimeout(() => setActionNotice(null), 3500);
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case CONFLICT_TYPES.FEE_CONTRADICTION:
        return {
          icon: <Coins className="w-3.5 h-3.5 text-amber-500" />,
          label: 'Fee Contradiction',
          bg: 'rgba(245, 158, 11, 0.1)',
          color: '#d97706',
        };
      case CONFLICT_TYPES.DOCUMENT_CONTRADICTION:
        return {
          icon: <FileQuestion className="w-3.5 h-3.5 text-red-500" />,
          label: 'Document Mismatch',
          bg: 'rgba(239, 68, 68, 0.1)',
          color: '#dc2626',
        };
      case CONFLICT_TYPES.ELIGIBILITY_CONTRADICTION:
        return {
          icon: <Scale className="w-3.5 h-3.5 text-purple-500" />,
          label: 'Eligibility Contradiction',
          bg: 'rgba(168, 85, 247, 0.1)',
          color: '#9333ea',
        };
      case CONFLICT_TYPES.CROSS_JURISDICTION_DISPARITY:
        return {
          icon: <AlertTriangle className="w-3.5 h-3.5 text-blue-500" />,
          label: 'Inter-State Disparity',
          bg: 'rgba(59, 130, 246, 0.1)',
          color: '#2563eb',
        };
      default:
        return {
          icon: <Info className="w-3.5 h-3.5 text-slate-500" />,
          label: 'Catalogue Conflict',
          bg: 'rgba(100, 116, 139, 0.1)',
          color: '#475569',
        };
    }
  };

  return (
    <div className="catalogue-conflict-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
            Catalogue Requirement Conflict Detector
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem', marginBottom: 0 }}>
            Automated internal consistency scanner identifying contradictory fee structures, document checklists, and cross-state statutory variations.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.85rem',
                borderRadius: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: '600',
                border: '1px solid var(--border-color)',
                background: 'var(--card-bg)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Re-scan Catalogue
            </button>
          )}

          {dismissedIds.length > 0 && (
            <button
              type="button"
              onClick={handleResetDismissals}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.85rem',
                borderRadius: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: '600',
                border: '1px solid var(--border-color)',
                background: 'var(--card-bg)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              Reset Dismissed ({dismissedIds.length})
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
          background: 'rgba(14, 165, 233, 0.08)',
          border: '1px solid rgba(14, 165, 233, 0.25)',
          color: '#0284c7',
          fontSize: '0.85rem',
        }}
      >
        <ShieldCheck className="w-5 h-5 flex-shrink-0" />
        <span>
          <strong>Admin Quality Assurance Guardrail:</strong> Detected contradictions are diagnostic findings only.
          No catalogue entries or official rules are ever auto-modified without explicit administrator review and saving.
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

      {/* Metrics Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
        }}
      >
        <div style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '0.65rem', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Scanned Records
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', marginTop: '0.35rem', color: 'var(--text-primary)' }}>
            {stats.totalScanned}
          </div>
        </div>

        <div style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '0.65rem', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Active Contradictions
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', marginTop: '0.35rem', color: stats.activeCount > 0 ? '#ef4444' : '#10b981' }}>
            {stats.activeCount}
          </div>
        </div>

        <div style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '0.65rem', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Fee Inconsistencies
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', marginTop: '0.35rem', color: '#d97706' }}>
            {stats.feeCount}
          </div>
        </div>

        <div style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '0.65rem', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Document Mismatches
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', marginTop: '0.35rem', color: '#dc2626' }}>
            {stats.docCount}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
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
            placeholder="Search by service title or conflict keywords..."
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
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filter by conflict category"
            style={{
              padding: '0.45rem 0.65rem',
              borderRadius: '0.4rem',
              border: '1px solid var(--border-color)',
              background: 'var(--card-bg)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
            }}
          >
            <option value="ALL">All Categories</option>
            <option value={CONFLICT_TYPES.FEE_CONTRADICTION}>Fee Inconsistency</option>
            <option value={CONFLICT_TYPES.DOCUMENT_CONTRADICTION}>Document Contradiction</option>
            <option value={CONFLICT_TYPES.ELIGIBILITY_CONTRADICTION}>Eligibility Restriction</option>
            <option value={CONFLICT_TYPES.CROSS_JURISDICTION_DISPARITY}>Cross-State Disparity</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            aria-label="Filter by severity level"
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
            <option value="HIGH">High Severity</option>
            <option value="MEDIUM">Medium Severity</option>
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
            {showDismissed ? 'Viewing Dismissed' : `Dismissed (${stats.dismissedCount})`}
          </button>
        </div>
      </div>

      {/* Findings List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {filteredConflicts.length === 0 ? (
          <div
            style={{
              padding: '3rem 1.5rem',
              textAlign: 'center',
              background: 'var(--card-bg)',
              borderRadius: '0.65rem',
              border: '1px dashed var(--border-color)',
            }}
          >
            <CheckCircle className="w-10 h-10 text-emerald-500" style={{ margin: '0 auto 0.75rem' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
              {showDismissed ? 'No Dismissed Inconsistencies' : 'No Catalogue Conflicts Detected'}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.35rem', maxWidth: '460px', margin: '0.35rem auto 0' }}>
              {showDismissed
                ? 'There are currently no dismissed conflicts in the audit log.'
                : 'All scanned services exhibit verified consistency across fees, required documents, and eligibility rules.'}
            </p>
          </div>
        ) : (
          filteredConflicts.map((conflict) => {
            const badge = getTypeBadge(conflict.type);
            const isDismissed = dismissedIds.includes(conflict.id);

            return (
              <div
                key={conflict.id}
                style={{
                  background: 'var(--card-bg)',
                  borderRadius: '0.65rem',
                  border: '1px solid var(--border-color)',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                }}
              >
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '0.35rem',
                        background: badge.bg,
                        color: badge.color,
                      }}
                    >
                      {badge.icon}
                      {badge.label}
                    </span>

                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '0.35rem',
                        background: conflict.severity === 'HIGH' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                        color: conflict.severity === 'HIGH' ? '#ef4444' : '#d97706',
                      }}
                    >
                      {conflict.severity} SEVERITY
                    </span>

                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Confidence: {conflict.confidence > 1 ? Math.round(conflict.confidence) : Math.round(conflict.confidence * 100)}%
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {onEditService && conflict.serviceId && (
                      <button
                        type="button"
                        onClick={() => onEditService(conflict.serviceId)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
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
                        <Edit3 className="w-3.5 h-3.5" />
                        Edit Record
                      </button>
                    )}

                    {!isDismissed ? (
                      <button
                        type="button"
                        onClick={() => handleDismiss(conflict.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
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
                        <EyeOff className="w-3.5 h-3.5" />
                        Dismiss
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', alignSelf: 'center' }}>
                        Dismissed
                      </span>
                    )}
                  </div>
                </div>

                {/* Service Reference */}
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                    {conflict.serviceTitle || conflict.serviceName}
                  </h4>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                    Record ID: <code style={{ fontSize: '0.75rem' }}>{conflict.serviceId}</code>
                    {conflict.competingServices && (
                      <span> | Compared against {conflict.competingServices.length} state-equivalent records</span>
                    )}
                  </div>
                </div>

                {/* Explanation */}
                <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
                  {conflict.explanation}
                </p>

                {/* Side-by-side Conflicting Values */}
                {(conflict.fieldA || conflict.valueA) && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                      gap: '0.75rem',
                      background: 'rgba(0, 0, 0, 0.02)',
                      padding: '0.75rem',
                      borderRadius: '0.45rem',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                        {typeof conflict.fieldA === 'object' ? conflict.fieldA.label : conflict.fieldA || 'Field A'}
                      </div>
                      <div style={{ fontSize: '0.825rem', color: 'var(--text-primary)', marginTop: '0.2rem', fontFamily: 'monospace' }}>
                        {typeof conflict.fieldA === 'object' ? conflict.fieldA.value : conflict.valueA}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                        {typeof conflict.fieldB === 'object' ? conflict.fieldB.label : conflict.fieldB || 'Field B'}
                      </div>
                      <div style={{ fontSize: '0.825rem', color: 'var(--text-primary)', marginTop: '0.2rem', fontFamily: 'monospace' }}>
                        {typeof conflict.fieldB === 'object' ? conflict.fieldB.value : conflict.valueB}
                      </div>
                    </div>
                  </div>
                )}

                {/* Recommendation */}
                {conflict.recommendation && (
                  <div
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                      background: 'rgba(245, 158, 11, 0.05)',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.4rem',
                      borderLeft: '3px solid #f59e0b',
                    }}
                  >
                    <strong>Recommended Action:</strong> {conflict.recommendation}
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
