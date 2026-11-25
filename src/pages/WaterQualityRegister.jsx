/**
 * src/pages/WaterQualityRegister.jsx
 * Community Water-Quality Sampling and Laboratory Result Register (#754).
 *
 * Provides a public-facing record of water-quality sampling events and verified
 * laboratory results for public water points under IS 10500:2012 specifications.
 */

import { useState, useMemo, useCallback } from 'react';
import {
  Droplet,
  ShieldCheck,
  AlertOctagon,
  PlusCircle,
  Info,
} from 'lucide-react';
import {
  listWaterPoints,
  getWaterPointDetails,
  createWaterPoint,
  recordSamplingEvent,
  recordLabResults,
  publishOfficialCorrection,
  recordCorrectiveAction,
  getAvailableCities,
  getAvailableWards,
} from '../services/waterQualityService.js';
import { IS_10500_STANDARDS, WATER_POINT_TYPES } from '../data/waterQualityContract.js';
import WaterPointCard from '../components/waterQuality/WaterPointCard.jsx';
import WaterQualityFilters from '../components/waterQuality/WaterQualityFilters.jsx';
import SamplingHistoryModal from '../components/waterQuality/SamplingHistoryModal.jsx';
import SampleIntakeModal from '../components/waterQuality/SampleIntakeModal.jsx';
import LabResultEntryModal from '../components/waterQuality/LabResultEntryModal.jsx';
import OfficialCorrectionModal from '../components/waterQuality/OfficialCorrectionModal.jsx';
import CorrectiveActionModal from '../components/waterQuality/CorrectiveActionModal.jsx';

