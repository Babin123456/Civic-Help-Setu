/**
 * Municipal Waste Collection Route and Segregation Audit Data Models
 *
 * Defines the domain entities and their schemas for the AI-Assisted Municipal
 * Waste Collection Route and Segregation Audit Planner feature (#755).
 *
 * @module routePlanning/models
 */

/**
 * CollectionRoute represents a planned or completed collection route for a ward or jurisdiction.
 */
export const CollectionRouteStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

export const CollectionRoute = function (data = {}) {
  this.recordType = 'CollectionRoute';
  this.id = data.id || null;
  this.name = data.name || null;
  this.ward = data.ward || null;
  this.jurisdiction = data.jurisdiction || null;
  this.status = data.status || CollectionRouteStatus.DRAFT;
  this.description = data.description || '';
  this.vehicleIds = Array.isArray(data.vehicleIds) ? data.vehicleIds : [];
  this.pickupPointIds = Array.isArray(data.pickupPointIds) ? data.pickupPointIds : [];
  this.scheduledStartTime = data.scheduledStartTime || '06:30';
  this.scheduledEndTime = data.scheduledEndTime || '11:00';
  this.createdAt = data.createdAt || null;
  this.updatedAt = data.updatedAt || null;
  this.createdBy = data.createdBy || null;
  this.schemaVersion = data.schemaVersion || '1.3.0';
};

/**
 * PickupPoint represents a specific location where waste collection occurs.
 */
export const PickupPointStatus = {
  SCHEDULED: 'SCHEDULED',
  SERVICED: 'SERVICED',
  MISSED: 'MISSED',
  SKIPPED: 'SKIPPED',
};

export const PickupPoint = function (data = {}) {
  this.recordType = 'PickupPoint';
  this.id = data.id || null;
  this.ward = data.ward || null;
  this.jurisdiction = data.jurisdiction || null;
  this.address = data.address || '';
  this.coordinates = data.coordinates || { lat: 0, lng: 0 };
  this.collectionType = data.collectionType || 'door-to-door'; // door-to-door, bulk, street
  this.wasteStreams = Array.isArray(data.wasteStreams) ? data.wasteStreams : ['wet', 'dry', 'hazardous'];
  this.estimatedWasteKg = typeof data.estimatedWasteKg === 'number' ? data.estimatedWasteKg : 45;
  this.scheduledTime = data.scheduledTime || '07:00';
  this.actualServiceTime = data.actualServiceTime || null;
  this.status = data.status || PickupPointStatus.SCHEDULED;
  this.notes = data.notes || '';
  this.frequency = data.frequency || 'daily'; // daily, weekly, alternate-day
  this.vehicleId = data.vehicleId || null;
  this.schemaVersion = data.schemaVersion || '1.3.0';
};

/**
 * Vehicle represents a waste collection vehicle with specific capacity and equipment.
 */
export const VehicleStatus = {
  AVAILABLE: 'AVAILABLE',
  DEPLOYED: 'DEPLOYED',
  MAINTENANCE: 'MAINTENANCE',
  RETIRED: 'RETIRED',
};

export const VehicleCapacityUnit = {
  KG: 'KG',
  LITRES: 'LITRES',
};

export const Vehicle = function (data = {}) {
  this.recordType = 'Vehicle';
  this.id = data.id || null;
  this.registrationNumber = data.registrationNumber || '';
  this.type = data.type || 'standard'; // standard, compact, tipper, segregation-specialized
  this.capacityKg = typeof data.capacityKg === 'number' ? data.capacityKg : 500;
  this.capacityLitres = typeof data.capacityLitres === 'number' ? data.capacityLitres : 1000;
  this.currentLoadKg = typeof data.currentLoadKg === 'number' ? data.currentLoadKg : 0;
  this.currentLoadLitres = typeof data.currentLoadLitres === 'number' ? data.currentLoadLitres : 0;
  this.status = data.status || VehicleStatus.AVAILABLE;
  this.assignedRouteId = data.assignedRouteId || null;
  this.homeBase = data.homeBase || null;
  this.lastMaintenance = data.lastMaintenance || null;
  this.nextMaintenance = data.nextMaintenance || null;
  this.schemaVersion = data.schemaVersion || '1.3.0';
};

/**
 * RouteRun represents a single execution of a collection route.
 */
export const RouteRunStatus = {
  PLANNED: 'PLANNED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  ABANDONED: 'ABANDONED',
};

export const RouteRun = function (data = {}) {
  this.recordType = 'RouteRun';
  this.id = data.id || null;
  this.routeId = data.routeId || null;
  this.vehicleId = data.vehicleId || null;
  this.startTime = data.startTime || null;
  this.endTime = data.endTime || null;
  this.pickupPointsVisited = typeof data.pickupPointsVisited === 'number' ? data.pickupPointsVisited : 0;
  this.pickupPointsTotal = typeof data.pickupPointsTotal === 'number' ? data.pickupPointsTotal : 0;
  this.wasteCollectedKg = typeof data.wasteCollectedKg === 'number' ? data.wasteCollectedKg : 0;
  this.wasteCollectedLitres = typeof data.wasteCollectedLitres === 'number' ? data.wasteCollectedLitres : 0;
  this.missedPickupIds = Array.isArray(data.missedPickupIds) ? data.missedPickupIds : [];
  this.status = data.status || RouteRunStatus.PLANNED;
  this.notes = data.notes || '';
  this.schemaVersion = data.schemaVersion || '1.3.0';
};

