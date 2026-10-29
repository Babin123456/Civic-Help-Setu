import { useState } from 'react';
import {
  Accessibility,
  CheckCircle2,
  XCircle,
  HelpCircle,
  X,
  MessageSquare,
  ShieldCheck,
  Building,
  Check
} from 'lucide-react';
import {
  calculateOfficeAccessibilityScore,
  recordOfficeAccessibilityAudit,
  ACCESSIBILITY_FACILITIES,
  FACILITY_LABELS
} from '../../services/accessibilityMapService';

export default function OfficeAccessibilityRatingModal({
  isOpen,
  onClose,
  office,
  onAuditSubmitted,
}) {
  const [facilities, setFacilities] = useState({});
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen || !office) return null;

  const scoreData = calculateOfficeAccessibilityScore(office);

  const handleFacilityChange = (facilityKey, value) => {
    setFacilities(prev => ({
      ...prev,
      [facilityKey]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    recordOfficeAccessibilityAudit(office.id, { facilities, notes });
    setSubmitted(true);
    if (onAuditSubmitted) {
      onAuditSubmitted();
    }
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 1500);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '1rem',
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="accessibility-audit-title"
        className="glass-panel animate-scale-up"
        style={{
          width: 'min(92vw, 560px)',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1.75rem',
          borderRadius: '1.25rem',
          background: 'var(--bg-card, #1e293b)',
          border: '1px solid var(--border-light, #334155)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                padding: '0.6rem',
                borderRadius: '0.65rem',
                background: 'rgba(56, 189, 248, 0.15)',
                color: 'var(--accent-main, #38bdf8)',
              }}
            >
              <Accessibility size={22} aria-hidden="true" />
            </div>
            <div>
              <h3 id="accessibility-audit-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                Physical Accessibility Audit
              </h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                {office.name} ({office.city || office.district})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '0.35rem',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Current Score Summary */}
        <div
          style={{
            padding: '1rem',
            borderRadius: '0.75rem',
            background: 'rgba(15, 23, 42, 0.5)',
            border: `1px solid ${scoreData.color}40`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.25rem',
          }}
        >
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Overall Facility Accessibility Index
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: scoreData.color, marginTop: '0.15rem' }}>
              {scoreData.score}%
              <span style={{ fontSize: '0.85rem', fontWeight: '600', marginLeft: '0.5rem' }}>
                ({scoreData.level} ACCESSIBILITY)
              </span>
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <div>{scoreData.communityAuditsCount} Citizen Audits</div>
            <div>PwD Rights Adherence</div>
          </div>
        </div>

        {/* Audit Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
            Submit Ground-Truth Observations:
          </div>

          <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {[
              { key: ACCESSIBILITY_FACILITIES.WHEELCHAIR_RAMP, label: 'Wheelchair Ramp / Step-Free Entry' },
              { key: ACCESSIBILITY_FACILITIES.ELEVATOR, label: 'Elevator / Lift to Upper Counter Floors' },
              { key: ACCESSIBILITY_FACILITIES.ACCESSIBLE_RESTROOM, label: 'Accessible Disabled-Friendly Restroom' },
              { key: ACCESSIBILITY_FACILITIES.ACCESSIBLE_PARKING, label: 'Designated Accessible Parking Spot' },
              { key: ACCESSIBILITY_FACILITIES.TACTILE_PAVING, label: 'Tactile Guiding Paving for Visually Impaired' },
            ].map(({ key, label }) => {
              const currentVal = facilities[key];

              return (
                <div
                  key={key}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.5rem',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-light, #334155)',
                    fontSize: '0.85rem',
                  }}
                >
                  <span style={{ color: 'var(--text-primary)' }}>{label}</span>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      type="button"
                      onClick={() => handleFacilityChange(key, true)}
                      style={{
                        padding: '0.25rem 0.6rem',
                        borderRadius: '4px',
                        border: '1px solid',
                        borderColor: currentVal === true ? '#10b981' : 'var(--border-light, #334155)',
                        background: currentVal === true ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                        color: currentVal === true ? '#10b981' : 'var(--text-secondary)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      Working
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFacilityChange(key, false)}
                      style={{
                        padding: '0.25rem 0.6rem',
                        borderRadius: '4px',
                        border: '1px solid',
                        borderColor: currentVal === false ? '#ef4444' : 'var(--border-light, #334155)',
                        background: currentVal === false ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                        color: currentVal === false ? '#ef4444' : 'var(--text-secondary)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      Missing / Broken
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label
              htmlFor="accessibility-notes"
              style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}
            >
              Additional Accessibility Notes for PwD &amp; Senior Citizens:
            </label>
            <textarea
              id="accessibility-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Ramp slope is steep; lift requires key from inquiry counter; guard offers assistance."
              rows={2}
              maxLength={300}
              style={{
                width: '100%',
                padding: '0.6rem',
                borderRadius: '0.5rem',
                background: 'var(--bg-main, #0f172a)',
                color: 'var(--text-primary, #f8fafc)',
                border: '1px solid var(--border-light, #334155)',
                fontSize: '0.85rem',
                resize: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ padding: '0.6rem 1rem', fontSize: '0.875rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitted}
              style={{
                padding: '0.6rem 1.25rem',
                fontSize: '0.875rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              {submitted ? <Check size={16} /> : <ShieldCheck size={16} />}
              <span>{submitted ? 'Audit Saved!' : 'Submit Verified Audit'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
