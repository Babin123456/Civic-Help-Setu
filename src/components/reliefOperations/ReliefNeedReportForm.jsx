import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Send } from 'lucide-react';
import {
  RELIEF_CATEGORIES,
  RELIEF_CATEGORY_LABELS,
  URGENCY_LEVELS,
  URGENCY_LEVEL_LABELS,
  RELIEF_ERROR_GUIDANCE,
} from '../../services/reliefOperationsConstants';
import { detectPiiPatterns } from '../../services/reliefOperationsValidation';

const makeKey = () =>
  `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const emptyForm = (jurisdictionId) => ({
  category: RELIEF_CATEGORIES.WATER,
  locality: '',
  jurisdictionId: jurisdictionId || 'WARD-150',
  description: '',
  quantity: '',
  peopleAffected: '',
  urgency: URGENCY_LEVELS.HIGH,
});

const validate = (form) => {
  const errors = {};
  const quantity = Number(form.quantity);
  const peopleAffected = Number(form.peopleAffected);

  if (!form.locality.trim() || form.locality.trim().length < 2) {
    errors.locality = 'Enter a locality of at least 2 characters.';
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{1,39}$/.test(form.jurisdictionId.trim())) {
    errors.jurisdictionId = 'Use 2–40 letters, digits, hyphens or underscores.';
  }
  if (form.description.trim().length < 10) {
    errors.description = 'Describe the need in at least 10 characters.';
  } else {
    const pii = detectPiiPatterns(`${form.description} ${form.locality}`);
    if (pii.length > 0) {
      errors.description = `Remove personal identifiers (${pii.join(', ')}). Report the need, not personal contact details.`;
    }
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) {
    errors.quantity = 'Enter a whole number between 1 and 100,000.';
  }
  if (!Number.isInteger(peopleAffected) || peopleAffected < 1 || peopleAffected > 500000) {
    errors.peopleAffected = 'Enter a whole number between 1 and 500,000.';
  }
  if (!Object.values(URGENCY_LEVELS).includes(form.urgency)) {
    errors.urgency = 'Choose an urgency level.';
  }
  return errors;
};

export default function ReliefNeedReportForm({
  onSubmit,
  defaultJurisdiction = 'WARD-150',
  jurisdictions = [
    { id: 'WARD-150', name: 'Ward 150 — Bellandur' },
    { id: 'WARD-042', name: 'Ward 42 — Indiranagar' },
    { id: 'WARD-174', name: 'Ward 174 — HSR Layout' },
  ],
}) {
  const [form, setForm] = useState(() => emptyForm(defaultJurisdiction));
  const [errors, setErrors] = useState({});
  const [statusMessage, setStatusMessage] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(makeKey);

  const fieldIds = useMemo(
    () => ({
      category: 'relief-category',
      locality: 'relief-locality',
      jurisdictionId: 'relief-jurisdiction',
      description: 'relief-description',
      quantity: 'relief-quantity',
      peopleAffected: 'relief-people',
      urgency: 'relief-urgency',
    }),
    []
  );

  const update = (field) => (event) => {
    setForm((previous) => ({ ...previous, [field]: event.target.value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
    setStatusMessage('');
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setStatusMessage('The form has errors. Review the highlighted fields and submit again.');
      setReceipt(null);
      return;
    }

    setSubmitting(true);
    setStatusMessage('Submitting the relief need…');
    try {
      const result = onSubmit({
        ...form,
        quantity: Number(form.quantity),
        peopleAffected: Number(form.peopleAffected),
        reporterType: 'citizen',
        idempotencyKey,
      });
      setReceipt(result);
      setStatusMessage(
        result?.deduplicated
          ? 'A matching report already existed, so this report was linked as a duplicate instead of counted twice.'
          : 'Relief need submitted. Keep the tracking token to check its status.'
      );
      setForm(emptyForm(form.jurisdictionId));
      setIdempotencyKey(makeKey());
    } catch (error) {
      const guidance = RELIEF_ERROR_GUIDANCE[error?.code] || error?.message || 'The report could not be submitted.';
      setStatusMessage(guidance);
      setReceipt(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="relief-card" aria-labelledby="relief-report-heading">
      <h2 id="relief-report-heading">Report a relief need</h2>
      <p className="relief-muted">
        Reports are reviewed by a relief operator. This form never asks for names, phone numbers,
        Aadhaar, PAN or email addresses. Keep the tracking token to check status.
      </p>

      <form className="relief-form" onSubmit={handleSubmit} noValidate>
        <div className="relief-form-grid">
          <div className="relief-field">
            <label htmlFor={fieldIds.category}>Need category</label>
            <select
              id={fieldIds.category}
              value={form.category}
              onChange={update('category')}
              aria-describedby={errors.category ? `${fieldIds.category}-error` : undefined}
              aria-invalid={Boolean(errors.category)}
            >
              {Object.values(RELIEF_CATEGORIES).map((category) => (
                <option key={category} value={category}>
                  {RELIEF_CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
            {errors.category && (
              <p className="relief-field-error" id={`${fieldIds.category}-error`}>
                {errors.category}
              </p>
            )}
          </div>

          <div className="relief-field">
            <label htmlFor={fieldIds.jurisdictionId}>Ward / jurisdiction</label>
            <select
              id={fieldIds.jurisdictionId}
              value={form.jurisdictionId}
              onChange={update('jurisdictionId')}
              aria-invalid={Boolean(errors.jurisdictionId)}
              aria-describedby={errors.jurisdictionId ? `${fieldIds.jurisdictionId}-error` : undefined}
            >
              {jurisdictions.map((jurisdiction) => (
                <option key={jurisdiction.id} value={jurisdiction.id}>
                  {jurisdiction.name}
                </option>
              ))}
            </select>
            {errors.jurisdictionId && (
              <p className="relief-field-error" id={`${fieldIds.jurisdictionId}-error`}>
                {errors.jurisdictionId}
              </p>
            )}
          </div>

          <div className="relief-field">
            <label htmlFor={fieldIds.locality}>Locality / area</label>
            <input
              id={fieldIds.locality}
              type="text"
              maxLength={80}
              value={form.locality}
              onChange={update('locality')}
              aria-invalid={Boolean(errors.locality)}
              aria-describedby={errors.locality ? `${fieldIds.locality}-error` : undefined}
              autoComplete="off"
            />
            {errors.locality && (
              <p className="relief-field-error" id={`${fieldIds.locality}-error`}>
                {errors.locality}
              </p>
            )}
          </div>

          <div className="relief-field">
            <label htmlFor={fieldIds.urgency}>Urgency</label>
            <select
              id={fieldIds.urgency}
              value={form.urgency}
              onChange={update('urgency')}
              aria-invalid={Boolean(errors.urgency)}
              aria-describedby={errors.urgency ? `${fieldIds.urgency}-error` : undefined}
            >
              {Object.values(URGENCY_LEVELS).map((urgency) => (
                <option key={urgency} value={urgency}>
                  {URGENCY_LEVEL_LABELS[urgency]}
                </option>
              ))}
            </select>
            {errors.urgency && (
              <p className="relief-field-error" id={`${fieldIds.urgency}-error`}>
                {errors.urgency}
              </p>
            )}
          </div>

          <div className="relief-field">
            <label htmlFor={fieldIds.quantity}>Quantity needed</label>
            <input
              id={fieldIds.quantity}
              type="number"
              min="1"
              max="100000"
              step="1"
              inputMode="numeric"
              value={form.quantity}
              onChange={update('quantity')}
              aria-invalid={Boolean(errors.quantity)}
              aria-describedby={errors.quantity ? `${fieldIds.quantity}-error` : undefined}
            />
            {errors.quantity && (
              <p className="relief-field-error" id={`${fieldIds.quantity}-error`}>
                {errors.quantity}
              </p>
            )}
          </div>

          <div className="relief-field">
            <label htmlFor={fieldIds.peopleAffected}>People affected</label>
            <input
              id={fieldIds.peopleAffected}
              type="number"
              min="1"
              max="500000"
              step="1"
              inputMode="numeric"
              value={form.peopleAffected}
              onChange={update('peopleAffected')}
              aria-invalid={Boolean(errors.peopleAffected)}
              aria-describedby={errors.peopleAffected ? `${fieldIds.peopleAffected}-error` : undefined}
            />
            {errors.peopleAffected && (
              <p className="relief-field-error" id={`${fieldIds.peopleAffected}-error`}>
                {errors.peopleAffected}
              </p>
            )}
          </div>
        </div>

        <div className="relief-field">
          <label htmlFor={fieldIds.description}>What is needed?</label>
          <textarea
            id={fieldIds.description}
            rows={4}
            maxLength={1000}
            value={form.description}
            onChange={update('description')}
            aria-invalid={Boolean(errors.description)}
            aria-describedby={errors.description ? `${fieldIds.description}-error` : 'relief-description-help'}
          />
          <p className="relief-help" id="relief-description-help">
            Describe supplies, not people. Example: “Dry ration kits for 40 households at the community
            hall.”
          </p>
          {errors.description && (
            <p className="relief-field-error" id={`${fieldIds.description}-error`}>
              {errors.description}
            </p>
          )}
        </div>

        <div className="relief-form-actions">
          <button type="submit" className="relief-button relief-button--primary" disabled={submitting}>
            <Send size={16} aria-hidden="true" />
            {submitting ? 'Submitting…' : 'Submit need report'}
          </button>
          <p className="relief-help">
            Submission is rate-limited. Repeated or near-identical reports are linked as duplicates.
          </p>
        </div>
      </form>

      <div aria-live="polite" role="status" className="relief-form-status">
        {statusMessage && (
          <p className={receipt ? 'relief-success' : 'relief-muted'}>
            {receipt ? <CheckCircle2 size={16} aria-hidden="true" /> : <AlertCircle size={16} aria-hidden="true" />}{' '}
            {statusMessage}
          </p>
        )}
        {receipt && (
          <dl className="relief-receipt">
            <div>
              <dt>Tracking token</dt>
              <dd><code>{receipt.trackingToken}</code></dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{receipt.statusLabel || receipt.status}</dd>
            </div>
            {receipt.duplicateOfTrackingToken && (
              <div>
                <dt>Linked to existing report</dt>
                <dd><code>{receipt.duplicateOfTrackingToken}</code></dd>
              </div>
            )}
          </dl>
        )}
      </div>
    </section>
  );
}
