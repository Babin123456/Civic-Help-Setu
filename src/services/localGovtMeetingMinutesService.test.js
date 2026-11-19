import { describe, it, expect } from 'vitest';
import {
  assessMeetingRecord,
  queryMeetingArchive,
  exportMeetingRecordDossier,
  getCitizenObserverGuidelines,
  LOCAL_BODY_TIERS,
  RESOLUTION_STATUSES
} from './localGovtMeetingMinutesService';

describe('localGovtMeetingMinutesService', () => {
  it('should define statutory local tiers and resolution statuses', () => {
    expect(LOCAL_BODY_TIERS.MUNICIPAL_CORPORATION.code).toBe('MUNICIPAL_CORPORATION');
    expect(LOCAL_BODY_TIERS.WARD_COMMITTEE.code).toBe('WARD_COMMITTEE');
    expect(LOCAL_BODY_TIERS.GRAM_PANCHAYAT.code).toBe('GRAM_PANCHAYAT');
    expect(RESOLUTION_STATUSES.CONFIRMED.binding).toBe(true);
    expect(RESOLUTION_STATUSES.DRAFT.binding).toBe(false);
  });

  it('should assess meeting record and verify statutory quorum met', () => {
    const meeting = {
      meetingTitle: 'BBMP Ward Committee Monthly Deliberation',
      meetingDate: '2024-02-15',
      venue: 'Ward Office 150, Bellandur',
      localBodyTier: 'WARD_COMMITTEE',
      resolutionStatus: 'CONFIRMED',
      totalMembers: 20,
      presentMembers: 8, // 40% > 20%
      resolutions: [
        {
          title: 'Approval of Road Resurfacing on Outer Ring Road',
          department: 'Engineering',
          decision: 'Unanimously Approved',
          actionLink: 'Tender Notice #ENG/2024/88'
        }
      ]
    };

    const res = assessMeetingRecord(meeting);
    expect(res.isValid).toBe(true);
    expect(res.quorumMet).toBe(true);
    expect(res.resolutionCount).toBe(1);
    expect(res.errors).toHaveLength(0);
    expect(res.publicDisclosureMandate).toContain('RTI Act 2005');
  });

  it('should warn when meeting fails statutory quorum requirement', () => {
    const deficitMeeting = {
      meetingTitle: 'Municipal Standing Committee Urgent Sitting',
      meetingDate: '2024-02-10',
      localBodyTier: 'MUNICIPAL_CORPORATION',
      totalMembers: 100,
      presentMembers: 15, // 15% < 33%
      resolutions: []
    };

    const res = assessMeetingRecord(deficitMeeting);
    expect(res.quorumMet).toBe(false);
    expect(res.warnings.some(w => w.includes('Quorum deficit'))).toBe(true);
  });

  it('should query meeting archive across keywords and tiers', () => {
    const corpus = [
      {
        meetingTitle: 'Standing Committee on Health & Sanitation',
        localBodyTier: 'MUNICIPAL_CORPORATION',
        ward: 'Central',
        resolutions: [{ title: 'Dengue Prevention Fogging Schedule', decision: 'Sanctioned' }]
      },
      {
        meetingTitle: 'Ward 45 Sanitation Committee Meeting',
        localBodyTier: 'WARD_COMMITTEE',
        ward: '45',
        resolutions: [{ title: 'Waste Segregation Inspection', decision: 'Approved' }]
      }
    ];

    const results = queryMeetingArchive(corpus, {
      keyword: 'fogging',
      localBodyTier: 'MUNICIPAL_CORPORATION'
    });

    expect(results).toHaveLength(1);
    expect(results[0].meetingTitle).toContain('Standing Committee on Health');
  });

  it('should provide citizen observer guidelines and rights', () => {
    const guidelines = getCitizenObserverGuidelines();
    expect(guidelines.rights.length).toBeGreaterThanOrEqual(3);
    expect(guidelines.rights[0]).toContain('RTI Act');
  });

  it('should export formatted markdown minutes dossier', () => {
    const meeting = {
      meetingTitle: 'Gram Sabha Annual Budget Approval',
      meetingDate: '2024-01-26',
      venue: 'Panchayat Bhavan, Kothur',
      localBodyTier: 'GRAM_PANCHAYAT',
      resolutionStatus: 'CONFIRMED',
      resolutions: [
        {
          title: 'Allocation of MGNREGA Village Pond De-silting',
          department: 'Rural Development',
          decision: 'Approved',
          actionLink: 'Work Order #RD/KOT/01'
        }
      ]
    };

    const dossier = exportMeetingRecordDossier(meeting);
    expect(dossier).toContain('# Local Government Public Meeting Minutes & Decisions');
    expect(dossier).toContain('Gram Sabha Annual Budget Approval');
    expect(dossier).toContain('MGNREGA Village Pond De-silting');
    expect(dossier).toContain('RTI Act 2005 Section 4(1)(b)');
  });
});
