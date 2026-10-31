import { describe, it, expect } from 'vitest';
import {
  routeUserIntent,
  CONFIDENCE_THRESHOLD,
  INTENT_DEFINITIONS
} from './multilingualIntentRouterService';

describe('multilingualIntentRouterService', () => {
  it('classifies English requests into exact app intents', () => {
    const r1 = routeUserIntent('where can i apply for a new driving license?');
    expect(r1.intent).toBe('FIND_SERVICE');
    expect(r1.isConfident).toBe(true);
    expect(r1.definition.route).toBe('/services');

    const r2 = routeUserIntent('what documents required for birth certificate registration?');
    expect(r2.intent).toBe('UNDERSTAND_DOCUMENTS');
    expect(r2.isConfident).toBe(true);
    expect(r2.definition.route).toBe('/vault');

    const r3 = routeUserIntent('am i eligible for pm kisan with 2 acres land and income limit?');
    expect(r3.intent).toBe('CHECK_ELIGIBILITY');
    expect(r3.definition.route).toBe('/eligibility');

    const r4 = routeUserIntent('where is the nearest rto office location and address?');
    expect(r4.intent).toBe('LOCATE_OFFICE');
    expect(r4.definition.route).toBe('/nearby-offices');
  });

  it('classifies Devanagari Hindi queries accurately', () => {
    const hindi1 = routeUserIntent('राशन कार्ड के लिए आवेदन कैसे करें');
    expect(hindi1.intent).toBe('FIND_SERVICE');

    const hindi2 = routeUserIntent('आय प्रमाण पत्र के लिए क्या दस्तावेज़ चाहिए?');
    expect(hindi2.intent).toBe('UNDERSTAND_DOCUMENTS');

    const hindi3 = routeUserIntent('नजदीकी तहसील कार्यालय कहाँ स्थित है?');
    expect(hindi3.intent).toBe('LOCATE_OFFICE');
  });

  it('classifies Hinglish transliterated requests', () => {
    const hinglish1 = routeUserIntent('tehsil office kidhar hai aur address kya hai');
    expect(hinglish1.intent).toBe('LOCATE_OFFICE');

    const hinglish2 = routeUserIntent('mera income certificate eligible hu kya scheme ke liye');
    expect(hinglish2.intent).toBe('CHECK_ELIGIBILITY');
  });

  it('routes tracking requests to /track without inferring an application status', () => {
    const trackReq = routeUserIntent('where is my application and how to check status with reference id?');
    expect(trackReq.intent).toBe('TRACK_APPLICATION');
    expect(trackReq.definition.route).toBe('/track');
    // Crucial: No fabricated application status is returned
    expect(trackReq.status).toBeUndefined();
  });

  it('provides a clarifying question when classification confidence is below threshold', () => {
    const ambiguous = routeUserIntent('hello help');
    expect(ambiguous.isConfident).toBe(false);
    expect(ambiguous.confidence).toBeLessThan(CONFIDENCE_THRESHOLD);
    expect(ambiguous.clarifyingQuestion).toContain('We could not determine your exact civic request');
    expect(ambiguous.suggestedIntents.length).toBeGreaterThan(0);
  });

  it('handles empty or whitespace queries gracefully', () => {
    const empty = routeUserIntent('');
    expect(empty.intent).toBe('GENERIC_FALLBACK');
    expect(empty.isConfident).toBe(false);
  });
});
