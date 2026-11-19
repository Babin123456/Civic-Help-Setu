import { useState, useEffect, useMemo, useId } from 'react';
import {
  Route,
  MapPin,
  Truck,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Plus,
  Clock,
  Download,
  WifiOff,
  X,
  Check,
  Eye,
} from 'lucide-react';

import {
  CollectionRouteStatus,
  PickupPointStatus,
  VehicleStatus,
  SegregationAuditRating,
  RouteRecommendationStatus,
  RouteRecommendationPriority,
} from '../data/routePlanning/models.js';

import {
  listCollectionRoutes,
  createCollectionRoute,
  updateCollectionRoute,
  listPickupPoints,
  createPickupPoint,
  updatePickupPoint,
  listVehicles,
  createVehicle,
  listSegregationAudits,
  createSegregationAudit,
  listMissedPickups,
  generateDeterministicRecommendations,
  listRouteRecommendations,
  acceptRouteRecommendation,
  getPublicRouteSummary,
  initializeStorage,
  exportAllData,
  roleOf,
  setCurrentActor,
  CURRENT_SCHEMA_VERSION,
} from '../services/routePlanning/service.js';

import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { useToast } from '../context/ToastContext';

const getAppStorage = () => {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage;
  return null;
};

// Safe hooks fallback when rendered outside specific context providers
const useSafeAuth = () => {
  try {
    return useAuth();
  } catch {
    return { user: { role: 'supervisor', username: 'Ward Supervisor' } };
  }
};

const useSafeNetwork = () => {
  try {
    return useNetwork();
  } catch {
    return { isOnline: true };
  }
};

const useSafeToast = () => {
  try {
    return useToast();
  } catch {
    return { showToast: () => {} };
  }
};

