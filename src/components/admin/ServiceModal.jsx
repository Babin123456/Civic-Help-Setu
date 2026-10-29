import { useState, useEffect } from 'react';
import { X, CheckSquare, Plus, Save } from 'lucide-react';
import { SERVICE_CATEGORIES } from '../../data/serviceCategories';
import useUnsavedChangesGuard from '../../hooks/useUnsavedChangesGuard';
import { isFormDirty } from '../../utils/formDraft';
import UnsavedChangesDialog from '../common/UnsavedChangesDialog';
import { INDIAN_STATES_AND_UTS, JURISDICTION_LEVELS, JURISDICTION_LEVEL_LABELS } from '../../data/jurisdictions';
import { normalizeJurisdiction, validateJurisdiction } from '../../services/jurisdictionService';
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const MODES = ['Online', 'Offline', 'Online / Offline'];

const jurisdictionFields = (service) => {
  const j = normalizeJurisdiction(service?.jurisdiction);
  return {
    jurisdictionLevel: j?.level || '',
    jurisdictionStates: j?.states || [],
    jurisdictionDistrict: (j?.districts || []).join(', '),
    jurisdictionLocalBody: j?.localBody || '',
  };
};

const buildForm = (service) =>
  service
    ? {
        ...jurisdictionFields(service),
        name: service.name || '',
        category: service.category || 'Certificates',
        type: service.type || 'Online / Offline',
        difficulty: service.difficulty || 'Medium',
        shortDescription: service.shortDescription || '',
        fees: service.fees || 'Free of cost',
        processingTime: service.processingTime || '7 - 15 days',
        officialUrl: service.officialSources?.[0]?.url || 'https://services.india.gov.in',
        portalName: service.officialSources?.[0]?.name || 'Official Government Portal',
        documentsText: (service.documents || []).join('\n'),
        eligibilityText: (service.eligibility || []).join('\n'),
      }
    : {
        ...jurisdictionFields(null),
        name: '',
        category: 'Certificates',
        type: 'Online / Offline',
        difficulty: 'Medium',
        shortDescription: '',
        fees: 'Free of cost',
        processingTime: '7 - 15 days',
        officialUrl: 'https://services.india.gov.in',
        portalName: 'National Government Services Portal',
        documentsText: 'Proof of Identity (Aadhaar / Voter ID)\nProof of Address\nPassport size photograph',
        eligibilityText: 'Indian citizen or resident\nValid identification proof',
      };

