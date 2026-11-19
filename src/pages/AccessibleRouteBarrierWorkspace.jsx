/**
 * src/pages/AccessibleRouteBarrierWorkspace.jsx
 * Accessible Pedestrian Route Barrier Map for Public Infrastructure (#757).
 *
 * Implements:
 * - Functional mobility-constrained routing (no medical diagnosis collected).
 * - High-contrast interactive vector map and full WCAG 2.1 AA tabular alternative.
 * - Citizen obstacle intake with automated PII regex protection.
 * - Staff inspection and audit logging with role-based scoping.
 * - Full coverage of loading, empty, stale, offline, permission-denied, and recoverable error states.
 */

import { useState, useMemo, useCallback } from 'react';
import {
  Navigation,
  MapPin,
  AlertTriangle,
  PlusCircle,
  ShieldCheck,
  Table,
  Layers,
  RefreshCw,
  Clock,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNetwork } from '../context/NetworkContext';

import { pedestrianBarrierService } from '../services/pedestrianBarrierService.js';
import { isInspectionStale } from '../services/pedestrianRouteEngine.js';

import RoutePlannerPanel from '../components/pedestrianBarriers/RoutePlannerPanel.jsx';
import InteractiveBarrierMap from '../components/pedestrianBarriers/InteractiveBarrierMap.jsx';
import AccessibleRouteTable from '../components/pedestrianBarriers/AccessibleRouteTable.jsx';
import BarrierReportingModal from '../components/pedestrianBarriers/BarrierReportingModal.jsx';
import BarrierReviewModal from '../components/pedestrianBarriers/BarrierReviewModal.jsx';

