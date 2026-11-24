// UP Ration Incident Storage Service
// Handles offline draft saving, recovery, duplicate detection, and storage operations
// Strictly prohibits Aadhaar, OTP, biometric, or any PII storage

import { INCIDENT_STORAGE_KEY, createDefaultIncident, validateIncidentNoPII, exportIncidentAsReceipt } from '../data/upRationIncident';
import { getStorage } from '../services/civicGrievanceDraftingService';
import { checkUpSourceStaleness } from '../data/upRationIncident';

// In-memory draft cache for session continuity
let inMemoryIncidents = [];

/**
 * Retrieve stored ration incidents from localStorage or memory fallback
 */
export const getStoredIncidents = () => {
  const storage = getStorage();
  if (storage) {
    try {
      const raw = storage.getItem(INCIDENT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Validate each incident for PII compliance
        const validIncidents = parsed.filter((inc) => {
          const violations = validateIncidentNoPII(inc);
          return violations.length === 0;
        });
        inMemoryIncidents = validIncidents;
        return validIncidents;
      }
      inMemoryIncidents = [];
      return [];
    } catch (e) {
      console.error('Failed to parse stored incidents, using memory fallback', e);
      inMemoryIncidents = [];
      return [];
    }
  }
  // No localStorage available - return in-memory cache
  return inMemoryIncidents;
};

/**
 * Save a ration incident to storage (localStorage or memory)
 * Never stores Aadhaar, OTP, biometric, or PII
 */
export const saveIncident = (incident) => {
  if (!incident || !incident.id) {
    console.error('Cannot save incident: missing incident ID');
    return false;
  }

  // Validate no PII before saving
  const violations = validateIncidentNoPII(incident);
  if (violations.length > 0) {
    console.error('Cannot save incident: PII violations detected', violations);
    return false;
  }

  // Update updatedAt timestamp
  const updatedIncident = {
    ...incident,
    updatedAt: new Date().toISOString(),
  };

  // Remove any existing incident with same ID (handles edits/updates)
  const current = getStoredIncidents().filter((d) => d.id !== incident.id);
  const updated = [updatedIncident, ...current];

  inMemoryIncidents = updated;

  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(INCIDENT_STORAGE_KEY, JSON.stringify(updated));
      return true;
    } catch (e) {
      console.error('Failed to save incident to localStorage', e);
      // Fall back to memory only
      inMemoryIncidents = updated;
      return true; // still consider it "saved" in memory
    }
  }
  return true;
};

/**
 * Delete a ration incident from storage
 */
export const deleteIncident = (incidentId) => {
  const current = getStoredIncidents().filter((d) => d.id !== incidentId);
  inMemoryIncidents = current;

  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(INCIDENT_STORAGE_KEY, JSON.stringify(current));
      return true;
    } catch (e) {
      inMemoryIncidents = current;
      return true;
    }
  }
  return true;
};

/**
 * Get a specific incident by ID
 */
export const getIncidentById = (incidentId) => {
  return getStoredIncidents().find((d) => d.id === incidentId) || null;
};

/**
 * Duplicate detection: check if incident with same district+month+commodity+reason already exists
 */
export const isDuplicateIncident = (newIncident) => {
  const existing = getStoredIncidents();
  return existing.some((existing) => {
    if (existing.id === newIncident.id) return false; // same instance
    // Check for potential duplicates based on key fields
    const isSameDistrict = existing.district === newIncident.district && existing.district !== '';
    const isSameMonth = existing.rationMonth === newIncident.rationMonth;
    const isSameCommodity = existing.commodity === newIncident.commodity;
    const isSameReason = existing.reason === newIncident.reason;
    const isSameShop = existing.shopId === newIncident.shopId && existing.shopId !== '';

    // If district, month, commodity, and reason all match, it's likely a duplicate
    return isSameDistrict && isSameMonth && isSameCommodity && isSameReason;
  });
};

/**
 * Get incidents filtered by district
 */
export const getIncidentsByDistrict = (district) => {
  return getStoredIncidents().filter((d) => d.district === district);
};

/**
 * Get stale source warning for the grievance channels associated with incidents
 */
export const getStaleSourceWarning = () => {
  // Use the official UP grievance channels from the data file
  const { UP_GRIEVANCE_CHANNELS } = require('../data/upGrievanceChannels');
  return checkUpSourceStaleness(UP_GRIEVANCE_CHANNELS);
};

/**
 * Export all incidents as printable receipts
 */
export const exportAllIncidentsAsReceipts = () => {
  const incidents = getStoredIncidents();
  return incidents.map((inc) => exportIncidentAsReceipt(inc));
};