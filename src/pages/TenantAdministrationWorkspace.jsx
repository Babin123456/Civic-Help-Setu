/**
 * src/pages/TenantAdministrationWorkspace.jsx
 * Multi-Authority Civic Administration Workspace (#779).
 *
 * Implements sovereign tenant workspace switching, role-scoped dataset triage,
 * cross-tenant sanitized catalogue publication, bounded explainable AI insights,
 * and tamper-evident cryptographic audit verification.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Building2,
  Users,
  Database,
  Globe2,
  History,
  Settings,
  Search,
  Plus,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Lock,
  ChevronRight,
  AlertCircle,
  X,
  Sparkles,
  Wifi,
  WifiOff,
  Edit3,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { logDiagnostic } from '../utils/diagnostics';
import {
  initializeTenantStorage,
  listAccessibleTenants,
  getTenantDetails,
  getActiveTenantContext,
  setActiveTenantContext,
  listTenantMembers,
  addTenantMember,
  updateMemberRole,
  revokeTenantMember,
  getTenantSettings,
  updateTenantSettings,
  listTenantDataset,
  createTenantDatasetRecord,
  deleteTenantDatasetRecord,
  submitRecordForPublication,
  approveRecordPublication,
  retractRecordPublication,
  listSharedPublicCatalogue,
  evaluateTenantRecommendations,
  resolveRecommendation,
  getTenantAuditTrail,
  verifyAuditChainIntegrity,
  getRawStorage,
  STORAGE_KEYS,
  TENANT_ROLES,
} from '../services/tenantIsolationService';

export default function TenantAdministrationWorkspace() {
  const { user } = useAuth();

  // Resolve actor (falls back to default admin for unauthenticated or local development)
  const currentActor = useMemo(() => {
    if (user && user.id) {
      return { id: user.id, email: user.email || `${user.id}@civic.gov.in` };
    }
    return { id: 'default_admin', email: 'admin@bmc.gov.in' };
  }, [user]);

  // Initial Data Bootstrap (runs synchronously on initial render and SSR)
  const initialAccessible = useMemo(() => {
    initializeTenantStorage(false);
    return listAccessibleTenants(currentActor);
  }, [currentActor]);

  const initialTenantId = useMemo(() => {
    const saved = getActiveTenantContext();
    if (initialAccessible.some((t) => t.id === saved)) return saved;
    return initialAccessible[0]?.id || 'tenant-bmc';
  }, [initialAccessible]);

  const [activeTenantId, setActiveTenantId] = useState(initialTenantId);
  const [activeTab, setActiveTab] = useState('overview'); // overview, staff, dataset, catalogue, ai_assistant, audit, settings
  const [accessibleTenants, setAccessibleTenants] = useState(initialAccessible);
  const [tenantDetails, setTenantDetails] = useState(() => {
    if (initialAccessible.length === 0) return null;
    try {
      return getTenantDetails(currentActor, initialTenantId);
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);

  // Data Collections for Active Tenant
  const [staffMembers, setStaffMembers] = useState(() => {
    if (initialAccessible.length === 0) return [];
    try {
      return listTenantMembers(currentActor, initialTenantId);
    } catch {
      return [];
    }
  });
  const [datasetRecords, setDatasetRecords] = useState(() => {
    if (initialAccessible.length === 0) return [];
    try {
      return listTenantDataset(currentActor, initialTenantId);
    } catch {
      return [];
    }
  });
  const [sharedCatalogue, setSharedCatalogue] = useState(() => {
    try {
      return listSharedPublicCatalogue();
    } catch {
      return [];
    }
  });
  const [recommendations, setRecommendations] = useState(() => {
    if (initialAccessible.length === 0) return [];
    try {
      return evaluateTenantRecommendations(currentActor, initialTenantId);
    } catch {
      return [];
    }
  });
  const [auditTrail, setAuditTrail] = useState(() => {
    if (initialAccessible.length === 0) return [];
    try {
      return getTenantAuditTrail(currentActor, initialTenantId);
    } catch {
      return [];
    }
  });
  const [tenantSettings, setTenantSettings] = useState(() => {
    if (initialAccessible.length === 0) return null;
    try {
      return getTenantSettings(currentActor, initialTenantId);
    } catch {
      return null;
    }
  });
  const [auditIntegrity, setAuditIntegrity] = useState(() => {
    try {
      return verifyAuditChainIntegrity(initialTenantId);
    } catch {
      return null;
    }
  });

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals & Interactivity
  const [showAddRecordModal, setShowAddRecordModal] = useState(false);
  const [newRecordForm, setNewRecordForm] = useState({
    title: '',
    category: 'water_services',
    wardCode: 'Ward A',
    priority: 'routine',
    assignedOfficer: '',
    privateNotes: '',
  });

  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaffForm, setNewStaffForm] = useState({
    userEmail: '',
    userName: '',
    role: TENANT_ROLES.OPERATOR,
    assignedWards: 'Ward A',
  });

  const { isOnline = true } = useNetwork();
  const [publicationReasonModal, setPublicationReasonModal] = useState(null);
  const [retractionReasonText, setRetractionReasonText] = useState('');
  const [editingRecommendation, setEditingRecommendation] = useState(null);
  const [editedPayload, setEditedPayload] = useState({ priority: 'urgent', reason: '' });

  // -------------------------------------------------------------------------
  // Lifecycle & Data Fetching
  // -------------------------------------------------------------------------
  const reloadWorkspaceData = useCallback(() => {
    try {
      setLoading(true);
      setErrorMessage(null);
      initializeTenantStorage(false);

      const accessible = listAccessibleTenants(currentActor);
      setAccessibleTenants(accessible);

      if (accessible.length === 0) {
        setTenantDetails(null);
        setLoading(false);
        return;
      }

      // Check if active tenant is in accessible list; otherwise fallback to first
      let resolvedTenantId = activeTenantId;
      if (!accessible.some((t) => t.id === resolvedTenantId)) {
        resolvedTenantId = accessible[0].id;
        setActiveTenantId(resolvedTenantId);
        setActiveTenantContext(resolvedTenantId);
      }

      const details = getTenantDetails(currentActor, resolvedTenantId);
      setTenantDetails(details);

      // Load tenant-scoped collections
      const members = listTenantMembers(currentActor, resolvedTenantId);
      setStaffMembers(members);

      const records = listTenantDataset(currentActor, resolvedTenantId, {
        category: categoryFilter,
        status: statusFilter,
        search: searchQuery,
      });
      setDatasetRecords(records);

      const catalogue = listSharedPublicCatalogue();
      setSharedCatalogue(catalogue);

      const recs = evaluateTenantRecommendations(currentActor, resolvedTenantId);
      setRecommendations(recs);

      const audit = getTenantAuditTrail(currentActor, resolvedTenantId);
      setAuditTrail(audit);

      const settings = getTenantSettings(currentActor, resolvedTenantId);
      setTenantSettings(settings);

      const integrity = verifyAuditChainIntegrity(resolvedTenantId);
      setAuditIntegrity(integrity);
    } catch (err) {
      logDiagnostic('Failed to load authority workspace:', err);
      setErrorMessage(err.message || 'Error initializing authority workspace');
    } finally {
      setLoading(false);
    }
  }, [currentActor, activeTenantId, categoryFilter, statusFilter, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      reloadWorkspaceData();
    }, 0);
    return () => clearTimeout(timer);
  }, [reloadWorkspaceData]);

  const pendingPublications = useMemo(() => {
    try {
      const allCatalogue = getRawStorage(STORAGE_KEYS.SHARED_CATALOGUE, []);
      return allCatalogue.filter(
        (c) => c.originTenantId === activeTenantId && c.publicationStatus === 'pending_approval'
      );
    } catch {
      return [];
    }
  }, [activeTenantId]);

  // Switch Active Tenant
  const handleTenantSwitch = (newId) => {
    setActiveTenantId(newId);
    setActiveTenantContext(newId);
    setSuccessBanner(`Switched authority context to ${newId}`);
    setTimeout(() => setSuccessBanner(null), 3500);
  };

  // -------------------------------------------------------------------------
  // Actions: Operational Records
  // -------------------------------------------------------------------------
  const handleCreateRecord = (e) => {
    e.preventDefault();
    try {
      createTenantDatasetRecord(currentActor, activeTenantId, newRecordForm);
      setShowAddRecordModal(false);
      setNewRecordForm({
        title: '',
        category: 'water_services',
        wardCode: 'Ward A',
        priority: 'routine',
        assignedOfficer: '',
        privateNotes: '',
      });
      setSuccessBanner('New authority operational record created successfully.');
      setTimeout(() => setSuccessBanner(null), 3500);
      reloadWorkspaceData();
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const handleDeleteRecord = (recordId) => {
    if (window.confirm('Are you sure you want to delete this authority record?')) {
      try {
        deleteTenantDatasetRecord(currentActor, activeTenantId, recordId, 'Administrative removal');
        setSuccessBanner('Operational record deleted and logged in audit trail.');
        setTimeout(() => setSuccessBanner(null), 3500);
        reloadWorkspaceData();
      } catch (err) {
        setErrorMessage(err.message);
      }
    }
  };

  // -------------------------------------------------------------------------
  // Actions: Catalogue Publication
  // -------------------------------------------------------------------------
  const handleSubmitToCatalogue = (recordId) => {
    try {
      submitRecordForPublication(currentActor, activeTenantId, recordId);
      setSuccessBanner('Record submitted for catalogue review with PII and private notes redacted.');
      setTimeout(() => setSuccessBanner(null), 3500);
      reloadWorkspaceData();
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const handleApprovePublication = (catalogueId) => {
    try {
      approveRecordPublication(currentActor, activeTenantId, catalogueId);
      setSuccessBanner('Record successfully published to State Open Catalogue.');
      setTimeout(() => setSuccessBanner(null), 3500);
      reloadWorkspaceData();
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const handleRetractPublication = (catalogueId) => {
    if (!retractionReasonText.trim()) {
      alert('Please enter a justification reason for retracting this published catalogue guide.');
      return;
    }
    try {
      retractRecordPublication(currentActor, activeTenantId, catalogueId, retractionReasonText);
      setPublicationReasonModal(null);
      setRetractionReasonText('');
      setSuccessBanner('Catalogue guide retracted from public view.');
      setTimeout(() => setSuccessBanner(null), 3500);
      reloadWorkspaceData();
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  // -------------------------------------------------------------------------
  // Actions: Staff RBAC
  // -------------------------------------------------------------------------
  const handleAddStaff = (e) => {
    e.preventDefault();
    try {
      addTenantMember(currentActor, activeTenantId, {
        userEmail: newStaffForm.userEmail,
        userName: newStaffForm.userName,
        role: newStaffForm.role,
        jurisdictionScope: { wards: [newStaffForm.assignedWards], zones: [] },
      });
      setShowAddStaffModal(false);
      setNewStaffForm({
        userEmail: '',
        userName: '',
        role: TENANT_ROLES.OPERATOR,
        assignedWards: 'Ward A',
      });
      setSuccessBanner('New staff member onboarded to authority workspace.');
      setTimeout(() => setSuccessBanner(null), 3500);
      reloadWorkspaceData();
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const handleRoleChange = (memberId, newRole) => {
    try {
      updateMemberRole(currentActor, activeTenantId, memberId, newRole, 'Authority role promotion');
      setSuccessBanner('Staff role updated and audit recorded.');
      setTimeout(() => setSuccessBanner(null), 3500);
      reloadWorkspaceData();
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const handleRevokeStaff = (memberId) => {
    if (window.confirm('Revoke this staff member from accessing this authority workspace?')) {
      try {
        revokeTenantMember(currentActor, activeTenantId, memberId, 'Staff departure');
        setSuccessBanner('Staff member access revoked.');
        setTimeout(() => setSuccessBanner(null), 3500);
        reloadWorkspaceData();
      } catch (err) {
        setErrorMessage(err.message);
      }
    }
  };

  // -------------------------------------------------------------------------
  // Actions: Explainable AI Recommendations
  // -------------------------------------------------------------------------
  const handleRecommendationAction = (recId, decision) => {
    try {
      resolveRecommendation(
        currentActor,
        activeTenantId,
        recId,
        decision,
        null,
        `Staff confirmed decision: ${decision}`
      );
      setSuccessBanner(`Recommendation marked as ${decision}.`);
      setTimeout(() => setSuccessBanner(null), 3500);
      reloadWorkspaceData();
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  // -------------------------------------------------------------------------
  // Render: Permission Denied View
  // -------------------------------------------------------------------------
  if (!loading && accessibleTenants.length === 0) {
    return (
      <div className="container" style={{ padding: '3rem 1rem', maxWidth: '800px', margin: '0 auto' }}>
        <div
          role="alert"
          style={{
            padding: '2rem',
            borderRadius: '1rem',
            background: 'var(--bg-card, #ffffff)',
            border: '2px solid #ef4444',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            textAlign: 'center',
          }}
        >
          <ShieldAlert size={48} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
            Authority Workspace Access Restricted
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.5' }}>
            Your account (<code>{currentActor.email}</code>) is not registered as an authorized staff
            member, operator, or administrator in any sovereign municipal or district authority workspace.
          </p>
          <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '0.5rem', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            <strong>Statutory Tenancy Notice:</strong> In accordance with civic administration rules, municipal datasets,
            staff rosters, and triage queues are strictly segregated. Please contact your State IT Nodal
            Officer or Municipal Commissioner to request an invitation.
          </div>
          <a
            href="/"
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            Return to Citizen Home
          </a>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Main Workspace Render
  // -------------------------------------------------------------------------
  return (
    <div className="container" style={{ padding: '2rem 1rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Top Banner / Breadcrumbs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
            <span>Civic Help Setu</span>
            <ChevronRight size={14} />
            <span>Multi-Authority Administration</span>
            <ChevronRight size={14} />
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{tenantDetails?.name || 'Loading...'}</span>
          </div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            Multi-Authority Administration Workspace
          </h1>
        </div>

        {/* Authority Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--bg-card)', padding: '0.5rem 1rem', borderRadius: '0.75rem', border: '1px solid var(--border-light, #e2e8f0)' }}>
          <Building2 size={20} color="var(--primary)" />
          <div>
            <label htmlFor="authority-select" style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Active Sovereign Authority
            </label>
            <select
              id="authority-select"
              aria-label="Active Sovereign Authority"
              value={activeTenantId}
              onChange={(e) => handleTenantSwitch(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                fontWeight: 700,
                color: 'var(--text-primary)',
                fontSize: '0.95rem',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {accessibleTenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.jurisdictionCode})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Authority Context Pill / Badge Bar */}
      {tenantDetails && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-card, #ffffff)',
            padding: '1rem 1.5rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-light, #e2e8f0)',
            marginBottom: '1.5rem',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.25rem 0.75rem',
                borderRadius: '999px',
                background: isOnline ? 'rgba(34, 197, 94, 0.12)' : 'rgba(234, 179, 8, 0.12)',
                color: isOnline ? '#16a34a' : '#ca8a04',
                fontSize: '0.8rem',
                fontWeight: 700,
              }}
            >
              {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />} {isOnline ? 'Online (Synchronized)' : 'Offline (Local Partition)'}
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.25rem 0.75rem',
                borderRadius: '999px',
                background: 'rgba(34, 197, 94, 0.12)',
                color: '#16a34a',
                fontSize: '0.8rem',
                fontWeight: 700,
              }}
            >
              <ShieldCheck size={14} /> Active Workspace: {tenantDetails.jurisdictionCode}
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.25rem 0.75rem',
                borderRadius: '999px',
                background: 'rgba(59, 130, 246, 0.12)',
                color: '#2563eb',
                fontSize: '0.8rem',
                fontWeight: 700,
              }}
            >
              <Users size={14} /> Role: {tenantDetails.activeRole?.toUpperCase()}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Jurisdiction: <strong>{tenantDetails.district}, {tenantDetails.state}</strong>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={reloadWorkspaceData}
              className="btn btn-secondary"
              title="Refresh Workspace State"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>
      )}

      {/* Offline Alert Banner */}
      {!isOnline && (
        <div
          role="status"
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            background: 'rgba(234, 179, 8, 0.12)',
            border: '1px solid #eab308',
            color: '#854d0e',
            marginBottom: '1rem',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <WifiOff size={16} />
          <span>
            <strong>Offline Mode:</strong> Mutations and triage updates are safely staged in the authority local storage and will sync upon reconnection.
          </span>
        </div>
      )}

      {/* Success / Error Alerts */}
      {successBanner && (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid #22c55e',
            color: '#15803d',
            marginBottom: '1rem',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <CheckCircle size={16} /> {successBanner}
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid #ef4444',
            color: '#b91c1c',
            marginBottom: '1rem',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <AlertCircle size={16} /> {errorMessage}
          <button
            onClick={() => setErrorMessage(null)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Workspace Tabs */}
      <div
        role="tablist"
        aria-label="Authority Workspace Sections"
        style={{
          display: 'flex',
          borderBottom: '2px solid var(--border-light, #e2e8f0)',
          marginBottom: '1.5rem',
          overflowX: 'auto',
          gap: '0.5rem',
        }}
      >
        {[
          { key: 'overview', label: 'Overview', icon: Building2 },
          { key: 'staff', label: 'Staff & Roles', icon: Users, count: staffMembers.length },
          { key: 'dataset', label: 'Authority Datasets', icon: Database, count: datasetRecords.length },
          { key: 'catalogue', label: 'Public Catalogue', icon: Globe2 },
          { key: 'ai_assistant', label: 'Bounded AI Advisor', icon: Sparkles, count: recommendations.length },
          { key: 'audit', label: 'Tamper-Evident Audit', icon: History, count: auditTrail.length },
          { key: 'settings', label: 'Authority Settings', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.25rem',
                border: 'none',
                background: 'transparent',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--primary, #0284c7)' : 'var(--text-secondary)',
                borderBottom: isActive ? '3px solid var(--primary, #0284c7)' : '3px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontSize: '0.9rem',
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  style={{
                    background: isActive ? 'var(--primary, #0284c7)' : 'rgba(0,0,0,0.06)',
                    color: isActive ? '#ffffff' : 'var(--text-secondary)',
                    borderRadius: '999px',
                    padding: '0.1rem 0.5rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div>
          {/* Key Metrics Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            <div style={{ background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Active Staff</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.25rem 0' }}>{staffMembers.length}</div>
              <div style={{ fontSize: '0.8rem', color: '#16a34a' }}>● Scoped by ward jurisdictions</div>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Operational Datasets</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.25rem 0' }}>{datasetRecords.length}</div>
              <div style={{ fontSize: '0.8rem', color: '#2563eb' }}>● Isolated sovereign partition</div>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Audit Trail Entries</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.25rem 0' }}>{auditTrail.length}</div>
              <div style={{ fontSize: '0.8rem', color: auditIntegrity?.valid ? '#16a34a' : '#ef4444' }}>
                {auditIntegrity?.valid ? '✓ SHA-256 Chain Verified' : '⚠ Tamper Warning'}
              </div>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Pending AI Insights</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.25rem 0' }}>{recommendations.length}</div>
              <div style={{ fontSize: '0.8rem', color: '#8b5cf6' }}>● Local in-tenant heuristic analysis</div>
            </div>
          </div>

          {/* Emergency Notice Banner */}
          {tenantSettings?.emergencyNotice && (
            <div
              style={{
                padding: '1rem 1.25rem',
                borderRadius: '0.75rem',
                background: 'rgba(234, 179, 8, 0.1)',
                border: '1px solid #eab308',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <AlertTriangle size={20} color="#ca8a04" />
              <div>
                <strong style={{ color: '#854d0e', display: 'block', fontSize: '0.9rem' }}>Official Authority Broadcast</strong>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{tenantSettings.emergencyNotice}</span>
              </div>
            </div>
          )}

          {/* Quick Operations Guide */}
          <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              Multi-Authority Isolation Invariants
            </h2>
            <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '0.9rem', margin: 0 }}>
              <li><strong>Zero Cross-Tenant Leakage:</strong> Your operations, notes, and staff assignments in <code>{tenantDetails?.name}</code> are invisible to administrators of other authorities.</li>
              <li><strong>Anti-IDOR Protection:</strong> Every dataset record and audit entry requires strict compound verification (<code>tenantId == activeTenantId AND id == targetId</code>).</li>
              <li><strong>Controlled Public Catalogue:</strong> Internal operational procedures can be shared to the open citizen catalogue only after passing PII redaction and dual sign-off.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Tab 2: Staff & Access Control */}
      {activeTab === 'staff' && (
        <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', margin: 0, color: 'var(--text-primary)' }}>Authority Staff & Access Control</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
                Manage roles and jurisdiction ward assignments within {tenantDetails?.name}.
              </p>
            </div>
            {tenantDetails?.activeRole === TENANT_ROLES.ADMIN && (
              <button
                onClick={() => setShowAddStaffModal(true)}
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
              >
                <Plus size={16} /> Onboard Staff Member
              </button>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Staff Member</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Authority Role</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Assigned Wards</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Status</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staffMembers.map((member) => (
                  <tr key={member.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{member.userName}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{member.userEmail}</div>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      {tenantDetails?.activeRole === TENANT_ROLES.ADMIN && member.userId !== currentActor.id ? (
                        <select
                          aria-label={`Role for ${member.userName}`}
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.id, e.target.value)}
                          style={{
                            padding: '0.3rem 0.6rem',
                            borderRadius: '0.35rem',
                            border: '1px solid var(--border-light)',
                            background: 'var(--bg-card)',
                            color: 'var(--text-primary)',
                            fontSize: '0.85rem',
                          }}
                        >
                          <option value={TENANT_ROLES.ADMIN}>Tenant Admin</option>
                          <option value={TENANT_ROLES.OPERATOR}>Tenant Operator</option>
                          <option value={TENANT_ROLES.REVIEWER}>Tenant Reviewer</option>
                          <option value={TENANT_ROLES.AUDITOR}>Tenant Auditor</option>
                        </select>
                      ) : (
                        <span
                          style={{
                            padding: '0.2rem 0.6rem',
                            borderRadius: '999px',
                            background: 'rgba(59, 130, 246, 0.1)',
                            color: '#2563eb',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                          }}
                        >
                          {member.role}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {member.jurisdictionScope?.wards?.join(', ') || 'All Authority Wards'}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <span
                        style={{
                          padding: '0.2rem 0.6rem',
                          borderRadius: '999px',
                          background: member.status === 'active' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: member.status === 'active' ? '#16a34a' : '#ef4444',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                        }}
                      >
                        {member.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                      {tenantDetails?.activeRole === TENANT_ROLES.ADMIN && member.userId !== currentActor.id && member.status === 'active' && (
                        <button
                          onClick={() => handleRevokeStaff(member.id)}
                          className="btn btn-secondary"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: '#ef4444' }}
                          title="Revoke access"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Authority Datasets */}
      {activeTab === 'dataset' && (
        <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', margin: 0, color: 'var(--text-primary)' }}>Authority Operational Datasets</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
                Sovereign operational records, tickets, and maintenance tasks partitioned exclusively for {tenantDetails?.name}.
              </p>
            </div>
            <button
              onClick={() => setShowAddRecordModal(true)}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
            >
              <Plus size={16} /> New Operational Record
            </button>
          </div>

          {/* Search & Filter Toolbar */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: '240px', background: 'rgba(0,0,0,0.03)', borderRadius: '0.5rem', padding: '0 0.75rem', border: '1px solid var(--border-light)' }}>
              <Search size={16} color="var(--text-secondary)" />
              <input
                type="text"
                placeholder="Search operational records..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ border: 'none', background: 'transparent', padding: '0.5rem', width: '100%', outline: 'none', color: 'var(--text-primary)' }}
              />
            </div>

            <select
              aria-label="Filter by Category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
            >
              <option value="all">All Categories</option>
              <option value="water_services">Water Services</option>
              <option value="infrastructure">Infrastructure</option>
              <option value="lake_conservation">Lake Conservation</option>
              <option value="tree_pruning">Tree Pruning</option>
            </select>

            <select
              aria-label="Filter by Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          {/* Records Table */}
          {datasetRecords.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
              <Database size={40} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
              <div style={{ fontWeight: 600 }}>No operational records found</div>
              <div style={{ fontSize: '0.85rem' }}>Try clearing filters or add a new record to this authority.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Title & Ward</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Category</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Priority</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Status</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Private Notes</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {datasetRecords.map((record) => (
                    <tr key={record.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{record.title}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          Ward: <strong>{record.wardCode}</strong> | SLA: {new Date(record.slaTargetDate).toLocaleDateString()}
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{record.category}</span>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <span
                          style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '0.25rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: record.priority === 'urgent' || record.priority === 'emergency' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(0,0,0,0.06)',
                            color: record.priority === 'urgent' || record.priority === 'emergency' ? '#ef4444' : 'var(--text-secondary)',
                          }}
                        >
                          {record.priority?.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <span
                          style={{
                            padding: '0.2rem 0.6rem',
                            borderRadius: '999px',
                            background: record.status === 'resolved' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(234, 179, 8, 0.1)',
                            color: record.status === 'resolved' ? '#16a34a' : '#ca8a04',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                          }}
                        >
                          {record.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '200px' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <Lock size={12} style={{ display: 'inline', marginRight: '0.25rem' }} />
                          {record.privateNotes || 'None'}
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                          <button
                            onClick={() => handleSubmitToCatalogue(record.id)}
                            className="btn btn-secondary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                            title="Redact and submit to State Open Catalogue"
                          >
                            <Globe2 size={13} style={{ display: 'inline', marginRight: '0.25rem' }} /> Share Publicly
                          </button>
                          {tenantDetails?.activeRole === TENANT_ROLES.ADMIN && (
                            <button
                              onClick={() => handleDeleteRecord(record.id)}
                              className="btn btn-secondary"
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: '#ef4444' }}
                              title="Delete record"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Public Catalogue Exchange */}
      {activeTab === 'catalogue' && (
        <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.2rem', margin: 0, color: 'var(--text-primary)' }}>Cross-Tenant Public Catalogue Exchange</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
              Controlled publication gate: Internal procedures shared to the open catalogue undergo automated PII redaction and explicit review.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {/* Published Public Records */}
            <div>
              <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Globe2 size={18} color="#16a34a" /> Live Published Catalogue Guides
              </h3>

              {pendingPublications.length > 0 && (
                <div style={{ marginBottom: '1rem', padding: '1rem', background: 'rgba(234, 179, 8, 0.08)', borderRadius: '0.5rem', border: '1px solid #eab308' }}>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: '#854d0e', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <AlertTriangle size={15} /> Submissions Awaiting Approval ({pendingPublications.length})
                  </h4>
                  {pendingPublications.map((pending) => (
                    <div key={pending.id} style={{ background: 'var(--bg-card)', padding: '0.75rem', borderRadius: '0.35rem', border: '1px solid var(--border-light)', marginBottom: '0.5rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{pending.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0.5rem' }}>
                        Redacted fields: {pending.redactionManifest?.redactedFields?.join(', ')}
                      </div>
                      <button
                        onClick={() => handleApprovePublication(pending.id)}
                        className="btn btn-primary"
                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                      >
                        Approve Publication
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {sharedCatalogue.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', border: '1px dashed var(--border-light)', borderRadius: '0.5rem', color: 'var(--text-secondary)' }}>
                  No published catalogue guides yet.
                </div>
              ) : (
                sharedCatalogue.map((guide) => (
                  <div
                    key={guide.id}
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-light)',
                      borderRadius: '0.5rem',
                      padding: '1rem',
                      marginBottom: '0.75rem',
                    }}
                  >
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{guide.title}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                      Origin: <strong>{guide.originTenantId}</strong> | Approved by: {guide.approvedBy}
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem' }}>
                      {guide.publicData?.proceduralGuidance || guide.summary}
                    </p>
                    <div style={{ fontSize: '0.75rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <CheckCircle size={14} /> PII Redacted: {guide.redactionManifest?.redactedFields?.join(', ')}
                    </div>
                    {guide.originTenantId === activeTenantId && (
                      <div style={{ marginTop: '0.75rem', textAlign: 'right' }}>
                        <button
                          onClick={() => setPublicationReasonModal({ catalogueId: guide.id, title: guide.title })}
                          className="btn btn-secondary"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: '#ef4444' }}
                        >
                          Retract from Public View
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Redaction Guarantee Card */}
            <div>
              <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={18} color="#2563eb" /> Automated Redaction Safeguards
              </h3>
              <div
                style={{
                  background: 'rgba(59, 130, 246, 0.05)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  fontSize: '0.85rem',
                  lineHeight: '1.6',
                  color: 'var(--text-secondary)',
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  Statutory Non-Disclosure Rules:
                </div>
                <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
                  <li>Private officer notes and internal engineer contacts are completely stripped before catalogue serialization.</li>
                  <li>Heuristic regex scans detect and block unredacted 12-digit Aadhaar, 10-character PAN, or phone numbers.</li>
                  <li>Every publication and retraction produces an immutable audit event recording the officer ID and timestamp.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Bounded AI Assistant */}
      {activeTab === 'ai_assistant' && (
        <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.2rem', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={20} color="#8b5cf6" /> Bounded Explainable AI Advisor
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
              Isolated in-tenant heuristics analyzing SLA risks, triage anomalies, and standardization opportunities strictly within {tenantDetails?.name}.
            </p>
          </div>

          {recommendations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
              <CheckCircle size={40} color="#16a34a" style={{ opacity: 0.8, marginBottom: '0.5rem' }} />
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>All Operational Records Within Statutory SLA</div>
              <div style={{ fontSize: '0.85rem' }}>No pending SLA breaches or bottleneck risks detected in this authority.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {recommendations.map((rec) => (
                <div
                  key={rec.id}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '0.5rem',
                    padding: '1.25rem',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span
                      style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '999px',
                        background: rec.recommendationType === 'SLA_BREACH_RISK' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(139, 92, 246, 0.12)',
                        color: rec.recommendationType === 'SLA_BREACH_RISK' ? '#ef4444' : '#8b5cf6',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                      }}
                    >
                      {rec.recommendationType}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Ruleset: <code>{rec.rulesetVersion}</code> | Confidence: {(rec.confidenceScore * 100).toFixed(0)}%
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>
                    {rec.targetTitle}
                  </h3>

                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem', lineHeight: '1.5' }}>
                    {rec.reasoning.explanationSummary}
                  </p>

                  {/* Factor Transparency */}
                  <div style={{ background: 'rgba(0,0,0,0.03)', padding: '0.75rem', borderRadius: '0.35rem', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                      Explainability Factors:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {rec.reasoning.influencingFactors.map((factor, idx) => (
                        <span
                          key={idx}
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.2rem 0.5rem',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-light)',
                            borderRadius: '0.25rem',
                            color: 'var(--text-primary)',
                          }}
                        >
                          <strong>{factor.field}</strong>: {String(factor.value)} (weight: {factor.weight})
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Human-in-the-Loop Actions */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleRecommendationAction(rec.id, 'rejected')}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', color: '#ef4444' }}
                    >
                      Dismiss / Reject
                    </button>
                    <button
                      onClick={() => {
                        setEditingRecommendation(rec);
                        setEditedPayload({
                          priority: rec.suggestedAction?.payload?.priority || 'urgent',
                          reason: '',
                        });
                      }}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      <Edit3 size={13} /> Edit Parameters
                    </button>
                    <button
                      onClick={() => handleRecommendationAction(rec.id, 'accepted')}
                      className="btn btn-primary"
                      style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                    >
                      Accept Recommendation
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 6: Tamper-Evident Audit Trail */}
      {activeTab === 'audit' && (
        <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', margin: 0, color: 'var(--text-primary)' }}>Cryptographic Audit Trail</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
                Append-only SHA-256 hash-chained event logs ensuring administrative non-repudiation.
              </p>
            </div>

            {auditIntegrity && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.4rem 0.8rem',
                  borderRadius: '999px',
                  background: auditIntegrity.valid ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  color: auditIntegrity.valid ? '#16a34a' : '#ef4444',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                }}
              >
                {auditIntegrity.valid ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
                <span>
                  {auditIntegrity.valid
                    ? `Chain Valid (${auditIntegrity.totalEntries} Blocks)`
                    : `Tamper Detected at block ${auditIntegrity.tamperedIndex}`}
                </span>
              </div>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Timestamp</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Action</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Actor</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Target Resource</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Reason</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>SHA-256 Seal</th>
                </tr>
              </thead>
              <tbody>
                {auditTrail.map((event) => (
                  <tr key={event.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {new Date(event.timestamp).toLocaleString()}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {event.action}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <code>{event.actorId}</code>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>
                      {event.targetResource} ({event.targetId})
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>
                      {event.reason}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      <span title={event.entryHash}>{event.entryHash.slice(0, 12)}...</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 7: Authority Settings */}
      {activeTab === 'settings' && tenantSettings && (
        <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
            Authority Configuration & Statutory Policies
          </h2>

          <div style={{ maxWidth: '600px', display: 'grid', gap: '1rem' }}>
            <div>
              <label htmlFor="helpline-input" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                Citizen Emergency Helpline:
              </label>
              <input
                id="helpline-input"
                type="text"
                value={tenantSettings.contactHelpline || ''}
                onChange={(e) =>
                  setTenantSettings({ ...tenantSettings, contactHelpline: e.target.value })
                }
                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.35rem', border: '1px solid var(--border-light)' }}
              />
            </div>

            <div>
              <label htmlFor="notice-input" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                Authority Emergency Broadcast Notice:
              </label>
              <textarea
                id="notice-input"
                rows={3}
                value={tenantSettings.emergencyNotice || ''}
                onChange={(e) =>
                  setTenantSettings({ ...tenantSettings, emergencyNotice: e.target.value })
                }
                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.35rem', border: '1px solid var(--border-light)' }}
              />
            </div>

            <div>
              <label htmlFor="retention-input" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                Operational Data Retention Period (Days):
              </label>
              <input
                id="retention-input"
                type="number"
                value={tenantSettings.retentionDays || 180}
                onChange={(e) =>
                  setTenantSettings({ ...tenantSettings, retentionDays: parseInt(e.target.value, 10) })
                }
                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.35rem', border: '1px solid var(--border-light)' }}
              />
            </div>

            {tenantDetails?.activeRole === TENANT_ROLES.ADMIN && (
              <button
                onClick={() => {
                  updateTenantSettings(currentActor, activeTenantId, tenantSettings, 'Policy update');
                  setSuccessBanner('Authority configuration updated successfully.');
                  setTimeout(() => setSuccessBanner(null), 3500);
                }}
                className="btn btn-primary"
                style={{ marginTop: '0.5rem' }}
              >
                Save Authority Settings
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modal: New Record */}
      {showAddRecordModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-record-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: 'var(--bg-card, #ffffff)',
              borderRadius: '0.75rem',
              maxWidth: '500px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 id="new-record-modal-title" style={{ fontSize: '1.2rem', margin: 0, color: 'var(--text-primary)' }}>
                New Operational Record
              </h2>
              <button onClick={() => setShowAddRecordModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateRecord} style={{ display: 'grid', gap: '0.75rem' }}>
              <div>
                <label htmlFor="record-title" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Record Title:
                </label>
                <input
                  id="record-title"
                  type="text"
                  required
                  placeholder="e.g. Ward G-North Water Pipeline Maintenance"
                  value={newRecordForm.title}
                  onChange={(e) => setNewRecordForm({ ...newRecordForm, title: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.35rem', border: '1px solid var(--border-light)' }}
                />
              </div>

              <div>
                <label htmlFor="record-category" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Category:
                </label>
                <select
                  id="record-category"
                  value={newRecordForm.category}
                  onChange={(e) => setNewRecordForm({ ...newRecordForm, category: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.35rem', border: '1px solid var(--border-light)' }}
                >
                  <option value="water_services">Water Services</option>
                  <option value="infrastructure">Infrastructure</option>
                  <option value="lake_conservation">Lake Conservation</option>
                  <option value="tree_pruning">Tree Pruning</option>
                </select>
              </div>

              <div>
                <label htmlFor="record-ward" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Ward Code:
                </label>
                <input
                  id="record-ward"
                  type="text"
                  required
                  placeholder="e.g. Ward A"
                  value={newRecordForm.wardCode}
                  onChange={(e) => setNewRecordForm({ ...newRecordForm, wardCode: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.35rem', border: '1px solid var(--border-light)' }}
                />
              </div>

              <div>
                <label htmlFor="record-priority" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Priority:
                </label>
                <select
                  id="record-priority"
                  value={newRecordForm.priority}
                  onChange={(e) => setNewRecordForm({ ...newRecordForm, priority: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.35rem', border: '1px solid var(--border-light)' }}
                >
                  <option value="routine">Routine</option>
                  <option value="urgent">Urgent</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>

              <div>
                <label htmlFor="record-notes" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Private Internal Notes (Isolated):
                </label>
                <textarea
                  id="record-notes"
                  rows={2}
                  placeholder="Confidential staff and engineer notes (never shared publicly)"
                  value={newRecordForm.privateNotes}
                  onChange={(e) => setNewRecordForm({ ...newRecordForm, privateNotes: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.35rem', border: '1px solid var(--border-light)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowAddRecordModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Staff Member */}
      {showAddStaffModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-staff-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: 'var(--bg-card, #ffffff)',
              borderRadius: '0.75rem',
              maxWidth: '450px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 id="new-staff-modal-title" style={{ fontSize: '1.2rem', margin: 0, color: 'var(--text-primary)' }}>
                Onboard Authority Staff
              </h2>
              <button onClick={() => setShowAddStaffModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddStaff} style={{ display: 'grid', gap: '0.75rem' }}>
              <div>
                <label htmlFor="staff-name" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Full Name:
                </label>
                <input
                  id="staff-name"
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kulkarni"
                  value={newStaffForm.userName}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, userName: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.35rem', border: '1px solid var(--border-light)' }}
                />
              </div>

              <div>
                <label htmlFor="staff-email" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Official Email:
                </label>
                <input
                  id="staff-email"
                  type="email"
                  required
                  placeholder="e.g. ramesh@bmc.gov.in"
                  value={newStaffForm.userEmail}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, userEmail: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.35rem', border: '1px solid var(--border-light)' }}
                />
              </div>

              <div>
                <label htmlFor="staff-role" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Assigned Authority Role:
                </label>
                <select
                  id="staff-role"
                  value={newStaffForm.role}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, role: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.35rem', border: '1px solid var(--border-light)' }}
                >
                  <option value={TENANT_ROLES.OPERATOR}>Tenant Operator (Triage & Datasets)</option>
                  <option value={TENANT_ROLES.REVIEWER}>Tenant Reviewer (Catalogue Approvals)</option>
                  <option value={TENANT_ROLES.AUDITOR}>Tenant Auditor (Read-Only Compliance)</option>
                  <option value={TENANT_ROLES.ADMIN}>Tenant Admin (Full Management)</option>
                </select>
              </div>

              <div>
                <label htmlFor="staff-wards" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Assigned Ward / Jurisdiction:
                </label>
                <input
                  id="staff-wards"
                  type="text"
                  placeholder="e.g. Ward A, Ward B"
                  value={newStaffForm.assignedWards}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, assignedWards: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.35rem', border: '1px solid var(--border-light)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowAddStaffModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Onboard Staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Retract Catalogue Confirmation */}
      {publicationReasonModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: 'var(--bg-card, #ffffff)',
              borderRadius: '0.75rem',
              maxWidth: '450px',
              width: '100%',
              padding: '1.5rem',
            }}
          >
            <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>
              Retract from Public Catalogue
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              Provide an official justification reason for retracting <strong>{publicationReasonModal.title}</strong>:
            </p>
            <textarea
              rows={3}
              placeholder="e.g. Superseded by new statutory guidance"
              value={retractionReasonText}
              onChange={(e) => setRetractionReasonText(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '0.35rem', border: '1px solid var(--border-light)', marginBottom: '1rem' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={() => setPublicationReasonModal(null)} className="btn btn-secondary">
                Cancel
              </button>
              <button
                onClick={() => handleRetractPublication(publicationReasonModal.catalogueId)}
                className="btn btn-primary"
                style={{ background: '#ef4444', borderColor: '#ef4444' }}
              >
                Confirm Retraction
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit & Apply Recommendation Parameters */}
      {editingRecommendation && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: 'var(--bg-card, #ffffff)',
              borderRadius: '0.75rem',
              maxWidth: '480px',
              width: '100%',
              padding: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text-primary)' }}>
                Customize Recommendation Parameters
              </h3>
              <button onClick={() => setEditingRecommendation(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Adjust parameters for <strong>{editingRecommendation.targetTitle}</strong> before committing to the operational dataset:
            </p>

            <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Adjust Priority Tier:
                </label>
                <select
                  value={editedPayload.priority}
                  onChange={(e) => setEditedPayload({ ...editedPayload, priority: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.35rem', border: '1px solid var(--border-light)' }}
                >
                  <option value="routine">Routine</option>
                  <option value="urgent">Urgent</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Staff Override Justification:
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Adjusted based on ground inspection notes"
                  value={editedPayload.reason}
                  onChange={(e) => setEditedPayload({ ...editedPayload, reason: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.35rem', border: '1px solid var(--border-light)' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={() => setEditingRecommendation(null)} className="btn btn-secondary">
                Cancel
              </button>
              <button
                onClick={() => {
                  resolveRecommendation(
                    currentActor,
                    activeTenantId,
                    editingRecommendation.id,
                    'edited',
                    editedPayload,
                    editedPayload.reason || 'Staff adjusted recommendation parameters'
                  );
                  setEditingRecommendation(null);
                  setSuccessBanner('Recommendation customized and applied with audit justification.');
                  setTimeout(() => setSuccessBanner(null), 3500);
                  reloadWorkspaceData();
                }}
                className="btn btn-primary"
              >
                Apply Customization
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
