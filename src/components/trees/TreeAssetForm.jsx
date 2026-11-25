/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react';
import { AlertTriangle, MapPin, Plus, ShieldCheck } from 'lucide-react';
import { TREE_CONDITIONS, TREE_CONDITION_LABELS } from '../../services/treeInventoryConstants';

const initial = {
  jurisdictionId: '',
  ward: '',
  locality: '',
  speciesId: '',
  plantingSiteId: '',
  condition: 'unknown',
  plantedOn: '',
  latitude: '',
  longitude: '',
  preciseLatitude: '',
  preciseLongitude: '',
  privateNotes: '',
  isPubliclyListed: true,
  duplicateOverrideReason: '',
};

export function validateTreeAssetForm(values = {}) {
  const errors = {};
  if (!values.jurisdictionId) errors.jurisdictionId = 'Choose the municipal jurisdiction.';
  if (!String(values.ward || '').trim() || String(values.ward).trim().length < 2) errors.ward = 'Enter the ward name or number.';
  if (!values.speciesId) errors.speciesId = 'Choose a species from the municipal catalogue.';
  if (!Object.values(TREE_CONDITIONS).includes(values.condition)) errors.condition = 'Choose the current condition.';
  const lat = Number(values.latitude);
  const lng = Number(values.longitude);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) errors.latitude = 'Latitude must be between -90 and 90.';
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) errors.longitude = 'Longitude must be between -180 and 180.';
  if (values.plantedOn && Date.parse(values.plantedOn) > Date.now() + 24 * 60 * 60 * 1000) {
    errors.plantedOn = 'Planting date cannot be in the future.';
  }
  if (values.preciseLatitude || values.preciseLongitude) {
    const preciseLat = Number(values.preciseLatitude);
    const preciseLng = Number(values.preciseLongitude);
    if (!Number.isFinite(preciseLat) || preciseLat < -90 || preciseLat > 90) errors.preciseLatitude = 'Precise latitude is invalid.';
    if (!Number.isFinite(preciseLng) || preciseLng < -180 || preciseLng > 180) errors.preciseLongitude = 'Precise longitude is invalid.';
  }
  return errors;
}

const fieldStyle = { display: 'grid', gap: '0.3rem', fontSize: '0.83rem', fontWeight: 700, color: 'var(--text-primary)' };
const errorStyle = { color: 'var(--error, #ef4444)', fontSize: '0.77rem', fontWeight: 500 };

