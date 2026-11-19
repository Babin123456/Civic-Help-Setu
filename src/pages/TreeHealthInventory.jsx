import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  ClipboardList,
  FileUp,
  MapPin,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trees,
  Wrench,
} from 'lucide-react';
import StandardPageHeader from '../components/common/StandardPageHeader';
import TreeInventoryFilters from '../components/trees/TreeInventoryFilters';
import TreePublicInventory from '../components/trees/TreePublicInventory';
import TreeCitizenReportForm from '../components/trees/TreeCitizenReportForm';
import TreeStaffInventory from '../components/trees/TreeStaffInventory';
import TreeAssetForm from '../components/trees/TreeAssetForm';
import {
  TreeInspectionCompleteForm,
  TreeInspectionScheduleForm,
} from '../components/trees/TreeInspectionForm';
import TreeInspectionPanel from '../components/trees/TreeInspectionPanel';
import TreeWorkOrderPanel from '../components/trees/TreeWorkOrderPanel';
import TreeCitizenReportQueue from '../components/trees/TreeCitizenReportQueue';
import TreeTriageReviewPanel from '../components/trees/TreeTriageReviewPanel';
import TreeImportAuditPanel from '../components/trees/TreeImportAuditPanel';
import {
  TreeInlineAlert,
  TreeInventoryErrorState,
  TreeInventorySkeleton,
  TreeOfflineNotice,
  TreePermissionDenied,
  TreeStaleDataNotice,
  TreeStatusBadge,
} from '../components/trees/TreeInventoryStates';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import {
  canTree,
  isTreeStaff,
} from '../services/treeAccessControl';
import {
  RISK_LEVELS,
  RISK_LEVEL_LABELS,
  TREE_CONDITIONS,
  TREE_STATUS,
  TREE_STATUS_LABELS,
  allowedNextStates,
} from '../services/treeInventoryConstants';
import {
  applyTreeRetentionPolicy,
  completeTreeInspection,
  confirmTreeRisk,
  createMaintenanceOrder,
  createTreeAsset,
  getCitizenReportStatus,
  getPlanningJurisdictions,
  getPublicInventory,
  getPublicWardMap,
  getTreeAuditTrail,
  getTreeInspectionReminders,
  getTreeInventoryMigrationStatus,
  getTreeInventorySummary,
  importTreesCsv,
  listCitizenReports,
  listMaintenanceOrders,
  listPlantingSites,
  listStaffTrees,
  listTreeInspections,
  listTreeSpecies,
  listTreeTriageSuggestions,
  previewTreeImport,
  proposeTreeRisk,
  recordTreeTriageSuggestion,
  reviewCitizenReport,
  reviewTreeTriageSuggestion,
  rollbackTreeInventory,
  runTreeInventoryMigration,
  scheduleTreeInspection,
  submitCitizenTreeReport,
  transitionMaintenanceOrder,
  transitionTreeStatus,
  triageCitizenReport,
  updateMaintenanceOrder,
  verifyTreeInspection,
} from '../services/treeInventoryService';

const DEFAULT_PUBLIC_FILTERS = {
  jurisdictionId: '',
  ward: '',
  speciesId: '',
  condition: '',
  search: '',
  page: 1,
  pageSize: 12,
};

const DEFAULT_STAFF_FILTERS = {
  jurisdictionId: '',
  ward: '',
  speciesId: '',
  condition: '',
  status: '',
  inspectionDue: 'all',
  sort: 'updated',
  search: '',
  page: 1,
  pageSize: 12,
};

const DEFAULT_INSPECTION_FILTERS = { state: '', treeId: '', page: 1, pageSize: 12 };
const DEFAULT_ORDER_FILTERS = { state: '', type: '', page: 1, pageSize: 12 };
const DEFAULT_REPORT_FILTERS = { state: '', category: '', page: 1, pageSize: 12 };
const DEFAULT_TRIAGE_FILTERS = { decision: '', page: 1, pageSize: 12 };

const PANEL_STYLE = {
  border: '1px solid var(--border-main)',
  borderRadius: '0.9rem',
  padding: '1rem',
  background: 'var(--surface-raised, var(--glass-bg))',
  display: 'grid',
  gap: '0.75rem',
};

const LOCAL_REPORTER_KEY = 'civicbridge_tree_reporter_key';

const getReporterKey = () => {
  try {
    const existing = globalThis.localStorage?.getItem(LOCAL_REPORTER_KEY);
    if (existing) return existing;
    const generated = `tree_resident_${Math.random().toString(36).slice(2, 10)}`;
    globalThis.localStorage?.setItem(LOCAL_REPORTER_KEY, generated);
    return generated;
  } catch {
    return 'tree_resident_session';
  }
};

