import { useState, useRef, useEffect, useCallback, useMemo, useContext } from 'react';
import { LanguageContext } from '../context/LanguageContext';
import {
  VOICE_STATUS,
  VOICE_SUPPORTED_LANGUAGES,
  isVoiceRecognitionSupported,
  normalizeVoiceLanguage,
  readVoiceConsent,
  writeVoiceConsent,
  queryMicrophonePermission,
  classifyRecognitionError,
  createVoiceRecognitionSession,
  matchSpokenCivicQuery,
} from '../utils/voiceSearch';

/**
 * Shared state & lifecycle hook for voice-first civic search and assistant input.
 * Keeps microphone access strictly user-initiated, requires consent disclosure before
 * recording, exposes an editable transcript before submission, and retains zero raw audio.
 */
export function useVoiceSearch({
  initialLanguage,
  initialTranscript = '',
  onTranscriptChange,
  catalogOverride = null,
} = {}) {
  const languageContext = useContext(LanguageContext);
  const appLocale = languageContext?.language || 'en';

  const [language, setLanguage] = useState(() =>
    normalizeVoiceLanguage(initialLanguage, appLocale)
  );
  const [status, setStatus] = useState(() =>
    isVoiceRecognitionSupported() ? VOICE_STATUS.IDLE : VOICE_STATUS.UNSUPPORTED
  );
  const [transcriptDraft, setTranscriptDraft] = useState(initialTranscript);
  const [hasConsent, setHasConsent] = useState(() => readVoiceConsent());
  const [showConsentPrompt, setShowConsentPrompt] = useState(false);
  const [showLimitations, setShowLimitations] = useState(false);
  const [errorInfo, setErrorInfo] = useState(null);
  const [permissionState, setPermissionState] = useState('unknown');

  const sessionRef = useRef(null);
  const userPickedLanguageRef = useRef(Boolean(initialLanguage));
  const supported = isVoiceRecognitionSupported();
  const isListening = status === VOICE_STATUS.LISTENING;

  useEffect(() => {
    if (!initialLanguage && !userPickedLanguageRef.current) {
      setLanguage(normalizeVoiceLanguage(null, appLocale));
    }
  }, [appLocale, initialLanguage]);

  const handleSetLanguage = useCallback((nextLang) => {
    userPickedLanguageRef.current = true;
    setLanguage(nextLang);
  }, []);

  useEffect(() => {
    let active = true;
    queryMicrophonePermission().then((res) => {
      if (active && res?.state) {
        setPermissionState(res.state);
        if (res.state === 'denied') {
          setStatus(VOICE_STATUS.DENIED);
          setErrorInfo(classifyRecognitionError('not-allowed'));
        }
      }
    });
    return () => {
      active = false;
      sessionRef.current?.abort?.();
    };
  }, []);

  const updateTranscriptDraft = useCallback(
    (nextValue) => {
      setTranscriptDraft(nextValue);
      onTranscriptChange?.(nextValue);
      if (nextValue.trim() && status !== VOICE_STATUS.LISTENING) {
        setStatus(VOICE_STATUS.REVIEW);
      }
    },
    [onTranscriptChange, status]
  );

  const stopListening = useCallback(() => {
    sessionRef.current?.stop?.();
    sessionRef.current = null;
    setStatus((prev) => {
      if (prev !== VOICE_STATUS.LISTENING) return prev;
      return transcriptDraft.trim() ? VOICE_STATUS.REVIEW : VOICE_STATUS.IDLE;
    });
  }, [transcriptDraft]);

  const cancelListening = useCallback(() => {
    sessionRef.current?.abort?.();
    sessionRef.current = null;
    setShowConsentPrompt(false);
    setStatus(transcriptDraft.trim() ? VOICE_STATUS.REVIEW : VOICE_STATUS.IDLE);
  }, [transcriptDraft]);

  const beginRecognition = useCallback(
    (targetLang = language) => {
      setErrorInfo(null);
      setShowConsentPrompt(false);

      if (!isVoiceRecognitionSupported()) {
        const unsupported = classifyRecognitionError('unsupported');
        setStatus(VOICE_STATUS.UNSUPPORTED);
        setErrorInfo(unsupported);
        return false;
      }

      sessionRef.current?.abort?.();
      const session = createVoiceRecognitionSession({
        language: targetLang,
        interimResults: true,
        continuous: false,
        onStart: () => {
          setStatus(VOICE_STATUS.LISTENING);
          setErrorInfo(null);
        },
        onTranscript: ({ transcript }) => {
          setTranscriptDraft(transcript);
          onTranscriptChange?.(transcript);
        },
        onEmpty: (emptyInfo) => {
          setStatus(VOICE_STATUS.EMPTY);
          setErrorInfo(emptyInfo);
        },
        onError: (classified) => {
          sessionRef.current = null;
          setStatus(classified.status);
          setErrorInfo(classified);
          if (classified.status === VOICE_STATUS.DENIED) {
            setPermissionState('denied');
          }
        },
        onEnd: ({ receivedTranscript }) => {
          sessionRef.current = null;
          setStatus((current) => {
            if (
              current === VOICE_STATUS.DENIED ||
              current === VOICE_STATUS.ERROR ||
              current === VOICE_STATUS.EMPTY ||
              current === VOICE_STATUS.UNSUPPORTED
            ) {
              return current;
            }
            return receivedTranscript ? VOICE_STATUS.REVIEW : VOICE_STATUS.IDLE;
          });
        },
      });

      if (!session.ok) {
        setStatus(session.status);
        setErrorInfo(session.error);
        return false;
      }

      sessionRef.current = session;
      return true;
    },
    [language, onTranscriptChange]
  );

  const requestStartListening = useCallback(async () => {
    if (isListening) {
      stopListening();
      return;
    }

    if (!isVoiceRecognitionSupported()) {
      const unsupported = classifyRecognitionError('unsupported');
      setStatus(VOICE_STATUS.UNSUPPORTED);
      setErrorInfo(unsupported);
      return;
    }

    const perm = await queryMicrophonePermission();
    setPermissionState(perm.state);
    if (perm.state === 'denied') {
      const denied = classifyRecognitionError('not-allowed');
      setStatus(VOICE_STATUS.DENIED);
      setErrorInfo(denied);
      return;
    }

    if (!hasConsent) {
      setStatus(VOICE_STATUS.CONSENT_REQUIRED);
      setShowConsentPrompt(true);
      setErrorInfo(null);
      return;
    }

    beginRecognition(language);
  }, [beginRecognition, hasConsent, isListening, language, stopListening]);

  const confirmConsentAndStart = useCallback(() => {
    writeVoiceConsent(true);
    setHasConsent(true);
    setShowConsentPrompt(false);
    beginRecognition(language);
  }, [beginRecognition, language]);

  const dismissConsent = useCallback(() => {
    setShowConsentPrompt(false);
    setStatus(transcriptDraft.trim() ? VOICE_STATUS.REVIEW : VOICE_STATUS.IDLE);
  }, [transcriptDraft]);

  const clearTranscript = useCallback(() => {
    setTranscriptDraft('');
    onTranscriptChange?.('');
    setErrorInfo(null);
    if (!isListening) {
      setStatus(VOICE_STATUS.IDLE);
    }
  }, [isListening, onTranscriptChange]);

  const dismissError = useCallback(() => {
    setErrorInfo(null);
    setStatus(transcriptDraft.trim() ? VOICE_STATUS.REVIEW : VOICE_STATUS.IDLE);
  }, [transcriptDraft]);

  const matchResult = useMemo(
    () => matchSpokenCivicQuery(transcriptDraft, language, catalogOverride),
    [transcriptDraft, language, catalogOverride]
  );

  return {
    status,
    supported,
    isListening,
    language,
    setLanguage: handleSetLanguage,
    supportedLanguages: VOICE_SUPPORTED_LANGUAGES,
    transcriptDraft,
    setTranscriptDraft: updateTranscriptDraft,
    hasConsent,
    showConsentPrompt,
    showLimitations,
    setShowLimitations,
    errorInfo,
    permissionState,
    matchResult,
    requestStartListening,
    stopListening,
    cancelListening,
    confirmConsentAndStart,
    dismissConsent,
    clearTranscript,
    dismissError,
  };
}
