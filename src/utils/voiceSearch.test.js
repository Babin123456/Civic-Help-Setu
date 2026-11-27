import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  VOICE_STATUS,
  VOICE_CONSENT_KEY,
  VOICE_SUPPORTED_LANGUAGES,
  voiceLangFromAppLocale,
  normalizeVoiceLanguage,
  readVoiceConsent,
  writeVoiceConsent,
  queryMicrophonePermission,
  classifyRecognitionError,
  extractSpeechTranscript,
  createVoiceRecognitionSession,
  matchSpokenCivicQuery,
} from './voiceSearch';

const makeMemoryStorage = () => {
  const store = new Map();
  return {
    getItem: vi.fn((k) => (store.has(k) ? store.get(k) : null)),
    setItem: vi.fn((k, v) => store.set(k, String(v))),
    removeItem: vi.fn((k) => store.delete(k)),
  };
};

describe('voiceSearch helpers and recognition session', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('denied permissions', () => {
    it('classifies not-allowed and service-not-allowed as denied without auto-retry', () => {
      const notAllowed = classifyRecognitionError('not-allowed');
      expect(notAllowed.status).toBe(VOICE_STATUS.DENIED);
      expect(notAllowed.canRetry).toBe(false);
      expect(notAllowed.message).toContain('Allow microphone access');

      const serviceDenied = classifyRecognitionError('service-not-allowed');
      expect(serviceDenied.status).toBe(VOICE_STATUS.DENIED);
      expect(serviceDenied.canRetry).toBe(false);
    });

    it('invokes onError with DENIED status when recognition emits not-allowed', () => {
      let instance;
      class MockSpeechRecognition {
        constructor() {
          instance = this;
          this.start = vi.fn();
          this.stop = vi.fn();
        }
      }

      const onError = vi.fn();
      const onEmpty = vi.fn();
      const session = createVoiceRecognitionSession({
        windowObj: { SpeechRecognition: MockSpeechRecognition },
        language: 'hi-IN',
        onError,
        onEmpty,
      });

      expect(session.ok).toBe(true);
      expect(instance.lang).toBe('hi-IN');

      instance.onerror({ error: 'not-allowed' });
      instance.onend();

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0].status).toBe(VOICE_STATUS.DENIED);
      expect(onError.mock.calls[0][0].canRetry).toBe(false);
      expect(onEmpty).not.toHaveBeenCalled();
    });

    it('reads Permissions API microphone state without prompting', async () => {
      const query = vi.fn().mockResolvedValue({ state: 'denied' });
      const res = await queryMicrophonePermission({ permissions: { query } });
      expect(query).toHaveBeenCalledWith({ name: 'microphone' });
      expect(res.state).toBe('denied');
    });
  });

  describe('empty transcript handling', () => {
    it('extracts whitespace-only transcript as empty', () => {
      const res = extractSpeechTranscript({
        results: [{ 0: { transcript: '   ' }, isFinal: true }],
      });
      expect(res.transcript).toBe('');
      expect(res.isFinal).toBe(true);
      expect(res.isEmpty).toBe(true);
    });

    it('emits onEmpty when recognition fires no-speech error', () => {
      let instance;
      class MockSpeechRecognition {
        constructor() {
          instance = this;
          this.start = vi.fn();
        }
      }

      const onEmpty = vi.fn();
      const onError = vi.fn();
      createVoiceRecognitionSession({
        windowObj: { webkitSpeechRecognition: MockSpeechRecognition },
        onEmpty,
        onError,
      });

      instance.onerror({ error: 'no-speech' });
      instance.onend();

      expect(onEmpty).toHaveBeenCalledTimes(1);
      expect(onEmpty.mock.calls[0][0].status).toBe(VOICE_STATUS.EMPTY);
      expect(onEmpty.mock.calls[0][0].canRetry).toBe(true);
      expect(onError).not.toHaveBeenCalled();
    });

    it('emits onEmpty when recognition ends cleanly without producing any words', () => {
      let instance;
      class MockSpeechRecognition {
        constructor() {
          instance = this;
          this.start = vi.fn();
        }
      }

      const onEmpty = vi.fn();
      const onTranscript = vi.fn();
      createVoiceRecognitionSession({
        windowObj: { SpeechRecognition: MockSpeechRecognition },
        onEmpty,
        onTranscript,
      });

      instance.onresult({ results: [{ 0: { transcript: '   ' }, isFinal: true }] });
      instance.onend();

      expect(onTranscript).not.toHaveBeenCalled();
      expect(onEmpty).toHaveBeenCalledTimes(2);
    });
  });

  describe('recognition failure and unsupported environments', () => {
    it('returns UNSUPPORTED cleanly when Web Speech API is absent without throwing', () => {
      const onError = vi.fn();
      const session = createVoiceRecognitionSession({
        windowObj: {},
        onError,
      });

      expect(session.ok).toBe(false);
      expect(session.status).toBe(VOICE_STATUS.UNSUPPORTED);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0].status).toBe(VOICE_STATUS.UNSUPPORTED);
    });

    it.each(['audio-capture', 'network', 'language-not-supported', 'aborted'])(
      'maps %s recognition failure to recoverable ERROR status',
      (errorCode) => {
        let instance;
        class MockSpeechRecognition {
          constructor() {
            instance = this;
            this.start = vi.fn();
          }
        }

        const onError = vi.fn();
        createVoiceRecognitionSession({
          windowObj: { SpeechRecognition: MockSpeechRecognition },
          onError,
        });

        instance.onerror({ error: errorCode });
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError.mock.calls[0][0].status).toBe(VOICE_STATUS.ERROR);
        expect(onError.mock.calls[0][0].canRetry).toBe(true);
      }
    );

    it('handles SpeechRecognition.start() throwing synchronously', () => {
      class FailingSpeechRecognition {
        start() {
          throw new Error('Microphone hardware busy');
        }
      }

      const onError = vi.fn();
      const session = createVoiceRecognitionSession({
        windowObj: { SpeechRecognition: FailingSpeechRecognition },
        onError,
      });

      expect(session.ok).toBe(false);
      expect(session.status).toBe(VOICE_STATUS.ERROR);
      expect(onError).toHaveBeenCalledTimes(1);
    });

    it('never retains raw audio or calls MediaRecorder/getUserMedia', () => {
      const mediaRecorderSpy = vi.fn();
      const getUserMediaSpy = vi.fn();
      vi.stubGlobal('MediaRecorder', mediaRecorderSpy);
      vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: getUserMediaSpy } });

      let instance;
      class MockSpeechRecognition {
        constructor() {
          instance = this;
          this.start = vi.fn();
          this.stop = vi.fn();
        }
      }

      const onTranscript = vi.fn();
      const session = createVoiceRecognitionSession({
        windowObj: { SpeechRecognition: MockSpeechRecognition },
        onTranscript,
      });

      instance.onresult({
        results: [{ 0: { transcript: 'birth certificate' }, isFinal: true }],
      });
      session.stop();

      expect(onTranscript).toHaveBeenCalledWith({
        transcript: 'birth certificate',
        isFinal: true,
        isEmpty: false,
      });
      expect(mediaRecorderSpy).not.toHaveBeenCalled();
      expect(getUserMediaSpy).not.toHaveBeenCalled();
    });
  });

  describe('consent, language selection, and pronunciation-tolerant matching', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('persists explicit consent state safely', () => {
      const storage = makeMemoryStorage();
      expect(readVoiceConsent(storage)).toBe(false);
      writeVoiceConsent(true, storage);
      expect(storage.setItem).toHaveBeenCalledWith(VOICE_CONSENT_KEY, '1');
      expect(readVoiceConsent(storage)).toBe(true);
      writeVoiceConsent(false, storage);
      expect(readVoiceConsent(storage)).toBe(false);
    });

    it('maps app locales and validates supported voice languages', () => {
      expect(VOICE_SUPPORTED_LANGUAGES.length).toBeGreaterThanOrEqual(4);
      expect(voiceLangFromAppLocale('hi')).toBe('hi-IN');
      expect(voiceLangFromAppLocale('bn')).toBe('bn-IN');
      expect(voiceLangFromAppLocale('ta')).toBe('ta-IN');
      expect(voiceLangFromAppLocale('en')).toBe('en-IN');
      expect(normalizeVoiceLanguage('mr-IN')).toBe('mr-IN');
      expect(normalizeVoiceLanguage('unknown', 'hi')).toBe('hi-IN');
    });

    it('resolves colloquial and mispronounced civic terms via matchSpokenCivicQuery', () => {
      const rashan = matchSpokenCivicQuery('mujhe rashan card banwana hai', 'hi-IN');
      expect(rashan.canonicalMatch?.targetServiceId).toBe('ration-card');
      expect(rashan.matches.length).toBeGreaterThan(0);

      const aay = matchSpokenCivicQuery('aay praman patra', 'hi-IN');
      expect(aay.canonicalMatch?.targetServiceId).toBe('income-certificate');

      const dakhil = matchSpokenCivicQuery('dakhil kharij', 'hi-IN');
      expect(dakhil.indicExpansion?.hasIndicMatch).toBe(true);
      expect(dakhil.indicExpansion?.expandedKeywords).toContain('property');
      expect(dakhil.indicExpansion?.expandedKeywords).toContain('mutation');
    });
  });
});
