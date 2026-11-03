import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Mail, CheckCircle, AlertCircle, Loader2, Clock, RefreshCw, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { logDiagnostic } from '../utils/diagnostics';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const [state, setState] = useState('verifying');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);

  const token = searchParams.get('token');

  const verifyToken = useCallback(async (verificationToken) => {
    setState('verifying');
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/email/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', token: verificationToken }),
      });

      const data = await response.json();

      if (response.ok && data.verified) {
        setState('success');
        setEmail(data.email);
        setMessage('Your email has been verified successfully!');
      } else {
        setState('error');
        setError(data.message || data.error || 'Verification failed. Please try again.');
      }
    } catch (err) {
      logDiagnostic('Email verification error:', err);
      setState('error');
      setError('Network error. Please check your connection and try again.');
    }
  }, []);

  /* eslint-disable */
  useEffect(() => {
    if (token) {
      verifyToken(token);
    } else if (user?.email) {
      setEmail(user.email);
      setState('resend');
    } else {
      setState('no_token');
    }
  }, [token, user?.email, verifyToken]);
/* eslint-enable */

  const resendVerification = async () => {
    if (!user?.email) return;
    setResending(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/email/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resend', email: user.email }),
      });

      const data = await response.json();

      if (response.ok && data.sent) {
        setMessage(data.message);
        startResendCooldown();
      } else {
        setError(data.message || data.error || 'Failed to resend verification email.');
        if (data.retryAfterSeconds) {
          setResendCooldown(data.retryAfterSeconds);
        }
      }
    } catch (err) {
      logDiagnostic('Resend verification error:', err);
      setError('Network error. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const startResendCooldown = () => {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const sendInitialVerification = async () => {
    if (!user?.email) return;
    setState('verifying');
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/email/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', email: user.email }),
      });

      const data = await response.json();

      if (response.ok && data.sent) {
        setState('resend');
        setMessage(data.message);
        startResendCooldown();
      } else {
        setState('error');
        setError(data.message || data.error || 'Failed to send verification email.');
      }
    } catch (err) {
      logDiagnostic('Send verification error:', err);
      setState('error');
      setError('Network error. Please try again.');
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (state === 'verifying') {
    return (
      <div className="section flex-center" style={{ minHeight: '70vh' }}>
        <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '420px', padding: '3rem', textAlign: 'center' }}>
          <div style={{ width: '4rem', height: '4rem', borderRadius: '50%', background: 'var(--accent-light)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <Loader2 size={28} color="var(--accent-main)" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.75rem' }}>Verifying your email</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Please wait while we check your verification link...</p>
          <style>{`@keyframes spin { 100% { transform: rotate(360deg); } `}</style>
        </div>
      </div>
    );
  }

  return (
    <div className="section flex-center" style={{ minHeight: '70vh', paddingTop: '4rem', paddingBottom: '4rem' }}>
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '480px', padding: '2.5rem' }}>
        {state === 'success' && (
          <>
            <div style={{ width: '4rem', height: '4rem', borderRadius: '50%', background: 'rgba(16,185,129,0.12)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', margin: '0 auto 1.5rem' }}>
              <CheckCircle size={28} color="#10b981" />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.75rem', textAlign: 'center' }}>Email Verified!</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', textAlign: 'center', marginBottom: '2rem' }}>
              {message} <br />
              <span style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: 'var(--accent-main)' }}>{email}</span> is now verified.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/profile" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem' }}>
                <ArrowLeft size={16} /> Go to Profile
              </Link>
              <Link to="/services" className="btn btn-secondary" style={{ padding: '0.75rem 1.5rem' }}>
                Browse Services
              </Link>
            </div>
          </>
        )}

        {state === 'error' && (
          <>
            <div style={{ width: '4rem', height: '4rem', borderRadius: '50%', background: 'rgba(248,113,113,0.12)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', margin: '0 auto 1.5rem' }}>
              <AlertCircle size={28} color="#f87171" />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.75rem', textAlign: 'center' }}>Verification Failed</h2>
            <p style={{ color: 'var(--error, #f87171)', fontSize: '0.95rem', textAlign: 'center', marginBottom: '2rem' }}>{error}</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              {user?.email ? (
                <button onClick={resendVerification} disabled={resending || resendCooldown > 0} className="btn btn-primary" style={{ padding: '0.75rem 1.5rem' }}>
                  {resending ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={16} />}
                  {resending ? 'Sending...' : resendCooldown > 0 ? `Resend in ${formatTime(resendCooldown)}` : 'Resend Verification Email'}
                </button>
              ) : (
                <Link to="/login" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem' }}>
                  Sign In Again
                </Link>
              )}
              <Link to="/services" className="btn btn-secondary" style={{ padding: '0.75rem 1.5rem' }}>
                Browse Services
              </Link>
            </div>
          </>
        )}

        {state === 'resend' && (
          <>
            <div style={{ width: '4rem', height: '4rem', borderRadius: '50%', background: 'var(--accent-light)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', margin: '0 auto 1.5rem' }}>
              <Mail size={28} color="var(--accent-main)" />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.5rem', textAlign: 'center' }}>Verify Your Email</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', textAlign: 'center', marginBottom: '1.5rem' }}>
              We've sent a verification link to <br />
              <span style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: '500' }}>{email}</span>
            </p>
            {message && (
              <p style={{ color: '#10b981', fontSize: '0.875rem', textAlign: 'center', marginBottom: '1rem' }}>{message}</p>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              <button onClick={resendVerification} disabled={resending || resendCooldown > 0} className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', minWidth: '200px' }}>
                {resending ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={16} />}
                {resending ? 'Sending...' : resendCooldown > 0 ? `Resend in ${formatTime(resendCooldown)}` : 'Resend Verification Email'}
              </button>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
              Didn't receive the email? Check your spam folder or try a different email address in your profile settings.
            </p>
          </>
        )}

        {state === 'no_token' && (
          <>
            <div style={{ width: '4rem', height: '4rem', borderRadius: '50%', background: 'rgba(245,158,11,0.12)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', margin: '0 auto 1.5rem' }}>
              <Clock size={28} color="#f59e0b" />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.75rem', textAlign: 'center' }}>No Verification Link</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', textAlign: 'center', marginBottom: '2rem' }}>
              This page requires a verification token. If you clicked a link in an email, please make sure the full URL was copied correctly.
            </p>
            {user?.email ? (
              <button onClick={sendInitialVerification} className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', width: '100%' }}>
                <Mail size={16} /> Send Verification Email to {user.email}
              </button>
            ) : (
              <Link to="/login" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <ArrowLeft size={16} /> Sign In
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;