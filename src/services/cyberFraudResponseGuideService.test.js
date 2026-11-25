import { describe, it, expect, beforeEach } from 'vitest';
import { CyberFraudResponseGuideService } from './cyberFraudResponseGuideService.js';

describe('CyberFraudResponseGuideService', () => {
  let service;

  beforeEach(() => {
    service = new CyberFraudResponseGuideService();
  });

  it('provides golden hour guidance and evidence preservation rules for UPI fraud', () => {
    const guide = service.getScenarioGuidance('UPI_PAYMENT_FRAUD');
    expect(guide.title).toContain('UPI');
    expect(guide.goldenHourAdvice).toContain('2 hour(s)');
    expect(guide.evidencePreservationChecklist.length).toBeGreaterThanOrEqual(4);
    expect(guide.strictCredentialWarning).toContain('NEVER share your OTP');
    expect(guide.officialReportingChannels.NATIONAL_CYBER_CRIME_PORTAL.tollFreeHelpline).toBe('1930');
  });

  it('provides safe isolation steps for remote access screen sharing takeover', () => {
    const guide = service.getScenarioGuidance('REMOTE_ACCESS_APP_TAKEOVER');
    expect(guide.immediateBankActions[0]).toContain('Airplane Mode');
    expect(guide.immediateBankActions[1]).toContain('Uninstall');
  });

  it('compiles local incident timeline dossier without collecting secrets', () => {
    const incident = {
      fraudCategory: 'UPI_FRAUD',
      amountINR: 15000,
      utrNumbers: ['409823198273'],
      timeline: [
        { timestamp: '2026-03-24T14:10:00Z', actor: 'Fraudster', action: 'Sent fraudulent OLX QR code via WhatsApp' },
        { timestamp: '2026-03-24T14:15:00Z', actor: 'Victim', action: 'Scanned QR code and money deducted' }
      ]
    };

    const dossier = service.compileIncidentDossier(incident);
    expect(dossier.dossierId).toMatch(/^inc_/);
    expect(dossier.transactionReferenceNumbers).toContain('409823198273');
    expect(dossier.incidentTimeline.length).toBe(2);
    expect(dossier.recommendedNextSteps[0]).toContain('1930');
    expect(dossier.privacyStatement).toContain('locally on your device');
  });

  it('clearly separates immediate bank action from police reporting', () => {
    const separation = service.getChannelSeparationOverview();
    expect(separation.tier1BankAction.actor).toContain('Your Bank');
    expect(separation.tier2PoliceCybercrimeAction.actor).toContain('1930');
  });
});
