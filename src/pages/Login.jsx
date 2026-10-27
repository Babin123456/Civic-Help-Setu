import { useNavigate, useLocation, Link, Navigate } from 'react-router-dom';
import { Shield, Sparkles, UserCheck, ShieldCheck, ArrowRight } from 'lucide-react';
import { SignIn, ClerkFailed, useSignIn } from '@clerk/clerk-react';
import { dark } from '@clerk/themes';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useState, useEffect } from 'react';
import AuthRedirectNotice from '../components/common/AuthRedirectNotice';
import AuthFallbackBanner from '../components/AuthFallbackBanner';
import { buildAuthPath, getRedirectTarget } from '../utils/authRedirect';
import { classifyAuthFailure, createRedirectGate } from '../utils/authFailure';
import { logProviderError } from '../utils/providerError';

// Google 4‑color SVG Brand Icon
const GoogleLogo = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
  </svg>
);

// One‑click Google sign‑in button powered by Clerk
const ClerkGoogleButton = ({ disabled, redirectTo = '/' }) => {
  const { signIn, isLoaded } = useSignIn();
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState(null);
  // Clicks can land before a state update renders, so the gate is a ref.
  const [gate] = useState(createRedirectGate);

  // Coming back with the back button restores this page with the redirect
  // still marked as running, so reopen the button.
  useEffect(() => {
    const handlePageShow = (event) => {
      if (!event.persisted) return;
      gate.release();
      setLoading(false);
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [gate]);

  const handleGoogleSignIn = async () => {
    if (!isLoaded || !signIn) return;
    setLoading(true);
    const result = await gate.run(() => {
      // Router state is gone after the trip to Google, so the destination
      // rides along in the callback URL (SSOCallback reads these params).
      const callbackParams = new URLSearchParams({
        sign_in_force_redirect_url: redirectTo,
        sign_up_force_redirect_url: redirectTo,
      });
      return signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: `/sso-callback?${callbackParams.toString()}`,
        redirectUrlComplete: redirectTo,
      });
    });
    if (result.status === 'busy') return;
    if (result.status === 'started') {
      // The browser is leaving for Google; the button stays locked until then.
      setFailure(null);
      return;
    }
    if (result.status === 'failed') {
      logProviderError('Google sign-in failed', result.error);
      setFailure(classifyAuthFailure(result.error, { online: navigator.onLine }));
      setLoading(false);
    }
  };

  return (
    <div style={{ width: '100%' }}>
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={disabled || loading || !isLoaded}
        aria-busy={loading}
        className="google-signin-btn"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          padding: '0.9rem 1.25rem',
          borderRadius: '0.85rem',
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid var(--border-light)',
          color: 'var(--text-primary)',
          fontSize: '1rem',
          fontWeight: '600',
          cursor: loading ? 'wait' : 'pointer',
          transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
          backdropFilter: 'blur(10px)',
          boxShadow: 'var(--shadow-sm)',
        }}
        onMouseOver={e => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.14)';
          e.currentTarget.style.borderColor = 'var(--accent-main)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseOut={e => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
          e.currentTarget.style.borderColor = 'var(--border-light)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        <GoogleLogo size={22} />
        {loading ? 'Opening Google Sign‑in…' : 'Continue with Google'}
      </button>
      <p role="status" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        {loading ? 'Opening Google sign-in. You will be taken to Google in a moment.' : ''}
      </p>
      {failure && (
        <div style={{ marginTop: '0.75rem' }}>
          <AuthFallbackBanner failure={failure} onRetry={handleGoogleSignIn} retrying={loading} />
        </div>
      )}
    </div>
  );
};

