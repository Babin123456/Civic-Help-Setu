import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNetwork } from '../contexts/NetworkContext';
import { useToast } from '../contexts/ToastContext';
import {
  ShelterSite,
  FacilityService,
  CapacitySnapshot,
  OperatorAccount,
  StatusEvent,
  VerificationCheck,
  SHELTER_STATES,
  ALLOWED_TRANSITIONS,
  validateStateTransition,
  validateShelterSite,
  validateFacilityService,
  validateCapacitySnapshot,
  validateOperatorAccount,
  validateStatusEvent,
  validateVerificationCheck,
  generateIdempotencyKey,
  canOperatorUpdateShelter,
  canOperatorUpdateFacilityService,
  getStaleStatusWarning,
  computeOccupancyRate,
  computeCapacityAvailable,
  getStatusBadgeStyle,
  getStatusLabel,
  getServiceStatusStyle,
  getServiceStatusLabel,
} from '../services/shelterStatusService';
import { EMERGENCY_RELIEF_CENTERS } from '../data/emergencyReliefData';
import { getReliefShelters } from '../services/disasterReliefService';
import { Phone, MapPin, ShieldAlert, Settings, Clock, AlertCircle, CheckCircle, XCircle, Loader2, Moon, Sun, LogOut, Filter, Search, Download, Upload } from 'lucide-react';

