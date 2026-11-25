/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react';
import { AlertTriangle, Camera, CheckCircle2, Send, ShieldCheck } from 'lucide-react';
import {
  CITIZEN_REPORT_CATEGORIES,
  CITIZEN_REPORT_CATEGORY_LABELS,
  ALLOWED_ATTACHMENT_MIME_TYPES,
  TREE_API_LIMITS,
} from '../../services/treeInventoryConstants';

const initialForm = {
  treePublicId: '',
  jurisdictionId: '',
  ward: '',
  category: '',
  description: '',
  attachments: [],
};

export function validateCitizenTreeReportForm(values = {}) {
  const errors = {};
  if (!values.treePublicId && !values.jurisdictionId) {
    errors.treePublicId = 'Choose a public tree, or select the jurisdiction and ward.';
  }
  if (!values.treePublicId && !values.ward) {
    errors.ward = 'Choose a ward when you are not reporting against a specific tree.';
  }
  if (!Object.values(CITIZEN_REPORT_CATEGORIES).includes(values.category)) {
    errors.category = 'Choose the kind of visible problem you observed.';
  }
  const description = String(values.description || '').trim();
  if (description.length < 20) {
    errors.description = 'Describe what you can see in at least 20 characters.';
  }
  if (description.length > TREE_API_LIMITS.maxNotesLength) {
    errors.description = `Keep the description under ${TREE_API_LIMITS.maxNotesLength} characters.`;
  }
  if (Array.isArray(values.attachments) && values.attachments.length > TREE_API_LIMITS.maxAttachmentsPerReport) {
    errors.attachments = `Attach at most ${TREE_API_LIMITS.maxAttachmentsPerReport} images.`;
  }
  return errors;
}

