import {
  Calendar,
  Clock,
  FileText,
  Mail,
  Search,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  Edit3,
  Trash2,
  Layers,
} from 'lucide-react';
import {
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
} from '../../services/accessibilityEscalationService.js';

export default function CaseTimelineView({
  events = [],
  onAddEvent,
  onEditEvent,
  onDeleteEvent,
}) {
  const getEventIcon = (type) => {
    switch (type) {
      case EVENT_TYPES.COMPLAINT_FILED:
        return <FileText size={16} style={{ color: '#38bdf8' }} />;
      case EVENT_TYPES.ACKNOWLEDGMENT_RECEIVED:
        return <CheckCircle2 size={16} style={{ color: '#22c55e' }} />;
      case EVENT_TYPES.INSPECTION_REQUESTED:
        return <Search size={16} style={{ color: '#a855f7' }} />;
      case EVENT_TYPES.INSPECTION_CONDUCTED:
        return <Layers size={16} style={{ color: '#ec4899' }} />;
      case EVENT_TYPES.INTERIM_REPLY:
        return <Mail size={16} style={{ color: '#f59e0b' }} />;
      case EVENT_TYPES.REMINDER_SENT:
        return <Clock size={16} style={{ color: '#eab308' }} />;
      case EVENT_TYPES.HEARING_SCHEDULED:
        return <AlertCircle size={16} style={{ color: '#ef4444' }} />;
      case EVENT_TYPES.BARRIER_RECTIFIED:
        return <CheckCircle2 size={16} style={{ color: '#22c55e' }} />;
      default:
        return <Calendar size={16} style={{ color: '#94a3b8' }} />;
    }
  };

  return (
    <div
      style={{
        background: 'var(--bg-card, #1e293b)',
        borderRadius: '1rem',
        padding: '1.5rem',
        border: '1px solid var(--border-light, #334155)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          borderBottom: '1px solid var(--border-light, #334155)',
          paddingBottom: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
            Chronological Correspondence &amp; Inspection Timeline
          </h2>
          <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>
            Record complaint submissions, speed-post acknowledgments, field inspection requests, and departmental replies.
          </p>
        </div>

        <button
          onClick={onAddEvent}
          type="button"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.55rem 1rem',
            borderRadius: '0.5rem',
            background: '#2563eb',
            color: '#ffffff',
            border: 'none',
            fontWeight: 600,
            fontSize: '0.85rem',
            cursor: 'pointer',
          }}
        >
          <PlusCircle size={16} /> Add Timeline Event
        </button>
      </div>

      {/* Empty State */}
      {events.length === 0 ? (
        <div
          style={{
            padding: '3rem 1.5rem',
            textAlign: 'center',
            background: 'rgba(15, 23, 42, 0.4)',
            borderRadius: '0.75rem',
            border: '1px dashed #334155',
          }}
        >
          <Calendar size={36} style={{ color: '#64748b', margin: '0 auto 0.75rem auto' }} />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', margin: '0 0 0.4rem 0' }}>
            No Correspondence or Timeline Events Recorded
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', maxWidth: '480px', margin: '0 auto 1.25rem auto' }}>
            Start logging your journey: record the date of your initial complaint, docket numbers, speed post consignment slips, joint inspection dates, or follow-up milestones.
          </p>
          <button
            onClick={onAddEvent}
            type="button"
            style={{
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
            Log First Event
          </button>
        </div>
      ) : (
        /* Vertical Chronological Timeline */
        <div style={{ position: 'relative', paddingLeft: '1.5rem' }}>
          {/* Vertical Connecting Line */}
          <div
            style={{
              position: 'absolute',
              left: '0.7rem',
              top: '0.5rem',
              bottom: '0.5rem',
              width: '2px',
              background: '#334155',
            }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {events.map((evt, idx) => (
              <div
                key={evt.id || idx}
                style={{
                  position: 'relative',
                  background: 'rgba(15, 23, 42, 0.6)',
                  borderRadius: '0.75rem',
                  padding: '1rem 1.25rem',
                  border: '1px solid #334155',
                }}
              >
                {/* Timeline Node Dot */}
                <div
                  style={{
                    position: 'absolute',
                    left: '-1.55rem',
                    top: '1.1rem',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: '#1e293b',
                    border: '3px solid #38bdf8',
                  }}
                />

                {/* Event Card Top Strip */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    marginBottom: '0.4rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        background: 'rgba(56, 189, 248, 0.12)',
                        color: '#38bdf8',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '0.25rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        fontFamily: 'monospace',
                      }}
                    >
                      <Calendar size={11} /> {evt.eventDate}
                    </span>

                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        background: 'rgba(255, 255, 255, 0.08)',
                        color: '#e2e8f0',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '0.25rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    >
                      {getEventIcon(evt.eventType)}
                      {EVENT_TYPE_LABELS[evt.eventType] || evt.eventType}
                    </span>

                    {evt.followUpDate && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          background: 'rgba(234, 179, 8, 0.15)',
                          color: '#eab308',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                        }}
                      >
                        <Clock size={11} /> Target Follow-up: {evt.followUpDate}
                      </span>
                    )}
                  </div>

                  {/* Edit / Delete Buttons */}
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <button
                      onClick={() => onEditEvent(evt)}
                      type="button"
                      aria-label={`Edit event ${evt.summary}`}
                      style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.375rem',
                        background: 'rgba(255, 255, 255, 0.08)',
                        color: '#cbd5e1',
                        border: 'none',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                      }}
                    >
                      <Edit3 size={12} /> Edit
                    </button>
                    <button
                      onClick={() => onDeleteEvent(evt.id)}
                      type="button"
                      aria-label={`Delete event ${evt.summary}`}
                      style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.375rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#ef4444',
                        border: 'none',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Event Summary */}
                <h4
                  style={{
                    fontSize: '0.98rem',
                    fontWeight: 600,
                    color: '#ffffff',
                    margin: '0.2rem 0 0.35rem 0',
                  }}
                >
                  {evt.summary}
                </h4>

                {/* Event Details */}
                {evt.details && (
                  <p
                    style={{
                      fontSize: '0.85rem',
                      color: '#cbd5e1',
                      margin: '0 0 0.5rem 0',
                      lineHeight: 1.5,
                    }}
                  >
                    {evt.details}
                  </p>
                )}

                {/* Evidence References Chips */}
                {evt.evidenceRefs && evt.evidenceRefs.length > 0 && (
                  <div
                    style={{
                      marginTop: '0.5rem',
                      paddingTop: '0.5rem',
                      borderTop: '1px solid rgba(51, 65, 85, 0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>
                      Evidence &amp; Proof:
                    </span>
                    {evt.evidenceRefs.map((ref, rIdx) => (
                      <span
                        key={rIdx}
                        style={{
                          background: 'rgba(168, 85, 247, 0.12)',
                          color: '#d8b4fe',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.72rem',
                          fontFamily: 'monospace',
                        }}
                      >
                        {ref}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
