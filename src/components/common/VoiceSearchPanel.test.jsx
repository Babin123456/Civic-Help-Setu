import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import VoiceSearchPanel from './VoiceSearchPanel';
import VoiceSearchInput from './VoiceSearchInput';
import SearchBox from '../SearchBox';
import { VOICE_STATUS, VOICE_SUPPORTED_LANGUAGES } from '../../utils/voiceSearch';

function makeVoiceState(overrides = {}) {
  return {
    status: VOICE_STATUS.IDLE,
    supported: true,
    isListening: false,
    language: 'en-IN',
    setLanguage: vi.fn(),
    supportedLanguages: VOICE_SUPPORTED_LANGUAGES,
    transcriptDraft: '',
    setTranscriptDraft: vi.fn(),
    hasConsent: false,
    showConsentPrompt: false,
    showLimitations: false,
    setShowLimitations: vi.fn(),
    errorInfo: null,
    matchResult: { query: '', matches: [] },
    requestStartListening: vi.fn(),
    stopListening: vi.fn(),
    cancelListening: vi.fn(),
    confirmConsentAndStart: vi.fn(),
    dismissConsent: vi.fn(),
    clearTranscript: vi.fn(),
    dismissError: vi.fn(),
    ...overrides,
  };
}

describe('VoiceSearchPanel accessibility, consent, review, and error states', () => {
  it('renders permission explanation and consent buttons before recording', () => {
    const html = renderToStaticMarkup(
      <VoiceSearchPanel
        isOpen={true}
        voice={makeVoiceState({
          status: VOICE_STATUS.CONSENT_REQUIRED,
          showConsentPrompt: true,
        })}
      />
    );

    expect(html).toContain('Microphone permission &amp; privacy');
    expect(html).toContain('Civic Help Setu never records, stores, or uploads raw audio files');
    expect(html).toContain('Allow microphone &amp; start');
    expect(html).toContain('Type manually instead');
  });

  it('renders supported languages selector and limitations notice', () => {
    const html = renderToStaticMarkup(
      <VoiceSearchPanel
        isOpen={true}
        voice={makeVoiceState({
          showLimitations: true,
          language: 'hi-IN',
        })}
      />
    );

    expect(html).toContain('aria-label="Voice recognition language"');
    expect(html).toContain('हिन्दी (Hindi)');
    expect(html).toContain('Supported languages &amp; voice limitations');
    expect(html).toContain('Background noise, regional accents, or legal/official terms may be misrecognized');
  });

  it('renders editable transcript review box and pronunciation-tolerant matches before submission', () => {
    const html = renderToStaticMarkup(
      <VoiceSearchPanel
        isOpen={true}
        onSubmitQuery={vi.fn()}
        submitLabel="Search"
        voice={makeVoiceState({
          status: VOICE_STATUS.REVIEW,
          transcriptDraft: 'rashan card',
          matchResult: {
            query: 'rashan card',
            matches: [
              {
                service: { id: 'ration-card', name: 'Ration Card' },
                score: 92,
                matchReason: 'Pronunciation-tolerant match for "Ration Card".',
              },
            ],
          },
        })}
      />
    );

    expect(html).toContain('Review or edit spoken transcript before sending:');
    expect(html).toContain('value="rashan card"');
    expect(html).toContain('Pronunciation-tolerant matches:');
    expect(html).toContain('Ration Card');
    expect(html).toContain('Search');
    expect(html).toContain('Clear');
  });

  it('renders alert banner for denied permissions, empty transcript, and recognition failures', () => {
    const deniedHtml = renderToStaticMarkup(
      <VoiceSearchPanel
        isOpen={true}
        voice={makeVoiceState({
          status: VOICE_STATUS.DENIED,
          errorInfo: {
            status: VOICE_STATUS.DENIED,
            title: 'Microphone permission denied',
            message: 'Voice search could not access your microphone.',
            canRetry: false,
          },
        })}
      />
    );
    expect(deniedHtml).toContain('role="alert"');
    expect(deniedHtml).toContain('Microphone permission denied');
    expect(deniedHtml).not.toContain('Try speaking again');

    const emptyHtml = renderToStaticMarkup(
      <VoiceSearchPanel
        isOpen={true}
        voice={makeVoiceState({
          status: VOICE_STATUS.EMPTY,
          errorInfo: {
            status: VOICE_STATUS.EMPTY,
            title: 'No speech detected',
            message: 'We did not catch any words.',
            canRetry: true,
          },
        })}
      />
    );
    expect(emptyHtml).toContain('role="alert"');
    expect(emptyHtml).toContain('No speech detected');
    expect(emptyHtml).toContain('Try speaking again');
  });

  it('renders SearchBox and VoiceSearchInput safely without LanguageProvider', () => {
    const searchHtml = renderToStaticMarkup(
      <MemoryRouter>
        <SearchBox placeholder="Search services" />
      </MemoryRouter>
    );
    expect(searchHtml).toContain('aria-label="Voice search (optional)"');

    const navVoiceHtml = renderToStaticMarkup(<VoiceSearchInput />);
    expect(navVoiceHtml).toContain('aria-label="Start voice search"');
    expect(navVoiceHtml).toContain('Search by voice (optional)');
  });

  it('closes cleanly when isOpen is false (unless actively listening) and generates unique IDs per instance', () => {
    const closedHtml = renderToStaticMarkup(
      <VoiceSearchPanel
        isOpen={false}
        voice={makeVoiceState({
          status: VOICE_STATUS.REVIEW,
          transcriptDraft: 'birth certificate',
        })}
      />
    );
    expect(closedHtml).toBe('');

    const twoPanels = renderToStaticMarkup(
      <div>
        <VoiceSearchPanel
          isOpen={true}
          voice={makeVoiceState({ status: VOICE_STATUS.REVIEW, transcriptDraft: 'one' })}
        />
        <VoiceSearchPanel
          isOpen={true}
          voice={makeVoiceState({ status: VOICE_STATUS.REVIEW, transcriptDraft: 'two' })}
        />
      </div>
    );
    const ids = [...twoPanels.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBe(4);
    expect(new Set(ids).size).toBe(4);
  });
});
