import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText,
  CheckSquare,
  Bookmark,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Trash2,
  Plus,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import {
  listDrafts,
  createDraft,
  updateDraft,
  deleteDraft,
  DRAFT_TYPES,
} from '../services/citizenDraftService';
import {
  getPendingOperations,
  getConflictRecords,
  resolveConflict,
  processSyncQueue,
  RESOLUTION_STRATEGIES,
  CONFLICT_STATUS,
  RULESET_VERSION,
} from '../services/citizenDraftSyncEngine';
import {
  recoverInterruptedUploads,
  getPendingOperationsSummary,
  getProvenanceLabel,
  PROVENANCE_TYPES,
  migrateAllLocalDrafts,
} from '../services/civicDraftSyncExtension';

// ---------------------------------------------------------------------------
// PROVENANCE BADGE COMPONENT
// Keeps citizen-entered, official, AI, and community data visibly distinct.
// ---------------------------------------------------------------------------
const ProvenanceBadge = ({ provenanceType }) => {
  const label = getProvenanceLabel(provenanceType);
  const colorMap = {
    [PROVENANCE_TYPES.CITIZEN]: { bg: '#e8f5e9', text: '#2e7d32', border: '#a5d6a7' },
    [PROVENANCE_TYPES.OFFICIAL]: { bg: '#e3f2fd', text: '#1565c0', border: '#90caf9' },
    [PROVENANCE_TYPES.AI_SUGGESTION]: { bg: '#fff8e1', text: '#f57f17', border: '#ffe082' },
    [PROVENANCE_TYPES.COMMUNITY]: { bg: '#f3e5f5', text: '#6a1b9a', border: '#ce93d8' },
  };
  const style = colorMap[provenanceType] || { bg: '#f5f5f5', text: '#616161', border: '#e0e0e0' };
  return (
    <span
      aria-label={`Data source: ${label}`}
      style={{
        display: 'inline-block',
        fontSize: '0.7rem',
        fontWeight: '600',
        padding: '0.15rem 0.5rem',
        borderRadius: '1rem',
        background: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
        marginLeft: '0.4rem',
        verticalAlign: 'middle',
      }}
    >
      {label}
    </span>
  );
};

