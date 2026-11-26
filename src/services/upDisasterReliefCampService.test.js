import { describe, it, expect } from 'vitest';
import {
  assessReliefCampReadiness,
  evaluateCampAccessibility,
  exportReliefCampSitRep,
  UP_RELIEF_FACILITIES,
  UP_RELIEF_ESCALATION
} from './upDisasterReliefCampService';

describe('upDisasterReliefCampService', () => {
  it('should define core relief amenities and escalation officers', () => {
    expect(UP_RELIEF_FACILITIES.DRINKING_WATER).toBe('POTABLE_DRINKING_WATER');
    expect(UP_RELIEF_FACILITIES.FIRST_AID_AND_ORS).toBe('FIRST_AID_ANTIVENOM_ORS');
    expect(UP_RELIEF_ESCALATION.length).toBe(3);
    expect(UP_RELIEF_ESCALATION[2].authority).toContain('Relief Commissioner');
  });

  it('should calculate readiness score and flag critical water deficit', () => {
    const campData = {
      campId: 'CAMP-GOR-004',
      campName: 'Badhalganj Flood Relief Center',
      district: 'Gorakhpur',
      maxCapacityPersons: 200,
      currentOccupancyPersons: 180,
      hasPotableWater: false, // Critical shortage
      hasMedicalOfficerOrORS: true,
      hasGenderSeparatedSanitation: true,
      hasInfantFoodOrMilk: false
    };

    const res = assessReliefCampReadiness(campData);
    expect(res.occupancyRate).toBe(90);
    expect(res.isOpenForIntake).toBe(true);
    expect(res.criticalShortages.some(s => s.includes('Drinking Water'))).toBe(true);
    expect(res.requiresImmediateReliefDispatch).toBe(true);
    expect(res.statusLevel).toBe('PARTIAL');
  });

  it('should mark camp closed for intake when at full capacity', () => {
    const fullCamp = {
      maxCapacityPersons: 100,
      currentOccupancyPersons: 105,
      hasPotableWater: true,
      hasMedicalOfficerOrORS: true,
      hasGenderSeparatedSanitation: true,
      hasInfantFoodOrMilk: true
    };

    const res = assessReliefCampReadiness(fullCamp);
    expect(res.isOpenForIntake).toBe(false);
    expect(res.readinessScore).toBe(100);
    expect(res.statusLevel).toBe('SATISFACTORY');
  });

  it('should evaluate accessibility for elderly and wheelchair evacuees', () => {
    const poorAccessibility = {
      hasRamp: false,
      hasGroundFloorBeds: true,
      hasIlluminatedLatrinePath: false,
      hasAccessibleToilet: false
    };

    const evalPoor = evaluateCampAccessibility(poorAccessibility);
    expect(evalPoor.accessibilityScore).toBe(25);
    expect(evalPoor.isDivyangjanFriendly).toBe(false);
    expect(evalPoor.recommendation).toContain('Action Required');

    const goodAccessibility = {
      hasRamp: true,
      hasGroundFloorBeds: true,
      hasIlluminatedLatrinePath: true,
      hasAccessibleToilet: true
    };

    const evalGood = evaluateCampAccessibility(goodAccessibility);
    expect(evalGood.accessibilityScore).toBe(100);
    expect(evalGood.isDivyangjanFriendly).toBe(true);
  });

  it('should export situation report (SitRep) markdown', () => {
    const readiness = {
      campName: 'Gomti Barrage Primary School Shelter',
      campId: 'LKO-SHELTER-01',
      district: 'Lucknow',
      isOpenForIntake: true,
      occupancy: 45,
      capacity: 100,
      occupancyRate: 45,
      readinessScore: 85,
      statusLevel: 'SATISFACTORY',
      criticalShortages: []
    };

    const accessibility = {
      accessibilityScore: 75,
      isDivyangjanFriendly: true,
      recommendation: 'Camp meets core accessible disaster evacuation standards.'
    };

    const sitRep = exportReliefCampSitRep(readiness, accessibility);
    expect(sitRep).toContain('# Disaster Relief Shelter Situation Report (SitRep)');
    expect(sitRep).toContain('Gomti Barrage Primary School Shelter');
    expect(sitRep).toContain('🟢 OPEN FOR INTAKE');
    expect(sitRep).toContain('85/100 (SATISFACTORY)');
    expect(sitRep).toContain('Zero beneficiary names');
  });

  it('should list flood-prone districts and disaster emergency contacts', async () => {
    const { getFloodProneDistricts, getEmergencyDisasterContacts } = await import('./upDisasterReliefCampService');
    const districts = getFloodProneDistricts();
    expect(districts.length).toBeGreaterThanOrEqual(5);
    expect(districts.some(d => d.district === 'Gorakhpur')).toBe(true);
    expect(districts.some(d => d.riverBasin.includes('Ghaghra'))).toBe(true);

    const contacts = getEmergencyDisasterContacts();
    expect(contacts.some(c => c.number === '1070')).toBe(true);
    expect(contacts.some(c => c.service.includes('SDRF'))).toBe(true);
  });

  it('should list standard operating procedures for relief shelters', async () => {
    const { getReliefShelterSops } = await import('./upDisasterReliefCampService');
    const sops = getReliefShelterSops();
    expect(sops.length).toBeGreaterThanOrEqual(4);
    expect(sops.some(s => s.includes('Nodal Officer'))).toBe(true);
    expect(sops.some(s => s.includes('chloroscope'))).toBe(true);
  });

  it('should return community kitchen dietary and water ratio norms', async () => {
    const { getCommunityKitchenNorms } = await import('./upDisasterReliefCampService');
    const norms = getCommunityKitchenNorms();
    expect(norms.GRAIN_PER_PERSON_PER_DAY_GRAMS).toBe(450);
    expect(norms.POTABLE_WATER_PER_PERSON_PER_DAY_LITRES).toBe(15);
    expect(norms.MILK_PER_INFANT_PER_DAY_ML).toBe(500);
  });

  it('should list standard UP Government flood relief family kit items', async () => {
    const { getStandardReliefKitItems } = await import('./upDisasterReliefCampService');
    const kit = getStandardReliefKitItems();
    expect(kit.length).toBeGreaterThanOrEqual(4);
    expect(kit.some(k => k.includes('Tarpaulin'))).toBe(true);
    expect(kit.some(k => k.includes('Mosquito repellent'))).toBe(true);
  });
});
