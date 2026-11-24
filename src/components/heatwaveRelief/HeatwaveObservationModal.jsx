import React, { useState } from 'react';
import {
  X,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Send,
  Shield,
  WifiOff,
} from 'lucide-react';
import {
  OPERATIONAL_STATUS,
  OPERATIONAL_STATUS_LABELS,
  CAPACITY_STATUS,
  CAPACITY_STATUS_LABELS,
} from '../../data/upHeatwaveReliefContract';

export default function HeatwaveObservationModal({
  facility,
  onClose,
  onSubmitObservation,
  isSubmitting,
}) {
  const [observedStatus, setObservedStatus] = useState(OPERATIONAL_STATUS.OPEN);
  const [currentCapacityStatus, setCurrentCapacityStatus] = useState(CAPACITY_STATUS.AVAILABLE);
  const [feedbackNote, setFeedbackNote] = useState('');
  const [attachLocation, setAttachLocation] = useState(false);
  const [userCoords, setUserCoords] = useState(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successResult, setSuccessResult] = useState(null);

  if (!facility) return null;

  const handleLocationCheckboxChange = (e) => {
    const checked = e.target.checked;
    setAttachLocation(checked);

    if (checked && !userCoords) {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        setIsGettingLocation(true);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setIsGettingLocation(false);
            setUserCoords({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            });
          },
          () => {
            setIsGettingLocation(false);
            setErrorMsg('Unable to retrieve current location. Report will be submitted without GPS.');
          },
          { timeout: 8000 }
        );
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    const payload = {
      facilityId: facility.id,
      facilityName: facility.name,
      observedStatus,
      currentCapacityStatus,
      feedbackNote: feedbackNote.trim(),
      timestamp: new Date().toISOString(),
      coordinates: attachLocation && userCoords ? userCoords : null,
    };

    const res = await onSubmitObservation(payload);
    if (res.success) {
      setSuccessResult(res.observation || res.draft || { status: 'recorded' });
    } else {
      setErrorMsg(res.errors ? res.errors.join(' ') : 'Failed to submit observation.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="heat-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 1050,
      }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          borderRadius: '0.75rem',
          maxWidth: '540px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h3 id="heat-modal-title" style={{ fontSize: '1.05rem', margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>
              Submit Live Heat-Relief Observation
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {facility.name} • {facility.wardOrVillage}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              padding: '0.35rem',
            }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.25rem' }}>
          {successResult ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <CheckCircle2 size={42} style={{ color: '#16a34a', margin: '0 auto 0.75rem' }} aria-hidden="true" />
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.4rem', color: 'var(--text-primary)' }}>
                Observation Successfully Recorded
              </h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 1rem' }}>
                Thank you for helping fellow citizens. Your time-stamped report will update live status and assist municipal cooling-relief coordination.
              </p>
              {successResult.verificationSeal && (
                <div
                  style={{
                    display: 'inline-block',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '0.4rem',
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-light)',
                    fontSize: '0.78rem',
                    fontFamily: 'monospace',
                    color: 'var(--text-primary)',
                    marginBottom: '1rem',
                  }}
                >
                  Verification Seal: {successResult.verificationSeal}
                </div>
              )}
              <div>
                <button type="button" className="btn btn-primary" onClick={onClose} style={{ fontSize: '0.85rem' }}>
                  Return to Directory
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {errorMsg && (
                <div
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.5rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                    fontSize: '0.82rem',
                  }}
                >
                  {errorMsg}
                </div>
              )}

              {/* Observed Operational Status */}
              <div>
                <label
                  htmlFor="observed-status-select"
                  style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}
                >
                  Observed Facility Status <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  id="observed-status-select"
                  value={observedStatus}
                  onChange={(e) => setObservedStatus(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-main)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                  required
                >
                  {Object.entries(OPERATIONAL_STATUS).map(([key, val]) => (
                    <option key={key} value={val}>
                      {OPERATIONAL_STATUS_LABELS[val]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Observed Capacity */}
              <div>
                <label
                  htmlFor="observed-capacity-select"
                  style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}
                >
                  Current Crowd / Space Availability
                </label>
                <select
                  id="observed-capacity-select"
                  value={currentCapacityStatus}
                  onChange={(e) => setCurrentCapacityStatus(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-main)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                >
                  {Object.entries(CAPACITY_STATUS).map(([key, val]) => (
                    <option key={key} value={val}>
                      {CAPACITY_STATUS_LABELS[val]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes & Feedback */}
              <div>
                <label
                  htmlFor="observed-feedback"
                  style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}
                >
                  Community Note (e.g. cold water tap running, mist fans functional, closed early)
                </label>
                <textarea
                  id="observed-feedback"
                  value={feedbackNote}
                  onChange={(e) => setFeedbackNote(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Share concise details regarding facility conditions or water supply..."
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-main)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                  Zero PII policy: Do not enter phone numbers, private names, or residential flat addresses.
                </span>
              </div>

              {/* Privacy Consent Checkbox for Location */}
              <div
                style={{
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '0.5rem',
                  padding: '0.75rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                }}
              >
                <input
                  id="attach-coords-checkbox"
                  type="checkbox"
                  checked={attachLocation}
                  onChange={handleLocationCheckboxChange}
                  style={{ marginTop: '0.2rem' }}
                />
                <label htmlFor="attach-coords-checkbox" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <strong>Attach anonymous location for proximity verification</strong>
                  <br />
                  Coordinates are snapped to ~1.1km grid for privacy. No precise GPS is stored without your explicit consent.
                  {isGettingLocation && ' (Requesting GPS...)'}
                </label>
              </div>

              {/* Submit Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting || isGettingLocation}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Send size={14} aria-hidden="true" />
                  {isSubmitting ? 'Recording...' : 'Submit Observation'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