const newIdempotencyKey = () => {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {
    // Fall through to the timestamp key.
  }
  return `tree_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

function StaffTabButton({ active, onClick, icon: Icon, label, count }) {
  return (
    <button
      type="button"
      className={active ? 'btn btn-primary' : 'btn btn-secondary'}
      aria-pressed={active}
      onClick={onClick}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
    >
      <Icon size={15} aria-hidden="true" /> {label}
      {typeof count === 'number' && (
        <span
          aria-label={`${count} item${count === 1 ? '' : 's'}`}
          style={{
            background: active ? 'rgba(255,255,255,0.22)' : 'var(--glass-bg)',
            borderRadius: '999px',
            padding: '0.05rem 0.4rem',
            fontSize: '0.72rem',
            fontWeight: 800,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function ReasonActionForm({ title, label = 'Reason', submitLabel, onSubmit, onCancel, minLength = 5 }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (reason.trim().length < minLength) {
          setError(`Write at least ${minLength} characters explaining this decision.`);
          return;
        }
        setError('');
        onSubmit?.(reason.trim());
      }}
      noValidate
      style={{ display: 'grid', gap: '0.6rem' }}
    >
      <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{title}</h4>
      <label style={{ display: 'grid', gap: '0.3rem', fontSize: '0.82rem', fontWeight: 700 }}>
        {label}
        <textarea className="form-input" rows={2} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
        {error && <span style={{ color: 'var(--error, #ef4444)', fontSize: '0.77rem', fontWeight: 500 }}>{error}</span>}
      </label>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="submit" className="btn btn-primary">{submitLabel}</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export default function TreeHealthInventory() {
  const { user } = useAuth();
  const { isOnline } = useNetwork();
  const staff = isTreeStaff();

  const [tab, setTab] = useState('public');
  const [staffTab, setStaffTab] = useState('trees');
  const [publicView, setPublicView] = useState('list');
  const [publicFilters, setPublicFilters] = useState(DEFAULT_PUBLIC_FILTERS);
  const [staffFilters, setStaffFilters] = useState(DEFAULT_STAFF_FILTERS);
  const [inspectionFilters, setInspectionFilters] = useState(DEFAULT_INSPECTION_FILTERS);
  const [orderFilters, setOrderFilters] = useState(DEFAULT_ORDER_FILTERS);
  const [reportFilters, setReportFilters] = useState(DEFAULT_REPORT_FILTERS);
  const [triageFilters, setTriageFilters] = useState(DEFAULT_TRIAGE_FILTERS);
  const [reloadToken, setReloadToken] = useState(0);
  const [error, setError] = useState(null);
  const [staffError, setStaffError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [action, setAction] = useState(null);
  const [reportResult, setReportResult] = useState(null);
  const [reportTree, setReportTree] = useState(null);
  const [trackingCode, setTrackingCode] = useState('');
  const [trackingResult, setTrackingResult] = useState(null);
  const [triageSuggestion, setTriageSuggestion] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [orderPrefillTreeId, setOrderPrefillTreeId] = useState('');

  const refresh = () => setReloadToken((value) => value + 1);

  const data = useMemo(() => {
    // The revision token and signed-in user force a re-read of the trusted
    // service boundary after a write or an account switch.
    void reloadToken;
    void user?.id;
    let jurisdictions = [];
    let species = [];
    let publicData = null;
    let wardMap = null;
    let publicError = null;
    try {
      jurisdictions = getPlanningJurisdictions();
      species = listTreeSpecies();
      publicData = getPublicInventory(publicFilters);
      wardMap = getPublicWardMap(publicFilters);
    } catch (err) {
      publicError = err;
    }

    let staffData = null;
    let nextStaffError = null;
    if (staff) {
      try {
        staffData = {
          trees: listStaffTrees(staffFilters),
          summary: getTreeInventorySummary(),
          reminders: getTreeInspectionReminders(),
          inspections: listTreeInspections(inspectionFilters),
          orders: listMaintenanceOrders(orderFilters),
          reports: listCitizenReports(reportFilters),
          triage: listTreeTriageSuggestions(triageFilters),
          sites: listPlantingSites(),
          audit: canTree('audit.read') ? getTreeAuditTrail({ limit: 60 }) : null,
          migration: canTree('inventory.migrate') ? getTreeInventoryMigrationStatus() : null,
        };
      } catch (err) {
        nextStaffError = err;
      }
    }

    return { jurisdictions, species, publicData, wardMap, publicError, staffData, staffError: nextStaffError };
  }, [
    publicFilters,
    staffFilters,
    inspectionFilters,
    orderFilters,
    reportFilters,
    triageFilters,
    staff,
    user?.id,
    reloadToken,
  ]);

  const wards = useMemo(() => {
    const selected = data.jurisdictions.find((item) => item.id === staffFilters.jurisdictionId || item.id === publicFilters.jurisdictionId);
    if (selected) return selected.wards;
    return [...new Set(data.jurisdictions.flatMap((item) => item.wards))];
  }, [data.jurisdictions, publicFilters.jurisdictionId, staffFilters.jurisdictionId]);

  const runService = (fn, successMessage) => {
    setError(null);
    setStaffError(null);
    try {
      const result = fn();
      setNotice(typeof successMessage === 'function' ? successMessage(result) : successMessage || null);
      setAction(null);
      setReloadToken((value) => value + 1);
      return result;
    } catch (err) {
      setError(err);
      setNotice(null);
      return null;
    }
  };

  const openReportFor = (tree) => {
    setReportTree(tree || null);
    setReportResult(null);
    setTab('report');
  };

  const handlePublicReset = () => {
    setPublicFilters(DEFAULT_PUBLIC_FILTERS);
    setPublicView('list');
  };

  const handleStaffReset = () => setStaffFilters(DEFAULT_STAFF_FILTERS);

  const handleStaffAction = (kind, tree) => {
    if (kind === 'inspect') {
      setStaffTab('inspections');
      setAction({ kind: 'scheduleInspection', tree });
      return;
    }
    if (kind === 'order') {
      setStaffTab('orders');
      setOrderPrefillTreeId(tree.id);
      setNotice(`Choose ${tree.publicId} in the new order form and record the work details.`);
      return;
    }
    if (kind === 'risk') {
      setAction({ kind: 'risk', tree });
      return;
    }
    if (kind === 'status') {
      setAction({ kind: 'status', tree });
      return;
    }
    if (kind === 'details') {
      setAction({ kind: 'details', tree });
    }
  };

  const treeForInspection = (inspection) =>
    data.staffData?.trees?.items?.find((tree) => tree.id === inspection.treeId) || {
      id: inspection.treeId,
      publicId: inspection.treePublicId || 'Tree',
      condition: TREE_CONDITIONS.UNKNOWN,
    };

  const submitCitizenReport = (input) => {
    const result = runService(
      () =>
        submitCitizenTreeReport(input, {
          idempotencyKey: newIdempotencyKey(),
          reporterKey: getReporterKey(),
        }),
      (value) => value?.publicReport?.trackingCode
        ? `Observation saved. Tracking code ${value.publicReport.trackingCode}.`
        : 'Observation received.'
    );
    if (result) {
      setReportResult(result);
      setReportTree(null);
      setTab('report');
    }
  };

  const lookupReport = () => {
    setNotice(null);
    try {
      const result = getCitizenReportStatus(trackingCode);
      setTrackingResult(result);
      setError(null);
    } catch (err) {
      setTrackingResult(null);
      setError(err);
    }
  };

  const submitTree = (input) => {
    const result = runService(
      () => createTreeAsset(input, { idempotencyKey: newIdempotencyKey() }),
      (value) => `Registered ${value?.tree?.publicId || 'tree asset'}.`
    );
    if (result) setStaffTab('trees');
  };

  const submitInspectionSchedule = (input) => {
    runService(() => scheduleTreeInspection(input, { idempotencyKey: newIdempotencyKey() }), 'Inspection scheduled.');
  };

  const submitInspectionComplete = (input) => {
    const result = runService(
      () => completeTreeInspection(input.inspectionId, input, { idempotencyKey: newIdempotencyKey() }),
      (value) => `Inspection ${value?.inspection?.publicId || ''} completed and the tree condition updated.`
    );
    if (result) setTriageSuggestion(null);
  };

  const submitVerifyInspection = (inspection, reason) => {
    runService(
      () => verifyTreeInspection(inspection.id, { reason }, { idempotencyKey: newIdempotencyKey() }),
      `Inspection ${inspection.publicId} verified.`
    );
  };

  const submitRiskProposal = (tree, level, reason) => {
    runService(
      () => proposeTreeRisk(tree.id, { level, reason }, { idempotencyKey: newIdempotencyKey() }),
      'Risk designation proposed. A reviewer must confirm or reject it.'
    );
  };

  const submitRiskDecision = (tree, decision, reason) => {
    runService(
      () => confirmTreeRisk(tree.id, { decision, reason }, { idempotencyKey: newIdempotencyKey() }),
      decision === 'confirm' ? 'Risk designation confirmed by an expert reviewer.' : 'Risk proposal rejected.'
    );
  };

  const submitStatusTransition = (tree, nextStatus, reason) => {
    runService(
      () => transitionTreeStatus(tree.id, nextStatus, { reason }, { idempotencyKey: newIdempotencyKey() }),
      `Tree status updated to ${TREE_STATUS_LABELS[nextStatus] || nextStatus}.`
    );
  };

  const handleTriageSuggestion = (payload) => {
    const result = runService(
      () =>
        recordTreeTriageSuggestion(payload, {
          nowMs: Date.now(),
        }),
      'Triage suggestion created. It remains pending until an expert reviews it.'
    );
    if (result) setTriageSuggestion(result);
  };

  const submitOrderCreate = (input) => {
    runService(
      () => createMaintenanceOrder(input, { idempotencyKey: newIdempotencyKey() }),
      (value) => `Maintenance order ${value?.order?.publicId || ''} created.`
    );
    setOrderPrefillTreeId('');
  };

  const submitOrderUpdate = (orderId, updates) => {
    runService(
      () => updateMaintenanceOrder(orderId, updates, { idempotencyKey: newIdempotencyKey() }),
      'Maintenance order updated.'
    );
  };

  const submitOrderTransition = (orderId, nextState, input) => {
    runService(
      () => transitionMaintenanceOrder(orderId, nextState, input, { idempotencyKey: newIdempotencyKey() }),
      nextState === 'verified' ? 'Order closed with evidence and, where relevant, a pruning event recorded.' : 'Maintenance order moved to its next state.'
    );
  };

  const submitReportTriage = (reportId, input) => {
    runService(() => triageCitizenReport(reportId, input, { idempotencyKey: newIdempotencyKey() }), 'Citizen report triaged.');
  };

  const submitReportReview = (reportId, input) => {
    runService(
      () => reviewCitizenReport(reportId, input, { idempotencyKey: newIdempotencyKey() }),
      input.decision === 'accept'
        ? 'Report accepted and a follow-up inspection scheduled.'
        : 'Report review decision recorded.'
    );
  };

  const submitTriageReview = (suggestionId, input) => {
    runService(
      () => reviewTreeTriageSuggestion(suggestionId, input, { idempotencyKey: newIdempotencyKey() }),
      'Expert review recorded. The suggestion never changed risk or removal status.'
    );
  };

  const handleImportPreview = (csvText) => {
    setError(null);
    try {
      const preview = previewTreeImport(csvText);
      setImportPreview(preview);
      setNotice(preview.canApply ? 'CSV preview is valid and ready to import.' : 'CSV preview found errors; nothing will be imported.');
    } catch (err) {
      setImportPreview(null);
      setError(err);
    }
  };

  const handleImportApply = (csvText, reason) => {
    const result = runService(
      () => importTreesCsv(csvText, { idempotencyKey: newIdempotencyKey(), reason }),
      (value) => `Imported ${value?.imported || 0} tree asset(s).`
    );
    if (result) setImportPreview(null);
  };

  const handleMigrate = () => {
    runService(() => runTreeInventoryMigration(), 'Schema migration applied with a rollback backup.');
  };

  const handleRollback = () => {
    runService(() => rollbackTreeInventory(), 'Migration rolled back to the saved snapshot.');
  };

  const handleRetention = () => {
    runService(() => applyTreeRetentionPolicy({ dryRun: false }), 'Retention policy applied to eligible closed reports.');
  };

  const pageError = error || data.publicError;

  return (
    <div className="section" style={{ padding: '2rem 1rem' }}>
      <div className="container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <StandardPageHeader
          eyebrow="Municipal Tree Health"
          eyebrowIcon={<Trees size={16} />}
          title="Tree Health Inventory & Preventive Maintenance Planner"
          subtitle="Browse the approved public tree register, report visible damage, and — for municipal staff — inspect trees, plan preventive maintenance, review citizen observations and audit every decision."
          badgeText="Human-confirmed decisions"
          badgeType="accent"
          align="left"
          maxWidth="900px"
        />

        <div
          role="note"
          style={{
            ...PANEL_STYLE,
            marginBottom: '1.25rem',
            display: 'flex',
            gap: '0.65rem',
            alignItems: 'flex-start',
            fontSize: '0.86rem',
            color: 'var(--text-secondary)',
          }}
        >
          <ShieldCheck size={18} aria-hidden="true" style={{ color: 'var(--accent-main)', flexShrink: 0, marginTop: 2 }} />
          <p style={{ margin: 0 }}>
            Public views publish only approved species, ward, condition and a ~1 km grid. Precise coordinates and staff notes are
            not returned. Image-assisted triage is a suggestion: pruning, removal and risk designations always require a named
            human expert to confirm.
          </p>
        </div>

        {!isOnline && <TreeOfflineNotice />}

        <div role="group" aria-label="Tree inventory sections" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <button type="button" className={tab === 'public' ? 'btn btn-primary' : 'btn btn-secondary'} aria-pressed={tab === 'public'} onClick={() => setTab('public')}>
            <Trees size={15} aria-hidden="true" /> Public register
          </button>
          <button type="button" className={tab === 'report' ? 'btn btn-primary' : 'btn btn-secondary'} aria-pressed={tab === 'report'} onClick={() => setTab('report')}>
            <AlertCircle size={15} aria-hidden="true" /> Report a tree
          </button>
          {staff && (
            <button type="button" className={tab === 'staff' ? 'btn btn-primary' : 'btn btn-secondary'} aria-pressed={tab === 'staff'} onClick={() => setTab('staff')}>
              <ShieldAlert size={15} aria-hidden="true" /> Staff workspace
            </button>
          )}
        </div>

        {notice && <div style={{ marginBottom: '1rem' }}><TreeInlineAlert tone="success" title="Saved">{notice}</TreeInlineAlert></div>}
        {pageError && tab !== 'staff' && (
          <div style={{ marginBottom: '1rem' }}>
            <TreeInventoryErrorState error={pageError} onRetry={refresh} />
          </div>
        )}

        {tab === 'public' && (
          <section aria-labelledby="tree-public-section-heading" style={{ display: 'grid', gap: '1rem' }}>
            <h2 id="tree-public-section-heading" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
              Public tree register
            </h2>
            <TreeInventoryFilters
              mode="public"
              filters={publicFilters}
              onChange={setPublicFilters}
              onReset={handlePublicReset}
              jurisdictions={data.jurisdictions}
              wards={wards}
              species={data.species}
              resultCount={data.publicData?.summary?.totalTrees ?? null}
            />
            {data.publicData?.freshness && <TreeStaleDataNotice freshness={data.publicData.freshness} />}
            {data.publicData ? (
              <TreePublicInventory
                data={data.publicData}
                wardMap={data.wardMap}
                view={publicView}
                onViewChange={setPublicView}
                onReport={openReportFor}
                onPageChange={(page) => setPublicFilters((previous) => ({ ...previous, page }))}
                onReset={handlePublicReset}
                generatedAt={data.publicData.generatedAt}
              />
            ) : (
              !pageError && <TreeInventorySkeleton />
            )}
          </section>
        )}

        {tab === 'report' && (
          <section aria-labelledby="tree-report-section-heading" style={{ display: 'grid', gap: '1rem' }}>
            <h2 id="tree-report-section-heading" style={{ margin: 0, fontSize: '1.2rem' }}>
              Report a visible tree problem
            </h2>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: '72ch' }}>
              {reportTree
                ? `You are reporting against ${reportTree.publicId} (${reportTree.ward}).`
                : 'Choose a public tree or a ward. Reports are unverified observations and are queued for municipal triage.'}
            </p>
            <div style={PANEL_STYLE}>
              <TreeCitizenReportForm
                trees={data.publicData?.items || []}
                jurisdictions={data.jurisdictions}
                onSubmit={submitCitizenReport}
                onCancel={() => {
                  setReportResult(null);
                  setReportTree(null);
                }}
                serviceError={error}
                result={reportResult}
              />
            </div>

            <div style={{ ...PANEL_STYLE, gap: '0.6rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Track an existing observation</h3>
              <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                Enter the tracking code you received. Tracking returns only public status fields.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <label style={{ display: 'grid', gap: '0.3rem', fontSize: '0.82rem', fontWeight: 700 }}>
                  Tracking code
                  <input className="form-input" value={trackingCode} maxLength={40} onChange={(event) => setTrackingCode(event.target.value.toUpperCase())} />
                </label>
                <button type="button" className="btn btn-secondary" onClick={lookupReport} disabled={trackingCode.trim().length < 4}>
                  Check status
                </button>
              </div>
              {trackingResult && (
                <div role="status" style={{ display: 'grid', gap: '0.35rem', fontSize: '0.84rem' }}>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <strong>{trackingResult.trackingCode}</strong>
                    <TreeStatusBadge tone={trackingResult.state === 'accepted' ? 'success' : 'scheduled'} label={trackingResult.stateLabel} prefix="Status" />
                  </div>
                  <span>{trackingResult.categoryLabel} · {trackingResult.ward}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{trackingResult.resolutionMessage}</span>
                  <span style={{ color: 'var(--text-tertiary)' }}>{trackingResult.source}</span>
                </div>
              )}
            </div>
          </section>
        )}

        {tab === 'staff' && (
          !staff ? (
            <TreePermissionDenied />
          ) : data.staffError || staffError ? (
            <TreeInventoryErrorState error={data.staffError || staffError} onRetry={refresh} title="The staff workspace could not be loaded" />
          ) : !data.staffData ? (
            <TreeInventorySkeleton label="Loading the staff tree workspace…" />
          ) : (
            <section aria-labelledby="tree-staff-section-heading" style={{ display: 'grid', gap: '1rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.6rem', alignItems: 'center' }}>
                <div>
                  <h2 id="tree-staff-section-heading" style={{ margin: 0, fontSize: '1.2rem' }}>Municipal staff workspace</h2>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                    Scoped to your assigned jurisdiction. Every action is written to the hash-chained audit trail.
                  </p>
                </div>
                <button type="button" className="btn btn-secondary" onClick={refresh}>
                  <RefreshCw size={14} aria-hidden="true" /> Refresh workspace
                </button>
              </div>

              {data.staffData.summary?.freshness && <TreeStaleDataNotice freshness={data.staffData.summary.freshness} />}

              <div role="group" aria-label="Staff workspace sections" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                <StaffTabButton active={staffTab === 'trees'} onClick={() => setStaffTab('trees')} icon={Trees} label="Trees" count={data.staffData.summary?.totalTrees} />
                <StaffTabButton active={staffTab === 'inspections'} onClick={() => setStaffTab('inspections')} icon={CheckCircle2} label="Inspections" count={data.staffData.inspections?.total} />
                <StaffTabButton active={staffTab === 'orders'} onClick={() => setStaffTab('orders')} icon={Wrench} label="Work orders" count={data.staffData.orders?.total} />
                <StaffTabButton active={staffTab === 'reports'} onClick={() => setStaffTab('reports')} icon={AlertCircle} label="Citizen reports" count={data.staffData.reports?.pendingCount} />
                <StaffTabButton active={staffTab === 'triage'} onClick={() => setStaffTab('triage')} icon={Bot} label="Triage review" count={data.staffData.summary?.pendingTriageReview} />
                <StaffTabButton active={staffTab === 'import'} onClick={() => setStaffTab('import')} icon={FileUp} label="Import & audit" />
              </div>

              {staffTab === 'trees' && (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  <TreeInventoryFilters
                    mode="staff"
                    filters={staffFilters}
                    onChange={setStaffFilters}
                    onReset={handleStaffReset}
                    jurisdictions={data.jurisdictions}
                    wards={wards}
                    species={data.species}
                    resultCount={data.staffData.trees?.total ?? null}
                  />
                  <TreeStaffInventory
                    data={data.staffData.trees}
                    reminders={data.staffData.reminders}
                    summary={data.staffData.summary}
                    onAction={handleStaffAction}
                    onCreateTree={() => setAction({ kind: 'create' })}
                    onRefresh={refresh}
                    canCreate={canTree('tree.create')}
                    canRisk={canTree('tree.risk.propose')}
                    canTransition={canTree('tree.status.transition')}
                  />

                  {action && ['create', 'risk', 'status', 'details'].includes(action.kind) && (
                    <div style={PANEL_STYLE} aria-live="polite">
                      {action.kind === 'create' && (
                        <>
                          <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            <Plus size={16} aria-hidden="true" /> Register a tree asset
                          </h3>
                          <TreeAssetForm
                            jurisdictions={data.jurisdictions}
                            species={data.species}
                            sites={data.staffData.sites}
                            defaultJurisdiction={staffFilters.jurisdictionId || ''}
                            onSubmit={submitTree}
                            onCancel={() => setAction(null)}
                            serviceError={error}
                          />
                        </>
                      )}

                      {action.kind === 'risk' && (
                        <>
                          <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            <ShieldAlert size={16} aria-hidden="true" /> Risk for {action.tree.publicId}
                          </h3>
                          <RiskForm tree={action.tree} onPropose={submitRiskProposal} onDecide={submitRiskDecision} onCancel={() => setAction(null)} canConfirm={canTree('tree.risk.confirm')} error={error} />
                        </>
                      )}

                      {action.kind === 'status' && (
                        <>
                          <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            <ClipboardList size={16} aria-hidden="true" /> Lifecycle status for {action.tree.publicId}
                          </h3>
                          <StatusForm tree={action.tree} onSubmit={submitStatusTransition} onCancel={() => setAction(null)} error={error} />
                        </>
                      )}

                      {action.kind === 'details' && (
                        <div style={{ display: 'grid', gap: '0.6rem' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'space-between' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem' }}>Public preview of {action.tree.publicId}</h3>
                            <button type="button" className="btn btn-secondary" onClick={() => setAction(null)}>Close preview</button>
                          </div>
                          <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.6rem', margin: 0, fontSize: '0.84rem' }}>
                            <div><dt style={{ fontWeight: 700, color: 'var(--text-tertiary)' }}>Species</dt><dd style={{ margin: 0 }}>{action.tree.publicView?.species?.commonName || 'Unidentified'}</dd></div>
                            <div><dt style={{ fontWeight: 700, color: 'var(--text-tertiary)' }}>Ward</dt><dd style={{ margin: 0 }}>{action.tree.publicView?.ward}</dd></div>
                            <div><dt style={{ fontWeight: 700, color: 'var(--text-tertiary)' }}>Condition</dt><dd style={{ margin: 0 }}>{action.tree.publicView?.conditionLabel}</dd></div>
                            <div><dt style={{ fontWeight: 700, color: 'var(--text-tertiary)' }}>Public grid</dt><dd style={{ margin: 0 }}>{action.tree.publicView?.approxLocation?.grid}</dd></div>
                            <div><dt style={{ fontWeight: 700, color: 'var(--text-tertiary)' }}>Risk</dt><dd style={{ margin: 0 }}>{action.tree.publicView?.risk?.label}</dd></div>
                            <div><dt style={{ fontWeight: 700, color: 'var(--text-tertiary)' }}>Last updated</dt><dd style={{ margin: 0 }}>{action.tree.publicView?.updatedAt ? new Date(action.tree.publicView.updatedAt).toLocaleString('en-IN') : 'Unknown'}</dd></div>
                          </dl>
                          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                            This is exactly the shape returned to the public. Precise coordinates, private notes, internal ids and
                            reporter keys are excluded.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {action?.kind === 'scheduleInspection' && (
                    <div style={PANEL_STYLE} aria-live="polite">
                      <TreeInspectionScheduleForm
                        tree={action.tree}
                        onSubmit={submitInspectionSchedule}
                        onCancel={() => setAction(null)}
                        serviceError={error}
                      />
                    </div>
                  )}
                </div>
              )}

              {staffTab === 'inspections' && (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {action?.kind === 'scheduleInspection' && (
                    <div style={PANEL_STYLE} aria-live="polite">
                      <TreeInspectionScheduleForm
                        tree={action.tree}
                        onSubmit={submitInspectionSchedule}
                        onCancel={() => setAction(null)}
                        serviceError={error}
                      />
                    </div>
                  )}

                  {action?.kind === 'completeInspection' && (
                    <div style={PANEL_STYLE} aria-live="polite">
                      <TreeInspectionCompleteForm
                        inspection={action.inspection}
                        tree={action.tree}
                        onSubmit={submitInspectionComplete}
                        onAnalyze={handleTriageSuggestion}
                        onCancel={() => {
                          setAction(null);
                          setTriageSuggestion(null);
                        }}
                        serviceError={error}
                        triageSuggestion={triageSuggestion}
                      />
                    </div>
                  )}

                  {action?.kind === 'verifyInspection' && (
                    <div style={PANEL_STYLE} aria-live="polite">
                      <ReasonActionForm
                        title={`Verify inspection ${action.inspection.publicId}`}
                        label="Verification reason"
                        submitLabel="Verify findings"
                        onSubmit={(reason) => submitVerifyInspection(action.inspection, reason)}
                        onCancel={() => setAction(null)}
                      />
                    </div>
                  )}

                  <TreeInspectionPanel
                    inspections={data.staffData.inspections}
                    trees={data.staffData.trees?.items}
                    filters={inspectionFilters}
                    onFiltersChange={setInspectionFilters}
                    onSchedule={(tree) => setAction({ kind: 'scheduleInspection', tree })}
                    onComplete={(inspection) =>
                      setAction({ kind: 'completeInspection', inspection, tree: treeForInspection(inspection) })
                    }
                    onVerify={(inspection) => setAction({ kind: 'verifyInspection', inspection })}
                    onRefresh={refresh}
                    canSchedule={canTree('inspection.schedule')}
                    canComplete={canTree('inspection.complete')}
                    canVerify={canTree('inspection.verify')}
                  />
                </div>
              )}

              {staffTab === 'orders' && (
                <TreeWorkOrderPanel
                  key={orderPrefillTreeId || 'orders'}
                  orders={data.staffData.orders}
                  trees={data.staffData.trees?.items}
                  defaultTreeId={orderPrefillTreeId}
                  filters={orderFilters}
                  onFiltersChange={setOrderFilters}
                  onCreate={submitOrderCreate}
                  onUpdate={submitOrderUpdate}
                  onTransition={submitOrderTransition}
                  onRefresh={refresh}
                  canManage={canTree('order.manage')}
                  canClose={canTree('order.close')}
                />
              )}

              {staffTab === 'reports' && (
                <TreeCitizenReportQueue
                  reports={data.staffData.reports}
                  trees={data.staffData.trees?.items}
                  filters={reportFilters}
                  onFiltersChange={setReportFilters}
                  onTriage={submitReportTriage}
                  onReview={submitReportReview}
                  onRefresh={refresh}
                  canTriage={canTree('report.triage')}
                  canReview={canTree('report.review')}
                />
              )}

              {staffTab === 'triage' && (
                <TreeTriageReviewPanel
                  suggestions={data.staffData.triage}
                  filters={triageFilters}
                  onFiltersChange={setTriageFilters}
                  onReview={submitTriageReview}
                  onRefresh={refresh}
                  canReview={canTree('triage.review')}
                />
              )}

              {staffTab === 'import' && (
                <TreeImportAuditPanel
                  audit={data.staffData.audit}
                  migration={data.staffData.migration}
                  preview={importPreview}
                  onPreview={handleImportPreview}
                  onImport={handleImportApply}
                  onMigrate={handleMigrate}
                  onRollback={handleRollback}
                  onRetention={handleRetention}
                  onRefresh={refresh}
                  canImport={canTree('inventory.import')}
                  canAudit={canTree('audit.read')}
                  canMigrate={canTree('inventory.migrate')}
                  canRetention={canTree('retention.manage')}
                />
              )}
            </section>
          )
        )}

        <footer style={{ marginTop: '2rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.9rem', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
          <p style={{ margin: 0, display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <MapPin size={14} aria-hidden="true" /> Public locations use a ~1 km grid. This register is a local-first
            demonstration: changes are stored on this device and are not a substitute for a municipal record of decision.
          </p>
        </footer>
      </div>
    </div>
  );
}

function RiskForm({ tree, onPropose, onDecide, onCancel, canConfirm, error }) {
  const [level, setLevel] = useState(RISK_LEVELS.MODERATE);
  const [reason, setReason] = useState('');
  const [decision, setDecision] = useState('confirm');
  const [decisionReason, setDecisionReason] = useState('');
  const [formError, setFormError] = useState('');
  const proposed = tree.risk?.state === 'proposed';

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
        Current designation: <strong>{tree.riskLabel}</strong> (state: {tree.risk?.state || 'none'}). A proposal does not remove
        access, authorise pruning or approve removal. High and critical proposals require an independent reviewer.
      </p>
      {error && <p role="alert" style={{ margin: 0, color: 'var(--error, #ef4444)', fontSize: '0.82rem' }}>{error.userMessage || error.message}</p>}

      {!proposed && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (level === RISK_LEVELS.NONE) {
              setFormError('Choose a level above none.');
              return;
            }
            if (reason.trim().length < 10) {
              setFormError('Write at least 10 characters explaining the evidence for this proposal.');
              return;
            }
            setFormError('');
            onPropose(tree, level, reason.trim());
          }}
          noValidate
          style={{ display: 'grid', gap: '0.6rem' }}
        >
          <h4 style={{ margin: 0, fontSize: '0.92rem' }}>Propose a risk level</h4>
          <label style={{ display: 'grid', gap: '0.3rem', fontSize: '0.82rem', fontWeight: 700 }}>
            Proposed level
            <select className="form-input" value={level} onChange={(event) => setLevel(event.target.value)}>
              {[RISK_LEVELS.LOW, RISK_LEVELS.MODERATE, RISK_LEVELS.HIGH, RISK_LEVELS.CRITICAL].map((value) => (
                <option key={value} value={value}>{RISK_LEVEL_LABELS[value]}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: '0.3rem', fontSize: '0.82rem', fontWeight: 700 }}>
            Evidence and reason
            <textarea className="form-input" rows={2} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
            {formError && <span style={{ color: 'var(--error, #ef4444)', fontSize: '0.77rem', fontWeight: 500 }}>{formError}</span>}
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-primary">Submit risk proposal</button>
            <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          </div>
        </form>
      )}

      {proposed && canConfirm && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (decisionReason.trim().length < 5) {
              setFormError('Give a short reason for the review decision.');
              return;
            }
            setFormError('');
            onDecide(tree, decision, decisionReason.trim());
          }}
          noValidate
          style={{ display: 'grid', gap: '0.6rem' }}
        >
          <h4 style={{ margin: 0, fontSize: '0.92rem' }}>Review the pending risk proposal</h4>
          <label style={{ display: 'grid', gap: '0.3rem', fontSize: '0.82rem', fontWeight: 700 }}>
            Decision
            <select className="form-input" value={decision} onChange={(event) => setDecision(event.target.value)}>
              <option value="confirm">Confirm risk designation</option>
              <option value="reject">Reject proposal</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: '0.3rem', fontSize: '0.82rem', fontWeight: 700 }}>
            Review reason
            <textarea className="form-input" rows={2} maxLength={500} value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} />
            {formError && <span style={{ color: 'var(--error, #ef4444)', fontSize: '0.77rem', fontWeight: 500 }}>{formError}</span>}
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-primary">Record expert decision</button>
            <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          </div>
        </form>
      )}

      {proposed && !canConfirm && (
        <p role="status" style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
          This proposal is waiting for a reviewer or inventory administrator. Reviewers cannot be the same person who proposed it in a
          production deployment; this local demonstration relies on role separation.
        </p>
      )}
    </div>
  );
}

function StatusForm({ tree, onSubmit, onCancel, error }) {
  const options = allowedNextStates('tree', tree.status);
  const [nextStatus, setNextStatus] = useState(options[0] || TREE_STATUS.ACTIVE);
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState('');

  if (options.length === 0) {
    return (
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
          {tree.publicId} is in the terminal state “{TREE_STATUS_LABELS[tree.status]}”. No further lifecycle change is allowed.
        </p>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Close</button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (reason.trim().length < 5) {
          setFormError('Write at least 5 characters explaining the status change.');
          return;
        }
        setFormError('');
        onSubmit(tree, nextStatus, reason.trim());
      }}
      noValidate
      style={{ display: 'grid', gap: '0.6rem' }}
    >
      <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
        Current status: <strong>{TREE_STATUS_LABELS[tree.status] || tree.status}</strong>. Removal approval is only possible
        after a reviewer confirms a high or critical risk.
      </p>
      {error && <p role="alert" style={{ margin: 0, color: 'var(--error, #ef4444)', fontSize: '0.82rem' }}>{error.userMessage || error.message}</p>}
      <label style={{ display: 'grid', gap: '0.3rem', fontSize: '0.82rem', fontWeight: 700 }}>
        Next status
        <select className="form-input" value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>
          {options.map((status) => (
            <option key={status} value={status}>{TREE_STATUS_LABELS[status] || status}</option>
          ))}
        </select>
      </label>
      <label style={{ display: 'grid', gap: '0.3rem', fontSize: '0.82rem', fontWeight: 700 }}>
        Reason for the change
        <textarea className="form-input" rows={2} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
        {formError && <span style={{ color: 'var(--error, #ef4444)', fontSize: '0.77rem', fontWeight: 500 }}>{formError}</span>}
      </label>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="submit" className="btn btn-primary">Change status</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
