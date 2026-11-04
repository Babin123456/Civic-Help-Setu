import { useState, useEffect } from 'react';
import { Bell, Shield, Loader2, Check, X, Info, RotateCcw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { logDiagnostic } from '../../utils/diagnostics';
import { getCategoryChoices } from '../../services/notificationPreferenceService';

const NotificationPreferenceCenter = ({ isOpen, onClose, userId: propUserId }) => {
  const { user } = useAuth();
  const userId = propUserId || user?.id;

  const [preferences, setPreferences] = useState({});
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');

  const loadPreferences = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/email/preferences');
      if (response.ok) {
        const data = await response.json();
        setPreferences(data.preferences || {});
        setCategories(data.categories || getCategoryChoices());
      } else {
        const localCategories = getCategoryChoices();
        setCategories(localCategories);
        const prefs = {};
        localCategories.forEach(c => { prefs[c.id] = c.essential ? true : (c.id === 'product_announcements' ? false : true); });
        setPreferences(prefs);
      }
    } catch (err) {
      logDiagnostic('Failed to load preferences:', err);
      const localCategories = getCategoryChoices();
      setCategories(localCategories);
      const prefs = {};
      localCategories.forEach(c => { prefs[c.id] = c.essential ? true : (c.id === 'product_announcements' ? false : true); });
      setPreferences(prefs);
    } finally {
      setLoading(false);
    }
  };

  /* eslint-disable */
  useEffect(() => {
    if (isOpen && userId) {
      loadPreferences();
    }
  }, [isOpen, userId]);
/* eslint-enable */

  const handleToggle = (categoryId, enabled) => {
    const category = categories.find(c => c.id === categoryId);
    if (category?.essential && !enabled) return;

    setPreferences(prev => ({ ...prev, [categoryId]: enabled }));
    setSaveError('');
    setSaveMessage('');
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    setSaveError('');
    setSaveMessage('');

    try {
      const response = await fetch('/api/email/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences }),
      });

      if (response.ok) {
        setSaveMessage('Preferences saved successfully!');
        setTimeout(() => setSaveMessage(''), 3000);
      } else {
        const data = await response.json();
        setSaveError(data.error || 'Failed to save preferences');
      }
    } catch (err) {
      logDiagnostic('Failed to save preferences:', err);
      setSaveError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!userId) return;
    setSaving(true);
    setSaveError('');
    setSaveMessage('');

    try {
      const response = await fetch('/api/email/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });

      if (response.ok) {
        const data = await response.json();
        setPreferences(data.preferences);
        setSaveMessage('Preferences reset to defaults!');
        setTimeout(() => setSaveMessage(''), 3000);
      } else {
        const data = await response.json();
        setSaveError(data.error || 'Failed to reset preferences');
      }
    } catch (err) {
      logDiagnostic('Failed to reset preferences:', err);
      setSaveError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const optionalCategories = categories.filter(c => !c.essential);
  const essentialCategories = categories.filter(c => c.essential);

  if (!isOpen) return null;

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
        <div className="glass-panel" style={{ width: '100%', maxWidth: '520px', margin: '1rem', padding: '2rem', textAlign: 'center' }}>
          <Loader2 size={32} color="var(--accent-main)" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Loading preferences...</p>
          <style>{`@keyframes spin { 100% { transform: rotate(360deg); } `}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', overflow: 'auto', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bell size={20} color="var(--accent-main)" /> Notification Preferences
            </h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Choose which optional emails you'd like to receive. Essential security emails are always sent.
            </p>
          </div>
          <button onClick={onClose} style={{ padding: '0.5rem', borderRadius: '0.5rem', background: 'transparent', border: '1px solid var(--border-light)', color: 'var(--text-secondary)', cursor: 'pointer' }} aria-label="Close">
            <X size={18} />
          </button>
        </div>

      {saveMessage && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderRadius: '0.75rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981', fontSize: '0.875rem' }}>
          <Check size={16} /> {saveMessage}
        </div>
      )}

      {saveError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderRadius: '0.75rem', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', fontSize: '0.875rem' }}>
          <Info size={16} /> {saveError}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ padding: '1rem', background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '0.875rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-main)' }}>
            <Shield size={13} /> Essential (Always Enabled)
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            These notifications are critical for your account security and cannot be disabled.
          </p>
        </div>

        {essentialCategories.map(category => (
          <PreferenceItem
            key={category.id}
            category={category}
            enabled={true}
            disabled
            onChange={() => {}}
          />
        ))}

        <div style={{ padding: '1rem', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '0.875rem', marginTop: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#f59e0b' }}>
            <Bell size={13} /> Optional Notifications
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Choose which updates you'd like to receive. You can change these anytime.
          </p>
        </div>

        {optionalCategories.map(category => (
          <PreferenceItem
            key={category.id}
            category={category}
            enabled={preferences[category.id] !== false}
            onChange={handleToggle}
          />
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
        <button onClick={handleReset} disabled={saving} className="btn btn-secondary" style={{ padding: '0.6rem 1.25rem' }}>
          <RotateCcw size={16} /> Reset to Defaults
        </button>
        <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ padding: '0.6rem 1.25rem' }}>
          {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={16} />}
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  </div>
  );
};

const PreferenceItem = ({ category, enabled, onChange, disabled }) => (
  <div style={{
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem',
    padding: '1rem 1.25rem', background: 'var(--glass-bg)', borderRadius: '0.875rem',
    border: '1px solid var(--border-light)', transition: 'border-color 0.2s, background 0.2s',
    opacity: disabled ? 0.6 : 1,
  }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)' }}>{category.label}</span>
        {disabled && (
          <span style={{ fontSize: '0.65rem', fontWeight: '700', padding: '0.15rem 0.4rem', borderRadius: '99px', background: 'rgba(56,189,248,0.12)', color: 'var(--accent-main)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Essential
          </span>
        )}
      </div>
      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{category.description}</p>
    </div>
    <label style={{ display: 'flex', alignItems: 'center', cursor: disabled ? 'not-allowed' : 'pointer', flexShrink: 0 }}>
      <input
        type="checkbox"
        checked={enabled}
        onChange={e => onChange(category.id, e.target.checked)}
        disabled={disabled}
        style={{
          width: '1.25rem', height: '1.25rem', borderRadius: '0.3rem',
          accentColor: 'var(--accent-main)', cursor: disabled ? 'not-allowed' : 'pointer',
        }}
        aria-label={category.label}
      />
    </label>
  </div>
);

export default NotificationPreferenceCenter;