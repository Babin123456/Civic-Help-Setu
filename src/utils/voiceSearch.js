import { logDiagnostic } from './diagnostics';
import { resolveSpokenQuery } from '../services/voiceCivicAssistantService';
import {
  SUPPORTED_VOICE_LANGUAGES,
  resolveMultilingualVoiceQuery,
} from '../services/multilingualVoiceNavigationService';
import { resolveIndicCivicQuery } from '../services/phoneticTransliterationSearchService';

export const VOICE_CONSENT_KEY = 'civicbridge_voice_consent';

export const VOICE_STATUS = Object.freeze({
  IDLE: 'idle',
  CONSENT_REQUIRED: 'consent_required',
  LISTENING: 'listening',
  REVIEW: 'review',
  DENIED: 'denied',
  UNSUPPORTED: 'unsupported',
  EMPTY: 'empty',
  ERROR: 'error',
});

const APP_LOCALE_TO_VOICE_LANG = Object.freeze({
  en: 'en-IN',
  hi: 'hi-IN',
  bn: 'bn-IN',
  ta: 'ta-IN',
});

export const VOICE_SUPPORTED_LANGUAGES = Object.freeze(
  SUPPORTED_VOICE_LANGUAGES.map((item) => ({ ...item }))
);

export const VOICE_PERMISSION_EXPLANATION = Object.freeze({
  title: 'Microphone permission & privacy',
  summary:
    'Voice input is optional. We only listen after you press Start, and Civic Help Setu never records, stores, or uploads raw audio files.',
  browserDisclosure:
    'Your browser’s built-in Web Speech API converts speech to text. In browsers like Chrome and Edge, transient audio is processed by the browser vendor’s speech service.',
  confirmLabel: 'Allow microphone & start',
  cancelLabel: 'Type manually instead',
});

export const VOICE_LIMITATIONS_NOTICE = Object.freeze({
  title: 'Supported languages & voice limitations',
  summary:
    'Supports English (India), Hindi, Bengali, Tamil, Telugu, Marathi, and Kannada where your browser provides speech recognition.',
  limitations: [
    'Works best in Chrome, Edge, or Safari; unsupported browsers can always use manual typing and keyboard navigation.',
    'Background noise, regional accents, or legal/official terms may be misrecognized—always review and edit the transcript before searching.',
    'Some browsers require an active internet connection for speech-to-text processing.',
  ],
});

const ERROR_COPY = Object.freeze({
  denied: {
    status: VOICE_STATUS.DENIED,
    title: 'Microphone permission denied',
    message:
      'Voice search could not access your microphone. Allow microphone access in your browser settings to try again, or type your question manually.',
    canRetry: false,
  },
  empty: {
    status: VOICE_STATUS.EMPTY,
    title: 'No speech detected',
    message:
      'We did not catch any words. Tap Start to speak again clearly, or type your query manually.',
    canRetry: true,
  },
  unsupported: {
    status: VOICE_STATUS.UNSUPPORTED,
    title: 'Voice input unavailable in this browser',
    message:
      'This browser does not support Web Speech recognition. Use Chrome, Edge, or Safari for voice input, or type your query manually.',
    canRetry: false,
  },
  'audio-capture': {
    status: VOICE_STATUS.ERROR,
    title: 'No working microphone found',
    message:
      'No microphone input device could be accessed. Check your microphone connection or type your query manually.',
    canRetry: true,
  },
  network: {
    status: VOICE_STATUS.ERROR,
    title: 'Speech service connection failed',
    message:
      'Speech recognition could not reach the browser speech service. Check your connection or type your query manually.',
    canRetry: true,
  },
  'language-not-supported': {
    status: VOICE_STATUS.ERROR,
    title: 'Selected voice language unavailable',
    message:
      'Your browser does not support speech recognition for the selected language. Try English (India) or type manually.',
    canRetry: true,
  },
  aborted: {
    status: VOICE_STATUS.ERROR,
    title: 'Voice input stopped',
    message: 'Speech recognition was interrupted before finishing. You can try again or type manually.',
    canRetry: true,
  },
  unknown: {
    status: VOICE_STATUS.ERROR,
    title: 'Voice recognition failed',
    message: 'Could not recognize speech right now. Please try again or type your query manually.',
    canRetry: true,
  },
});

