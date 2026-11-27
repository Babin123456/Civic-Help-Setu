import { useState, useMemo, useCallback } from 'react';
import { Navigation, ShieldCheck, Trash2 } from 'lucide-react';
import StandardPageHeader from '../components/common/StandardPageHeader';
import MoveTypeSelector from '../components/addressChange/MoveTypeSelector';
import RecordSelector from '../components/addressChange/RecordSelector';
import ActionPlannerBoard from '../components/addressChange/ActionPlannerBoard';
import RecordDetailModal from '../components/addressChange/RecordDetailModal';
import AddressChangePrintReportModal from '../components/addressChange/AddressChangePrintReportModal';
import AddressChangeCorrectionModal from '../components/addressChange/AddressChangeCorrectionModal';
import AddressChangeStaleNotice from '../components/addressChange/AddressChangeStaleNotice';
import AddressChangeSkeleton from '../components/addressChange/AddressChangeSkeleton';
import AddressChangeErrorState from '../components/addressChange/AddressChangeErrorState';

import { VERIFIED_ADDRESS_CHANGE_RECORDS } from '../data/addressChangeRecords';
import {
  readAddressChangePlan,
  saveAddressChangePlan,
  updateRecordProgress,
  deleteAddressChangePlan,
  DEFAULT_PLAN_STATE,
} from '../../src/services/addressChangeStorage';
import {
  filterRecordsForPlan,
  sortRecordsByDependency,
  calculatePlanReadiness,
} from '../../src/services/addressChangeService';
import { useToast } from '../context/ToastContext';
import { logDiagnostic } from '../utils/diagnostics';

