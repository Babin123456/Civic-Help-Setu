import { useState, useEffect } from 'react';
import { X, Eye, Type, Sliders, RotateCcw, Check, Sparkles } from 'lucide-react';
import {
  FONT_SCALE_OPTIONS,
  LINE_SPACING_OPTIONS,
  READER_THEMES,
  DEFAULT_READER_PREFERENCES,
  getReaderPreferences,
  saveReaderPreferences,
  computeReaderStyle,
} from '../../services/accessibleReaderService';

export default function AccessibleReaderPreferencesModal({ isOpen, onClose, onPreferencesChange }) {
  const [prefs, setPrefs] = useState(() => getReaderPreferences());

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      setPrefs(getReaderPreferences());
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleUpdate = (updated) => {
    setPrefs(updated);
    saveReaderPreferences(updated);
    onPreferencesChange?.(updated);
  };

  const handleReset = () => {
    handleUpdate(DEFAULT_READER_PREFERENCES);
  };

  const previewStyle = computeReaderStyle(prefs);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reader-prefs-modal-title"
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
          maxWidth: '620px',
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
                background: 'rgba(56, 189, 248, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-main)',
              }}
            >
              <Eye size={20} />
            </div>
            <div>
              <h2 id="reader-prefs-modal-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                Accessible Reader &amp; Typography Preferences
              </h2>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Customize font size, contrast themes, and dyslexia-friendly typography for civic guides.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close reader preferences"
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

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Font Scale */}
          <div>
            <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
              Text Size Scaling
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
              {FONT_SCALE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleUpdate({ ...prefs, fontSizeScale: opt.id })}
                  style={{
                    padding: '0.5rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: prefs.fontSizeScale === opt.id ? '1px solid var(--accent-main)' : '1px solid var(--border-light)',
                    background: prefs.fontSizeScale === opt.id ? 'rgba(56, 189, 248, 0.15)' : 'var(--glass-bg)',
                    color: prefs.fontSizeScale === opt.id ? 'var(--accent-main)' : 'var(--text-secondary)',
                  }}
                >
                  {opt.label.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Line Height */}
          <div>
            <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
              Line Spacing (Leading)
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
              {LINE_SPACING_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleUpdate({ ...prefs, lineSpacing: opt.id })}
                  style={{
                    padding: '0.5rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: prefs.lineSpacing === opt.id ? '1px solid var(--accent-main)' : '1px solid var(--border-light)',
                    background: prefs.lineSpacing === opt.id ? 'rgba(56, 189, 248, 0.15)' : 'var(--glass-bg)',
                    color: prefs.lineSpacing === opt.id ? 'var(--accent-main)' : 'var(--text-secondary)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dyslexia Typography Toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.88rem' }}>
            <input
              type="checkbox"
              checked={prefs.dyslexiaFont}
              onChange={(e) => handleUpdate({ ...prefs, dyslexiaFont: e.target.checked })}
            />
            <span style={{ fontWeight: 600 }}>Enable Dyslexia-Friendly Letter Spacing &amp; Font</span>
          </label>

          {/* Reading Contrast Themes */}
          <div>
            <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
              Reading Contrast Scheme
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
              {READER_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => handleUpdate({ ...prefs, themeId: theme.id })}
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'left',
                    border: prefs.themeId === theme.id ? '2px solid var(--accent-main)' : '1px solid var(--border-light)',
                    background: theme.id === 'default' ? 'var(--glass-bg)' : theme.bg,
                    color: theme.id === 'default' ? 'var(--text-primary)' : theme.text,
                  }}
                >
                  {theme.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live Sample Preview Container */}
        <div>
          <span style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
            Live Reader Sample Preview
          </span>
          <div
            style={{
              padding: '1rem',
              borderRadius: '0.6rem',
              background: 'var(--glass-bg)',
              border: '1px solid var(--border-light)',
              ...previewStyle,
            }}
          >
            <strong>Step 1: Document Verification at Ward Office</strong>
            <p style={{ margin: '0.4rem 0 0' }}>
              Present your original Aadhaar and ration card at Counter 3. The verification officer will authenticate your identity and issue an acknowledgement slip.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleReset}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem' }}
          >
            <RotateCcw size={14} /> Reset to Default
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onClose}
            style={{ fontSize: '0.85rem' }}
          >
            Apply &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
}
