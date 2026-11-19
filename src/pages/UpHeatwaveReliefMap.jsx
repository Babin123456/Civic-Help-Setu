import React, { useState, useMemo, useEffect } from 'react';
import HeatwaveReliefHeader from '../components/heatwaveRelief/HeatwaveReliefHeader';
import HeatwaveReliefFilters from '../components/heatwaveRelief/HeatwaveReliefFilters';
import HeatwaveInteractiveMap from '../components/heatwaveRelief/HeatwaveInteractiveMap';
import HeatwaveFacilityList from '../components/heatwaveRelief/HeatwaveFacilityList';
import HeatwaveObservationModal from '../components/heatwaveRelief/HeatwaveObservationModal';
import HeatEmergencyGuidanceModal from '../components/heatwaveRelief/HeatEmergencyGuidanceModal';
import {
  listHeatReliefFacilities,
  getDistrictHeatAlert,
  submitCommunityObservation,
  getOfflineDraftQueue,
  enqueueOfflineDraft,
  syncOfflineDrafts,
} from '../services/upHeatwaveReliefService';

const INITIAL_FILTERS = {
  district: 'Lucknow',
  wardOrVillage: '',
  facilityType: 'all',
  onlyOpen: false,
  onlyWheelchair: false,
  onlyOrsAvailable: false,
  onlyDrinkingWater: false,
  searchQuery: '',
};

export default function UpHeatwaveReliefMap() {
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [isLowBandwidth, setIsLowBandwidth] = useState(false);
  const [isTextOnlyView, setIsTextOnlyView] = useState(false);

  // Explicit user location consent state (Acceptance Criteria #5)
  const [locationConsentGranted, setLocationConsentGranted] = useState(false);
  const [userCoords, setUserCoords] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState(null);

  // Modals & Selection
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [facilityForObservation, setFacilityForObservation] = useState(null);
  const [isGuidanceModalOpen, setIsGuidanceModalOpen] = useState(false);
  const [isSubmittingObservation, setIsSubmittingObservation] = useState(false);

  // Offline Draft Queue
  const [offlineDraftsCount, setOfflineDraftsCount] = useState(0);
  const [isSyncingDrafts, setIsSyncingDrafts] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Refresh offline draft count on mount
  useEffect(() => {
    const queue = getOfflineDraftQueue();
    setOfflineDraftsCount(queue.length);
  }, [refreshTrigger]);

  // Request browser location with explicit consent
  const handleRequestLocationConsent = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        setLocationConsentGranted(true);
        setUserCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => {
        setIsLocating(false);
        setLocationError(`Location request failed: ${err.message || 'Permission denied'}`);
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  };

  const handleRevokeLocationConsent = () => {
    setLocationConsentGranted(false);
    setUserCoords(null);
    setLocationError(null);
  };

  // Facilities query with live freshness, conflict, and distance computation
  const facilities = useMemo(() => {
    return listHeatReliefFacilities(
      {
        ...filters,
        userCoordinates: userCoords,
        locationConsentGranted,
      },
      new Date()
    );
  }, [filters, userCoords, locationConsentGranted, refreshTrigger]);

  // District alert context
  const districtAlert = useMemo(() => {
    return getDistrictHeatAlert(filters.district);
  }, [filters.district]);

  // Handle observation submit (online with fallback to offline queue)
  const handleSubmitObservation = async (payload) => {
    setIsSubmittingObservation(true);
    try {
      // If browser is offline, queue directly
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const draft = enqueueOfflineDraft(payload);
        setOfflineDraftsCount((c) => c + 1);
        setIsSubmittingObservation(false);
        setRefreshTrigger((t) => t + 1);
        return { success: true, draft };
      }

      const res = submitCommunityObservation(payload, new Date());
      setIsSubmittingObservation(false);
      if (res.success) {
        setRefreshTrigger((t) => t + 1);
      }
      return res;
    } catch (e) {
      // Enqueue to offline draft as safety net
      const draft = enqueueOfflineDraft(payload);
      setOfflineDraftsCount((c) => c + 1);
      setIsSubmittingObservation(false);
      setRefreshTrigger((t) => t + 1);
      return { success: true, draft };
    }
  };

  // Sync offline drafts
  const handleSyncDrafts = () => {
    setIsSyncingDrafts(true);
    setTimeout(() => {
      syncOfflineDrafts(new Date());
      setOfflineDraftsCount(getOfflineDraftQueue().length);
      setIsSyncingDrafts(false);
      setRefreshTrigger((t) => t + 1);
    }, 400);
  };

  return (
    <div className="section" style={{ padding: '2rem 1rem' }}>
      <div className="container" style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {/* Header with Official Alert & Helpline Quick Dial */}
        <HeatwaveReliefHeader
          districtAlert={districtAlert}
          offlineDraftsCount={offlineDraftsCount}
          onOpenGuidanceModal={() => setIsGuidanceModalOpen(true)}
          onSyncDrafts={handleSyncDrafts}
          isSyncing={isSyncingDrafts}
        />

        {/* Filters and Controls */}
        <HeatwaveReliefFilters
          filters={filters}
          onChangeFilters={setFilters}
          onResetFilters={() => setFilters(INITIAL_FILTERS)}
          isLowBandwidth={isLowBandwidth}
          onToggleLowBandwidth={() => setIsLowBandwidth((b) => !b)}
          isTextOnlyView={isTextOnlyView}
          onToggleTextOnlyView={() => setIsTextOnlyView((t) => !t)}
          locationConsentGranted={locationConsentGranted}
          onRequestLocationConsent={handleRequestLocationConsent}
          onRevokeLocationConsent={handleRevokeLocationConsent}
          isLocating={isLocating}
          locationError={locationError}
        />

        {/* Interactive Map (Hidden if user prefers pure Text-Only View) */}
        {!isTextOnlyView && (
          <HeatwaveInteractiveMap
            facilities={facilities}
            selectedFacility={selectedFacility}
            onSelectFacility={setSelectedFacility}
            onOpenObservationModal={(fac) => setFacilityForObservation(fac)}
            isLowBandwidth={isLowBandwidth}
            district={filters.district}
          />
        )}

        {/* Accessible Text-Only Facilities Directory List */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Verified Relief Facilities ({facilities.length})
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              District: <strong>{filters.district}</strong>
            </span>
          </div>

          <HeatwaveFacilityList
            facilities={facilities}
            selectedFacility={selectedFacility}
            onSelectFacility={setSelectedFacility}
            onOpenObservationModal={(fac) => setFacilityForObservation(fac)}
          />
        </div>

        {/* Community Observation / Correction Modal */}
        {facilityForObservation && (
          <HeatwaveObservationModal
            facility={facilityForObservation}
            onClose={() => setFacilityForObservation(null)}
            onSubmitObservation={handleSubmitObservation}
            isSubmitting={isSubmittingObservation}
          />
        )}

        {/* Emergency First-Aid and Hydration Guidance Modal */}
        {isGuidanceModalOpen && (
          <HeatEmergencyGuidanceModal onClose={() => setIsGuidanceModalOpen(false)} />
        )}
      </div>
    </div>
  );
}
