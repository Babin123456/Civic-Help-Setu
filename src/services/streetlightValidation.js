/**
 * Streetlight Input Validation & Sanitization Layer (#756).
 * Enforces strict length, enum, coordinate range, and format constraints.
 * Protects against XSS injection, out-of-bounds coordinates, and invalid state changes.
 */

import {
  STREETLIGHT_ERROR_CODES,
  FAULT_CATEGORIES,
  PRIORITY_TIERS,
  RESOLUTION_ACTIONS,
  POLE_TYPES,
  LUMINAIRE_TYPES,
  ASSET_STATUS,
} from './streetlightConstants';

export class StreetlightServiceError extends Error {
  constructor(code, message, details = null) {
    super(message || code);
    this.name = 'StreetlightServiceError';
    this.code = code || STREETLIGHT_ERROR_CODES.VALIDATION_ERROR;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Strips script tags, HTML tags, and trims whitespace to neutralize injection attempts.
 */
export const sanitizeText = (text, maxLength = 500) => {
  if (typeof text !== 'string') return '';
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim()
    .slice(0, maxLength);
};

/**
 * Validates coordinate pair.
 */
export const validateCoordinates = (coordinates) => {
  if (!coordinates || typeof coordinates !== 'object') {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.VALIDATION_ERROR,
      'Coordinates object is required ({ lat, lng }).'
    );
  }
  const { lat, lng } = coordinates;
  if (typeof lat !== 'number' || Number.isNaN(lat) || lat < -90 || lat > 90) {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.VALIDATION_ERROR,
      `Latitude must be a valid number between -90 and 90. Got ${lat}`
    );
  }
  if (typeof lng !== 'number' || Number.isNaN(lng) || lng < -180 || lng > 180) {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.VALIDATION_ERROR,
      `Longitude must be a valid number between -180 and 180. Got ${lng}`
    );
  }
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
};

/**
 * Validates an outage report payload.
 */
export const validateReportInput = (input) => {
  if (!input || typeof input !== 'object') {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.VALIDATION_ERROR,
      'Report input must be a valid object.'
    );
  }

  const {
    assetId,
    location,
    faultCategory,
    landmark,
    description,
    reporterCategory = 'citizen',
    contactNumber,
  } = input;

  if (!faultCategory || !Object.values(FAULT_CATEGORIES).includes(faultCategory)) {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.VALIDATION_ERROR,
      `Invalid or missing fault category. Allowed: ${Object.values(FAULT_CATEGORIES).join(', ')}`
    );
  }

  // Either a pole asset ID or an approximate location with coordinates is required
  let validatedCoords = null;
  if (location && location.lat !== undefined && location.lng !== undefined) {
    validatedCoords = validateCoordinates(location);
  } else if (!assetId) {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.VALIDATION_ERROR,
      'Either a pole Asset ID or approximate location coordinates are required.'
    );
  }

  const sanitizedLandmark = sanitizeText(landmark || location?.landmark || '', 200);
  const sanitizedDescription = sanitizeText(description || '', 1000);
  const sanitizedAddress = sanitizeText(location?.addressText || '', 300);

  return {
    assetId: assetId ? String(assetId).trim() : null,
    location: validatedCoords
      ? {
          lat: validatedCoords.lat,
          lng: validatedCoords.lng,
          addressText: sanitizedAddress,
          landmark: sanitizedLandmark,
        }
      : null,
    faultCategory,
    landmark: sanitizedLandmark,
    description: sanitizedDescription,
    reporterCategory: ['citizen', 'patrol', 'sensor'].includes(reporterCategory)
      ? reporterCategory
      : 'citizen',
    contactNumber: contactNumber ? String(contactNumber).trim().slice(0, 30) : null,
  };
};

/**
 * Validates work order creation.
 */
export const validateWorkOrderInput = (input) => {
  if (!input || typeof input !== 'object') {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.VALIDATION_ERROR,
      'Work order input is required.'
    );
  }

  const { clusterId, assignedTechnicianId, priority = PRIORITY_TIERS.HIGH, targetSlaHours = 48, scheduledDate, notes } = input;

  if (!clusterId || typeof clusterId !== 'string') {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.VALIDATION_ERROR,
      'A valid Cluster ID is required to create a work order.'
    );
  }

  if (!assignedTechnicianId || typeof assignedTechnicianId !== 'string') {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.VALIDATION_ERROR,
      'An assigned technician identifier is required.'
    );
  }

  if (!Object.values(PRIORITY_TIERS).includes(priority)) {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.VALIDATION_ERROR,
      `Invalid priority tier. Allowed: ${Object.values(PRIORITY_TIERS).join(', ')}`
    );
  }

  const slaNum = Number(targetSlaHours);
  if (Number.isNaN(slaNum) || slaNum <= 0 || slaNum > 720) {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.VALIDATION_ERROR,
      'Target SLA must be between 1 and 720 hours.'
    );
  }

  return {
    clusterId: clusterId.trim(),
    assignedTechnicianId: assignedTechnicianId.trim(),
    priority,
    targetSlaHours: slaNum,
    scheduledDate: scheduledDate ? String(scheduledDate).trim() : new Date().toISOString().slice(0, 10),
    notes: sanitizeText(notes || '', 500),
  };
};

