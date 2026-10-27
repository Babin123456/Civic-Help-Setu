import { useSignUp } from '@clerk/clerk-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Sparkles, ArrowRight, UserPlus } from 'lucide-react';
import AuthRedirectNotice from '../components/common/AuthRedirectNotice';
import { buildAuthPath, getRedirectTarget } from '../utils/authRedirect';
import { describeProviderError, logProviderError } from '../utils/providerError';

const SignUpPage = () => {
  const { isClerkConfigured, signInAsDemo } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTarget = getRedirectTarget(location);
  const redirectState = redirectTarget ? { from: redirectTarget } : undefined;

  // Safe clerk hook fallback
  const clerkSignUp = isClerkConfigured ? useSignUp() : { isLoaded: false, signUp: null };
  const { isLoaded, signUp } = clerkSignUp;

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isClerkConfigured) {
      if (!email.trim()) {
        setError('Please enter a valid email address.');
        return;
      }
      if (signInAsDemo) {
        signInAsDemo({
          username: username.trim() || email.split('@')[0],
          fullName: username.trim() || email.split('@')[0],
          email: email.trim(),
          role: 'citizen',
        });
        navigate(redirectTarget || '/', { replace: true });
      }
      return;
    }

    if (!isLoaded || !signUp) return;
    setLoading(true);
    setError('');
    try {
      await signUp.create({ emailAddress: email, password });
      if (username) {
        await signUp.update({ username });
      }
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      navigate(buildAuthPath('/login', redirectTarget), { state: redirectState });
    } catch (err) {
      logProviderError('Sign-up failed', err);
      setError(describeProviderError(err, 'Sign‑up failed. Please check your details and try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="section flex-center" style={{ minHeight: '85vh', position: 'relative' }}>
      <div className="glow-blob animate-fade-in" style={{
        width: '500px',
        height: '500px',
        background: 'var(--accent-main)',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        opacity: 0.1,
      }} />

      <div className="glass-panel animate-fade-in delay-100" style={{ width: '100%', maxWidth: '480px', padding: '2.5rem', position: 'relative', zIndex: 10 }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', background: 'var(--accent-light)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem' }}>
            <UserPlus size={24} color="var(--accent-main)" />
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '800' }}>Create your account</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            {isClerkConfigured
              ? 'Join CivicBridge to track civic guides and manage documents.'
              : 'Register a local citizen account (Demo Mode active).'}
          </p>
        </div>

        <AuthRedirectNotice redirectTo={redirectTarget} mode="signup" />

        {!isClerkConfigured && (
          <div style={{ padding: '0.85rem', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: '0.75rem', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
            <p style={{ fontWeight: '600', color: 'var(--accent-main)', marginBottom: '0.2rem' }}>Local Session Mode</p>
            <p style={{ color: 'var(--text-secondary)' }}>
              Submitting below creates an immediate local citizen profile for testing all app features.
            </p>
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: 'var(--error)', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', textAlign: 'center', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Full Name / Username
            </label>
            <input
              type="text"
              placeholder="e.g. Priyanshu Sharma"
              className="input-field"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{ fontSize: '0.95rem', padding: '0.75rem 1rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Email Address
            </label>
            <input
              type="email"
              placeholder="name@example.com"
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ fontSize: '0.95rem', padding: '0.75rem 1rem' }}
            />
          </div>

          {isClerkConfigured && (
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Password
              </label>
              <input
                type="password"
                placeholder="Choose a strong password"
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ fontSize: '0.95rem', padding: '0.75rem 1rem' }}
              />
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: '0.85rem', fontSize: '1rem', marginTop: '0.5rem' }}>
            <span>{loading ? 'Creating account...' : isClerkConfigured ? 'Sign Up' : 'Create Citizen Account'}</span>
            <ArrowRight size={16} />
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Already have an account? <Link to={buildAuthPath('/login', redirectTarget)} state={redirectState} style={{ color: 'var(--accent-main)', fontWeight: '600' }}>Sign in</Link>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;