/**
 * SegregationAudit represents a sampled audit of waste segregation.
 */
export const SegregationAuditStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  REVIEWED: 'REVIEWED',
};

export const SegregationAuditRating = {
  EXCELLENT: 'EXCELLENT', // 90-100% segregation compliance
  GOOD: 'GOOD',           // 70-89% segregation compliance
  FAIR: 'FAIR',           // 50-69% segregation compliance
  POOR: 'POOR',           // 30-49% segregation compliance
  VERY_POOR: 'VERY_POOR', // < 30% segregation compliance
};

export const SegregationAudit = function (data = {}) {
  this.recordType = 'SegregationAudit';
  this.id = data.id || null;
  this.pickupPointId = data.pickupPointId || null;
  this.ward = data.ward || null;
  this.jurisdiction = data.jurisdiction || null;
  this.auditorId = data.auditorId || null;
  this.auditDate = data.auditDate || new Date().toISOString();
  this.observedStreams = data.observedStreams || { wet: 0, dry: 0, hazardous: 0 };
  this.expectedStreams = data.expectedStreams || { wet: 1, dry: 1, hazardous: 1 };
  this.compliancePercentage = typeof data.compliancePercentage === 'number' ? data.compliancePercentage : 0;
  this.rating = data.rating || SegregationAuditRating.FAIR;
  this.issuesNoted = data.issuesNoted || '';
  this.photos = Array.isArray(data.photos) ? data.photos : [];
  this.integritySeal = data.integritySeal || null;
  this.notes = data.notes || '';
  this.status = data.status || SegregationAuditStatus.COMPLETED;
  this.schemaVersion = data.schemaVersion || '1.3.0';
};

/**
 * RouteRecommendation represents an AI-assisted suggestion.
 */
export const RouteRecommendationStatus = {
  PROPOSED: 'PROPOSED',
  ACCEPTED: 'ACCEPTED',
  EDITED: 'EDITED',
  REJECTED: 'REJECTED',
};

export const RouteRecommendationPriority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
};

export const RouteRecommendation = function (data = {}) {
  this.recordType = 'RouteRecommendation';
  this.id = data.id || null;
  this.routeId = data.routeId || null;
  this.type = data.type || 'OPTIMIZATION'; // OPTIMIZATION, CAPACITY, SEGREGATION, MISSED_PICKUP
  this.priority = data.priority || RouteRecommendationPriority.MEDIUM;
  this.title = data.title || '';
  this.description = data.description || '';
  this.explanation = data.explanation || '';
  this.sourceFields = data.sourceFields || {};
  this.suggestedData = data.suggestedData || {};
  this.modelVersion = data.modelVersion || 'ruleset-v1.0.0-deterministic';
  this.executedAt = data.executedAt || new Date().toISOString();
  this.acceptedBy = data.acceptedBy || null;
  this.acceptedAt = data.acceptedAt || null;
  this.rejectionReason = data.rejectionReason || null;
  this.status = data.status || RouteRecommendationStatus.PROPOSED;
  this.schemaVersion = data.schemaVersion || '1.3.0';
};

/**
 * MissedPickup represents a pickup that was not completed on schedule.
 */
export const MissedPickup = function (data = {}) {
  this.recordType = 'MissedPickup';
  this.id = data.id || null;
  this.routeRunId = data.routeRunId || null;
  this.pickupPointId = data.pickupPointId || null;
  this.reason = data.reason || 'UNKNOWN'; // VEHICLE_BREAKDOWN, ROAD_BLOCKED, ACCESS_DENIED, OVERFLOW
  this.reportedAt = data.reportedAt || new Date().toISOString();
  this.resolvedAt = data.resolvedAt || null;
  this.resolutionNotes = data.resolutionNotes || '';
  this.schemaVersion = data.schemaVersion || '1.3.0';
};

// Duck-typing and record-type helpers for safe deserialization
export const isCollectionRoute = (r) => Boolean(r && (r.recordType === 'CollectionRoute' || ('pickupPointIds' in r && 'ward' in r)));
export const isPickupPoint = (r) => Boolean(r && (r.recordType === 'PickupPoint' || ('collectionType' in r && 'address' in r)));
export const isVehicle = (r) => Boolean(r && (r.recordType === 'Vehicle' || ('registrationNumber' in r && 'capacityKg' in r)));
export const isRouteRun = (r) => Boolean(r && (r.recordType === 'RouteRun' || ('pickupPointsVisited' in r && 'routeId' in r)));
export const isSegregationAudit = (r) => Boolean(r && (r.recordType === 'SegregationAudit' || ('observedStreams' in r && 'compliancePercentage' in r)));
export const isRouteRecommendation = (r) => Boolean(r && (r.recordType === 'RouteRecommendation' || ('suggestedData' in r && 'modelVersion' in r)));
export const isMissedPickup = (r) => Boolean(r && (r.recordType === 'MissedPickup' || ('routeRunId' in r && 'reason' in r)));
