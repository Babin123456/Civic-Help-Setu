/**
 * src/services/waterQualityValidation.js
 * Strict input schema validation, sanitization, and PII detection
 * for the Water Quality Register module (#754).
 */

import {
  WATER_POINT_TYPES,
  OPERATIONAL_STATUSES,
  SAMPLE_TYPES,
  CORRECTIVE_ACTION_TYPES,
  CORRECTIVE_ACTION_STATUSES,
  IS_10500_STANDARDS,
} from '../data/waterQualityContract.js';

// Regexes for sensitive personal identifiable information
export const AADHAAR_REGEX = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
export const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
export const PHONE_REGEX = /(?<![\d])(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?![\d])/;
export const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
export const RESIDENTIAL_DOOR_REGEX = /\b(?:flat\s*(?:no\.?|#)?\s*[a-z0-9-]+|door\s*(?:no\.?|#)?\s*[a-z0-9/-]+|house\s*(?:no\.?|#)?\s*[a-z0-9/-]+)\b/i;

/**
 * Sanitizes input string to prevent XSS / script injection and strip control characters
 */
export function sanitizeString(val, maxLen = 1000) {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .trim()
    .slice(0, maxLen);
}

/**
 * Checks if a string contains prohibited PII
 */
export function detectProhibitedPII(text) {
  if (typeof text !== 'string' || !text.trim()) return null;

  if (AADHAAR_REGEX.test(text)) {
    return 'Aadhaar identity number pattern detected. Personal IDs are prohibited.';
  }
  if (PAN_REGEX.test(text)) {
    return 'Income Tax PAN number detected. Financial identifiers are prohibited.';
  }
  if (PHONE_REGEX.test(text)) {
    return 'Personal phone number pattern detected. Direct contact details are prohibited in public records.';
  }
  if (EMAIL_REGEX.test(text)) {
    return 'Personal email address pattern detected.';
  }
  if (RESIDENTIAL_DOOR_REGEX.test(text)) {
    return 'Exact residential flat or door number detected. Only public water point locations and landmarks are permitted.';
  }

  return null;
}

/**
 * Validates payload for creating or registering a public water point
 */
export function validateWaterPointPayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') {
    return ['Payload must be a valid JSON object.'];
  }

  const name = sanitizeString(payload.name, 120);
  if (!name || name.length < 3) {
    errors.push('Water point name is required and must be between 3 and 120 characters.');
  }
  const namePii = detectProhibitedPII(name);
  if (namePii) errors.push(`Water point name: ${namePii}`);

  if (!payload.pointType || !WATER_POINT_TYPES[payload.pointType]) {
    errors.push(`Invalid water point type: ${payload.pointType}. Must be one of: ${Object.keys(WATER_POINT_TYPES).join(', ')}.`);
  }

  const ward = sanitizeString(payload.ward, 80);
  if (!ward || ward.length < 2) {
    errors.push('Ward / Locality name is required (at least 2 characters).');
  }

  const city = sanitizeString(payload.city, 80);
  if (!city || city.length < 2) {
    errors.push('City / Urban Local Body is required.');
  }

  const landmark = sanitizeString(payload.landmark || '', 200);
  const landmarkPii = detectProhibitedPII(landmark);
  if (landmarkPii) errors.push(`Landmark: ${landmarkPii}`);

  if (payload.operationalStatus && !OPERATIONAL_STATUSES[payload.operationalStatus]) {
    errors.push(`Invalid operational status: ${payload.operationalStatus}.`);
  }

  // Coordinates validation (if provided)
  if (payload.latitude !== undefined && payload.latitude !== null) {
    const lat = Number(payload.latitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      errors.push('Latitude must be a valid number between -90 and 90.');
    }
  }

  if (payload.longitude !== undefined && payload.longitude !== null) {
    const lng = Number(payload.longitude);
    if (isNaN(lng) || lng < -180 || lng > 180) {
      errors.push('Longitude must be a valid number between -180 and 180.');
    }
  }

  return errors;
}

/**
 * Validates payload for registering a physical water sampling event
 */
