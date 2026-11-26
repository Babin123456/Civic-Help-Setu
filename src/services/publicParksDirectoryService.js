import { PUBLIC_PARKS_DIRECTORY } from '../data/publicParksDirectoryData.js';

/**
 * @file publicParksDirectoryService.js
 * @description Search, filtering, and accessibility querying service for ward-level public parks and recreational spaces.
 */

export class PublicParksDirectoryService {
  constructor(initialParks = PUBLIC_PARKS_DIRECTORY) {
    this.parks = [...initialParks];
  }

  /**
   * Returns all parks matching jurisdiction, ward, accessibility requirements, and amenity filters.
   */
  searchParks(criteria = {}) {
    return this.parks.filter(park => {
      if (criteria.jurisdictionId && park.jurisdictionId !== criteria.jurisdictionId) {
        return false;
      }
      if (criteria.wardNumber !== undefined && park.wardNumber !== Number(criteria.wardNumber)) {
        return false;
      }
      if (criteria.query) {
        const q = criteria.query.toLowerCase().trim();
        const matchesName = park.name.toLowerCase().includes(q);
        const matchesWard = park.wardName.toLowerCase().includes(q);
        const matchesAddress = park.address.toLowerCase().includes(q);
        if (!matchesName && !matchesWard && !matchesAddress) return false;
      }
      if (criteria.wheelchairAccessibleOnly) {
        if (!park.accessibility.stepFreeAccess || !park.accessibility.hasWheelchairRamps) {
          return false;
        }
      }
      if (criteria.accessibleToiletOnly && !park.accessibility.accessibleToilets) {
        return false;
      }
      if (criteria.tactilePavingOnly && !park.accessibility.tactilePaving) {
        return false;
      }
      if (criteria.amenity) {
        const requiredAmenity = criteria.amenity.toUpperCase();
        if (!park.amenities.includes(requiredAmenity)) return false;
      }
      return true;
    });
  }

  getParkById(parkId) {
    return this.parks.find(p => p.id === parkId) || null;
  }

  getParksByWard(jurisdictionId, wardNumber) {
    return this.searchParks({ jurisdictionId, wardNumber });
  }

  /**
   * Aggregates accessibility metrics across a given jurisdiction
   */
  getJurisdictionAccessibilitySummary(jurisdictionId) {
    const list = this.parks.filter(p => !jurisdictionId || p.jurisdictionId === jurisdictionId);
    const total = list.length;
    if (total === 0) {
      return { total: 0, stepFreeCount: 0, rampRatio: 0, accessibleToiletRatio: 0 };
    }

    const stepFreeCount = list.filter(p => p.accessibility.stepFreeAccess).length;
    const rampCount = list.filter(p => p.accessibility.hasWheelchairRamps).length;
    const toiletCount = list.filter(p => p.accessibility.accessibleToilets).length;

    return {
      total,
      stepFreeCount,
      stepFreeRatio: Number((stepFreeCount / total).toFixed(2)),
      rampRatio: Number((rampCount / total).toFixed(2)),
      accessibleToiletRatio: Number((toiletCount / total).toFixed(2))
    };
  }

  /**
   * Reports an issue or maintenance gap for a public park
   */
  submitMaintenanceReport(parkId, report) {
    const park = this.getParkById(parkId);
    if (!park) {
      throw new Error(`Park not found with ID ${parkId}`);
    }

    return {
      ticketId: `prk_rep_${Date.now()}`,
      parkId,
      parkName: park.name,
      maintenanceAuthority: park.maintenanceAuthority.name,
      officerContact: park.maintenanceAuthority.officerContact,
      issueType: report.issueType || 'MAINTENANCE_GENERAL',
      description: report.description,
      reportedAt: new Date().toISOString(),
      status: 'SUBMITTED_TO_LOCAL_AUTHORITY'
    };
  }
}

export const defaultParksDirectoryService = new PublicParksDirectoryService();