export default function ShelterStatusBoard() {
  const { user, isLoading: isAuthLoading, role } = useAuth();
  const { isOnline, isOffline, lastOnline } = useNetwork();
  const { success, error, addToast } = useToast();
  const navigate = useNavigate();

  const [roleType, setRoleType] = useState(roleOf(user));
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'map' | 'table'
  const [filters, setFilters] = useState({
    status: 'ALL',
    jurisdiction: '',
    accessibility: 'ALL',
    disasterType: 'ALL',
    search: '',
  });

  const [shelters, setShelters] = useState([]);
  const [selectedShelter, setSelectedShelter] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    jurisdiction: '',
    address: '',
    contact: '',
    altContact: '',
    email: '',
    website: '',
    status: SHELTER_STATES.OPEN,
    accessibility: {
      wheelchairAccessible: false,
      hearingImpaired: false,
      visuallyImpaired: false,
    },
    capacityTotal: 0,
    capacityAvailable: 0,
    lat: '',
    lng: '',
    contactType: '',
  });

  const [capacitySnapshots, setCapacitySnapshots] = useState([]);
  const [facilityServices, setFacilityServices] = useState([]);
  const [operatorAccounts, setOperatorAccounts] = useState([]);
  const [statusEvents, setStatusEvents] = useState([]);
  const [verificationChecks, setVerificationChecks] = useState([]);

  const [formStep, setFormStep] = useState('shelter'); // 'shelter' | 'services' | 'capacity' | 'verification'
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showBulkUpdate, setShowBulkUpdate] = useState(false);
  const [bulkFormData, setBulkFormData] = useState({
    status: 'ALL',
    jurisdiction: '',
  });

  // Load data on mount
  useEffect(() => {
    loadAllData();
  }, []);

  function roleOf(actor) {
    return actor && typeof actor.role === 'string' && actor.role === 'admin' ? 'admin' : 'citizen';
  }

  async function loadAllData() {
    // In a real implementation, these would fetch from Firestore
    // For now, use static data as fallback
    const sheltersData = EMERGENCY_RELIEF_CENTERS.map(center => ({
      ...center,
      status: center.status || SHELTER_STATES.OPEN,
      accessibility: center.accessibility || {
        wheelchairAccessible: false,
        hearingImpaired: false,
        visuallyImpaired: false,
      },
    }));

    setShelters(sheltersData);

    // Load capacity snapshots (simulated - would fetch from Firestore)
    const simulatedSnapshots = sheltersData.map(shelter => ({
      id: `snap-${shelter.id}`,
      shelterSiteId: shelter.id,
      capacityAvailable: Math.floor(shelter.capacity * 0.6),
      capacityTotal: shelter.capacity,
      occupancyRate: computeOccupancyRate(shelter.capacity, Math.floor(shelter.capacity * 0.6)),
      updateSource: 'operator-web',
      notes: 'Last updated via web portal',
      schemaVersion: 1,
      createdAt: new Date(Date.now() - Math.random() * 86400000).toISOString(),
    }));
    setCapacitySnapshots(simulatedSnapshots);

    // Load facility services (simulated)
    const simulatedServices = sheltersData.flatMap(shelter => [
      {
        id: `serv-${shelter.id}-water`,
        shelterSiteId: shelter.id,
        serviceType: 'WATER',
        status: 'AVAILABLE',
        capacityTotal: shelter.capacity,
        capacityAvailable: Math.floor(shelter.capacity * 0.6),
        lastVerified: Date.now(),
        notes: 'Water supply verified',
        schemaVersion: 1,
        createdAt: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      },
      {
        id: `serv-${shelter.id}-power`,
        shelterSiteId: shelter.id,
        serviceType: 'POWER',
        status: 'AVAILABLE',
        capacityTotal: shelter.capacity,
        capacityAvailable: Math.floor(shelter.capacity * 0.8),
        lastVerified: Date.now(),
        notes: 'Power supply verified',
        schemaVersion: 1,
        createdAt: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      },
      {
        id: `serv-${shelter.id}-sanitation`,
        shelterSiteId: shelter.id,
        serviceType: 'SANITATION',
        status: 'AVAILABLE',
        capacityTotal: shelter.capacity,
        capacityAvailable: Math.floor(shelter.capacity * 0.7),
        lastVerified: Date.now(),
        notes: 'Sanitation facilities verified',
        schemaVersion: 1,
        createdAt: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      },
    ]);
    setFacilityServices(simulatedServices);

    // Load status events (simulated)
    const simulatedEvents = sheltersData.flatMap(shelter => [
      {
        id: `event-${shelter.id}-1`,
        shelterSiteId: shelter.id,
        eventType: 'CAPACITY_UPDATE',
        oldState: SHELTER_STATES.OPEN,
        newState: SHELTER_STATES.OPEN,
        operatorId: user?.uid || 'operator-1',
        timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
        description: 'Capacity updated via web portal',
        details: 'Updated available capacity based on headcount',
        schemaVersion: 1,
        createdAt: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      },
    ]);
    setStatusEvents(simulatedEvents);

    // Load verification checks (simulated)
    const simulatedChecks = sheltersData.map(shelter => ({
      id: `check-${shelter.id}`,
      shelterSiteId: shelter.id,
      checkType: 'CAPACITY',
      status: 'PASSED',
      checkedBy: user?.uid || 'verifier-1',
      notes: 'Capacity check passed',
      rating: 5,
      reviewerId: 'admin-1',
      schemaVersion: 1,
      createdAt: new Date(Date.now() - Math.random() * 86400000).toISOString(),
    }));
    setVerificationChecks(simulatedChecks);

    // Load operator accounts (admin-only, simulated)
    if (roleType === 'admin') {
      setOperatorAccounts([
        {
          id: 'op-1',
          name: ' Delhi NDRF Operator',
          email: 'operator-delhi@civicbridge.gov.in',
          phone: '011-23831077',
          role: 'OPERATOR',
          jurisdiction: 'Delhi',
          verificationStatus: 'verified',
          onboardingId: 'OB-DELHI-001',
          schemaVersion: 1,
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          id: 'op-2',
          name: ' Mumbai SDRF Operator',
          email: 'operator-mumbai@civicbridge.gov.in',
          phone: '022-22694725',
          role: 'OPERATOR',
          jurisdiction: 'Maharashtra',
          verificationStatus: 'verified',
          onboardingId: 'OB-MUMBAI-001',
          schemaVersion: 1,
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 86400000).toISOString(),
        },
      ]);
    }
  }

  // ---- Filter & search helpers ----

  const filteredShelters = useMemo(() => {
    return shelters.filter(shelter => {
      // Status filter
      if (filters.status !== 'ALL' && shelter.status !== filters.status) return false;

      // Jurisdiction filter
      if (filters.jurisdiction && shelter.city && !shelter.city.toLowerCase().includes(filters.jurisdiction.toLowerCase()) && !shelter.state.toLowerCase().includes(filters.jurisdiction.toLowerCase())) return false;

      // Accessibility filter
      if (filters.accessibility !== 'ALL') {
        const hasAccessibility =
          shelter.accessibility?.wheelchairAccessible ||
          shelter.accessibility?.hearingImpaired ||
          shelter.accessibility?.visuallyImpaired;
        if (filters.accessibility === 'wheelchair' && !shelter.accessibility?.wheelchairAccessible) return false;
        if (filters.accessibility === 'hearing' && !shelter.accessibility?.hearingImpaired) return false;
        if (filters.accessibility === 'visual' && !shelter.accessibility?.visuallyImpaired) return false;
        if (filters.accessibility !== 'ALL' && !hasAccessibility) return false;
      }

      // Disaster type filter
      if (filters.disasterType !== 'ALL' && shelter.disasterTypes && !shelter.disasterTypes.includes(filters.disasterType)) return false;

      // Search filter
      if (filters.search) {
        const term = filters.search.toLowerCase();
        const matchesName = shelter.name.toLowerCase().includes(term);
        const matchesAddress = shelter.address?.toLowerCase().includes(term);
        const matchesContact = shelter.contact?.toLowerCase().includes(term);
        const matchesAltContact = shelter.altContact?.toLowerCase().includes(term);
        if (!matchesName && !matchesAddress && !matchesContact && !matchesAltContact) return false;
      }

      return true;
    });
  }, [shelters, filters]);

  // ---- Form handlers ----

  function handleFormChange(e) {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  function resetForm() {
    setFormData({
      name: '',
      jurisdiction: '',
      address: '',
      contact: '',
      altContact: '',
      email: '',
      website: '',
      status: SHELTER_STATES.OPEN,
      accessibility: {
        wheelchairAccessible: false,
        hearingImpaired: false,
        visuallyImpaired: false,
      },
      capacityTotal: 0,
      capacityAvailable: 0,
      lat: '',
      lng: '',
      contactType: '',
    });
  }

  function canEditShelter(shelter) {
    if (roleType === 'admin') return true;
    if (!user) return false;
    return canOperatorUpdateShelter(user, shelter);
  }

  function handleCreateShelter() {
    resetForm();
    setIsEditing(true);
    setShowCreateForm(true);
  }

  function handleEditShelter(shelter) {
    setSelectedShelter(shelter);
    setFormData({
      name: shelter.name,
      jurisdiction: shelter.jurisdiction,
      address: shelter.address,
      contact: shelter.contact,
      altContact: shelter.altContact,
      email: shelter.email,
      website: shelter.website,
      status: shelter.status || SHELTER_STATES.OPEN,
      accessibility: {
        wheelchairAccessible: shelter.accessibility?.wheelchairAccessible || false,
        hearingImpaired: shelter.accessibility?.hearingImpaired || false,
        visuallyImpaired: shelter.accessibility?.visuallyImpaired || false,
      },
      capacityTotal: shelter.capacity || 0,
      capacityAvailable: 0,
      lat: String(shelter.lat || ''),
      lng: String(shelter.lng || ''),
      contactType: shelter.contactType || '',
    });
    setIsEditing(true);
    setShowCreateForm(true);
  }

  function handleDeleteShelter(shelterId) {
    if (window.confirm(`Are you sure you want to delete shelter "${shelterId}"? This action cannot be undone.`)) {
      // In production, this would call the Firestore delete API
      // which is restricted to admins via security rules
      addToast('Shelter deletion not implemented in this demo', 'info');
    }
  }

  function handleSaveShelter() {
    const validationErrors = validateShelterSite(formData);
    if (validationErrors.length > 0) {
      addToast(`Validation errors: ${validationErrors.join(', ')}`, 'error');
      return;
    }

    if (roleType !== 'admin' && !canOperatorUpdateShelter(user, { ...formData, id: formData.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') })) {
      addToast('You do not have permission to update this shelter. Admins only.', 'error');
      setIsEditing(false);
      setShowCreateForm(false);
      return;
    }

    // Generate idempotency key for retry-safe operation
    const shelterId = formData.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'unknown';
    const idempotencyKey = generateIdempotencyKey(shelterId, 'create_or_update', user?.uid || '');

    // Simulate Firestore write
    const newShelter = {
      ...formData,
      id: shelterId,
      schemaVersion: 1,
      createdAt: user?.uid ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    };

    // In production: await firestore.collection('shelter_sites').doc(shelterId).set(newShelter, { merge: true });
    // Security rules enforce validation on the server

    addToast(`Shelter "${formData.name}" ${formData.status ? `status set to ${getStatusLabel(formData.status)}` : 'saved'} successfully`, 'success');
    setIsEditing(false);
    setShowCreateForm(false);
    loadAllData(); // Reload to reflect new data
  }

  function handleStateTransition(newState) {
    if (!selectedShelter) return;

    const transitionValid = validateStateTransition(selectedShelter.status, newState);
    if (!transitionValid.valid) {
      addToast(transitionValid.message, 'error');
      return;
    }

    if (roleType !== 'admin' && !canOperatorUpdateShelter(user, selectedShelter)) {
      addToast('Only administrators can change shelter status.', 'error');
      return;
    }

    const idempotencyKey = generateIdempotencyKey(selectedShelter.id, 'state_transition', user?.uid || '');

    // Record the status event before changing state
    const statusEvent = {
      id: `event-${selectedShelter.id}-${Date.now()}`,
      shelterSiteId: selectedShelter.id,
      eventType: 'CLOSURE', // or 'REOPENING' depending on transition
      oldState: selectedShelter.status,
      newState,
      operatorId: user?.uid || 'operator-unknown',
      timestamp: new Date().toISOString(),
      description: `Shelter transitioned from ${getStatusLabel(selectedShelter.status)} to ${getStatusLabel(newState)}`,
      details: `Status change initiated by ${user?.username || 'operator'} via status board`,
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
    };

    // In production: firestore.collection('status_events').add(statusEvent);

    // Update the shelter state
    const updatedShelter = {
      ...selectedShelter,
      status: newState,
      occupancyRate: computeOccupancyRate(
        selectedShelter.capacityTotal || 0,
        selectedShelter.capacityAvailable || 0
      ),
      updatedAt: new Date().toISOString(),
    };

    // In production: firestore.collection('shelter_sites').doc(selectedShelter.id).update({
    //   status: newState,
    //   updatedAt: new Date().toISOString(),
    // });

    addToast(`Shelter status changed to ${getStatusLabel(newState)}`, 'success');
    setSelectedShelter(null);
    loadAllData();
  }

  function handleAddFacilityService() {
    if (!selectedShelter) {
      addToast('Select a shelter first', 'error');
      return;
    }
    if (roleType !== 'admin' && !canOperatorUpdateFacilityService(user, selectedShelter.id)) {
      addToast('Only administrators can add facility services', 'error');
      return;
    }

    const newService = {
      id: `serv-${selectedShelter.id}-new`,
      shelterSiteId: selectedShelter.id,
      serviceType: 'WATER',
      status: 'AVAILABLE',
      capacityTotal: selectedShelter.capacityTotal || 0,
      capacityAvailable: 0,
      lastVerified: Date.now(),
      notes: 'New service added',
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // In production: firestore.collection('facility_services').add(newService);
    addToast(`Facility service (${newService.serviceType}) added for ${selectedShelter.name}`, 'success');
    loadAllData();
  }

  function handleAddCapacitySnapshot() {
    if (!selectedShelter) {
      addToast('Select a shelter first', 'error');
      return;
    }
    if (roleType !== 'admin' && !canOperatorUpdateFacilityService(user, selectedShelter.id)) {
      addToast('Only administrators can add capacity snapshots', 'error');
      return;
    }

    const newSnapshot = {
      id: `snap-${selectedShelter.id}-${Date.now()}`,
      shelterSiteId: selectedShelter.id,
      capacityAvailable: 0,
      capacityTotal: selectedShelter.capacityTotal || 0,
      occupancyRate: 100,
      updateSource: 'operator-web',
      notes: 'Initial capacity snapshot',
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
    };

    // In production: firestore.collection('capacity_snapshots').add(newSnapshot);
    addToast('Capacity snapshot added', 'success');
    loadAllData();
  }

  function handleAddVerificationCheck() {
    if (!selectedShelter) {
      addToast('Select a shelter first', 'error');
      return;
    }
    if (roleType !== 'admin' && !canOperatorUpdateFacilityService(user, selectedShelter.id)) {
      addToast('Only administrators can add verification checks', 'error');
      return;
    }

    const newCheck = {
      id: `check-${selectedShelter.id}-${Date.now()}`,
      shelterSiteId: selectedShelter.id,
      checkType: 'CAPACITY',
      status: 'PENDING',
      checkedBy: user?.uid || 'verifier-unknown',
      notes: 'New verification check initiated',
      rating: 3,
      reviewerId: '',
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
    };

    // In production: firestore.collection('verification_checks').add(newCheck);
    addToast('Verification check created', 'success');
    loadAllData();
  }

  // ---- UI Rendering ----

  // Loading state
  if (isAuthLoading) {
    return null; // or a spinner
  }

  // Offline warning
  if (!isOnline && !isAuthLoading) {
    // Show offline banner already handled by OfflineBanner component
  }

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '64px' }}>
      <div className="section" style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
        <header style={{ marginBottom: '32px', paddingBottom: '16px', borderBottom: '1px solid #e2e8f0' }}>
          <h1 style={{ margin: 0, fontSize: '1.875rem', fontWeight: 700, color: '#0f172a' }}>
            Live Disaster Shelter Capacity & Essential Services Status Board
          </h1>
          <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: '0.875rem' }}>
            Real-time shelter capacity and essential services monitoring for emergency coordinators and residents.
          </p>
        </header>

        {/* Status warning banner */}
        {roleType === 'admin' && (
          <div style={{
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '6px',
            padding: '12px 16px',
            marginBottom: '24px',
            color: '#92400e',
            fontSize: '0.875rem'
          }}>
            <strong>Admin Note:</strong> {"This is a live status board. All updates are timestamped and audited. "
              + "Operators should update capacity and services regularly. Data older than 24 hours is marked stale."}
          </div>
        )}

        {/* Filter toolbar */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={16} />{' '}
            <select
              style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="CLOSED">Closed</option>
              <option value="TEMPORARILY_CLOSED">Temporarily Closed</option>
              <option value="MAINTENANCE">Under Maintenance</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Search size={16} />{' '}
            <input
              style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem', width: '250px' }}
              type="text"
              placeholder="Search shelters..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
          </div>

          {roleType === 'admin' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Moon size={16} />{' '}
              <select
                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                onChange={(e) => setFilters(prev => ({ ...prev, jurisdiction: e.target.value }))}
              >
                <option value="">All Jurisdictions</option>
                <option value="Delhi">Delhi</option>
                <option value="Maharashtra">Maharashtra</option>
                <option value="Karnataka">Karnataka</option>
                <option value="Rajasthan">Rajasthan</option>
              </select>
            </div>
          )}

          {roleType === 'admin' && (
            <button
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                background: '#3b82f6',
                color: '#ffffff',
                fontSize: '0.875rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              onClick={() => setShowBulkUpdate(true)}
            >
              Bulk Update
              <Filter size={14} />
            </button>
          )}

          {roleType === 'admin' && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {isOnline ? <span style={{ color: '#10b981', fontSize: '0.75rem' }}>Online</span> : <span style={{ color: '#ef4444', fontSize: '0.75rem' }}>Offline</span>}
            </div>
          )}
        </div>

        {/* Main content area */}
        {filteredShelters.length === 0 && !isAuthLoading && (
          <div style={{
            textAlign: 'center',
            padding: '48px 24px',
            color: '#64748b',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            margin: '24px 0'
          }}>
            <Search size={48} style={{ marginBottom: '12px', opacity: 0.5 }} />{' '}
            <h3 style={{ margin: '16px 0 8px', fontSize: '1.125rem', color: '#475569' }}>No shelters found</h3>
            <p style={{ margin: 0, fontSize: '0.875rem' }}>
              No shelters match the current filters. Try adjusting the status, jurisdiction, or search criteria.
            </p>
          </div>
        )}

        {/* Shelter list/table */}
        <div style={{ overflowX: 'auto', marginTop: '24px' }}>
          <div style={{ width: '100%', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            {filteredShelters.length === 0 ? (
              <div style={{ padding: '32px', color: '#64748b', textAlign: 'center' }}>
                <Moon size={48} style={{ marginBottom: '12px', opacity: 0.5 }} />{' '}
                <p>No shelters match your filters.</p>
              </div>
            ) : (
              filteredShelters.map((shelter) => (
                <div
                  key={shelter.id}
                  style={{
                    borderBottom: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '16px',
                    background: '#ffffff',
                    transition: 'background 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <MapPin size={14} style={{ color: '#3b82f6' }} />
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#0f172a' }}>
                          {shelter.name}
                        </h4>
                        <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: '0.75rem' }}>
                          {shelter.city}, {shelter.state}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <span
                        style={getStatusBadgeStyle(shelter.status)}
                        style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.6875rem', fontWeight: 600 }}
                      >
                        {getStatusLabel(shelter.status)}
                      </span>

                      {roleType === 'admin' && shelter.status !== 'OPEN' && (
                        <button
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            background: '#f87171',
                            color: '#ffffff',
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            border: 'none',
                            cursor: 'pointer',
                            lineHeight: 1
                          }}
                          onClick={() => handleStateTransition(SHELTER_STATES.OPEN)}
                          title="Reopen shelter"
                        >
                          ⤺
                        </button>
                      )}

                      {roleType === 'admin' && (
                        <button
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            background: '#fbbf24',
                            color: '#78350f',
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            border: 'none',
                            cursor: 'pointer',
                            lineHeight: 1
                          }}
                          onClick={() => handleStateTransition(SHELTER_STATES.TEMPORARILY_CLOSED)}
                          title="Temporarily close shelter"
                        >
                          ⏳
                        </button>
                      )}

                      {roleType === 'admin' && (
                        <button
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            background: '#e5e7eb',
                            color: '#374151',
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            border: 'none',
                            cursor: 'pointer',
                            lineHeight: 1
                          }}
                          onClick={() => handleStateTransition(SHELTER_STATES.MAINTENANCE)}
                          title="Set to maintenance"
                        >
                          🔧
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Capacity and occupancy */}
                  <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '0.75rem' }}>
                    <div style={{ flex: 1, color: '#64748b' }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#0f172a' }}>
                        {shelter.capacity} Total
                      </div>
                      <div style={{ color: '#64748b', fontSize: '0.6875rem' }}>{shelter.occupancyRate ? `${shelter.occupancyRate}% occupied` : ''}</div>
                    </div>

                    <div style={{ flex: 1, color: '#64748b' }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#0f172a' }}>
                        {shelter.capacityAvailable ? `${shelter.capacityAvailable}` : '0'} Available
                      </div>
                      <div style={{ color: '#64748b', fontSize: '0.6875rem' }}>{shelter.occupancyRate ? `${100 - shelter.occupancyRate}% free` : ''}</div>
                    </div>

                    <div style={{ width: '120px', color: '#64748b' }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#0f172a' }}>
                        Last update: {shelter.lastUpdated ? new Date(shelter.lastUpdated).toLocaleTimeString() : 'N/A'}
                      </div>
                      {getStaleStatusWarning(shelter.updatedAt ? new Date(shelter.updatedAt).getTime() : 0)}
                    </div>
                  </div>

                  {/* Supplies/tags */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                    {shelter.suppliesAvailable?.map((sup, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: '0.6875rem',
                          background: '#f1f5f9',
                          color: '#334155',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}
                      >
                        ✓ {sup}
                      </span>
                    ))}
                  </div>

                  {/* Actions for admins */}
                  {roleType === 'admin' && (
                    <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                      <button
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          background: '#3b82f6',
                          color: '#ffffff',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          border: 'none',
                          cursor: 'pointer'
                        }}
                        onClick={() => handleEditShelter(shelter)}
                        title="Edit shelter"
                      >
                        Edit
                      </button>
                      <button
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          background: '#ef4444',
                          color: '#ffffff',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          border: 'none',
                          cursor: 'pointer'
                        }}
                        onClick={() => handleDeleteShelter(shelter.id)}
                        title="Delete shelter"
                        aria-label={`Delete shelter ${shelter.name}`}
                      >
                        Delete
                      </button>
                    </div>
                  )}

                  {/* Clickable for details */}
                  <a
                    href={`#shelter-${shelter.id}`}
                    style={{
                      marginTop: '10px',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      border: '1px solid #bfdbfe',
                      color: '#1d4ed8',
                      fontSize: '0.6875rem',
                      fontWeight: 500,
                      textDecoration: 'none',
                      cursor: 'pointer'
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      setSelectedShelter(shelter);
                    }}
                  >
                    View Details
                  </a>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Selected shelter detail panel */}
        {selectedShelter && (
          <div style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: 'calc(100vw - 64px)',
            height: 'calc(100vh - 64px)',
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              background: '#ffffff',
              padding: '24px',
              borderRadius: '12px 0 0 12px',
              minWidth: '320px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#0f172a' }}>
                {selectedShelter.name} - Details
              </h3>
              <button
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  background: '#fecaca',
                  color: '#991b1b',
                  border: 'none',
                  cursor: 'pointer'
                }}
                onClick={() => setSelectedShelter(null)}
                aria-label="Close shelter details"
              >
                ✕
              </button>
            </div>

            <div style={{ flex: 1, padding: '24px', overflowX: 'auto' }}>
              {/* Capacity & Services tabs */}
              <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid #e2e8f0' }}>
                <button
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px 6px 0 0',
                    background: selectedShelter.viewTab === 'capacity' ? '#3b82f6' : '#f3f4f6',
                    color: selectedShelter.viewTab === 'capacity' ? '#ffffff' : '#1e293b',
                    border: 'none',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelectedShelter(prev => ({ ...prev, viewTab: 'capacity' }))}
                  aria-selected="true"
                >
                  Capacity
                </button>
                <button
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px 6px 0 0',
                    background: selectedShelter.viewTab === 'services' ? '#3b82f6' : '#f3f4f6',
                    color: selectedShelter.viewTab === 'services' ? '#ffffff' : '#1e293b',
                    border: 'none',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelectedShelter(prev => ({ ...prev, viewTab: 'services' }))}
                >
                  Services
                </button>
                <button
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px 6px 0 0',
                    background: selectedShelter.viewTab === 'events' ? '#3b82f6' : '#f3f4f6',
                    color: selectedShelter.viewTab === 'events' ? '#ffffff' : '#1e293b',
                    border: 'none',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelectedShelter(prev => ({ ...prev, viewTab: 'events' }))}
                >
                  Events
                </button>
                {roleType === 'admin' && (
                  <button
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px 6px 0 0',
                      background: selectedShelter.viewTab === 'verification' ? '#3b82f6' : '#f3f4f6',
                      color: selectedShelter.viewTab === 'verification' ? '#ffffff' : '#1e293b',
                      border: 'none',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      cursor: 'pointer'
                    }}
                    onClick={() => setSelectedShelter(prev => ({ ...prev, viewTab: 'verification' }))}
                  >
                    Verification
                  </button>
                )}
              </div>

              {selectedShelter.viewTab === 'capacity' && (
                <div>
                  <h4 style={{ margin: '0 0 16px', fontSize: '0.875rem', color: '#374151' }}>
                    Capacity History
                  </h4>
                  {capacitySnapshots
                    .filter(s => s.shelterSiteId === selectedShelter.id)
                    .slice(0, 10)
                    .map((snapshot) => (
                      <div
                        key={snapshot.id}
                        style={{
                          marginBottom: '8px',
                          padding: '8px',
                          background: '#f8fafc',
                          borderRadius: '4px',
                          fontSize: '0.75rem'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#64748b' }}>Available</span>
                          <span style={{ color: '#0f172a', fontWeight: 500 }}>{snapshot.capacityAvailable}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '0.6875rem' }}>
                          <span style={{ color: '#64748b' }}>Total</span>
                          <span style={{ color: '#0f172a' }}>{snapshot.capacityTotal}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', color: '#64748b' }}>
                          <span>Occupancy</span>
                          <span style={{ color: '#0f172a' }}>{snapshot.occupancyRate}%</span>
                        </div>
                        <div style={{ marginTop: '4px', color: '#64748b', fontSize: '0.65rem' }}>
                          {snapshot.notes || 'No notes'} • {new Date(snapshot.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  {capacitySnapshots.length === 0 && (
                    <p style={{ color: '#64748b', fontSize: '0.8125rem' }}>No capacity snapshots available.</p>
                  )}
                </div>
              )}

              {selectedShelter.viewTab === 'services' && (
                <div>
                  <h4 style={{ margin: '0 0 16px', fontSize: '0.875rem', color: '#374151' }}>
                    Essential Services Status
                  </h4>
                  {facilityServices
                    .filter(s => s.shelterSiteId === selectedShelter.id)
                    .map((service) => (
                      <div
                        key={service.id}
                        style={{
                          marginBottom: '8px',
                          padding: '8px',
                          background: '#f8fafc',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px'
                        }}
                      >
                        <span
                          style={getServiceStatusStyle(service.status)}
                          style={{
                            width: '80px',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '0.6875rem',
                            fontWeight: 600
                          }}
                        >
                          {getServiceStatusLabel(service.status)}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ marginBottom: '4px', color: '#0f172a', fontWeight: 500, fontSize: '0.75rem' }}>
                            {service.serviceType}: {service.capacityAvailable || 0}/{service.capacityTotal || 0}
                          </div>
                          <div style={{ color: '#64748b', fontSize: '0.6875rem' }}>
                            Last verified: {service.lastVerified ? new Date(service.lastVerified).toLocaleTimeString() : 'N/A'}
                          </div>
                          {service.notes && (
                            <div style={{ color: '#64748b', fontSize: '0.65rem' }}>
                              {service.notes}
                            </div>
                          )}
                        </div>
                        {roleType === 'admin' && (
                          <button
                            style={{
                              marginLeft: 'auto',
                              padding: '4px 6px',
                              borderRadius: '3px',
                              background: '#e5e7eb',
                              color: '#374151',
                              border: 'none',
                              fontSize: '0.625rem',
                              cursor: 'pointer'
                            }}
                            onClick={() => addToast(`Service ${service.serviceType} details`, 'info')}
                            title="View service details"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  {facilityServices.length === 0 && (
                    <p style={{ color: '#64748b', fontSize: '0.8125rem' }}>No facility services recorded.</p>
                  )}
                </div>
              )}

              {selectedShelter.viewTab === 'events' && (
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: '0.875rem', color: '#374151' }}>
                    Status Event History
                  </h4>
                  {statusEvents
                    .filter(e => e.shelterSiteId === selectedShelter.id)
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .slice(0, 15)
                    .map((event) => (
                      <div
                        key={event.id}
                        style={{
                          marginBottom: '6px',
                          padding: '6px',
                          background: '#f8fafc',
                          borderRadius: '4px',
                          fontSize: '0.6875rem'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ color: '#0f172a', fontWeight: 500 }}>{event.eventType}</span>
                          <span style={{ color: '#64748b', fontSize: '0.65rem' }}>
                            {new Date(event.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <div style={{ color: '#64748b', fontSize: '0.65rem' }}>
                          {event.description}
                        </div>
                        {event.oldState && event.newState && (
                          <div style={{ marginTop: '2px', color: '#64748b', fontSize: '0.55rem' }}>
                            {event.oldState} → {event.newState}
                          </div>
                        )}
                        {event.operatorId && (
                          <div style={{ marginTop: '2px', color: '#64748b', fontSize: '0.55rem' }}>
                            By: {event.operatorId}
                          </div>
                        )}
                      </div>
                    ))}
                  {statusEvents.length === 0 && (
                    <p style={{ color: '#64748b', fontSize: '0.8125rem' }}>No status events recorded.</p>
                  )}
                </div>
              )}

              {selectedShelter.viewTab === 'verification' && (
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: '0.875rem', color: '#374151' }}>
                    Verification Checks
                  </h4>
                  {verificationChecks
                    .filter(v => v.shelterSiteId === selectedShelter.id)
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .slice(0, 10)
                    .map((check) => (
                      <div
                        key={check.id}
                        style={{
                          marginBottom: '6px',
                          padding: '6px',
                          background: '#f8fafc',
                          borderRadius: '4px',
                          fontSize: '0.6875rem'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ color: '#0f172a', fontWeight: 500 }}>{check.checkType}</span>
                          <span style={{ color: getCheckStatusColor(check.status), fontSize: '0.65rem' }}>
                            {check.status}
                          </span>
                        </div>
                        <div style={{ color: '#64748b', fontSize: '0.65rem' }}>
                          {check.notes || 'No notes'}
                        </div>
                        {check.rating && (
                          <div style={{ marginTop: '2px', color: '#64748b', fontSize: '0.55rem' }}>
                            Rating: {'★'.repeat(check.rating)} {'.'.repeat(5 - check.rating)}
                          </div>
                        )}
                        {check.checkedBy && (
                          <div style={{ marginTop: '2px', color: '#64748b', fontSize: '0.55rem' }}>
                            Checked by: {check.checkedBy}
                          </div>
                        )}
                      </div>
                    ))}
                  {verificationChecks.length === 0 && (
                    <p style={{ color: '#64748b', fontSize: '0.8125rem' }}>No verification checks recorded.</p>
                  )}
                </div>
              )}
            </div>

            {roleType === 'admin' && (
              <div style={{
                padding: '16px 24px 24px',
                background: '#f8fafc',
                borderRadius: '0 0 12px 12px',
                border: '1px solid #e2e8f0',
                marginTop: 'auto'
              }}>
                <h4 style={{ margin: '0 0 8px', fontSize: '0.75rem', color: '#64748b' }}>
                  Quick Actions
                </h4>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: '#3b82f6',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      cursor: 'pointer'
                    }}
                    onClick={() => handleAddFacilityService()}
                  >
                    Add Service
                  </button>
                  <button
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      cursor: 'pointer'
                    }}
                    onClick={() => handleAddCapacitySnapshot()}
                  >
                    Add Capacity Snapshot
                  </button>
                  <button
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: '#8b5cf6',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      cursor: 'pointer'
                    }}
                    onClick={() => handleAddVerificationCheck()}
                  >
                    Add Verification Check
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Create/Edit Shelter Form */}
        {showCreateForm && (
          <div style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: 'calc(100vw - 64px)',
            height: 'calc(100vh - 64px)',
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)',
            zIndex: 101,
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              background: '#ffffff',
              padding: '24px',
              borderRadius: '12px 0 0 12px',
              minWidth: '320px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#0f172a' }}>
                {isEditing && selectedShelter ? 'Edit Shelter' : 'Add New Shelter'}
              </h3>
              <button
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  background: '#fecaca',
                  color: '#991b1b',
                  border: 'none',
                  cursor: 'pointer'
                }}
                onClick={() => setShowCreateForm(false)}
                aria-label="Close form"
              >
                ✕
              </button>
            </div>

            <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
              {isEditing && selectedShelter ? (
                <form>
                  <input
                    type="hidden"
                    name="id"
                    value={selectedShelter.id}
                  />
                </form>
              ) : (
                <form>
                  <input type="hidden" name="id" value="" />
                </form>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.75rem', fontWeight: 500, color: '#374151' }}>
                  Shelter Name <span style={{ color: '#ef4444', fontSize: '0.625rem' }}>*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name || ''}
                  onChange={handleFormChange}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.75rem', fontWeight: 500, color: '#374151' }}>
                  Jurisdiction <span style={{ color: '#ef4444', fontSize: '0.625rem' }}>*</span>
                </label>
                <input
                  type="text"
                  name="jurisdiction"
                  value={formData.jurisdiction || ''}
                  onChange={handleFormChange}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.75rem', fontWeight: 500, color: '#374151' }}>
                  Address
                </label>
                <textarea
                  name="address"
                  value={formData.address || ''}
                  onChange={handleFormChange}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box',
                    height: '80px',
                    resize: 'vertical'
                  }}
                ></textarea>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.75rem', fontWeight: 500, color: '#374151' }}>
                    Contact Number
                  </label>
                  <input
                    type="text"
                    name="contact"
                    value={formData.contact || ''}
                    onChange={handleFormChange}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '0.875rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.75rem', fontWeight: 500, color: '#374151' }}>
                    Alt Contact
                  </label>
                  <input
                    type="text"
                    name="altContact"
                    value={formData.altContact || ''}
                    onChange={handleFormChange}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '0.875rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.75rem', fontWeight: 500, color: '#374151' }}>
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email || ''}
                  onChange={handleFormChange}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.75rem', fontWeight: 500, color: '#374151' }}>
                  Website
                </label>
                <input
                  type="url"
                  name="website"
                  value={formData.website || ''}
                  onChange={handleFormChange}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.75rem', fontWeight: 500, color: '#374151' }}>
                  Status
                </label>
                <select
                  name="status"
                  value={formData.status || SHELTER_STATES.OPEN}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="ALL">-- Select Status --</option>
                  <option value="OPEN">Open</option>
                  <option value="CLOSED">Closed</option>
                  <option value="TEMPORARILY_CLOSED">Temporarily Closed</option>
                  <option value="MAINTENANCE">Under Maintenance</option>
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.75rem', fontWeight: 500, color: '#374151' }}>
                  Accessibility
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px 10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      accessibility: { ...prev.accessibility, wheelchairAccessible: !prev.accessibility.wheelchairAccessible }
                    }))}
                  >
                    <span
                      style={{ width: '16px', height: '16px', border: '2px solid #6b7280', borderRadius: '3px', ...(formData.accessibility.wheelchairAccessible ? { background: '#3b82f6', borderColor: '#3b82f6' } : {}) }}
                    />
                    Wheelchair Accessible
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px 10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      accessibility: { ...prev.accessibility, hearingImpaired: !prev.accessibility.hearingImpaired }
                    }))}
                  >
                    <span
                      style={{ width: '16px', height: '16px', border: '2px solid #6b7280', borderRadius: '3px', ...(formData.accessibility.hearingImpaired ? { background: '#3b82f6', borderColor: '#3b82f6' } : {}) }}
                    />
                    Hearing Impaired
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px 10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      accessibility: { ...prev.accessibility, visuallyImpaired: !prev.accessibility.visuallyImpaired }
                    }))}
                  >
                    <span
                      style={{ width: '16px', height: '16px', border: '2px solid #6b7280', borderRadius: '3px', ...(formData.accessibility.visuallyImpaired ? { background: '#3b82f6', borderColor: '#3b82f6' } : {}) }}
                    />
                    Visually Impaired
                  </label>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.75rem', fontWeight: 500, color: '#374151' }}>
                  Capacity
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    name="capacityTotal"
                    value={formData.capacityTotal || 0}
                    onChange={(e) => setFormData(prev => ({ ...prev, capacityTotal: Number(e.target.value) || 0 }))}
                    style={{
                      width: '100px',
                      padding: '6px 8px',
                      borderRadius: '4px',
                      border: '1px solid #d1d5db',
                      fontSize: '0.8125rem',
                      boxSizing: 'border-box'
                    }}
                  /> total beds
                  <input
                    type="number"
                    name="capacityAvailable"
                    value={formData.capacityAvailable || 0}
                    onChange={(e) => setFormData(prev => ({ ...prev, capacityAvailable: Number(e.target.value) || 0 }))}
                    style={{
                      width: '100px',
                      padding: '6px 8px',
                      borderRadius: '4px',
                      border: '1px solid #d1d5db',
                      fontSize: '0.8125rem',
                      boxSizing: 'border-box'
                    }}
                  /> available
                </div>
                <div style={{ marginTop: '4px', color: '#64748b', fontSize: '0.6875rem' }}>
                  Occupancy rate: <span id="occupancy-rate-display">0</span>%
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.75rem', fontWeight: 500, color: '#374151' }}>
                  Location (Lat, Lng)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input
                    type="text"
                    name="lat"
                    value={formData.lat || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, lat: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: '4px',
                      border: '1px solid #d1d5db',
                      fontSize: '0.8125rem',
                      boxSizing: 'border-box'
                    }}
                  /> latitude
                  <input
                    type="text"
                    name="lng"
                    value={formData.lng || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, lng: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: '4px',
                      border: '1px solid #d1d5db',
                      fontSize: '0.8125rem',
                      boxSizing: 'border-box'
                    }}
                  /> longitude
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '24px' }}>
                <button
                  type="button"
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    borderRadius: '6px',
                    background: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                  onClick={handleSaveShelter}
                >
                  {isEditing && selectedShelter ? 'Update Shelter' : 'Create Shelter'}
                </button>
                <button
                  type="button"
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    borderRadius: '6px',
                    background: '#6b7280',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Helper: compute and display occupancy rate when capacity inputs change.
 */
function useOccupancyRateDisplay() {
  const [formDataLocal] = useState(formData);
  useEffect(() => {
    const total = formDataLocal.capacityTotal || 0;
    const available = formDataLocal.capacityAvailable || 0;
    const rate = total > 0 ? Math.round(((total - available) / total) * 100) : 100;
    const displayEl = document.getElementById('occupancy-rate-display');
    if (displayEl) displayEl.textContent = rate;
  }, [formDataLocal]);
}
useOccupancyRateDisplay();