import { describe, it, expect } from 'vitest';
import {
  buildEvidenceStoryboard,
  generateNeutralCaption,
  redactSensitiveDetails,
  exportGrievanceChronologyDossier,
  generateSection65BCertificate,
  EVIDENCE_SOURCE_TYPES,
  GRIEVANCE_CATEGORIES
} from './grievanceStoryboardService';

describe('grievanceStoryboardService', () => {
  it('should define evidence source types and categories', () => {
    expect(EVIDENCE_SOURCE_TYPES.PHOTOGRAPH.code).toBe('PHOTOGRAPH');
    expect(EVIDENCE_SOURCE_TYPES.ACK_RECEIPT.code).toBe('ACK_RECEIPT');
    expect(GRIEVANCE_CATEGORIES.ROAD_INFRASTRUCTURE.code).toBe('ROAD_INFRASTRUCTURE');
  });

  it('should sort evidence strictly chronologically and detect duplicates', () => {
    const rawItems = [
      {
        title: 'Initial Complaint Filed on BBMP Sahaya',
        sourceType: 'ACK_RECEIPT',
        incidentDate: '2024-01-10',
        description: 'Lodge ticket #10293'
      },
      {
        title: 'Follow-up Email to Ward Assistant Engineer',
        sourceType: 'CORRESPONDENCE',
        incidentDate: '2024-02-15',
        description: 'No action taken after 30 days SLA lapse'
      },
      {
        title: 'Initial Complaint Filed on BBMP Sahaya', // duplicate
        sourceType: 'ACK_RECEIPT',
        incidentDate: '2024-01-10',
        description: 'Lodge ticket #10293'
      },
      {
        title: 'Site Photo of Deep Pothole',
        sourceType: 'PHOTOGRAPH',
        incidentDate: '2023-12-20',
        description: 'Pothole on 100ft road'
      }
    ];

    const storyboard = buildEvidenceStoryboard(rawItems);
    expect(storyboard.totalItems).toBe(4);
    // Chronological order: 2023-12-20 -> 2024-01-10 -> 2024-01-10 -> 2024-02-15
    expect(storyboard.items[0].incidentDate).toBe('2023-12-20');
    expect(storyboard.items[3].incidentDate).toBe('2024-02-15');
    expect(storyboard.warnings.some(w => w.includes('Duplicate evidence detected'))).toBe(true);
  });

  it('should generate objective neutral captions without inferring guilt', () => {
    const item = {
      title: 'Water Sample Color',
      sourceType: 'PHOTOGRAPH',
      incidentDate: '2024-03-01',
      description: 'Yellowish tap water from kitchen outlet'
    };

    const caption = generateNeutralCaption(item);
    expect(caption).toContain('Geo-Tagged Site Photograph documented on 2024-03-01');
    expect(caption).toContain('Yellowish tap water');
  });

  it('should redact sensitive personal data (phone, email, Aadhaar) accurately', () => {
    const rawText = 'Contact complainant Ramesh at 9876543210 or email ramesh@example.com with Aadhaar 1234 5678 9012 for site visit.';
    const redacted = redactSensitiveDetails(rawText);

    expect(redacted).not.toContain('9876543210');
    expect(redacted).not.toContain('ramesh@example.com');
    expect(redacted).not.toContain('1234 5678 9012');
    expect(redacted).toContain('[REDACTED_PHONE]');
    expect(redacted).toContain('[REDACTED_EMAIL]');
    expect(redacted).toContain('[REDACTED_AADHAAR]');
  });

  it('should generate Section 65B electronic evidence certification draft', () => {
    const cert = generateSection65BCertificate('Sunita Narain', 4);
    expect(cert).toContain('SECTION 65B');
    expect(cert).toContain('Sunita Narain');
    expect(cert).toContain('4 evidence records');
  });

  it('should export formatted markdown grievance chronology dossier', () => {
    const grievance = {
      title: 'Chronic Sewage Overflow on 5th Cross',
      targetAuthority: 'BWSSB Executive Engineer',
      category: 'Drainage & Sewerage'
    };

    const storyboard = {
      totalItems: 2,
      datedItemsCount: 2,
      items: [
        {
          title: 'Initial Citizen Ticket',
          sourceType: { label: 'Official Receipt' },
          incidentDate: '2024-01-05',
          suggestedCaption: 'Receipt logged on 2024-01-05',
          description: 'Ticket #8872 lodged by citizen phone 9845012345',
          isConfirmedByCitizen: true
        }
      ]
    };

    const doc = exportGrievanceChronologyDossier(grievance, storyboard);
    expect(doc).toContain('# Chronological Civic Grievance Evidence Dossier');
    expect(doc).toContain('Chronic Sewage Overflow on 5th Cross');
    expect(doc).toContain('[REDACTED_PHONE]');
    expect(doc).toContain('Citizen Verification Notice');
  });
});
