import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Send } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { REPORT_REASONS } from '../../services/officeComparisonService';
import { submitOfficeReport, validateOfficeReport } from '../../services/officeComparisonReportService';

/**
 * Minimal, privacy-safe outdated-record report form (#824).
 *
 * The form never asks for a name, account, phone number or document. A report
 * contains only the office ID, a reason, an optional short note and an optional
 * official HTTPS source. Reports are sent to the review endpoint; if it is
 * unreachable they are kept on this device.
 */
const OfficeReportForm = ({ office, cancelHref = '' }) => {
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [errors, setErrors] = useState([]);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    const report = { officeId: office.id, reason, note, sourceUrl };
    const validation = validateOfficeReport(report);
    if (!validation.valid) {
      setErrors(validation.errors);
      setStatus('error');
      setMessage('The report was not sent. Please fix the highlighted fields.');
      return;
    }

    setErrors([]);
    setStatus('submitting');
    setMessage('');
    const result = await submitOfficeReport(report);
    if (!result.ok) {
      setErrors(result.errors || ['The report could not be submitted.']);
      setStatus('error');
      setMessage('The report was not sent.');
      return;
    }

    setStatus('success');
    setMessage(result.message);
    setReason('');
    setNote('');
    setSourceUrl('');
    toast?.success?.(result.message, 'Report recorded');
  };

  return (
    <section
      className="comparison-report"
      id="office-report"
      tabIndex={-1}
      aria-labelledby="comparison-report-heading"
    >
      <h2 id="comparison-report-heading">Report an outdated record</h2>
      <p>
        Tell us what is wrong with this office record. Do not include Aadhaar numbers, PAN numbers, passwords, OTPs,
        personal phone numbers or email addresses. Reports are reviewed by an administrator; submitting one does not
        change the record immediately.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        <div className="comparison-report__field">
          <label htmlFor="report-reason">What is wrong? (required)</label>
          <select
            id="report-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
          >
            <option value="">— Choose a reason —</option>
            {REPORT_REASONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="comparison-report__field">
          <label htmlFor="report-note">Short note (optional, 500 characters)</label>
          <textarea
            id="report-note"
            value={note}
            maxLength={500}
            rows={3}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Example: the listed helpline is no longer in service."
          />
        </div>

        <div className="comparison-report__field">
          <label htmlFor="report-source">Official source you checked (optional, HTTPS)</label>
          <input
            id="report-source"
            type="url"
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            placeholder="https://department.gov.in/office-directory"
            inputMode="url"
          />
        </div>

        {errors.length > 0 && (
          <div className="comparison-report__errors" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            <ul>
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {message && (
          <p
            className={`comparison-report__message comparison-report__message--${status}`}
            role={status === 'error' ? 'alert' : 'status'}
            aria-live="polite"
          >
            {status === 'success' && <CheckCircle2 size={15} aria-hidden="true" />}
            {message}
          </p>
        )}

        <div className="comparison-report__actions">
          <button type="submit" className="btn btn-primary" disabled={status === 'submitting'}>
            <Send size={15} aria-hidden="true" />
            {status === 'submitting' ? 'Submitting report…' : 'Submit report for review'}
          </button>
          {cancelHref && (
            <Link className="btn btn-secondary" to={cancelHref}>
              Cancel and return
            </Link>
          )}
        </div>
      </form>
    </section>
  );
};

export default OfficeReportForm;
