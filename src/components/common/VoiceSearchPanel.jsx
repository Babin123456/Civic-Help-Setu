import { useId } from 'react';
import { Mic, MicOff, AlertCircle, Globe, ShieldCheck, Info, X, Check, RotateCcw, Sparkles } from 'lucide-react';
import {
  VOICE_STATUS,
  VOICE_PERMISSION_EXPLANATION,
  VOICE_LIMITATIONS_NOTICE,
} from '../../utils/voiceSearch';

/**
 * Accessible microphone toggle button with explicit Start/Stop semantics.
 */
export function VoiceMicButton({
  isListening,
  supported = true,
  onClick,
  size = 18,
  labelStart = 'Start voice search',
  labelStop = 'Stop listening',
  style = {},
  className = '',
}) {
  const ariaLabel = isListening ? labelStop : labelStart;
  const title = !supported
    ? 'Voice input is not supported in this browser. Type manually instead.'
    : isListening
      ? 'Listening — click to stop voice input'
      : 'Voice search (optional; asks permission before listening)';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={isListening}
      title={title}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '9999px',
        border: isListening
          ? '1px solid rgba(239, 68, 68, 0.55)'
          : '1px solid var(--border-main)',
        background: isListening ? 'rgba(239, 68, 68, 0.16)' : 'var(--glass-bg)',
        color: isListening ? '#ef4444' : 'var(--accent-main)',
        padding: '0.45rem',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        ...style,
      }}
    >
      {isListening ? <MicOff size={size} aria-hidden="true" /> : <Mic size={size} aria-hidden="true" />}
    </button>
  );
}

/**
 * Shared accessible panel for voice consent, language selection, limitations,
 * listening status, editable transcript review, and error/empty recovery.
 */
