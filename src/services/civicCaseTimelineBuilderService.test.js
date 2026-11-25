import { describe, it, expect, beforeEach } from 'vitest';
import { CivicCaseTimelineBuilderService } from './civicCaseTimelineBuilderService.js';

describe('CivicCaseTimelineBuilderService', () => {
  let service;

  beforeEach(() => {
    service = new CivicCaseTimelineBuilderService();
  });

  it('extracts candidate timeline events with date normalization and provenance citations', () => {
    const records = [
      {
        id: 'rec_01',
        title: 'Municipal Grievance Acknowledgement',
        sourceReference: 'grievance_portal_ka_bbmp',
        content: 'On 2025-10-12 Grievance filed for open drain hazard with Ack #BBMP/2025/9981.'
      },
      {
        id: 'rec_02',
        title: 'Junior Engineer Inspection Letter',
        sourceReference: 'field_inspection_ka',
        content: 'Inspection conducted on 15 November 2025 by Assistant Executive Engineer.'
      }
    ];

    const timeline = service.buildChronologicalTimeline(records);
    expect(timeline.totalEventsFound).toBe(2);
    expect(timeline.chronologicalTimeline[0].normalizedDate).toBe('2025-10-12');
    expect(timeline.chronologicalTimeline[0].eventType).toBe('APPLICATION_SUBMISSION');
    expect(timeline.chronologicalTimeline[1].normalizedDate).toBe('2025-11-15');
    expect(timeline.chronologicalTimeline[0].citation.recordId).toBe('rec_01');
  });

  it('flags documentation gaps exceeding 90 days between recorded events', () => {
    const records = [
      {
        id: 'rec_01',
        title: 'First Application',
        content: 'Application filed on 2025-01-10 at zonal office.'
      },
      {
        id: 'rec_02',
        title: 'Late Followup',
        content: 'First appeal hearing held on 2025-06-15 before appellate authority.'
      }
    ];

    const timeline = service.buildChronologicalTimeline(records);
    const gapItem = timeline.chronologicalTimeline.find(item => item.isGapNotice);
    expect(gapItem).toBeDefined();
    expect(gapItem.elapsedDays).toBeGreaterThan(90);
    expect(gapItem.description).toContain('Potential documentation gap');
  });

  it('exports a formal case dossier in markdown format', () => {
    const records = [
      {
        id: 'rec_01',
        title: 'Sanction Notice',
        content: 'Permit issued on 2025-08-20 by municipal commissioner.'
      }
    ];

    const timeline = service.buildChronologicalTimeline(records);
    const dossier = service.exportFormalCaseDossier(timeline);

    expect(dossier).toContain('# CITIZEN CIVIC CASE TIMELINE DOSSIER');
    expect(dossier).toContain('Permit issued on 2025-08-20');
  });
});
