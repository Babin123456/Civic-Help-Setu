import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { can } from '../services/accessControl';

const focusRingStyle = {
  outline: '2px solid var(--text-primary)',
  outlineOffset: '2px',
  borderRadius: '4px',
};

const linkBaseStyle = {
  transition: 'color 0.2s',
  color: 'inherit',
  textDecoration: 'none',
};

const groupHeadingStyle = {
  fontWeight: '700',
  fontSize: '0.85rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-primary)',
  marginBottom: '0.5rem',
};

const Footer = () => {
  const { t } = useLanguage();
  const { user } = useAuth();

  return (
    <footer
      id="site-footer"
      aria-label="Site Footer"
      tabIndex="-1"
      style={{
        borderTop: '1px solid var(--border-main)',
        padding: '3rem 0 2rem',
        marginTop: 'auto',
        backgroundColor: 'var(--bg-main)',
      }}
    >
      <div
        className="container"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '2rem',
          alignItems: 'center',
        }}
      >
        {/* ── Brand row ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: '2.5rem',
              height: '2.5rem',
              borderRadius: '0.75rem',
              background: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Shield size={20} fill="var(--bg-main)" color="var(--bg-main)" />
          </div>
          <span
            style={{
              fontWeight: '800',
              fontSize: '1.25rem',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-heading)',
            }}
          >
            {t('nav.brand', 'Civic Help Setu')}
          </span>
        </div>

        {/* ── Disclaimer ── */}
        <p
          style={{
            maxWidth: '640px',
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
            lineHeight: '1.6',
            margin: 0,
            textAlign: 'center',
          }}
        >
          {t(
            'footer.disclaimer',
            'Civic Help Setu is an independent, non-governmental civic-tech platform. It is not affiliated with or endorsed by any government body.',
          )}
        </p>

        {/* ── Grouped link columns ── */}
        <nav
          aria-label="Footer navigation"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '2.5rem',
            width: '100%',
          }}
        >
          {/* Services group */}
          <div style={{ minWidth: '140px' }}>
            <p style={groupHeadingStyle}>
              {t('footer.servicesHeading', 'Services')}
            </p>
            <ul
              style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}
            >
              <li>
                <Link
                  to="/services"
                  style={linkBaseStyle}
                  onFocus={(e) => Object.assign(e.currentTarget.style, focusRingStyle)}
                  onBlur={(e) => { e.currentTarget.style.outline = ''; e.currentTarget.style.outlineOffset = ''; }}
                >
                  {t('nav.services', 'Services')}
                </Link>
              </li>
              <li>
                <Link
                  to="/civic-works"
                  style={linkBaseStyle}
                  onFocus={(e) => Object.assign(e.currentTarget.style, focusRingStyle)}
                  onBlur={(e) => { e.currentTarget.style.outline = ''; e.currentTarget.style.outlineOffset = ''; }}
                >
                  {t('nav.civicWorks', 'Ward Works Board')}
                </Link>
              </li>
              <li>
                <Link
                  to="/senior-citizen-tribunal"
                  style={linkBaseStyle}
                  onFocus={(e) => Object.assign(e.currentTarget.style, focusRingStyle)}
                  onBlur={(e) => { e.currentTarget.style.outline = ''; e.currentTarget.style.outlineOffset = ''; }}
                >
                  Senior Citizen Tribunal
                </Link>
              </li>
              <li>
                <Link
                  to="/rera-dispute-workspace"
                  style={linkBaseStyle}
                  onFocus={(e) => Object.assign(e.currentTarget.style, focusRingStyle)}
                  onBlur={(e) => { e.currentTarget.style.outline = ''; e.currentTarget.style.outlineOffset = ''; }}
                >
                  RERA Homebuyer Rights
                </Link>
              </li>
              <li>
                <Link
                  to="/stray-animal-workspace"
                  to="/noise-pollution-workspace"
                  style={linkBaseStyle}
                  onFocus={(e) => Object.assign(e.currentTarget.style, focusRingStyle)}
                  onBlur={(e) => { e.currentTarget.style.outline = ''; e.currentTarget.style.outlineOffset = ''; }}
                >
                  Stray Animals &amp; Rabies PEP
                  Noise Pollution &amp; Curfew
                </Link>
                <Link
                  to="/solid-waste-workspace"
                  style={linkBaseStyle}
                  onFocus={(e) => Object.assign(e.currentTarget.style, focusRingStyle)}
                  onBlur={(e) => { e.currentTarget.style.outline = ''; e.currentTarget.style.outlineOffset = ''; }}
                >
                  Solid Waste &amp; NGT
                </Link>
              </li>
              <li>
                <Link
                  to="/clinical-establishment-workspace"
                  style={linkBaseStyle}
                  onFocus={(e) => Object.assign(e.currentTarget.style, focusRingStyle)}
                  onBlur={(e) => { e.currentTarget.style.outline = ''; e.currentTarget.style.outlineOffset = ''; }}
                >
                  Clinical Establishment &amp; Patient Rights
                </Link>
              </li>
              <li>
                <Link
                  to="/electricity-consumer-workspace"
                  style={linkBaseStyle}
                  onFocus={(e) => Object.assign(e.currentTarget.style, focusRingStyle)}
                  onBlur={(e) => { e.currentTarget.style.outline = ''; e.currentTarget.style.outlineOffset = ''; }}
                >
                  Electricity Rights &amp; CGRF
                </Link>
              </li>