export default function VoiceSearchPanel({
  voice,
  isOpen = false,
  onClose,
  onSubmitQuery,
  onSelectService,
  submitLabel = 'Search with transcript',
  showTranscriptInput = true,
  compact = false,
}) {
  const baseId = useId();
  const langSelectId = `${baseId}-lang`;
  const transcriptInputId = `${baseId}-transcript`;

  if (!voice) return null;

  const {
    status,
    supported,
    isListening,
    language,
    setLanguage,
    supportedLanguages,
    transcriptDraft,
    setTranscriptDraft,
    showConsentPrompt,
    showLimitations,
    setShowLimitations,
    errorInfo,
    matchResult,
    requestStartListening,
    stopListening,
    cancelListening,
    confirmConsentAndStart,
    dismissConsent,
    clearTranscript,
    dismissError,
  } = voice;

  const hasTranscript = Boolean(transcriptDraft && transcriptDraft.trim());
  if (!isOpen && !isListening) return null;

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (isListening) {
        cancelListening();
      } else {
        onClose?.();
      }
    }
  };

  const handleSubmit = () => {
    const clean = transcriptDraft.trim();
    if (!clean) return;
    onSubmitQuery?.(clean, matchResult);
  };

  return (
    <div
      role="region"
      aria-label="Voice search controls and transcript review"
      onKeyDown={handleKeyDown}
      style={{
        marginTop: '0.65rem',
        padding: compact ? '0.85rem' : '1rem 1.15rem',
        borderRadius: '1rem',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-main)',
        boxShadow: 'var(--shadow-sm)',
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        color: 'var(--text-primary)',
      }}
    >
      {/* Top Toolbar: Language selector, Start/Stop, Limitations toggle, Close */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <label
            htmlFor={langSelectId}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.8rem',
              fontWeight: '600',
              color: 'var(--text-secondary)',
            }}
          >
            <Globe size={14} aria-hidden="true" />
            <span>Language:</span>
          </label>
          <select
            id={langSelectId}
            aria-label="Voice recognition language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={isListening}
            style={{
              padding: '0.3rem 0.6rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-main)',
              background: 'var(--bg-main)',
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
              cursor: isListening ? 'not-allowed' : 'pointer',
            }}
          >
            {supportedLanguages.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowLimitations((prev) => !prev)}
            aria-expanded={showLimitations}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.3rem 0.55rem',
              borderRadius: '9999px',
              border: '1px solid var(--border-light)',
              background: 'var(--glass-bg)',
              color: 'var(--text-secondary)',
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          >
            <Info size={13} aria-hidden="true" />
            <span>Languages &amp; limits</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <button
            type="button"
            onClick={isListening ? stopListening : requestStartListening}
            aria-pressed={isListening}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.38rem 0.8rem',
              borderRadius: '9999px',
              border: 'none',
              background: isListening ? '#ef4444' : 'var(--accent-main)',
              color: isListening ? '#ffffff' : 'var(--bg-main)',
              fontSize: '0.8rem',
              fontWeight: '700',
              cursor: 'pointer',
            }}
          >
            {isListening ? <MicOff size={14} aria-hidden="true" /> : <Mic size={14} aria-hidden="true" />}
            <span>{isListening ? 'Stop' : supported ? 'Start speaking' : 'Voice unavailable'}</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={() => {
                if (isListening) cancelListening();
                dismissError();
                dismissConsent();
                onClose();
              }}
              aria-label="Close voice search panel"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.35rem',
                borderRadius: '9999px',
                border: '1px solid var(--border-light)',
                background: 'transparent',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
              }}
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Consent & Permission Explanation before first mic prompt */}
      {showConsentPrompt && (
        <div
          role="region"
          aria-label={VOICE_PERMISSION_EXPLANATION.title}
          style={{
            padding: '0.8rem 0.95rem',
            borderRadius: '0.75rem',
            background: 'var(--accent-light)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: '700', fontSize: '0.85rem' }}>
            <ShieldCheck size={16} color="var(--accent-main)" aria-hidden="true" />
            <span>{VOICE_PERMISSION_EXPLANATION.title}</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            {VOICE_PERMISSION_EXPLANATION.summary}
          </p>
          <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
            {VOICE_PERMISSION_EXPLANATION.browserDisclosure}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.2rem' }}>
            <button
              type="button"
              onClick={confirmConsentAndStart}
              style={{
                padding: '0.42rem 0.85rem',
                borderRadius: '9999px',
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
              onClick={dismissConsent}
              style={{
                padding: '0.42rem 0.85rem',
                borderRadius: '9999px',
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

      {/* Supported Languages & Recognition Limitations Notice */}
      {showLimitations && (
        <div
          style={{
            padding: '0.75rem 0.9rem',
            borderRadius: '0.75rem',
            background: 'var(--glass-bg)',
            border: '1px solid var(--border-light)',
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.45,
          }}
        >
          <div style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            {VOICE_LIMITATIONS_NOTICE.title}
          </div>
          <p style={{ margin: '0 0 0.35rem 0' }}>{VOICE_LIMITATIONS_NOTICE.summary}</p>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            {VOICE_LIMITATIONS_NOTICE.limitations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Active Listening Status */}
      {isListening && (
        <div
          role="status"
          aria-live="polite"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.6rem',
            padding: '0.55rem 0.8rem',
            borderRadius: '0.65rem',
            background: 'var(--accent-light)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            fontSize: '0.82rem',
            fontWeight: '600',
            color: 'var(--accent-main)',
          }}
        >
          <span>Listening in {supportedLanguages.find((l) => l.code === language)?.name || language}... Speak clearly, then review your text before searching.</span>
          <button
            type="button"
            onClick={stopListening}
            style={{
              padding: '0.25rem 0.65rem',
              borderRadius: '9999px',
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
        </div>
      )}

      {/* Denied / Empty / Error Alert Banner */}
      {errorInfo && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '0.65rem',
            padding: '0.7rem 0.85rem',
            borderRadius: '0.75rem',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            fontSize: '0.8rem',
            color: 'var(--text-primary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: '0.1rem' }} aria-hidden="true" />
            <div>
              <div style={{ fontWeight: '700', color: '#ef4444' }}>{errorInfo.title}</div>
              <div style={{ color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{errorInfo.message}</div>
              {errorInfo.canRetry && supported && (
                <button
                  type="button"
                  onClick={requestStartListening}
                  style={{
                    marginTop: '0.4rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.25rem 0.6rem',
                    borderRadius: '9999px',
                    border: '1px solid var(--border-main)',
                    background: 'var(--bg-main)',
                    color: 'var(--text-primary)',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  <RotateCcw size={12} aria-hidden="true" />
                  <span>Try speaking again</span>
                </button>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={dismissError}
            aria-label="Dismiss voice notice"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              padding: '0.15rem',
            }}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Editable Transcript Review Box (before submission) */}
      {showTranscriptInput && (isListening || hasTranscript || status === VOICE_STATUS.REVIEW) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          <label
            htmlFor={transcriptInputId}
            style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-secondary)' }}
          >
            Review or edit spoken transcript before sending:
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <input
              id={transcriptInputId}
              type="text"
              value={transcriptDraft}
              onChange={(e) => setTranscriptDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && transcriptDraft.trim()) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Spoken words appear here — edit or type manually..."
              style={{
                flex: '1 1 220px',
                minWidth: 0,
                padding: '0.55rem 0.8rem',
                borderRadius: '0.65rem',
                border: '1px solid var(--border-main)',
                background: 'var(--bg-main)',
                color: 'var(--text-primary)',
                fontSize: '0.88rem',
              }}
            />

            {onSubmitQuery && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!hasTranscript}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.52rem 0.9rem',
                  borderRadius: '9999px',
                  border: 'none',
                  background: hasTranscript ? 'var(--accent-main)' : 'var(--glass-bg)',
                  color: hasTranscript ? 'var(--bg-main)' : 'var(--text-tertiary)',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  cursor: hasTranscript ? 'pointer' : 'not-allowed',
                }}
              >
                <Check size={14} aria-hidden="true" />
                <span>{submitLabel}</span>
              </button>
            )}

            {hasTranscript && (
              <button
                type="button"
                onClick={clearTranscript}
                aria-label="Clear voice transcript"
                style={{
                  padding: '0.5rem 0.7rem',
                  borderRadius: '9999px',
                  border: '1px solid var(--border-light)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Pronunciation-Tolerant Matched Civic Service Suggestions */}
      {hasTranscript && matchResult?.matches?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.75rem',
              fontWeight: '700',
              color: 'var(--text-secondary)',
            }}
          >
            <Sparkles size={13} color="var(--accent-main)" aria-hidden="true" />
            <span>Pronunciation-tolerant matches:</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {matchResult.matches.slice(0, 3).map((match) => (
              <button
                key={match.service.id}
                type="button"
                onClick={() => {
                  if (onSelectService) {
                    onSelectService(match);
                  } else {
                    setTranscriptDraft(match.service.name);
                  }
                }}
                title={match.matchReason}
                style={{
                  padding: '0.3rem 0.65rem',
                  borderRadius: '9999px',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  background: 'var(--accent-light)',
                  color: 'var(--accent-main)',
                  fontSize: '0.76rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                {match.service.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Privacy & Keyboard Assurance Footer */}
      <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
        No raw audio is saved by Civic Help Setu. You can always type or edit with a keyboard.
      </div>
    </div>
  );
}