export default function TreeAssetForm({
  jurisdictions = [],
  species = [],
  sites = [],
  defaultJurisdiction = '',
  onSubmit,
  onCancel,
  submitting = false,
  serviceError = null,
}) {
  const [values, setValues] = useState({ ...initial, jurisdictionId: defaultJurisdiction });
  const [errors, setErrors] = useState({});
  const set = (field, value) => setValues((previous) => ({ ...previous, [field]: value }));
  const selectedJurisdiction = jurisdictions.find((item) => item.id === values.jurisdictionId);
  const scopedSites = sites.filter((site) => !values.jurisdictionId || site.jurisdictionId === values.jurisdictionId);

  const handleSubmit = (event) => {
    event.preventDefault();
    const validation = validateTreeAssetForm(values);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;
    onSubmit?.({
      jurisdictionId: values.jurisdictionId,
      ward: values.ward.trim(),
      locality: values.locality.trim(),
      speciesId: values.speciesId,
      plantingSiteId: values.plantingSiteId || null,
      condition: values.condition,
      plantedOn: values.plantedOn || null,
      approxCoordinates: { lat: Number(values.latitude), lng: Number(values.longitude) },
      privateCoordinates:
        values.preciseLatitude && values.preciseLongitude
          ? { lat: Number(values.preciseLatitude), lng: Number(values.preciseLongitude) }
          : null,
      privateNotes: values.privateNotes.trim(),
      isPubliclyListed: values.isPubliclyListed,
      duplicateOverrideReason: values.duplicateOverrideReason.trim() || undefined,
      reason: 'Tree asset registered from the staff workspace',
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: '0.8rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
        <ShieldCheck size={18} aria-hidden="true" style={{ color: 'var(--accent-main)', flexShrink: 0, marginTop: 2 }} />
        <p style={{ margin: 0 }}>
          Registering an asset requires an arborist or administrator role. The service validates species, links and coordinates
          and rejects a likely duplicate unless a written override reason is supplied.
        </p>
      </div>

      {serviceError && (
        <div role="alert" style={{ display: 'flex', gap: '0.5rem', color: 'var(--error, #ef4444)', fontSize: '0.85rem' }}>
          <AlertTriangle size={17} aria-hidden="true" />
          <span>{serviceError.userMessage || serviceError.message}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.7rem' }}>
        <label style={fieldStyle}>
          Jurisdiction
          <select className="form-input" value={values.jurisdictionId} onChange={(event) => set('jurisdictionId', event.target.value)} required>
            <option value="">Choose jurisdiction</option>
            {jurisdictions.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          {errors.jurisdictionId && <span style={errorStyle}>{errors.jurisdictionId}</span>}
        </label>

        <label style={fieldStyle}>
          Ward
          <input className="form-input" list="tree-ward-options" value={values.ward} onChange={(event) => set('ward', event.target.value)} required />
          <datalist id="tree-ward-options">
            {(selectedJurisdiction?.wards || []).map((ward) => <option key={ward} value={ward} />)}
          </datalist>
          {errors.ward && <span style={errorStyle}>{errors.ward}</span>}
        </label>

        <label style={fieldStyle}>
          Locality / landmark
          <input className="form-input" value={values.locality} maxLength={180} onChange={(event) => set('locality', event.target.value)} />
        </label>

        <label style={fieldStyle}>
          Species
          <select className="form-input" value={values.speciesId} onChange={(event) => set('speciesId', event.target.value)} required>
            <option value="">Choose species</option>
            {species.map((item) => (
              <option key={item.id} value={item.id}>{item.commonName} ({item.scientificName})</option>
            ))}
          </select>
          {errors.speciesId && <span style={errorStyle}>{errors.speciesId}</span>}
        </label>

        <label style={fieldStyle}>
          Planting site
          <select className="form-input" value={values.plantingSiteId} onChange={(event) => set('plantingSiteId', event.target.value)}>
            <option value="">No linked planting site</option>
            {scopedSites.map((site) => (
              <option key={site.id} value={site.id}>{site.publicId} — {site.locality}</option>
            ))}
          </select>
        </label>

        <label style={fieldStyle}>
          Condition
          <select className="form-input" value={values.condition} onChange={(event) => set('condition', event.target.value)} required>
            {Object.values(TREE_CONDITIONS).map((condition) => (
              <option key={condition} value={condition}>{TREE_CONDITION_LABELS[condition]}</option>
            ))}
          </select>
          {errors.condition && <span style={errorStyle}>{errors.condition}</span>}
        </label>

        <label style={fieldStyle}>
          Planting date
          <input type="date" className="form-input" value={values.plantedOn} max={new Date().toISOString().slice(0, 10)} onChange={(event) => set('plantedOn', event.target.value)} />
          {errors.plantedOn && <span style={errorStyle}>{errors.plantedOn}</span>}
        </label>
      </div>

      <fieldset style={{ border: '1px solid var(--border-main)', borderRadius: '0.8rem', padding: '0.9rem' }}>
        <legend style={{ padding: '0 0.35rem', fontWeight: 800, display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          <MapPin size={15} aria-hidden="true" /> Coordinates
        </legend>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.7rem' }}>
          <label style={fieldStyle}>
            Approximate latitude
            <input type="number" step="0.000001" className="form-input" value={values.latitude} onChange={(event) => set('latitude', event.target.value)} required />
            {errors.latitude && <span style={errorStyle}>{errors.latitude}</span>}
          </label>
          <label style={fieldStyle}>
            Approximate longitude
            <input type="number" step="0.000001" className="form-input" value={values.longitude} onChange={(event) => set('longitude', event.target.value)} required />
            {errors.longitude && <span style={errorStyle}>{errors.longitude}</span>}
          </label>
          <label style={fieldStyle}>
            Precise latitude (staff only)
            <input type="number" step="0.000001" className="form-input" value={values.preciseLatitude} onChange={(event) => set('preciseLatitude', event.target.value)} />
            {errors.preciseLatitude && <span style={errorStyle}>{errors.preciseLatitude}</span>}
          </label>
          <label style={fieldStyle}>
            Precise longitude (staff only)
            <input type="number" step="0.000001" className="form-input" value={values.preciseLongitude} onChange={(event) => set('preciseLongitude', event.target.value)} />
            {errors.preciseLongitude && <span style={errorStyle}>{errors.preciseLongitude}</span>}
          </label>
        </div>
        <p style={{ margin: '0.45rem 0 0', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
          Public views show only a ~1 km grid. Precise coordinates stay in the staff record and are never returned by the public service.
        </p>
      </fieldset>

      <label style={fieldStyle}>
        Private staff note
        <textarea className="form-input" rows={2} maxLength={2000} value={values.privateNotes} onChange={(event) => set('privateNotes', event.target.value)} />
      </label>

      <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.84rem' }}>
        <input type="checkbox" checked={values.isPubliclyListed} onChange={(event) => set('isPubliclyListed', event.target.checked)} />
        <span>Include this tree in the approved public register (species, ward, condition and approximate grid only).</span>
      </label>

      <details>
        <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '0.84rem' }}>Duplicate override (only if this is genuinely a second tree)</summary>
        <label style={{ ...fieldStyle, marginTop: '0.5rem' }}>
          Written reason
          <textarea className="form-input" rows={2} maxLength={500} value={values.duplicateOverrideReason} onChange={(event) => set('duplicateOverrideReason', event.target.value)} />
        </label>
      </details>

      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          <Plus size={15} aria-hidden="true" /> {submitting ? 'Saving…' : 'Register tree'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
