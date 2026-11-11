import { describe, it, expect, beforeEach } from 'vitest';
import {
  INCIDENT_STATUS,
  INCIDENT_TIER,
  OUTAGE_SERVICE_DISCLAIMER,
  isValidOfficialUrl,
  outageDirectoryStore,
} from './civicServiceOutageDirectoryService.js';

describe('civicServiceOutageDirectoryService', () => {
  beforeEach(() => {
    outageDirectoryStore.reset();
  });

  it('validates official government domains and rejects unauthorized third-party URLs', () => {
    expect(isValidOfficialUrl('https://services.india.gov.in/service')).toBe(true);
    expect(isValidOfficialUrl('https://cmhelpline.tnega.org')).toBe(true);
    expect(isValidOfficialUrl('https://parivahan.gov.in/rc')).toBe(true);

    // Untrusted or non-https URLs
    expect(isValidOfficialUrl('http://insecure-portal.gov.in')).toBe(false);
    expect(isValidOfficialUrl('https://scam-service-helper.com')).toBe(false);
    expect(isValidOfficialUrl('ftp://gov.in')).toBe(false);
  });

  it('publishes official verified incidents with alternative channels and provenance', () => {
    const incident = outageDirectoryStore.publishOfficialIncident(
      {
        serviceKey: 'VAHAN_PORTAL',
        serviceName: 'Parivahan Vahan Citizen Services',
        jurisdiction: 'CENTRAL',
        title: 'Scheduled Database Maintenance on Vahan Payment Gateway',
        officialSource: 'MoRTH National Informatics Centre Advisory #2026-03',
        startTime: '2026-04-01T02:00:00.000Z',
        alternativeChannels: [
          {
            type: 'PHYSICAL_COUNTER',
            name: 'District RTO Cash Facilitation Counters',
            url: 'https://parivahan.gov.in',
            operatingHours: '10:00 AM - 04:00 PM',
          },
        ],
      },
      'ADMIN'
    );

    expect(incident.id).toBeDefined();
    expect(incident.tier).toBe(INCIDENT_TIER.VERIFIED_OFFICIAL);
    expect(incident.status).toBe(INCIDENT_STATUS.ACTIVE);
    expect(incident.officialSource).toContain('National Informatics Centre');
    expect(incident.alternativeChannels.length).toBe(1);
    expect(incident.disclaimer).toBe(OUTAGE_SERVICE_DISCLAIMER);
  });

  it('rejects publication when alternative URLs belong to unverified domains', () => {
    expect(() =>
      outageDirectoryStore.publishOfficialIncident(
        {
          serviceKey: 'EPFO_PORTAL',
          title: 'EPFO Passbook Down',
          officialSource: 'EPFO Twitter Desk',
          alternativeChannels: [
            {
              name: 'Alternative Broker',
              url: 'https://thirdparty-passbook.com', // Illegal untrusted domain
            },
          ],
        },
        'ADMIN'
      )
    ).toThrow(/Invalid alternative URL/);
  });

  it('visibly separates unverified community reports from official notices', () => {
    const communityReport = outageDirectoryStore.submitCommunityReport({
      serviceKey: 'MUNICIPAL_PROPERTY_TAX',
      description: 'Payment gateway returning 504 Gateway Timeout during UPI checkout.',
    });

    expect(communityReport.tier).toBe(INCIDENT_TIER.COMMUNITY_REPORTED);
    expect(communityReport.isModerated).toBe(false);
    expect(communityReport.tier).not.toBe(INCIDENT_TIER.VERIFIED_OFFICIAL);
  });

  it('supports editorial moderation to promote or archive community reports', () => {
    const report = outageDirectoryStore.submitCommunityReport({
      serviceKey: 'RATION_CARD_EPDS',
      description: 'Server unreachable in North Chennai zone.',
    });

    const approved = outageDirectoryStore.moderateCommunityReport(
      report.id,
      true,
      'Confirmed via Civil Supplies Dept Call Desk',
      'ADMIN'
    );

    expect(approved.tier).toBe(INCIDENT_TIER.VERIFIED_OFFICIAL);
    expect(approved.officialSource).toContain('Civil Supplies Dept');
    expect(approved.isModerated).toBe(true);
  });

  it('automatically marks stale incidents as expired after TTL window', () => {
    const oldIncident = outageDirectoryStore.publishOfficialIncident(
      {
        serviceKey: 'CSC_PORTAL',
        title: 'Temporary Server Glitch',
        officialSource: 'District Notice Board',
        startTime: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(), // 72 hours ago
      },
      'ADMIN'
    );

    const expired = outageDirectoryStore.checkAndExpireStaleIncidents(48); // 48h TTL
    expect(expired).toContain(oldIncident.id);

    const recheck = outageDirectoryStore.incidents.get(oldIncident.id);
    expect(recheck.status).toBe(INCIDENT_STATUS.STALE_EXPIRED);
    expect(recheck.expirationNote).toContain('Automatically expired after 48 hours');
  });
});
