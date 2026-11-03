import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  resolveMultilingualVoiceQuery,
  generateSpokenServiceSummary,
  speakTextAloud,
  stopSpeaking,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  SUPPORTED_VOICE_LANGUAGES,
  VERNACULAR_INTENTS,
} from './multilingualVoiceNavigationService.js';

describe('multilingualVoiceNavigationService', () => {
  const mockCatalog = [
    {
      id: 'ration-card',
      name: 'Ration Card Application',
      category: 'Food Security',
      department: 'Department of Food & Public Distribution',
      fees: 'Rs. 20',
      processingTime: '15 to 30 days',
      description: 'Subsidized grain card for BPL and priority families.',
    },
    {
      id: 'driving-license',
      name: 'Driving Licence Issuance',
      category: 'Transport',
      department: 'Regional Transport Office (RTO)',
      fees: 'Rs. 200',
      processingTime: '7 days',
      description: 'Learner and permanent motor vehicle driving license.',
    },
    {
      id: 'voter-id',
      name: 'Voter ID Registration',
      category: 'Elections',
      department: 'Election Commission of India',
      fees: 'Free of Cost',
      processingTime: '21 days',
      description: 'Voter identity card registration.',
    },
    {
      id: 'aadhaar-update',
      name: 'Aadhaar Card Demographic Update',
      category: 'Identity',
      department: 'UIDAI',
      fees: 'Rs. 50',
      processingTime: '3 to 5 days',
      description: 'Update address or mobile number on Aadhaar.',
    },
  ];

  it('resolves Hindi spoken query for ration card', () => {
    const query = 'मुझे नया राशन कार्ड बनवाना है';
    const result = resolveMultilingualVoiceQuery(query, 'hi-IN', mockCatalog);

    expect(result.isValid).toBe(true);
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.topMatch.service.id).toBe('ration-card');
    expect(result.topMatch.isIntentMatch).toBe(true);
    expect(result.topMatch.matchReason).toContain('राशन कार्ड');
  });

  it('resolves Hindi spoken query for driving license', () => {
    const query = 'गाड़ी चलाने का ड्राइविंग लाइसेंस कैसे मिलेगा';
    const result = resolveMultilingualVoiceQuery(query, 'hi-IN', mockCatalog);

    expect(result.isValid).toBe(true);
    expect(result.topMatch.service.id).toBe('driving-license');
  });

  it('resolves English colloquial query for voter id and learners license', () => {
    const query = 'I need to apply for a voter id card for elections';
    const result = resolveMultilingualVoiceQuery(query, 'en-IN', mockCatalog);

    expect(result.isValid).toBe(true);
    expect(result.topMatch.service.id).toBe('voter-id');
  });

  it('resolves Bengali regional intent for voter card', () => {
    const query = 'নতুন ভোটার কার্ড আবেদন করতে চাই';
    const result = resolveMultilingualVoiceQuery(query, 'bn-IN', mockCatalog);

    expect(result.isValid).toBe(true);
    expect(result.topMatch.service.id).toBe('voter-id');
  });

  it('resolves Tamil regional intent for driving license', () => {
    const query = 'புதிய ஓட்டுநர் உரிமம் வேண்டும்';
    const result = resolveMultilingualVoiceQuery(query, 'ta-IN', mockCatalog);

    expect(result.isValid).toBe(true);
    expect(result.topMatch.service.id).toBe('driving-license');
  });

  it('resolves Telugu regional intent for ration card', () => {
    const query = 'కొత్త రేషన్ కార్డు కావాలి';
    const result = resolveMultilingualVoiceQuery(query, 'te-IN', mockCatalog);

    expect(result.isValid).toBe(true);
    expect(result.topMatch.service.id).toBe('ration-card');
  });

  it('generates accessible spoken service summary in English and Hindi', () => {
    const service = mockCatalog[0];

    const enSummary = generateSpokenServiceSummary(service, 'en-IN');
    expect(enSummary).toContain('Service: Ration Card Application');
    expect(enSummary).toContain('Department of Food');
    expect(enSummary).toContain('Rs. 20');
    expect(enSummary).toContain('15 to 30 days');

    const hiSummary = generateSpokenServiceSummary(service, 'hi-IN');
    expect(hiSummary).toContain('सेवा का नाम: Ration Card Application');
    expect(hiSummary).toContain('सरकारी शुल्क: Rs. 20');
  });

  it('handles empty query input safely', () => {
    const result = resolveMultilingualVoiceQuery('', 'en-IN', mockCatalog);
    expect(result.isValid).toBe(false);
    expect(result.matches.length).toBe(0);
  });

  it('supports speech synthesis controls and mock fallback', () => {
    const mockSynth = {
      cancel: vi.fn(),
      speak: vi.fn(),
    };
    const mockUtterance = vi.fn();

    vi.stubGlobal('speechSynthesis', mockSynth);
    vi.stubGlobal('SpeechSynthesisUtterance', mockUtterance);

    const spoken = speakTextAloud('Hello Civic Help Setu', 'en-IN');
    expect(spoken).toBe(true);
    expect(mockSynth.cancel).toHaveBeenCalled();
    expect(mockSynth.speak).toHaveBeenCalled();

    stopSpeaking();
    expect(mockSynth.cancel).toHaveBeenCalledTimes(2);
  });

  it('provides list of supported Indian languages and intents', () => {
    expect(SUPPORTED_VOICE_LANGUAGES.length).toBeGreaterThanOrEqual(6);
    expect(SUPPORTED_VOICE_LANGUAGES.some((l) => l.code === 'hi-IN')).toBe(true);
    expect(SUPPORTED_VOICE_LANGUAGES.some((l) => l.code === 'en-IN')).toBe(true);
    expect(VERNACULAR_INTENTS.length).toBeGreaterThanOrEqual(5);
  });
});