const fieldStyle = { display: 'grid', gap: '0.3rem', fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' };
const errorTextStyle = { color: 'var(--error, #ef4444)', fontSize: '0.78rem', fontWeight: 500 };

export default function TreeCitizenReportForm({
  trees = [],
  jurisdictions = [],
  onSubmit,
  onCancel,
  submitting = false,
  serviceError = null,
  result = null,
}) {
  const [values, setValues] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [fileError, setFileError] = useState('');
  const selectedTree = trees.find((tree) => tree.publicId === values.treePublicId) || null;

  const selectedJurisdiction = jurisdictions.find((item) => item.id === values.jurisdictionId);
  const wards = selectedJurisdiction?.wards || [...new Set(trees.map((tree) => tree.ward))];

  const set = (field, value) => setValues((previous) => ({ ...previous, [field]: value }));

  const handleTreeChange = (publicId) => {
    const tree = trees.find((item) => item.publicId === publicId);
    setValues((previous) => ({
      ...previous,
      treePublicId: publicId,
      jurisdictionId: tree?.publicId ? previous.jurisdictionId : previous.jurisdictionId,
      ward: tree?.ward || previous.ward,
    }));
  };

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    setFileError('');
    if (!file) return;
    if (!ALLOWED_ATTACHMENT_MIME_TYPES.includes(file.type)) {
      setFileError('Choose a JPEG, PNG or WebP image. SVG and documents are not accepted.');
      return;
    }
    if (file.size > TREE_API_LIMITS.maxAttachmentBytes) {
      setFileError('The image is larger than 5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      setValues((previous) => ({
        ...previous,
        attachments: [
          ...previous.attachments,
          {
            mimeType: file.type,
            sizeBytes: file.size,
            url: reader.result,
            caption: '',
          },
        ].slice(0, TREE_API_LIMITS.maxAttachmentsPerReport),
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const validation = validateCitizenTreeReportForm(values);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;
    onSubmit?.({
      ...values,
      description: values.description.trim(),
      jurisdictionId: selectedTree ? undefined : values.jurisdictionId,
      ward: selectedTree ? undefined : values.ward,
    });
  };

  if (result?.publicReport) {
    return (
      <section aria-labelledby="tree-report-success-heading" style={{ display: 'grid', gap: '0.75rem' }}>
        <div role="status" style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
          <CheckCircle2 size={22} aria-hidden="true" style={{ color: 'var(--success, #10b981)', flexShrink: 0 }} />
          <div>
            <h3 id="tree-report-success-heading" style={{ margin: 0, fontSize: '1.05rem' }}>
              Observation received
            </h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              {result.message} This is a citizen report, not a verified municipal inspection.
            </p>
          </div>
        </div>
        <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.6rem', margin: 0 }}>
          <div>
            <dt style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-tertiary)' }}>Tracking code</dt>
            <dd style={{ margin: 0, fontFamily: 'var(--font-mono, monospace)', fontSize: '1.05rem', fontWeight: 800 }}>
              {result.publicReport.trackingCode}
            </dd>
          </div>
          <div>
            <dt style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-tertiary)' }}>Status</dt>
            <dd style={{ margin: 0 }}>{result.publicReport.stateLabel}</dd>
          </div>
          <div>
            <dt style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-tertiary)' }}>Submitted</dt>
            <dd style={{ margin: 0 }}>{new Date(result.publicReport.createdAt).toLocaleString('en-IN')}</dd>
          </div>
        </dl>
        <button type="button" className="btn btn-secondary" onClick={onCancel} style={{ justifySelf: 'start' }}>
          Submit another observation
        </button>
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: '0.85rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        <ShieldCheck size={18} aria-hidden="true" style={{ color: 'var(--accent-main)', flexShrink: 0, marginTop: 2 }} />
        <p style={{ margin: 0 }}>
          Report only what you can see from a public place. Do not include your phone number, email, Aadhaar, exact home
          address or anyone else’s personal details. Precise coordinates are not requested.
        </p>
      </div>

      {serviceError && (
        <div role="alert" style={{ display: 'flex', gap: '0.5rem', color: 'var(--error, #ef4444)', fontSize: '0.86rem' }}>
          <AlertTriangle size={18} aria-hidden="true" />
          <span>{serviceError.userMessage || serviceError.message}</span>
        </div>
      )}

      <fieldset style={{ border: '1px solid var(--border-main)', borderRadius: '0.8rem', padding: '0.9rem' }}>
        <legend style={{ padding: '0 0.35rem', fontWeight: 800 }}>Which tree or place?</legend>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem' }}>
          <label style={fieldStyle}>
            Public tree ID (preferred)
            <select className="form-input" value={values.treePublicId} onChange={(event) => handleTreeChange(event.target.value)}>
              <option value="">Not sure — choose a ward instead</option>
              {trees.map((tree) => (
                <option key={tree.publicId} value={tree.publicId}>
                  {tree.publicId} — {tree.species?.commonName || 'tree'}, {tree.ward}
                </option>
              ))}
            </select>
            {errors.treePublicId && <span style={errorTextStyle}>{errors.treePublicId}</span>}
          </label>

          {!values.treePublicId && (
            <>
              <label style={fieldStyle}>
                Jurisdiction
                <select
                  className="form-input"
                  value={values.jurisdictionId}
                  onChange={(event) => {
                    set('jurisdictionId', event.target.value);
                    set('ward', '');
                  }}
                >
                  <option value="">Choose a jurisdiction</option>
                  {jurisdictions.map((jurisdiction) => (
                    <option key={jurisdiction.id} value={jurisdiction.id}>
                      {jurisdiction.name}
                    </option>
                  ))}
                </select>
              </label>
              <label style={fieldStyle}>
                Ward or locality
                <select className="form-input" value={values.ward} onChange={(event) => set('ward', event.target.value)}>
                  <option value="">Choose a ward</option>
                  {wards.map((ward) => (
                    <option key={ward} value={ward}>
                      {ward}
                    </option>
                  ))}
                </select>
                {errors.ward && <span style={errorTextStyle}>{errors.ward}</span>}
              </label>
            </>
          )}
        </div>
      </fieldset>

      <label style={fieldStyle}>
        What did you observe?
        <select className="form-input" value={values.category} onChange={(event) => set('category', event.target.value)} required>
          <option value="">Choose the visible problem</option>
          {Object.values(CITIZEN_REPORT_CATEGORIES).map((category) => (
            <option key={category} value={category}>
              {CITIZEN_REPORT_CATEGORY_LABELS[category]}
            </option>
          ))}
        </select>
        {errors.category && <span style={errorTextStyle}>{errors.category}</span>}
      </label>

      <label style={fieldStyle}>
        Description
        <textarea
          className="form-input"
          rows={4}
          maxLength={TREE_API_LIMITS.maxNotesLength}
          value={values.description}
          onChange={(event) => set('description', event.target.value)}
          aria-describedby="tree-report-description-help"
          required
        />
        <span id="tree-report-description-help" style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>
          At least 20 characters. Say where the tree is using a public landmark. Personal contact details are removed.
        </span>
        {errors.description && <span style={errorTextStyle}>{errors.description}</span>}
      </label>

      <fieldset style={{ border: '1px solid var(--border-main)', borderRadius: '0.8rem', padding: '0.9rem' }}>
        <legend style={{ padding: '0 0.35rem', fontWeight: 800 }}>Optional photo evidence</legend>
        <label style={{ ...fieldStyle, fontWeight: 600 }}>
          <span style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
            <Camera size={16} aria-hidden="true" /> Add a JPEG, PNG or WebP image under 5 MB
          </span>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} />
        </label>
        <p style={{ margin: '0.4rem 0 0', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
          Images are stored with this report only. EXIF/location metadata is not displayed. An automated triage suggestion
          may be produced for staff, but it cannot authorise pruning, removal or a risk designation.
        </p>
        {fileError && <p role="alert" style={errorTextStyle}>{fileError}</p>}
        {values.attachments.length > 0 && (
          <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem', fontSize: '0.82rem' }}>
            {values.attachments.map((attachment, index) => (
              <li key={`${attachment.mimeType}-${index}`}>
                {attachment.mimeType} · {Math.round(attachment.sizeBytes / 1024)} KB{' '}
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '0.1rem 0.45rem', marginLeft: '0.4rem', fontSize: '0.75rem' }}
                  onClick={() =>
                    setValues((previous) => ({
                      ...previous,
                      attachments: previous.attachments.filter((_, itemIndex) => itemIndex !== index),
                    }))
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          <Send size={15} aria-hidden="true" /> {submitting ? 'Sending…' : 'Send observation'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
