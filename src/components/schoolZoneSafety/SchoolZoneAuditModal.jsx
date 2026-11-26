import { useState, useMemo } from 'react';
import {
  X,
  School,
  AlertTriangle,
  Camera,
  ShieldCheck,
} from 'lucide-react';
import {
  HAZARD_TYPES,
  HAZARD_TYPE_LABELS,
  HAZARD_TYPE_DESCRIPTIONS,
  ROAD_AUTHORITIES,
  ROAD_AUTHORITY_METADATA,
  NON_LEGAL_FAULT_DISCLAIMER,
} from '../../data/upSchoolZoneSafetyContract';
import {
  resolveRoadOwnershipJurisdiction,
  calculateSeverityRationale,
  detectDuplicateReport,
} from '../../services/upSchoolZoneSafetyService';

export default function SchoolZoneAuditModal({
  isOpen,
  onClose,
  schoolZones = [],
  onSubmitAudit,
  defaultSchoolId = '',
}) {
  const [selectedSchoolId, setSelectedSchoolId] = useState(defaultSchoolId || '');
  const [selectedGateId, setSelectedGateId] = useState('');
  const [hazardType, setHazardType] = useState(HAZARD_TYPES.MISSING_ZEBRA_CROSSING);
  const [hazardTitle, setHazardTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reporterRole, setReporterRole] = useState('Parent / SMC Member');
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [enablePhotoAttachment, setEnablePhotoAttachment] = useState(false);

  // Manual Jurisdiction Override state
  const [isManualOverride, setIsManualOverride] = useState(false);
  const [correctedAuthority, setCorrectedAuthority] = useState(ROAD_AUTHORITIES.MUNICIPAL_CORPORATION);
  const [overrideReason, setOverrideReason] = useState('');

  const [formError, setFormError] = useState('');

  const activeSchool = useMemo(() => {
    const targetId = selectedSchoolId || defaultSchoolId || schoolZones[0]?.id;
    return schoolZones.find((s) => s.id === targetId) || schoolZones[0];
  }, [schoolZones, selectedSchoolId, defaultSchoolId]);

  const effectiveGateId = selectedGateId || activeSchool?.verifiedEntrances?.[0]?.gateId || '';

  // Suggested Road Authority
  const suggestedJurisdiction = useMemo(() => {
    if (!activeSchool) return null;
    return resolveRoadOwnershipJurisdiction({
      schoolZone: activeSchool,
      gateId: effectiveGateId,
    });
  }, [activeSchool, effectiveGateId]);

  // Calculated Severity Rationale
  const severityResult = useMemo(() => {
    if (!activeSchool) return null;
    return calculateSeverityRationale({
      hazardType,
      studentCount: activeSchool.studentCount || 300,
      speedLimitKmh: activeSchool.verifiedEntrances?.[0]?.speedLimitDesignatedKmH || 25,
      isPeakHourConflict: true,
    });
  }, [activeSchool, hazardType]);

  // Live duplicate check
  const duplicateWarning = useMemo(() => {
    if (!activeSchool || !effectiveGateId || !hazardType) return null;
    const check = detectDuplicateReport({
      schoolId: activeSchool.id,
      gateId: effectiveGateId,
      hazardType,
    });
    return check.isDuplicate ? check.message : null;
  }, [activeSchool, effectiveGateId, hazardType]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');

    if (!activeSchool) {
      setFormError('Please select a school.');
      return;
    }

    try {
      onSubmitAudit({
        schoolId: activeSchool.id,
        gateId: effectiveGateId,
        hazardType,
        hazardTitle: hazardTitle.trim() || undefined,
        description: description.trim(),
        reporterRole,
        photoUri: enablePhotoAttachment && photoDataUrl ? photoDataUrl : null,
        manualAuthorityOverride: isManualOverride ? correctedAuthority : null,
        overrideReason: isManualOverride ? overrideReason : '',
        forceAllowDuplicate: false,
      });
      onClose();
    } catch (err) {
      setFormError(err.message || 'Error lodging audit report.');
    }
  };

  const handleSimulatePhotoSelect = () => {
    // Generate sample raw image with simulated metadata
    const sampleRawData = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240"><rect width="400" height="240" fill="%23334155"/><text x="20" y="40" fill="%23fff" font-size="14">Raw Photo: Entrance & Passing Traffic</text><circle cx="120" cy="110" r="25" fill="%23cbd5e1"/><text x="105" y="115" font-size="10">Face</text><rect x="220" y="100" width="80" height="28" fill="%231e293b"/><text x="225" y="118" fill="%23facc15" font-size="9">UP 32 BK 4412</text></svg>`;
    setPhotoDataUrl(sampleRawData);
    setEnablePhotoAttachment(true);
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-modal-title"
    >
      <div
        className="modal-content"
        style={{
          background: 'var(--bg-card, #ffffff)',
          color: 'var(--text-primary, #0f172a)',
          borderRadius: '0.75rem',
          maxWidth: '680px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
          border: '1px solid var(--border-light, #e2e8f0)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-light, #e2e8f0)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <School size={22} style={{ color: 'var(--primary, #2563eb)' }} />
            <h2 id="audit-modal-title" style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
              Conduct School-Zone Road Safety Audit
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-tertiary, #94a3b8)',
              padding: '0.25rem',
            }}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {formError && (
            <div
              style={{
                padding: '0.75rem',
                borderRadius: '0.375rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid #f87171',
                color: '#dc2626',
                fontSize: '0.85rem',
              }}
            >
              {formError}
            </div>
          )}

          {/* School Selection */}
          <div>
            <label htmlFor="school-select" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Select Government School (UDISE+ Registered)
            </label>
            <select
              id="school-select"
              value={selectedSchoolId}
              onChange={(e) => setSelectedSchoolId(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem',
                borderRadius: '0.375rem',
                border: '1px solid var(--border-light, #cbd5e1)',
                background: 'var(--bg-input, #f8fafc)',
                color: 'var(--text-primary, #0f172a)',
                fontSize: '0.88rem',
              }}
            >
              {schoolZones.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (UDISE: {s.udiseCode} • {s.district})
                </option>
              ))}
            </select>
          </div>

          {/* Entrance / Gate Selection */}
          {activeSchool?.verifiedEntrances?.length > 0 && (
            <div>
              <label htmlFor="gate-select" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Verified Entrance Gate & Facing Road
              </label>
              <select
                id="gate-select"
                value={effectiveGateId}
                onChange={(e) => setSelectedGateId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem',
                  borderRadius: '0.375rem',
                  border: '1px solid var(--border-light, #cbd5e1)',
                  background: 'var(--bg-input, #f8fafc)',
                  color: 'var(--text-primary, #0f172a)',
                  fontSize: '0.88rem',
                }}
              >
                {activeSchool.verifiedEntrances.map((ent) => (
                  <option key={ent.gateId} value={ent.gateId}>
                    {ent.name} — Facing: {ent.facingRoadName} ({ent.roadClassification})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Hazard Title */}
          <div>
            <label htmlFor="hazard-title-input" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Hazard Summary Title (Optional)
            </label>
            <input
              id="hazard-title-input"
              type="text"
              placeholder={`e.g. ${HAZARD_TYPE_LABELS[hazardType]} outside gate`}
              value={hazardTitle}
              onChange={(e) => setHazardTitle(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem',
                borderRadius: '0.375rem',
                border: '1px solid var(--border-light, #cbd5e1)',
                background: 'var(--bg-input, #f8fafc)',
                color: 'var(--text-primary, #0f172a)',
                fontSize: '0.85rem',
              }}
            />
          </div>

          {/* Hazard Type Category */}
          <div>
            <label htmlFor="hazard-type-select" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Hazard Dimension / Infrastructure Deficiency
            </label>
            <select
              id="hazard-type-select"
              value={hazardType}
              onChange={(e) => setHazardType(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem',
                borderRadius: '0.375rem',
                border: '1px solid var(--border-light, #cbd5e1)',
                background: 'var(--bg-input, #f8fafc)',
                color: 'var(--text-primary, #0f172a)',
                fontSize: '0.88rem',
              }}
            >
              {Object.entries(HAZARD_TYPE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #64748b)', marginTop: '0.25rem' }}>
              {HAZARD_TYPE_DESCRIPTIONS[hazardType]}
            </div>
          </div>

          {/* Duplicate Warning (AC-6) */}
          {duplicateWarning && (
            <div
              style={{
                padding: '0.75rem',
                borderRadius: '0.375rem',
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid #f59e0b',
                color: '#b45309',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <AlertTriangle size={16} />
              <span>{duplicateWarning}</span>
            </div>
          )}

          {/* Description & Severity Preview */}
          <div>
            <label htmlFor="description-input" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Physical Observations & Measurements (Optional Details)
            </label>
            <textarea
              id="description-input"
              rows={2}
              placeholder="e.g. Zebra paint is 100% worn off; vehicles travel at ~45 km/h during 8:00 AM student arrival..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem',
                borderRadius: '0.375rem',
                border: '1px solid var(--border-light, #cbd5e1)',
                background: 'var(--bg-input, #f8fafc)',
                color: 'var(--text-primary, #0f172a)',
                fontSize: '0.85rem',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Severity Rationale Banner */}
          {severityResult && (
            <div
              style={{
                padding: '0.75rem',
                borderRadius: '0.375rem',
                background: 'rgba(59, 130, 246, 0.05)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                fontSize: '0.82rem',
              }}
            >
              <strong>Objective Severity Rationale ({severityResult.severity.toUpperCase()}):</strong>{' '}
              {severityResult.rationale}
            </div>
          )}

          {/* Authority Routing & Manual Override (AC-3) */}
          <div
            style={{
              padding: '0.85rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-light, #e2e8f0)',
              background: 'rgba(15, 23, 42, 0.02)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                Road Ownership Jurisdiction Routing
              </span>
              <button
                type="button"
                onClick={() => setIsManualOverride(!isManualOverride)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary, #2563eb)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                {isManualOverride ? 'Use Suggested Authority' : 'Manual Override'}
              </button>
            </div>

            {!isManualOverride ? (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary, #475569)' }}>
                <div>
                  <strong>Default Responsible Authority:</strong> {suggestedJurisdiction?.metadata?.label}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary, #64748b)', marginTop: '0.2rem' }}>
                  <strong>Source:</strong> {suggestedJurisdiction?.source}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                <select
                  value={correctedAuthority}
                  onChange={(e) => setCorrectedAuthority(e.target.value)}
                  style={{
                    padding: '0.45rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border-light, #cbd5e1)',
                    background: 'var(--bg-input, #ffffff)',
                    fontSize: '0.85rem',
                  }}
                >
                  {Object.entries(ROAD_AUTHORITY_METADATA).map(([k, meta]) => (
                    <option key={k} value={k}>
                      {meta.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Reason for manual correction (e.g. Recently transferred to Nagar Nigam)..."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  style={{
                    padding: '0.45rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border-light, #cbd5e1)',
                    background: 'var(--bg-input, #ffffff)',
                    fontSize: '0.82rem',
                  }}
                />
              </div>
            )}
          </div>

          {/* Photo Evidence with Privacy Redaction Preview (AC-2) */}
          <div
            style={{
              padding: '0.85rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-light, #e2e8f0)',
              background: 'rgba(15, 23, 42, 0.02)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Camera size={16} /> Geotagged Photo Evidence (Optional)
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--primary, #2563eb)', fontWeight: 600 }}>
                AC-2 Privacy Redacted
              </span>
            </div>

            {!enablePhotoAttachment ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleSimulatePhotoSelect}
                style={{
                  padding: '0.5rem',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                }}
              >
                <Camera size={15} /> Attach Sample Corridor Photo
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div
                  style={{
                    padding: '0.65rem',
                    borderRadius: '0.375rem',
                    background: '#0f172a',
                    color: '#ffffff',
                    fontSize: '0.78rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <ShieldCheck size={16} style={{ color: '#60a5fa' }} />
                    Faces & License Plates Blurring Simulation Active
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEnablePhotoAttachment(false);
                      setPhotoDataUrl('');
                    }}
                    style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.75rem' }}
                  >
                    Remove
                  </button>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary, #64748b)' }}>
                  Original unredacted file is encrypted and kept private to your reporter token. Public viewers will only see blurred zones.
                </div>
              </div>
            )}
          </div>

          {/* Reporter Role */}
          <div>
            <label htmlFor="reporter-role-select" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Your Role / Provenance
            </label>
            <select
              id="reporter-role-select"
              value={reporterRole}
              onChange={(e) => setReporterRole(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '0.375rem',
                border: '1px solid var(--border-light, #cbd5e1)',
                background: 'var(--bg-input, #f8fafc)',
                fontSize: '0.85rem',
              }}
            >
              <option value="Parent / Caregiver">Parent / Caregiver</option>
              <option value="SMC Member / Official">SMC Member / Official</option>
              <option value="School Teacher / Principal">School Teacher / Principal</option>
              <option value="Community Resident">Community Resident</option>
              <option value="Traffic Safety Volunteer">Traffic Safety Volunteer</option>
            </select>
          </div>

          {/* Ethical Disclaimer Box */}
          <div
            style={{
              padding: '0.65rem 0.85rem',
              borderRadius: '0.375rem',
              background: 'rgba(100, 116, 139, 0.08)',
              border: '1px solid rgba(100, 116, 139, 0.2)',
              fontSize: '0.75rem',
              color: 'var(--text-secondary, #475569)',
              lineHeight: 1.4,
            }}
          >
            <strong>Civil Observation Notice:</strong> {NON_LEGAL_FAULT_DISCLAIMER}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              style={{ padding: '0.55rem 1rem', fontSize: '0.88rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{
                padding: '0.55rem 1.25rem',
                fontSize: '0.88rem',
                fontWeight: 700,
                background: 'var(--primary, #2563eb)',
                color: '#ffffff',
              }}
            >
              Submit Safety Audit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
