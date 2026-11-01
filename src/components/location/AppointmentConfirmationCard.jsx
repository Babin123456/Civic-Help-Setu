import React from 'react';
import { CheckCircle2, Calendar, MapPin, Clock, ExternalLink } from 'lucide-react';
import { safeHttpUrl } from '../../utils/safeContent';

const AppointmentConfirmationCard = ({ appointment, onOpenCalendarSync }) => {
  if (!appointment) return null;

  return (
    <div
      style={{
        padding: '1.5rem',
        borderRadius: '1rem',
        background: 'rgba(16, 185, 129, 0.08)',
        border: '1px solid rgba(16, 185, 129, 0.25)',
        textAlign: 'center'
      }}
    >
      <div
        style={{
          width: '3.5rem',
          height: '3.5rem',
          borderRadius: '50%',
          background: 'rgba(16, 185, 129, 0.2)',
          color: 'var(--success, #10b981)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1rem auto'
        }}
      >
        <CheckCircle2 size={32} />
      </div>

      <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
        Appointment Confirmed!
      </h3>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
        Your booking slot has been locked with the facilitation desk.
      </p>

      {/* Token ID */}
      <div
        style={{
          padding: '0.85rem',
          background: 'var(--glass-bg)',
          borderRadius: '0.75rem',
          border: '1px dashed var(--accent-main)',
          marginBottom: '1.25rem'
        }}
      >
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Verification Queue Token
        </span>
        <div style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--accent-main)', fontFamily: 'monospace', marginTop: '0.25rem' }}>
          {appointment.token || `TKN-${Math.floor(100000 + Math.random() * 900000)}`}
        </div>
      </div>

      {/* Date & Location */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={15} color="var(--accent-main)" />
          <span><strong>Schedule:</strong> {appointment.date} ({appointment.timeSlot})</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MapPin size={15} color="var(--accent-main)" />
          <span><strong>Office:</strong> {appointment.officeName}</span>
        </div>
      </div>

      {/* Calendar & Map Actions */}
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          type="button"
          onClick={onOpenCalendarSync}
          className="btn btn-primary"
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.6rem' }}
        >
          <Calendar size={16} />
          <span>Add to Calendar</span>
        </button>
        {appointment.directionsUrl && (
          <a
            href={safeHttpUrl(appointment.directionsUrl) || undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', padding: '0.6rem 1rem', textDecoration: 'none' }}
          >
            <span>Directions</span>
            <ExternalLink size={14} />
          </a>
        )}
      </div>
    </div>
  );
};

export default AppointmentConfirmationCard;
