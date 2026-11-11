import { describe, it, expect } from 'vitest';
import {
  checkLanguageSupport,
  processRawAudioTranscript,
  confirmTranscriptByCitizen,
  convertTranscriptToAction,
  renderTranscriptReviewPrompt,
  TRANSCRIPT_STATE,
  AUDIO_DISCLAIMER,
} from './multilingualCivicAudioAssistantService.js';

describe('Multilingual Civic Audio Assistant Service', () => {
  it('identifies language capabilities and dialect limitations', () => {
    const hindi = checkLanguageSupport('hi');
    expect(hindi.supported).toBe(true);
    expect(hindi.details.name).toBe('Hindi');
    expect(hindi.details.confidenceFloor).toBe(0.7);

    const unknown = checkLanguageSupport('xx-YY');
    expect(unknown.supported).toBe(false);
    expect(unknown.details).toBeNull();
  });

  it('processes raw audio transcript and flags low confidence', () => {
    const packet = processRawAudioTranscript({
      audioId: 'rec-001',
      rawTranscript: 'mera rashan card nahi bana hai',
      langCode: 'hi',
      estimatedConfidence: 0.55, // Below Hindi floor of 0.70
    });

    expect(packet.state).toBe(TRANSCRIPT_STATE.TRANSCRIBED_PENDING_REVIEW);
    expect(packet.isLowConfidence).toBe(true);
    expect(packet.lowConfidenceNotice).toContain('Acoustic confidence is low');
    expect(packet.audioRetention).toBe('DELETED_IMMEDIATELY');
  });

  it('allows citizen to review, edit, and confirm the transcript', () => {
    const rawPacket = processRawAudioTranscript({
      audioId: 'rec-002',
      rawTranscript: 'mera ration kard nahi mila 12/03/2025 ko',
      langCode: 'hi',
      estimatedConfidence: 0.85,
    });

    const confirmed = confirmTranscriptByCitizen(
      rawPacket,
      'Mera ration card nahi mila 12/03/2025 ko PDS dukan se.'
    );

    expect(confirmed.state).toBe(TRANSCRIPT_STATE.USER_CONFIRMED);
    expect(confirmed.confirmedTranscript).toContain('PDS dukan se');
    expect(confirmed.confirmedAt).toBeDefined();
  });

  it('strictly blocks downstream action if transcript is unconfirmed', () => {
    const unconfirmedPacket = processRawAudioTranscript({
      audioId: 'rec-003',
      rawTranscript: 'street light kharab hai',
    });

    expect(() => convertTranscriptToAction(unconfirmedPacket, 'GRIEVANCE_OUTLINE')).toThrow(
      /Safety violation: Downstream civic actions cannot be generated from unconfirmed audio transcripts/
    );
  });

  it('renders transcript review prompt markdown with confidence notice', () => {
    const packet = processRawAudioTranscript({
      audioId: 'rec-005',
      rawTranscript: 'pani ki supply band hai',
      langCode: 'hi',
      estimatedConfidence: 0.5,
    });

    const promptMd = renderTranscriptReviewPrompt(packet);
    expect(promptMd).toContain('Voice Note Transcript Review');
    expect(promptMd).toContain('pani ki supply band hai');
    expect(promptMd).toContain('Acoustic confidence is low');
  });

  it('converts confirmed transcript to structured grievance while separating user facts from retrieved guidance', () => {
    const rawPacket = processRawAudioTranscript({
      audioId: 'rec-004',
      rawTranscript: 'Complaint filed on 15/04/2025 regarding contaminated drinking water.',
      langCode: 'en',
      estimatedConfidence: 0.9,
    });

    const confirmed = confirmTranscriptByCitizen(rawPacket);

    const mockRules = [
      {
        id: 'water-act-sec-3',
        title: 'Municipal Water Supply Quality Norms',
        citation: 'Municipal Corporation Act, Section 142',
        text: 'Potable water supply complaints must be inspected by health officer within 48 hours.',
      },
    ];

    const actionDossier = convertTranscriptToAction(confirmed, 'GRIEVANCE_OUTLINE', mockRules);

    expect(actionDossier.actionType).toBe('GRIEVANCE_OUTLINE');
    expect(actionDossier.userStatedFacts.statedDate).toBe('15/04/2025');
    expect(actionDossier.retrievedStatutoryGuidance.length).toBe(1);
    expect(actionDossier.retrievedStatutoryGuidance[0].citation).toContain('Section 142');
    expect(actionDossier.provenanceGuarantee).toBe('USER_CONFIRMED_FACTS_ONLY');
    expect(actionDossier.disclaimer).toBe(AUDIO_DISCLAIMER);
  });
});
