import { describe, it, expect } from 'vitest';
import {
  NOISE_ZONES,
  NOISE_SOURCES,
  evaluateSoundReading,
  generateRule7ComplaintMemorandum,
} from './noisePollutionService.js';

describe('noisePollutionService', () => {
  describe('Static Constants', () => {
    it('defines 4 statutory ambient noise zones with correct day and night limits', () => {
      expect(NOISE_ZONES.INDUSTRIAL_AREA.dayLimitDbA).toBe(75);
      expect(NOISE_ZONES.INDUSTRIAL_AREA.nightLimitDbA).toBe(70);

      expect(NOISE_ZONES.COMMERCIAL_AREA.dayLimitDbA).toBe(65);
      expect(NOISE_ZONES.COMMERCIAL_AREA.nightLimitDbA).toBe(55);

      expect(NOISE_ZONES.RESIDENTIAL_AREA.dayLimitDbA).toBe(55);
      expect(NOISE_ZONES.RESIDENTIAL_AREA.nightLimitDbA).toBe(45);

      expect(NOISE_ZONES.SILENCE_ZONE.dayLimitDbA).toBe(50);
      expect(NOISE_ZONES.SILENCE_ZONE.nightLimitDbA).toBe(40);
    });

    it('defines noise sources with correct curfew flags', () => {
      expect(NOISE_SOURCES.LOUDSPEAKER_OR_PA_SYSTEM.nightCurfewMandatory).toBe(true);
      expect(NOISE_SOURCES.CONSTRUCTION_EQUIPMENT.nightCurfewMandatory).toBe(true);
      expect(NOISE_SOURCES.FIRECRACKERS.nightCurfewMandatory).toBe(true);
    });
  });

  describe('evaluateSoundReading', () => {
    it('identifies compliant reading during daytime in residential area', () => {
      const result = evaluateSoundReading({
        observedDbA: 52,
        zoneKey: 'RESIDENTIAL_AREA',
        hourOfDay: 14, // 2 PM (Day)
        sourceType: 'LOUDSPEAKER_OR_PA_SYSTEM',
      });

      expect(result.isNightTime).toBe(false);
      expect(result.permissibleLimitDbA).toBe(55);
      expect(result.exceedanceDbA).toBe(0);
      expect(result.isViolation).toBe(false);
      expect(result.severityTier).toBe('COMPLIANT');
      expect(result.soundEnergyMultiplier).toBe(1.0);
    });

    it('calculates acoustic energy doubling and severity for night exceedance', () => {
      const result = evaluateSoundReading({
        observedDbA: 57, // 12 dB above 45 dB limit
        zoneKey: 'RESIDENTIAL_AREA',
        hourOfDay: 23, // 11 PM (Night)
        sourceType: 'LOUDSPEAKER_OR_PA_SYSTEM',
        durationMinutes: 45,
      });

      expect(result.isNightTime).toBe(true);
      expect(result.permissibleLimitDbA).toBe(45);
      expect(result.exceedanceDbA).toBe(12);
      expect(result.isViolation).toBe(true);
      expect(result.isCurfewViolation).toBe(true);
      expect(result.severityTier).toBe('SEVERE_VIOLATION');
      // 12 dB / 3 = 4 doublings -> 2^4 = 16x energy
      expect(result.soundEnergyMultiplier).toBe(16.0);
      // 12 dB / 10 = 1.2 -> 2^1.2 ~= 2.3x perceived loudness
      expect(result.perceivedLoudnessMultiplier).toBe(2.3);
      expect(result.estimatedCompoundingFineInr).toBeGreaterThanOrEqual(10000);
    });

    it('flags unattenuated DG set violation', () => {
      const result = evaluateSoundReading({
        observedDbA: 78,
        zoneKey: 'COMMERCIAL_AREA',
        hourOfDay: 11,
        sourceType: 'DIESEL_GENERATOR_SET',
        isEnclosedDg: false,
      });

      expect(result.isDgAcousticViolation).toBe(true);
      expect(result.isViolation).toBe(true);
      expect(result.exceedanceDbA).toBe(13); // 78 - 65 = 13
    });
  });

  describe('generateRule7ComplaintMemorandum', () => {
    it('generates formal complaint memorandum with all acoustic details', () => {
      const evaluation = evaluateSoundReading({
        observedDbA: 68,
        zoneKey: 'SILENCE_ZONE',
        hourOfDay: 22,
        sourceType: 'COMMERCIAL_BANQUET_EVENT',
      });

      const text = generateRule7ComplaintMemorandum({
        complainant: {
          name: 'Dr. Ramesh Gupta',
          address: 'Flat 302, St. Jude Enclave',
          contact: '9812345678',
        },
        authority: {
          sdmOffice: 'SDM South Division',
          policeStation: 'Koramangala Police Station',
        },
        location: {
          city: 'Bengaluru',
          state: 'Karnataka',
          incidentLocation: 'Near St. John Hospital Campus',
        },
        evaluation,
      });

      expect(text).toContain('RULE 7 OF NOISE POLLUTION');
      expect(text).toContain('Dr. Ramesh Gupta');
      expect(text).toContain('SDM South Division');
      expect(text).toContain('Silence Zone');
      expect(text).toContain('Near St. John Hospital Campus');
      expect(text).toContain('68 dB(A)');
    });
  });
});
