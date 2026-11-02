import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Shield, Menu, X, LogOut, User, Sun, Moon, WifiOff, Wifi, HardDrive, PhoneCall, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { can } from '../services/accessControl';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useNetwork } from '../context/NetworkContext';
import LanguageSwitcher from './LanguageSwitcher';
import PlainLanguageToggle from './common/PlainLanguageToggle';
import FocusModeNavToggle from './common/FocusModeNavToggle';
import OfflineCacheStatusModal from './common/OfflineCacheStatusModal';
import EmergencyHelplineModal from './emergency/EmergencyHelplineModal';
import VoiceSearchInput from './common/VoiceSearchInput';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [showSosModal, setShowSosModal] = useState(false);
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const { isOnline } = useNetwork();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isServiceDetail = /^\/services\/[^/]+/.test(pathname);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };
  
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1440) {
        setIsOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <nav id="site-navigation" aria-label="Main Navigation" tabIndex="-1" className="nav-glass animate-fade-in">
      <div className="container flex-between nav-container" style={{ height: '100%' }}>
        <Link to="/" className="nav-brand" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: '800', fontSize: 'clamp(1.1rem, 5vw, 1.5rem)', color: 'var(--text-primary)', minWidth: 0 }}>
          <div className="nav-brand__logo" style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={20} color="var(--bg-main)" fill="currentColor" />
          </div>
          <span className="nav-brand__text" style={{ letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('nav.brand', 'CivicBridge')}</span>
        </Link>

        {/* Desktop Nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div className="desktop-links" style={{ display: 'none', alignItems: 'center', gap: '0.5rem'}}>
          <Link to="/services" className="nav-link">{t('nav.services', 'Services')}</Link>
          <Link to="/acronyms" className="nav-link">Acronyms</Link>
          <Link to="/eligibility" className="nav-link">Eligibility</Link>
          <Link to="/nearby" className="nav-link">{t('nav.nearby', 'Nearby Centers')}</Link>
          <Link to="/track" className="nav-link">{t('nav.track', 'Track Status')}</Link>
          <Link to="/assistant" className="nav-link">{t('nav.assistant', 'AI Assistant')}</Link>
          {user && <Link to="/vault" className="nav-link">{t('nav.vault', 'Doc Vault')}</Link>}
          <div style={{ width: '1px', height: '20px', background: 'var(--border-main)', margin: '0 0.5rem' }}></div>

          <PlainLanguageToggle />
          {isServiceDetail && <FocusModeNavToggle />}
          <LanguageSwitcher />
          </div>

          {/* Offline Status Badge */}
          <div className="tablet-tools" style={{ alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setShowOfflineModal(true)}
            style={{
              padding: '0.3rem 0.65rem',
              background: isOnline ? 'var(--glass-bg)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${isOnline ? 'var(--border-main)' : 'rgba(239, 68, 68, 0.35)'}`,
              borderRadius: '99px',
              color: isOnline ? 'var(--text-secondary)' : '#ef4444',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.75rem',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
            title={isOnline ? 'Network Online - Click for Offline Office Cache' : 'Offline Mode Active'}
          >
            {isOnline ? (
              <>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                <span>Online</span>
              </>
            ) : (
              <>
                <WifiOff size={13} />
                <span>Offline</span>
              </>
            )}
          </button>

          {/* Emergency SOS Button */}
          <button
            type="button"
            onClick={() => setShowSosModal(true)}
            style={{
              padding: '0.35rem 0.65rem',
              borderRadius: '999px',
              border: '1px solid #ef4444',
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
              fontSize: '0.78rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
            title="Rapid Emergency Helplines (112, 1930, 1091)"
          >
            <PhoneCall size={13} />
            <span>SOS</span>
          </button>

          <VoiceSearchInput
            onTranscript={(transcript) => {
              navigate(`/services?q=${encodeURIComponent(transcript)}`);
            }}
            onServiceMatched={(match) => {
              if (match.targetServiceId) {
                navigate(`/services/${match.targetServiceId}`);
              }
            }}
          />
          </div>
          <div className="nav-mobile-actions" style={{ display: 'inline-flex', alignItems: 'center' }}>
            <LanguageSwitcher variant="mobile" />
          </div>

          <button 
            type="button"
            onClick={toggleTheme} 
            className="top-navbar-theme-btn"
            style={{ padding: '0.4rem', background: 'var(--glass-bg-hover)', borderRadius: '50%', color: 'var(--text-primary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {!user ? (
            <Link to="/login" className="btn btn-primary desktop-links" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap', padding: '0.5rem 1.25rem', fontSize: '0.9rem', marginLeft: '0.5rem', textDecoration: 'none' }}>
              {t('nav.signIn', 'Sign In')}
            </Link>
          ) : (
            <div className="desktop-links" style={{ display: 'none', alignItems: 'center', gap: '0.75rem', marginLeft: '0.25rem' }}>
              {can('users.read', user) && (
                <Link to="/admin" className="nav-link" style={{ color: 'var(--accent-main)', fontWeight: '600' }}>
                  {t('nav.admin', 'Admin Portal')}
                </Link>
              )}

              <Link
                to="/profile"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.85rem', background: 'var(--glass-bg)', borderRadius: '99px', border: '1px solid var(--border-light)', fontSize: '0.875rem', transition: 'border-color 0.2s', textDecoration: 'none' }}
                onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent-main)'}
                onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border-light)'}
              >
                {user.imageUrl ? (
                  <img
                    src={user.imageUrl}
                    alt={user.username}
                    style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <User size={14} color="var(--accent-main)" />
                )}
                <span style={{ color: 'var(--text-primary)', fontWeight: '600', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.username}
                </span>
                <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.45rem', borderRadius: '99px', background: user.role === 'admin' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(52, 211, 153, 0.15)', color: user.role === 'admin' ? 'var(--accent-main)' : 'var(--success)' }}>
                  {user.role === 'admin' ? t('common.admin', 'Admin') : t('common.citizen', 'Citizen')}
                </span>
              </Link>

              <button
                onClick={handleLogout}
                style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.5rem', background: 'transparent', border: 'none', transition: 'color 0.2s' }}
                title={t('nav.signOut', 'Sign Out')}
                onMouseOver={(e) => e.currentTarget.style.color = 'var(--error)'}
                onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
              >
                <LogOut size={20} />
              </button>
            </div>
          )}

          {/* Hamburger Menu Toggle (Always Visible) */}
          <button 
            className="hamburger-toggle-btn" 
            style={{ padding: '0.4rem', background: 'var(--glass-bg-hover)', borderRadius: '50%', color: 'var(--text-primary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}  
            onClick={() => setIsOpen(!isOpen)} 
            aria-label="Toggle Menu"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu / Drawer Dropdown */}
      {isOpen && (
        <div className="mobile-drawer-dropdown" style={{ background: 'var(--bg-secondary)', padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '1px solid var(--border-main)', maxHeight: 'calc(100vh - 5rem)', overflowY: 'auto', width: '100%', maxWidth: '450px', marginLeft: 'auto' }}>
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-main)' }}>
              {user.imageUrl ? (
                <img src={user.imageUrl} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%',  objectFit: 'cover' }} />
              ) : (
                <User size={20} color="var(--accent-main)" />
              )}
              <div>
                <p style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{user.username}</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{user.email || user.role}</p>
              </div>
            </div>
          )}

          {/* Mobile Utilities Section */}
          <div className="mobile-only-tools" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', width: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.4rem', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => { setShowSosModal(true); setIsOpen(false); }}
                style={{
                  padding: '0.4rem 0.5rem',
                  borderRadius: '99px',
                  border: '1px solid #ef4444',
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: '#ef4444',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.3rem',
                }}
              >
                <PhoneCall size={13} />
                <span>SOS</span>
              </button>

              <button
                type="button"
                onClick={() => { setShowOfflineModal(true); setIsOpen(false); }}
                style={{
                  padding: '0.4rem 0.5rem',
                  borderRadius: '99px',
                  border: `1px solid ${isOnline ? 'var(--border-main)' : 'rgba(239, 68, 68, 0.35)'}`,
                  background: isOnline ? 'var(--glass-bg)' : 'rgba(239, 68, 68, 0.15)',
                  color: isOnline ? 'var(--text-secondary)' : '#ef4444',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.3rem'
                }}
              >
                {isOnline ? (
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                ) : (
                  <WifiOff size={13} style={{ color: '#ef4444' }} />
                )}
                <span>{isOnline ? 'Online' : 'Offline'}</span>
              </button>
              <button 
                type="button"
                onClick={toggleTheme} 
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '0.3rem', 
                  padding: '0.4rem 0.7rem', 
                  background: 'var(--glass-bg)', 
                  border: '1px solid var(--border-main)', 
                  borderRadius: '99px', 
                  color: 'var(--text-primary)', 
                  cursor: 'pointer', 
                  fontSize: '0.75rem', 
                  fontWeight: '600',
                  whiteSpace: 'nowrap'
                }} 
                title="Toggle Theme">
                {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
                <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
              </button>
              <div style={{ width: '100%', minWidth: 0 }}>
                <VoiceSearchInput
                  onTranscript={(transcript) => {
                    setIsOpen(false);
                    navigate(`/services?q=${encodeURIComponent(transcript)}`);
                  }}
                  onServiceMatched={(match) => {
                    if (match.targetServiceId) {
                      setIsOpen(false);
                      navigate(`/services/${match.targetServiceId}`);
                    }
                  }}
                />
              </div>
            </div>
          </div>

          <div className="drawer-accessibility-panel" style={{flexDirection: 'column', gap: '0.5rem', width: '100%', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-main)' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', width: '100%' }}>
              <PlainLanguageToggle />
              {isServiceDetail && <FocusModeNavToggle />}
            </div>
          </div>

          <div className="mobile-only-links" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Link to="/services" onClick={() => setIsOpen(false)} style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--text-primary)' }}>{t('nav.services', 'Services')}</Link>
            <Link to="/acronyms" onClick={() => setIsOpen(false)} style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--text-primary)' }}>Acronyms</Link>
            <Link to="/eligibility" onClick={() => setIsOpen(false)} style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--text-primary)' }}>Eligibility Checker</Link>
            <Link to="/nearby" onClick={() => setIsOpen(false)} style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--text-primary)' }}>{t('nav.nearby', 'Nearby Centers')}</Link>
            <Link to="/track" onClick={() => setIsOpen(false)} style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--text-primary)' }}>{t('nav.track', 'Track Status')}</Link>
            <Link to="/assistant" onClick={() => setIsOpen(false)} style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--text-primary)' }}>{t('nav.assistant', 'AI Assistant')}</Link>
            {user && <Link to="/vault" onClick={() => setIsOpen(false)} style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--text-primary)' }}>{t('nav.vault', 'Document Vault')}</Link>}
            {user && <Link to="/saved" onClick={() => setIsOpen(false)} style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--text-primary)' }}>{t('nav.saved', 'Saved Guides')}</Link>}
            {user && <Link to="/profile" onClick={() => setIsOpen(false)} style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--text-primary)' }}>{t('nav.profile', 'My Profile')}</Link>}
            {user && can('users.read', user) && <Link to="/admin" onClick={() => setIsOpen(false)} style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--accent-main)' }}>{t('nav.admin', 'Admin Portal')}</Link>}
          </div>

          {!user ? (
            <Link to="/login" onClick={() => setIsOpen(false)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.65rem 1rem', fontSize: '0.95rem', fontWeight: '600', borderRadius: '0.5rem', textDecoration: 'none', width: '100%' }}>{t('nav.signIn', 'Sign In')}</Link>
          ) : (
            <button onClick={() => { handleLogout(); setIsOpen(false); }} style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--error)', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '0.5rem', padding: '0.6rem 1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%' }}>{t('nav.signOut', 'Sign Out')}</button>
          )}
        </div>
      )}

      <style>{`
        .tablet-tools { display: none !important; }
        .desktop-links { display: none !important; }
        .mobile-only-tools { display: flex !important; }
        .mobile-only-links { display: flex !important; }
        .top-navbar-theme-btn { display: inline-flex !important; }
        .hamburger-toggle-btn { display: flex !important; }

        @media (max-width: 767px) {
          .top-navbar-theme-btn { display: none !important; }
        }
        /* Tablet Viewport (768px to 1439px) */
        @media (min-width: 768px) {
          .tablet-tools { display: flex !important; gap: 0.5rem !important; align-items: center; }
          .mobile-only-tools { display: none !important; }
        }
        /* Desktop Viewport (1440px and above) */
        @media (min-width: 1440px) {
          .tablet-tools { display: flex !important; gap: 0.5rem !important; align-items: center; }
          .desktop-links { display: flex !important; gap: 0.5rem !important; align-items: center; }
          .mobile-only-tools { display: none !important; }
        }
      `}</style>

      {/* Offline Cache Status Modal */}
      <OfflineCacheStatusModal
        isOpen={showOfflineModal}
        onClose={() => setShowOfflineModal(false)}
      />

      {/* 24x7 Emergency SOS Modal */}
      <EmergencyHelplineModal
        isOpen={showSosModal}
        onClose={() => setShowSosModal(false)}
      />
    </nav>
  );
};

export default Navbar;