const CitizenDraftSyncWorkspace = () => {
  const { user } = useAuth();
  const { isOnline: networkIsOnline } = useNetwork();

  // Connectivity override for testing offline transitions
  const [offlineSimulated, setOfflineSimulated] = useState(false);
  const effectiveOnline = networkIsOnline && !offlineSimulated;

  // Interrupted-upload recovery & schema migration on mount
  useEffect(() => {
    try {
      migrateAllLocalDrafts();
      const rescued = recoverInterruptedUploads();
      if (rescued > 0) {
        // Will be announced when pendingOps refresh picks them up
        setPendingOps(getPendingOperations() || []);
      }
    } catch {
      // Non-fatal: continue without recovery
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Interrupted-upload summary (drives the "Interrupted uploads" banner)
  const [interruptedSummary, setInterruptedSummary] = useState(() => {
    try {
      return getPendingOperationsSummary();
    } catch {
      return { pendingCount: 0, inFlightCount: 0, failedCount: 0, hasInterrupted: false, total: 0 };
    }
  });

  // Tabs & Views (Automatically activates conflicts tab if unresolved conflicts exist)
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const initialConflicts = getConflictRecords({ status: CONFLICT_STATUS.UNRESOLVED }) || [];
      return initialConflicts.length > 0 ? 'conflicts' : 'drafts';
    } catch {
      return 'drafts';
    }
  });
  const [draftTypeFilter, setDraftTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Domain Data State (Lazily initialized from local storage)
  const [drafts, setDrafts] = useState(() => {
    try {
      return listDrafts({ limit: 100 }).items || [];
    } catch {
      return [];
    }
  });
  const [conflicts, setConflicts] = useState(() => {
    try {
      return getConflictRecords({ status: CONFLICT_STATUS.UNRESOLVED }) || [];
    } catch {
      return [];
    }
  });
  const [pendingOps, setPendingOps] = useState(() => {
    try {
      return getPendingOperations() || [];
    } catch {
      return [];
    }
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [announcement, setAnnouncement] = useState('');

  // Draft Creation Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDraftType, setNewDraftType] = useState(DRAFT_TYPES.CHECKLIST);
  const [newDraftTitle, setNewDraftTitle] = useState('');
  const [newDraftNotes, setNewDraftNotes] = useState('');
  const [newDraftItemsText, setNewDraftItemsText] = useState('');

  // Conflict Resolution Workspace State
  const [selectedConflict, setSelectedConflict] = useState(() => {
    try {
      const initialConflicts = getConflictRecords({ status: CONFLICT_STATUS.UNRESOLVED }) || [];
      return initialConflicts.length > 0 ? initialConflicts[0] : null;
    } catch {
      return null;
    }
  });
  const [fieldChoices, setFieldChoices] = useState(() => {
    try {
      const initialConflicts = getConflictRecords({ status: CONFLICT_STATUS.UNRESOLVED }) || [];
      if (initialConflicts.length > 0 && Array.isArray(initialConflicts[0].conflictFields)) {
        const choices = {};
        initialConflicts[0].conflictFields.forEach((field) => {
          choices[field] = 'local';
        });
        return choices;
      }
      return {};
    } catch {
      return {};
    }
  });
  const [customFieldEdits, setCustomFieldEdits] = useState(() => {
    try {
      const initialConflicts = getConflictRecords({ status: CONFLICT_STATUS.UNRESOLVED }) || [];
      if (initialConflicts.length > 0 && Array.isArray(initialConflicts[0].conflictFields)) {
        const edits = {};
        initialConflicts[0].conflictFields.forEach((field) => {
          const val = initialConflicts[0].localData?.[field];
          edits[field] = typeof val === 'string' ? val : (val !== undefined ? JSON.stringify(val) : '');
        });
        return edits;
      }
      return {};
    } catch {
      return {};
    }
  });

  // Screen reader announcer helper
  const announce = useCallback((msg) => {
    setAnnouncement(msg);
  }, []);

  // ---------------------------------------------------------------------------
  // DATA REFRESH
  // ---------------------------------------------------------------------------

  const refreshAll = useCallback(() => {
    try {
      setErrorMessage(null);

      const draftsResult = listDrafts({
        draftType: draftTypeFilter === 'all' ? null : draftTypeFilter,
        actorId: user?.id || null,
        limit: 100,
      });
      setDrafts(draftsResult.items || []);

      const conflictList = getConflictRecords({ status: CONFLICT_STATUS.UNRESOLVED });
      setConflicts(conflictList);

      const ops = getPendingOperations();
      setPendingOps(ops);

      // Refresh interrupted-upload summary
      try {
        setInterruptedSummary(getPendingOperationsSummary());
      } catch {
        // non-fatal
      }

      if (conflictList.length > 0) {
        setSelectedConflict((current) => {
          if (!current) return conflictList[0];
          const exists = conflictList.find((c) => c.id === current.id);
          return exists || conflictList[0];
        });
      } else {
        setSelectedConflict(null);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load local draft data');
    }
  }, [draftTypeFilter, user]);

  // ---------------------------------------------------------------------------
  // SYNC ACTION
  // ---------------------------------------------------------------------------

  const handleSyncNow = useCallback(async () => {
    if (!effectiveOnline) {
      announce('Cannot sync: device is offline or offline mode is simulated.');
      return;
    }

    try {
      setIsSyncing(true);
      announce('Synchronization started...');
      const result = await processSyncQueue({
        deviceId: 'citizen_browser',
        actorId: user?.id || 'citizen',
      });

      refreshAll();

      if (result.conflictsCount > 0) {
        announce(`Sync completed with ${result.conflictsCount} conflict requiring your resolution.`);
        setActiveTab('conflicts');
      } else {
        announce(`Synchronization complete. Applied ${result.appliedCount} updates.`);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Synchronization failed');
      announce(`Sync error: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  }, [effectiveOnline, announce, refreshAll, user]);

  // Listen to browser network reconnection
  useEffect(() => {
    const handleBrowserOnline = () => {
      if (pendingOps.length > 0 && !offlineSimulated) {
        handleSyncNow();
      }
    };

    window.addEventListener('online', handleBrowserOnline);
    return () => window.removeEventListener('online', handleBrowserOnline);
  }, [pendingOps.length, offlineSimulated, handleSyncNow]);

  // ---------------------------------------------------------------------------
  // DRAFT CREATION
  // ---------------------------------------------------------------------------

  const handleCreateDraft = async (e) => {
    e.preventDefault();
    if (!newDraftTitle.trim()) return;

    try {
      let initialData = {};
      if (newDraftType === DRAFT_TYPES.CHECKLIST) {
        const lines = newDraftItemsText
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);
        initialData = {
          title: newDraftTitle.trim(),
          items: lines.map((label, idx) => ({ id: `item_${idx}`, label, completed: false })),
          notes: newDraftNotes.trim(),
        };
      } else if (newDraftType === DRAFT_TYPES.APPLICATION_DRAFT) {
        initialData = {
          serviceName: newDraftTitle.trim(),
          applicantName: user?.email || 'Citizen Applicant',
          targetJurisdiction: 'State Municipal Authority',
          notes: newDraftNotes.trim(),
          formData: {},
        };
      } else {
        initialData = {
          title: newDraftTitle.trim(),
          content: newDraftNotes.trim(),
          category: 'Citizen Draft Note',
        };
      }

      await createDraft(newDraftType, initialData, {
        isOnline: effectiveOnline,
        storage: null,
      });

      announce(`Draft "${newDraftTitle}" saved successfully.`);
      setShowCreateModal(false);
      setNewDraftTitle('');
      setNewDraftNotes('');
      setNewDraftItemsText('');
      refreshAll();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to create draft');
    }
  };

  const handleDeleteDraft = async (draftId, draftTitle) => {
    if (!window.confirm(`Are you sure you want to delete draft "${draftTitle}"?`)) return;

    try {
      await deleteDraft(draftId, {
        isOnline: effectiveOnline,
        reason: 'Deleted by user from workspace',
      });
      announce(`Draft "${draftTitle}" removed.`);
      refreshAll();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to delete draft');
    }
  };

  const handleToggleChecklistItem = async (draft, itemIndex) => {
    const updatedItems = (draft.items || []).map((it, idx) =>
      idx === itemIndex ? { ...it, completed: !it.completed } : it
    );
    try {
      await updateDraft(
        draft.id,
        { items: updatedItems },
        { isOnline: effectiveOnline, expectedRevision: draft.revision }
      );
      announce(`Checklist item updated in draft "${draft.title}".`);
      refreshAll();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to update draft item');
    }
  };

  // ---------------------------------------------------------------------------
  // CONFLICT RESOLUTION HANDLERS
  // ---------------------------------------------------------------------------

  const handleSelectConflict = (conflict) => {
    setSelectedConflict(conflict);
    const initialChoices = {};
    const initialEdits = {};
    (conflict?.conflictFields || []).forEach((field) => {
      initialChoices[field] = 'local';
      initialEdits[field] = conflict.localData?.[field] ?? '';
    });
    setFieldChoices(initialChoices);
    setCustomFieldEdits(initialEdits);
  };

  const handleResolveKeep = (strategy) => {
    if (!selectedConflict) return;

    try {
      resolveConflict(selectedConflict.id, {
        strategy,
        resolvedBy: user?.id || 'citizen',
        reason: strategy === RESOLUTION_STRATEGIES.KEEP_LOCAL ? 'Citizen kept local copy' : 'Citizen accepted remote version',
      });

      const updated = getConflictRecords({ status: CONFLICT_STATUS.UNRESOLVED });
      setConflicts(updated);

      if (updated.length === 0) {
        setSelectedConflict(null);
        setFieldChoices({});
        setCustomFieldEdits({});
        announce(`Conflict resolved using ${strategy === RESOLUTION_STRATEGIES.KEEP_LOCAL ? 'local changes' : 'server version'}. All conflicts resolved!`);
        setActiveTab('drafts');
      } else {
        handleSelectConflict(updated[0]);
        announce(`Conflict resolved using ${strategy === RESOLUTION_STRATEGIES.KEEP_LOCAL ? 'local changes' : 'server version'}. Next conflict loaded.`);
      }

      refreshAll();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to resolve conflict');
    }
  };

  const handleResolveCustomMerge = () => {
    if (!selectedConflict) return;

    try {
      const mergedPayload = {
        ...selectedConflict.remoteData,
        ...selectedConflict.localData,
      };

      (selectedConflict.conflictFields || []).forEach((field) => {
        const choice = fieldChoices[field];
        if (choice === 'remote') {
          mergedPayload[field] = selectedConflict.remoteData?.[field];
        } else if (choice === 'local') {
          mergedPayload[field] = selectedConflict.localData?.[field];
        } else {
          mergedPayload[field] = customFieldEdits[field] !== undefined ? customFieldEdits[field] : (selectedConflict.localData?.[field] ?? selectedConflict.remoteData?.[field]);
        }
      });

      resolveConflict(selectedConflict.id, {
        strategy: RESOLUTION_STRATEGIES.MANUAL_MERGE,
        resolvedData: mergedPayload,
        resolvedBy: user?.id || 'citizen',
        reason: 'Citizen confirmed field-level merge',
      });

      const updated = getConflictRecords({ status: CONFLICT_STATUS.UNRESOLVED });
      setConflicts(updated);

      if (updated.length === 0) {
        setSelectedConflict(null);
        setFieldChoices({});
        setCustomFieldEdits({});
        announce('Custom field-level merge finalized. All conflicts resolved!');
        setActiveTab('drafts');
      } else {
        handleSelectConflict(updated[0]);
        announce('Custom field-level merge finalized. Next conflict loaded.');
      }

      refreshAll();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to finalize merge');
    }
  };

  // Filtered drafts
  const filteredDrafts = useMemo(() => {
    if (!searchQuery.trim()) return drafts;
    const q = searchQuery.toLowerCase();
    return drafts.filter((d) => {
      const title = (d.title || d.serviceName || '').toLowerCase();
      const notes = (d.notes || d.content || '').toLowerCase();
      return title.includes(q) || notes.includes(q);
    });
  }, [drafts, searchQuery]);

  return (
    <div className="section" style={{ minHeight: '80vh', padding: '2rem 1rem' }}>
      {/* Screen Reader Live Announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      <div className="container" style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {/* HEADER & CONNECTIVITY BAR */}
        <header
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            paddingBottom: '1.5rem',
            borderBottom: '1px solid var(--border-main)',
            marginBottom: '1.5rem',
          }}
        >
          <div>
            <h1
              style={{
                fontSize: '1.75rem',
                fontWeight: '700',
                margin: 0,
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
              }}
            >
              <FileText size={28} color="var(--primary)" aria-hidden="true" />
              Citizen Drafts & Offline Sync
            </h1>
            <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Prepare checklists, draft applications, and saved notes with zero data loss during intermittent connectivity.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* Connectivity Badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.4rem 0.8rem',
                borderRadius: '99px',
                fontSize: '0.85rem',
                fontWeight: '600',
                background: effectiveOnline ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                color: effectiveOnline ? '#16a34a' : '#dc2626',
                border: `1px solid ${effectiveOnline ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              }}
            >
              {effectiveOnline ? (
                <>
                  <Wifi size={16} aria-hidden="true" />
                  <span>Online</span>
                </>
              ) : (
                <>
                  <WifiOff size={16} aria-hidden="true" />
                  <span>Offline Mode</span>
                </>
              )}
            </div>

            {/* Offline Simulation Toggle for Manual Validation */}
            <button
              type="button"
              onClick={() => {
                const nextState = !offlineSimulated;
                setOfflineSimulated(nextState);
                announce(nextState ? 'Offline simulation enabled' : 'Offline simulation disabled');
              }}
              style={{
                padding: '0.45rem 0.85rem',
                fontSize: '0.8rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-main)',
                background: offlineSimulated ? 'var(--text-primary)' : 'var(--bg-card)',
                color: offlineSimulated ? 'var(--bg-main)' : 'var(--text-primary)',
                cursor: 'pointer',
                fontWeight: '500',
              }}
              aria-pressed={offlineSimulated}
            >
              {offlineSimulated ? 'Exit Offline Sim' : 'Simulate Airplane Mode'}
            </button>

            {/* Sync Now Button */}
            <button
              type="button"
              onClick={handleSyncNow}
              disabled={isSyncing || !effectiveOnline}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 1rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: 'var(--primary)',
                color: '#ffffff',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: effectiveOnline && !isSyncing ? 'pointer' : 'not-allowed',
                opacity: effectiveOnline && !isSyncing ? 1 : 0.6,
              }}
              aria-label="Synchronize pending operations with server"
            >
              <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} aria-hidden="true" />
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        </header>

        {/* ERROR STATE */}
        {errorMessage && (
          <div
            role="alert"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              padding: '0.85rem 1.25rem',
              borderRadius: '0.5rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#dc2626',
              marginBottom: '1.25rem',
              fontSize: '0.9rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <AlertTriangle size={18} aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={refreshAll}
              style={{
                background: 'transparent',
                border: '1px solid currentColor',
                color: 'inherit',
                borderRadius: '0.25rem',
                padding: '0.2rem 0.6rem',
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* TABS NAVIGATION */}
        {/* INTERRUPTED UPLOAD RECOVERY BANNER */}
        {interruptedSummary.hasInterrupted && (
          <div
            role="status"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              padding: '0.75rem 1.25rem',
              borderRadius: '0.5rem',
              background: 'rgba(234, 179, 8, 0.1)',
              border: '1px solid rgba(234, 179, 8, 0.4)',
              color: '#854d0e',
              marginBottom: '1rem',
              fontSize: '0.875rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={16} aria-hidden="true" />
              <span>
                <strong>Interrupted uploads detected.</strong> {interruptedSummary.inFlightCount} upload(s) were interrupted when you last closed this page and have been reset for retry.
              </span>
            </div>
            {effectiveOnline && (
              <button
                type="button"
                onClick={handleSyncNow}
                disabled={isSyncing}
                style={{ padding: '0.25rem 0.75rem', borderRadius: '0.4rem', border: 'none', background: '#b45309', color: '#fff', fontSize: '0.8rem', cursor: 'pointer', fontWeight: '600' }}
              >
                Retry Now
              </button>
            )}
          </div>
        )}

        {/* TABS NAVIGATION */}
        <nav
          aria-label="Draft Workspace Sections"
          style={{
            display: 'flex',
            gap: '0.5rem',
            borderBottom: '2px solid var(--border-main)',
            marginBottom: '1.5rem',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('drafts')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.25rem',
              border: 'none',
              background: 'transparent',
              color: activeTab === 'drafts' ? 'var(--primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'drafts' ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: '-2px',
              fontWeight: activeTab === 'drafts' ? '700' : '500',
              cursor: 'pointer',
              fontSize: '0.95rem',
            }}
            aria-selected={activeTab === 'drafts'}
            role="tab"
          >
            <Bookmark size={18} aria-hidden="true" />
            My Drafts ({drafts.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('conflicts')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.25rem',
              border: 'none',
              background: 'transparent',
              color: conflicts.length > 0 ? '#dc2626' : (activeTab === 'conflicts' ? 'var(--primary)' : 'var(--text-secondary)'),
              borderBottom: activeTab === 'conflicts' ? (conflicts.length > 0 ? '2px solid #dc2626' : '2px solid var(--primary)') : '2px solid transparent',
              marginBottom: '-2px',
              fontWeight: activeTab === 'conflicts' ? '700' : '500',
              cursor: 'pointer',
              fontSize: '0.95rem',
            }}
            aria-selected={activeTab === 'conflicts'}
            role="tab"
          >
            <AlertTriangle size={18} aria-hidden="true" />
            Conflicts ({conflicts.length})
            {conflicts.length > 0 && (
              <span
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  fontSize: '0.7rem',
                  padding: '0.1rem 0.4rem',
                  borderRadius: '99px',
                }}
              >
                Action Needed: Resolve Conflict ({conflicts.length})
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('queue')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.25rem',
              border: 'none',
              background: 'transparent',
              color: activeTab === 'queue' ? 'var(--primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'queue' ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: '-2px',
              fontWeight: activeTab === 'queue' ? '700' : '500',
              cursor: 'pointer',
              fontSize: '0.95rem',
            }}
            aria-selected={activeTab === 'queue'}
            role="tab"
          >
            <Clock size={18} aria-hidden="true" />
            Offline Queue ({pendingOps.length})
          </button>
        </nav>

        {/* ------------------------------------------------------------------ */}
        {/* TAB 1: DRAFTS LIST & CREATOR                                      */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'drafts' && (
          <section aria-labelledby="drafts-heading">
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
                marginBottom: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Search drafts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    padding: '0.5rem 0.85rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-main)',
                    background: 'var(--bg-main)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    minWidth: '220px',
                  }}
                  aria-label="Search drafts by title or note content"
                />

                <select
                  value={draftTypeFilter}
                  onChange={(e) => setDraftTypeFilter(e.target.value)}
                  style={{
                    padding: '0.5rem 0.85rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-main)',
                    background: 'var(--bg-main)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                  aria-label="Filter drafts by type"
                >
                  <option value="all">All Types</option>
                  <option value={DRAFT_TYPES.CHECKLIST}>Checklists</option>
                  <option value={DRAFT_TYPES.APPLICATION_DRAFT}>Application Drafts</option>
                  <option value={DRAFT_TYPES.SAVED_NOTE}>Saved Notes</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  background: 'var(--primary)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                <Plus size={16} aria-hidden="true" />
                New Draft
              </button>
            </div>

            {/* EMPTY STATE */}
            {filteredDrafts.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '3rem 1.5rem',
                  borderRadius: '0.75rem',
                  border: '1px dashed var(--border-main)',
                  background: 'var(--bg-card)',
                }}
              >
                <CheckSquare size={48} color="var(--text-tertiary)" style={{ margin: '0 auto 1rem' }} aria-hidden="true" />
                <h2 style={{ fontSize: '1.15rem', margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>No Drafts Found</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '450px', margin: '0 auto 1.25rem' }}>
                  You do not have any drafts in this category. You can prepare documents, checklists, or application notes even while completely offline.
                </p>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  style={{
                    padding: '0.5rem 1.25rem',
                    borderRadius: '0.5rem',
                    background: 'var(--primary)',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Create First Draft
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                {filteredDrafts.map((d) => (
                  <article
                    key={d.id}
                    style={{
                      borderRadius: '0.75rem',
                      border: '1px solid var(--border-main)',
                      background: 'var(--bg-card)',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '0.25rem',
                            background: 'rgba(59, 130, 246, 0.1)',
                            color: '#2563eb',
                          }}
                        >
                          {d.entityType}
                        </span>

                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            color: d.syncStatus === 'SYNCED' ? '#16a34a' : (d.syncStatus === 'CONFLICTED' ? '#dc2626' : '#d97706'),
                          }}
                        >
                          {d.syncStatus === 'SYNCED' ? (
                            <>
                              <CheckCircle size={14} aria-hidden="true" /> Synced (Rev {d.revision || 1})
                            </>
                          ) : d.syncStatus === 'CONFLICTED' ? (
                            <>
                              <AlertTriangle size={14} aria-hidden="true" /> Conflicted
                            </>
                          ) : (
                            <>
                              <Clock size={14} aria-hidden="true" /> Queued Offline
                            </>
                          )}
                        </span>
                      </div>

                      <h2 style={{ fontSize: '1.1rem', fontWeight: '600', margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>
                        {d.title || d.serviceName}
                      </h2>

                      {d.notes && (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem', lineHeight: '1.4' }}>
                          {d.notes}
                        </p>
                      )}

                      {d.syncStatus === 'CONFLICTED' && (
                        <div style={{ marginTop: '0.4rem', marginBottom: '0.6rem' }}>
                          <button
                            type="button"
                            onClick={() => {
                              const conf = conflicts.find((c) => c.recordId === d.id || c.id === d.conflictId);
                              if (conf) handleSelectConflict(conf);
                              setActiveTab('conflicts');
                            }}
                            style={{
                              padding: '0.35rem 0.75rem',
                              fontSize: '0.75rem',
                              fontWeight: '700',
                              color: '#dc2626',
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              borderRadius: '0.35rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                            }}
                            aria-label={`Resolve conflict for ${d.title || d.serviceName}`}
                          >
                            <AlertTriangle size={12} aria-hidden="true" />
                            Resolve Conflict &rarr;
                          </button>
                        </div>
                      )}

                      {d.items && Array.isArray(d.items) && (
                        <div style={{ margin: '0.5rem 0', fontSize: '0.8rem' }}>
                          <div style={{ color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                            <strong>{d.items.filter((i) => i.completed).length}/{d.items.length}</strong> items completed
                          </div>
                          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {d.items.map((item, idx) => (
                              <li key={item.id || idx} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: '0.2rem 0' }}>
                                <input
                                  type="checkbox"
                                  id={`chk-${d.id}-${idx}`}
                                  checked={Boolean(item.completed)}
                                  onChange={() => handleToggleChecklistItem(d, idx)}
                                  style={{ cursor: 'pointer' }}
                                />
                                <label
                                  htmlFor={`chk-${d.id}-${idx}`}
                                  style={{
                                    fontSize: '0.8rem',
                                    color: item.completed ? 'var(--text-tertiary)' : 'var(--text-primary)',
                                    textDecoration: item.completed ? 'line-through' : 'none',
                                    cursor: 'pointer',
                                  }}
                                >
                                  {item.label}
                                </label>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingTop: '0.75rem',
                        borderTop: '1px solid var(--border-main)',
                        marginTop: '0.75rem',
                      }}
                    >
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        Updated {d.updatedAt ? new Date(d.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                      </span>

                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteDraft(d.id, d.title || d.serviceName)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#dc2626',
                            cursor: 'pointer',
                            padding: '0.3rem',
                            borderRadius: '0.25rem',
                          }}
                          aria-label={`Delete draft ${d.title || d.serviceName}`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 2: CONFLICT RESOLUTION WORKSPACE                              */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'conflicts' && (
          <section aria-labelledby="conflicts-heading">
            {conflicts.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '3rem 1.5rem',
                  borderRadius: '0.75rem',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-main)',
                }}
              >
                <CheckCircle size={44} color="#16a34a" style={{ margin: '0 auto 1rem' }} aria-hidden="true" />
                <h2 style={{ fontSize: '1.15rem', margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>No Active Conflicts</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '450px', margin: '0 auto' }}>
                  All your offline mutations and remote revisions are cleanly synchronized without divergence.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) 2fr', gap: '1.5rem' }}>
                {/* Conflict Selection List */}
                <aside aria-label="Conflicted Drafts List">
                  <h2 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                    Unresolved Conflicts ({conflicts.length})
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {conflicts.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectConflict(c)}
                        style={{
                          textAlign: 'left',
                          padding: '0.85rem 1rem',
                          borderRadius: '0.5rem',
                          border: `1px solid ${selectedConflict?.id === c.id ? '#dc2626' : 'var(--border-main)'}`,
                          background: selectedConflict?.id === c.id ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-card)',
                          cursor: 'pointer',
                        }}
                        aria-label="Select to Resolve Conflict"
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                            Record: {c.recordId.substring(0, 12)}...
                          </span>
                          <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#dc2626' }}>
                            Resolve Conflict &rarr;
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: '500', marginTop: '0.25rem' }}>
                          {c.conflictFields?.length} conflicting field(s)
                        </div>
                      </button>
                    ))}
                  </div>
                </aside>

                {/* Conflict Comparison & Resolution Engine */}
                {selectedConflict && (
                  <div
                    style={{
                      borderRadius: '0.75rem',
                      border: '1px solid var(--border-main)',
                      background: 'var(--bg-card)',
                      padding: '1.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h2 style={{ fontSize: '1.2rem', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>
                        Three-Way Merge Resolution
                      </h2>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        Ruleset: {selectedConflict.explanation?.rulesetVersion || RULESET_VERSION}
                      </span>
                    </div>

                    {/* Explainability Banner */}
                    {selectedConflict.explanation && (
                      <div
                        style={{
                          background: 'rgba(245, 158, 11, 0.1)',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          borderRadius: '0.5rem',
                          padding: '0.85rem 1rem',
                          marginBottom: '1.25rem',
                          fontSize: '0.85rem',
                          color: '#b45309',
                          lineHeight: '1.4',
                        }}
                      >
                        <strong>Automated Recommendation Rationale:</strong>
                        <p style={{ margin: '0.25rem 0 0' }}>
                          {selectedConflict.explanation.rationale}
                        </p>
                      </div>
                    )}

                    {/* Quick Strategy Buttons */}
                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => handleResolveKeep(RESOLUTION_STRATEGIES.KEEP_LOCAL)}
                        style={{
                          padding: '0.45rem 0.9rem',
                          borderRadius: '0.35rem',
                          border: '1px solid var(--border-main)',
                          background: 'var(--bg-main)',
                          color: 'var(--text-primary)',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                        aria-label="Resolve Conflict: Keep Local"
                      >
                        Resolve Conflict: Keep Local
                      </button>

                      <button
                        type="button"
                        onClick={() => handleResolveKeep(RESOLUTION_STRATEGIES.KEEP_REMOTE)}
                        style={{
                          padding: '0.45rem 0.9rem',
                          borderRadius: '0.35rem',
                          border: '1px solid var(--border-main)',
                          background: 'var(--bg-main)',
                          color: 'var(--text-primary)',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                        aria-label="Resolve Conflict: Keep Server"
                      >
                        Resolve Conflict: Keep Server
                      </button>
                    </div>

                    {/* Field-by-Field Merge Comparison */}
                    <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                      Field-by-Field Merge Choices
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                      {(selectedConflict.conflictFields || []).map((field) => (
                        <div
                          key={field}
                          style={{
                            border: '1px solid var(--border-main)',
                            borderRadius: '0.5rem',
                            padding: '1rem',
                            background: 'var(--bg-main)',
                          }}
                        >
                          <div style={{ fontWeight: '700', fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                            Property: <code>{field}</code>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                            {/* Local Version Card */}
                            <div
                              onClick={() => {
                                setFieldChoices((prev) => ({ ...prev, [field]: 'local' }));
                                setCustomFieldEdits((prev) => ({
                                  ...prev,
                                  [field]: typeof selectedConflict.localData?.[field] === 'string'
                                    ? selectedConflict.localData[field]
                                    : (selectedConflict.localData?.[field] !== undefined ? JSON.stringify(selectedConflict.localData[field]) : '')
                                }));
                              }}
                              style={{
                                padding: '0.75rem',
                                borderRadius: '0.35rem',
                                border: `2px solid ${(fieldChoices[field] ?? 'local') === 'local' ? '#2563eb' : 'var(--border-main)'}`,
                                background: (fieldChoices[field] ?? 'local') === 'local' ? 'rgba(37, 99, 235, 0.05)' : 'var(--bg-card)',
                                cursor: 'pointer',
                              }}
                            >
                              <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#2563eb', marginBottom: '0.25rem' }}>
                                Local (Your Edit) {(fieldChoices[field] ?? 'local') === 'local' && '✓ Selected'}
                              </div>
                              <pre style={{ margin: 0, fontSize: '0.8rem', whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>
                                {JSON.stringify(selectedConflict.localData?.[field], null, 2)}
                              </pre>
                            </div>

                            {/* Remote Version Card */}
                            <div
                              onClick={() => {
                                setFieldChoices((prev) => ({ ...prev, [field]: 'remote' }));
                                setCustomFieldEdits((prev) => ({
                                  ...prev,
                                  [field]: typeof selectedConflict.remoteData?.[field] === 'string'
                                    ? selectedConflict.remoteData[field]
                                    : (selectedConflict.remoteData?.[field] !== undefined ? JSON.stringify(selectedConflict.remoteData[field]) : '')
                                }));
                              }}
                              style={{
                                padding: '0.75rem',
                                borderRadius: '0.35rem',
                                border: `2px solid ${fieldChoices[field] === 'remote' ? '#16a34a' : 'var(--border-main)'}`,
                                background: fieldChoices[field] === 'remote' ? 'rgba(22, 163, 74, 0.05)' : 'var(--bg-card)',
                                cursor: 'pointer',
                              }}
                            >
                              <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#16a34a', marginBottom: '0.25rem' }}>
                                Server (Remote Rev {selectedConflict.remoteRevision}) {fieldChoices[field] === 'remote' && '✓ Selected'}
                              </div>
                              <pre style={{ margin: 0, fontSize: '0.8rem', whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>
                                {JSON.stringify(selectedConflict.remoteData?.[field], null, 2)}
                              </pre>
                            </div>
                          </div>

                          <div style={{ marginTop: '0.75rem' }}>
                            <label
                              htmlFor={`custom-merge-${field}`}
                              style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}
                            >
                              Merged Value for {field} (Optionally edit directly before final merge):
                            </label>
                            <textarea
                              id={`custom-merge-${field}`}
                              rows={2}
                              value={
                                customFieldEdits[field] !== undefined
                                  ? customFieldEdits[field]
                                  : (fieldChoices[field] === 'remote'
                                      ? (typeof selectedConflict.remoteData?.[field] === 'string' ? selectedConflict.remoteData[field] : JSON.stringify(selectedConflict.remoteData?.[field]))
                                      : (typeof selectedConflict.localData?.[field] === 'string' ? selectedConflict.localData[field] : JSON.stringify(selectedConflict.localData?.[field])))
                              }
                              onChange={(e) => {
                                const val = e.target.value;
                                setCustomFieldEdits((prev) => ({ ...prev, [field]: val }));
                                setFieldChoices((prev) => ({ ...prev, [field]: 'custom' }));
                              }}
                              style={{
                                width: '100%',
                                padding: '0.45rem 0.65rem',
                                borderRadius: '0.35rem',
                                border: '1px solid var(--border-main)',
                                background: 'var(--bg-main)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                fontFamily: 'inherit',
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleResolveCustomMerge}
                      style={{
                        padding: '0.6rem 1.25rem',
                        borderRadius: '0.5rem',
                        background: 'var(--primary)',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: '700',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                      }}
                      aria-label="Resolve Conflict"
                    >
                      Resolve Conflict & Confirm Merge
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 3: OFFLINE QUEUE MONITOR                                      */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'queue' && (
          <section aria-labelledby="queue-heading">
            <h2 id="queue-heading" style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              Staged Offline Operations ({pendingOps.length})
            </h2>

            {pendingOps.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '3rem 1.5rem',
                  borderRadius: '0.75rem',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-main)',
                }}
              >
                <CheckCircle size={44} color="#16a34a" style={{ margin: '0 auto 1rem' }} aria-hidden="true" />
                <h3 style={{ fontSize: '1.15rem', margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>Queue Clean</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '450px', margin: '0 auto' }}>
                  No pending mutations are waiting in local storage. All draft changes have been committed.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    textAlign: 'left',
                    fontSize: '0.85rem',
                    background: 'var(--bg-card)',
                    borderRadius: '0.5rem',
                    overflow: 'hidden',
                    border: '1px solid var(--border-main)',
                  }}
                >
                  <caption className="sr-only">List of pending offline sync operations</caption>
                  <thead>
                    <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-main)' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>Op ID</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Type</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Entity</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Queued At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingOps.map((op) => (
                      <tr key={op.id} style={{ borderBottom: '1px solid var(--border-main)' }}>
                        <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace' }}>{op.id.substring(0, 8)}...</td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>{op.operationType}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>{op.entityType} ({op.entityId.substring(0, 8)})</td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span
                            style={{
                              padding: '0.2rem 0.5rem',
                              borderRadius: '0.25rem',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              background: op.status === 'FAILED' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                              color: op.status === 'FAILED' ? '#dc2626' : '#d97706',
                            }}
                          >
                            {op.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-tertiary)' }}>
                          {new Date(op.createdAt).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* CREATE DRAFT MODAL                                                */}
        {/* ------------------------------------------------------------------ */}
        {showCreateModal && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-draft-title"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '1rem',
            }}
          >
            <div
              style={{
                background: 'var(--bg-card)',
                borderRadius: '0.75rem',
                border: '1px solid var(--border-main)',
                maxWidth: '500px',
                width: '100%',
                padding: '1.5rem',
                maxHeight: '90vh',
                overflowY: 'auto',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h2 id="create-draft-title" style={{ fontSize: '1.2rem', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>
                  Create New Citizen Draft
                </h2>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}
                  aria-label="Close dialog"
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </div>

              <form onSubmit={handleCreateDraft}>
                <div style={{ marginBottom: '1rem' }}>
                  <label htmlFor="draft-type" style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.35rem' }}>
                    Draft Workflow Type
                  </label>
                  <select
                    id="draft-type"
                    value={newDraftType}
                    onChange={(e) => setNewDraftType(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-main)',
                      background: 'var(--bg-main)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                    }}
                  >
                    <option value={DRAFT_TYPES.CHECKLIST}>Checklist Preparation</option>
                    <option value={DRAFT_TYPES.APPLICATION_DRAFT}>Application Form Draft</option>
                    <option value={DRAFT_TYPES.SAVED_NOTE}>Saved Civic Note</option>
                  </select>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label htmlFor="draft-title" style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.35rem' }}>
                    Draft Title / Service Name
                  </label>
                  <input
                    id="draft-title"
                    type="text"
                    required
                    placeholder="e.g. Income Certificate Checklist"
                    value={newDraftTitle}
                    onChange={(e) => setNewDraftTitle(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-main)',
                      background: 'var(--bg-main)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>

                {newDraftType === DRAFT_TYPES.CHECKLIST && (
                  <div style={{ marginBottom: '1rem' }}>
                    <label htmlFor="draft-items" style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.35rem' }}>
                      Checklist Items (One item per line)
                    </label>
                    <textarea
                      id="draft-items"
                      rows={4}
                      placeholder="Aadhaar Card copy&#10;Salary slip or IT Return&#10;Proof of residence"
                      value={newDraftItemsText}
                      onChange={(e) => setNewDraftItemsText(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border-main)',
                        background: 'var(--bg-main)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                      }}
                    />
                  </div>
                )}

                <div style={{ marginBottom: '1.25rem' }}>
                  <label htmlFor="draft-notes" style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.35rem' }}>
                    Notes / Description
                  </label>
                  <textarea
                    id="draft-notes"
                    rows={3}
                    placeholder="Add any reminders, officer names, or statutory requirements..."
                    value={newDraftNotes}
                    onChange={(e) => setNewDraftNotes(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-main)',
                      background: 'var(--bg-main)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-main)',
                      background: 'transparent',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '0.5rem 1.25rem',
                      borderRadius: '0.5rem',
                      border: 'none',
                      background: 'var(--primary)',
                      color: '#ffffff',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    Save Draft
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CitizenDraftSyncWorkspace;
