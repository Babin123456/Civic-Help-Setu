const createCorrectionSeal = (facilityId, timestamp, namespace, prefix) => {
  const seed = `${facilityId}|${timestamp}|${namespace}`;
  let hash = 0x811c9dc5;

  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  const unsigned = hash >>> 0;
  const p1 = (unsigned & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  const p2 = ((unsigned >>> 16) & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  return `${prefix}-${p1}-${p2}`;
};

export const generateCrematoriumCorrectionSeal = (facilityId, timestamp) =>
  createCorrectionSeal(facilityId, timestamp, 'CIVIC_CREMATORIUM_VERIFICATION', 'CB-CORR');

export const generateCommunityFacilityCorrectionSeal = (facilityId, timestamp) =>
  createCorrectionSeal(facilityId, timestamp, 'CIVIC_COMMUNITY_FACILITY_VERIFICATION', 'CF-CORR');
