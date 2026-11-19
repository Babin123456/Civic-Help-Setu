/**
 * src/pages/WardIssueHeatmapWorkspace.jsx
 * Dedicated workspace for Anonymized Ward-Level Civic Issue Heatmap & Trend Explorer (#763).
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  PlusCircle,
  Download,
  RefreshCw,
  Database,
} from 'lucide-react';
import { wardIssueHeatmapService } from '../services/wardIssueHeatmapService.js';
import {
  TIME_WINDOWS,
  MUNICIPAL_WARDS,
} from '../data/wardIssueHeatmapContract.js';
import WardHeatmapFilters from '../components/wardHeatmap/WardHeatmapFilters.jsx';
import WardHeatmapGrid from '../components/wardHeatmap/WardHeatmapGrid.jsx';
import TrendComparisonExplorer from '../components/wardHeatmap/TrendComparisonExplorer.jsx';
import PrivacyTransparencyPanel from '../components/wardHeatmap/PrivacyTransparencyPanel.jsx';
import InterventionRecommendationsModal from '../components/wardHeatmap/InterventionRecommendationsModal.jsx';
import CivicIssueReportModal from '../components/wardHeatmap/CivicIssueReportModal.jsx';
import {
  WardHeatmapSkeleton,
  WardHeatmapEmptyState,
  WardHeatmapOfflineBanner,
  WardHeatmapStaleDataNotice,
  WardHeatmapErrorCard,
} from '../components/wardHeatmap/WardHeatmapStates.jsx';

export default function WardIssueHeatmapWorkspace() {
  // State management
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(() => Date.now());

  // Filter state
  const [timeWindow, setTimeWindow] = useState(TIME_WINDOWS.LAST_30_DAYS);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedZone, setSelectedZone] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [userRole, setUserRole] = useState('public');

  // Selected Wards for Trend comparison
  const [selectedWardId, setSelectedWardId] = useState('ward-101');
  const [compareWardId, setCompareWardId] = useState('ward-150');

  // Core Data initialized synchronously
  const [privacyRules, setPrivacyRules] = useState(() => {
    try {
      wardIssueHeatmapService.ensureInitialized();
      return wardIssueHeatmapService.getPrivacyRules();
    } catch {
      return null;
    }
  });

  const [heatmapData, setHeatmapData] = useState(() => {
    try {
      wardIssueHeatmapService.ensureInitialized();
      return wardIssueHeatmapService.getHeatmapData({
        timeWindow: TIME_WINDOWS.LAST_30_DAYS,
        category: null,
      });
    } catch {
      return { metrics: [], meta: {} };
    }
  });

  const [recommendations, setRecommendations] = useState(() => {
    try {
      return wardIssueHeatmapService.getRecommendations();
    } catch {
      return [];
    }
  });

  const [trendData, setTrendData] = useState(() => {
    try {
      return wardIssueHeatmapService.getTrendExplorerData({
        wardId: 'ward-101',
        compareWithWardId: 'ward-150',
        timeWindow: TIME_WINDOWS.LAST_30_DAYS,
      });
    } catch {
      return null;
    }
  });

  // Modals & Drawers
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [adminEventInspectorOpen, setAdminEventInspectorOpen] = useState(false);
  const [authorizedEvents, setAuthorizedEvents] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  // Network listeners
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Actor context object based on simulated userRole
  const actorContext = useMemo(
    () => ({
      id: userRole === 'admin' ? 'adm-chief' : userRole === 'operator' ? 'op-engineer' : 'citizen-public',
      role: userRole,
      username:
        userRole === 'admin'
          ? 'Chief Municipal Commissioner'
          : userRole === 'operator'
          ? 'Assistant Executive Engineer'
          : 'Public Citizen',
    }),
    [userRole]
  );

  // Load / Refresh data
  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    try {
      wardIssueHeatmapService.ensureInitialized();
      const rules = wardIssueHeatmapService.getPrivacyRules();
      setPrivacyRules(rules);

      const heatmap = wardIssueHeatmapService.getHeatmapData({
        timeWindow,
        category: selectedCategory || null,
        actor: actorContext,
      });
      setHeatmapData(heatmap);

      const recs = wardIssueHeatmapService.getRecommendations({
        wardId: selectedWardId || null,
        category: selectedCategory || null,
      });
      setRecommendations(recs);

      const trends = wardIssueHeatmapService.getTrendExplorerData({
        wardId: selectedWardId,
        compareWithWardId: compareWardId,
        category: selectedCategory || null,
        timeWindow,
      });
      setTrendData(trends);

      if (userRole === 'admin') {
        const events = wardIssueHeatmapService.getAuthorizedEvents({}, actorContext);
        setAuthorizedEvents(events);
        const logs = wardIssueHeatmapService.getAuditLogs(actorContext);
        setAuditLogs(logs);
      } else {
        setAuthorizedEvents([]);
        setAuditLogs([]);
      }

      setLastRefreshedAt(Date.now());
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [timeWindow, selectedCategory, selectedWardId, compareWardId, actorContext, userRole]);

  const isMountedRef = useRef(false);
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    loadData();
  }, [loadData]);

  // Derived filtered metrics
  const filteredMetrics = useMemo(() => {
    if (!heatmapData || !heatmapData.metrics) return [];
    return heatmapData.metrics.filter((m) => {
      if (selectedZone && m.zone !== selectedZone) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = m.wardName.toLowerCase().includes(q);
        const matchId = m.wardId.toLowerCase().includes(q);
        if (!matchName && !matchId) return false;
      }
      return true;
    });
  }, [heatmapData, selectedZone, searchQuery]);

  // Zones list
  const availableZones = useMemo(() => {
    const set = new Set(MUNICIPAL_WARDS.map((w) => w.zone));
    return Array.from(set);
  }, []);

  // Handlers
  const handleIngestReport = (payload) => {
    const result = wardIssueHeatmapService.ingestCivicIssueEvent(payload, actorContext);
    loadData();
    return result;
  };

  const handleReviewRecommendation = (recId, reviewPayload) => {
    wardIssueHeatmapService.reviewRecommendation(recId, reviewPayload, actorContext);
    loadData();
  };

  const handleTriggerAggregationRun = () => {
    try {
      wardIssueHeatmapService.executeAggregationRun({ timeWindow }, actorContext);
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to trigger aggregation run.');
    }
  };

  const handleExportCsv = () => {
    const csv = wardIssueHeatmapService.exportAnonymizedMetrics('csv', {
      timeWindow,
      category: selectedCategory || null,
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ward-civic-issues-${timeWindow}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="section animate-fade-in" style={{ paddingBottom: '6rem' }}>
      <div className="container" style={{ maxWidth: '1240px' }}>
        {/* Offline Banner */}
        {isOffline && (
          <WardHeatmapOfflineBanner
            lastSyncedAt={lastRefreshedAt}
            onRetry={() => {
              setIsOffline(!navigator.onLine);
              loadData();
            }}
          />
        )}

        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '1.25rem',
            marginBottom: '1.5rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '99px',
                  background: 'var(--accent-light, #bae6fd)',
                  color: 'var(--accent-main, #0284c7)',
                }}
              >
                Municipal Aggregate Analytics
              </span>
            </div>

            <h1
              style={{
                fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
                fontWeight: 800,
                lineHeight: 1.2,
                marginBottom: '0.5rem',
              }}
            >
              Anonymized Ward-Level Civic Issue Heatmap &amp; Trend Explorer
            </h1>

            <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', maxWidth: '780px', margin: 0, lineHeight: 1.6 }}>
              Explore recurring urban civic issues, compare ward reporting velocities, and inspect explainable intervention recommendations without exposing individual complainant identities or precise residential GPS coordinates.
            </p>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setIsReportModalOpen(true)}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
            >
              <PlusCircle size={16} />
              <span>Report Civic Issue</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
              aria-label="Export published metrics to CSV"
            >
              <Download size={15} />
              <span>Export CSV</span>
            </button>

            {userRole === 'admin' && (
              <button
                type="button"
                onClick={handleTriggerAggregationRun}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', borderColor: '#f59e0b', color: '#f59e0b' }}
                aria-label="Trigger manual aggregation run"
              >
                <RefreshCw size={14} />
                <span>Trigger Aggregation</span>
              </button>
            )}
          </div>
        </div>

        {/* Stale data notice */}
        <WardHeatmapStaleDataNotice lastAggregatedAt={lastRefreshedAt} onRefresh={loadData} />

        {/* Privacy Transparency Architecture */}
        <PrivacyTransparencyPanel privacyRules={privacyRules} meta={heatmapData?.meta} />

        {/* Filter controls */}
        <WardHeatmapFilters
          timeWindow={timeWindow}
          onTimeWindowChange={setTimeWindow}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          selectedZone={selectedZone}
          onZoneChange={setSelectedZone}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          zones={availableZones}
          userRole={userRole}
          onRoleChange={setUserRole}
        />

        {/* Domain View Containers */}
        {loading ? (
          <WardHeatmapSkeleton />
        ) : error ? (
          <WardHeatmapErrorCard error={error} onRetry={loadData} />
        ) : filteredMetrics.length === 0 && viewMode !== 'recommendations' ? (
          <WardHeatmapEmptyState
            onResetFilters={() => {
              setSelectedCategory('');
              setSelectedZone('');
              setSearchQuery('');
            }}
          />
        ) : (
          <>
            {/* View Mode: Recommendations */}
            {viewMode === 'recommendations' && (
              <InterventionRecommendationsModal
                recommendations={recommendations}
                userRole={userRole}
                onReviewRecommendation={handleReviewRecommendation}
              />
            )}

            {/* View Mode: Trend Comparator */}
            {viewMode === 'trends' && (
              <TrendComparisonExplorer
                trendData={trendData}
                primaryWardId={selectedWardId}
                compareWardId={compareWardId}
                onPrimaryWardChange={setSelectedWardId}
                onCompareWardChange={setCompareWardId}
                timeWindow={timeWindow}
              />
            )}

            {/* View Mode: Grid or Accessible Table */}
            {(viewMode === 'grid' || viewMode === 'table') && (
              <>
                <WardHeatmapGrid
                  metrics={filteredMetrics}
                  viewMode={viewMode}
                  onSelectWard={(wId) => {
                    setSelectedWardId(wId);
                    setViewMode('trends');
                  }}
                  selectedWardId={selectedWardId}
                  userRole={userRole}
                />
              </>
            )}

            {/* Administrator Authorized Underlying Events Inspector */}
            {userRole === 'admin' && (
              <section
                aria-labelledby="admin-inspector-heading"
                className="glass-panel"
                style={{
                  marginTop: '2.5rem',
                  borderRadius: '1rem',
                  padding: '1.5rem',
                  border: '1.5px dashed rgba(245, 158, 11, 0.4)',
                  background: 'rgba(245, 158, 11, 0.02)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Database size={20} color="#f59e0b" />
                    <h3 id="admin-inspector-heading" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                      Administrative Audit &amp; Authorized Event Inspector
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAdminEventInspectorOpen((v) => !v)}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                  >
                    {adminEventInspectorOpen ? 'Collapse Inspector' : 'Expand Inspector'}
                  </button>
                </div>

                {adminEventInspectorOpen && (
                  <div>
                    <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                      Restricted to Chief Municipal Administrator. Displays underlying raw events (with coarse location and salted anonymized hashes) and append-only system audit logs.
                    </p>

                    {/* Underlying events table */}
                    <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
                      <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                        Underlying Operational Events ({authorizedEvents.length})
                      </h4>
                      <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'left' }}>
                            <th style={{ padding: '0.5rem' }}>Event ID</th>
                            <th style={{ padding: '0.5rem' }}>Ward</th>
                            <th style={{ padding: '0.5rem' }}>Category</th>
                            <th style={{ padding: '0.5rem' }}>Severity</th>
                            <th style={{ padding: '0.5rem' }}>Status</th>
                            <th style={{ padding: '0.5rem' }}>Coarse Location</th>
                            <th style={{ padding: '0.5rem' }}>Reporter Hash</th>
                          </tr>
                        </thead>
                        <tbody>
                          {authorizedEvents.slice(0, 10).map((evt) => (
                            <tr key={evt.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                              <td style={{ padding: '0.5rem', fontFamily: 'monospace' }}>{evt.id}</td>
                              <td style={{ padding: '0.5rem' }}>{evt.wardName}</td>
                              <td style={{ padding: '0.5rem' }}>{evt.category}</td>
                              <td style={{ padding: '0.5rem' }}>{evt.severity}</td>
                              <td style={{ padding: '0.5rem' }}>{evt.status}</td>
                              <td style={{ padding: '0.5rem' }}>{evt.coarseLocation}</td>
                              <td style={{ padding: '0.5rem', fontFamily: 'monospace' }}>{evt.reporterIdHash}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Audit log list */}
                    <div>
                      <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                        Append-Only Audit Trail ({auditLogs.length})
                      </h4>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.8rem' }}>
                        {auditLogs.slice(0, 5).map((log) => (
                          <li
                            key={log.id}
                            style={{
                              padding: '0.4rem 0.6rem',
                              marginBottom: '0.3rem',
                              background: 'var(--bg-card)',
                              borderRadius: '0.35rem',
                              display: 'flex',
                              justifyContent: 'space-between',
                            }}
                          >
                            <span>
                              <strong>[{log.action}]</strong> {log.details}
                            </span>
                            <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                              {log.actor} &bull; {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </section>
            )}
          </>
        )}

        {/* Intake Modal */}
        <CivicIssueReportModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          onSubmitSuccess={handleIngestReport}
        />
      </div>
    </div>
  );
}
