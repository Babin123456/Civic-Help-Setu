import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Shield,
  Menu,
  X,
  User,
  Sun,
  Moon,
  WifiOff,
  PhoneCall,
  Mic,
  ChevronRight,
  LogOut,
  Home,
  BookOpen,
  MapPin,
  FileText,
  Users,
  Bot,
  Bookmark,
  UserCircle,
  Settings,
  AlertTriangle,
  Navigation,
  Droplets,
  KeyRound,
  Store,
  Trees
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { can } from '../services/accessControl';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useNetwork } from '../context/NetworkContext';
import { logDiagnostic } from '../utils/diagnostics';

import LanguageSwitcher from './LanguageSwitcher';
import PlainLanguageToggle from './common/PlainLanguageToggle';
import FocusModeNavToggle from './common/FocusModeNavToggle';
import OfflineCacheStatusModal from './common/OfflineCacheStatusModal';
import EmergencyHelplineModal from './emergency/EmergencyHelplineModal';
import VoiceSearchInput from './common/VoiceSearchInput';
import MultilingualVoiceNavigationModal from './navigation/MultilingualVoiceNavigationModal';

const Navbar = ({ initialOpen = false, defaultOpen } = {}) => {
  const [isOpen, setIsOpen] = useState(
    defaultOpen !== undefined ? defaultOpen : initialOpen
  );

  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [showSosModal, setShowSosModal] = useState(false);
  const [showVoiceNavModal, setShowVoiceNavModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const drawerRef = useRef(null);
  const menuButtonRef = useRef(null);

  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const { isOnline } = useNetwork();

  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isServiceDetail = /^\/services\/[^/]+/.test(pathname);

  // Normalize paths to avoid trailing-slash inconsistencies.
  const normalizePath = useCallback((path) => {
    if (path.length > 1 && path.endsWith('/')) {
      return path.slice(0, -1);
    }

    return path;
  }, []);

  const normalizedPath = normalizePath(pathname);

  // Active navigation state.
  const isNavActive = useCallback(
    (target) => {
      const normalizedTarget = normalizePath(target);

      if (normalizedTarget === '/services') {
        return (
          normalizedPath === '/services' ||
          isServiceDetail
        );
      }

      if (normalizedTarget === '/nearby') {
        return (
          normalizedPath === '/nearby' ||
          normalizedPath === '/nearby-offices'
        );
      }

      if (normalizedTarget === '/tenders') {
        return (
          normalizedPath === '/tenders' ||
          normalizedPath === '/tender-readiness'
        );
      }

      if (normalizedTarget === '/rental-checklist') {
        return (
          normalizedPath === '/rental-checklist' ||
          normalizedPath === '/rental-transition' ||
          normalizedPath === '/rental-records'
        );
      }

      if (normalizedTarget === '/address-change-planner') {
        return (
          normalizedPath === '/address-change-planner' ||
          normalizedPath === '/address-change' ||
          normalizedPath === '/move-planner'
        );
      }

      if (normalizedTarget === '/ward-budget') {
        return (
          normalizedPath === '/ward-budget' ||
          normalizedPath === '/services/ward-budget-proposal' ||
          normalizedPath.startsWith('/ward-budget/')
        );
      }

      if (normalizedTarget === '/road-safety') {
        return (
          normalizedPath === '/road-safety' ||
          normalizedPath === '/blackspots' ||
          normalizedPath.startsWith('/road-safety/')
        );
      }

      if (normalizedTarget === '/admin') {
        return (
          normalizedPath === '/admin' ||
          normalizedPath.startsWith('/admin/')
        );
      }

      if (normalizedTarget === '/login') {
        return (
          normalizedPath === '/login' ||
          normalizedPath.startsWith('/login/')
        );
      }

      return normalizedPath === normalizedTarget;
    },
    [normalizedPath, isServiceDetail, normalizePath]
  );

  // Close drawer whenever the route changes.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setIsOpen(false);
  }

  // Close drawer on Escape and lock background scrolling.
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Close the drawer when transitioning to a desktop viewport.
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1440) {
        setIsOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Keep focus inside the drawer while it is open.
  useEffect(() => {
    if (isOpen) {
      const firstFocusable = drawerRef.current?.querySelector(
        'a[href], button:not([disabled]), input:not([disabled])'
      );

      firstFocusable?.focus();
    }
  }, [isOpen]);

  // Safe logout handling.
  const handleLogout = async () => {
    if (isLoggingOut) return;

    try {
      setIsLoggingOut(true);

      await logout();

      setIsOpen(false);
      navigate('/login', { replace: true });
    } catch (error) {
      logDiagnostic('Logout failed', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Navigation link component.
  const renderNavLink = ({
    to,
    label,
    icon: Icon,
    activeTarget,
    className = '',
    style = {},
    admin = false
  }) => {
    const active = isNavActive(activeTarget || to);

    return (
      <Link
        key={to}
        to={to}
        onClick={() => setIsOpen(false)}
        className={`nav-drawer-link ${className} ${
          active ? 'is-active' : ''
        }`}
        aria-current={active ? 'page' : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          fontSize: '1rem',
          fontWeight: active ? '700' : '600',
          color: admin
            ? 'var(--accent-main)'
            : 'var(--text-primary)',
          textDecoration: 'none',
          padding: '0.7rem 0.85rem',
          borderRadius: '0.65rem',
          transition: 'background 0.2s ease, color 0.2s ease',
          ...style
        }}
      >
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            minWidth: 0
          }}
        >
          {Icon && (
            <Icon
              size={19}
              strokeWidth={1.8}
              aria-hidden="true"
            />
          )}

          <span>{label}</span>
        </span>

        {active ? (
          <span
            className="nav-drawer-indicator"
            aria-hidden="true"
          />
        ) : (
          <ChevronRight
            size={15}
            color="var(--text-tertiary)"
            aria-hidden="true"
          />
        )}
      </Link>
    );
  };

  return (
    <nav
      id="site-navigation"
      aria-label="Main Navigation"
      tabIndex="-1"
      className="nav-glass animate-fade-in"
    >
      {/* HEADER */}
      <div
        className="container flex-between nav-container"
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem'
        }}
      >
        {/* BRAND */}
        <Link
          to="/"
          className="nav-brand"
          aria-label="Civic Help Setu Home"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontWeight: '800',
            fontSize: 'clamp(1.1rem, 5vw, 1.5rem)',
            color: 'var(--text-primary)',
            minWidth: 0,
            textDecoration: 'none'
          }}
        >
          <div
            className="nav-brand__logo"
            style={{
              width: '2.5rem',
              height: '2.5rem',
              minWidth: '2.5rem',
              borderRadius: '0.75rem',
              background: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Shield
              size={20}
              color="var(--bg-main)"
              fill="currentColor"
              aria-hidden="true"
            />
          </div>

          <span
            className="nav-brand__text"
            style={{
              letterSpacing: '-0.02em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {t('nav.brand', 'Civic Help Setu')}
          </span>
        </Link>

        {/* HEADER ACTIONS */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            flexShrink: 0
          }}
        >
          {/* NETWORK STATUS */}
          <button
            type="button"
            onClick={() => setShowOfflineModal(true)}
            aria-label={
              isOnline
                ? 'Online. View offline cache status'
                : 'Offline mode active. View cache status'
            }
            title={
              isOnline
                ? 'Network Online - View Offline Cache'
                : 'Offline Mode Active'
            }
            style={{
              padding: '0.4rem 0.65rem',
              background: isOnline
                ? 'var(--glass-bg)'
                : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${
                isOnline
                  ? 'var(--border-main)'
                  : 'rgba(239, 68, 68, 0.35)'
              }`,
              borderRadius: '99px',
              color: isOnline
                ? 'var(--text-secondary)'
                : '#ef4444',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.75rem',
              fontWeight: '600'
            }}
          >
            {isOnline ? (
              <>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#10b981'
                  }}
                />
                <span>Online</span>
              </>
            ) : (
              <>
                <WifiOff size={13} />
                <span>Offline</span>
              </>
            )}
          </button>

          {/* EMERGENCY SOS */}
          <button
            type="button"
            onClick={() => setShowSosModal(true)}
            aria-label="Open emergency helplines"
            title="Rapid Emergency Helplines"
            style={{
              padding: '0.4rem 0.65rem',
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
          >
            <PhoneCall size={14} />
            <span>SOS</span>
          </button>

          {/* VOICE NAVIGATION */}
          <button
            type="button"
            onClick={() => setShowVoiceNavModal(true)}
            className="top-navbar-theme-btn"
            title="Multilingual Voice Navigation"
            aria-label="Open multilingual voice navigation"
            style={{
              padding: '0.45rem',
              background: 'rgba(14, 165, 233, 0.1)',
              borderRadius: '50%',
              color: '#0284c7',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Mic size={18} />
          </button>

          {/* THEME TOGGLE */}
          <button
            type="button"
            onClick={toggleTheme}
            className="top-navbar-theme-btn"
            title={
              theme === 'dark'
                ? 'Switch to Light Mode'
                : 'Switch to Dark Mode'
            }
            aria-label={
              theme === 'dark'
                ? 'Switch to light theme'
                : 'Switch to dark theme'
            }
            style={{
              padding: '0.45rem',
              background: 'var(--glass-bg-hover)',
              borderRadius: '50%',
              color: 'var(--text-primary)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {theme === 'dark' ? (
              <Sun size={18} />
            ) : (
              <Moon size={18} />
            )}
          </button>

          {/* MENU TOGGLE */}
          <button
            ref={menuButtonRef}
            type="button"
            className="hamburger-toggle-btn"
            onClick={() => setIsOpen(prev => !prev)}
            aria-label={
              isOpen
                ? 'Close navigation menu'
                : 'Open navigation menu'
            }
            aria-expanded={isOpen}
            aria-controls="mobile-navigation-drawer"
            style={{
              padding: '0.45rem',
              background: 'var(--glass-bg-hover)',
              borderRadius: '50%',
              color: 'var(--text-primary)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {isOpen ? (
              <X size={24} />
            ) : (
              <Menu size={24} />
            )}
          </button>
        </div>
      </div>

      {/* NAVIGATION DRAWER */}
      {isOpen && (
        <>
          {/* BACKDROP */}
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => {
              setIsOpen(false);
              menuButtonRef.current?.focus();
            }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 998,
              background: 'rgba(0, 0, 0, 0.35)',
              border: 'none',
              cursor: 'default'
            }}
          />

          <div
            id="mobile-navigation-drawer"
            ref={drawerRef}
            className="mobile-drawer-dropdown"
            role="region"
            aria-label="Navigation menu"
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              zIndex: 999,
              background: 'var(--bg-secondary)',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              borderTop: '1px solid var(--border-main)',
              borderRadius: '0 0 1rem 1rem',
              boxShadow: '0 15px 40px rgba(0,0,0,0.16)',
              maxHeight: 'calc(100dvh - 5rem)',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              width: 'min(100%, 450px)',
              maxWidth: '450px'
            }}
          >
            {/* USER PROFILE */}
            {user && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  paddingBottom: '1rem',
                  borderBottom: '1px solid var(--border-main)'
                }}
              >
                {user.imageUrl ? (
                  <img
                    src={user.imageUrl}
                    alt=""
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      objectFit: 'cover'
                    }}
                  />
                ) : (
                  <User
                    size={30}
                    color="var(--accent-main)"
                  />
                )}

                <div style={{ minWidth: 0 }}>
                  <p
                    style={{
                      fontWeight: '700',
                      color: 'var(--text-primary)',
                      margin: 0
                    }}
                  >
                    {user.username || 'Citizen'}
                  </p>

                  <p
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-tertiary)',
                      margin: '0.2rem 0 0',
                      overflowWrap: 'anywhere'
                    }}
                  >
                    {user.email || user.role}
                  </p>
                </div>
              </div>
            )}

            {/* SEARCH AND LANGUAGE */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
                width: '100%'
              }}
            >
              <VoiceSearchInput
                onTranscript={(transcript) => {
                  setIsOpen(false);
                  navigate(
                    `/services?q=${encodeURIComponent(transcript)}`
                  );
                }}
                onServiceMatched={(match) => {
                  if (match?.targetServiceId) {
                    setIsOpen(false);
                    navigate(
                      `/services/${match.targetServiceId}`
                    );
                  }
                }}
              />

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem'
                }}
              >
                <span
                  style={{
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)'
                  }}
                >
                  {t('nav.language', 'Language')}
                </span>

                <LanguageSwitcher variant="mobile" />
              </div>
            </div>

            {/* ACCESSIBILITY */}
            <div
              className="drawer-accessibility-panel"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
                width: '100%',
                paddingBottom: '0.85rem',
                borderBottom: '1px solid var(--border-main)'
              }}
            >
              <p
                style={{
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  margin: 0
                }}
              >
                Accessibility
              </p>

              <div
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  alignItems: 'center',
                  flexWrap: 'wrap'
                }}
              >
                <PlainLanguageToggle />

                {isServiceDetail && (
                  <FocusModeNavToggle />
                )}
              </div>
            </div>

            {/* MAIN NAVIGATION */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem'
              }}
            >
              <p
                style={{
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  margin: '0 0 0.4rem',
                  padding: '0 0.85rem'
                }}
              >
                Explore
              </p>

              {renderNavLink({
                to: '/services',
                label: t('nav.services', 'Services'),
                icon: BookOpen
              })}

              {renderNavLink({
                to: '/acronyms',
                label: 'Acronyms',
                icon: FileText
              })}

              {renderNavLink({
                to: '/eligibility',
                label: 'Eligibility Checker',
                icon: Shield
              })}

              {renderNavLink({
                to: '/nearby',
                activeTarget: '/nearby',
                label: t('nav.nearby', 'Nearby Centers'),
                icon: MapPin
              })}

              {renderNavLink({
                to: '/crematorium-directory',
                label: 'Crematorium Directory',
                icon: Users
              })}

              {renderNavLink({
                to: '/water-tanker',
                label: 'Water Tanker Tracker',
                icon: Droplets
              })}

              {renderNavLink({
                to: '/pds-shops',
                label: 'Fair Price Shops (PDS)',
                icon: Store
              })}

              {renderNavLink({
                to: '/community-facilities',
                label: 'Community Facilities',
                icon: Home
              })}

              {renderNavLink({
                to: '/library-directory',
                label: 'Public Libraries',
                icon: BookOpen
              })}

              {renderNavLink({
                to: '/tenders',
                label: t('nav.tenders', 'Tender Readiness'),
                icon: FileText
              })}

              {renderNavLink({
                to: '/rental-checklist',
                label: t('nav.rentalChecklist', 'Rental Checklist'),
                icon: KeyRound
              })}

              {renderNavLink({
                to: '/address-change-planner',
                label: t('nav.addressChange', 'Address Change Planner'),
                icon: Navigation
              })}

              {renderNavLink({
                to: '/citizen-drafts',
                label: 'Citizen Drafts & Sync',
                icon: FileText
              })}

              {renderNavLink({
                to: '/surveys',
                label: 'Civic Surveys',
                icon: FileText
              })}

              {renderNavLink({
                to: '/track',
                label: t('nav.track', 'Track Status'),
                icon: Settings
              })}

              {renderNavLink({
                to: '/civic-works',
                label: t('nav.civicWorks', 'Ward Public Works'),
                icon: Users
              })}

              {renderNavLink({
                to: '/volunteer',
                label: t('nav.volunteer', 'Volunteer Coordination'),
                icon: KeyRound
              })}

              {renderNavLink({
                to: '/ward-budget',
                label: t('nav.wardBudget', 'Ward Budget & Deliberation'),
                icon: Users
              })}

              {renderNavLink({
                to: '/road-safety',
                label: t('nav.roadSafety', 'Road Safety Blackspots'),
                icon: AlertTriangle
              })}

              {renderNavLink({
                to: '/tree-health',
                activeTarget: '/tree-health',
                label: t('nav.treeHealth', 'Tree Health Inventory'),
                icon: Trees
              })}

              {renderNavLink({
                to: '/assistant',
                label: t('nav.assistant', 'AI Assistant'),
                icon: Bot
              })}
            </div>

            {/* PERSONAL ACCOUNT */}
            {user && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                  paddingTop: '0.85rem',
                  borderTop: '1px solid var(--border-main)'
                }}
              >
                <p
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    color: 'var(--text-tertiary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    margin: '0 0 0.4rem',
                    padding: '0 0.85rem'
                  }}
                >
                  My Account
                </p>

                {renderNavLink({
                  to: '/vault',
                  label: t('nav.vault', 'Document Vault'),
                  icon: Shield
                })}

                {renderNavLink({
                  to: '/saved',
                  label: t('nav.saved', 'Saved Guides'),
                  icon: Bookmark
                })}

                {renderNavLink({
                  to: '/citizen-drafts',
                  label: 'Drafts & Offline Sync',
                  icon: FileText
                })}

                {renderNavLink({
                  to: '/profile',
                  label: t('nav.profile', 'My Profile'),
                  icon: UserCircle
                })}

                {user && can('users.read', user) && (
                  renderNavLink({
                    to: '/admin',
                    label: t('nav.admin', 'Admin Portal'),
                    icon: Settings,
                    admin: true,
                    className: 'nav-drawer-link--admin'
                  })
                )}
              </div>
            )}

            {/* AUTHENTICATION */}
            {!user ? (
              <Link
                to="/login"
                onClick={() => setIsOpen(false)}
                className="btn btn-primary nav-drawer-link"
                aria-current={
                  isNavActive('/login') ? 'page' : undefined
                }
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.8rem 1rem',
                  fontSize: '0.95rem',
                  fontWeight: '700',
                  borderRadius: '0.65rem',
                  textDecoration: 'none',
                  width: '100%'
                }}
              >
                <User size={18} />
                {t('nav.signIn', 'Sign In')}
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                style={{
                  fontSize: '0.95rem',
                  fontWeight: '700',
                  color: 'var(--error)',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '0.65rem',
                  padding: '0.8rem 1rem',
                  cursor: isLoggingOut ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  width: '100%',
                  opacity: isLoggingOut ? 0.6 : 1
                }}
              >
                <LogOut size={18} />
                {isLoggingOut
                  ? 'Signing Out...'
                  : t('nav.signOut', 'Sign Out')}
              </button>
            )}

            {/* FOOTER */}
            <div
              style={{
                textAlign: 'center',
                paddingTop: '0.5rem',
                borderTop: '1px solid var(--border-main)'
              }}
            >
              <p
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--text-tertiary)',
                  margin: 0
                }}
              >
                {t(
                  'nav.footer',
                  'Civic Help Setu • Your Digital Civic Companion'
                )}
              </p>
            </div>
          </div>
        </>
      )}

      {/* OFFLINE CACHE MODAL */}
      <OfflineCacheStatusModal
        isOpen={showOfflineModal}
        onClose={() => setShowOfflineModal(false)}
      />

      {/* MULTILINGUAL VOICE NAVIGATION MODAL */}
      <MultilingualVoiceNavigationModal
        isOpen={showVoiceNavModal}
        onClose={() => setShowVoiceNavModal(false)}
      />

      {/* EMERGENCY HELPLINE MODAL */}
      <EmergencyHelplineModal
        isOpen={showSosModal}
        onClose={() => setShowSosModal(false)}
      />
    </nav>
  );
};

export default Navbar;
