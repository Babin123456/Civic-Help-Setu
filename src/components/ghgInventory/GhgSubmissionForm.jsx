import { useMemo, useState } from 'react';
import { PlusCircle, Trash2, FileCheck2, AlertTriangle, Save } from 'lucide-react';
import {
  ACTIVITY_UNITS,
  ALLOWED_SOURCE_DOCUMENT_TYPES,
  DATA_QUALITY,
  DATA_QUALITY_LABELS,
  GHG_LIMITS,
} from '../../services/ghgInventoryConstants.js';

const newRow = (index) => ({
  key: `row-${index}-${Date.now()}`,
  sourceId: '',
  quantity: '',
  unit: 'kWh',
  dataQuality: DATA_QUALITY.MEASURED,
  correctionNotes: '',
  documentName: '',
  documentType: 'application/pdf',
  documentSize: '',
});

const rowFromRecord = (record, index) => ({
  key: `row-${index}-${record.id || Date.now()}`,
  sourceId: record.sourceId,
  quantity: String(record.quantity),
  unit: record.unit,
  dataQuality: record.dataQuality,
  correctionNotes: record.correctionNotes || '',
  documentName: record.sourceDocument?.name || '',
  documentType: record.sourceDocument?.mimeType || 'application/pdf',
  documentSize:
    record.sourceDocument?.sizeBytes == null ? '' : String(record.sourceDocument.sizeBytes),
});

