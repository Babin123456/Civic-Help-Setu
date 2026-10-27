import { useState, useRef, useEffect } from 'react';
import {
  User, Mail, Phone, MapPin, Briefcase, Edit3, Check, X,
  Camera, ShieldCheck, LogOut, Star, FileText, BookMarked,
  ChevronRight, Loader2, AlertCircle, ExternalLink,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { describeProviderError, logProviderError } from '../utils/providerError';
import ClearMyDataPanel from '../components/privacy/ClearMyDataPanel';

/* ─────────────────────────── helpers ─────────────────────────── */
const Field = ({ icon: Icon, label, value, placeholder, editing, name, onChange, type = 'text' }) => (
  <div style={{
    display: 'flex', alignItems: 'flex-start', gap: '1rem',
    padding: '1rem 1.25rem',
    background: 'var(--glass-bg)',
    borderRadius: '0.875rem',
    border: '1px solid var(--border-light)',
    transition: 'border-color 0.2s',
  }}>
    <div style={{
      width: '2.25rem', height: '2.25rem', borderRadius: '0.65rem',
      background: 'var(--accent-light)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '0.1rem',
    }}>
      <Icon size={16} color="var(--accent-main)" />
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
        {label}
      </p>
      {editing ? (
        <input
          type={type}
          name={name}
          value={value}
          placeholder={placeholder}
          onChange={onChange}
          style={{
            width: '100%', background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text-primary)', fontSize: '0.975rem', fontFamily: 'inherit',
            borderBottom: '1px solid var(--accent-main)', paddingBottom: '2px',
          }}
        />
      ) : (
        <p style={{
          color: value ? 'var(--text-primary)' : 'var(--text-tertiary)',
          fontSize: '0.975rem', fontWeight: value ? '500' : '400',
        }}>
          {value || placeholder}
        </p>
      )}
    </div>
  </div>
);

