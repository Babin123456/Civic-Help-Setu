import { useState, useRef, useEffect } from 'react';
import {
  User, Mail, Phone, MapPin, Briefcase, Edit3, Check, X,
  Camera, ShieldCheck, LogOut, Star, FileText, BookMarked,
  ChevronRight, Loader2, AlertCircle, ExternalLink, Download,
  Bell, Shield, CheckCircle, RotateCcw, Send, Lock, Share2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { describeProviderError, logProviderError } from '../utils/providerError';
import ClearMyDataPanel from '../components/privacy/ClearMyDataPanel';
import DataPortabilityModal from '../components/profile/DataPortabilityModal';
import CivicEntitlementReadinessCard from '../components/profile/CivicEntitlementReadinessCard';
import VoluntaryProfileRecommendationPanel from '../components/profile/VoluntaryProfileRecommendationPanel';
import NotificationPreferenceCenter from '../components/profile/NotificationPreferenceCenter';
import ShareableProfileModal from '../components/profile/ShareableProfileModal';
import { isEmailVerified } from '../services/emailVerificationService';

/* ─────────────────────────── Enhanced Field Component ─────────────────────────── */
const Field = ({
  icon: Icon,
  label,
  value,
  placeholder,
  editing,
  name,
  onChange,
  type = 'text',
  error = '',
  required = false,
  helperText = '',
}) => {
  const inputId = `profile-field-${name}`;
  const errorId = `profile-field-error-${name}`;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem',
        width: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '1rem',
          padding: '1rem 1.25rem',
          background: 'var(--glass-bg)',
          borderRadius: '0.875rem',
          border: error ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid var(--border-light)',
          transition: 'border-color 0.2s',
        }}
      >
        <div
          style={{
            width: '2.25rem',
            height: '2.25rem',
            borderRadius: '0.65rem',
            background: 'var(--accent-light, rgba(56, 189, 248, 0.1))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: '0.1rem',
          }}
        >
          <Icon size={16} color="var(--accent-main)" aria-hidden="true" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <label
            htmlFor={inputId}
            style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: '700',
              color: 'var(--text-tertiary)',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              marginBottom: '0.2rem',
            }}
          >
            {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
          </label>
          {editing ? (
            <input
              id={inputId}
              type={type}
              name={name}
              value={value}
              placeholder={placeholder}
              onChange={onChange}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.975rem',
                fontFamily: 'inherit',
                borderBottom: error ? '1px solid #ef4444' : '1px solid var(--accent-main)',
                paddingBottom: '2px',
              }}
            />
          ) : (
            <p
              id={inputId}
              style={{
                color: value ? 'var(--text-primary)' : 'var(--text-tertiary)',
                fontSize: '0.975rem',
                fontWeight: value ? '500' : '400',
                margin: 0,
              }}
            >
              {value || placeholder}
            </p>
          )}
        </div>
      </div>
      {error && (
        <span
          id={errorId}
          role="alert"
          style={{
            fontSize: '0.78rem',
            color: '#ef4444',
            paddingLeft: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <AlertCircle size={12} aria-hidden="true" />
          {error}
        </span>
      )}
      {!error && helperText && (
        <span
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-tertiary)',
            paddingLeft: '0.5rem',
          }}
        >
          {helperText}
        </span>
      )}
    </div>
  );
};