export function validateSamplingEventPayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') {
    return ['Payload must be a valid JSON object.'];
  }

  if (!payload.waterPointId || typeof payload.waterPointId !== 'string' || !payload.waterPointId.trim()) {
    errors.push('Target waterPointId is required.');
  }

  if (!payload.collectionDate) {
    errors.push('Sample collection date is required.');
  } else {
    const dateVal = new Date(payload.collectionDate);
    if (isNaN(dateVal.getTime())) {
      errors.push('Collection date must be a valid date.');
    } else {
      const now = new Date();
      // Cannot be in the distant future (> 24 hours ahead)
      if (dateVal.getTime() > now.getTime() + 86400000) {
        errors.push('Collection date cannot be in the future.');
      }
    }
  }

  if (!payload.sampleType || !SAMPLE_TYPES[payload.sampleType]) {
    errors.push(`Sample type must be one of: ${Object.keys(SAMPLE_TYPES).join(', ')}.`);
  }

  const samplerRole = sanitizeString(payload.collectedByRole || 'certified_field_sampler', 60);
  if (!samplerRole) {
    errors.push('Collector role is required.');
  }

  const sealedContainerCode = sanitizeString(payload.sealedContainerCode || '', 60);
  if (!sealedContainerCode) {
    errors.push('Sealed container bar code / container ID is required for chain of custody.');
  }

  const notes = sanitizeString(payload.notes || '', 1000);
  const notesPii = detectProhibitedPII(notes);
  if (notesPii) errors.push(`Sampling notes: ${notesPii}`);

  return errors;
}

/**
 * Validates individual or batch parameter test entries
 */
export function validateLabResultPayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') {
    return ['Lab result payload must be a valid object.'];
  }

  if (!payload.sampleEventId || typeof payload.sampleEventId !== 'string' || !payload.sampleEventId.trim()) {
    errors.push('sampleEventId is required.');
  }

  if (!payload.labId || typeof payload.labId !== 'string' || !payload.labId.trim()) {
    errors.push('labId is required for accreditation tracking.');
  }

  if (!Array.isArray(payload.results) || payload.results.length === 0) {
    errors.push('At least one tested parameter result is required in the results array.');
  } else {
    payload.results.forEach((item, idx) => {
      if (!item.parameterCode || !IS_10500_STANDARDS.parameters[item.parameterCode]) {
        errors.push(`Result [${idx}]: Invalid or unsupported parameter code "${item.parameterCode}".`);
      }
      const val = Number(item.testedValue);
      if (isNaN(val) || val < 0) {
        errors.push(`Result [${idx}]: Tested value must be a valid non-negative number.`);
      }
    });
  }

  const analystNotes = sanitizeString(payload.analystNotes || '', 1000);
  const notesPii = detectProhibitedPII(analystNotes);
  if (notesPii) errors.push(`Analyst notes: ${notesPii}`);

  return errors;
}

/**
 * Validates official correction / result supersession payload
 */
export function validateCorrectionPayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') {
    return ['Correction payload must be an object.'];
  }

  if (!payload.sampleEventId || typeof payload.sampleEventId !== 'string') {
    errors.push('sampleEventId is required.');
  }

  const reason = sanitizeString(payload.correctionReason || '', 500);
  if (!reason || reason.length < 15) {
    errors.push('A substantive correction reason (at least 15 characters) is required for statutory audit history.');
  }
  const reasonPii = detectProhibitedPII(reason);
  if (reasonPii) errors.push(`Correction reason: ${reasonPii}`);

  if (!Array.isArray(payload.correctedResults) || payload.correctedResults.length === 0) {
    errors.push('At least one corrected parameter result must be supplied.');
  }

  return errors;
}

/**
 * Validates corrective action record payload
 */
export function validateCorrectiveActionPayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') {
    return ['Corrective action payload must be an object.'];
  }

  if (!payload.waterPointId || typeof payload.waterPointId !== 'string') {
    errors.push('waterPointId is required.');
  }

  if (!payload.actionType || !CORRECTIVE_ACTION_TYPES[payload.actionType]) {
    errors.push(`Action type must be one of: ${Object.keys(CORRECTIVE_ACTION_TYPES).join(', ')}.`);
  }

  const notes = sanitizeString(payload.description || '', 1000);
  if (!notes || notes.length < 15) {
    errors.push('Action description must be at least 15 characters.');
  }
  const notesPii = detectProhibitedPII(notes);
  if (notesPii) errors.push(`Action description: ${notesPii}`);

  if (payload.status && !CORRECTIVE_ACTION_STATUSES[payload.status]) {
    errors.push(`Invalid action status: ${payload.status}.`);
  }

  return errors;
}
