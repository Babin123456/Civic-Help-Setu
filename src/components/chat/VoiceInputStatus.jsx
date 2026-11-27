import { Mic, AlertCircle, X, ShieldCheck, Info, Globe } from 'lucide-react';
import {
  VOICE_PERMISSION_EXPLANATION,
  VOICE_LIMITATIONS_NOTICE,
  VOICE_SUPPORTED_LANGUAGES,
} from '../../utils/voiceSearch';

const VoiceInputStatus = ({
  isListening,
  voiceError,
  onDismissError,
  onStopListening,
  showConsentPrompt = false,
  onConfirmConsent,
  onDismissConsent,
  voiceLanguage = 'en-IN',
  onVoiceLanguageChange,
  showLimitations = false,
  onToggleLimitations,
  hasEditableTranscript = false,
}) => {
  const activeLang =
    VOICE_SUPPORTED_LANGUAGES.find((l) => l.code === voiceLanguage) ||
    VOICE_SUPPORTED_LANGUAGES[0];

  const hasVisibleBanner =
    isListening ||
    Boolean(voiceError) ||
    showConsentPrompt ||
    showLimitations ||
    hasEditableTranscript;

  if (!hasVisibleBanner) return null;

  return (
    <div
      style={{
        marginBottom: '0.85rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
        animation: 'fadeInUp 0.3s ease',
      }}
    >
      {showConsentPrompt && (
        <div
          role="region"
          aria-label={VOICE_PERMISSION_EXPLANATION.title}
          style={{
            padding: '0.8rem 1rem',
            background: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            borderRadius: '0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.45rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontSize: '0.85rem',
              fontWeight: '700',
              color: 'var(--text-primary)',
            }}
          >
            <ShieldCheck size={16} color="var(--accent-main)" aria-hidden="true" />
            <span>{VOICE_PERMISSION_EXPLANATION.title}</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            {VOICE_PERMISSION_EXPLANATION.summary}
          </p>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
            {VOICE_PERMISSION_EXPLANATION.browserDisclosure}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.2rem' }}>
            <button
              type="button"
              onClick={onConfirmConsent}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '99px',
                border: 'none',
                background: 'var(--accent-main)',
                color: 'var(--bg-main)',
                fontSize: '0.8rem',
                fontWeight: '700',
                cursor: 'pointer',
              }}
            >
              {VOICE_PERMISSION_EXPLANATION.confirmLabel}
            </button>
            <button
              type="button"
              onClick={onDismissConsent}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '99px',
                border: '1px solid var(--border-main)',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              {VOICE_PERMISSION_EXPLANATION.cancelLabel}
            </button>
          </div>
        </div>
      )}

      {isListening && (
        <div
          role="status"
          aria-live="polite"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            padding: '0.65rem 1rem',
            background: 'rgba(56, 189, 248, 0.12)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '0.75rem',
            color: 'var(--accent-main)',
            fontSize: '0.85rem',
            fontWeight: '600',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#ef4444',
                animation: 'pulse 1s infinite',
                flexShrink: 0,
              }}
            />
            <Mic size={16} aria-hidden="true" />
            <span>
              Listening in {activeLang.name}... Speak clearly, then review your text before sending.
            </span>
          </div>
          {onStopListening && (
            <button
              type="button"
              onClick={onStopListening}
              style={{
                padding: '0.25rem 0.7rem',
                borderRadius: '99px',
                border: 'none',
                background: '#ef4444',
                color: '#ffffff',
                fontSize: '0.75rem',
                fontWeight: '700',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Stop
            </button>
          )}
        </div>
      )}

      {!isListening && hasEditableTranscript && (
        <div
          role="status"
          aria-live="polite"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            padding: '0.55rem 0.9rem',
            background: 'var(--glass-bg)',
            border: '1px solid var(--border-main)',
            borderRadius: '0.75rem',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
          }}
        >
          <span>
            Voice transcript captured — review or edit your question in the text box below before clicking <strong>Send</strong>.
          </span>
          {onVoiceLanguageChange && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Globe size={13} aria-hidden="true" />
              <span>{activeLang.name}</span>
            </span>
          )}
        </div>
      )}

      {showLimitations && (
        <div
          style={{
            padding: '0.75rem 0.95rem',
            background: 'var(--glass-bg)',
            border: '1px solid var(--border-light)',
            borderRadius: '0.75rem',
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.45,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
            <strong style={{ color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Info size={14} aria-hidden="true" />
              {VOICE_LIMITATIONS_NOTICE.title}
            </strong>
            {onToggleLimitations && (
              <button
                type="button"
                onClick={onToggleLimitations}
                aria-label="Hide voice limitations"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                }}
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>
          <p style={{ margin: '0 0 0.3rem 0' }}>{VOICE_LIMITATIONS_NOTICE.summary}</p>
          <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
            {VOICE_LIMITATIONS_NOTICE.limitations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {voiceError && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            padding: '0.65rem 1rem',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '0.75rem',
            color: 'var(--error, #ef4444)',
            fontSize: '0.85rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} aria-hidden="true" />
            <span>{voiceError}</span>
          </div>
          <button
            type="button"
            onClick={onDismissError}
            aria-label="Dismiss error"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--error, #ef4444)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0% { transform: scale(0.95); opacity: 0.7; }
          50% { transform: scale(1.3); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
};

export default VoiceInputStatus;