const StatCard = ({ label, value, icon: Icon, color }) => (
  <div style={{
    padding: '1.25rem', background: 'var(--glass-bg)',
    borderRadius: '1rem', border: '1px solid var(--border-light)',
    display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1,
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <Icon size={16} color={color || 'var(--accent-main)'} />
    </div>
    <p style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', lineHeight: 1 }}>{value}</p>
  </div>
);

/* ─────────────────────────── component ─────────────────────────── */
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
  // Bumped after "Clear my data" so counts read from localStorage (Saved Guides) refresh
  const [, setDataVersion] = useState(0);

  const [form, setForm] = useState({
    firstName: clerkUser?.firstName || '',
    lastName: clerkUser?.lastName || '',
    phone: meta.phone || '',
    city: meta.city || '',
    state: meta.state || '',
    occupation: meta.occupation || '',
    bio: meta.bio || '',
  });

  // Re-seed if clerkUser loads after mount
  useEffect(() => {
    if (clerkUser) {
      const m = clerkUser.unsafeMetadata || {};
      setForm({
        firstName: clerkUser.firstName || '',
        lastName: clerkUser.lastName || '',
        phone: m.phone || '',
        city: m.city || '',
        state: m.state || '',
        occupation: m.occupation || '',
        bio: m.bio || '',
      });
    }
  }, [clerkUser?.id]);

  if (!user) {
    navigate('/login');
    return null;
  }

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  /* ── Save to Clerk ── */
  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    setSaveOk(false);
    try {
      // Update name fields (standard Clerk fields)
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

      setSaveOk(true);
      setEditing(false);
      setTimeout(() => setSaveOk(false), 3000);
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
      await clerkUser.setProfileImage({ file });
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

  const savedCount = JSON.parse(localStorage.getItem('civicbridge_saved') || '[]').length;
  const displayName = `${form.firstName} ${form.lastName}`.trim() || user.username;
  const joinDate = clerkUser?.createdAt
    ? new Date(clerkUser.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : 'Recently';

  return (
    <div className="section animate-fade-in" style={{ paddingTop: '4rem', paddingBottom: '6rem' }}>

      {/* Background glow */}
      <div className="glow-blob" style={{
        width: '600px', height: '600px',
        background: 'radial-gradient(circle, rgba(56,189,248,0.18) 0%, rgba(129,140,248,0.12) 60%, transparent 100%)',
        top: '0', left: '50%', transform: 'translateX(-50%)', opacity: 1,
      }} />

      <div className="container" style={{ maxWidth: '900px', position: 'relative', zIndex: 1 }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '0.25rem' }}>My Profile</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
              Your civic identity — stored securely via Clerk
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {saveOk && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', fontSize: '0.875rem', fontWeight: '600' }}>
                <Check size={16} /> Saved to Clerk
              </span>
            )}
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="btn btn-secondary"
                style={{ padding: '0.6rem 1.25rem', fontSize: '0.9rem' }}
              >
                <Edit3 size={16} /> Edit Profile
              </button>
            ) : (
              <>
                <button
                  onClick={() => { setEditing(false); setSaveError(''); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.1rem', borderRadius: '99px', border: '1px solid var(--border-main)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.9rem' }}
                >
                  <X size={16} /> Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn btn-primary"
                  style={{ padding: '0.6rem 1.25rem', fontSize: '0.9rem' }}
                >
                  {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={16} />}
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Error Banner ── */}
        {saveError && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem',
            padding: '0.875rem 1.25rem', borderRadius: '0.875rem',
            background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)',
            color: 'var(--error, #f87171)',
          }}>
            <AlertCircle size={18} />
            <span style={{ fontSize: '0.9rem' }}>{saveError}</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '2rem', alignItems: 'start' }}>

          {/* ── Left column: Avatar + quick info ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Avatar card */}
            <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', position: 'relative' }}>
              {/* Avatar */}
              <div style={{ position: 'relative', display: 'inline-block', marginBottom: '1.25rem' }}>
                <div style={{
                  width: '96px', height: '96px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--accent-main), var(--grad-end))',
                  padding: '3px', margin: '0 auto',
                }}>
                  <div style={{
                    width: '100%', height: '100%', borderRadius: '50%',
                    overflow: 'hidden', background: 'var(--bg-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {user.imageUrl ? (
                      <img src={user.imageUrl} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <User size={40} color="var(--text-tertiary)" />
                    )}
                  </div>
                </div>

                {/* Camera button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarLoading}
                  title="Change photo"
                  style={{
                    position: 'absolute', bottom: '2px', right: '2px',
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: 'var(--accent-main)', border: '2px solid var(--bg-main)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  }}
                >
                  {avatarLoading ? <Loader2 size={12} color="#fff" style={{ animation: 'spin 1s linear infinite' }} /> : <Camera size={12} color="#fff" />}
                </button>
                <input
                  ref={fileInputRef} type="file"
                  accept="image/*" style={{ display: 'none' }}
                  onChange={handleAvatarChange}
                />
              </div>

              {/* Name & role */}
              <h2 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '0.25rem', wordBreak: 'break-word' }}>
                {displayName}
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', wordBreak: 'break-all' }}>
                {user.email}
              </p>

              {/* Role badge */}
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.3rem 0.85rem', borderRadius: '99px',
                background: user.role === 'admin' ? 'rgba(56,189,248,0.12)' : 'rgba(52,211,153,0.1)',
                color: user.role === 'admin' ? 'var(--accent-main)' : '#34d399',
                fontSize: '0.8rem', fontWeight: '700', border: '1px solid',
                borderColor: user.role === 'admin' ? 'rgba(56,189,248,0.3)' : 'rgba(52,211,153,0.25)',
              }}>
                <ShieldCheck size={13} />
                {user.role === 'admin' ? 'Admin' : 'Verified Citizen'}
              </span>

              <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '1rem' }}>
                Member since {joinDate}
              </p>

              <div style={{ borderTop: '1px solid var(--border-light)', marginTop: '1.25rem', paddingTop: '1.25rem' }}>
                <button
                  onClick={handleLogout}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    color: 'var(--text-tertiary)', fontSize: '0.875rem', background: 'none', border: 'none',
                    cursor: 'pointer', margin: '0 auto', transition: 'color 0.2s',
                  }}
                  onMouseOver={e => e.currentTarget.style.color = '#f87171'}
                  onMouseOut={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
                >
                  <LogOut size={15} /> Sign out
                </button>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <StatCard label="Saved Guides" value={savedCount} icon={BookMarked} color="#f59e0b" />
              <StatCard label="Clerk Auth" value="Active" icon={ShieldCheck} color="#10b981" />
            </div>

            {/* Quick links */}
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Quick Links</p>
              {[
                { to: '/vault', label: 'Document Vault', icon: FileText },
                { to: '/saved', label: 'Saved Guides', icon: BookMarked },
                { to: '/services', label: 'Browse Services', icon: Star },
              ].map(({ to, label, icon: Icon }) => (
                <Link
                  key={to} to={to}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.6rem 0.5rem', borderRadius: '0.6rem', color: 'var(--text-secondary)',
                    fontSize: '0.9rem', fontWeight: '500', transition: 'all 0.2s',
                  }}
                  onMouseOver={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--glass-bg-hover)'; }}
                  onMouseOut={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <Icon size={15} /> {label}
                  </span>
                  <ChevronRight size={15} />
                </Link>
              ))}
            </div>
          </div>

          {/* ── Right column: Editable fields ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Personal Info */}
            <div className="glass-panel" style={{ padding: '2rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <User size={18} color="var(--accent-main)" /> Personal Information
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <Field
                  icon={User} label="First Name" name="firstName"
                  value={form.firstName} placeholder="Your first name"
                  editing={editing} onChange={handleChange}
                />
                <Field
                  icon={User} label="Last Name" name="lastName"
                  value={form.lastName} placeholder="Your last name"
                  editing={editing} onChange={handleChange}
                />
              </div>
              <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <Field
                  icon={Mail} label="Email Address" name="email"
                  value={user.email} placeholder="—"
                  editing={false} onChange={() => {}}
                />
                <Field
                  icon={Phone} label="Phone Number" name="phone" type="tel"
                  value={form.phone} placeholder="e.g. +91 98765 43210"
                  editing={editing} onChange={handleChange}
                />
              </div>
            </div>

            {/* Location & Occupation */}
            <div className="glass-panel" style={{ padding: '2rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MapPin size={18} color="var(--accent-main)" /> Location & Occupation
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <Field
                    icon={MapPin} label="City" name="city"
                    value={form.city} placeholder="e.g. Mumbai"
                    editing={editing} onChange={handleChange}
                  />
                  <Field
                    icon={MapPin} label="State" name="state"
                    value={form.state} placeholder="e.g. Maharashtra"
                    editing={editing} onChange={handleChange}
                  />
                </div>
                <Field
                  icon={Briefcase} label="Occupation" name="occupation"
                  value={form.occupation} placeholder="e.g. Government Employee, Student…"
                  editing={editing} onChange={handleChange}
                />
              </div>
            </div>

            {/* Bio */}
            <div className="glass-panel" style={{ padding: '2rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit3 size={18} color="var(--accent-main)" /> About Me
              </h3>
              {editing ? (
                <textarea
                  name="bio"
                  value={form.bio}
                  onChange={handleChange}
                  placeholder="A short note about yourself (visible only to you)…"
                  rows={4}
                  style={{
                    width: '100%', background: 'var(--glass-bg)', border: '1px solid var(--border-main)',
                    borderRadius: '0.875rem', padding: '0.875rem 1rem',
                    color: 'var(--text-primary)', fontSize: '0.975rem', fontFamily: 'inherit',
                    resize: 'vertical', outline: 'none', lineHeight: '1.6',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                  onFocus={e => { e.target.style.borderColor = 'var(--accent-main)'; e.target.style.boxShadow = '0 0 0 3px rgba(56,189,248,0.15)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border-main)'; e.target.style.boxShadow = 'none'; }}
                />
              ) : (
                <p style={{
                  color: form.bio ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  fontSize: '0.975rem', lineHeight: '1.7', whiteSpace: 'pre-wrap',
                }}>
                  {form.bio || 'Click "Edit Profile" to add a bio.'}
                </p>
              )}
            </div>

            {/* Account info */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                Account Details
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
                {[
                  { label: 'Clerk User ID', value: user.id },
                  { label: 'Auth Provider', value: user.isClerk ? 'Clerk (OAuth / Email)' : 'Local' },
                  { label: 'Role', value: user.role === 'admin' ? 'Administrator' : 'Citizen' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border-light)' }}>
                    <span style={{ color: 'var(--text-tertiary)', fontWeight: '500' }}>{label}</span>
                    <span style={{
                      color: 'var(--text-secondary)', fontFamily: label === 'Clerk User ID' ? 'monospace' : 'inherit',
                      fontSize: label === 'Clerk User ID' ? '0.75rem' : '0.875rem',
                      maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{value}</span>
                  </div>
                ))}
              </div>
              <a
                href="https://dashboard.clerk.com"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-tertiary)',
                  transition: 'color 0.2s',
                }}
                onMouseOver={e => e.currentTarget.style.color = 'var(--accent-main)'}
                onMouseOut={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
              >
                <ExternalLink size={13} /> Manage account on Clerk Dashboard
              </a>
            </div>

            <ClearMyDataPanel onCleared={() => setDataVersion((v) => v + 1)} />

          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .profile-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
};

export default Profile;
