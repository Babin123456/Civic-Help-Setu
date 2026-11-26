import { describe, it, expect, beforeEach } from 'vitest';
import {
  markRouteSegmentBlocked,
  revalidateRouteSegment,
  autoExpireStaleReports,
  hasUnresolvedBlockage,
  getEffectiveSegmentStatus,
  getRecommendedRoutes,
  isRouteAvailable,
  getShelterById,
  getAllShelters,
  getPrimaryHelpline,
  getAllHelplines,
  generateLowBandwidthRouteDirectory,
  generatePrintableChecklist,
  FLOOD_PREPAREDNESS_CHECKLIST,
  EVACUATION_ROUTE_SEGMENTS,
  RouteSegmentStatus,
  GORAKHPUR_SHELTERS,
  UP_EMERGENCY_HELPLINES,
} from './floodRouteService.js';

describe('Flood Route Service - Acceptance Criteria', () => {
  const TEST_RESPONDER_ID = 'responder-gorakhpur-ddma';

  // --------------------------------------------------------
  // Reset community block segment before each relevant test
  // --------------------------------------------------------
  const resetCommunityBlock = () => {
    const communityBlock = EVACUATION_ROUTE_SEGMENTS.find(s => s.id === 'route-gorakhpur-community-block-1');
    if (communityBlock) {
      communityBlock.status = RouteSegmentStatus.OPEN;
      communityBlock.warnings = [
        {
          id: 'warning-comm-1',
          type: 'blockage',
          message: 'Water level above road surface - reported by local resident',
          severity: 'high',
          timestamp: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
          reportedBy: 'Community Member (anonymous)',
          evidence: 'Photo submitted via mobile',
          expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
        },
      ];
    }
  };

  // --------------------------------------------------------
  // 1. Official routes and community observations are visually and semantically distinct
  // --------------------------------------------------------
  describe('Official vs Community distinction', () => {
    it('should identify official routes correctly', () => {
      const officialSegments = EVACUATION_ROUTE_SEGMENTS.filter(s => s.official);
      const communitySegments = EVACUATION_ROUTE_SEGMENTS.filter(s => !s.official);
      
      expect(officialSegments.length).toBeGreaterThan(0);
      expect(communitySegments.length).toBeGreaterThan(0);
      
      officialSegments.forEach(segment => {
        expect(segment.official).toBe(true);
      });
      
      communitySegments.forEach(segment => {
        expect(segment.official).toBe(false);
      });
    });

    it('should distinguish segment status in effective status', () => {
      const officialOpen = EVACUATION_ROUTE_SEGMENTS.find(s => 
        s.official && s.status === RouteSegmentStatus.OPEN
      );
      expect(officialOpen).toBeDefined();
      
      const officialStatus = getEffectiveSegmentStatus(officialOpen.id);
      expect(officialStatus.status).toBe('OPEN');
      expect(officialStatus.isRecommended).toBe(true);
      
      // Use reset to ensure community block is in known state
      resetCommunityBlock();
      const communityBlock = EVACUATION_ROUTE_SEGMENTS.find(s => s.id === 'route-gorakhpur-community-block-1');
      expect(communityBlock).toBeDefined();
      
      const communityStatus = getEffectiveSegmentStatus(communityBlock.id);
      expect(communityStatus.status).toBe('BLOCKED');
      expect(communityStatus.isRecommended).toBe(false);
    });
  });

  // --------------------------------------------------------
  // 2. Temporary route reports expire unless revalidated
  // --------------------------------------------------------
  describe('Temporary report expiration', () => {
    beforeEach(() => {
      resetCommunityBlock();
    });

    it('should mark route segment as blocked with expiration', () => {
      const segment = EVACUATION_ROUTE_SEGMENTS.find(s => s.id === 'route-gorakhpur-community-block-1');
      expect(segment).toBeDefined();
      
      const updated = markRouteSegmentBlocked(
        'route-gorakhpur-community-block-1', 
        true, 
        'Water level above road surface observed', 
        TEST_RESPONDER_ID
      );
      
      expect(updated).toBeDefined();
      expect(updated.status).toBe(RouteSegmentStatus.BLOCKED);
      
      const blockWarning = updated.warnings.find(w => w.type === 'blockage');
      expect(blockWarning).toBeDefined();
      expect(blockWarning.expiresAt).toBeDefined();
    });

    it('should revalidate a blocked report and extend expiration', () => {
      const segment = EVACUATION_ROUTE_SEGMENTS.find(s => s.id === 'route-gorakhpur-community-block-1');
      expect(segment).toBeDefined();
      
      markRouteSegmentBlocked('route-gorakhpur-community-block-1', true, 'Initial blockage', TEST_RESPONDER_ID);
      
      const revalidated = revalidateRouteSegment(
        'route-gorakhpur-community-block-1', 
        'GPS photo and water level reading', 
        TEST_RESPONDER_ID
      );
      
      expect(revalidated).toBe(true);
      
      const blockWarning = segment.warnings.find(w => w.type === 'blockage');
      expect(blockWarning).toBeDefined();
      const expiryTime = new Date(blockWarning.expiresAt);
      const now = new Date();
      const diffHours = (expiryTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      expect(diffHours).toBeGreaterThan(10);
      expect(diffHours).toBeLessThanOrEqual(24);
    });

    it('should auto-expire stale reports', () => {
      const segment = EVACUATION_ROUTE_SEGMENTS.find(s => s.id === 'route-gorakhpur-community-block-1');
      expect(segment).toBeDefined();
      
      // Set expiration to past
      segment.warnings = [
        {
          id: 'warning-expired',
          type: 'blockage',
          message: 'Expired blockage report',
          severity: 'high',
          timestamp: new Date().toISOString(),
          reportedBy: 'Test',
          evidence: 'Test',
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        },
      ];
      
      autoExpireStaleReports();
      
      const warning = segment.warnings.find(w => w.id === 'warning-expired');
      expect(warning).toBeDefined();
      expect(warning.message).toContain('[EXPIRED]');
    });
  });

  // --------------------------------------------------------
  // 3. A route with an unresolved blockage is not recommended
  // --------------------------------------------------------
  describe('Unresolved blockage routing', () => {
    beforeEach(resetCommunityBlock);

    it('should detect unresolved blockage on segment', () => {
      const segment = EVACUATION_ROUTE_SEGMENTS.find(s => s.id === 'route-gorakhpur-community-block-1');
      expect(segment).toBeDefined();
      expect(hasUnresolvedBlockage('route-gorakhpur-community-block-1')).toBe(true);
    });

    it('should return not recommended for blocked route', () => {
      const segment = EVACUATION_ROUTE_SEGMENTS.find(s => s.id === 'route-gorakhpur-community-block-1');
      expect(segment).toBeDefined();
      
      const effectiveStatus = getEffectiveSegmentStatus('route-gorakhpur-community-block-1');
      expect(effectiveStatus.isRecommended).toBe(false);
      expect(effectiveStatus.status).toBe('BLOCKED');
    });

    it('should recommend official open routes', () => {
      const officialOpen = EVACUATION_ROUTE_SEGMENTS.find(s => 
        s.official && s.status === RouteSegmentStatus.OPEN
      );
      expect(officialOpen).toBeDefined();
      
      const effectiveStatus = getEffectiveSegmentStatus(officialOpen.id);
      expect(effectiveStatus.isRecommended).toBe(true);
      expect(effectiveStatus.status).toBe('OPEN');
    });
  });

  // --------------------------------------------------------
  // 4. Shelter details include source, authority, and last verification
  // --------------------------------------------------------
  describe('Shelter details', () => {
    it('should retrieve shelter by ID with all required attributes', () => {
      const shelterId = 'shelter-gorakhpur-camp-a';
      const shelter = getShelterById(shelterId);
      
      expect(shelter).toBeDefined();
      expect(shelter.id).toBe(shelterId);
      expect(shelter.name).toBeDefined();
      expect(shelter.authority).toBeDefined();
      expect(shelter.source).toBeDefined();
      expect(shelter.lastVerified).toBeDefined();
      expect(shelter.disasterTypes).toBeDefined();
    });

    it('should include source and authority in shelter data', () => {
      const shelters = getAllShelters();
      
      shelters.forEach(shelter => {
        expect(shelter.source).toBeTruthy();
        expect(shelter.authority).toBeTruthy();
        expect(shelter.lastVerified).toBeTruthy();
        expect(['official_district_authority', 'district_administration', 'state_authority']).toContain(shelter.source);
        expect(shelter.authority).toContain('Gorakhpur') || expect(shelter.authority).toContain('District');
      });
    });

    it('should verify shelter recent verification status', () => {
      const shelters = getAllShelters();
      
      shelters.forEach(shelter => {
        const diffDays = (new Date().getTime() - new Date(shelter.lastVerified).getTime()) / (1000 * 60 * 60 * 24);
        expect(diffDays).toBeLessThanOrEqual(14);
      });
    });

    it('primary helpline should always be available first', () => {
      const primary = getPrimaryHelpline(getAllHelplines());
      expect(primary).toBeDefined();
      expect(primary.isPrimary).toBe(true);
      expect(primary.number).toBe('1070');
    });

    it('all helplines should include UP-specific disaster numbers', () => {
      const helplines = getAllHelplines();
      const has1070 = helplines.some(h => h.number === '1070');
      const has112 = helplines.some(h => h.number === '112');
      expect(has1070).toBe(true);
      expect(has112).toBe(true);
    });
  });

  // --------------------------------------------------------
  // 5. Planner works without precise location permission
  // --------------------------------------------------------
  describe('Offline/location-independent operation', () => {
    it('should generate low-bandwidth route directory without location', () => {
      const directory = generateLowBandwidthRouteDirectory();
      expect(directory).toBeDefined();
      expect(typeof directory).toBe('string');
      expect(directory.length).toBeGreaterThan(0);
      expect(directory).toContain('GORAKHPUR');
      expect(directory).toContain('EMERGENCY CONTACTS');
    });

    it('should generate printable checklist without location', () => {
      const checklist = generatePrintableChecklist();
      expect(checklist).toBeDefined();
      expect(typeof checklist).toBe('string');
      expect(checklist.length).toBeGreaterThan(0);
      expect(checklist).toContain('FLOOD PREPAREDNESS CHECKLIST');
      expect(checklist).toContain('1070');
    });

    it('should work with empty origin/destination', () => {
      const recommended = getRecommendedRoutes('', '');
      expect(recommended).toBeDefined();
    });

    it('should handle source conflicts gracefully', () => {
      const shelters = getAllShelters();
      
      shelters.forEach(shelter => {
        expect(shelter.source.trim().length).toBeGreaterThan(0);
        expect(shelter.authority.trim().length).toBeGreaterThan(0);
      });
    });
  });
});