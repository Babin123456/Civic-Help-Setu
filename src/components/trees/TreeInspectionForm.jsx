/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react';
import { AlertTriangle, Camera, CalendarPlus, CheckCircle2, Sparkles } from 'lucide-react';
import {
  INSPECTION_TYPES,
  INSPECTION_TYPE_LABELS,
  TREE_CONDITIONS,
  TREE_CONDITION_LABELS,
  TREE_API_LIMITS,
} from '../../services/treeInventoryConstants';
import { TREE_SYMPTOM_LABELS, TREE_SYMPTOM_TAGS } from '../../services/treeImageTriageService';

const fieldStyle = { display: 'grid', gap: '0.3rem', fontSize: '0.83rem', fontWeight: 700, color: 'var(--text-primary)' };
const errorStyle = { color: 'var(--error, #ef4444)', fontSize: '0.77rem', fontWeight: 500 };

export function validateInspectionCompleteForm(values = {}) {
  const errors = {};
  if (!Object.values(TREE_CONDITIONS).includes(values.conditionAtInspection)) errors.conditionAtInspection = 'Choose the condition observed.';
  if (String(values.findings || '').trim().length < 10) errors.findings = 'Record at least 10 characters of findings.';
  if (values.evidenceUrl && !/^https:\/\//i.test(values.evidenceUrl)) errors.evidenceUrl = 'Evidence links must use https://.';
  return errors;
}

export function TreeInspectionScheduleForm({ tree, onSubmit, onCancel, serviceError = null, submitting = false }) {
  const [values, setValues] = useState(() => ({
    type: INSPECTION_TYPES.ROUTINE,
    scheduledFor: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    assignedTo: '',
    notes: '',
  }));
  const [errors, setErrors] = useState({});
  const set = (field, value) => setValues((previous) => ({ ...previous, [field]: value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!values.scheduledFor || !Number.isFinite(Date.parse(values.scheduledFor))) {
      setErrors({ scheduledFor: 'Choose a valid inspection date and time.' });
      return;
    }
    setErrors({});
    onSubmit?.({
      treeId: tree.id,
      type: values.type,
      scheduledFor: new Date(values.scheduledFor).toISOString(),
      assignedTo: values.assignedTo,
      notes: values.notes,
      reason: 'Preventive inspection scheduled',
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: '0.75rem' }}>
      <h4 style={{ margin: 0 }}>Schedule an inspection for {tree.publicId}</h4>
      {serviceError && <p role="alert" style={errorStyle}>{serviceError.userMessage || serviceError.message}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.7rem' }}>
        <label style={fieldStyle}>
          Inspection type
          <select className="form-input" value={values.type} onChange={(event) => set('type', event.target.value)}>
            {Object.values(INSPECTION_TYPES).map((type) => <option key={type} value={type}>{INSPECTION_TYPE_LABELS[type]}</option>)}
          </select>
        </label>
        <label style={fieldStyle}>
          Scheduled date and time
          <input type="datetime-local" className="form-input" value={values.scheduledFor} onChange={(event) => set('scheduledFor', event.target.value)} required />
          {errors.scheduledFor && <span style={errorStyle}>{errors.scheduledFor}</span>}
        </label>
        <label style={fieldStyle}>
          Assigned officer or crew
          <input className="form-input" value={values.assignedTo} maxLength={120} onChange={(event) => set('assignedTo', event.target.value)} />
        </label>
      </div>
      <label style={fieldStyle}>
        Scheduling note
        <textarea className="form-input" rows={2} maxLength={2000} value={values.notes} onChange={(event) => set('notes', event.target.value)} />
      </label>
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          <CalendarPlus size={15} aria-hidden="true" /> Schedule inspection
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export function TreeInspectionCompleteForm({
  inspection,
  tree,
  onSubmit,
  onAnalyze,
  onCancel,
  serviceError = null,
  submitting = false,
  triageSuggestion = null,
}) {
  const [values, setValues] = useState({
    conditionAtInspection: tree?.condition || TREE_CONDITIONS.UNKNOWN,
    findings: '',
    earlyVisitReason: '',
    evidenceUrl: '',
    evidenceCaption: '',
    symptomTags: [],
  });
  const [errors, setErrors] = useState({});
  const set = (field, value) => setValues((previous) => ({ ...previous, [field]: value }));
  const toggleTag = (tag) =>
    set(
      'symptomTags',
      values.symptomTags.includes(tag) ? values.symptomTags.filter((item) => item !== tag) : [...values.symptomTags, tag]
    );

  const handleSubmit = (event) => {
    event.preventDefault();
    const validation = validateInspectionCompleteForm(values);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;
    onSubmit?.({
      inspectionId: inspection.id,
      conditionAtInspection: values.conditionAtInspection,
      findings: values.findings.trim(),
      earlyVisitReason: values.earlyVisitReason.trim() || undefined,
      triageSuggestionId: triageSuggestion?.suggestion?.id || undefined,
      evidence: values.evidenceUrl
        ? [{ mimeType: 'image/jpeg', sizeBytes: 0, url: values.evidenceUrl, caption: values.evidenceCaption }]
        : [],
      reason: 'Inspection completed with findings',
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: '0.75rem' }}>
      <h4 style={{ margin: 0 }}>Record findings for {inspection.publicId}</h4>
      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
        Tree {tree?.publicId}. Completing an inspection updates the tree condition and next due date. It does not authorise
        pruning, removal or a risk designation.
      </p>
      {serviceError && <p role="alert" style={errorStyle}>{serviceError.userMessage || serviceError.message}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.7rem' }}>
        <label style={fieldStyle}>
          Condition observed
          <select className="form-input" value={values.conditionAtInspection} onChange={(event) => set('conditionAtInspection', event.target.value)}>
            {Object.values(TREE_CONDITIONS).map((condition) => <option key={condition} value={condition}>{TREE_CONDITION_LABELS[condition]}</option>)}
          </select>
          {errors.conditionAtInspection && <span style={errorStyle}>{errors.conditionAtInspection}</span>}
        </label>
        <label style={fieldStyle}>
          Early-visit reason (if before scheduled date)
          <input className="form-input" value={values.earlyVisitReason} maxLength={300} onChange={(event) => set('earlyVisitReason', event.target.value)} />
        </label>
      </div>
      <label style={fieldStyle}>
        Findings
        <textarea className="form-input" rows={3} maxLength={TREE_API_LIMITS.maxNotesLength} value={values.findings} onChange={(event) => set('findings', event.target.value)} required />
        {errors.findings && <span style={errorStyle}>{errors.findings}</span>}
      </label>

      <fieldset style={{ border: '1px solid var(--border-main)', borderRadius: '0.75rem', padding: '0.8rem' }}>
        <legend style={{ padding: '0 0.35rem', fontWeight: 800 }}>Observable symptoms for optional triage</legend>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.35rem' }}>
          {Object.values(TREE_SYMPTOM_TAGS).map((tag) => (
            <label key={tag} style={{ display: 'flex', gap: '0.4rem', fontSize: '0.82rem', alignItems: 'center' }}>
              <input type="checkbox" checked={values.symptomTags.includes(tag)} onChange={() => toggleTag(tag)} />
              {TREE_SYMPTOM_LABELS[tag]}
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              onAnalyze?.({
                inspectionId: inspection.id,
                treeId: tree?.id,
                image: values.evidenceUrl ? { mimeType: 'image/jpeg', sizeBytes: 0, url: values.evidenceUrl } : null,
                symptomTags: values.symptomTags,
              })
            }
          >
            <Sparkles size={14} aria-hidden="true" /> Request triage suggestion
          </button>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', alignSelf: 'center' }}>
            Suggestion only. An arborist or reviewer must accept, edit or reject it.
          </span>
        </div>
        {triageSuggestion && (
          <div role="status" style={{ marginTop: '0.6rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            <strong>{triageSuggestion.suggestion?.modelVersion}</strong> suggested{' '}
            {triageSuggestion.suggestion?.suggestedCondition} (confidence {triageSuggestion.suggestion?.confidence}).{' '}
            {triageSuggestion.suggestion?.isFallback ? 'Deterministic fallback used. ' : ''}
            {triageSuggestion.suggestion?.rationale}
          </div>
        )}
      </fieldset>

      <fieldset style={{ border: '1px solid var(--border-main)', borderRadius: '0.75rem', padding: '0.8rem' }}>
        <legend style={{ padding: '0 0.35rem', fontWeight: 800, display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          <Camera size={15} aria-hidden="true" /> Evidence photo link
        </legend>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.7rem' }}>
          <label style={fieldStyle}>
            Secure image URL
            <input type="url" className="form-input" value={values.evidenceUrl} placeholder="https://" onChange={(event) => set('evidenceUrl', event.target.value)} />
            {errors.evidenceUrl && <span style={errorStyle}>{errors.evidenceUrl}</span>}
          </label>
          <label style={fieldStyle}>
            Caption
            <input className="form-input" maxLength={180} value={values.evidenceCaption} onChange={(event) => set('evidenceCaption', event.target.value)} />
          </label>
        </div>
        <p style={{ margin: '0.4rem 0 0', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
          JPEG, PNG or WebP only. The service rejects SVG, HTML and oversized files when they are uploaded directly.
        </p>
      </fieldset>

      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          <CheckCircle2 size={15} aria-hidden="true" /> Complete inspection
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
      {serviceError && (
        <p style={{ margin: 0, display: 'flex', gap: '0.35rem', color: 'var(--error, #ef4444)', fontSize: '0.78rem' }}>
          <AlertTriangle size={14} aria-hidden="true" /> The record was not changed. Correct the highlighted detail and retry.
        </p>
      )}
    </form>
  );
}