const Login = () => {
  const { user, isClerkConfigured, signInAsDemo } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTarget = getRedirectTarget(location);
  const from = redirectTarget || '/';
  const redirectState = redirectTarget ? { from: redirectTarget } : undefined;

  const [demoName, setDemoName] = useState('');
  const [demoRole, setDemoRole] = useState('citizen');

  // Redirect if already signed in
  if (user) {
    return <Navigate to={from} replace />;
  }

  const handleDemoSubmit = (e) => {
    e.preventDefault();
    if (!signInAsDemo) return;
    const name = demoName.trim() || (demoRole === 'admin' ? 'Demo Admin' : 'Demo Citizen');
    signInAsDemo({
      username: name,
      fullName: name,
      email: `${name.toLowerCase().replace(/\s+/g, '.')}@civicbridge.demo`,
      role: demoRole,
    });
    navigate(from, { replace: true });
  };

  const handleQuickDemo = (role) => {
    if (!signInAsDemo) return;
    signInAsDemo({ role });
    navigate(from, { replace: true });
  };

  return (
    <div className="section flex-center" style={{ minHeight: '85vh', position: 'relative' }}>
      {/* Background glow */}
      <div className="glow-blob animate-fade-in" style={{
        width: '500px',
        height: '500px',
        background: 'rgba(56,189,248,0.25)',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        opacity: 0.12,
        transition: 'background 0.5s ease',
      }} />

      {/* Main glass panel */}
      <div className="glass-panel animate-fade-in delay-100" style={{ width: '100%', maxWidth: '480px', padding: '2.5rem', position: 'relative', zIndex: 10 }}>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', background: 'var(--accent-light)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem' }}>
            <Shield size={24} color="var(--accent-main)" />
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '800' }}>Sign In to CivicBridge</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Access saved guides, track applications, and view your digital vault.
          </p>
        </div>

        <AuthRedirectNotice redirectTo={redirectTarget} mode="signin" />

        {isClerkConfigured ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <ClerkFailed>
              {/* Clerk's script never loaded, so there is no sign-in form to show */}
              <AuthFallbackBanner
                failure={classifyAuthFailure({ code: 'failed_to_load_clerk_js' })}
                onRetry={() => window.location.reload()}
              />
            </ClerkFailed>
            <ClerkGoogleButton redirectTo={from} />
            <SignIn
              routing="path"
              path="/login"
              signUpUrl={buildAuthPath('/signup', redirectTarget)}
              fallbackRedirectUrl={from}
              signUpFallbackRedirectUrl={from}
              appearance={{
                baseTheme: theme === 'dark' ? dark : undefined,
                variables: { colorPrimary: '#38bdf8' },
              }}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ padding: '0.9rem', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: '0.75rem', fontSize: '0.85rem' }}>
              <p style={{ fontWeight: '600', color: 'var(--accent-main)', marginBottom: '0.25rem' }}>Local Demo Authentication Mode</p>
              <p style={{ color: 'var(--text-secondary)' }}>
                Clerk publishable key is not active. You can sign in using quick evaluation accounts below to test all citizen and admin flows.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => handleQuickDemo('citizen')}
                className="btn btn-secondary"
                style={{ padding: '0.75rem 0.5rem', fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'center' }}
              >
                <UserCheck size={18} color="var(--accent-main)" />
                <span style={{ fontWeight: '600' }}>Citizen Demo</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Standard access</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo('admin')}
                className="btn btn-secondary"
                style={{ padding: '0.75rem 0.5rem', fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'center' }}
              >
                <ShieldCheck size={18} color="var(--success)" />
                <span style={{ fontWeight: '600' }}>Admin Demo</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Moderator access</span>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }}></div>
              <span>Or customize session</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }}></div>
            </div>

            <form onSubmit={handleDemoSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input
                type="text"
                placeholder="Custom Display Name (e.g. Ramesh Kumar)"
                className="input-field"
                value={demoName}
                onChange={(e) => setDemoName(e.target.value)}
                style={{ fontSize: '0.95rem', padding: '0.75rem 1rem' }}
              />

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--glass-bg)', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="radio"
                    name="role"
                    value="citizen"
                    checked={demoRole === 'citizen'}
                    onChange={() => setDemoRole('citizen')}
                  />
                  <span>Citizen Role</span>
                </label>

                <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--glass-bg)', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="radio"
                    name="role"
                    value="admin"
                    checked={demoRole === 'admin'}
                    onChange={() => setDemoRole('admin')}
                  />
                  <span>Admin Role</span>
                </label>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.75rem', fontSize: '0.95rem', marginTop: '0.5rem' }}
              >
                <span>Launch Demo Session</span>
                <ArrowRight size={16} />
              </button>
            </form>
          </div>
        )}

        <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Don’t have an account? <Link to={buildAuthPath('/signup', redirectTarget)} state={redirectState} style={{ color: 'var(--accent-main)', fontWeight: '600' }}>Sign up</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
