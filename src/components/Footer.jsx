import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { can } from '../services/accessControl';

const Footer = () => {
  const { t } = useLanguage();
  const { user } = useAuth();

  return (
    <footer id="site-footer" aria-label="Site Footer" tabIndex="-1" style={{ borderTop: '1px solid var(--border-main)', padding: '3.5rem 0 2.5rem', marginTop: 'auto', backgroundColor: 'var(--bg-main)' }}>
      <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)' }}>
          <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={20} fill="var(--bg-main)" color="var(--bg-main)" />
          </div>
          <span style={{ fontWeight: '800', fontSize: '1.25rem', color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            {t('nav.brand', 'CivicBridge')}
          </span>
          <span style={{ fontSize: '0.9rem', marginLeft: '0.5rem', color: 'var(--text-muted)' }}>
            &copy; {new Date().getFullYear()} {t('footer.openSource', 'Open Source Project')}.
          </span>
        </div>

        <p style={{ maxWidth: '640px', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.6', margin: 0 }}>
          {t('footer.disclaimer', 'CivicBridge is an independent, non-governmental civic tech platform.')}
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1.75rem', fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
          <Link to="/privacy" style={{ transition: 'color 0.2s' }}>{t('footer.privacy', 'Privacy Policy')}</Link>
          <Link to="/open-source" style={{ transition: 'color 0.2s' }}>{t('footer.openSource', 'Open Source')}</Link>
          {can('users.read', user) && (
            <Link to="/admin" style={{ transition: 'color 0.2s' }}>{t('nav.admin', 'Admin Portal')}</Link>
          )}
          <Link to="/services" style={{ transition: 'color 0.2s' }}>{t('nav.services', 'Services')}</Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
