import { useState, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { useToast } from '../context/ToastContext';
import StreetlightHeader from '../components/streetlight/StreetlightHeader';
import StreetlightFilters from '../components/streetlight/StreetlightFilters';
import StreetlightClusterList from '../components/streetlight/StreetlightClusterList';
import StreetlightInteractiveMap from '../components/streetlight/StreetlightInteractiveMap';
import StreetlightClusterDetailModal from '../components/streetlight/StreetlightClusterDetailModal';
import StreetlightReportModal from '../components/streetlight/StreetlightReportModal';
import StreetlightTrackModal from '../components/streetlight/StreetlightTrackModal';
import StreetlightWorkOrderModal from '../components/streetlight/StreetlightWorkOrderModal';
import StreetlightTechnicianPanel from '../components/streetlight/StreetlightTechnicianPanel';
import {
  StreetlightOfflineBanner,
  StreetlightStaleNotice,
  StreetlightErrorState,
} from '../components/streetlight/StreetlightStates';
import {
  listClusters,
  getClusterById,
  submitOutageReport,
  triageCluster,
  createWorkOrder,
  listWorkOrders,
  updateWorkOrderStatus,
  recordRepairEvent,
  listAssets,
} from '../services/streetlightService';
import { STREETLIGHT_ROLES } from '../services/streetlightConstants';

const INITIAL_FILTERS = {
  jurisdictionId: 'all',
  status: 'all',
  priorityTier: 'all',
  searchQuery: '',
};

export default function StreetlightOutageWorkspace() {
  const { user } = useAuth();
  const { isOnline } = useNetwork();
  const { toast } = useToast();

  // Active role perspective: default to user's role or 'operator' for staff features
  const [activeRole, setActiveRole] = useState(() => {
    if (user?.role === 'admin') return STREETLIGHT_ROLES.ADMIN;
    return STREETLIGHT_ROLES.OPERATOR;
  });

  const activeActor = useMemo(() => ({
    id: user?.id || 'usr_staff_default',
    username: user?.username || 'MunicipalOperator',
    role: activeRole,
    streetlightRole: activeRole,
    jurisdictionId: 'WARD-042',
  }), [user, activeRole]);

  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'map'
  const [activeTab, setActiveTab] = useState('clusters'); // 'clusters' | 'technician'
  const [refreshTick, setRefreshTick] = useState(0);
  const [actionError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(() => new Date().toISOString());

  // Modals state
  const [selectedClusterId, setSelectedClusterId] = useState(null);
  const [dispatchTargetCluster, setDispatchTargetCluster] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showTrackModal, setShowTrackModal] = useState(false);

  const refreshData = useCallback(() => {
    setRefreshTick((prev) => prev + 1);
    setLastRefreshed(new Date().toISOString());
  }, []);

  // Fetch Clusters
  const { clusters, loadError } = useMemo(() => {
    if (refreshTick < 0) return { clusters: [], loadError: null };
    try {
      return { clusters: listClusters(filters, activeActor), loadError: null };
    } catch (err) {
      return { clusters: [], loadError: err?.message || 'Failed to load outage clusters.' };
    }
  }, [filters, activeActor, refreshTick]);

  // Fetch Assets
  const assets = useMemo(() => {
    if (refreshTick < 0) return [];
    try {
      return listAssets({ jurisdictionId: filters.jurisdictionId }, activeActor);
    } catch {
      return [];
    }
  }, [filters.jurisdictionId, activeActor, refreshTick]);

  // Fetch Work Orders for technician tab
  const workOrders = useMemo(() => {
    if (refreshTick < 0) return [];
    try {
      return listWorkOrders({ jurisdictionId: filters.jurisdictionId }, activeActor);
    } catch {
      return [];
    }
  }, [filters.jurisdictionId, activeActor, refreshTick]);

  // Selected Cluster Detail
  const selectedClusterDetail = useMemo(() => {
    if (!selectedClusterId || refreshTick < 0) return null;
    try {
      return getClusterById(selectedClusterId, activeActor);
    } catch {
      return null;
    }
  }, [selectedClusterId, activeActor, refreshTick]);

  // KPI Metrics Calculation
  const metrics = useMemo(() => {
    const totalPoles = assets.length;
    const activeClusters = clusters.filter((c) => c.status !== 'resolved').length;
    const criticalZones = clusters.filter((c) => c.priorityTier === 'critical' && c.status !== 'resolved').length;
    const activeWorkOrders = workOrders.filter((w) => w.status !== 'resolved' && w.status !== 'closed').length;
    const resolvedClusters = clusters.filter((c) => c.status === 'resolved').length;

    return {
      totalPoles,
      activeClusters,
      criticalZones,
      activeWorkOrders,
      resolvedClusters,
    };
  }, [assets, clusters, workOrders]);

  // Handlers
  const handleReportSubmit = (reportData) => {
    const res = submitOutageReport(reportData, activeActor);
    toast({
      type: 'success',
      title: 'Report Registered',
      message: `Outage report token generated: ${res.trackingToken}`,
    });
    refreshData();
    return res;
  };

  const handleTriageOverride = (clusterId, overrideData) => {
    try {
      triageCluster(clusterId, overrideData, activeActor);
      toast({
        type: 'success',
        title: 'Priority Updated',
        message: 'Cluster priority ranking updated with audit override.',
      });
      refreshData();
    } catch (err) {
      toast({
        type: 'error',
        title: 'Triage Failed',
        message: err.message,
      });
    }
  };

  const handleDispatchConfirm = (dispatchData) => {
    try {
      const wo = createWorkOrder(dispatchData, activeActor);
      toast({
        type: 'success',
        title: 'Work Order Dispatched',
        message: `Work Order ${wo.id} issued to ${wo.assignedTechnicianName}`,
      });
      refreshData();
    } catch (err) {
      toast({
        type: 'error',
        title: 'Dispatch Failed',
        message: err.message,
      });
    }
  };

  const handleWorkOrderStatusUpdate = (workOrderId, status, notes) => {
    try {
      updateWorkOrderStatus(workOrderId, status, notes, activeActor);
      toast({
        type: 'success',
        title: 'Status Updated',
        message: `Work order transitioned to ${status.replace('_', ' ')}`,
      });
      refreshData();
    } catch (err) {
      toast({
        type: 'error',
        title: 'Update Failed',
        message: err.message,
      });
    }
  };

  const handleRepairRecord = (repairData) => {
    try {
      recordRepairEvent(repairData, activeActor);
      toast({
        type: 'success',
        title: 'Repair Completed',
        message: 'Streetlights restored to fully functional status.',
      });
      refreshData();
    } catch (err) {
      toast({
        type: 'error',
        title: 'Repair Log Failed',
        message: err.message,
      });
    }
  };

  return (
    <div className="section" style={{ minHeight: '85vh', padding: '1.5rem 0' }}>
      <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1rem' }}>
        {/* Offline & Stale Status Notifications */}
        {!isOnline && <StreetlightOfflineBanner />}
        <StreetlightStaleNotice lastRefreshed={lastRefreshed} onRefresh={refreshData} />

        {(actionError || loadError) && <StreetlightErrorState error={actionError || loadError} onRetry={refreshData} />}

        {/* Dashboard Header */}
        <StreetlightHeader
          metrics={metrics}
          selectedWard={filters.jurisdictionId}
          onWardChange={(ward) => setFilters({ ...filters, jurisdictionId: ward })}
          onOpenReportModal={() => setShowReportModal(true)}
          onOpenTrackModal={() => setShowTrackModal(true)}
          activeRole={activeRole}
          onRoleChange={setActiveRole}
        />

        {/* Navigation Tabs (Operations Outages vs Technician Field Panel) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            borderBottom: '2px solid var(--border-main)',
            marginBottom: '1.25rem',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('clusters')}
            style={{
              padding: '0.6rem 1rem',
              fontSize: '0.9rem',
              fontWeight: activeTab === 'clusters' ? 700 : 500,
              color: activeTab === 'clusters' ? 'var(--accent-main)' : 'var(--text-secondary)',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'clusters' ? '2px solid var(--accent-main)' : '2px solid transparent',
              marginBottom: '-2px',
              cursor: 'pointer',
            }}
          >
            Outage Corridors & Triage ({clusters.length})
          </button>

          {(activeRole === STREETLIGHT_ROLES.TECHNICIAN ||
            activeRole === STREETLIGHT_ROLES.OPERATOR ||
            activeRole === STREETLIGHT_ROLES.ADMIN) && (
            <button
              type="button"
              onClick={() => setActiveTab('technician')}
              style={{
                padding: '0.6rem 1rem',
                fontSize: '0.9rem',
                fontWeight: activeTab === 'technician' ? 700 : 500,
                color: activeTab === 'technician' ? 'var(--accent-main)' : 'var(--text-secondary)',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'technician' ? '2px solid var(--accent-main)' : '2px solid transparent',
                marginBottom: '-2px',
                cursor: 'pointer',
              }}
            >
              Technician Field Panel ({workOrders.length})
            </button>
          )}
        </div>

        {/* Tab Content */}
        {activeTab === 'clusters' ? (
          <>
            {/* Filters Bar */}
            <StreetlightFilters
              filters={filters}
              onChange={setFilters}
              onReset={() => setFilters(INITIAL_FILTERS)}
              viewMode={viewMode}
              onViewModeToggle={setViewMode}
            />

            {/* Main Visual Display: Map or List */}
            {viewMode === 'map' ? (
              <StreetlightInteractiveMap
                clusters={clusters}
                assets={assets}
                onSelectCluster={setSelectedClusterId}
              />
            ) : (
              <StreetlightClusterList
                clusters={clusters}
                onSelectCluster={setSelectedClusterId}
                onDispatchWorkOrder={setDispatchTargetCluster}
                activeActor={activeActor}
              />
            )}
          </>
        ) : (
          <StreetlightTechnicianPanel
            workOrders={workOrders}
            onUpdateStatus={handleWorkOrderStatusUpdate}
            onRecordRepair={handleRepairRecord}
          />
        )}

        {/* Modals */}
        {selectedClusterDetail && (
          <StreetlightClusterDetailModal
            cluster={selectedClusterDetail}
            onClose={() => setSelectedClusterId(null)}
            onTriageOverride={handleTriageOverride}
            onDispatchWorkOrder={setDispatchTargetCluster}
            activeActor={activeActor}
          />
        )}

        {dispatchTargetCluster && (
          <StreetlightWorkOrderModal
            cluster={dispatchTargetCluster}
            onClose={() => setDispatchTargetCluster(null)}
            onConfirmDispatch={handleDispatchConfirm}
          />
        )}

        {showReportModal && (
          <StreetlightReportModal
            assets={assets}
            selectedWard={filters.jurisdictionId}
            onClose={() => setShowReportModal(false)}
            onSubmitReport={handleReportSubmit}
          />
        )}

        {showTrackModal && (
          <StreetlightTrackModal onClose={() => setShowTrackModal(false)} />
        )}
      </div>
    </div>
  );
}
