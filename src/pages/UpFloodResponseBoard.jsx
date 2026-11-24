import { useState, useEffect, useMemo, useCallback } from 'react';
import FloodResponseHeader from '../components/floodResponse/FloodResponseHeader';
import FloodIncidentList from '../components/floodResponse/FloodIncidentList';
import FloodInteractiveMap from '../components/floodResponse/FloodInteractiveMap';
import FloodReportModal from '../components/floodResponse/FloodReportModal';
import WardDrainSummaryModal from '../components/floodResponse/WardDrainSummaryModal';
import RouteHazardCheckerModal from '../components/floodResponse/RouteHazardCheckerModal';
import OfflineDraftQueueModal from '../components/floodResponse/OfflineDraftQueueModal';
import {
  listIncidents,
  submitCitizenReport,
  reconfirmIncident,
  enqueueOfflineDraft,
  getOfflineDraftQueue,
  syncOfflineDrafts,
} from '../services/upFloodResponseService';
import { useToast } from '../context/ToastContext';

const INITIAL_FILTERS = {
  district: 'all',
  incidentType: 'all',
  sourceTier: 'all',
  statusFilter: 'all',
  searchQuery: '',
};

export default function UpFloodResponseBoard() {
  const { toast } = useToast();
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [refreshTick, setRefreshTick] = useState(0);
  const [lowBandwidthMode, setLowBandwidthMode] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);

  // Connectivity
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

  // Modals
  const [showReportModal, setShowReportModal] = useState(false);
  const [showWardModal, setShowWardModal] = useState(false);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);

  // Draft queue count
  const [draftCount, setDraftCount] = useState(() => getOfflineDraftQueue().length);

  const refreshDraftCount = useCallback(() => {
    setDraftCount(getOfflineDraftQueue().length);
  }, []);

  // Network listener & auto-sync
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      const res = syncOfflineDrafts();
      if (res.syncedCount > 0) {
        toast.success(`Network restored: Synchronized ${res.syncedCount} queued flood report(s) to live board.`);
        setRefreshTick((t) => t + 1);
      }
      refreshDraftCount();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Network disconnected: New reports will be saved to your local Offline Draft Queue.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast, refreshDraftCount]);

  // Load and filter incidents
  const { incidents, totalCount, activeHazardsCount, blockedDrainsCount, staleCount, officialAlertsCount } =
    useMemo(() => {
      if (refreshTick < 0) {
        return {
          incidents: [],
          totalCount: 0,
          activeHazardsCount: 0,
          blockedDrainsCount: 0,
          staleCount: 0,
          officialAlertsCount: 0,
        };
      }
      return listIncidents(filters);
    }, [filters, refreshTick]);

  // Submission handler
  const handleReportSubmit = (payload) => {
    if (!isOnline) {
      enqueueOfflineDraft(payload);
      refreshDraftCount();
      toast.info('Report queued in local Offline Drafts. It will sync automatically when you reconnect.');
      return;
    }

    try {
      submitCitizenReport(payload);
      setRefreshTick((t) => t + 1);
      toast.success('Incident report submitted anonymously and published to the response board.');
    } catch (err) {
      toast.error(err.message || 'Submission failed');
    }
  };

  // Reconfirmation handler
  const handleReconfirm = (incidentId, action) => {
    try {
      reconfirmIncident(incidentId, { action });
      setRefreshTick((t) => t + 1);
      if (action === 'still_flooded') {
        toast.success('Observation reconfirmed. Timestamp refreshed for the community.');
      } else {
        toast.info('Cleared status recorded.');
      }
    } catch (err) {
      toast.error(err.message || 'Action failed');
    }
  };

  return (
    <div className="section" style={{ padding: '1.5rem 0' }}>
      <div className="container" style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 1rem' }}>
        <FloodResponseHeader
          filters={filters}
          onFilterChange={setFilters}
          metrics={{
            totalCount,
            activeHazardsCount,
            blockedDrainsCount,
            staleCount,
            officialAlertsCount,
          }}
          lowBandwidthMode={lowBandwidthMode}
          onToggleLowBandwidth={() => setLowBandwidthMode((prev) => !prev)}
          onOpenReportModal={() => setShowReportModal(true)}
          onOpenWardModal={() => setShowWardModal(true)}
          onOpenRouteModal={() => setShowRouteModal(true)}
          onOpenDraftModal={() => setShowDraftModal(true)}
          draftQueueCount={draftCount}
          isOnline={isOnline}
        />

        {/* Content Layout: In Low-Bandwidth mode, map is hidden completely to save data and battery */}
        {lowBandwidthMode ? (
          <div>
            <FloodIncidentList
              incidents={incidents}
              lowBandwidthMode={true}
              onReconfirm={handleReconfirm}
              onSelectIncident={setSelectedIncidentId}
              selectedIncidentId={selectedIncidentId}
            />
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(340px, 1fr) minmax(360px, 1.15fr)',
              gap: '1.25rem',
              alignItems: 'start',
            }}
          >
            {/* Left Column: Filterable Incident Feed */}
            <div>
              <div style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                  Active Incident Feed ({incidents.length})
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Refreshed with decay policies
                </span>
              </div>
              <FloodIncidentList
                incidents={incidents}
                lowBandwidthMode={false}
                onReconfirm={handleReconfirm}
                onSelectIncident={setSelectedIncidentId}
                selectedIncidentId={selectedIncidentId}
              />
            </div>

            {/* Right Column: Geographic Map Grid */}
            <div style={{ position: 'sticky', top: '1rem' }}>
              <FloodInteractiveMap
                incidents={incidents}
                selectedIncidentId={selectedIncidentId}
                onSelectIncident={setSelectedIncidentId}
              />
            </div>
          </div>
        )}

        {/* MODALS */}
        <FloodReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          onSubmit={handleReportSubmit}
          isOnline={isOnline}
        />

        <WardDrainSummaryModal
          isOpen={showWardModal}
          onClose={() => setShowWardModal(false)}
          district={filters.district !== 'all' ? filters.district : 'Lucknow'}
        />

        <RouteHazardCheckerModal
          isOpen={showRouteModal}
          onClose={() => setShowRouteModal(false)}
          district={filters.district !== 'all' ? filters.district : 'Lucknow'}
        />

        <OfflineDraftQueueModal
          isOpen={showDraftModal}
          onClose={() => {
            setShowDraftModal(false);
            refreshDraftCount();
          }}
          isOnline={isOnline}
          onSyncComplete={(res) => {
            refreshDraftCount();
            setRefreshTick((t) => t + 1);
            if (res?.syncedCount > 0) {
              toast.success(`Successfully synced ${res.syncedCount} draft(s)`);
            }
          }}
        />
      </div>
    </div>
  );
}