export default function AccessibleRouteBarrierWorkspace() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isOnline } = useNetwork();

  // State
  const [selectedWard, setSelectedWard] = useState('all');
  const [viewMode, setViewMode] = useState('interactive'); // 'interactive' | 'tables'
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [nodes, setNodes] = useState(() => {
    try {
      return pedestrianBarrierService.getNodes();
    } catch {
      return [];
    }
  });
  const [segments, setSegments] = useState(() => {
    try {
      return pedestrianBarrierService.getSegments();
    } catch {
      return [];
    }
  });
  const [observations, setObservations] = useState(() => {
    try {
      return pedestrianBarrierService.getObservations();
    } catch {
      return [];
    }
  });
  const [temporaryObstructions, setTemporaryObstructions] = useState(() => {
    try {
      return pedestrianBarrierService.getTemporaryObstructions();
    } catch {
      return [];
    }
  });
  const [metrics, setMetrics] = useState(() => {
    try {
      return pedestrianBarrierService.getNetworkMetrics('all');
    } catch {
      return null;
    }
  });

  const [preferences, setPreferences] = useState(() => {
    try {
      return pedestrianBarrierService.getRoutePreferences();
    } catch {
      return {};
    }
  });

  const [routeResult, setRouteResult] = useState(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // User role
  const userRole = user?.role || 'citizen';
  const isStaff = ['operator', 'reviewer', 'admin'].includes(userRole);

  // Load and refresh dataset
  const loadWardData = useCallback((ward) => {
    setLoading(true);
    setErrorMessage('');
    try {
      const wardFilter = ward !== 'all' ? ward : null;
      setNodes(pedestrianBarrierService.getNodes({ ward: wardFilter }));
      setSegments(pedestrianBarrierService.getSegments({ ward: wardFilter }));
      setObservations(pedestrianBarrierService.getObservations({ ward: wardFilter }));
      setTemporaryObstructions(pedestrianBarrierService.getTemporaryObstructions({ ward: wardFilter }));
      setMetrics(pedestrianBarrierService.getNetworkMetrics(ward));
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load pedestrian infrastructure data.');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshData = useCallback(() => {
    loadWardData(selectedWard);
  }, [loadWardData, selectedWard]);

  // Check if any corridors have stale inspection data (> 30 days)
  const staleCorridorsCount = useMemo(() => {
    return segments.filter((s) => isInspectionStale(s.lastInspectedAt)).length;
  }, [segments]);

  // Handle route calculation
  const handleCalculateRoute = (originId, destId) => {
    setLoading(true);
    try {
      const res = pedestrianBarrierService.calculateRoute(originId, destId, preferences);
      setRouteResult(res);
      if (res.isDeterministicFallback) {
        toast.warning?.('Strict accessible route blocked. Traversed relaxed path with barrier warnings.');
      } else {
        toast.success?.('Accessible route calculated successfully.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Route calculation failed.');
      toast.error?.(err.message || 'Route calculation error.');
    } finally {
      setLoading(false);
    }
  };

  // Handle citizen barrier report
  const handleReportBarrier = async (payload) => {
    try {
      const res = pedestrianBarrierService.reportBarrierObservation(
        payload,
        { name: user?.name, id: user?.id },
        isOnline
      );
      if (res.isQueuedOffline) {
        toast.info?.('Network offline. Defect report queued locally on device.');
      } else {
        toast.success?.('Barrier report submitted for municipal verification.');
      }
      refreshData();
    } catch (err) {
      toast.error?.(err.message || 'Failed to submit barrier.');
      throw err;
    }
  };

  // Handle staff verification
  const handleVerifyObservation = async (obsId, decision) => {
    try {
      pedestrianBarrierService.verifyBarrierObservation(obsId, decision, {
        id: user?.id || 'OFFICER-BBMP',
        role: userRole,
      });
      toast.success?.('Observation verified and updated in routing network.');
      refreshData();
    } catch (err) {
      toast.error?.(err.message || 'Verification failed.');
      throw err;
    }
  };

  // Handle staff resolution
  const handleResolveObservation = async (obsId, resolution) => {
    try {
      pedestrianBarrierService.resolveBarrierObservation(obsId, resolution, {
        id: user?.id || 'OFFICER-BBMP',
        role: userRole,
      });
      toast.success?.('Defect marked as resolved. Barrier penalty removed from routing.');
      refreshData();
    } catch (err) {
      toast.error?.(err.message || 'Resolution failed.');
      throw err;
    }
  };

  // Handle offline queue sync
  const handleSyncOfflineQueue = () => {
    const res = pedestrianBarrierService.flushOfflineQueue();
    if (res.flushed > 0) {
      toast.success?.(`Synchronized ${res.flushed} offline reports.`);
      refreshData();
    } else {
      toast.info?.('No pending offline reports to synchronize.');
    }
  };

  return (
    <div className="section" style={{ paddingBottom: '3rem' }}>
      <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1rem' }}>
        {/* Header Ribbon */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                <Navigation size={28} style={{ color: 'var(--primary)' }} aria-hidden="true" />
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Accessible Pedestrian Route &amp; Barrier Map
                </h1>
              </div>
              <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', margin: 0, maxWidth: '780px' }}>
                Municipal infrastructure accessibility layer. Plan pedestrian journeys avoiding broken footpaths,
                missing curb ramps, and excessive gradients. Community reported, officially verified.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setIsReportModalOpen(true)}
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem' }}
              >
                <PlusCircle size={16} aria-hidden="true" />
                Report Obstacle
              </button>

              {isStaff && (
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(true)}
                  className="btn btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem' }}
                >
                  <ShieldCheck size={16} aria-hidden="true" />
                  Staff Review Queue
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Offline Alert Banner */}
        {!isOnline && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              marginBottom: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.86rem',
              color: 'var(--text-primary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <WifiOff size={18} style={{ color: 'var(--primary)' }} aria-hidden="true" />
              <span>
                <strong>Offline Mode Active:</strong> You are viewing cached pedestrian infrastructure data. Route
                scoring runs locally in-memory.
              </span>
            </div>
            <button
              type="button"
              onClick={handleSyncOfflineQueue}
              className="btn btn-sm btn-ghost"
              style={{ fontSize: '0.78rem' }}
            >
              Sync Queue
            </button>
          </div>
        )}

        {/* Stale Inspection Warning Notice */}
        {staleCorridorsCount > 0 && (
          <div
            style={{
              padding: '0.65rem 1rem',
              borderRadius: '0.5rem',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.82rem',
              color: 'var(--text-primary)',
            }}
          >
            <Clock size={16} style={{ color: 'var(--warning, #f59e0b)' }} aria-hidden="true" />
            <span>
              <strong>Audit Recency Notice:</strong> {staleCorridorsCount} corridor(s) have not been field-audited
              within the statutory 30-day window. Routes traversing these sections will be labeled as "Partially
              Verified" until physical ground inspection is renewed.
            </span>
          </div>
        )}

        {/* Recoverable Error State */}
        {errorMessage && (
          <div
            style={{
              padding: '1rem',
              borderRadius: '0.5rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              marginBottom: '1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger, #ef4444)' }}>
              <AlertTriangle size={20} aria-hidden="true" />
              <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={refreshData}
              className="btn btn-sm btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        )}

        {/* Infrastructure Metrics Ribbon */}
        {metrics && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: '0.75rem',
              marginBottom: '1.25rem',
            }}
          >
            <div
              className="card"
              style={{ padding: '0.75rem 1rem', borderRadius: '0.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}
            >
              <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'block' }}>Walkway Corridors</span>
              <strong style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>{metrics.totalCorridors}</strong>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{metrics.verifiedCorridors} verified</div>
            </div>

            <div
              className="card"
              style={{ padding: '0.75rem 1rem', borderRadius: '0.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}
            >
              <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'block' }}>Curb Ramp Compliance</span>
              <strong style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>{metrics.curbRampCompliancePct}%</strong>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>Dropped kerbs present</div>
            </div>

            <div
              className="card"
              style={{ padding: '0.75rem 1rem', borderRadius: '0.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}
            >
              <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'block' }}>Tactile Paving Coverage</span>
              <strong style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>{metrics.tactileCoveragePct}%</strong>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>Continuous blister paving</div>
            </div>

            <div
              className="card"
              style={{ padding: '0.75rem 1rem', borderRadius: '0.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}
            >
              <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'block' }}>Active Obstacles</span>
              <strong style={{ fontSize: '1.25rem', color: 'var(--danger, #ef4444)' }}>{metrics.verifiedBarriersCount + metrics.pendingBarriersCount}</strong>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{metrics.resolvedBarriersCount} resolved defects</div>
            </div>
          </div>
        )}

        {/* View Switcher & Filters */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label htmlFor="ward-scope-select" style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Ward Jurisdiction:
            </label>
            <select
              id="ward-scope-select"
              value={selectedWard}
              onChange={(e) => {
                const w = e.target.value;
                setSelectedWard(w);
                loadWardData(w);
              }}
              style={{
                padding: '0.4rem 0.75rem',
                borderRadius: '0.5rem',
                background: 'var(--bg-input, var(--bg-card))',
                border: '1px solid var(--border-light)',
                color: 'var(--text-primary)',
                fontSize: '0.84rem',
              }}
            >
              <option value="all">All Municipal Wards</option>
              <option value="Ward 150 - Bellandur">Ward 150 - Bellandur</option>
              <option value="Ward 174 - HSR Layout">Ward 174 - HSR Layout</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              type="button"
              className={`btn btn-sm ${viewMode === 'interactive' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('interactive')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Layers size={14} aria-hidden="true" />
              Interactive Map &amp; Planner
            </button>
            <button
              type="button"
              className={`btn btn-sm ${viewMode === 'tables' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('tables')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Table size={14} aria-hidden="true" />
              Accessible Tables Alternative
            </button>
          </div>
        </div>

        {/* Loading State Skeleton */}
        {loading && (
          <div
            style={{
              padding: '2rem',
              textAlign: 'center',
              background: 'var(--bg-card)',
              borderRadius: '0.75rem',
              border: '1px solid var(--border-light)',
              marginBottom: '1rem',
            }}
            aria-busy="true"
          >
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)', margin: '0 auto 0.5rem auto' }} />
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              Querying municipal graph database and computing routing constraints...
            </p>
          </div>
        )}

        {/* Empty State */}
        {!loading && segments.length === 0 && (
          <div
            style={{
              padding: '3rem 1.5rem',
              textAlign: 'center',
              background: 'var(--bg-card)',
              borderRadius: '0.75rem',
              border: '1px dashed var(--border-light)',
              marginBottom: '1.5rem',
            }}
          >
            <MapPin size={36} style={{ color: 'var(--text-tertiary)', margin: '0 auto 0.75rem auto' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
              No Pedestrian Infrastructure Data Recorded
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 auto 1.25rem auto', maxWidth: '480px' }}>
              No walkway segments or crossing assets are currently recorded for {selectedWard}. Switch wards or
              submit the first pedestrian observation report.
            </p>
            <button
              type="button"
              onClick={() => setIsReportModalOpen(true)}
              className="btn btn-primary btn-sm"
            >
              Submit First Corridor Report
            </button>
          </div>
        )}

        {/* Main Workspace Content */}
        {!loading && segments.length > 0 && (
          <div>
            {viewMode === 'interactive' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1.25rem', alignItems: 'start' }}>
                <RoutePlannerPanel
                  nodes={nodes}
                  preferences={preferences}
                  onPreferencesChange={(newPrefs) => {
                    setPreferences(newPrefs);
                    pedestrianBarrierService.saveRoutePreferences(newPrefs);
                  }}
                  onCalculateRoute={handleCalculateRoute}
                  routeResult={routeResult}
                  loading={loading}
                />

                <InteractiveBarrierMap
                  nodes={nodes}
                  segments={segments}
                  observations={observations}
                  temporaryObstructions={temporaryObstructions}
                  routeResult={routeResult}
                  onNodeSelect={(node) => {
                    toast.info?.(`Selected junction: ${node.name}`);
                  }}
                  onBarrierSelect={(bar) => {
                    toast.info?.(`Selected barrier: ${bar.id} (${bar.description.slice(0, 35)}...)`);
                  }}
                />
              </div>
            ) : (
              <AccessibleRouteTable
                routeResult={routeResult}
                observations={observations}
                onSelectObservation={(bar) => {
                  toast.info?.(`Barrier detail: ${bar.id}`);
                }}
              />
            )}
          </div>
        )}

        {/* Modals */}
        <BarrierReportingModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          onSubmit={handleReportBarrier}
          segments={segments}
          selectedWard={selectedWard !== 'all' ? selectedWard : 'Ward 150 - Bellandur'}
          isOnline={isOnline}
        />

        <BarrierReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          observations={observations.filter((o) => o.status === 'reported' || o.status === 'under_review')}
          onVerify={handleVerifyObservation}
          onResolve={handleResolveObservation}
          userRole={userRole}
        />
      </div>
    </div>
  );
}
