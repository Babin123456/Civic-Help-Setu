import React from 'react';
import { X, Calendar, Download, ExternalLink, Clock, MapPin, CheckCircle2 } from 'lucide-react';
import { calendarExportService } from '../../services/calendarExportService';

const CalendarSyncModal = ({ isOpen, onClose, appointment }) => {
  if (!isOpen || !appointment) return null;

  const handleDownload = () => {
    calendarExportService.downloadIcsFile(appointment);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 1150,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="calendar-modal-title"
    >
      <div
        className="card-glass animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '520px',
          borderRadius: '1.25rem',
          background: 'var(--bg-card, #111827)',
          border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.75rem',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--glass-bg)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '0.75rem',
                background: 'rgba(56, 189, 248, 0.15)',
                color: 'var(--accent-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Calendar size={20} />
            </div>
            <div>
              <h2 id="calendar-modal-title" style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                Sync Appointment to Calendar
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Export reminder and slot details with automated 2-hour pre-alarm
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '0.5rem'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Appointment summary card */}
        <div style={{ padding: '1.5rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div
            style={{
              padding: '1rem',
              background: 'var(--glass-bg)',
              borderRadius: '0.75rem',
              border: '1px solid var(--border-light)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}
          >
            <div style={{ fontWeight: '700', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
              {appointment.officeName || 'Facilitation Center'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              <Clock size={14} color="var(--accent-main)" />
              <span>{appointment.date} at {appointment.timeSlot}</span>
            </div>
            {appointment.address && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                <MapPin size={14} color="var(--accent-main)" />
                <span>{appointment.address}</span>
              </div>
            )}
          </div>

          {/* Sync Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              onClick={handleDownload}
              className="btn btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.75rem',
                fontSize: '0.9rem'
              }}
            >
              <Download size={18} />
              <span>Download .ICS File (Apple Calendar / Outlook / Phone)</span>
            </button>

            <a
              href={calendarExportService.getGoogleCalendarUrl(appointment)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.75rem',
                fontSize: '0.9rem',
                textDecoration: 'none'
              }}
            >
              <span>Add Directly to Google Calendar</span>
              <ExternalLink size={16} />
            </a>

            <a
              href={calendarExportService.getOutlookCalendarUrl(appointment)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.75rem',
                fontSize: '0.9rem',
                textDecoration: 'none'
              }}
            >
              <span>Add to Outlook Web / Live</span>
              <ExternalLink size={16} />
            </a>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-tertiary, var(--text-secondary))' }}>
              The Google and Outlook links share only the office, place, time and service. Your token stays out of them;
              the .ICS file is made on this device and includes it.
            </p>
          </div>

          <div style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Includes office address, service checklist, and 2-hour pre-visit phone notification.
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarSyncModal;