const StatCard = ({ label, value, icon: Icon, color }) => (
  <div
    style={{
      padding: '1.25rem',
      background: 'var(--glass-bg)',
      borderRadius: '1rem',
      border: '1px solid var(--border-light)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      flex: 1,
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span
        style={{
          fontSize: '0.8rem',
          color: 'var(--text-tertiary)',
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </span>
      <Icon size={16} color={color || 'var(--accent-main)'} aria-hidden="true" />
    </div>
    <p style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', lineHeight: 1, margin: 0 }}>
      {value}
    </p>
  </div>
);

/* ─────────────────────────── Profile Component ─────────────────────────── */
const Profile = () => {
  const { user, logout, clerk } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  /* ── form state seeded from Clerk / unsafeMetadata ── */
  const clerkUser = user?.raw;
  const meta = clerkUser?.unsafeMetadata || {};

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveOk, setSaveOk] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [, setDataVersion] = useState(0);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const [form, setForm] = useState({
    firstName: clerkUser?.firstName || '',
    lastName: clerkUser?.lastName || '',
    phone: meta.phone || '',
    city: meta.city || '',
    state: meta.state || '',
    occupation: meta.occupation || '',
    bio: meta.bio || '',
  });

  const [fieldErrors, setFieldErrors] = useState({});

  const [emailVerified, setEmailVerified] = useState(false);
  const [prefModalOpen, setPrefModalOpen] = useState(false);
  const [emailChangeModalOpen, setEmailChangeModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailChangeStep, setEmailChangeStep] = useState('input');
  const [emailChangeLoading, setEmailChangeLoading] = useState(false);
  const [emailChangeError, setEmailChangeError] = useState('');
  const [emailChangeMessage, setEmailChangeMessage] = useState('');
  const [pendingEmailChange, setPendingEmailChange] = useState(null);

  const handleOpenPreferences = () => setPrefModalOpen(true);

  useEffect(() => {
    if (user?.email) {
      setEmailVerified(isEmailVerified(user.email));
    }
  }, [user?.email]);

  if (!user) {
    navigate('/login');
    return null;
  }

  const validateForm = () => {
    const errors = {};
    if (!form.firstName.trim()) {
      errors.firstName = 'First name is required';
    }
    if (form.phone.trim() && !/^\+?[0-9\s-]{8,15}$/.test(form.phone.trim())) {
      errors.phone = 'Please enter a valid phone number format (e.g. +91 98765 43210)';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  /* ── Save to Clerk ── */
  const handleSave = async () => {
    if (!validateForm()) {
      setSaveError('Please correct the highlighted fields before saving.');
      return;
    }

    setSaving(true);
    setSaveError('');
    setSaveOk(false);
    try {
      // Update name fields (standard Clerk fields)
      if (clerkUser?.update) {
        await clerkUser.update({
          firstName: form.firstName,
          lastName: form.lastName,
        });

        // Save extra fields in unsafeMetadata (no server-side required)
        await clerkUser.update({
          unsafeMetadata: {
            ...(clerkUser.unsafeMetadata || {}),
            phone: form.phone,
            city: form.city,
            state: form.state,
            occupation: form.occupation,
            bio: form.bio,
          },
        });
      }

      setSaveOk(true);
      setEditing(false);
      setFieldErrors({});
      setTimeout(() => setSaveOk(false), 3500);
    } catch (err) {
      logProviderError('Profile save failed', err);
      setSaveError(describeProviderError(err, 'Failed to save. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  /* ── Avatar upload ── */
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !clerkUser) return;
    setAvatarLoading(true);
    try {
      if (clerkUser.setProfileImage) {
        await clerkUser.setProfileImage({ file });
      }
    } catch (err) {
      logProviderError('Avatar upload failed', err);
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleEmailChangeRequest = async () => {
    if (!newEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())) {
      setEmailChangeError('Please enter a valid email address');
      return;
    }
    if (newEmail.trim().toLowerCase() === user.email.toLowerCase()) {
      setEmailChangeError('This is already your current email address');
      return;
    }
    setEmailChangeLoading(true);
    setEmailChangeError('');
    setEmailChangeMessage('');
    try {
      const response = await fetch('/api/email/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', email: newEmail.trim() }),
      });
      const data = await response.json();
      if (response.ok && data.sent) {
        setPendingEmailChange(newEmail.trim());
        setEmailChangeStep('verify');
        setEmailChangeMessage(data.message);
      } else {
        setEmailChangeError(data.message || data.error || 'Failed to send verification email');
      }
    } catch (err) {
      logProviderError('Email change request failed', err);
      setEmailChangeError('Network error. Please try again.');
    } finally {
      setEmailChangeLoading(false);
    }
  };

  const handleEmailChangeVerify = async (token) => {
    if (!token.trim()) {
      setEmailChangeError('Please enter the verification code');
      return;
    }
    setEmailChangeLoading(true);
    setEmailChangeError('');
    try {
      const response = await fetch('/api/email/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', token: token.trim() }),
      });
      const data = await response.json();
      if (response.ok && data.verified) {
        if (clerkUser?.update) {
          await clerkUser.update({ emailAddress: pendingEmailChange });
        }
        setEmailChangeStep('complete');
        setEmailChangeMessage('Email address updated successfully!');
        setEmailVerified(true);
        setTimeout(() => {
          setEmailChangeModalOpen(false);
          setEmailChangeStep('input');
          setNewEmail('');
          setPendingEmailChange(null);
          setEmailChangeMessage('');
        }, 2000);
      } else {
        setEmailChangeError(data.message || data.error || 'Invalid or expired verification code');
      }
    } catch (err) {
      logProviderError('Email change verification failed', err);
      setEmailChangeError('Network error. Please try again.');
    } finally {
      setEmailChangeLoading(false);
    }
  };

  const handleResendEmailChange = async () => {
    if (!pendingEmailChange) return;
    setEmailChangeLoading(true);
    setEmailChangeError('');
    setEmailChangeMessage('');
    try {
      const response = await fetch('/api/email/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resend', email: pendingEmailChange }),
      });
      const data = await response.json();
      if (response.ok && data.sent) {
        setEmailChangeMessage(data.message);
      } else {
        setEmailChangeError(data.message || data.error || 'Failed to resend verification email');
      }
    } catch (err) {
      logProviderError('Resend email change failed', err);
      setEmailChangeError('Network error. Please try again.');
    } finally {
      setEmailChangeLoading(false);
    }
  };

  const openEmailChangeModal = () => {
    setNewEmail('');
    setEmailChangeStep('input');
    setEmailChangeError('');
    setEmailChangeMessage('');
    setPendingEmailChange(null);
    setEmailChangeModalOpen(true);
  };

  let savedCount = 0;
  try {
    savedCount = JSON.parse(localStorage.getItem('civicbridge_saved') || '[]').length;
  } catch {
    savedCount = 0;
  }

  const displayName = `${form.firstName} ${form.lastName}`.trim() || user.username;
  const joinDate = clerkUser?.createdAt
    ? new Date(clerkUser.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : 'Recently';

  return (
    <div className="section animate-fade-in" style={{ paddingTop: '3rem', paddingBottom: '6rem' }}>
      <div className="container" style={{ maxWidth: '960px', position: 'relative', zIndex: 1 }}>
        {/* ── Page Header & Save Notification ── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '2rem',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                color: 'var(--accent-main)',
                fontSize: '0.8rem',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '0.35rem',
              }}
            >
              <ShieldCheck size={16} aria-hidden="true" />
              <span>Verified Citizen Profile</span>
            </div>
            <h1 style={{ fontSize: 'clamp(2rem, 4vw, 2.75rem)', fontWeight: '800', margin: 0 }}>
              Citizen Profile &amp; Preferences
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.98rem', marginTop: '0.35rem' }}>
              Manage your personal information, notification preferences, and privacy controls.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {saveOk && (
              <div
                role="status"
                aria-live="polite"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  color: '#10b981',
                  fontSize: '0.875rem',
                  fontWeight: '700',
                  padding: '0.4rem 0.85rem',
                  background: 'rgba(16, 185, 129, 0.1)',
                  borderRadius: '99px',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                }}
              >
                <Check size={16} aria-hidden="true" />
                <span>Changes saved successfully</span>
              </div>
            )}
            {!editing ? (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setShareModalOpen(true)}
                  className="btn btn-secondary"
                  style={{ padding: '0.6rem 1.15rem', fontSize: '0.9rem', borderRadius: '99px' }}
                >
                  <Share2 size={16} aria-hidden="true" />
                  <span>Share Profile</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(true);
                    setSaveError('');
                  }}
                  className="btn btn-primary"
                  style={{ padding: '0.6rem 1.25rem', fontSize: '0.9rem', borderRadius: '99px' }}
                >
                  <Edit3 size={16} aria-hidden="true" />
                  <span>Edit Profile</span>
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setSaveError('');
                    setFieldErrors({});
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.6rem 1.15rem',
                    borderRadius: '99px',
                    border: '1px solid var(--border-main)',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                  }}
                >
                  <X size={16} aria-hidden="true" />
                  <span>Cancel</span>
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="btn btn-primary"
                  style={{ padding: '0.6rem 1.35rem', fontSize: '0.9rem', borderRadius: '99px' }}
                >
                  {saving ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Check size={16} aria-hidden="true" />
                  )}
                  <span>{saving ? 'Saving changes…' : 'Save Changes'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Global Save Error Alert ── */}
        {saveError && (
          <div
            role="alert"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1.5rem',
              padding: '0.875rem 1.25rem',
              borderRadius: '0.875rem',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
            }}
          >
            <AlertCircle size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>{saveError}</span>
          </div>
        )}

        {/* ── Civic Entitlement Readiness & Document Gap Analyzer ── */}
        <CivicEntitlementReadinessCard profile={form} />

        {/* ── Main Two-Column Layout ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
            gap: '1.75rem',
            alignItems: 'start',
          }}
        >
          {/* ── Left Column: Avatar & Quick Actions ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Avatar Card */}
            <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', borderRadius: '1rem' }}>
              <div style={{ position: 'relative', display: 'inline-block', marginBottom: '1.25rem' }}>
                <div
                  style={{
                    width: '100px',
                    height: '100px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--accent-main), var(--grad-end, #6366f1))',
                    padding: '3px',
                    margin: '0 auto',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      background: 'var(--bg-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {user.imageUrl ? (
                      <img src={user.imageUrl} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <User size={44} color="var(--text-tertiary)" aria-hidden="true" />
                    )}
                  </div>
                </div>

                {/* Avatar change button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarLoading}
                  aria-label="Upload new profile photo"
                  title="Upload new profile photo"
                  style={{
                    position: 'absolute',
                    bottom: '2px',
                    right: '2px',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'var(--accent-main)',
                    border: '2px solid var(--bg-main)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  {avatarLoading ? (
                    <Loader2 size={14} color="#fff" className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Camera size={14} color="#fff" aria-hidden="true" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleAvatarChange}
                />
              </div>

              <h2 style={{ fontSize: '1.35rem', fontWeight: '800', marginBottom: '0.25rem', wordBreak: 'break-word' }}>
                {displayName}
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', wordBreak: 'break-all' }}>
                {user.email}
              </p>

              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.3rem 0.85rem',
                  borderRadius: '99px',
                  background: user.role === 'admin' ? 'rgba(56,189,248,0.12)' : 'rgba(52,211,153,0.1)',
                  color: user.role === 'admin' ? 'var(--accent-main)' : '#34d399',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  border: '1px solid',
                  borderColor: user.role === 'admin' ? 'rgba(56,189,248,0.3)' : 'rgba(52,211,153,0.25)',
                }}
              >
                <ShieldCheck size={14} aria-hidden="true" />
                <span>{user.role === 'admin' ? 'Admin' : 'Verified Citizen'}</span>
              </span>

              <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '1rem' }}>
                Member since {joinDate}
              </p>

              <div style={{ borderTop: '1px solid var(--border-light)', marginTop: '1.25rem', paddingTop: '1.25rem' }}>
                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: 'var(--text-tertiary)',
                    fontSize: '0.875rem',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    margin: '0 auto',
                    fontWeight: '600',
                  }}
                >
                  <LogOut size={15} aria-hidden="true" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <StatCard label="Saved Guides" value={savedCount} icon={BookMarked} color="#f59e0b" />
              <StatCard label="Auth Status" value="Active" icon={ShieldCheck} color="#10b981" />
            </div>

            {/* Quick Links */}
            <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '1rem' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                Quick Shortcuts
              </p>
              {[
                { to: '/vault', label: 'Document Vault', icon: FileText },
                { to: '/saved', label: 'Saved Guides', icon: BookMarked },
                { to: '/services', label: 'Browse Services', icon: Star },
              ].map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.5rem',
                    borderRadius: '0.5rem',
                    color: 'var(--text-secondary)',
                    fontSize: '0.9rem',
                    fontWeight: '500',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <Icon size={15} aria-hidden="true" />
                    <span>{label}</span>
                  </span>
                  <ChevronRight size={15} aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>

          {/* ── Right Column: Form Sections ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0 }}>
            {/* Section 1: Personal Identity */}
            <div className="glass-panel" style={{ padding: '1.75rem', borderRadius: '1rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '800', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <User size={18} color="var(--accent-main)" aria-hidden="true" />
                <span>Personal Information</span>
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '1rem' }}>
                <Field
                  icon={User}
                  label="First Name"
                  name="firstName"
                  value={form.firstName}
                  placeholder="Your first name"
                  editing={editing}
                  onChange={handleChange}
                  error={fieldErrors.firstName}
                  required={true}
                />
                <Field
                  icon={User}
                  label="Last Name"
                  name="lastName"
                  value={form.lastName}
                  placeholder="Your last name"
                  editing={editing}
                  onChange={handleChange}
                />
              </div>

              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                  <Field
                    icon={Mail}
                    label="Email Address"
                    name="email"
                    value={user.email}
                    placeholder="—"
                    editing={false}
                    onChange={() => {}}
                    helperText="Primary email used for account authentication"
                  />
                  {user.isClerk && !editing && (
                    <button
                      type="button"
                      onClick={openEmailChangeModal}
                      className="btn btn-secondary"
                      style={{
                        padding: '0.55rem 1rem',
                        fontSize: '0.85rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        borderRadius: '99px',
                        alignSelf: 'center',
                      }}
                    >
                      <Send size={14} aria-hidden="true" />
                      <span>Change Email</span>
                    </button>
                  )}
                </div>

                <Field
                  icon={Phone}
                  label="Phone Number"
                  name="phone"
                  type="tel"
                  value={form.phone}
                  placeholder="e.g. +91 98765 43210"
                  editing={editing}
                  onChange={handleChange}
                  error={fieldErrors.phone}
                  helperText="Used for SMS delivery updates and OTP verification"
                />
              </div>
            </div>

            {/* Section 2: Jurisdiction & Demographics */}
            <div className="glass-panel" style={{ padding: '1.75rem', borderRadius: '1rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '800', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MapPin size={18} color="var(--accent-main)" aria-hidden="true" />
                <span>Jurisdiction &amp; Demographics</span>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '1rem' }}>
                  <Field
                    icon={MapPin}
                    label="City / District"
                    name="city"
                    value={form.city}
                    placeholder="e.g. Mumbai"
                    editing={editing}
                    onChange={handleChange}
                  />
                  <Field
                    icon={MapPin}
                    label="State / Union Territory"
                    name="state"
                    value={form.state}
                    placeholder="e.g. Maharashtra"
                    editing={editing}
                    onChange={handleChange}
                  />
                </div>
                <Field
                  icon={Briefcase}
                  label="Occupation / Sector"
                  name="occupation"
                  value={form.occupation}
                  placeholder="e.g. Government Employee, Student, Self-Employed"
                  editing={editing}
                  onChange={handleChange}
                  helperText="Helps filter scheme eligibility (e.g. welfare subsidies and scholarships)"
                />
              </div>
            </div>

            {/* Section 3: Private Citizen Notes */}
            <div className="glass-panel" style={{ padding: '1.75rem', borderRadius: '1rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '800', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit3 size={18} color="var(--accent-main)" aria-hidden="true" />
                <span>Private Notes &amp; Bio</span>
              </h3>
              {editing ? (
                <div>
                  <textarea
                    id="profile-bio-textarea"
                    name="bio"
                    value={form.bio}
                    onChange={handleChange}
                    placeholder="Private notes about pending documents or application history (visible only to you)…"
                    rows={4}
                    style={{
                      width: '100%',
                      background: 'var(--bg-main)',
                      border: '1px solid var(--border-light)',
                      borderRadius: '0.875rem',
                      padding: '0.875rem 1rem',
                      color: 'var(--text-primary)',
                      fontSize: '0.95rem',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      outline: 'none',
                      lineHeight: '1.6',
                    }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.35rem', display: 'block' }}>
                    Notes are encrypted and stored within your private Clerk metadata.
                  </span>
                </div>
              ) : (
                <p
                  style={{
                    color: form.bio ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    fontSize: '0.95rem',
                    lineHeight: '1.7',
                    whiteSpace: 'pre-wrap',
                    margin: 0,
                  }}
                >
                  {form.bio || 'Click "Edit Profile" above to record private notes about your civic applications.'}
                </p>
              )}
            </div>

            {/* Section 4: Security & Notification Preferences */}
            <div className="glass-panel" style={{ padding: '1.75rem', borderRadius: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Bell size={18} color="#f59e0b" aria-hidden="true" />
                  <span>Notification Preferences</span>
                </h3>
                <button
                  type="button"
                  onClick={handleOpenPreferences}
                  className="btn btn-secondary"
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.85rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    borderRadius: '99px',
                  }}
                >
                  <Shield size={15} aria-hidden="true" />
                  <span>Manage Preferences</span>
                </button>
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                Configure email lifecycle alerts for application tracking, expiration reminders, and statutory deadlines.
              </p>
            </div>

            {/* Section 5: Data Portability & Privacy Controls */}
            <div className="glass-panel" style={{ padding: '1.75rem', borderRadius: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                    Citizen Data Portability
                  </h3>
                  <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Export a machine-readable JSON or CSV archive of your saved guides, checklists, reminders, and draft notes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setExportModalOpen(true)}
                  className="btn btn-secondary"
                  style={{
                    padding: '0.55rem 1.15rem',
                    fontSize: '0.85rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    borderRadius: '99px',
                  }}
                >
                  <Download size={15} aria-hidden="true" />
                  <span>Export My Data</span>
                </button>
              </div>
            </div>

            <VoluntaryProfileRecommendationPanel onUpdate={() => setDataVersion((v) => v + 1)} />

            <ClearMyDataPanel onCleared={() => setDataVersion((v) => v + 1)} />
          </div>
        </div>
      </div>

      <NotificationPreferenceCenter
        isOpen={prefModalOpen}
        onClose={() => setPrefModalOpen(false)}
        userEmail={user.email}
      />

      <DataPortabilityModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        currentUser={user}
      />

      <ShareableProfileModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        currentUser={user}
        profileData={{
          fullName: `${form.firstName} ${form.lastName}`.trim() || user?.username,
          state: form.state,
          district: form.city,
          occupation: form.occupation,
          savedServices: [],
          applications: [],
        }}
      />
    </div>
  );
};

export default Profile;