const ServiceModal = ({ isOpen, serviceToEdit, onClose, onSave }) => {
  const [form, setForm] = useState(() => buildForm(null));
  // Last saved/initial values; the form is dirty only when it differs from this.
  const [baseline, setBaseline] = useState(() => buildForm(null));
  const [error, setError] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);

  useEffect(() => {
    const initial = buildForm(serviceToEdit);
    setForm(initial);
    setBaseline(initial);
    setConfirmClose(false);
  }, [serviceToEdit, isOpen]);

  const isDirty = isOpen && isFormDirty(form, baseline);
  const guard = useUnsavedChangesGuard(isDirty);

  const requestClose = () => {
    if (isDirty) setConfirmClose(true);
    else onClose();
  };

  const handleStay = () => {
    setConfirmClose(false);
    guard.stay();
  };

  const handleDiscard = () => {
    if (guard.isBlocked) {
      guard.discard();
    } else {
      setConfirmClose(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Service name is required');
      return;
    }
    if (!form.shortDescription.trim()) {
      setError('Short description is required');
      return;
    }

    let jurisdiction = null;
    if (form.jurisdictionLevel) {
      jurisdiction = {
        level: form.jurisdictionLevel,
        states: form.jurisdictionLevel === 'national' ? [] : form.jurisdictionStates,
        districts: form.jurisdictionDistrict.split(',').map((d) => d.trim()).filter(Boolean),
        localBody: form.jurisdictionLocalBody.trim(),
      };
      const problems = validateJurisdiction(jurisdiction);
      if (problems.length > 0) {
        setError(problems[0]);
        return;
      }
      jurisdiction = normalizeJurisdiction(jurisdiction);
    }

    const documents = form.documentsText
      .split('\n')
      .map((d) => d.trim())
      .filter(Boolean);

    const eligibility = form.eligibilityText
      .split('\n')
      .map((e) => e.trim())
      .filter(Boolean);

    const servicePayload = {
      ...(serviceToEdit || {}),
      name: form.name.trim(),
      category: form.category,
      type: form.type,
      difficulty: form.difficulty,
      shortDescription: form.shortDescription.trim(),
      fees: form.fees.trim(),
      processingTime: form.processingTime.trim(),
      documents,
      eligibility,
      officialSources: [
        {
          name: form.portalName.trim(),
          url: form.officialUrl.trim(),
          verified: true,
        },
      ],
      steps: serviceToEdit?.steps || [
        { title: 'Gather Documents', description: 'Collect and verify all prerequisite identity proofs.' },
        { title: 'Online/Offline Submission', description: 'Fill the official form on the designated government portal.' },
        { title: 'Verification & Issuance', description: 'Officer reviews records and issues the certificate.' },
      ],
    };

    // No level chosen means "not specified", so the field is removed rather than guessed.
    if (jurisdiction) servicePayload.jurisdiction = jurisdiction;
    else delete servicePayload.jurisdiction;

    onSave(servicePayload);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="card animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '620px',
          background: 'var(--bg-main)',
          position: 'relative',
          padding: '2rem',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <button
          type="button"
          onClick={requestClose}
          aria-label="Close dialog"
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'var(--glass-bg)',
            border: 'none',
            color: 'var(--text-secondary)',
            padding: '0.5rem',
            borderRadius: '50%',
            cursor: 'pointer',
          }}
        >
          <X size={20} />
        </button>

        <div style={{ marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--accent-main)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Administrative Panel
          </span>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '800', marginTop: '0.2rem' }}>
            {serviceToEdit ? 'Edit Service Roadmap' : 'Create New Civic Service Guide'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Define eligibility rules, fees, processing duration, and official portal URLs.
          </p>
        </div>

        {error && (
          <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '0.5rem', color: 'var(--error, #ef4444)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Service Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Caste Certificate, Income Certificate"
              className="input-field"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={{ fontSize: '0.95rem', padding: '0.75rem 1rem' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Category
              </label>
              <select
                className="input-field"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                style={{ padding: '0.65rem 0.5rem', fontSize: '0.85rem', background: 'var(--glass-bg)' }}
              >
                {SERVICE_CATEGORIES.map((c) => (
                  <option key={c} value={c} style={{ background: 'var(--bg-main)' }}>{c}</option>
                ))}
                {/* Keep a category saved before the shared list existed (e.g. "Welfare")
                    visible, so editing doesn't silently change it */}
                {form.category && !SERVICE_CATEGORIES.includes(form.category) && (
                  <option value={form.category} style={{ background: 'var(--bg-main)' }}>
                    {form.category} (not in the category list)
                  </option>
                )}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Mode
              </label>
              <select
                className="input-field"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                style={{ padding: '0.65rem 0.5rem', fontSize: '0.85rem', background: 'var(--glass-bg)' }}
              >
                {MODES.map((m) => (
                  <option key={m} value={m} style={{ background: 'var(--bg-main)' }}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Difficulty
              </label>
              <select
                className="input-field"
                value={form.difficulty}
                onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                style={{ padding: '0.65rem 0.5rem', fontSize: '0.85rem', background: 'var(--glass-bg)' }}
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d} style={{ background: 'var(--bg-main)' }}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Plain Language Summary *
            </label>
            <textarea
              rows={2}
              required
              placeholder="Explain the service clearly in 1 or 2 sentences."
              className="input-field"
              value={form.shortDescription}
              onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
              style={{ fontSize: '0.9rem', padding: '0.75rem 1rem', borderRadius: '0.75rem' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Expected Fees
              </label>
              <input
                type="text"
                placeholder="e.g. ₹50 (varies by state)"
                className="input-field"
                value={form.fees}
                onChange={(e) => setForm({ ...form, fees: e.target.value })}
                style={{ fontSize: '0.9rem', padding: '0.7rem 0.9rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Processing Duration
              </label>
              <input
                type="text"
                placeholder="e.g. 7 - 21 days"
                className="input-field"
                value={form.processingTime}
                onChange={(e) => setForm({ ...form, processingTime: e.target.value })}
                style={{ fontSize: '0.9rem', padding: '0.7rem 0.9rem' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Official Portal Name
              </label>
              <input
                type="text"
                placeholder="e.g. UIDAI Official Portal"
                className="input-field"
                value={form.portalName}
                onChange={(e) => setForm({ ...form, portalName: e.target.value })}
                style={{ fontSize: '0.9rem', padding: '0.7rem 0.9rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Official Portal URL
              </label>
              <input
                type="url"
                placeholder="https://..."
                className="input-field"
                value={form.officialUrl}
                onChange={(e) => setForm({ ...form, officialUrl: e.target.value })}
                style={{ fontSize: '0.9rem', padding: '0.7rem 0.9rem' }}
              />
            </div>
          </div>

          <fieldset className="jurisdiction-fields">
            <legend>Where this service applies</legend>
            <label htmlFor="svc-jurisdiction-level">Jurisdiction level</label>
            <select
              id="svc-jurisdiction-level"
              className="input-field"
              value={form.jurisdictionLevel}
              onChange={(e) => setForm({ ...form, jurisdictionLevel: e.target.value, jurisdictionStates: [] })}
              style={{ background: 'var(--glass-bg)' }}
            >
              <option value="" style={{ background: 'var(--bg-main)' }}>Not specified (shown as unverified)</option>
              {JURISDICTION_LEVELS.map((l) => (
                <option key={l} value={l} style={{ background: 'var(--bg-main)' }}>{JURISDICTION_LEVEL_LABELS[l]}</option>
              ))}
            </select>
            {['state', 'district', 'local'].includes(form.jurisdictionLevel) && (
              <>
                <label htmlFor="svc-jurisdiction-states">
                  {form.jurisdictionLevel === 'state' ? 'States / UTs (hold Ctrl or Cmd to pick several)' : 'State / UT'}
                </label>
                <select
                  id="svc-jurisdiction-states"
                  className="input-field"
                  multiple={form.jurisdictionLevel === 'state'}
                  size={form.jurisdictionLevel === 'state' ? 6 : undefined}
                  value={form.jurisdictionLevel === 'state' ? form.jurisdictionStates : form.jurisdictionStates[0] || ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      jurisdictionStates: Array.from(e.target.selectedOptions, (o) => o.value).filter(Boolean),
                    })
                  }
                  style={{ background: 'var(--glass-bg)' }}
                >
                  {form.jurisdictionLevel !== 'state' && <option value="">Select a state / UT</option>}
                  {INDIAN_STATES_AND_UTS.map((st) => (
                    <option key={st} value={st} style={{ background: 'var(--bg-main)' }}>{st}</option>
                  ))}
                </select>
              </>
            )}
            {['district', 'local'].includes(form.jurisdictionLevel) && (
              <>
                <label htmlFor="svc-jurisdiction-district">District</label>
                <input
                  id="svc-jurisdiction-district"
                  type="text"
                  maxLength={80}
                  className="input-field"
                  value={form.jurisdictionDistrict}
                  onChange={(e) => setForm({ ...form, jurisdictionDistrict: e.target.value })}
                />
              </>
            )}
            {form.jurisdictionLevel === 'local' && (
              <>
                <label htmlFor="svc-jurisdiction-local">Local body (municipality, panchayat or ward)</label>
                <input
                  id="svc-jurisdiction-local"
                  type="text"
                  maxLength={80}
                  className="input-field"
                  value={form.jurisdictionLocalBody}
                  onChange={(e) => setForm({ ...form, jurisdictionLocalBody: e.target.value })}
                />
              </>
            )}
          </fieldset>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Required Documents (one item per line)
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Aadhaar Card&#10;Proof of Residence&#10;Salary Certificate"
              className="input-field"
              value={form.documentsText}
              onChange={(e) => setForm({ ...form, documentsText: e.target.value })}
              style={{ fontSize: '0.85rem', padding: '0.75rem', borderRadius: '0.75rem', fontFamily: 'inherit' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={requestClose}
              className="btn btn-secondary"
              style={{ flex: 1, padding: '0.75rem', fontSize: '0.9rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 1, padding: '0.75rem', fontSize: '0.9rem' }}
            >
              <Save size={16} /> Save to Directory
            </button>
          </div>
        </form>
      </div>
      <UnsavedChangesDialog
        isOpen={guard.isBlocked || confirmClose}
        onStay={handleStay}
        onDiscard={handleDiscard}
      />
    </div>
  );
};

export default ServiceModal;
