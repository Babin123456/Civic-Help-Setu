import { useState, useEffect, useMemo } from 'react';
import { parseSlugParam } from '../utils/searchParams';
import { useLocation } from 'react-router-dom';
import {
  MapPin,
  Compass,
  Layers,
  List,
  Map as MapIcon,
  ShieldCheck,
  Building2,
  CalendarCheck,
  Accessibility,
} from 'lucide-react';
import AccessibilityNeedsPlannerModal from '../components/location/AccessibilityNeedsPlannerModal';
import {
  filterCivicOffices,
  requestUserCoordinates,
  getCachedUserCoordinates,
  formatDistance,
} from '../services/locationService';
import InteractiveOfficeMap from '../components/location/InteractiveOfficeMap';
import LocationFilterToolbar from '../components/location/LocationFilterToolbar';
import OfficeCard from '../components/location/OfficeCard';
import AppointmentModal from '../components/location/AppointmentModal';
import OfficeAccessibilityRatingModal from '../components/location/OfficeAccessibilityRatingModal';
import { AccessibilityFilterBar } from '../components/location/AccessibilityFacilityPanel';
import { filterOfficesByAccessibilityAndLanguage } from '../services/accessibilityMapService';
import LocationPermissionPanel, { LOCATION_REQUEST_BUTTON_ID } from '../components/location/LocationPermissionPanel';
import {
  LOCATION_STATUS,
  canRequestLocation,
  statusFromErrorKind,
  readDeniedFlag,
  writeDeniedFlag,
  queryGeolocationPermission,
} from '../utils/locationPermission';
import { useToast } from '../context/ToastContext';

