import { useEffect } from 'react';
import { X, Navigation, Train, Bus, Car, MapPin, ExternalLink, HelpCircle } from 'lucide-react';

export default function TransitDirectionsGuideModal({ isOpen, onClose, office }) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !office) return null;

  const destinationQuery = encodeURIComponent(`${office.name}, ${office.address}, ${office.city || ''}`);
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destinationQuery}`;

  // Default transit hints based on office metadata or generated standards
  const nearestStation = office.transitStation || `${office.city || 'Central'} Junction / Metro Line 1`;
  const busStop = office.busStop || `${office.name.split(' ')[0]} Chowk / Main Bus Stand`;

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 1000,
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="glass-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transit-guide-title"
        style={{
          background: 'var(--bg-card, #1e293b)',
          border: '1px solid var(--border-light, #334155)',
          borderRadius: '1rem',
          maxWidth: '620px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-light, #334155)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Navigation size={20} color="var(--accent-main, #38bdf8)" aria-hidden="true" />
            <h3 id="transit-guide-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
              Transit & Landmark Navigation Guide
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost"
            aria-label="Close transit directions modal"
            style={{ padding: '0.4rem', borderRadius: '0.5rem', color: 'var(--text-secondary)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h4 style={{ margin: '0 0 0.35rem', fontSize: '1rem', fontWeight: 600 }}>{office.name}</h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <MapPin size={14} color="var(--accent-main)" />
              {office.address}, {office.city} - {office.pincode}
            </p>
          </div>

          <div style={{ display: 'grid', gap: '0.85rem' }}>
            {/* Metro / Rail */}
            <div style={{ padding: '0.85rem 1rem', borderRadius: '0.65rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-light, #334155)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <Train size={20} color="#38bdf8" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ fontSize: '0.88rem' }}>Nearest Metro / Railway Station:</strong>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  {nearestStation}. Use Exit Gate 2 or 3. Shared auto/e-rickshaws available directly to the office gate (approx. ₹10-₹20).
                </p>
              </div>
            </div>

            {/* Bus Feeder */}
            <div style={{ padding: '0.85rem 1rem', borderRadius: '0.65rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-light, #334155)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <Bus size={20} color="#34d399" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ fontSize: '0.88rem' }}>Public Bus Connectivity:</strong>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Alight at <strong>{busStop}</strong>. Frequency: every 10–15 mins during operational office hours (09:30 AM to 05:30 PM).
                </p>
              </div>
            </div>

            {/* Parking & Drop-off */}
            <div style={{ padding: '0.85rem 1rem', borderRadius: '0.65rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-light, #334155)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <Car size={20} color="#fbbf24" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ fontSize: '0.88rem' }}>Parking & Senior Citizen Drop-off:</strong>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Designated two-wheeler parking available near Gate 1. Four-wheeler parking can be congested on peak days; drop-off zone available directly opposite the disabled ramp entrance.
                </p>
              </div>
            </div>

            {/* Key Landmark Tip */}
            <div style={{ padding: '0.85rem 1rem', borderRadius: '0.65rem', background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <HelpCircle size={20} color="var(--accent-main, #38bdf8)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                <strong>Civil Service Helpful Tip:</strong> Government authorized stamp vendors, affidavit notaries, and photocopy (xerox) kiosks operate immediately outside Gate 1.
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-light, #334155)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          <button type="button" onClick={onClose} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
            Close
          </button>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
          >
            <ExternalLink size={15} /> Open Navigation in Maps
          </a>
        </div>
      </div>
    </div>
  );
}