export default function WaterQualityRegister() {
  const [filters, setFilters] = useState({
    city: 'All',
    ward: 'All',
    pointType: 'all',
    status: 'all',
    compliance: 'all',
    search: '',
  });

  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [userRole, setUserRole] = useState('public');
  const [dataVersion, setDataVersion] = useState(0);
  const [activeWaterPointId, setActiveWaterPointId] = useState(null);

  // Modals state
  const [selectedPointForSample, setSelectedPointForSample] = useState(null);
  const [selectedEventForResults, setSelectedEventForResults] = useState(null);
  const [selectedEventForCorrection, setSelectedEventForCorrection] = useState(null);
  const [selectedPointForAction, setSelectedPointForAction] = useState(null);
  const [showAddPointModal, setShowAddPointModal] = useState(false);

  // New Water Point form state
  const [newPointForm, setNewPointForm] = useState({
    name: '',
    pointType: 'public_standpost',
    ward: '',
    city: 'Bengaluru',
    landmark: '',
    sourceType: 'Municipal Piped Distribution',
  });
  const [formError, setFormError] = useState('');

  // Reload data from service
  const refreshData = useCallback(() => {
    setDataVersion((v) => v + 1);
  }, []);

  const waterPoints = useMemo(() => {
    return listWaterPoints(filters, { role: userRole });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, userRole, dataVersion]);

  const availableCities = useMemo(() => getAvailableCities(), []);
  const availableWards = useMemo(() => getAvailableWards(filters.city), [filters.city]);

  const activeWaterPoint = useMemo(() => {
    return activeWaterPointId ? getWaterPointDetails(activeWaterPointId) : null;
  }, [activeWaterPointId]);

  // Statistics overview
  const stats = useMemo(() => {
    const total = waterPoints.length;
    const compliant = waterPoints.filter((w) => w.overallComplianceStatus === 'compliant').length;
    const exceeded = waterPoints.filter((w) => w.overallComplianceStatus === 'exceeded' || w.overallComplianceStatus === 'critical_hazard').length;
    const pending = waterPoints.filter((w) => w.overallComplianceStatus === 'pending').length;
    return { total, compliant, exceeded, pending };
  }, [waterPoints]);

  // Handlers for modal actions
  const handleRecordSampleSubmit = (payload) => {
    recordSamplingEvent(payload, { role: userRole, id: 'OPERATOR-USER' });
    refreshData();
  };

  const handleLabResultSubmit = (sampleEventId, payload) => {
    recordLabResults(sampleEventId, payload, { role: userRole, id: 'ANALYST-USER' });
    refreshData();
  };

  const handleCorrectionSubmit = (sampleEventId, payload) => {
    publishOfficialCorrection(sampleEventId, payload, { role: userRole, id: 'REVIEWER-USER' });
    refreshData();
  };

  const handleCorrectiveActionSubmit = (payload) => {
    recordCorrectiveAction(payload, { role: userRole, id: 'OFFICIAL-USER' });
    refreshData();
  };

  const handleCreatePointSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    try {
      createWaterPoint(newPointForm, { role: userRole, id: 'ADMIN-USER' });
      setShowAddPointModal(false);
      setNewPointForm({
        name: '',
        pointType: 'public_standpost',
        ward: '',
        city: 'Bengaluru',
        landmark: '',
        sourceType: 'Municipal Piped Distribution',
      });
      refreshData();
    } catch (err) {
      setFormError(err.message);
    }
  };

  return (
    <main className="wq-container">
      {/* Page Header */}
      <div className="wq-header">
        <div className="wq-header-top">
          <span className="wq-badge wq-badge-success">
            <Droplet size={14} />
            Official Municipal Water Surveillance
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
            Standard: {IS_10500_STANDARDS.specification}
          </span>
        </div>

        <div className="wq-title-row">
          <div>
            <h1 className="wq-title">
              Community Water-Quality Sampling &amp; Laboratory Result Register
            </h1>
            <p className="wq-subtitle">
              Public verification record of water-quality surveillance events, certified laboratory findings, and corrective interventions across community water standposts, RO plants, and municipal sources.
            </p>
          </div>

          {['sampler', 'official_reviewer', 'admin'].includes(userRole) && (
            <button
              type="button"
              onClick={() => setShowAddPointModal(true)}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', padding: '0.6rem 1rem' }}
            >
              <PlusCircle size={16} />
              <span>Register Water Point</span>
            </button>
          )}
        </div>
      </div>

      {/* Statutory Standard Notice */}
      <div className="wq-notice">
        <Info size={20} className="wq-notice-icon" />
        <div>
          <strong style={{ display: 'block', marginBottom: '0.2rem' }}>
            Statutory Reference: {IS_10500_STANDARDS.title}
          </strong>
          <span>
            All parameter measurements are compared deterministically against Bureau of Indian Standards (BIS) acceptable and permissible limits. Any corrective intervention is sanctioned under Urban Local Body Public Health Bye-laws.
          </span>
        </div>
      </div>

      {/* Metrics Overview Cards */}
      <div className="wq-stats-grid">
        <div className="wq-stat-card">
          <span className="wq-stat-label">
            Total Monitored Points
          </span>
          <div className="wq-stat-val">
            {stats.total}
          </div>
        </div>

        <div className="wq-stat-card" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
          <span className="wq-stat-label" style={{ color: '#10b981' }}>
            <ShieldCheck size={16} />
            IS 10500 Compliant
          </span>
          <div className="wq-stat-val" style={{ color: '#10b981' }}>
            {stats.compliant}
          </div>
        </div>

        <div className="wq-stat-card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
          <span className="wq-stat-label" style={{ color: '#ef4444' }}>
            <AlertOctagon size={16} />
            Exceeded / Alert
          </span>
          <div className="wq-stat-val" style={{ color: '#ef4444' }}>
            {stats.exceeded}
          </div>
        </div>

        <div className="wq-stat-card">
          <span className="wq-stat-label">
            Pending Lab Analysis
          </span>
          <div className="wq-stat-val">
            {stats.pending}
          </div>
        </div>
      </div>

      {/* Filters and View Controls */}
      <WaterQualityFilters
        filters={filters}
        onFilterChange={setFilters}
        availableCities={availableCities}
        availableWards={availableWards}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        userRole={userRole}
        onRoleChange={setUserRole}
      />

      {/* Main Content: Cards or Accessible Table */}
      {waterPoints.length === 0 ? (
        <div className="wq-empty-state">
          <Droplet size={36} style={{ color: 'var(--text-tertiary)', margin: '0 auto 0.75rem auto' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>
            No water points match the selected criteria
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 1rem auto' }}>
            Try adjusting your search terms, changing the city/ward selection, or clearing the compliance filter.
          </p>
          <button
            type="button"
            onClick={() => setFilters({ city: 'All', ward: 'All', pointType: 'all', status: 'all', compliance: 'all', search: '' })}
            className="btn btn-secondary text-xs px-4 py-2"
          >
            Reset Filters
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="wq-cards-grid">
          {waterPoints.map((wp) => (
            <WaterPointCard
              key={wp.id}
              waterPoint={wp}
              onViewDetails={(id) => setActiveWaterPointId(id)}
              onRecordSample={() => setSelectedPointForSample(wp)}
              onAddCorrectiveAction={() => setSelectedPointForAction(wp)}
              userRole={userRole}
            />
          ))}
        </div>
      ) : (
        /* Accessible Table Alternative */
        <div className="wq-table-wrapper">
          <table className="wq-table" aria-label="Water Points Directory Table">
            <caption className="sr-only">Directory of community water points and surveillance test history</caption>
            <thead>
              <tr>
                <th scope="col">ID &amp; Name</th>
                <th scope="col">Type</th>
                <th scope="col">Ward &amp; City</th>
                <th scope="col">Source</th>
                <th scope="col">Compliance</th>
                <th scope="col">Last Tested</th>
                <th scope="col" style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {waterPoints.map((wp) => (
                <tr key={wp.id}>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>
                      {wp.id}
                    </span>
                    <strong>{wp.name}</strong>
                  </td>
                  <td>
                    {WATER_POINT_TYPES[wp.pointType]?.label || wp.pointType}
                  </td>
                  <td>
                    <div>{wp.ward}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{wp.city}</div>
                  </td>
                  <td>{wp.sourceType}</td>
                  <td>
                    <span className={`wq-badge ${
                      wp.overallComplianceStatus === 'compliant'
                        ? 'wq-badge-success'
                        : wp.overallComplianceStatus === 'exceeded'
                          ? 'wq-badge-warning'
                          : wp.overallComplianceStatus === 'critical_hazard'
                            ? 'wq-badge-danger'
                            : 'wq-badge-neutral'
                    }`}>
                      {wp.overallComplianceStatus.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>
                    {wp.sampleAge?.text || 'Not tested'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => setActiveWaterPointId(wp.id)}
                      className="btn btn-secondary text-xs"
                      style={{ padding: '0.35rem 0.65rem' }}
                    >
                      History &amp; Results
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Sampling History & Results */}
      {activeWaterPoint && (
        <SamplingHistoryModal
          waterPoint={activeWaterPoint}
          onClose={() => setActiveWaterPointId(null)}
          onAddResults={(eventId) => setSelectedEventForResults(eventId)}
          onPublishCorrection={(eventId) => setSelectedEventForCorrection(eventId)}
          onAddCorrectiveAction={() => setSelectedPointForAction(activeWaterPoint)}
          userRole={userRole}
        />
      )}

      {/* Modal: Physical Sample Intake */}
      {selectedPointForSample && (
        <SampleIntakeModal
          waterPoint={selectedPointForSample}
          onClose={() => setSelectedPointForSample(null)}
          onSubmit={handleRecordSampleSubmit}
        />
      )}

      {/* Modal: Record Lab Results */}
      {selectedEventForResults && (
        <LabResultEntryModal
          sampleEventId={selectedEventForResults}
          onClose={() => setSelectedEventForResults(null)}
          onSubmit={handleLabResultSubmit}
        />
      )}

      {/* Modal: Publish Official Correction */}
      {selectedEventForCorrection && (
        <OfficialCorrectionModal
          sampleEventId={selectedEventForCorrection}
          onClose={() => setSelectedEventForCorrection(null)}
          onSubmit={handleCorrectionSubmit}
        />
      )}

      {/* Modal: Sanction Corrective Action */}
      {selectedPointForAction && (
        <CorrectiveActionModal
          waterPoint={selectedPointForAction}
          onClose={() => setSelectedPointForAction(null)}
          onSubmit={handleCorrectiveActionSubmit}
        />
      )}

      {/* Modal: Create Water Point (Admin/Sampler) */}
      {showAddPointModal && (
        <div
          className="wq-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-wp-title"
        >
          <div className="wq-modal-dialog" style={{ maxWidth: '500px' }}>
            <div className="wq-modal-header">
              <h3 id="add-wp-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                Register Public Water Point
              </h3>
              <button
                type="button"
                onClick={() => setShowAddPointModal(false)}
                className="btn btn-secondary text-xs"
                style={{ padding: '0.25rem 0.5rem' }}
              >
                ✕
              </button>
            </div>

            <div className="wq-modal-body">
              {formError && (
                <div style={{ padding: '0.6rem 0.8rem', marginBottom: '1rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '0.5rem', fontSize: '0.8rem' }}>
                  {formError}
                </div>
              )}

              <form onSubmit={handleCreatePointSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div className="wq-field-group">
                  <label className="wq-field-label">Water Point Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Victoria Hospital Public Standpost Tap"
                    value={newPointForm.name}
                    onChange={(e) => setNewPointForm({ ...newPointForm, name: e.target.value })}
                    className="wq-input"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="wq-field-group">
                    <label className="wq-field-label">Type *</label>
                    <select
                      value={newPointForm.pointType}
                      onChange={(e) => setNewPointForm({ ...newPointForm, pointType: e.target.value })}
                      className="wq-select"
                    >
                      {Object.entries(WATER_POINT_TYPES).map(([k, d]) => (
                        <option key={k} value={k}>{d.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="wq-field-group">
                    <label className="wq-field-label">City *</label>
                    <input
                      type="text"
                      required
                      value={newPointForm.city}
                      onChange={(e) => setNewPointForm({ ...newPointForm, city: e.target.value })}
                      className="wq-input"
                    />
                  </div>
                </div>

                <div className="wq-field-group">
                  <label className="wq-field-label">Ward / Locality *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ward 120 - Cottonpet"
                    value={newPointForm.ward}
                    onChange={(e) => setNewPointForm({ ...newPointForm, ward: e.target.value })}
                    className="wq-input"
                  />
                </div>

                <div className="wq-field-group">
                  <label className="wq-field-label">Landmark (Zero Residential PII)</label>
                  <input
                    type="text"
                    placeholder="e.g. Near Main Gate, Opp Pharmacy"
                    value={newPointForm.landmark}
                    onChange={(e) => setNewPointForm({ ...newPointForm, landmark: e.target.value })}
                    className="wq-input"
                  />
                </div>

                <div className="wq-field-group">
                  <label className="wq-field-label">Water Source Supply Type</label>
                  <input
                    type="text"
                    value={newPointForm.sourceType}
                    onChange={(e) => setNewPointForm({ ...newPointForm, sourceType: e.target.value })}
                    className="wq-input"
                  />
                </div>

                <div className="wq-modal-footer" style={{ padding: '0.75rem 0 0 0', background: 'transparent' }}>
                  <button
                    type="button"
                    onClick={() => setShowAddPointModal(false)}
                    className="btn btn-secondary text-xs"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary text-xs">
                    Create Water Point
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