const makeIdempotencyKey = () => {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return `ghg-sub-${globalThis.crypto.randomUUID()}`;
  }
  return `ghg-sub-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export default function GhgSubmissionForm({
  sources,
  factors,
  period,
  jurisdictionId,
  onSubmit,
  onCancel,
  initialSubmission = null,
}) {
  const editing = Boolean(initialSubmission?.id);
  const [title, setTitle] = useState(initialSubmission?.title || '');
  const [department, setDepartment] = useState(initialSubmission?.department || '');
  const [correctionNotes, setCorrectionNotes] = useState(initialSubmission?.correctionNotes || '');
  const [rows, setRows] = useState(() =>
    initialSubmission?.records?.length
      ? initialSubmission.records.map(rowFromRecord)
      : [newRow(1)]
  );
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [idempotencyKey] = useState(makeIdempotencyKey);

  const factorById = useMemo(
    () => new Map((factors || []).map((factor) => [factor.id, factor])),
    [factors]
  );

  const unitForSource = (sourceId) => {
    const source = (sources || []).find((item) => item.id === sourceId);
    const factor = source ? factorById.get(source.defaultFactorId) : null;
    return factor?.activityUnit || 'kWh';
  };

  const updateRow = (key, patch) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const addRow = () => {
    if (rows.length >= GHG_LIMITS.MAX_RECORDS_PER_SUBMISSION) return;
    setRows((current) => [...current, newRow(current.length + 1)]);
  };

  const removeRow = (key) => {
    setRows((current) => (current.length === 1 ? current : current.filter((row) => row.key !== key)));
  };

  const validate = () => {
    const next = {};
    if (title.trim().length < 5) next.title = 'Enter a title of at least 5 characters.';
    if (department.trim().length < 3) next.department = 'Enter the submitting department.';
    rows.forEach((row) => {
      const rowErrors = {};
      if (!row.sourceId) rowErrors.sourceId = 'Choose an emission source.';
      const quantity = Number(row.quantity);
      if (row.quantity === '' || !Number.isFinite(quantity) || quantity < 0) {
        rowErrors.quantity = 'Enter the original non-negative activity value.';
      } else if (quantity > GHG_LIMITS.MAX_QUANTITY) {
        rowErrors.quantity = 'Value is above the supported range. Check the decimal point and unit.';
      }
      if (!ACTIVITY_UNITS[row.unit]) rowErrors.unit = 'Choose a supported unit.';
      if (!Object.values(DATA_QUALITY).includes(row.dataQuality)) {
        rowErrors.dataQuality = 'Choose measured, estimated or excluded.';
      }
      if (row.documentName) {
        if (!ALLOWED_SOURCE_DOCUMENT_TYPES.includes(row.documentType)) {
          rowErrors.documentType = 'Use PDF, CSV or XLSX.';
        }
        const size = row.documentSize === '' ? 0 : Number(row.documentSize);
        if (!Number.isFinite(size) || size < 0 || size > GHG_LIMITS.MAX_PDF_BYTES) {
          rowErrors.documentSize = `Enter a size between 0 and ${GHG_LIMITS.MAX_PDF_BYTES} bytes, or leave it blank.`;
        }
      }
      if (Object.keys(rowErrors).length) next[row.key] = rowErrors;
    });

    const duplicate = rows
      .map((row) => row.sourceId)
      .filter(Boolean)
      .find((sourceId, index, all) => all.indexOf(sourceId) !== index);
    if (duplicate) {
      next.duplicate = 'The same emission source appears twice. Combine the values into one row.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        periodId: period.id,
        jurisdictionId,
        title: title.trim(),
        department: department.trim(),
        correctionNotes: correctionNotes.trim(),
        idempotencyKey,
        ...(editing ? { expectedUpdatedAt: initialSubmission.updatedAt } : {}),
        records: rows.map((row) => ({
          sourceId: row.sourceId,
          quantity: Number(row.quantity),
          unit: row.unit,
          dataQuality: row.dataQuality,
          correctionNotes: row.correctionNotes.trim(),
          sourceDocument: row.documentName
            ? {
                name: row.documentName.trim(),
                mimeType: row.documentType,
                sizeBytes: row.documentSize === '' ? null : Number(row.documentSize),
              }
            : null,
        })),
      };
      onSubmit(payload);
    } catch (error) {
      setFormError(error.message || 'The submission could not be saved. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      aria-labelledby="ghg-new-submission-heading"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-main)',
        borderRadius: '0.75rem',
        padding: '1.25rem',
        marginBottom: '1.25rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h2 id="ghg-new-submission-heading" style={{ margin: 0, fontSize: '1.1rem' }}>
            {editing ? 'Edit department submission' : 'New department submission'}
          </h2>
          <p style={{ margin: '0.3rem 0 0', color: 'var(--text-secondary)', fontSize: '0.84rem' }}>
            {period.label} · {jurisdictionId}. Enter activity exactly as measured; the factor version
            is recorded automatically and can be inspected later.
            {editing ? ' Saving replaces the draft activity rows for this submission.' : ''}
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>

      {formError && (
        <div
          role="alert"
          style={{
            marginTop: '0.9rem',
            padding: '0.7rem 0.9rem',
            border: '1px solid rgba(220, 38, 38, 0.35)',
            borderRadius: '0.5rem',
            fontSize: '0.85rem',
            display: 'flex',
            gap: '0.5rem',
          }}
        >
          <AlertTriangle size={17} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span>{formError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate style={{ marginTop: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
          <div>
            <label htmlFor="ghg-submission-title" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.25rem' }}>
              Submission title
            </label>
            <input
              id="ghg-submission-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? 'ghg-submission-title-error' : undefined}
              style={{ width: '100%', padding: '0.45rem 0.55rem', borderRadius: 6, border: '1px solid var(--border-main)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
              placeholder="e.g. FY 2026-27 building electricity — first half"
            />
            {errors.title && (
              <p id="ghg-submission-title-error" role="alert" style={{ margin: '0.25rem 0 0', color: '#b91c1c', fontSize: '0.78rem' }}>
                {errors.title}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="ghg-submission-department" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.25rem' }}>
              Department
            </label>
            <input
              id="ghg-submission-department"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              aria-invalid={Boolean(errors.department)}
              aria-describedby={errors.department ? 'ghg-submission-department-error' : undefined}
              style={{ width: '100%', padding: '0.45rem 0.55rem', borderRadius: 6, border: '1px solid var(--border-main)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
              placeholder="e.g. Public Works — Buildings"
            />
            {errors.department && (
              <p id="ghg-submission-department-error" role="alert" style={{ margin: '0.25rem 0 0', color: '#b91c1c', fontSize: '0.78rem' }}>
                {errors.department}
              </p>
            )}
          </div>
        </div>

        <div style={{ marginTop: '0.85rem' }}>
          <label htmlFor="ghg-submission-notes" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            Correction or methodology note (optional)
          </label>
          <textarea
            id="ghg-submission-notes"
            value={correctionNotes}
            onChange={(event) => setCorrectionNotes(event.target.value)}
            rows={2}
            maxLength={GHG_LIMITS.MAX_NOTE_LENGTH}
            style={{ width: '100%', padding: '0.45rem 0.55rem', borderRadius: 6, border: '1px solid var(--border-main)', background: 'var(--bg-card)', color: 'var(--text-primary)', resize: 'vertical' }}
            placeholder="Explain corrections or data gaps. Do not include resident names, phone numbers or identity numbers."
          />
        </div>

        {errors.duplicate && (
          <p role="alert" style={{ margin: '0.6rem 0 0', color: '#b91c1c', fontSize: '0.82rem' }}>
            {errors.duplicate}
          </p>
        )}

        <fieldset style={{ border: '1px solid var(--border-main)', borderRadius: '0.6rem', padding: '0.85rem', marginTop: '1rem' }}>
          <legend style={{ fontSize: '0.9rem', fontWeight: 800, padding: '0 0.3rem' }}>Activity records</legend>
          {rows.map((row, index) => {
            const rowErrors = errors[row.key] || {};
            return (
              <div
                key={row.key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '0.65rem',
                  alignItems: 'start',
                  padding: '0.7rem 0',
                  borderTop: index === 0 ? 'none' : '1px solid var(--border-light)',
                }}
              >
                <div>
                  <label htmlFor={`${row.key}-source`} style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                    Emission source
                  </label>
                  <select
                    id={`${row.key}-source`}
                    value={row.sourceId}
                    onChange={(event) =>
                      updateRow(row.key, {
                        sourceId: event.target.value,
                        unit: unitForSource(event.target.value),
                      })
                    }
                    aria-invalid={Boolean(rowErrors.sourceId)}
                    style={{ width: '100%', padding: '0.4rem', borderRadius: 6, border: '1px solid var(--border-main)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  >
                    <option value="">Choose a source</option>
                    {(sources || []).map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.name} ({source.category.replaceAll('_', ' ')})
                      </option>
                    ))}
                  </select>
                  {rowErrors.sourceId && (
                    <p role="alert" style={{ margin: '0.2rem 0 0', color: '#b91c1c', fontSize: '0.74rem' }}>{rowErrors.sourceId}</p>
                  )}
                </div>
                <div>
                  <label htmlFor={`${row.key}-quantity`} style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                    Original value
                  </label>
                  <input
                    id={`${row.key}-quantity`}
                    type="number"
                    min="0"
                    step="any"
                    value={row.quantity}
                    onChange={(event) => updateRow(row.key, { quantity: event.target.value })}
                    aria-invalid={Boolean(rowErrors.quantity)}
                    style={{ width: '100%', padding: '0.4rem', borderRadius: 6, border: '1px solid var(--border-main)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  />
                  {rowErrors.quantity && (
                    <p role="alert" style={{ margin: '0.2rem 0 0', color: '#b91c1c', fontSize: '0.74rem' }}>{rowErrors.quantity}</p>
                  )}
                </div>
                <div>
                  <label htmlFor={`${row.key}-unit`} style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                    Unit
                  </label>
                  <select
                    id={`${row.key}-unit`}
                    value={row.unit}
                    onChange={(event) => updateRow(row.key, { unit: event.target.value })}
                    aria-invalid={Boolean(rowErrors.unit)}
                    style={{ width: '100%', padding: '0.4rem', borderRadius: 6, border: '1px solid var(--border-main)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  >
                    {Object.entries(ACTIVITY_UNITS).map(([unit, definition]) => (
                      <option key={unit} value={unit}>
                        {unit} — {definition.label}
                      </option>
                    ))}
                  </select>
                  {rowErrors.unit && (
                    <p role="alert" style={{ margin: '0.2rem 0 0', color: '#b91c1c', fontSize: '0.74rem' }}>{rowErrors.unit}</p>
                  )}
                </div>
                <div>
                  <label htmlFor={`${row.key}-quality`} style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                    Data quality
                  </label>
                  <select
                    id={`${row.key}-quality`}
                    value={row.dataQuality}
                    onChange={(event) => updateRow(row.key, { dataQuality: event.target.value })}
                    aria-invalid={Boolean(rowErrors.dataQuality)}
                    style={{ width: '100%', padding: '0.4rem', borderRadius: 6, border: '1px solid var(--border-main)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  >
                    {Object.values(DATA_QUALITY).map((quality) => (
                      <option key={quality} value={quality}>
                        {DATA_QUALITY_LABELS[quality]}
                      </option>
                    ))}
                  </select>
                  {rowErrors.dataQuality && (
                    <p role="alert" style={{ margin: '0.2rem 0 0', color: '#b91c1c', fontSize: '0.74rem' }}>{rowErrors.dataQuality}</p>
                  )}
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor={`${row.key}-notes`} style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                    Row note (optional)
                  </label>
                  <input
                    id={`${row.key}-notes`}
                    value={row.correctionNotes}
                    onChange={(event) => updateRow(row.key, { correctionNotes: event.target.value })}
                    style={{ width: '100%', padding: '0.4rem', borderRadius: 6, border: '1px solid var(--border-main)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                    placeholder="e.g. Meter reading reconciled with August invoice"
                  />
                </div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'end' }}>
                  <div style={{ flex: '1 1 200px' }}>
                    <label htmlFor={`${row.key}-document-name`} style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                      Source document reference (optional, metadata only)
                    </label>
                    <input
                      id={`${row.key}-document-name`}
                      value={row.documentName}
                      onChange={(event) => updateRow(row.key, { documentName: event.target.value })}
                      style={{ width: '100%', padding: '0.4rem', borderRadius: 6, border: '1px solid var(--border-main)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                      placeholder="e.g. electricity-bill-aug-2026.pdf"
                    />
                  </div>
                  <div>
                    <label htmlFor={`${row.key}-document-type`} style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                      File type
                    </label>
                    <select
                      id={`${row.key}-document-type`}
                      value={row.documentType}
                      onChange={(event) => updateRow(row.key, { documentType: event.target.value })}
                      style={{ padding: '0.4rem', borderRadius: 6, border: '1px solid var(--border-main)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                    >
                      <option value="application/pdf">PDF</option>
                      <option value="text/csv">CSV</option>
                      <option value="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">XLSX</option>
                    </select>
                    {rowErrors.documentType && (
                      <p role="alert" style={{ margin: '0.2rem 0 0', color: '#b91c1c', fontSize: '0.74rem' }}>{rowErrors.documentType}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor={`${row.key}-document-size`} style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                      Size (bytes)
                    </label>
                    <input
                      id={`${row.key}-document-size`}
                      type="number"
                      min="0"
                      value={row.documentSize}
                      onChange={(event) => updateRow(row.key, { documentSize: event.target.value })}
                      style={{ width: '120px', padding: '0.4rem', borderRadius: 6, border: '1px solid var(--border-main)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                    />
                    {rowErrors.documentSize && (
                      <p role="alert" style={{ margin: '0.2rem 0 0', color: '#b91c1c', fontSize: '0.74rem' }}>{rowErrors.documentSize}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    disabled={rows.length === 1}
                    aria-label={`Remove activity row ${index + 1}`}
                    style={{ padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid var(--border-main)', background: 'transparent', color: 'var(--text-secondary)', cursor: rows.length === 1 ? 'not-allowed' : 'pointer' }}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '0.6rem', alignItems: 'center' }}>
            <button type="button" className="btn btn-secondary" onClick={addRow} disabled={rows.length >= GHG_LIMITS.MAX_RECORDS_PER_SUBMISSION}>
              <PlusCircle size={14} aria-hidden="true" /> Add activity row
            </button>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <FileCheck2 size={12} aria-hidden="true" /> Only document metadata is stored; the original file stays with the department.
            </span>
          </div>
        </fieldset>

        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <Save size={15} aria-hidden="true" />{' '}
            {saving ? 'Saving…' : editing ? 'Save submission changes' : 'Save draft submission'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