export default function RoutePlanningWorkspace() {
  const { user } = useSafeAuth();
  const { isOnline } = useSafeNetwork();
  const { showToast } = useSafeToast();

  const nameInputId = useId();
  const wardInputId = useId();
  const descInputId = useId();
  const ptAddressId = useId();
  const ptTypeId = useId();
  const ptWasteId = useId();
  const vehRegId = useId();
  const vehTypeId = useId();
  const vehCapId = useId();
  const auditPointId = useId();
  const auditCompId = useId();
  const auditRatingId = useId();
  const auditNotesId = useId();
  const rejectReasonId = useId();

  // Active view tab
  const [activeTab, setActiveTab] = useState('routes'); // 'routes' | 'vehicles' | 'audits' | 'recommendations' | 'public'
  const [selectedWard, setSelectedWard] = useState('ALL');

  // Core domain state
  const [routes, setRoutes] = useState(() => {
    try {
      const store = getAppStorage();
      if (store) {
        initializeStorage(store);
        return listCollectionRoutes({}, store);
      }
    } catch (e) {
      void e;
    }
    return [];
  });

  const [selectedRouteId, setSelectedRouteId] = useState(() => {
    try {
      const store = getAppStorage();
      if (store) {
        const rList = listCollectionRoutes({}, store);
        return rList.length > 0 ? rList[0].id : null;
      }
    } catch (e) {
      void e;
    }
    return null;
  });

  const [pickupPoints, setPickupPoints] = useState(() => {
    try {
      const store = getAppStorage();
      if (store) {
        return listPickupPoints({}, store);
      }
    } catch (e) {
      void e;
    }
    return [];
  });

  const [vehicles, setVehicles] = useState(() => {
    try {
      const store = getAppStorage();
      if (store) {
        return listVehicles({}, store);
      }
    } catch (e) {
      void e;
    }
    return [];
  });

  const [audits, setAudits] = useState(() => {
    try {
      const store = getAppStorage();
      if (store) {
        return listSegregationAudits({}, store);
      }
    } catch (e) {
      void e;
    }
    return [];
  });

  const [recommendations, setRecommendations] = useState(() => {
    try {
      const store = getAppStorage();
      if (store) {
        return listRouteRecommendations({}, store);
      }
    } catch (e) {
      void e;
    }
    return [];
  });

  const [missedPickups, setMissedPickups] = useState(() => {
    try {
      const store = getAppStorage();
      if (store) {
        return listMissedPickups({}, store);
      }
    } catch (e) {
      void e;
    }
    return [];
  });

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAccessibleTable, setShowAccessibleTable] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(() => new Date());

  // Modals state
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [isPointModalOpen, setIsPointModalOpen] = useState(false);
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [activeRejectRecId, setActiveRejectRecId] = useState(null);
  const [rejectionReasonText, setRejectionReasonText] = useState('');

  // Form states
  const [newRouteForm, setNewRouteForm] = useState({
    name: '',
    ward: 'Ward 150 - Bellandur',
    description: '',
    scheduledStartTime: '06:30',
    scheduledEndTime: '10:00',
  });

  const [newPointForm, setNewPointForm] = useState({
    address: '',
    ward: 'Ward 150 - Bellandur',
    collectionType: 'door-to-door',
    estimatedWasteKg: 45,
    scheduledTime: '07:00',
  });

  const [newVehicleForm, setNewVehicleForm] = useState({
    registrationNumber: '',
    type: 'tipper',
    capacityKg: 600,
    capacityLitres: 1200,
  });

  const [newAuditForm, setNewAuditForm] = useState({
    pickupPointId: '',
    ward: 'Ward 150 - Bellandur',
    compliancePercentage: 80,
    rating: SegregationAuditRating.GOOD,
    issuesNoted: '',
    wetObserved: true,
    dryObserved: true,
    hazardousObserved: false,
  });

  // Synchronize authenticated actor with routePlanning service
  useEffect(() => {
    if (user) {
      setCurrentActor(user);
    } else {
      setCurrentActor({ role: 'supervisor', username: 'Sanitation Officer' });
    }
  }, [user]);

  // Load data from persistence
  const loadWorkspaceData = () => {
    try {
      const store = getAppStorage();
      if (store) {
        initializeStorage(store);
        const rList = listCollectionRoutes({}, store);
        const pList = listPickupPoints({}, store);
        const vList = listVehicles({}, store);
        const aList = listSegregationAudits({}, store);
        const recList = listRouteRecommendations({}, store);
        const mList = listMissedPickups({}, store);

        setRoutes(rList);
        setPickupPoints(pList);
        setVehicles(vList);
        setAudits(aList);
        setRecommendations(recList);
        setMissedPickups(mList);

        if (rList.length > 0 && !selectedRouteId) {
          setSelectedRouteId(rList[0].id);
        }
        setLastRefreshedAt(new Date());
      }
    } catch (err) {
      showToast(err.message || 'Error loading route planning data', 'error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadWorkspaceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filtered views
  const filteredRoutes = useMemo(() => {
    if (selectedWard === 'ALL') return routes;
    return routes.filter((r) => r.ward === selectedWard);
  }, [routes, selectedWard]);

  const activeRoute = useMemo(() => {
    return routes.find((r) => r.id === selectedRouteId) || routes[0] || null;
  }, [routes, selectedRouteId]);

  const activeRoutePoints = useMemo(() => {
    if (!activeRoute) return [];
    return pickupPoints.filter((p) => (activeRoute.pickupPointIds || []).includes(p.id));
  }, [activeRoute, pickupPoints]);

  const activeRouteVehicles = useMemo(() => {
    if (!activeRoute) return [];
    return vehicles.filter((v) => (activeRoute.vehicleIds || []).includes(v.id));
  }, [activeRoute, vehicles]);

  // KPI calculations
  const totalFleetCapacityKg = useMemo(() => {
    return vehicles.reduce((sum, v) => sum + (v.capacityKg || 0), 0);
  }, [vehicles]);

  const totalCurrentLoadKg = useMemo(() => {
    return vehicles.reduce((sum, v) => sum + (v.currentLoadKg || 0), 0);
  }, [vehicles]);

  const capacityUtilizationPct = totalFleetCapacityKg > 0 ? Math.round((totalCurrentLoadKg / totalFleetCapacityKg) * 100) : 0;

  const averageAuditScore = useMemo(() => {
    if (audits.length === 0) return 0;
    return Math.round(audits.reduce((acc, a) => acc + (a.compliancePercentage || 0), 0) / audits.length);
  }, [audits]);

  const servicedPointsCount = useMemo(() => {
    return pickupPoints.filter((p) => p.status === PickupPointStatus.SERVICED).length;
  }, [pickupPoints]);

  const serviceCompletionPct = pickupPoints.length > 0 ? Math.round((servicedPointsCount / pickupPoints.length) * 100) : 0;

  // Actions
  const handleRefresh = () => {
    setIsRefreshing(true);
    loadWorkspaceData();
    showToast('Route planner synchronized with storage.', 'success');
  };

  const handleRunAiOptimization = () => {
    if (!activeRoute) {
      showToast('Select an active route first.', 'warning');
      return;
    }
    try {
      const store = getAppStorage();
      const generated = generateDeterministicRecommendations(activeRoute.id, store);
      loadWorkspaceData();
      setActiveTab('recommendations');
      showToast(`AI generated ${generated.length} explainable recommendations for ${activeRoute.name}`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateRoute = (e) => {
    e.preventDefault();
    try {
      const store = getAppStorage();
      const created = createCollectionRoute(newRouteForm, store);
      setNewRouteForm({
        name: '',
        ward: 'Ward 150 - Bellandur',
        description: '',
        scheduledStartTime: '06:30',
        scheduledEndTime: '10:00',
      });
      setIsRouteModalOpen(false);
      loadWorkspaceData();
      setSelectedRouteId(created.id);
      showToast(`Route "${created.name}" created successfully.`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCreatePoint = (e) => {
    e.preventDefault();
    try {
      const store = getAppStorage();
      const created = createPickupPoint(newPointForm, store);
      if (activeRoute) {
        const updatedPoints = [...(activeRoute.pickupPointIds || []), created.id];
        updateCollectionRoute(activeRoute.id, { pickupPointIds: updatedPoints }, store);
      }
      setNewPointForm({
        address: '',
        ward: activeRoute ? activeRoute.ward : 'Ward 150 - Bellandur',
        collectionType: 'door-to-door',
        estimatedWasteKg: 45,
        scheduledTime: '07:00',
      });
      setIsPointModalOpen(false);
      loadWorkspaceData();
      showToast(`Pickup point added to ${activeRoute?.name || 'ward'}.`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateVehicle = (e) => {
    e.preventDefault();
    try {
      const store = getAppStorage();
      const created = createVehicle(newVehicleForm, store);
      setNewVehicleForm({
        registrationNumber: '',
        type: 'tipper',
        capacityKg: 600,
        capacityLitres: 1200,
      });
      setIsVehicleModalOpen(false);
      loadWorkspaceData();
      showToast(`Vehicle ${created.registrationNumber} registered in fleet.`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateAudit = async (e) => {
    e.preventDefault();
    try {
      const store = getAppStorage();
      const targetPoint = pickupPoints.find((p) => p.id === newAuditForm.pickupPointId) || pickupPoints[0];
      const created = await createSegregationAudit(
        {
          pickupPointId: targetPoint?.id || 'pt-generic',
          ward: targetPoint?.ward || newAuditForm.ward,
          compliancePercentage: Number(newAuditForm.compliancePercentage),
          rating: newAuditForm.rating,
          issuesNoted: newAuditForm.issuesNoted,
          observedStreams: {
            wet: newAuditForm.wetObserved ? 1 : 0,
            dry: newAuditForm.dryObserved ? 1 : 0,
            hazardous: newAuditForm.hazardousObserved ? 1 : 0,
          },
        },
        store
      );
      setIsAuditModalOpen(false);
      loadWorkspaceData();
      showToast(`Audit recorded with cryptographic seal ${created.integritySeal}`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleAcceptRecommendation = (recId) => {
    try {
      const store = getAppStorage();
      acceptRouteRecommendation(recId, { action: 'accept' }, store);
      loadWorkspaceData();
      showToast('Recommendation accepted and applied to route plan.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleOpenRejectModal = (recId) => {
    setActiveRejectRecId(recId);
    setRejectionReasonText('');
    setIsRejectModalOpen(true);
  };

  const handleConfirmReject = (e) => {
    e.preventDefault();
    if (!rejectionReasonText.trim()) {
      showToast('Please state a reason for rejecting this recommendation.', 'warning');
      return;
    }
    try {
      const store = getAppStorage();
      acceptRouteRecommendation(
        activeRejectRecId,
        { action: 'reject', rejectionReason: rejectionReasonText },
        store
      );
      setIsRejectModalOpen(false);
      loadWorkspaceData();
      showToast('Recommendation rejected with audit reason logged.', 'info');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleTogglePointStatus = (pointId, currentStatus) => {
    try {
      const store = getAppStorage();
      const newStatus = currentStatus === PickupPointStatus.SERVICED ? PickupPointStatus.SCHEDULED : PickupPointStatus.SERVICED;
      updatePickupPoint(pointId, { status: newStatus }, store);
      loadWorkspaceData();
      showToast(`Pickup point marked as ${newStatus}.`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleExportJson = () => {
    try {
      const store = getAppStorage();
      const jsonStr = exportAllData(store);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `civicbridge-route-planning-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Route planning dataset exported.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: '3rem 1rem', maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
        <RefreshCw size={36} className="animate-spin" style={{ color: 'var(--primary, #10b981)', margin: '0 auto 1rem' }} />
        <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary, #f8fafc)' }}>Loading Route Planning Workspace...</h2>
        <p style={{ color: 'var(--text-secondary, #94a3b8)' }}>Reading ward schedules, vehicle telemetry, and segregation audits</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '1.5rem 1rem 4rem' }}>
      {/* Offline Banner */}
      {!isOnline && (
        <div
          role="status"
          style={{
            background: 'rgba(217, 119, 6, 0.15)',
            border: '1px solid #d97706',
            color: '#fbbf24',
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.9rem',
          }}
        >
          <WifiOff size={18} />
          <span>
            <strong>Offline Mode:</strong> Working from local cache. Edits, route dispatches, and audits are safely queued
            in localStorage.
          </span>
        </div>
      )}

      {/* Main Header */}
      <header
        style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(6, 78, 59, 0.88))',
          border: '1px solid var(--border-light, #334155)',
          borderRadius: '1rem',
          padding: '1.75rem 2rem',
          marginBottom: '1.5rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
              <span
                style={{
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#34d399',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Municipal Sanitation v{CURRENT_SCHEMA_VERSION}
              </span>
              <span
                style={{
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                }}
              >
                Role: {roleOf(user)}
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: '1.85rem', fontWeight: 700, color: 'var(--text-primary, #f8fafc)' }}>
              AI-Assisted Municipal Waste Collection Route & Segregation Audit Planner
            </h1>
            <p style={{ margin: '0.4rem 0 0', color: 'var(--text-secondary, #94a3b8)', fontSize: '0.95rem' }}>
              Plan collection loops, verify vehicle capacity constraints, record sampled segregation audits, and manage explainable optimization suggestions.
              {lastRefreshedAt && ` (Last synced: ${lastRefreshedAt.toLocaleTimeString()} • ${missedPickups.length} unresolved missed pickups logged)`}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'rgba(51, 65, 85, 0.8)',
                color: '#e2e8f0',
                border: '1px solid #475569',
                padding: '0.5rem 0.85rem',
                borderRadius: '0.5rem',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
              title="Refresh local records"
            >
              <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
              Sync
            </button>
            <button
              onClick={handleExportJson}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'rgba(51, 65, 85, 0.8)',
                color: '#e2e8f0',
                border: '1px solid #475569',
                padding: '0.5rem 0.85rem',
                borderRadius: '0.5rem',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
              title="Export complete JSON dataset"
            >
              <Download size={15} />
              Export
            </button>
            <button
              onClick={handleRunAiOptimization}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'linear-gradient(135deg, #059669, #0d9488)',
                color: '#ffffff',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(5, 150, 105, 0.3)',
              }}
            >
              <Sparkles size={16} />
              Run AI Optimizer
            </button>
          </div>
        </div>
      </header>

      {/* KPI Overview Cards */}
      <section aria-label="Key Performance Indicators" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'var(--bg-card, #1e293b)', border: '1px solid var(--border-light, #334155)', borderRadius: '0.75rem', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.85rem' }}>
            <span>Active Routes</span>
            <Route size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc', margin: '0.4rem 0 0.1rem' }}>
            {routes.length}
          </div>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Wards monitored: 2</span>
        </div>

        <div style={{ background: 'var(--bg-card, #1e293b)', border: '1px solid var(--border-light, #334155)', borderRadius: '0.75rem', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.85rem' }}>
            <span>Pickups Serviced Today</span>
            <CheckCircle2 size={18} color="#3b82f6" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc', margin: '0.4rem 0 0.1rem' }}>
            {serviceCompletionPct}%
          </div>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
            {servicedPointsCount} of {pickupPoints.length} points serviced
          </span>
        </div>

        <div style={{ background: 'var(--bg-card, #1e293b)', border: '1px solid var(--border-light, #334155)', borderRadius: '0.75rem', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.85rem' }}>
            <span>Fleet Capacity Load</span>
            <Truck size={18} color={capacityUtilizationPct > 85 ? '#ef4444' : '#f59e0b'} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc', margin: '0.4rem 0 0.1rem' }}>
            {capacityUtilizationPct}%
          </div>
          <span style={{ fontSize: '0.8rem', color: capacityUtilizationPct > 85 ? '#f87171' : '#64748b' }}>
            {totalCurrentLoadKg} / {totalFleetCapacityKg} kg assigned
          </span>
        </div>

        <div style={{ background: 'var(--bg-card, #1e293b)', border: '1px solid var(--border-light, #334155)', borderRadius: '0.75rem', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.85rem' }}>
            <span>Segregation Compliance</span>
            <ShieldCheck size={18} color="#8b5cf6" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc', margin: '0.4rem 0 0.1rem' }}>
            {averageAuditScore}%
          </div>
          <span style={{ fontSize: '0.8rem', color: averageAuditScore >= 70 ? '#34d399' : '#fbbf24' }}>
            {audits.length} sampled audits logged
          </span>
        </div>
      </section>

      {/* Navigation Tabs */}
      <div
        role="tablist"
        aria-label="Route Planning Sections"
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-light, #334155)',
          gap: '0.5rem',
          marginBottom: '1.5rem',
          overflowX: 'auto',
        }}
      >
        <button
          role="tab"
          aria-selected={activeTab === 'routes'}
          onClick={() => setActiveTab('routes')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'routes' ? '3px solid #10b981' : '3px solid transparent',
            color: activeTab === 'routes' ? '#f8fafc' : '#94a3b8',
            fontWeight: activeTab === 'routes' ? 600 : 500,
            cursor: 'pointer',
            fontSize: '0.95rem',
          }}
        >
          <Route size={18} />
          Routes & Schedules ({routes.length})
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'vehicles'}
          onClick={() => setActiveTab('vehicles')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'vehicles' ? '3px solid #10b981' : '3px solid transparent',
            color: activeTab === 'vehicles' ? '#f8fafc' : '#94a3b8',
            fontWeight: activeTab === 'vehicles' ? 600 : 500,
            cursor: 'pointer',
            fontSize: '0.95rem',
          }}
        >
          <Truck size={18} />
          Vehicle Capacity ({vehicles.length})
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'audits'}
          onClick={() => setActiveTab('audits')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'audits' ? '3px solid #10b981' : '3px solid transparent',
            color: activeTab === 'audits' ? '#f8fafc' : '#94a3b8',
            fontWeight: activeTab === 'audits' ? 600 : 500,
            cursor: 'pointer',
            fontSize: '0.95rem',
          }}
        >
          <ClipboardCheck size={18} />
          Segregation Audits ({audits.length})
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'recommendations'}
          onClick={() => setActiveTab('recommendations')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'recommendations' ? '3px solid #10b981' : '3px solid transparent',
            color: activeTab === 'recommendations' ? '#f8fafc' : '#94a3b8',
            fontWeight: activeTab === 'recommendations' ? 600 : 500,
            cursor: 'pointer',
            fontSize: '0.95rem',
          }}
        >
          <Sparkles size={18} />
          AI Recommendations ({recommendations.length})
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'public'}
          onClick={() => setActiveTab('public')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'public' ? '3px solid #10b981' : '3px solid transparent',
            color: activeTab === 'public' ? '#f8fafc' : '#94a3b8',
            fontWeight: activeTab === 'public' ? 600 : 500,
            cursor: 'pointer',
            fontSize: '0.95rem',
          }}
        >
          <Eye size={18} />
          Public Summary View
        </button>
      </div>

      {/* ========================================================
          TAB 1: ROUTES & COLLECTION SCHEDULES
         ======================================================== */}
      {activeTab === 'routes' && (
        <section aria-labelledby="routes-heading">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h2 id="routes-heading" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc' }}>
              Collection Routes & Sequence Checkpoints
            </h2>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <select
                aria-label="Filter routes by ward"
                value={selectedWard}
                onChange={(e) => setSelectedWard(e.target.value)}
                style={{
                  background: '#0f172a',
                  border: '1px solid #475569',
                  borderRadius: '0.4rem',
                  color: '#f8fafc',
                  padding: '0.45rem 0.6rem',
                  fontSize: '0.85rem',
                }}
              >
                <option value="ALL">All Wards</option>
                <option value="Ward 150 - Bellandur">Ward 150 - Bellandur</option>
                <option value="Ward 174 - HSR Layout">Ward 174 - HSR Layout</option>
              </select>
              <button
                onClick={() => setIsRouteModalOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: 'var(--primary, #10b981)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.5rem 0.9rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Plus size={16} />
                New Route
              </button>
              <button
                onClick={() => setIsPointModalOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: 'rgba(51, 65, 85, 0.8)',
                  color: '#e2e8f0',
                  border: '1px solid #475569',
                  padding: '0.5rem 0.9rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                <MapPin size={16} />
                Add Pickup Point
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            {/* Left: Routes List */}
            <div>
              {filteredRoutes.length === 0 ? (
                <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                  <Route size={32} style={{ margin: '0 auto 0.5rem', color: '#64748b' }} />
                  <p>No collection routes configured for this filter. Click "New Route" to create one.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {filteredRoutes.map((r) => {
                    const isSelected = r.id === activeRoute?.id;
                    const rPoints = pickupPoints.filter((p) => (r.pickupPointIds || []).includes(p.id));
                    const servicedR = rPoints.filter((p) => p.status === PickupPointStatus.SERVICED).length;
                    return (
                      <div
                        key={r.id}
                        onClick={() => setSelectedRouteId(r.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            setSelectedRouteId(r.id);
                          }
                        }}
                        style={{
                          background: isSelected ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-card, #1e293b)',
                          border: isSelected ? '2px solid #10b981' : '1px solid var(--border-light, #334155)',
                          borderRadius: '0.75rem',
                          padding: '1rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#f8fafc' }}>{r.name}</h3>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '9999px',
                              background: r.status === CollectionRouteStatus.ACTIVE ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                              color: r.status === CollectionRouteStatus.ACTIVE ? '#34d399' : '#cbd5e1',
                              fontWeight: 600,
                            }}
                          >
                            {r.status}
                          </span>
                        </div>
                        <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: '#94a3b8' }}>
                          {r.ward} • Schedule: {r.scheduledStartTime} - {r.scheduledEndTime}
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b' }}>
                          <span>{rPoints.length} pickup checkpoints</span>
                          <span>
                            {servicedR}/{rPoints.length} serviced
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: Active Route Details & Checkpoint Sequence */}
            {activeRoute && (
              <div style={{ background: 'var(--bg-card, #1e293b)', border: '1px solid var(--border-light, #334155)', borderRadius: '0.75rem', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #334155', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: '#f8fafc' }}>
                      {activeRoute.name} - Detailed Checkpoints
                    </h3>
                    <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                      {activeRoute.ward} • Assigned Fleet:{' '}
                      {activeRouteVehicles.length > 0
                        ? activeRouteVehicles.map((v) => `${v.registrationNumber} (${v.type})`).join(', ')
                        : 'Standby dispatch'}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowAccessibleTable(!showAccessibleTable)}
                    style={{
                      background: 'none',
                      border: '1px solid #475569',
                      color: '#cbd5e1',
                      borderRadius: '0.4rem',
                      padding: '0.3rem 0.6rem',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    {showAccessibleTable ? 'Show Cards' : 'Show Table Alternative'}
                  </button>
                </div>

                {showAccessibleTable ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', color: '#e2e8f0' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #475569', textAlign: 'left', color: '#94a3b8' }}>
                        <th style={{ padding: '0.5rem' }}>Seq</th>
                        <th style={{ padding: '0.5rem' }}>Address</th>
                        <th style={{ padding: '0.5rem' }}>Type</th>
                        <th style={{ padding: '0.5rem' }}>Est. Load</th>
                        <th style={{ padding: '0.5rem' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeRoutePoints.map((pt, idx) => (
                        <tr key={pt.id} style={{ borderBottom: '1px solid #334155' }}>
                          <td style={{ padding: '0.5rem' }}>#{idx + 1}</td>
                          <td style={{ padding: '0.5rem' }}>{pt.address}</td>
                          <td style={{ padding: '0.5rem' }}>{pt.collectionType}</td>
                          <td style={{ padding: '0.5rem' }}>{pt.estimatedWasteKg || 45} kg</td>
                          <td style={{ padding: '0.5rem' }}>{pt.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {activeRoutePoints.length === 0 ? (
                      <p style={{ color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center', padding: '1rem' }}>
                        No pickup points attached to this route yet.
                      </p>
                    ) : (
                      activeRoutePoints.map((pt, idx) => {
                        const isServiced = pt.status === PickupPointStatus.SERVICED;
                        return (
                          <div
                            key={pt.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              background: 'rgba(15, 23, 42, 0.6)',
                              border: '1px solid #334155',
                              padding: '0.65rem 0.85rem',
                              borderRadius: '0.5rem',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', width: '22px' }}>
                                #{idx + 1}
                              </span>
                              <div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 500, color: '#f8fafc' }}>
                                  {pt.address}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                  {pt.collectionType} • Scheduled: {pt.scheduledTime} • ~{pt.estimatedWasteKg || 45} kg
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => handleTogglePointStatus(pt.id, pt.status)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                background: isServiced ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.15)',
                                color: isServiced ? '#34d399' : '#f87171',
                                border: isServiced ? '1px solid #059669' : '1px solid #b91c1c',
                                padding: '0.35rem 0.65rem',
                                borderRadius: '0.4rem',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              {isServiced ? <Check size={14} /> : <Clock size={14} />}
                              {isServiced ? 'Serviced' : 'Pending'}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ========================================================
          TAB 2: VEHICLE CAPACITY
         ======================================================== */}
      {activeTab === 'vehicles' && (
        <section aria-labelledby="vehicles-heading">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 id="vehicles-heading" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc' }}>
              Municipal Vehicle Fleet & Capacity Allocation
            </h2>
            <button
              onClick={() => setIsVehicleModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'var(--primary, #10b981)',
                color: '#ffffff',
                border: 'none',
                padding: '0.5rem 0.9rem',
                borderRadius: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Plus size={16} />
              Register Vehicle
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {vehicles.map((v) => {
              const capKg = v.capacityKg || 500;
              const loadKg = v.currentLoadKg || 0;
              const pct = Math.min(100, Math.round((loadKg / capKg) * 100));
              const isOverloaded = pct > 85;

              return (
                <div
                  key={v.id}
                  style={{
                    background: 'var(--bg-card, #1e293b)',
                    border: isOverloaded ? '1px solid #ef4444' : '1px solid var(--border-light, #334155)',
                    borderRadius: '0.75rem',
                    padding: '1.25rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc' }}>
                        {v.registrationNumber}
                      </h3>
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'capitalize' }}>
                        Type: {v.type}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '9999px',
                        background: v.status === VehicleStatus.DEPLOYED ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                        color: v.status === VehicleStatus.DEPLOYED ? '#34d399' : '#60a5fa',
                        fontWeight: 600,
                      }}
                    >
                      {v.status}
                    </span>
                  </div>

                  <div style={{ margin: '1rem 0 0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
                      <span>Payload Weight</span>
                      <strong style={{ color: isOverloaded ? '#f87171' : '#f8fafc' }}>
                        {loadKg} / {capKg} kg ({pct}%)
                      </strong>
                    </div>
                    {/* Visual Meter Bar */}
                    <div
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      style={{
                        background: '#334155',
                        height: '8px',
                        borderRadius: '9999px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: isOverloaded ? 'linear-gradient(90deg, #f59e0b, #ef4444)' : '#10b981',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>

                  {isOverloaded && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        color: '#f87171',
                        fontSize: '0.75rem',
                        marginTop: '0.5rem',
                      }}
                    >
                      <AlertTriangle size={14} />
                      <span>Warning: Vehicle load exceeds 85% safety threshold.</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ========================================================
          TAB 3: SEGREGATION AUDITS
         ======================================================== */}
      {activeTab === 'audits' && (
        <section aria-labelledby="audits-heading">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h2 id="audits-heading" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc' }}>
                Sampled Segregation Compliance Audits
              </h2>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
                Audits are signed with append-only cryptographic integrity seals to ensure tamper-proof municipal compliance records.
              </p>
            </div>
            <button
              onClick={() => setIsAuditModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'var(--primary, #10b981)',
                color: '#ffffff',
                border: 'none',
                padding: '0.5rem 0.9rem',
                borderRadius: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Plus size={16} />
              Record Audit
            </button>
          </div>

          <div style={{ background: 'var(--bg-card, #1e293b)', border: '1px solid var(--border-light, #334155)', borderRadius: '0.75rem', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', color: '#e2e8f0' }}>
              <thead>
                <tr style={{ background: 'rgba(15, 23, 42, 0.7)', borderBottom: '1px solid #334155', textAlign: 'left', color: '#94a3b8' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Audit ID</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Ward / Point</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Compliance</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Rating</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Integrity Seal</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Observations</th>
                </tr>
              </thead>
              <tbody>
                {audits.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                      No segregation audits recorded yet.
                    </td>
                  </tr>
                ) : (
                  audits.map((a) => (
                    <tr key={a.id} style={{ borderBottom: '1px solid #334155' }}>
                      <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', color: '#94a3b8' }}>{a.id}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div>{a.ward}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{a.pickupPointId}</div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: a.compliancePercentage >= 70 ? '#34d399' : '#fbbf24' }}>
                        {a.compliancePercentage}%
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '9999px',
                            background: a.rating === 'EXCELLENT' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                            color: a.rating === 'EXCELLENT' ? '#34d399' : '#fbbf24',
                            fontWeight: 600,
                          }}
                        >
                          {a.rating}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <code style={{ fontSize: '0.75rem', background: '#0f172a', padding: '0.2rem 0.4rem', borderRadius: '0.3rem', color: '#38bdf8' }}>
                          {a.integritySeal || 'SEAL-PENDING'}
                        </code>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>{a.issuesNoted || 'No non-compliances noted.'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ========================================================
          TAB 4: AI RECOMMENDATIONS & HUMAN CONTROL
         ======================================================== */}
      {activeTab === 'recommendations' && (
        <section aria-labelledby="recs-heading">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h2 id="recs-heading" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc' }}>
                AI Optimization Recommendations (Bounded & Explainable)
              </h2>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
                Every recommendation surfaces input feature windows, execution timestamps, and requires human supervisor authorization.
              </p>
            </div>
            <button
              onClick={handleRunAiOptimization}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'linear-gradient(135deg, #059669, #0d9488)',
                color: '#ffffff',
                border: 'none',
                padding: '0.5rem 0.9rem',
                borderRadius: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Sparkles size={16} />
              Re-evaluate Routes
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {recommendations.length === 0 ? (
              <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '3rem 2rem', textAlign: 'center', color: '#94a3b8' }}>
                <Sparkles size={36} style={{ margin: '0 auto 0.75rem', color: '#10b981' }} />
                <h3 style={{ margin: '0 0 0.5rem', color: '#f8fafc', fontSize: '1.1rem' }}>All Routes Operating Within Optimal Bounds</h3>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>
                  No vehicle overloads or critical segregation deficits detected for active wards.
                </p>
              </div>
            ) : (
              recommendations.map((rec) => {
                const isProposed = rec.status === RouteRecommendationStatus.PROPOSED;
                return (
                  <div
                    key={rec.id}
                    style={{
                      background: 'var(--bg-card, #1e293b)',
                      border: '1px solid var(--border-light, #334155)',
                      borderRadius: '0.75rem',
                      padding: '1.25rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.55rem',
                            borderRadius: '0.35rem',
                            background:
                              rec.priority === RouteRecommendationPriority.CRITICAL
                                ? 'rgba(239, 68, 68, 0.25)'
                                : rec.priority === RouteRecommendationPriority.HIGH
                                ? 'rgba(245, 158, 11, 0.25)'
                                : 'rgba(59, 130, 246, 0.25)',
                            color:
                              rec.priority === RouteRecommendationPriority.CRITICAL
                                ? '#f87171'
                                : rec.priority === RouteRecommendationPriority.HIGH
                                ? '#fbbf24'
                                : '#60a5fa',
                          }}
                        >
                          {rec.priority}
                        </span>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>
                          {rec.title}
                        </h3>
                      </div>
                      <span
                        style={{
                          fontSize: '0.8rem',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '9999px',
                          background:
                            rec.status === RouteRecommendationStatus.ACCEPTED
                              ? 'rgba(16, 185, 129, 0.2)'
                              : rec.status === RouteRecommendationStatus.REJECTED
                              ? 'rgba(239, 68, 68, 0.2)'
                              : 'rgba(56, 189, 248, 0.2)',
                          color:
                            rec.status === RouteRecommendationStatus.ACCEPTED
                              ? '#34d399'
                              : rec.status === RouteRecommendationStatus.REJECTED
                              ? '#f87171'
                              : '#38bdf8',
                          fontWeight: 600,
                        }}
                      >
                        Status: {rec.status}
                      </span>
                    </div>

                    <p style={{ margin: '0 0 0.75rem', fontSize: '0.92rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                      {rec.explanation}
                    </p>

                    {/* Source Fields Provenance Box */}
                    <div
                      style={{
                        background: 'rgba(15, 23, 42, 0.7)',
                        border: '1px solid #334155',
                        borderRadius: '0.5rem',
                        padding: '0.65rem 0.85rem',
                        marginBottom: '0.85rem',
                        fontSize: '0.8rem',
                        color: '#94a3b8',
                      }}
                    >
                      <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: '0.2rem' }}>
                        Influencing Parameters (Explainability Provenance):
                      </div>
                      <code>{JSON.stringify(rec.sourceFields)}</code>
                      <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: '#64748b' }}>
                        Model Ruleset: {rec.modelVersion} • Evaluated: {new Date(rec.executedAt).toLocaleTimeString()}
                      </div>
                    </div>

                    {/* Human Action Controls */}
                    {isProposed && (
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleAcceptRecommendation(rec.id)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            background: '#10b981',
                            color: '#ffffff',
                            border: 'none',
                            padding: '0.45rem 0.85rem',
                            borderRadius: '0.4rem',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <Check size={14} />
                          Accept Recommendation
                        </button>
                        <button
                          onClick={() => handleOpenRejectModal(rec.id)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#f87171',
                            border: '1px solid #ef4444',
                            padding: '0.45rem 0.85rem',
                            borderRadius: '0.4rem',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                          }}
                        >
                          <X size={14} />
                          Reject with Reason
                        </button>
                      </div>
                    )}

                    {rec.rejectionReason && (
                      <div style={{ fontSize: '0.8rem', color: '#f87171', marginTop: '0.5rem' }}>
                        <strong>Rejection Reason Logged:</strong> {rec.rejectionReason} (by {rec.acceptedBy})
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* ========================================================
          TAB 5: PUBLIC SUMMARY VIEW
         ======================================================== */}
      {activeTab === 'public' && (
        <section aria-labelledby="public-heading">
          <div style={{ marginBottom: '1rem' }}>
            <h2 id="public-heading" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc' }}>
              Public-Facing Municipal Ward Aggregates
            </h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
              This view satisfies the privacy requirement: only approved aggregates are rendered. Vehicle identifiers, driver details, and household observations are masked.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            {routes.map((r) => {
              const pub = getPublicRouteSummary(r.id, getAppStorage());
              if (!pub) return null;
              return (
                <div
                  key={pub.routeId}
                  style={{
                    background: 'var(--bg-card, #1e293b)',
                    border: '1px solid var(--border-light, #334155)',
                    borderRadius: '0.75rem',
                    padding: '1.25rem',
                  }}
                >
                  <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.1rem', color: '#f8fafc' }}>{pub.name}</h3>
                  <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.85rem' }}>
                    {pub.ward} • Regular Hours: {pub.scheduledStartTime} - {pub.scheduledEndTime}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderTop: '1px solid #334155', fontSize: '0.85rem' }}>
                    <span style={{ color: '#94a3b8' }}>Daily Service Coverage:</span>
                    <strong style={{ color: '#34d399' }}>{pub.servicedPercentage}% Completed</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderTop: '1px solid #334155', fontSize: '0.85rem' }}>
                    <span style={{ color: '#94a3b8' }}>Ward Segregation Score:</span>
                    <strong style={{ color: '#38bdf8' }}>
                      {pub.averageWardSegregationScore ? `${pub.averageWardSegregationScore}%` : 'Sufficient Data Pending'}
                    </strong>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ========================================================
          MODALS
         ======================================================== */}
      {/* 1. Create Route Modal */}
      {isRouteModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-route-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '1rem',
          }}
        >
          <div style={{ background: '#1e293b', border: '1px solid #475569', borderRadius: '0.75rem', width: '100%', maxWidth: '480px', padding: '1.5rem' }}>
            <h3 id="create-route-title" style={{ margin: '0 0 1rem', fontSize: '1.2rem', color: '#f8fafc' }}>
              Create Municipal Collection Route
            </h3>
            <form onSubmit={handleCreateRoute}>
              <div style={{ marginBottom: '0.85rem' }}>
                <label htmlFor={nameInputId} style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>
                  Route Name
                </label>
                <input
                  id={nameInputId}
                  required
                  value={newRouteForm.name}
                  onChange={(e) => setNewRouteForm({ ...newRouteForm, name: e.target.value })}
                  placeholder="e.g. Ward 150 South Loop"
                  style={{ width: '100%', padding: '0.5rem', background: '#0f172a', border: '1px solid #475569', borderRadius: '0.4rem', color: '#f8fafc' }}
                />
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label htmlFor={wardInputId} style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>
                  Municipal Ward
                </label>
                <input
                  id={wardInputId}
                  required
                  value={newRouteForm.ward}
                  onChange={(e) => setNewRouteForm({ ...newRouteForm, ward: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', background: '#0f172a', border: '1px solid #475569', borderRadius: '0.4rem', color: '#f8fafc' }}
                />
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label htmlFor={descInputId} style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>
                  Operational Description
                </label>
                <textarea
                  id={descInputId}
                  value={newRouteForm.description}
                  onChange={(e) => setNewRouteForm({ ...newRouteForm, description: e.target.value })}
                  rows={3}
                  placeholder="Notes, depot start coordinates, contact protocols..."
                  style={{ width: '100%', padding: '0.5rem', background: '#0f172a', border: '1px solid #475569', borderRadius: '0.4rem', color: '#f8fafc' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  onClick={() => setIsRouteModalOpen(false)}
                  style={{ background: '#334155', color: '#e2e8f0', border: 'none', padding: '0.5rem 0.9rem', borderRadius: '0.4rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: '#10b981', color: '#ffffff', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.4rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Save Route
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Create Pickup Point Modal */}
      {isPointModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-point-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '1rem',
          }}
        >
          <div style={{ background: '#1e293b', border: '1px solid #475569', borderRadius: '0.75rem', width: '100%', maxWidth: '480px', padding: '1.5rem' }}>
            <h3 id="create-point-title" style={{ margin: '0 0 1rem', fontSize: '1.2rem', color: '#f8fafc' }}>
              Add Waste Pickup Point
            </h3>
            <form onSubmit={handleCreatePoint}>
              <div style={{ marginBottom: '0.85rem' }}>
                <label htmlFor={ptAddressId} style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>
                  Street / Gate Address (No Flat Numbers)
                </label>
                <input
                  id={ptAddressId}
                  required
                  value={newPointForm.address}
                  onChange={(e) => setNewPointForm({ ...newPointForm, address: e.target.value })}
                  placeholder="e.g. 5th Cross Road Corner Stand"
                  style={{ width: '100%', padding: '0.5rem', background: '#0f172a', border: '1px solid #475569', borderRadius: '0.4rem', color: '#f8fafc' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div>
                  <label htmlFor={ptTypeId} style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>
                    Collection Type
                  </label>
                  <select
                    id={ptTypeId}
                    value={newPointForm.collectionType}
                    onChange={(e) => setNewPointForm({ ...newPointForm, collectionType: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', background: '#0f172a', border: '1px solid #475569', borderRadius: '0.4rem', color: '#f8fafc' }}
                  >
                    <option value="door-to-door">Door-to-door</option>
                    <option value="bulk">Bulk generator</option>
                    <option value="street">Street bins</option>
                  </select>
                </div>

                <div>
                  <label htmlFor={ptWasteId} style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>
                    Est. Daily Waste (kg)
                  </label>
                  <input
                    id={ptWasteId}
                    type="number"
                    value={newPointForm.estimatedWasteKg}
                    onChange={(e) => setNewPointForm({ ...newPointForm, estimatedWasteKg: Number(e.target.value) })}
                    style={{ width: '100%', padding: '0.5rem', background: '#0f172a', border: '1px solid #475569', borderRadius: '0.4rem', color: '#f8fafc' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  onClick={() => setIsPointModalOpen(false)}
                  style={{ background: '#334155', color: '#e2e8f0', border: 'none', padding: '0.5rem 0.9rem', borderRadius: '0.4rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: '#10b981', color: '#ffffff', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.4rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Add Point
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Register Vehicle Modal */}
      {isVehicleModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-vehicle-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '1rem',
          }}
        >
          <div style={{ background: '#1e293b', border: '1px solid #475569', borderRadius: '0.75rem', width: '100%', maxWidth: '480px', padding: '1.5rem' }}>
            <h3 id="create-vehicle-title" style={{ margin: '0 0 1rem', fontSize: '1.2rem', color: '#f8fafc' }}>
              Register Sanitation Vehicle
            </h3>
            <form onSubmit={handleCreateVehicle}>
              <div style={{ marginBottom: '0.85rem' }}>
                <label htmlFor={vehRegId} style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>
                  Vehicle Registration Number
                </label>
                <input
                  id={vehRegId}
                  required
                  value={newVehicleForm.registrationNumber}
                  onChange={(e) => setNewVehicleForm({ ...newVehicleForm, registrationNumber: e.target.value })}
                  placeholder="e.g. KA-01-EA-5520"
                  style={{ width: '100%', padding: '0.5rem', background: '#0f172a', border: '1px solid #475569', borderRadius: '0.4rem', color: '#f8fafc' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div>
                  <label htmlFor={vehTypeId} style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>
                    Body Type
                  </label>
                  <select
                    id={vehTypeId}
                    value={newVehicleForm.type}
                    onChange={(e) => setNewVehicleForm({ ...newVehicleForm, type: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', background: '#0f172a', border: '1px solid #475569', borderRadius: '0.4rem', color: '#f8fafc' }}
                  >
                    <option value="tipper">Auto Tipper</option>
                    <option value="compact">Compactor</option>
                    <option value="standard">Standard Truck</option>
                  </select>
                </div>

                <div>
                  <label htmlFor={vehCapId} style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>
                    Payload Limit (kg)
                  </label>
                  <input
                    id={vehCapId}
                    type="number"
                    value={newVehicleForm.capacityKg}
                    onChange={(e) => setNewVehicleForm({ ...newVehicleForm, capacityKg: Number(e.target.value) })}
                    style={{ width: '100%', padding: '0.5rem', background: '#0f172a', border: '1px solid #475569', borderRadius: '0.4rem', color: '#f8fafc' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  onClick={() => setIsVehicleModalOpen(false)}
                  style={{ background: '#334155', color: '#e2e8f0', border: 'none', padding: '0.5rem 0.9rem', borderRadius: '0.4rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: '#10b981', color: '#ffffff', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.4rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Record Audit Modal */}
      {isAuditModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-audit-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '1rem',
          }}
        >
          <div style={{ background: '#1e293b', border: '1px solid #475569', borderRadius: '0.75rem', width: '100%', maxWidth: '480px', padding: '1.5rem' }}>
            <h3 id="create-audit-title" style={{ margin: '0 0 1rem', fontSize: '1.2rem', color: '#f8fafc' }}>
              Record Sampled Segregation Audit
            </h3>
            <form onSubmit={handleCreateAudit}>
              <div style={{ marginBottom: '0.85rem' }}>
                <label htmlFor={auditPointId} style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>
                  Target Pickup Point
                </label>
                <select
                  id={auditPointId}
                  value={newAuditForm.pickupPointId}
                  onChange={(e) => setNewAuditForm({ ...newAuditForm, pickupPointId: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', background: '#0f172a', border: '1px solid #475569', borderRadius: '0.4rem', color: '#f8fafc' }}
                >
                  <option value="">Select point...</option>
                  {pickupPoints.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.ward} - {p.address}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div>
                  <label htmlFor={auditCompId} style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>
                    Compliance Score (%)
                  </label>
                  <input
                    id={auditCompId}
                    type="number"
                    min={0}
                    max={100}
                    value={newAuditForm.compliancePercentage}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const rating =
                        val >= 85
                          ? SegregationAuditRating.EXCELLENT
                          : val >= 70
                          ? SegregationAuditRating.GOOD
                          : val >= 50
                          ? SegregationAuditRating.FAIR
                          : SegregationAuditRating.POOR;
                      setNewAuditForm({ ...newAuditForm, compliancePercentage: val, rating });
                    }}
                    style={{ width: '100%', padding: '0.5rem', background: '#0f172a', border: '1px solid #475569', borderRadius: '0.4rem', color: '#f8fafc' }}
                  />
                </div>

                <div>
                  <label htmlFor={auditRatingId} style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>
                    Rating Grade
                  </label>
                  <input
                    id={auditRatingId}
                    readOnly
                    value={newAuditForm.rating}
                    style={{ width: '100%', padding: '0.5rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '0.4rem', color: '#38bdf8' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label htmlFor={auditNotesId} style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>
                  Audited Issues & Notes (Auto-sanitized)
                </label>
                <textarea
                  id={auditNotesId}
                  value={newAuditForm.issuesNoted}
                  onChange={(e) => setNewAuditForm({ ...newAuditForm, issuesNoted: e.target.value })}
                  placeholder="Record mixed stream observations. Household identifiers will be automatically redacted."
                  rows={3}
                  style={{ width: '100%', padding: '0.5rem', background: '#0f172a', border: '1px solid #475569', borderRadius: '0.4rem', color: '#f8fafc' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  onClick={() => setIsAuditModalOpen(false)}
                  style={{ background: '#334155', color: '#e2e8f0', border: 'none', padding: '0.5rem 0.9rem', borderRadius: '0.4rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: '#10b981', color: '#ffffff', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.4rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Sign & Save Audit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Reject Recommendation Modal */}
      {isRejectModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-rec-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '1rem',
          }}
        >
          <div style={{ background: '#1e293b', border: '1px solid #ef4444', borderRadius: '0.75rem', width: '100%', maxWidth: '440px', padding: '1.5rem' }}>
            <h3 id="reject-rec-title" style={{ margin: '0 0 0.5rem', fontSize: '1.15rem', color: '#f87171' }}>
              Override AI Recommendation
            </h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#94a3b8' }}>
              Sanitation policy mandates that supervisor overrides include a recorded operational reason.
            </p>
            <form onSubmit={handleConfirmReject}>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor={rejectReasonId} style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>
                  Reason for Overriding Recommendation
                </label>
                <textarea
                  id={rejectReasonId}
                  required
                  value={rejectionReasonText}
                  onChange={(e) => setRejectionReasonText(e.target.value)}
                  placeholder="e.g. Additional tipper already deployed from central depot..."
                  rows={3}
                  style={{ width: '100%', padding: '0.5rem', background: '#0f172a', border: '1px solid #475569', borderRadius: '0.4rem', color: '#f8fafc' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(false)}
                  style={{ background: '#334155', color: '#e2e8f0', border: 'none', padding: '0.5rem 0.9rem', borderRadius: '0.4rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: '#ef4444', color: '#ffffff', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.4rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
