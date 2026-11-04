import React, { useState } from 'react';
import {
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  Info,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from 'lucide-react';
import {
  getSafeAuthErrorMessage,
  getDevAuthDiagnostics,
} from '../../utils/authErrorSanitizer';

export default function SafeAuthErrorBanner({
  error,
  context = {},
  onRetry,
  onSecondaryAction,
}) {
  const [showDevDetails, setShowDevDetails] = useState(false);

  if (!error) return null;

  const safe = getSafeAuthErrorMessage(error, context);
  const isDev = Boolean(import.meta.env?.DEV);
  const diagnostics = getDevAuthDiagnostics(error, isDev);

  return (
    <div
      className="safe-auth-error-banner"
      style={{
        background: 'rgba(239, 68, 68, 0.08)',
        border: '1px solid rgba(239, 68, 68, 0.25)',
        borderRadius: '0.65rem',
        padding: '1.25rem',
        margin: '1rem 0',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
      role="alert"
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" style={{ marginTop: '0.15rem' }} />
        <div style={{ flex: 1 }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#b91c1c', margin: '0 0 0.25rem 0' }}>
            {safe.title}
          </h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: '0 0 0.35rem 0', lineHeight: 1.5 }}>
            {safe.message}
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
            {safe.action}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
        {safe.retryable && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.45rem 0.85rem',
              borderRadius: '0.4rem',
              background: '#ef4444',
              color: '#ffffff',
              border: 'none',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            <RotateCcw className="w-3.5 h-3.5" /> Try Again
          </button>
        )}

        {onSecondaryAction && (
          <button
            type="button"
            onClick={onSecondaryAction}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.45rem 0.85rem',
              borderRadius: '0.4rem',
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Continue in Guest Mode <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Dev-only Diagnostic Section */}
      {isDev && diagnostics && (
        <div
          style={{
            marginTop: '0.5rem',
            paddingTop: '0.65rem',
            borderTop: '1px dashed rgba(239, 68, 68, 0.25)',
          }}
        >
          <button
            type="button"
            onClick={() => setShowDevDetails(!showDevDetails)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '0.75rem',
              fontWeight: '600',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {showDevDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Development Diagnostics (Secrets Excluded)
          </button>

          {showDevDetails && (
            <div
              style={{
                marginTop: '0.5rem',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.35rem',
                background: 'rgba(0, 0, 0, 0.05)',
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.4,
              }}
            >
              <div><strong>Name:</strong> {diagnostics.name}</div>
              <div><strong>Code:</strong> {diagnostics.code}</div>
              {diagnostics.status && <div><strong>HTTP Status:</strong> {diagnostics.status}</div>}
              <div><strong>Sanitized Message:</strong> {diagnostics.sanitizedMessage}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
