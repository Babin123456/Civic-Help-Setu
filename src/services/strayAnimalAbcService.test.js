import { describe, it, expect } from 'vitest';
import {
  RABIES_EXPOSURE_CATEGORIES,
  ARV_REGIMENS,
  RIG_TYPES,
  ABC_WARD_CHECKPOINTS,
  calculateVaccinationSchedule,
  calculateRigDosage,
  evaluateWardAbcCompliance,
  generateFeederCharter,
  generateMunicipalAbcRequisition,
  generateRabiesPepSlip,
} from './strayAnimalAbcService.js';

describe('strayAnimalAbcService', () => {
  describe('Static Constants', () => {
    it('defines 3 WHO/NRCP exposure categories with correct PEP flags', () => {
      expect(RABIES_EXPOSURE_CATEGORIES.CATEGORY_I.pepRequired).toBe(false);
      expect(RABIES_EXPOSURE_CATEGORIES.CATEGORY_II.pepRequired).toBe(true);
      expect(RABIES_EXPOSURE_CATEGORIES.CATEGORY_II.rigRequired).toBe(false);
      expect(RABIES_EXPOSURE_CATEGORIES.CATEGORY_III.pepRequired).toBe(true);
      expect(RABIES_EXPOSURE_CATEGORIES.CATEGORY_III.rigRequired).toBe(true);
    });

    it('defines standard Essen and Thai Red Cross vaccine regimens', () => {
      expect(ARV_REGIMENS.ESSEN_IM.dayOffsets).toEqual([0, 3, 7, 14, 28]);
      expect(ARV_REGIMENS.THAI_RED_CROSS_ID.dayOffsets).toEqual([0, 3, 7, 28]);
      expect(ARV_REGIMENS.ZAGREB_IM.dayOffsets).toEqual([0, 7, 21]);
      expect(RIG_TYPES.HRIG.dosePerKgIu).toBe(20);
      expect(RIG_TYPES.ERIG.dosePerKgIu).toBe(40);
    });

    it('contains all 7 ABC Rules 2023 checkpoints', () => {
      expect(ABC_WARD_CHECKPOINTS.length).toBe(7);
      const ids = ABC_WARD_CHECKPOINTS.map((c) => c.id);
      expect(ids).toContain('same_territory_release');
      expect(ids).toContain('ear_notching_identification');
      expect(ids).toContain('humane_capture');
    });
  });

  describe('calculateVaccinationSchedule', () => {
    it('calculates 5-dose Essen IM calendar correctly', () => {
      const schedule = calculateVaccinationSchedule('2026-11-01', 'ESSEN_IM');
      expect(schedule.length).toBe(5);
      expect(schedule[0].dateString).toBe('2026-11-01');
      expect(schedule[1].dateString).toBe('2026-11-04');
      expect(schedule[2].dateString).toBe('2026-11-08');
      expect(schedule[3].dateString).toBe('2026-11-15');
      expect(schedule[4].dateString).toBe('2026-11-29');
    });

    it('calculates 4-visit Thai Red Cross ID calendar correctly', () => {
      const schedule = calculateVaccinationSchedule('2026-11-01', 'THAI_RED_CROSS_ID');
      expect(schedule.length).toBe(4);
      expect(schedule[0].dateString).toBe('2026-11-01');
      expect(schedule[1].dateString).toBe('2026-11-04');
      expect(schedule[2].dateString).toBe('2026-11-08');
      expect(schedule[3].dateString).toBe('2026-11-29');
    });

    it('throws error for invalid exposure date', () => {
      expect(() => calculateVaccinationSchedule('invalid-date')).toThrow();
    });
  });

  describe('calculateRigDosage', () => {
    it('calculates HRIG dosage at 20 IU/kg', () => {
      const result = calculateRigDosage({ weightKg: 60, rigType: 'HRIG' });
      expect(result.totalIuRequired).toBe(1200); // 60 * 20
      expect(result.volumeMlRequired).toBe(8.0); // 1200 / 150 = 8.0 mL
      expect(result.firstAidImmediateInstructions.length).toBeGreaterThan(0);
    });

    it('calculates ERIG dosage at 40 IU/kg', () => {
      const result = calculateRigDosage({ weightKg: 70, rigType: 'ERIG' });
      expect(result.totalIuRequired).toBe(2800); // 70 * 40
      expect(result.volumeMlRequired).toBe(9.3); // 2800 / 300 = 9.33 -> 9.3 mL
    });
  });

  describe('evaluateWardAbcCompliance', () => {
    it('identifies compliant ward with >= 70% sterilization and designated feeding spots', () => {
      const result = evaluateWardAbcCompliance({
        wardNumber: 'Ward 45',
        estimatedDogCount: 100,
        sterilizedDogCount: 75,
        monitoringCommitteeExists: true,
        relocationComplaints: false,
        designatedFeedingSpotsSetup: true,
      });

      expect(result.isCompliant).toBe(true);
      expect(result.meetsHerdImmunityThreshold).toBe(true);
      expect(result.sterilizationRatioPercent).toBe(75);
      expect(result.nonCompliances.length).toBe(0);
    });

    it('flags illegal relocation and low sterilization coverage', () => {
      const result = evaluateWardAbcCompliance({
        wardNumber: 'Ward 12',
        estimatedDogCount: 200,
        sterilizedDogCount: 50,
        monitoringCommitteeExists: false,
        relocationComplaints: true,
        designatedFeedingSpotsSetup: false,
      });

      expect(result.isCompliant).toBe(false);
      expect(result.meetsHerdImmunityThreshold).toBe(false);
      expect(result.sterilizationRatioPercent).toBe(25);
      expect(result.nonCompliances.length).toBe(4);
      expect(result.statutoryWarningRelocation).toContain('AWBI v. A. Nagaraja');
    });
  });

  describe('generateFeederCharter', () => {
    it('produces standard caretaker guidelines under Rule 20', () => {
      const charter = generateFeederCharter({
        colonyName: 'Green Meadows Residency',
      });
      expect(charter.colonyName).toBe('Green Meadows Residency');
      expect(charter.caretakerRights.length).toBeGreaterThan(0);
      expect(charter.caretakerResponsibilities.length).toBeGreaterThan(0);
    });
  });

  describe('generateMunicipalAbcRequisition', () => {
    it('formats municipal requisition with statutory citations', () => {
      const text = generateMunicipalAbcRequisition({
        applicant: { name: 'Sunita Rao', address: 'B-104 Sunrise Apts', contact: '9876543210' },
        location: { ward: 'Ward 22', city: 'Bengaluru', state: 'Karnataka' },
        unsterilizedDogs: 35,
      });

      expect(text).toContain('RULE 11 & 16 OF ANIMAL BIRTH CONTROL RULES, 2023');
      expect(text).toContain('Sunita Rao');
      expect(text).toContain('Ward 22');
      expect(text).toContain('Bengaluru');
      expect(text).toContain('35');
    });
  });

  describe('generateRabiesPepSlip', () => {
    it('generates clinical PEP passport slip with vaccination dates', () => {
      const slip = generateRabiesPepSlip({
        patient: { name: 'Aarav Patel', age: '28 / M', weightKg: 65 },
        exposureDate: '2026-11-10',
        category: 'CATEGORY_III',
        rigType: 'HRIG',
        regimenKey: 'ESSEN_IM',
      });

      expect(slip).toContain('RABIES POST-EXPOSURE PROPHYLAXIS (PEP) EMERGENCY MEDICAL PASSPORT');
      expect(slip).toContain('Aarav Patel');
      expect(slip).toContain('65 kg');
      expect(slip).toContain('1300 IU'); // 65 * 20
      expect(slip).toContain('Dose 1');
      expect(slip).toContain('Dose 5');
    });
  });
});
