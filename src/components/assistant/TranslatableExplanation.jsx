import { useState, useMemo, useContext } from 'react';
import { Globe, RotateCcw, AlertCircle, Info, ChevronDown } from 'lucide-react';
import { LanguageContext } from '../../context/LanguageContext';
import {
  translateExplanationText,
  INFORMATIONAL_TRANSLATION_NOTICE,
  TRANSLATION_FALLBACK_MESSAGE,
} from '../../services/aiExplanationTranslationService';
import { SUPPORTED_LANGUAGES, SOURCE_LANGUAGE } from '../../utils/languagePreference';

export default function TranslatableExplanation({
  text,
  className = '',
  style = {},
}) {
  const langCtx = useContext(LanguageContext);
  const interfaceLanguage = langCtx?.language || SOURCE_LANGUAGE;
  const [targetLang, setTargetLang] = useState(() =>
    interfaceLanguage !== SOURCE_LANGUAGE ? interfaceLanguage : SOURCE_LANGUAGE
  );
  const [viewOriginal, setViewOriginal] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Perform translation when targetLang is not English and user has not toggled viewOriginal
  const translation = useMemo(() => {
    if (!text || targetLang === SOURCE_LANGUAGE) {
      return null;
    }
    return translateExplanationText(text, targetLang);
  }, [text, targetLang]);

  if (!text || typeof text !== 'string') {
    return null;
  }

  const isTranslatedActive =
    translation && translation.isTranslated && !viewOriginal;
  const isFailed = translation && translation.status === 'error';

  const displayedText = isTranslatedActive
    ? translation.translatedText
    : text;

  const currentLangMeta =
    SUPPORTED_LANGUAGES.find((l) => l.code === targetLang) ||
    SUPPORTED_LANGUAGES[0];

  const handleSelectLanguage = (langCode) => {
    setTargetLang(langCode);
    setViewOriginal(false);
    setDropdownOpen(false);
  };

  return (
    <div
      className={`translatable-explanation ${className}`.trim()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        ...style,
      }}
    >
      {/* Explanation Text */}
      <div style={{ position: 'relative' }}>
        <p
          style={{
            margin: 0,
            fontSize: '1.05rem',
            color: 'var(--text-secondary, #cbd5e1)',
            lineHeight: '1.6',
          }}
        >
          {displayedText}
        </p>
      </div>

      {/* Translation Toolbar & Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.6rem',
          marginTop: '0.25rem',
          fontSize: '0.8rem',
        }}
      >
        {/* Language Selection Dropdown Trigger */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setDropdownOpen((prev) => !prev)}
            aria-expanded={dropdownOpen}
            aria-label="Select explanation translation language"
            className="btn btn-secondary"
            style={{
              padding: '0.25rem 0.6rem',
              fontSize: '0.78rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              borderRadius: '99px',
              backgroundColor: isTranslatedActive
                ? 'rgba(56, 189, 248, 0.12)'
                : 'var(--glass-bg, rgba(255, 255, 255, 0.05))',
              borderColor: isTranslatedActive
                ? 'var(--accent-main, #38bdf8)'
                : 'var(--border-light, rgba(255, 255, 255, 0.1))',
              color: isTranslatedActive
                ? 'var(--accent-main, #38bdf8)'
                : 'var(--text-secondary, #94a3b8)',
            }}
          >
            <Globe size={13} />
            <span>
              {isTranslatedActive
                ? `${currentLangMeta.native}`
                : 'Translate'}
            </span>
            <ChevronDown size={12} />
          </button>

          {/* Supported Languages Dropdown */}
          {dropdownOpen && (
            <div
              role="menu"
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                zIndex: 50,
                minWidth: '150px',
                backgroundColor: 'var(--bg-card, #1e293b)',
                border: '1px solid var(--border-main, rgba(255, 255, 255, 0.15))',
                borderRadius: '0.5rem',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
                padding: '0.35rem',
                display: 'grid',
                gap: '0.2rem',
              }}
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  role="menuitem"
                  onClick={() => handleSelectLanguage(lang.code)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '0.4rem 0.6rem',
                    borderRadius: '0.35rem',
                    border: 'none',
                    backgroundColor:
                      targetLang === lang.code && !viewOriginal
                        ? 'rgba(56, 189, 248, 0.15)'
                        : 'transparent',
                    color:
                      targetLang === lang.code && !viewOriginal
                        ? 'var(--accent-main, #38bdf8)'
                        : 'var(--text-primary, #f8fafc)',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span>{lang.native}</span>
                  <small style={{ color: 'var(--text-tertiary, #94a3b8)' }}>
                    {lang.code.toUpperCase()}
                  </small>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick Interface Language Translate Suggestion */}
        {interfaceLanguage !== SOURCE_LANGUAGE &&
          targetLang === SOURCE_LANGUAGE && (
            <button
              type="button"
              onClick={() => handleSelectLanguage(interfaceLanguage)}
              style={{
                background: 'transparent',
                border: '1px dashed var(--accent-main, #38bdf8)',
                borderRadius: '99px',
                padding: '0.2rem 0.55rem',
                fontSize: '0.75rem',
                color: 'var(--accent-main, #38bdf8)',
                cursor: 'pointer',
              }}
            >
              Translate to {SUPPORTED_LANGUAGES.find((l) => l.code === interfaceLanguage)?.native}
            </button>
          )}

        {/* Show Original Toggle */}
        {translation && translation.isTranslated && (
          <button
            type="button"
            onClick={() => setViewOriginal((prev) => !prev)}
            aria-label={
              viewOriginal ? 'Show translation' : 'Show original English text'
            }
            style={{
              background: 'transparent',
              border: 'none',
              padding: '0.2rem 0.4rem',
              color: 'var(--text-tertiary, #94a3b8)',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontSize: '0.78rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            <RotateCcw size={12} />
            {viewOriginal ? 'Show translation' : 'Show original (English)'}
          </button>
        )}
      </div>

      {/* Informational Translation Notice */}
      {isTranslatedActive && (
        <div
          role="note"
          aria-label="Informational translation disclaimer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.72rem',
            color: 'var(--text-tertiary, #94a3b8)',
            padding: '0.25rem 0.5rem',
            borderRadius: '0.35rem',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            width: 'fit-content',
          }}
          title={INFORMATIONAL_TRANSLATION_NOTICE}
        >
          <Info size={12} color="var(--accent-main, #38bdf8)" style={{ flexShrink: 0 }} />
          <span>Informational translation only &bull; Not an official notice</span>
        </div>
      )}

      {/* Translation Failure Fallback Banner */}
      {isFailed && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.75rem',
            color: '#f59e0b',
            padding: '0.3rem 0.6rem',
            borderRadius: '0.35rem',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            width: 'fit-content',
          }}
        >
          <AlertCircle size={13} style={{ flexShrink: 0 }} />
          <span>{TRANSLATION_FALLBACK_MESSAGE}</span>
        </div>
      )}
    </div>
  );
}
