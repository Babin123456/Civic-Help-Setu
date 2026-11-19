import { useState } from 'react';
import {
  X,
  Calendar,
  Clock,
  Save,
  AlertCircle,
} from 'lucide-react';
import {
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
} from '../../services/accessibilityEscalationService.js';

export default function EventEditorModal({
  event, // null for new event, or event object for edit
  onClose,
  onSave,
}) {
  const isEditing = Boolean(event && event.id);

  const [eventType, setEventType] = useState(event?.eventType || EVENT_TYPES.COMPLAINT_FILED);
  const [eventDate, setEventDate] = useState(
    event?.eventDate || new Date().toISOString().slice(0, 10)
  );
  const [summary, setSummary] = useState(event?.summary || '');
  const [details, setDetails] = useState(event?.details || '');
  const [evidenceText, setEvidenceText] = useState(
    Array.isArray(event?.evidenceRefs) ? event.evidenceRefs.join('\n') : ''
  );
  const [followUpDate, setFollowUpDate] = useState(event?.followUpDate || '');
  const [error, setError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!summary.trim()) {
      setError('Event summary is required.');
      return;
    }
    if (!eventDate) {
      setError('Event date is required.');
      return;
    }

    const evidenceRefs = evidenceText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    onSave({
      ...(event || {}),
      eventType,
      eventDate,
      summary: summary.trim(),
      details: details.trim(),
      evidenceRefs,
      followUpDate: followUpDate || null,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-editor-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: 'var(--bg-modal, #1e293b)',
          borderRadius: '1rem',
          maxWidth: '560px',
          width: '100%',
          border: '1px solid var(--border-light, #334155)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          color: 'var(--text-main, #f8fafc)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-light, #334155)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={18} style={{ color: '#38bdf8' }} />
            <h2
              id="event-editor-title"
              style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#ffffff' }}
            >
              {isEditing ? 'Edit Timeline Event' : 'Log Timeline Event'}
            </h2>
          </div>
          <button
            onClick={onClose}
            type="button"
            aria-label="Close modal"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '0.2rem',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', overflowY: 'auto' }}>
          {error && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <AlertCircle size={15} />
              {error}
            </div>
          )}

          {/* Event Type & Date Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
              marginBottom: '1rem',
            }}
          >
            <div>
              <label
                htmlFor="event-type-select"
                style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}
              >
                Event Classification *
              </label>
              <select
                id="event-type-select"
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '0.5rem',
                  background: 'var(--bg-input, #0f172a)',
                  border: '1px solid var(--border-light, #334155)',
                  color: 'var(--text-main, #f8fafc)',
                  fontSize: '0.875rem',
                }}
              >
                {Object.entries(EVENT_TYPE_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="event-date-input"
                style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}
              >
                Event Date (YYYY-MM-DD) *
              </label>
              <input
                id="event-date-input"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '0.5rem',
                  background: 'var(--bg-input, #0f172a)',
                  border: '1px solid var(--border-light, #334155)',
                  color: 'var(--text-main, #f8fafc)',
                  fontSize: '0.875rem',
                }}
              />
            </div>
          </div>

          {/* Headline Summary */}
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="event-summary-input"
              style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}
            >
              Event Summary / Action Taken *
            </label>
            <input
              id="event-summary-input"
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              required
              placeholder="e.g. Dispatched written reminder via Speed Post"
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem',
                borderRadius: '0.5rem',
                background: 'var(--bg-input, #0f172a)',
                border: '1px solid var(--border-light, #334155)',
                color: 'var(--text-main, #f8fafc)',
                fontSize: '0.875rem',
              }}
            />
          </div>

          {/* Detailed Observations */}
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="event-details-input"
              style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}
            >
              Detailed Observations &amp; Correspondence Notes
            </label>
            <textarea
              id="event-details-input"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              placeholder="Record officer names, counter numbers, phone discussions, or response contents..."
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem',
                borderRadius: '0.5rem',
                background: 'var(--bg-input, #0f172a)',
                border: '1px solid var(--border-light, #334155)',
                color: 'var(--text-main, #f8fafc)',
                fontSize: '0.875rem',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Evidence References */}
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="event-evidence-input"
              style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}
            >
              Evidence References &amp; Tracking Proof (One per line)
            </label>
            <textarea
              id="event-evidence-input"
              value={evidenceText}
              onChange={(e) => setEvidenceText(e.target.value)}
              rows={2}
              placeholder="e.g.&#10;Speed Post Consignment Receipt #ED123456789IN&#10;Inward Receiving Stamp Photo #IMG_4412"
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem',
                borderRadius: '0.5rem',
                background: 'var(--bg-input, #0f172a)',
                border: '1px solid var(--border-light, #334155)',
                color: 'var(--text-main, #f8fafc)',
                fontSize: '0.875rem',
                resize: 'vertical',
                fontFamily: 'monospace',
              }}
            />
          </div>

          {/* Target Follow-up Date */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="event-followup-input"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                marginBottom: '0.35rem',
              }}
            >
              <Clock size={13} style={{ color: '#eab308' }} /> Target Follow-Up Date (Optional)
            </label>
            <input
              id="event-followup-input"
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem',
                borderRadius: '0.5rem',
                background: 'var(--bg-input, #0f172a)',
                border: '1px solid var(--border-light, #334155)',
                color: 'var(--text-main, #f8fafc)',
                fontSize: '0.875rem',
              }}
            />
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
              Setting a target date prompts a reminder if no departmental response is logged by this date.
            </div>
          </div>

          {/* Footer Buttons */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
            }}
          >
            <button
              onClick={onClose}
              type="button"
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#f8fafc',
                border: 'none',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 1.25rem',
                borderRadius: '0.5rem',
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              <Save size={15} /> Save Event
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
