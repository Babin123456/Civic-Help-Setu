import { useState, useMemo, useEffect } from 'react';
import {
  AlertTriangle,
  Activity,
  Wrench,
  CheckCircle2,
} from 'lucide-react';
import RoadSafetyHeader from '../components/roadSafety/RoadSafetyHeader';
import RoadSafetyFilters from '../components/roadSafety/RoadSafetyFilters';
import RoadSafetyCaseList from '../components/roadSafety/RoadSafetyCaseList';
import RoadSafetyCaseDetailModal from '../components/roadSafety/RoadSafetyCaseDetailModal';
import RoadSafetySiteInspectionModal from '../components/roadSafety/RoadSafetySiteInspectionModal';
import RoadSafetyInterventionModal from '../components/roadSafety/RoadSafetyInterventionModal';
import RoadSafetyTimelineComparatorModal from '../components/roadSafety/RoadSafetyTimelineComparatorModal';
import RoadSafetyHazardReportModal from '../components/roadSafety/RoadSafetyHazardReportModal';
import RoadSafetyRiskRunModal from '../components/roadSafety/RoadSafetyRiskRunModal';
import RoadSafetyInteractiveMap from '../components/roadSafety/RoadSafetyInteractiveMap';
import {
  RoadSafetySkeleton,
  RoadSafetyOfflineBanner,
  RoadSafetyStaleDataNotice,
  RoadSafetyErrorState,
  RoadSafetyPermissionDeniedState,
  RoadSafetyViewToggle,
} from '../components/roadSafety/RoadSafetyStates';
import {
  listReviewCases,
  getReviewCaseDetail,
  transitionReviewCaseState,
  recordSiteInspection,
  recordIntervention,
  submitCitizenHazardReport,
  executeRiskRun,
} from '../services/roadSafetyBlackspotService';
import { SEED_ROAD_SEGMENTS } from '../data/roadSafetyContract';
import { useToast } from '../context/ToastContext';

const INITIAL_FILTERS = {
  state: 'all',
  status: 'all',
  minScore: 0,
  searchQuery: '',
};

