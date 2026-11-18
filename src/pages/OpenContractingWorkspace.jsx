import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldAlert,
  RefreshCw,
  Download,
  Layers,
  ShieldCheck,
  Building,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useNetwork } from '../context/NetworkContext';
import { openContractingService } from '../services/openContractingService.js';
import ProcurementSummaryKpis from '../components/openContracting/ProcurementSummaryKpis.jsx';
import ProcurementFilterBar from '../components/openContracting/ProcurementFilterBar.jsx';
import RedFlagEvidenceCard from '../components/openContracting/RedFlagEvidenceCard.jsx';
import ProcurementLifecycleDrawer from '../components/openContracting/ProcurementLifecycleDrawer.jsx';
import AuditorReviewModal from '../components/openContracting/AuditorReviewModal.jsx';
import AccessibleCohortTable from '../components/openContracting/AccessibleCohortTable.jsx';
import {
  ProcurementLoadingSkeleton,
  ProcurementEmptyState,
  ProcurementStaleDataNotice,
  ProcurementOfflineNotice,
  ProcurementErrorState,
} from '../components/openContracting/ResilienceStates.jsx';

export default function OpenContractingWorkspace() {
  const { toast } = useToast();
  const { isOnline } = useNetwork();

  // State
  const [activeTab, setActiveTab] = useState('flags'); // 'flags' | 'notices' | 'vendors' | 'audit_log'
  const [userRole, setUserRole] = useState('auditor'); // 'citizen' | 'analyst' | 'auditor' | 'admin'
  const [search, setSearch] = useState('');
  const [jurisdiction, setJurisdiction] = useState('all');
  const [category, setCategory] = useState('all');
  const [severity, setSeverity] = useState('all');
  const [status, setStatus] = useState('all');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(() => new Date().toISOString());
  const [isStale, setIsStale] = useState(false);

  // Data cache initialized synchronously for SSR & initial hydration
  const [analysisData, setAnalysisData] = useState(() => {
    try {
      return openContractingService.runAnalytics();
    } catch {
      return null;
    }
  });
  const [noticesData, setNoticesData] = useState(() => {
    try {
      return openContractingService.listNotices().notices;
    } catch {
      return [];
    }
  });
  const [auditLogs, setAuditLogs] = useState(() => {
    try {
      return openContractingService.getAuditLogs();
    } catch {
      return [];
    }
  });

  // Modal drawers
  const [selectedNoticeId, setSelectedNoticeId] = useState(null);
  const [activeReviewFlag, setActiveReviewFlag] = useState(null);

  // Re-run ruleset handler
  const handleRerunRuleset = useCallback(() => {
    setIsLoading(true);
    setError(null);
    try {
      const noticesResult = openContractingService.listNotices();
      const analysis = openContractingService.runAnalytics();
      const logs = openContractingService.getAuditLogs();

      setNoticesData(noticesResult.notices);
      setAnalysisData(analysis);
      setAuditLogs(logs);
      setLastUpdated(new Date().toISOString());
      setIsStale(false);
      toast?.success?.('Analytics ruleset re-executed across all published notices.');
    } catch (err) {
      setError(err);
      toast?.error?.('Failed to re-execute analytics.');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Sync offline queue if connection recovers
  useEffect(() => {
    if (!isOnline) return;
    const timer = setTimeout(() => {
      const syncResult = openContractingService.syncOfflineQueue();
      if (syncResult.syncedCount > 0) {
        toast?.success?.(`Synced ${syncResult.syncedCount} queued audit review(s).`);
        handleRerunRuleset();
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [isOnline, handleRerunRuleset, toast]);

  // Filtered Flags
  const filteredFlags = useMemo(() => {
    if (!analysisData?.redFlags) return [];
    return analysisData.redFlags.filter((flag) => {
      if (category !== 'all' && flag.category && flag.category !== category) return false;
      if (jurisdiction !== 'all' && flag.jurisdiction && flag.jurisdiction !== jurisdiction) return false;
      if (severity !== 'all' && flag.severity !== severity) return false;
      if (status !== 'all' && flag.status !== status) return false;
      if (search && search.trim()) {
        const q = search.toLowerCase();
        const matchesTitle = flag.title?.toLowerCase().includes(q);
        const matchesRef = flag.tenderRefNumber?.toLowerCase().includes(q);
        const matchesExplanation = flag.explanation?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesRef && !matchesExplanation) return false;
      }
      return true;
    });
  }, [analysisData, category, jurisdiction, severity, status, search]);

  // Active Lifecycle Drawer Data
  const activeLifecycle = useMemo(() => {
    if (!selectedNoticeId) return null;
    return openContractingService.getLinkedProcurementLifecycle(selectedNoticeId, userRole);
  }, [selectedNoticeId, userRole]);

  // Submit Review Handler
  const handleReviewSubmit = async (payload) => {
    try {
      const result = openContractingService.submitAuditReview({
        ...payload,
        reviewerRole: userRole,
        isOffline: !isOnline,
      });
      toast?.success?.(result.message || 'Audit review successfully recorded.');
      handleRerunRuleset();
    } catch (err) {
      toast?.error?.(err.message || 'Failed to record audit review.');
      throw err;
    }
  };

  // Export Dossier
  const handleExportDossier = () => {
    try {
      const dossier = openContractingService.exportAuditDossier({
        jurisdiction,
        userRole,
      });
      const blob = new Blob([JSON.stringify(dossier, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `open-contracting-dossier-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast?.success?.('Procurement audit dossier exported successfully.');
    } catch {
      toast?.error?.('Failed to generate export dossier.');
    }
  };

  const handleResetFilters = () => {
    setSearch('');
    setJurisdiction('all');
    setCategory('all');
    setSeverity('all');
    setStatus('all');
  };

  return (
    <div className="open-contracting-workspace container" style={{ padding: '2rem 1rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Page Header */}
      <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <ShieldAlert size={28} color="var(--accent-main, #38bdf8)" aria-hidden="true" />
            <h1 style={{ fontSize: '1.65rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Open Contracting Red-Flag Analytics
            </h1>
          </div>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '750px' }}>
            Explainable oversight and anomaly detection for public procurement records. Review patterns across notices, bids, awards, and amendments without declaring wrongdoing.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleRerunRuleset}
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <RefreshCw size={14} aria-hidden="true" />
            Rerun Ruleset
          </button>
          <button
            type="button"
            onClick={handleExportDossier}
            className="btn btn-primary"
            style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Download size={14} aria-hidden="true" />
            Export Dossier
          </button>
        </div>
      </header>

      {/* Resilience Banners */}
      {!isOnline && <ProcurementOfflineNotice />}
      {isStale && <ProcurementStaleDataNotice onRefresh={handleRerunRuleset} lastUpdated={lastUpdated} />}
      {error && <ProcurementErrorState error={error} onRetry={handleRerunRuleset} />}

      {/* Summary KPI Cards */}
      <ProcurementSummaryKpis analysis={analysisData} noticesCount={noticesData.length} />

      {/* Filter and Scoping Bar */}
      <ProcurementFilterBar
        search={search}
        onSearchChange={setSearch}
        jurisdiction={jurisdiction}
        onJurisdictionChange={setJurisdiction}
        category={category}
        onCategoryChange={setCategory}
        severity={severity}
        onSeverityChange={setSeverity}
        status={status}
        onStatusChange={setStatus}
        userRole={userRole}
        onRoleChange={setUserRole}
        onResetFilters={handleResetFilters}
      />

      {/* Tab Navigation */}
      <nav
        aria-label="Workspace Sections"
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '2px solid rgba(255, 255, 255, 0.1)',
          marginBottom: '1.5rem',
          overflowX: 'auto',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('flags')}
          style={{
            padding: '0.65rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'flags' ? '3px solid #38bdf8' : '3px solid transparent',
            color: activeTab === 'flags' ? '#38bdf8' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            whiteSpace: 'nowrap',
          }}
        >
          <ShieldAlert size={16} aria-hidden="true" />
          Flagged Anomalies ({filteredFlags.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('notices')}
          style={{
            padding: '0.65rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'notices' ? '3px solid #38bdf8' : '3px solid transparent',
            color: activeTab === 'notices' ? '#38bdf8' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            whiteSpace: 'nowrap',
          }}
        >
          <Layers size={16} aria-hidden="true" />
          Procurement Notices ({noticesData.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('vendors')}
          style={{
            padding: '0.65rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'vendors' ? '3px solid #38bdf8' : '3px solid transparent',
            color: activeTab === 'vendors' ? '#38bdf8' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            whiteSpace: 'nowrap',
          }}
        >
          <Building size={16} aria-hidden="true" />
          Vendor Concentration Risk
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audit_log')}
          style={{
            padding: '0.65rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'audit_log' ? '3px solid #38bdf8' : '3px solid transparent',
            color: activeTab === 'audit_log' ? '#38bdf8' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            whiteSpace: 'nowrap',
          }}
        >
          <ShieldCheck size={16} aria-hidden="true" />
          Sealed Audit Trail ({auditLogs.length})
        </button>
      </nav>

      {/* Main Tab Content */}
      <main>
        {isLoading ? (
          <ProcurementLoadingSkeleton />
        ) : activeTab === 'flags' ? (
          <div>
            {filteredFlags.length === 0 ? (
              <ProcurementEmptyState onReset={handleResetFilters} />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                {filteredFlags.map((flag) => (
                  <RedFlagEvidenceCard
                    key={flag.id}
                    flag={flag}
                    userRole={userRole}
                    onInspectLifecycle={(noticeId) => setSelectedNoticeId(noticeId)}
                    onReviewClick={(f) => setActiveReviewFlag(f)}
                  />
                ))}
              </div>
            )}
            {/* Accessible Cohort Matrix Table */}
            <AccessibleCohortTable notices={noticesData} flags={analysisData?.redFlags || []} />
          </div>
        ) : activeTab === 'notices' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            {noticesData.map((notice) => (
              <article
                key={notice.id}
                tabIndex="0"
                className="card notice-card"
                style={{
                  padding: '1.25rem',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
                  background: 'var(--bg-card, #1e293b)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                    {notice.category} • {notice.procurementMethod?.replace('_', ' ')}
                  </div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
                    {notice.title}
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    Ref: <strong>{notice.tenderRefNumber}</strong> • {notice.jurisdiction}
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc', marginBottom: '0.75rem' }}>
                    Est. Value: ₹{Number(notice.estimatedValue).toLocaleString('en-IN')}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Deadline: {notice.submissionDeadline?.slice(0, 10)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedNoticeId(notice.id)}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                  >
                    View Lifecycle
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : activeTab === 'vendors' ? (
          <div
            className="card vendor-card"
            style={{
              padding: '1.25rem',
              borderRadius: '0.75rem',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
              background: 'var(--bg-card, #1e293b)',
            }}
          >
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}>
              Vendor Participation &amp; Market Concentration
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Auditing contract share to detect potential empanelment monopolies or disproportionate award concentrations.
            </p>
            <AccessibleCohortTable notices={noticesData} flags={analysisData?.redFlags || []} />
          </div>
        ) : (
          <div
            className="card audit-card"
            style={{
              padding: '1.25rem',
              borderRadius: '0.75rem',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
              background: 'var(--bg-card, #1e293b)',
            }}
          >
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}>
              Append-Only Sealed Audit Trail
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              All reviews, overrides, and false-positive declarations are permanently hashed with cryptographic audit seals.
            </p>
            {auditLogs.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No audit events recorded yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      padding: '0.75rem',
                      borderRadius: '0.375rem',
                      fontSize: '0.8rem',
                      borderLeft: '3px solid #38bdf8',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <strong>{log.action}</strong>
                      <span style={{ color: 'var(--text-muted)' }}>{log.timestamp?.slice(0, 19).replace('T', ' ')}</span>
                    </div>
                    {log.auditSeal && (
                      <div style={{ marginTop: '0.2rem' }}>
                        Seal: <code style={{ color: '#38bdf8', fontWeight: 600 }}>{log.auditSeal}</code>
                      </div>
                    )}
                    {log.disposition && (
                      <div style={{ marginTop: '0.2rem', color: 'var(--text-muted)' }}>
                        Status: <strong>{log.disposition}</strong> • Reviewer: {userRole === 'citizen' ? 'Certified Auditor' : log.reviewerId}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Lifecycle Modal Drawer */}
      {selectedNoticeId && (
        <ProcurementLifecycleDrawer
          lifecycle={activeLifecycle}
          userRole={userRole}
          onClose={() => setSelectedNoticeId(null)}
          onReviewFlag={(f) => {
            setSelectedNoticeId(null);
            setActiveReviewFlag(f);
          }}
        />
      )}

      {/* Auditor Review Modal */}
      {activeReviewFlag && (
        <AuditorReviewModal
          flag={activeReviewFlag}
          userRole={userRole}
          onClose={() => setActiveReviewFlag(null)}
          onSubmitReview={handleReviewSubmit}
        />
      )}
    </div>
  );
}