/**
 * Validates repair event logging.
 */
export const validateRepairEventInput = (input) => {
  if (!input || typeof input !== 'object') {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.VALIDATION_ERROR,
      'Repair event data is required.'
    );
  }

  const { workOrderId, assetId, resolutionAction, partsReplaced = [], technicianNotes, photoChecksum } = input;

  if (!workOrderId || typeof workOrderId !== 'string') {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.VALIDATION_ERROR,
      'Work Order ID is required.'
    );
  }

  if (!resolutionAction || !Object.values(RESOLUTION_ACTIONS).includes(resolutionAction)) {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.VALIDATION_ERROR,
      `Invalid resolution action. Allowed: ${Object.values(RESOLUTION_ACTIONS).join(', ')}`
    );
  }

  if (!Array.isArray(partsReplaced)) {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.VALIDATION_ERROR,
      'Parts replaced must be an array.'
    );
  }

  const sanitizedParts = partsReplaced.map((part) => {
    if (!part || typeof part !== 'object' || !part.partNumber) {
      throw new StreetlightServiceError(
        STREETLIGHT_ERROR_CODES.VALIDATION_ERROR,
        'Each part must include a partNumber.'
      );
    }
    const qty = Number(part.quantity || 1);
    return {
      partNumber: String(part.partNumber).trim().slice(0, 50),
      description: sanitizeText(part.description || '', 100),
      quantity: qty > 0 ? qty : 1,
    };
  });

  return {
    workOrderId: workOrderId.trim(),
    assetId: assetId ? String(assetId).trim() : null,
    resolutionAction,
    partsReplaced: sanitizedParts,
    technicianNotes: sanitizeText(technicianNotes || '', 1000),
    photoChecksum: photoChecksum ? String(photoChecksum).trim().slice(0, 128) : null,
  };
};

/**
 * Validates asset creation / update.
 */
export const validateAssetInput = (input) => {
  if (!input || typeof input !== 'object') {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.VALIDATION_ERROR,
      'Asset payload is required.'
    );
  }

  const {
    id,
    jurisdictionId,
    coordinates,
    street,
    landmark,
    poleType = POLE_TYPES.STANDARD,
    luminaireType = LUMINAIRE_TYPES.LED_70W,
    wattage = 70,
    operationalStatus = ASSET_STATUS.FUNCTIONAL,
  } = input;

  if (!id || typeof id !== 'string') {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.VALIDATION_ERROR,
      'Pole Asset ID is required (e.g. POLE-042-101).'
    );
  }

  if (!jurisdictionId || typeof jurisdictionId !== 'string') {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.VALIDATION_ERROR,
      'Jurisdiction / Ward ID is required.'
    );
  }

  const coords = validateCoordinates(coordinates);

  if (!Object.values(POLE_TYPES).includes(poleType)) {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.VALIDATION_ERROR,
      `Invalid pole type. Allowed: ${Object.values(POLE_TYPES).join(', ')}`
    );
  }

  if (!Object.values(LUMINAIRE_TYPES).includes(luminaireType)) {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.VALIDATION_ERROR,
      `Invalid luminaire type. Allowed: ${Object.values(LUMINAIRE_TYPES).join(', ')}`
    );
  }

  if (!Object.values(ASSET_STATUS).includes(operationalStatus)) {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.VALIDATION_ERROR,
      `Invalid operational status. Allowed: ${Object.values(ASSET_STATUS).join(', ')}`
    );
  }

  return {
    id: id.trim().toUpperCase(),
    jurisdictionId: jurisdictionId.trim().toUpperCase(),
    coordinates: coords,
    street: sanitizeText(street || '', 150),
    landmark: sanitizeText(landmark || '', 150),
    poleType,
    luminaireType,
    wattage: Number(wattage) || 70,
    operationalStatus,
  };
};

/**
 * Validates uploaded photo / document evidence.
 */
export const validateFileUpload = (fileMeta) => {
  if (!fileMeta || typeof fileMeta !== 'object') {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.VALIDATION_ERROR,
      'File metadata is required.'
    );
  }

  const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

  const { type, size, name } = fileMeta;

  if (!ALLOWED_MIME_TYPES.includes(type)) {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.VALIDATION_ERROR,
      `Disallowed file type: ${type}. Only JPEG, PNG, and WebP images are accepted.`
    );
  }

  if (typeof size === 'number' && size > MAX_BYTES) {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.VALIDATION_ERROR,
      `File size exceeds 5MB limit (${Math.round(size / 1024 / 1024)}MB).`
    );
  }

  return {
    name: sanitizeText(name || 'upload.jpg', 100),
    type,
    size,
    sanitized: true,
  };
};
