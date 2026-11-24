import { describe, it, expect, beforeEach } from 'vitest';
import { PublicParksDirectoryService } from './publicParksDirectoryService.js';

describe('PublicParksDirectoryService', () => {
  let service;

  beforeEach(() => {
    service = new PublicParksDirectoryService();
  });

  it('retrieves parks by jurisdiction and ward number', () => {
    const parks = service.getParksByWard('IN-KA-BLR', 143);
    expect(parks.length).toBe(1);
    expect(parks[0].name).toContain('Madhavan Park');
    expect(parks[0].wardName).toBe('Jayanagar 1st Block');
  });

  it('filters parks by wheelchair accessibility criteria', () => {
    const accessibleParks = service.searchParks({
      wheelchairAccessibleOnly: true,
      accessibleToiletOnly: true
    });

    expect(accessibleParks.length).toBeGreaterThan(0);
    accessibleParks.forEach(park => {
      expect(park.accessibility.stepFreeAccess).toBe(true);
      expect(park.accessibility.hasWheelchairRamps).toBe(true);
      expect(park.accessibility.accessibleToilets).toBe(true);
    });
  });

  it('filters by amenity like CHILDRENS_PLAY_AREA', () => {
    const playParks = service.searchParks({
      amenity: 'CHILDRENS_PLAY_AREA'
    });

    expect(playParks.length).toBe(2);
    playParks.forEach(p => {
      expect(p.amenities).toContain('CHILDRENS_PLAY_AREA');
    });
  });

  it('computes jurisdiction accessibility summary metrics', () => {
    const summary = service.getJurisdictionAccessibilitySummary('IN-KA-BLR');
    expect(summary.total).toBe(2);
    expect(summary.stepFreeCount).toBe(2);
    expect(summary.stepFreeRatio).toBe(1.0);
    expect(summary.accessibleToiletRatio).toBe(1.0);
  });

  it('creates maintenance escalation ticket for authorities', () => {
    const ticket = service.submitMaintenanceReport('park_ka_blr_001', {
      issueType: 'BROKEN_RAMP',
      description: 'Wheelchair access ramp damaged near gate 3'
    });

    expect(ticket.ticketId).toMatch(/^prk_rep_/);
    expect(ticket.parkName).toContain('Cubbon Park');
    expect(ticket.status).toBe('SUBMITTED_TO_LOCAL_AUTHORITY');
    expect(ticket.officerContact).toContain('@karnataka.gov.in');
  });
});