export default function AddressChangePlanner() {
  const { toast } = useToast();

  const [planState, setPlanState] = useState(() => readAddressChangePlan());
  const [selectedRecordForDetails, setSelectedRecordForDetails] = useState(null);
  const [selectedRecordForCorrection, setSelectedRecordForCorrection] = useState(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Sync state changes to localStorage
  const persistPlan = useCallback((updatedPlan) => {
    setPlanState((prev) => {
      const res = saveAddressChangePlan(updatedPlan, { expectedRev: prev.rev });
      if (res.success) {
        return res.plan;
      }
      if (res.conflict) {
        logDiagnostic('Planner storage revision conflict', res.error);
        return readAddressChangePlan();
      }
      return updatedPlan;
    });
  }, []);

  // Update Move Type
  const handleMoveTypeChange = (newMoveType) => {
    const updated = { ...planState, moveType: newMoveType };
    persistPlan(updated);
    toast?.info?.(`Switched scope to ${newMoveType.replace('_', ' ')}.`);
  };

  // Update States
  const handleOriginStateChange = (val) => {
    persistPlan({ ...planState, originState: val });
  };
  const handleDestinationStateChange = (val) => {
    persistPlan({ ...planState, destinationState: val });
  };

  // Toggle record selection
  const handleToggleRecord = (recordId) => {
    const current = planState.selectedRecordIds;
    const updatedIds = current.includes(recordId)
      ? current.filter((id) => id !== recordId)
      : [...current, recordId];
    persistPlan({ ...planState, selectedRecordIds: updatedIds });
  };

  const handleSelectAll = () => {
    const allIds = VERIFIED_ADDRESS_CHANGE_RECORDS.map((r) => r.id);
    persistPlan({ ...planState, selectedRecordIds: allIds });
  };

  const handleClearAll = () => {
    persistPlan({ ...planState, selectedRecordIds: [] });
  };

  // Update item checklist progress (status, URN, dates)
  const handleUpdateProgress = (recordId, patch) => {
    const res = updateRecordProgress(recordId, patch);
    if (res.success) {
      setPlanState(res.plan);
    }
  };

  // Permanently delete stored plan
  const handleDeletePlan = () => {
    deleteAddressChangePlan();
    setPlanState({ ...DEFAULT_PLAN_STATE });
    setIsConfirmDeleteOpen(false);
    toast?.success?.('Your saved address change checklist data was deleted.');
  };

  // Filter and sort applicable records
  const applicableRecords = useMemo(() => {
    try {
      const filtered = filterRecordsForPlan(VERIFIED_ADDRESS_CHANGE_RECORDS, {
        moveType: planState.moveType,
        selectedRecordIds: planState.selectedRecordIds,
      });
      return sortRecordsByDependency(filtered);
    } catch (err) {
      logDiagnostic('Error filtering address change records', err);
      return [];
    }
  }, [planState.moveType, planState.selectedRecordIds]);

  const readiness = useMemo(() => {
    return calculatePlanReadiness(applicableRecords, planState.items);
  }, [applicableRecords, planState.items]);

  return (
    <div className="section" style={{ padding: '2rem 1rem' }}>
      <div className="container" style={{ maxWidth: '1150px', margin: '0 auto' }}>
        {/* Header */}
        <StandardPageHeader
          eyebrow="Civic Relocation"
          eyebrowIcon={<Navigation size={15} style={{ color: 'var(--accent-main, #2563eb)' }} />}
          title="Civic Moving-Home Address-Change Action Planner"
          subtitle="Coordinate official address updates across independent authorities without assuming automatic inter-department record sharing."
          badgeText="Verified Government Procedures"
          badgeType="accent"
        />

        {/* Ethical Non-Transactional Guardrail */}
        <div
          role="note"
          aria-label="Important information regarding address change planner"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-main)',
            borderRadius: '0.75rem',
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
          }}
        >
          <ShieldCheck size={20} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text-primary)' }}>
              Non-Transactional Planning Guardrail:
            </strong>{' '}
            Civic Help Setu coordinates official address update checklists and document requirements without accessing government portal logins, collecting passwords or Aadhaar OTPs, or submitting applications on your behalf.
          </div>
        </div>

        {/* Stale Data & Provenance Notice */}
        <AddressChangeStaleNotice lastVerifiedDate="2026-03-01" />

        {loadError ? (
          <AddressChangeErrorState error={loadError} onRetry={() => setLoadError(null)} />
        ) : isLoading ? (
          <AddressChangeSkeleton />
        ) : (
          <>
            {/* Step 1: Relocation Scope Wizard */}
            <MoveTypeSelector
              moveType={planState.moveType}
              originState={planState.originState}
              destinationState={planState.destinationState}
              onChangeMoveType={handleMoveTypeChange}
              onChangeOriginState={handleOriginStateChange}
              onChangeDestinationState={handleDestinationStateChange}
            />

            {/* Step 2: Record Selector */}
            <RecordSelector
              selectedRecordIds={planState.selectedRecordIds}
              onToggleRecord={handleToggleRecord}
              onSelectAll={handleSelectAll}
              onClearAll={handleClearAll}
            />

            {/* Step 3: Action Planner Board */}
            <ActionPlannerBoard
              records={applicableRecords}
              planState={planState}
              onUpdateProgress={handleUpdateProgress}
              onOpenDetails={setSelectedRecordForDetails}
              onOpenCorrection={setSelectedRecordForCorrection}
              onOpenPrintReport={() => setIsPrintModalOpen(true)}
            />

            {/* Data Management & Deletion Bar */}
            <div
              style={{
                marginTop: '2rem',
                borderTop: '1px solid var(--border-light, #e5e7eb)',
                paddingTop: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Saved locally on your device • Revision {planState.rev}
                {planState.updatedAt && ` • Last saved: ${new Date(planState.updatedAt).toLocaleTimeString()}`}
              </div>

              <button
                type="button"
                onClick={() => setIsConfirmDeleteOpen(true)}
                className="btn btn-secondary"
                style={{
                  fontSize: '0.8rem',
                  color: '#dc2626',
                  borderColor: '#fca5a5',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <Trash2 size={14} /> Delete My Checklist Data
              </button>
            </div>
          </>
        )}

        {/* Modal: Record Details & Proofs */}
        {selectedRecordForDetails && (
          <RecordDetailModal
            record={selectedRecordForDetails}
            onClose={() => setSelectedRecordForDetails(null)}
          />
        )}

        {/* Modal: Printable Report */}
        {isPrintModalOpen && (
          <AddressChangePrintReportModal
            records={applicableRecords}
            planState={planState}
            readiness={readiness}
            onClose={() => setIsPrintModalOpen(false)}
          />
        )}

        {/* Modal: Community Correction */}
        {selectedRecordForCorrection && (
          <AddressChangeCorrectionModal
            record={selectedRecordForCorrection}
            onClose={() => setSelectedRecordForCorrection(null)}
          />
        )}

        {/* Modal: Confirm Delete Plan Data */}
        {isConfirmDeleteOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-delete-title"
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
              zIndex: 1070,
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-main)',
                color: 'var(--text-primary)',
                borderRadius: '0.75rem',
                padding: '1.5rem',
                maxWidth: '450px',
                width: '100%',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <h3 id="confirm-delete-title" style={{ fontSize: '1.1rem', fontWeight: 700, color: '#dc2626', margin: '0 0 0.5rem 0' }}>
                Delete Saved Checklist Data?
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.45 }}>
                This will permanently delete all your tracked application reference numbers (URNs), dates, and checklist statuses from your browser storage. This action cannot be undone.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsConfirmDeleteOpen(false)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.85rem' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeletePlan}
                  className="btn btn-primary"
                  style={{ fontSize: '0.85rem', backgroundColor: '#dc2626', borderColor: '#dc2626' }}
                >
                  Yes, Permanently Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

