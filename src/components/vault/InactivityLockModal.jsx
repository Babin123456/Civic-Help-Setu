import { useEffect, useRef } from 'react';
import { ShieldAlert, Clock, Lock, Check } from 'lucide-react';

export default function InactivityLockModal({
  isOpen,
  secondsRemaining = 30,
  onExtend,
  onLockNow,
}) {
  const primaryButtonRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      primaryButtonRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '1rem',
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="inactivity-dialog-title"
        aria-describedby="inactivity-dialog-desc"
        className="glass-panel animate-scale-up"
        style={{
          width: 'min(92vw, 450px)',
          padding: '1.75rem',
          borderRadius: '1.25rem',
          background: 'var(--bg-card, #1e293b)',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'rgba(245, 158, 11, 0.15)',
            color: '#f59e0b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
          }}
        >
          <ShieldAlert size={32} aria-hidden="true" />
        </div>

        <h3
          id="inactivity-dialog-title"
          style={{
            fontSize: '1.25rem',
            fontWeight: '800',
            color: 'var(--text-primary)',
            margin: '0 0 0.5rem',
          }}
        >
          Inactivity Privacy Alert
        </h3>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 0.85rem',
            borderRadius: '9999px',
            background: 'rgba(245, 158, 11, 0.15)',
            color: '#fbbf24',
            fontWeight: '700',
            fontSize: '0.9rem',
            marginBottom: '0.75rem',
          }}
        >
          <Clock size={16} aria-hidden="true" />
          <span>Auto-locking in {secondsRemaining}s</span>
        </div>

        <p
          id="inactivity-dialog-desc"
          style={{
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
            lineHeight: '1.5',
            margin: '0 0 1.5rem',
          }}
        >
          To safeguard your Aadhaar, PAN, and identity credentials from shoulder-surfing at public kiosks and shared computers, this vault will lock automatically.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            ref={primaryButtonRef}
            type="button"
            onClick={onExtend}
            className="btn btn-primary"
            style={{
              flex: 1,
              minWidth: '160px',
              padding: '0.75rem',
              fontSize: '0.9rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
            }}
          >
            <Check size={16} aria-hidden="true" />
            <span>I&apos;m Still Here (Extend)</span>
          </button>

          <button
            type="button"
            onClick={onLockNow}
            className="btn btn-secondary"
            style={{
              padding: '0.75rem 1rem',
              fontSize: '0.9rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
            }}
          >
            <Lock size={16} aria-hidden="true" />
            <span>Lock Now</span>
          </button>
        </div>
      </div>
    </div>
  );
}
