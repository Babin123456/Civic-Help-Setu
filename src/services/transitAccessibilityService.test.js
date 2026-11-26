import { describe, it, expect } from 'vitest';
import {
  validateTransitStop,
  filterTransitStops,
  submitCorrectionReport,
  resolveCorrectionReport,
  exportTransitStopDossier,
  ACCESSIBILITY_FEATURES,
  AMENITY_FEATURES,
  VERIFICATION_STATUSES
} from './transitAccessibilityService';

describe('transitAccessibilityService', () => {
  it('should define accessibility standards and amenities', () => {
    expect(ACCESSIBILITY_FEATURES.WHEELCHAIR_RAMP.category).toBe('MOBILITY');
    expect(AMENITY_FEATURES.SHELTER_ROOF.code).toBe('SHELTER_ROOF');
    expect(VERIFICATION_STATUSES.VERIFIED_OFFICIAL).toBe('VERIFIED_OFFICIAL');
  });

  it('should validate complete transit stop entity and calculate accessibility rating', () => {
    const rawStop = {
      stopId: 'BMTC_1042',
      stopName: 'Koramangala Water Tank Bus Stop',
      operatorName: 'Bangalore Metropolitan Transport Corp',
      latitude: 12.9279,
      longitude: 77.6271,
      accessibilityFeatures: ['WHEELCHAIR_RAMP', 'TACTILE_PAVING', 'AUDIO_ANNOUNCEMENT'],
      amenities: ['SHELTER_ROOF', 'BENCH_SEATING', 'NIGHT_LIGHTING']
    };

    const res = validateTransitStop(rawStop);
    expect(res.isValid).toBe(true);
    expect(res.transitStop.accessibilityRating).toBe(3.0); // 3 of 5 features = 3.0 / 5
    expect(res.transitStop.latitude).toBe(12.9279);
    expect(res.errors).toHaveLength(0);
  });

  it('should flag errors on invalid coordinates or missing stop ID', () => {
    const invalid = validateTransitStop({
      stopId: '',
      latitude: 120, // out of range
      longitude: 200
    });
    expect(invalid.isValid).toBe(false);
    expect(invalid.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('should filter stops by required accessibility and amenities', () => {
    const stops = [
      {
        stopId: 'S1',
        stopName: 'Fully Accessible Metro Stop',
        operatorName: 'DMRC',
        accessibilityRating: 5.0,
        accessibilityFeatures: ['WHEELCHAIR_RAMP', 'TACTILE_PAVING'],
        amenities: ['SHELTER_ROOF', 'BENCH_SEATING']
      },
      {
        stopId: 'S2',
        stopName: 'Basic Roadside Pole Stop',
        operatorName: 'DTC',
        accessibilityRating: 0.0,
        accessibilityFeatures: [],
        amenities: []
      }
    ];

    const rampStops = filterTransitStops(stops, { requiredAccessibility: ['WHEELCHAIR_RAMP'] });
    expect(rampStops).toHaveLength(1);
    expect(rampStops[0].stopId).toBe('S1');

    const dtcStops = filterTransitStops(stops, { operator: 'DTC' });
    expect(dtcStops).toHaveLength(1);
    expect(dtcStops[0].stopId).toBe('S2');
  });

  it('should process citizen correction submission and operator resolution', () => {
    const reportRes = submitCorrectionReport('BMTC_1042', {
      observedDiscrepancy: 'Tactile paving broken and missing near boarding kerb',
      featureCode: 'TACTILE_PAVING',
      suggestedStatus: 'DAMAGED_OR_MISSING'
    });

    expect(reportRes.success).toBe(true);
    expect(reportRes.correctionReport.featureCode).toBe('TACTILE_PAVING');

    // Operator resolves report
    const stop = {
      stopId: 'BMTC_1042',
      accessibilityFeatures: ['WHEELCHAIR_RAMP', 'TACTILE_PAVING'],
      amenities: ['SHELTER_ROOF']
    };

    const resolveRes = resolveCorrectionReport(stop, reportRes.correctionReport, 'ACCEPT', 'Confirmed damaged paving during audit');
    expect(resolveRes.success).toBe(true);
    expect(resolveRes.updatedStop.accessibilityFeatures).not.toContain('TACTILE_PAVING');
    expect(resolveRes.updatedStop.verificationStatus).toBe(VERIFICATION_STATUSES.COMMUNITY_AUDITED);
  });

  it('should export formatted transit stop accessibility dossier', () => {
    const stop = {
      stopId: 'BEST_9001',
      stopName: 'Chhatrapati Shivaji Maharaj Terminus Bus Bay',
      operatorName: 'BEST Undertaking Mumbai',
      latitude: 18.9401,
      longitude: 72.8354,
      verificationStatus: 'VERIFIED_OFFICIAL',
      accessibilityRating: 4.0,
      accessibilityFeatures: ['WHEELCHAIR_RAMP', 'LOW_FLOOR_CURB', 'BRAILLE_SIGNAGE'],
      amenities: ['SHELTER_ROOF', 'BENCH_SEATING', 'DIGITAL_PIS_DISPLAY']
    };

    const text = exportTransitStopDossier(stop);
    expect(text).toContain('# Transit Stop Accessibility Dossier');
    expect(text).toContain('BEST Undertaking Mumbai');
    expect(text).toContain('Wheelchair Accessible Ramp');
    expect(text).toContain('Weather-Proof Covered Shelter');
  });
});