const NearbyOffices = () => {
  const routerLocation = useLocation();
  const { toast } = useToast();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('all');
  const [maxRadiusKm, setMaxRadiusKm] = useState(50);
  const [onlyOpenNow, setOnlyOpenNow] = useState(false);
  const [onlyWheelchair, setOnlyWheelchair] = useState(false);
  const [serviceFilter, setServiceFilter] = useState('');
  const [selectedFacilities, setSelectedFacilities] = useState([]);
  const [selectedLanguages, setSelectedLanguages] = useState([]);

  // Location & Geolocation State
  const [userCoords, setUserCoords] = useState(() => getCachedUserCoordinates());
  const [locationStatus, setLocationStatus] = useState(() =>
    readDeniedFlag() ? LOCATION_STATUS.DENIED : LOCATION_STATUS.IDLE
  );
  const [permissionState, setPermissionState] = useState('unknown');

  // View & Modal State
  const [viewMode, setViewMode] = useState('split'); // 'split' | 'map' | 'list'
  const [selectedOffice, setSelectedOffice] = useState(null);
  const [auditingOffice, setAuditingOffice] = useState(null);
  const [bookingOffice, setBookingOffice] = useState(null);
  const [isAccessibilityModalOpen, setIsAccessibilityModalOpen] = useState(false);

  // Initialize service query param if arriving from a specific service details page
  useEffect(() => {
    const params = new URLSearchParams(routerLocation.search);
    const sId = parseSlugParam(params.get('service'));
    if (sId) {
      setServiceFilter(sId);
      toast?.info?.(`Filtering facilitation centers for ${sId.replace(/-/g, ' ')}`);
    }
  }, [routerLocation.search]);

  // Read the browser's permission state without prompting. Geolocation itself is only ever
  // requested from the explicit button below, never on load.
  useEffect(() => {
    let cancelled = false;
    let permissionStatus = null;
    const applyState = (state) => {
      setPermissionState(state);
      if (state === 'denied') {
        writeDeniedFlag(true);
        setLocationStatus(LOCATION_STATUS.DENIED);
      } else if (state === 'granted' || state === 'prompt') {
        // The user changed the setting in the browser: allow a deliberate new attempt.
        writeDeniedFlag(false);
        setLocationStatus((prev) => (prev === LOCATION_STATUS.DENIED ? LOCATION_STATUS.IDLE : prev));
      }
    };
    const onChange = () => applyState(permissionStatus.state);
    queryGeolocationPermission().then(({ state, status }) => {
      if (cancelled) return;
      permissionStatus = status;
      applyState(state);
      if (status) status.addEventListener?.('change', onChange);
    });
    return () => {
      cancelled = true;
      permissionStatus?.removeEventListener?.('change', onChange);
    };
  }, []);

  // Request GPS Location handler (only reachable from an explicit button press)
  const handleRequestLocation = async () => {
    if (!canRequestLocation({ status: locationStatus, permissionState })) return;
    setLocationStatus(LOCATION_STATUS.REQUESTING);
    try {
      const coords = await requestUserCoordinates();
      setUserCoords(coords);
      setLocationStatus(LOCATION_STATUS.IDLE);
      writeDeniedFlag(false);
      toast?.success?.('Current GPS location detected successfully.', 'Location Acquired');
    } catch (err) {
      const status = statusFromErrorKind(err.kind);
      if (status === LOCATION_STATUS.DENIED) writeDeniedFlag(true);
      setLocationStatus(status);
    }
  };

  const focusLocationPanel = () => {
    const btn = document.getElementById(LOCATION_REQUEST_BUTTON_ID);
    if (btn && !btn.disabled) {
      btn.scrollIntoView?.({ block: 'center' });
      btn.focus();
    }
  };

  const handleClearLocation = () => {
    setUserCoords(null);
    setLocationStatus(readDeniedFlag() ? LOCATION_STATUS.DENIED : LOCATION_STATUS.IDLE);
    sessionStorage.removeItem('civicbridge_user_coords');
    toast?.info?.('Location filter cleared.');
  };

  const handleToggleFacility = (key) => {
    setSelectedFacilities((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleToggleLanguage = (lang) => {
    setSelectedLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
  };

  const handleClearAccessibilityFilters = () => {
    setSelectedFacilities([]);
    setSelectedLanguages([]);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedState('');
    setSelectedDistrict('');
    setSelectedChannel('all');
    setMaxRadiusKm(50);
    setOnlyOpenNow(false);
    setOnlyWheelchair(false);
    setServiceFilter('');
    setSelectedFacilities([]);
    setSelectedLanguages([]);
    toast?.info?.('All discovery filters have been reset.');
  };

  // Filtered offices memo
  const filteredOffices = useMemo(() => {
    const baseOffices = filterCivicOffices({
      userCoords,
      searchQuery,
      state: selectedState,
      district: selectedDistrict,
      channel: selectedChannel,
      maxRadiusKm,
      serviceId: serviceFilter,
      onlyOpenNow,
      onlyWheelchairAccessible: onlyWheelchair,
    });

    return filterOfficesByAccessibilityAndLanguage({
      offices: baseOffices,
      requiredFacilities: selectedFacilities,
      requiredLanguages: selectedLanguages,
      localityQuery: searchQuery,
      state: selectedState,
      district: selectedDistrict,
    });
  }, [
    userCoords,
    searchQuery,
    selectedState,
    selectedDistrict,
    selectedChannel,
    maxRadiusKm,
    serviceFilter,
    onlyOpenNow,
    onlyWheelchair,
    selectedFacilities,
    selectedLanguages,
  ]);

  // Tailored empty-state hint: which next step actually helps
  const emptyHint = userCoords
    ? `Nothing found within ${maxRadiusKm} km of you. Try increasing the radius or clearing a filter.`
    : 'Location is off, so results depend on your filters. Pick a state or district, or turn on location to see offices near you.';
  const hasAccuracyNote = userCoords && Number.isFinite(userCoords.accuracy) && userCoords.accuracy > 1000;

  return (
    <div className="section animate-fade-in" style={{ paddingBottom: '5rem' }}>
      <div className="container" style={{ maxWidth: '1280px' }}>
        {/* Page Header */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--accent-main)',
              fontSize: '0.875rem',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '0.5rem',
            }}
          >
            <Compass size={18} /> Location-Aware Civic Discovery
          </div>

          <h1
            style={{
              fontSize: 'clamp(2.25rem, 5vw, 3.25rem)',
              fontWeight: '900',
              lineHeight: '1.2',
              marginBottom: '0.75rem',
            }}
          >
            Find Nearby Public Offices & Seva Kendras
          </h1>

          <p
            style={{
              fontSize: '1.15rem',
              color: 'var(--text-secondary)',
              maxWidth: '750px',
              margin: '0 auto',
            }}
          >
            Locate official government facilitation centers, RTOs, Passport Seva Kendras, and Aadhaar centers.
            Check live operating hours, directions, and book electronic visit tokens.
          </p>
        </div>

        {/* View Mode Switcher & Counter Strip */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.25rem',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <span style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              Showing {filteredOffices.length} Civic Centers
            </span>
            {userCoords && (
              <span style={{ fontSize: '0.85rem', color: 'var(--accent-main)', marginLeft: '0.5rem' }}>
                • Sorted by closest to you
              </span>
            )}
            {serviceFilter && (
              <span
                style={{
                  fontSize: '0.8rem',
                  marginLeft: '0.5rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '99px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: 'var(--accent-main)',
                  fontWeight: '600',
                }}
              >
                Service: {serviceFilter}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setIsAccessibilityModalOpen(true)}
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.85rem',
                padding: '0.45rem 0.85rem',
              }}
            >
              <Accessibility size={16} color="var(--success)" />
              <span>Accessibility Needs Planner</span>
            </button>

            {/* View Mode Buttons */}
            <div
              style={{
                display: 'inline-flex',
                flexWrap: 'wrap',
              maxWidth: '100%',
              background: 'var(--glass-bg)',
              borderRadius: '0.6rem',
              padding: '0.25rem',
              border: '1px solid var(--border-light)',
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('split')}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '0.45rem',
                fontSize: '0.85rem',
                fontWeight: '600',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: viewMode === 'split' ? 'var(--accent-main)' : 'transparent',
                color: viewMode === 'split' ? '#ffffff' : 'var(--text-secondary)',
              }}
            >
              <Layers size={15} /> Split View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('map')}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '0.45rem',
                fontSize: '0.85rem',
                fontWeight: '600',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: viewMode === 'map' ? 'var(--accent-main)' : 'transparent',
                color: viewMode === 'map' ? '#ffffff' : 'var(--text-secondary)',
              }}
            >
              <MapIcon size={15} /> Map Only
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '0.45rem',
                fontSize: '0.85rem',
                fontWeight: '600',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: viewMode === 'list' ? 'var(--accent-main)' : 'transparent',
                color: viewMode === 'list' ? '#ffffff' : 'var(--text-secondary)',
              }}
            >
              <List size={15} /> Directory List
            </button>
          </div>
          </div>
        </div>

        {/* Filter Toolbar Component */}
        <LocationFilterToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedState={selectedState}
          onStateChange={(st) => {
            setSelectedState(st);
            setSelectedDistrict('');
          }}
          selectedDistrict={selectedDistrict}
          onDistrictChange={setSelectedDistrict}
          selectedChannel={selectedChannel}
          onChannelChange={setSelectedChannel}
          maxRadiusKm={maxRadiusKm}
          onRadiusChange={setMaxRadiusKm}
          onlyOpenNow={onlyOpenNow}
          onOpenNowChange={setOnlyOpenNow}
          onlyWheelchair={onlyWheelchair}
          onWheelchairChange={setOnlyWheelchair}
          userCoords={userCoords}
          onRequestLocation={focusLocationPanel}
          onClearLocation={handleClearLocation}
          isLocating={locationStatus === LOCATION_STATUS.REQUESTING}
          onResetFilters={handleResetFilters}
        />

        {/* Accessibility & Language Coverage Filter Bar */}
        <AccessibilityFilterBar
          selectedFacilities={selectedFacilities}
          onToggleFacility={handleToggleFacility}
          selectedLanguages={selectedLanguages}
          onToggleLanguage={handleToggleLanguage}
          onClearFilters={handleClearAccessibilityFilters}
        />

        {!userCoords && (
          <LocationPermissionPanel
            status={locationStatus}
            permissionState={permissionState}
            onRequestLocation={handleRequestLocation}
          />
        )}

        {hasAccuracyNote && (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.75rem 0' }}>
            Your location is approximate (about {Math.round(userCoords.accuracy)} m), so distances may be off.
          </p>
        )}

        {/* Dynamic Layout Based on View Mode */}
        {viewMode === 'map' && (
          <div style={{ marginBottom: '2rem' }}>
            <InteractiveOfficeMap
              offices={filteredOffices}
              userCoords={userCoords}
              selectedOffice={selectedOffice}
              onSelectOffice={setSelectedOffice}
              onBookAppointment={(off) => setBookingOffice(off)}
            />
          </div>
        )}

        {viewMode === 'list' && (
          <div>
            {filteredOffices.length === 0 ? (
              <div
                className="glass-panel"
                style={{
                  padding: '3rem 1.5rem',
                  textAlign: 'center',
                  borderRadius: '1rem',
                  border: '1px dashed var(--border-light)',
                }}
              >
                <Building2 size={36} color="var(--text-tertiary)" style={{ margin: '0 auto 1rem' }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                  No Civic Centers Found
                </h3>
                <p style={{ color: 'var(--text-secondary)', maxWidth: '450px', margin: '0 auto 1.5rem', fontSize: '0.9rem' }}>
                  {emptyHint}
                </p>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="btn btn-secondary"
                  style={{ borderRadius: '0.5rem' }}
                >
                  Reset Discovery Filters
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 360px), 1fr))',
                  gap: '1.5rem',
                }}
              >
                {filteredOffices.map((office) => (
                  <OfficeCard
                    key={office.id}
                    office={office}
                    isSelected={selectedOffice?.id === office.id}
                    onSelect={setSelectedOffice}
                    onBookAppointment={(off) => setBookingOffice(off)}
                    onAuditAccessibility={(off) => setAuditingOffice(off)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {viewMode === 'split' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
              gap: '1.75rem',
              alignItems: 'start',
            }}
          >
            {/* Left: Sticky Visual Map */}
            <div style={{ position: 'sticky', top: '1.5rem', minWidth: 0 }}>
              <InteractiveOfficeMap
                offices={filteredOffices}
                userCoords={userCoords}
                selectedOffice={selectedOffice}
                onSelectOffice={setSelectedOffice}
                onBookAppointment={(off) => setBookingOffice(off)}
              />
            </div>

            {/* Right: Scrollable Office Directory Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {filteredOffices.length === 0 ? (
                <div
                  className="glass-panel"
                  style={{
                    padding: '3rem 1.5rem',
                    textAlign: 'center',
                    borderRadius: '1rem',
                    border: '1px dashed var(--border-light)',
                  }}
                >
                  <Building2 size={36} color="var(--text-tertiary)" style={{ margin: '0 auto 1rem' }} />
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                    No Civic Centers Found
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 1.5rem', fontSize: '0.9rem' }}>
                    {emptyHint}
                  </p>
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="btn btn-secondary"
                  >
                    Reset Discovery Filters
                  </button>
                </div>
              ) : (
                filteredOffices.map((office) => (
                  <OfficeCard
                    key={office.id}
                    office={office}
                    isSelected={selectedOffice?.id === office.id}
                    onSelect={setSelectedOffice}
                    onBookAppointment={(off) => setBookingOffice(off)}
                    onAuditAccessibility={(off) => setAuditingOffice(off)}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* Appointment Token Modal */}
        <AppointmentModal
          isOpen={Boolean(bookingOffice)}
          onClose={() => setBookingOffice(null)}
          office={bookingOffice}
          prefilledService={serviceFilter}
        />

        {/* Office Accessibility Rating & Audit Modal */}
        <OfficeAccessibilityRatingModal
          isOpen={Boolean(auditingOffice)}
          office={auditingOffice}
          onClose={() => setAuditingOffice(null)}
        />

        {/* Accessibility Needs Planner Modal */}
        <AccessibilityNeedsPlannerModal
          isOpen={isAccessibilityModalOpen}
          onClose={() => setIsAccessibilityModalOpen(false)}
          initialOfficeId={selectedOffice?.id}
        />
      </div>
    </div>
  );
};

export default NearbyOffices;
