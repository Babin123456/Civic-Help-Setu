/**
 * @file cyberFraudResponseGuideService.js
 * @description Provides scenario-based first-response guidance and local evidence preservation protocols
 * for digital payment fraud, account takeover, and impersonation.
 * Strictly avoids collecting OTPs, passwords, PINs, or card CVVs.
 */

import {
  CYBER_FRAUD_SCENARIOS,
  OFFICIAL_REPORTING_CHANNELS
} from '../data/cyberFraudEmergencyData.js';

export class CyberFraudResponseGuideService {
  constructor(scenarios = CYBER_FRAUD_SCENARIOS, channels = OFFICIAL_REPORTING_CHANNELS) {
    this.scenarios = scenarios;
    this.channels = channels;
  }

  /**
   * Retrieves recommended first-response actions based on fraud scenario.
   */
  getScenarioGuidance(scenarioCode) {
    const scenario = this.scenarios.find(s => s.code === scenarioCode) || this.scenarios[0];

    return {
      scenarioCode: scenario.code,
      title: scenario.title,
      description: scenario.description,
      goldenHourAdvice: `CRITICAL ACTION REQUIRED: Initiate reporting within ${scenario.goldenHourWindowHours} hour(s) of the incident to maximize chances of inter-bank fund lien/freeze.`,
      immediateBankActions: scenario.immediateActions,
      evidencePreservationChecklist: scenario.evidenceToPreserve.map((item, idx) => ({
        step: idx + 1,
        evidenceName: item,
        preserved: false,
        bestPractice: 'Do NOT delete chats, SMS, or call logs. Take uncropped screenshots with visible date and battery status bar.'
      })),
      officialReportingChannels: this.channels,
      strictCredentialWarning: 'NEVER share your OTP, UPI MPIN, ATM PIN, Net Banking Password, or Full 16-Digit Card Number with anyone—including police officers or bank customer care.'
    };
  }

  /**
   * Generates a neutral, local incident timeline and complaint log for official police/1930 submission.
   */
  compileIncidentDossier(incidentDetails = {}) {
    const timeline = incidentDetails.timeline || [];
    const formattedTimeline = timeline.map((t, idx) => ({
      index: idx + 1,
      timestamp: t.timestamp || 'N/A',
      actor: t.actor || 'Victim / Fraudster',
      action: t.action || 'Unknown Event'
    }));

    return {
      dossierId: `inc_${Date.now()}`,
      generatedAt: new Date().toISOString(),
      fraudCategory: incidentDetails.fraudCategory || 'DIGITAL_FINANCIAL_FRAUD',
      approximateAmountINR: incidentDetails.amountINR || 'Unspecified',
      transactionReferenceNumbers: incidentDetails.utrNumbers || [],
      incidentTimeline: formattedTimeline,
      recommendedNextSteps: [
        '1. Call 1930 national helpline immediately with UTR and beneficiary account details.',
        '2. File formal complaint on https://cybercrime.gov.in and obtain an acknowledgement number.',
        '3. Visit your local police station / Cyber Crime Police Station (CCPS) with printed bank statement and NCRP acknowledgement.',
        '4. Submit copy of police acknowledgement to your home bank branch within 3 working days for RBI limited liability circular protection.'
      ],
      privacyStatement: 'This dossier is generated locally on your device. Civic Help Setu does not transmit or store financial credentials.'
    };
  }

  /**
   * Clearly separates immediate bank actions from police/cybercrime reporting.
   */
  getChannelSeparationOverview() {
    return {
      tier1BankAction: {
        actor: 'Your Bank / Card Issuer',
        purpose: 'Stop further losses and freeze recipient account.',
        action: 'Freeze net banking, block cards, issue transaction dispute ticket, request inter-bank freeze.'
      },
      tier2PoliceCybercrimeAction: {
        actor: 'National Cyber Crime Portal (1930 / cybercrime.gov.in) & Police CCPS',
        purpose: 'Investigate crime, trace fraudsters, issue court order / Section 91 CrPC notice for reversal of frozen funds.',
        action: 'FIR / NCRP complaint registration, legal notice to telecom providers and payment gateways.'
      }
    };
  }
}

export const defaultCyberFraudService = new CyberFraudResponseGuideService();