export default function RoadSafetyDashboard() {
  const { toast } = useToast();
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [refreshTick, setRefreshTick] = useState(0);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'map'
  const [isLoading] = useState(false);
  const [permissionError, setPermissionError] = useState(null);
  const [isOffline, setIsOffline] = useState(() => (typeof navigator !== 'undefined' ? !navigator.onLine : false));

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

  // Modals state
  const [detailCaseId, setDetailCaseId] = useState(null);
  const [inspectionTargetCase, setInspectionTargetCase] = useState(null);
  const [interventionTargetCase, setInterventionTargetCase] = useState(null);
  const [showHazardModal, setShowHazardModal] = useState(false);
  const [showComparatorModal, setShowComparatorModal] = useState(false);
  const [showRiskRunModal, setShowRiskRunModal] = useState(false);

  // Fetch filtered cases
  const { filteredCases, totalItems, loadError } = useMemo(() => {
    // Explicit cache dependency for storage mutation invalidation
    if (refreshTick < 0) return { filteredCases: [], totalItems: 0, loadError: null };
    try {
      const res = listReviewCases(filters);
      return {
        filteredCases: res.cases,
        totalItems: res.totalItems,
        loadError: null,
      };
    } catch (err) {
      return {
        filteredCases: [],
        totalItems: 0,
        loadError: err?.message || 'Failed to list review cases',
      };
    }
  }, [filters, refreshTick]);

  // Full detail for modal
  const caseDetail = useMemo(() => {
    if (!detailCaseId || refreshTick < 0) return null;
    const detail = getReviewCaseDetail(detailCaseId);
    if (detail) return detail;
    const foundInList = filteredCases.find((c) => c.id === detailCaseId || c.segmentId === detailCaseId);
    if (!foundInList) return null;
    const segment = foundInList.segment || SEED_ROAD_SEGMENTS.find((s) => s.id === foundInList.segmentId) || SEED_ROAD_SEGMENTS[0];
    return {
      ...foundInList,
      segment,
      crashes: [],
      feature: null,
      hazards: [],
    };
  }, [detailCaseId, refreshTick, filteredCases]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalCorridors = SEED_ROAD_SEGMENTS.length;
    const criticalCount = filteredCases.filter((c) => c.compositeRiskScore >= 75).length;
    const inProgressCount = filteredCases.filter(
      (c) => c.status === 'intervention_planned' || c.status === 'in_progress'
    ).length;
    const resolvedCount = filteredCases.filter((c) => c.status === 'resolved').length;

    return {
      totalCorridors,
      criticalCount,
      inProgressCount,
      resolvedCount,
    };
  }, [filteredCases]);

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
  };

  const handleTransitionState = async (caseId, targetState, transitionData) => {
    try {
      const updated = transitionReviewCaseState(caseId, targetState, transitionData);
      toast?.success?.(`Review case transitioned to ${targetState.replace('_', ' ')}.`);
      setPermissionError(null);
      setRefreshTick((t) => t + 1);
      return updated;
    } catch (err) {
      if (err.name === 'PermissionDeniedError' || err.code === 'RS_FORBIDDEN_JURISDICTION') {
        setPermissionError(err.message);
      }
      throw err;
    }
  };

  const handleSubmitInspection = async (caseId, inspectionData) => {
    try {
      const result = recordSiteInspection(caseId, inspectionData);
      toast?.success?.('Physical site inspection recorded successfully.');
      setPermissionError(null);
      setRefreshTick((t) => t + 1);
      return result;
    } catch (err) {
      if (err.name === 'PermissionDeniedError' || err.code === 'RS_FORBIDDEN_JURISDICTION') {
        setPermissionError(err.message);
      }
      throw err;
    }
  };

  const handleSubmitIntervention = async (caseId, interventionData) => {
    try {
      const result = recordIntervention(caseId, interventionData);
      toast?.success?.('Engineering countermeasure recorded successfully.');
      setPermissionError(null);
      setRefreshTick((t) => t + 1);
      return result;
    } catch (err) {
      if (err.name === 'PermissionDeniedError' || err.code === 'RS_FORBIDDEN_JURISDICTION') {
        setPermissionError(err.message);
      }
      throw err;
    }
  };

  const handleSubmitHazard = async (reportData) => {
    const result = submitCitizenHazardReport(reportData);
    toast?.success?.('Road hazard reported. Thank you for strengthening road safety!');
    setRefreshTick((t) => t + 1);
    return result;
  };

  const handleExecuteRiskRun = async (parameters) => {
    try {
      const result = executeRiskRun(parameters);
      toast?.success?.(`Risk run completed. Evaluated ${result.runRecord.totalSegmentsEvaluated} corridors.`);
      setPermissionError(null);
      setRefreshTick((t) => t + 1);
      return result;
    } catch (err) {
      if (err.name === 'PermissionDeniedError' || err.code === 'RS_FORBIDDEN_JURISDICTION') {
        setPermissionError(err.message);
      }
      throw err;
    }
  };

  return (
    <div className="section" style={{ padding: '2rem 1rem' }}>
      <div className="container" style={{ maxWidth: '1150px', margin: '0 auto' }}>
        {/* Header */}
        <RoadSafetyHeader
          onOpenHazardModal={() => setShowHazardModal(true)}
          onOpenComparatorModal={() => setShowComparatorModal(true)}
          onOpenRiskRunModal={() => setShowRiskRunModal(true)}
        />

        {/* Quick KPI Stat Cards */}
        <div
          role="region"
          aria-label="Road safety dashboard summary statistics"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.75rem',
            marginBottom: '1.5rem',
          }}
        >
          <div
            style={{
              padding: '0.85rem 1rem',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-main)',
              borderRadius: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <div
              style={{
                width: '2.4rem',
                height: '2.4rem',
                borderRadius: '0.5rem',
                background: 'rgba(56, 189, 248, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Activity size={18} color="var(--accent-main)" />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: '700' }}>
                Monitored Corridors
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                {metrics.totalCorridors}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '0.85rem 1rem',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-main)',
              borderRadius: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <div
              style={{
                width: '2.4rem',
                height: '2.4rem',
                borderRadius: '0.5rem',
                background: 'rgba(239, 68, 68, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertTriangle size={18} color="#ef4444" />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: '700' }}>
                Priority 1 Blackspots
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#ef4444' }}>
                {metrics.criticalCount}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '0.85rem 1rem',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-main)',
              borderRadius: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <div
              style={{
                width: '2.4rem',
                height: '2.4rem',
                borderRadius: '0.5rem',
                background: 'rgba(245, 158, 11, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Wrench size={18} color="#f59e0b" />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: '700' }}>
                Active Countermeasures
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#f59e0b' }}>
                {metrics.inProgressCount}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '0.85rem 1rem',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-main)',
              borderRadius: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <div
              style={{
                width: '2.4rem',
                height: '2.4rem',
                borderRadius: '0.5rem',
                background: 'rgba(16, 185, 129, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle2 size={18} color="#10b981" />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: '700' }}>
                Resolved & Mitigated
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#10b981' }}>
                {metrics.resolvedCount}
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <RoadSafetyFilters
          filters={filters}
          onChange={setFilters}
          onReset={handleResetFilters}
        />

        {/* Offline & Data Currency Notices */}
        {isOffline && <RoadSafetyOfflineBanner />}
        <RoadSafetyStaleDataNotice />

        {/* View Mode Switcher & Counter */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Showing <strong>{filteredCases.length}</strong> identified road corridors ({totalItems} total)
          </span>
          <RoadSafetyViewToggle activeView={viewMode} onViewChange={setViewMode} />
        </div>

        {/* Loading / Permission Denied / Error / Data Views */}
        {isLoading ? (
          <RoadSafetySkeleton />
        ) : permissionError ? (
          <RoadSafetyPermissionDeniedState
            requiredRole={permissionError}
            onDismiss={() => setPermissionError(null)}
          />
        ) : loadError ? (
          <RoadSafetyErrorState message={loadError} onRetry={() => setRefreshTick((t) => t + 1)} />
        ) : viewMode === 'map' ? (
          <>
            <RoadSafetyInteractiveMap
              cases={filteredCases}
              onSelectCase={(c) => setDetailCaseId(c.id)}
            />
            {/* Synchronized accessible table view accompanying the map */}
            <div style={{ marginTop: '1.5rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                Tabular Evidence Alternative (Screen Reader &amp; Keyboard Accessible)
              </h3>
              <RoadSafetyCaseList
                cases={filteredCases}
                onSelectCase={(c) => setDetailCaseId(c.id)}
                onScheduleInspection={(c) => setInspectionTargetCase(c)}
                onPlanIntervention={(c) => setInterventionTargetCase(c)}
              />
            </div>
          </>
        ) : (
          <RoadSafetyCaseList
            cases={filteredCases}
            onSelectCase={(c) => setDetailCaseId(c.id)}
            onScheduleInspection={(c) => setInspectionTargetCase(c)}
            onPlanIntervention={(c) => setInterventionTargetCase(c)}
          />
        )}

        {/* Modals */}
        {detailCaseId && caseDetail && (
          <RoadSafetyCaseDetailModal
            caseDetail={caseDetail}
            onClose={() => setDetailCaseId(null)}
            onTransitionState={handleTransitionState}
          />
        )}

        {inspectionTargetCase && (
          <RoadSafetySiteInspectionModal
            selectedCase={inspectionTargetCase}
            onClose={() => setInspectionTargetCase(null)}
            onSubmitInspection={handleSubmitInspection}
          />
        )}

        {interventionTargetCase && (
          <RoadSafetyInterventionModal
            selectedCase={interventionTargetCase}
            onClose={() => setInterventionTargetCase(null)}
            onSubmitIntervention={handleSubmitIntervention}
          />
        )}

        {showComparatorModal && (
          <RoadSafetyTimelineComparatorModal
            segments={SEED_ROAD_SEGMENTS}
            onClose={() => setShowComparatorModal(false)}
          />
        )}

        {showHazardModal && (
          <RoadSafetyHazardReportModal
            segments={SEED_ROAD_SEGMENTS}
            onClose={() => setShowHazardModal(false)}
            onSubmitReport={handleSubmitHazard}
          />
        )}

        {showRiskRunModal && (
          <RoadSafetyRiskRunModal
            onClose={() => setShowRiskRunModal(false)}
            onExecuteRun={handleExecuteRiskRun}
          />
        )}
      </div>
    </div>
  );
}