export function voiceLangFromAppLocale(locale = 'en') {
  const normalized = String(locale || 'en').trim().toLowerCase().split('-')[0];
  return APP_LOCALE_TO_VOICE_LANG[normalized] || 'en-IN';
}

export function isSupportedVoiceLanguage(code) {
  return VOICE_SUPPORTED_LANGUAGES.some((lang) => lang.code === code);
}

export function normalizeVoiceLanguage(code, fallbackLocale = 'en') {
  if (isSupportedVoiceLanguage(code)) return code;
  return voiceLangFromAppLocale(fallbackLocale);
}

export function getSpeechRecognitionConstructor(win = typeof window !== 'undefined' ? window : globalThis) {
  if (!win) return null;
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

export function isVoiceRecognitionSupported(win = typeof window !== 'undefined' ? window : globalThis) {
  return Boolean(getSpeechRecognitionConstructor(win));
}

export function readVoiceConsent(storage = typeof sessionStorage !== 'undefined' ? sessionStorage : null) {
  try {
    return storage?.getItem?.(VOICE_CONSENT_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeVoiceConsent(
  consented,
  storage = typeof sessionStorage !== 'undefined' ? sessionStorage : null
) {
  try {
    if (!storage) return;
    if (consented) storage.setItem(VOICE_CONSENT_KEY, '1');
    else storage.removeItem(VOICE_CONSENT_KEY);
  } catch (err) {
    logDiagnostic('Failed to persist voice consent state', err);
  }
}

export async function queryMicrophonePermission(nav = typeof navigator !== 'undefined' ? navigator : null) {
  try {
    if (!nav?.permissions?.query) return { state: 'unknown', status: null };
    const status = await nav.permissions.query({ name: 'microphone' });
    return { state: status?.state || 'unknown', status };
  } catch {
    return { state: 'unknown', status: null };
  }
}

export function classifyRecognitionError(errorCode = '') {
  const code = String(errorCode || '').trim().toLowerCase();
  if (code === 'not-allowed' || code === 'service-not-allowed') {
    return { ...ERROR_COPY.denied, code };
  }
  if (code === 'no-speech') {
    return { ...ERROR_COPY.empty, code };
  }
  if (code === 'unsupported') {
    return { ...ERROR_COPY.unsupported, code };
  }
  if (code in ERROR_COPY) {
    return { ...ERROR_COPY[code], code };
  }
  return { ...ERROR_COPY.unknown, code: code || 'unknown' };
}

export function extractSpeechTranscript(event) {
  const results = event?.results;
  if (!results || typeof results.length !== 'number') {
    return { transcript: '', isFinal: false, isEmpty: true };
  }

  const parts = [];
  let isFinal = false;

  for (let i = 0; i < results.length; i += 1) {
    const result = results[i];
    const alternative = result?.[0];
    const text = typeof alternative?.transcript === 'string' ? alternative.transcript : '';
    if (text) parts.push(text);
    if (result?.isFinal) isFinal = true;
  }

  const transcript = parts.join(' ').replace(/\s+/g, ' ').trim();
  return {
    transcript,
    isFinal,
    isEmpty: transcript.length === 0,
  };
}

/**
 * Starts a transcript-only Web Speech API session. Never captures or retains raw audio.
 */
export function createVoiceRecognitionSession({
  windowObj = typeof window !== 'undefined' ? window : globalThis,
  language = 'en-IN',
  interimResults = true,
  continuous = false,
  onStart,
  onTranscript,
  onEmpty,
  onError,
  onEnd,
} = {}) {
  const SpeechRecognition = getSpeechRecognitionConstructor(windowObj);
  if (!SpeechRecognition) {
    const unsupported = classifyRecognitionError('unsupported');
    onError?.(unsupported);
    return { ok: false, status: unsupported.status, error: unsupported };
  }

  let recognition;
  try {
    recognition = new SpeechRecognition();
  } catch (err) {
    logDiagnostic('Failed to construct SpeechRecognition', err);
    const failure = classifyRecognitionError('audio-capture');
    onError?.(failure);
    return { ok: false, status: failure.status, error: failure };
  }

  let receivedNonEmptyTranscript = false;
  let receivedTerminalError = false;
  let stoppedByUser = false;

  recognition.lang = normalizeVoiceLanguage(language);
  recognition.interimResults = Boolean(interimResults);
  recognition.continuous = Boolean(continuous);
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    onStart?.();
  };

  recognition.onresult = (event) => {
    const extracted = extractSpeechTranscript(event);
    if (!extracted.isEmpty) {
      receivedNonEmptyTranscript = true;
      onTranscript?.(extracted);
    } else if (extracted.isFinal && !receivedNonEmptyTranscript) {
      const emptyInfo = classifyRecognitionError('no-speech');
      onEmpty?.(emptyInfo);
    }
  };

  recognition.onerror = (event) => {
    receivedTerminalError = true;
    const classified = classifyRecognitionError(event?.error);
    if (classified.status === VOICE_STATUS.EMPTY) {
      onEmpty?.(classified);
    } else {
      onError?.(classified);
    }
  };

  recognition.onend = () => {
    if (!receivedNonEmptyTranscript && !receivedTerminalError && !stoppedByUser) {
      const emptyInfo = classifyRecognitionError('no-speech');
      onEmpty?.(emptyInfo);
    }
    onEnd?.({
      receivedTranscript: receivedNonEmptyTranscript,
      stoppedByUser,
    });
  };

  try {
    recognition.start();
  } catch (err) {
    logDiagnostic('Failed to start SpeechRecognition', err);
    const failure = classifyRecognitionError('audio-capture');
    onError?.(failure);
    return { ok: false, status: failure.status, error: failure };
  }

  return {
    ok: true,
    status: VOICE_STATUS.LISTENING,
    stop() {
      stoppedByUser = true;
      try {
        recognition.stop?.();
      } catch (err) {
        logDiagnostic('Failed to stop SpeechRecognition', err);
      }
    },
    abort() {
      stoppedByUser = true;
      try {
        recognition.abort?.();
      } catch (err) {
        logDiagnostic('Failed to abort SpeechRecognition', err);
      }
    },
  };
}

/**
 * Pronunciation-tolerant and multilingual matching for reviewed voice transcripts.
 */
export function matchSpokenCivicQuery(transcript = '', languageCode = 'en-IN', catalogOverride = null) {
  const clean = String(transcript || '').replace(/\s+/g, ' ').trim();
  if (!clean) {
    return {
      query: '',
      canonicalMatch: null,
      indicExpansion: null,
      matches: [],
    };
  }

  const aliasMatch = resolveSpokenQuery(clean);
  const multilingual = resolveMultilingualVoiceQuery(clean, languageCode, catalogOverride);
  const indicExpansion = resolveIndicCivicQuery(clean);

  const matches = [...(multilingual?.matches || [])];
  if (indicExpansion?.hasIndicMatch && indicExpansion.expandedKeywords.length > 0) {
    const expandedMatches = resolveMultilingualVoiceQuery(
      indicExpansion.expandedKeywords.join(' '),
      languageCode,
      catalogOverride
    );
    (expandedMatches?.matches || []).forEach((item) => {
      if (!matches.some((existing) => existing.service?.id === item.service?.id)) {
        matches.push({
          ...item,
          matchReason: `Pronunciation-tolerant match via "${indicExpansion.matchedEntries[0]?.colloquial}".`,
        });
      }
    });
  }

  if (
    aliasMatch?.targetServiceId &&
    !matches.some((m) => m.service?.id === aliasMatch.targetServiceId)
  ) {
    matches.unshift({
      service: {
        id: aliasMatch.targetServiceId,
        name: aliasMatch.canonicalName,
      },
      score: 92,
      matchReason: `Pronunciation-tolerant match for "${aliasMatch.canonicalName}".`,
      isIntentMatch: true,
    });
  }

  return {
    query: clean,
    canonicalMatch: aliasMatch?.targetServiceId ? aliasMatch : null,
    indicExpansion,
    matches: matches.slice(0, 5),
  };
}
