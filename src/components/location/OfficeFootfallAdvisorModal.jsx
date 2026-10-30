import { useState, useEffect } from 'react';
import { X, Clock, Users, AlertCircle, Sparkles, Building2, Calendar, Printer } from 'lucide-react';
import {
  DAYS_OF_WEEK,
  getHourlyFootfallForecast,
  getRecommendedVisitWindows,
} from '../../services/officeFootfallAdvisorService';

export default function OfficeFootfallAdvisorModal({ office, isOpen, onClose }) {
  const [selectedDay, setSelectedDay] = useState('Wednesday');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !office) return null;

  const forecast = getHourlyFootfallForecast(office, selectedDay);
  const advice = getRecommendedVisitWindows(office, selectedDay);

  const getBarColor = (level) => {
    if (level === 'HIGH') return '#ef4444';
    if (level === 'MODERATE') return '#f59e0b';
    return '#10b981';
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="footfall-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 110,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="card animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-main)',
          border: '1px solid var(--border-main)',
          borderRadius: '1rem',
          padding: '1.75rem',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '2.4rem',
                height: '2.4rem',
                borderRadius: '0.6rem',
                background: 'rgba(59, 130, 246, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-main)',
              }}
            >
              <Clock size={20} />
            </div>
            <div>
              <h2 id="footfall-modal-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                Peak Hours &amp; Queue Wait Time Advisor
              </h2>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Footfall distribution and best arrival slot for <strong>{office.name}</strong>.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close footfall advisor"
            className="btn-icon"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              padding: '0.4rem',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Day Selector Pills */}
        <div>
          <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
            Select Day of the Week
          </span>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {DAYS_OF_WEEK.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '999px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: selectedDay === day ? '1px solid var(--accent-main)' : '1px solid var(--border-light)',
                  background: selectedDay === day ? 'var(--accent-main)' : 'var(--glass-bg)',
                  color: selectedDay === day ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        {/* Recommendations Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
          <div
            style={{
              padding: '0.85rem 1rem',
              borderRadius: '0.6rem',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', fontWeight: 700, fontSize: '0.8rem' }}>
              <Sparkles size={14} /> Recommended Visit Window
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, marginTop: '0.2rem' }}>
              {advice.recommendedWindow}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Best slot: {advice.bestTimeSlot}
            </div>
          </div>

          <div
            style={{
              padding: '0.85rem 1rem',
              borderRadius: '0.6rem',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ef4444', fontWeight: 700, fontSize: '0.8rem' }}>
              <Users size={14} /> Peak Rush Window (Avoid)
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, marginTop: '0.2rem' }}>
              10:30 AM - 01:00 PM
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Highest wait: {advice.peakTimeSlot}
            </div>
          </div>
        </div>

        {/* Hourly Footfall Chart */}
        <div>
          <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>
            Hourly Queue Congestion &amp; Estimated Wait Times ({selectedDay})
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {forecast.hourlyData.map((slot) => (
              <div
                key={slot.hour}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  fontSize: '0.78rem',
                }}
              >
                <span style={{ width: '65px', fontWeight: 600, color: 'var(--text-secondary)', flexShrink: 0 }}>
                  {slot.hour}
                </span>

                <div
                  style={{
                    flex: 1,
                    height: '1.25rem',
                    background: 'var(--glass-bg)',
                    borderRadius: '0.35rem',
                    overflow: 'hidden',
                    position: 'relative',
                    border: '1px solid var(--border-light)',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${slot.intensityPercent}%`,
                      background: getBarColor(slot.congestionLevel),
                      borderRadius: '0.25rem',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>

                <div style={{ width: '130px', textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ fontWeight: 700, color: getBarColor(slot.congestionLevel) }}>
                    ~{slot.estimatedWaitMinutes} mins wait
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Token Availability Advisory */}
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
          }}
        >
          <AlertCircle size={16} color="var(--accent-main)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>{advice.tokenAvailabilityNote}</span>
        </div>

        {/* Modal Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{ fontSize: '0.85rem' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