<li><Link to="/accessibility-audit-workspace" style={linkBaseStyle}>Universal Accessibility Audit</Link></li>
<li><Link to="/dark-patterns-workspace">Dark Patterns &amp; Consumer Redressal</Link></li>
<li>
  <Link
    to="/street-vendor-workspace"
    style={linkBaseStyle}
    onFocus={(e) => Object.assign(e.currentTarget.style, focusRingStyle)}
    onBlur={(e) => { e.currentTarget.style.outline = ''; e.currentTarget.style.outlineOffset = ''; }}
  >
    Street Vendor Rights &amp; TVC
  </Link>
</li>
<li>
  <Link
    to="/electricity-consumer-workspace"
    style={linkBaseStyle}
    onFocus={(e) => Object.assign(e.currentTarget.style, focusRingStyle)}
    onBlur={(e) => { e.currentTarget.style.outline = ''; e.currentTarget.style.outlineOffset = ''; }}
  >
    Electricity Rights &amp; CGRF
  </Link>
</li>
<li>
  <Link
    to="/rte-quota-workspace"
    style={linkBaseStyle}
    onFocus={(e) => Object.assign(e.currentTarget.style, focusRingStyle)}
    onBlur={(e) => { e.currentTarget.style.outline = ''; e.currentTarget.style.outlineOffset = ''; }}
  >
    RTE Quota &amp; Child Rights
  </Link>
</li>
              {can('users.read', user) && (
                <li>
                  <Link
                    to="/admin"
                    style={linkBaseStyle}
                    onFocus={(e) => Object.assign(e.currentTarget.style, focusRingStyle)}
                    onBlur={(e) => { e.currentTarget.style.outline = ''; e.currentTarget.style.outlineOffset = ''; }}
                  >
                    {t('nav.admin', 'Admin Portal')}
                  </Link>
                </li>
              )}
            </ul>
          </div>

          {/* Open Source / Contributors group */}
          <div style={{ minWidth: '140px' }}>
            <p style={groupHeadingStyle}>
              {t('footer.communityHeading', 'Community')}
            </p>
            <ul
              style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}
            >
              <li>
                <Link
                  to="/open-source"
                  style={linkBaseStyle}
                  onFocus={(e) => Object.assign(e.currentTarget.style, focusRingStyle)}
                  onBlur={(e) => { e.currentTarget.style.outline = ''; e.currentTarget.style.outlineOffset = ''; }}
                >
                  {t('footer.openSourceLink', 'Open Source')}
                </Link>
              </li>
              <li>
                <Link
                  to="/open-source#contributors"
                  style={linkBaseStyle}
                  onFocus={(e) => Object.assign(e.currentTarget.style, focusRingStyle)}
                  onBlur={(e) => { e.currentTarget.style.outline = ''; e.currentTarget.style.outlineOffset = ''; }}
                >
                  {t('footer.contributors', 'Contributors')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Privacy group */}
          <div style={{ minWidth: '140px' }}>
            <p style={groupHeadingStyle}>
              {t('footer.legalHeading', 'Legal')}
            </p>
            <ul
              style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}
            >
              <li>
                <Link
                  to="/privacy"
                  style={linkBaseStyle}
                  onFocus={(e) => Object.assign(e.currentTarget.style, focusRingStyle)}
                  onBlur={(e) => { e.currentTarget.style.outline = ''; e.currentTarget.style.outlineOffset = ''; }}
                >
                  {t('footer.privacy', 'Privacy Policy')}
                </Link>
              </li>
            </ul>
          </div>
        </nav>

        {/* ── Copyright bar ── */}
        <div
          style={{
            borderTop: '1px solid var(--border-main)',
            paddingTop: '1.25rem',
            width: '100%',
            textAlign: 'center',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
          }}
        >
          &copy; {new Date().getFullYear()} Civic Help Setu &mdash;{' '}
          {t('footer.openSource', 'Open Source Project')}.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
