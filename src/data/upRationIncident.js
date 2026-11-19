// UP Ration Incident Record Schema
// Records citizen-reported facts from a failed fair-price shop transaction
// Strictly prohibits collection of Aadhaar, OTP, biometric, or any PII

export const INCIDENT_STORAGE_KEY = 'up_ration_incidents_v1';

// Incident reason codes mapped to UP PDS/common causes
export const INCIDENT_REASON_CODES = {
  ePOS_FAILURE: 'e-PoS machine failure or connectivity issue',
  AUTH_MISMATCH: 'Aadhaar / biometric authentication mismatch',
  STOCK_OUT: 'Commodity stock not available at fair-price shop',
  PORTABILITY_REJECTED: 'One Nation One Ration Card (ONORC) portability rejected',
  QUANTITY_DISCREPANCY: 'Shown quantity vs received quantity mismatch',
  RATION_CARD_ISSUE: 'Ration card not accepted or invalid',
  SHOP_CLOSED: 'Fair-price shop closed on declared day',
  OTHER: 'Other / unspecified reason',
};

// Incident form fields schema
export const INCIDENT_FORM_FIELDS = [
  { name: 'district', label: 'District', type: 'select', required: true, options: [] }, // populated from UP_DISTRICTS
  { name: 'blockOrWard', label: 'Block / Urban Ward', type: 'text', required: false },
  { name: 'shopId', label: 'Fair-Price Shop ID (Optional)', type: 'text', required: false },
  { name: 'shopName', label: 'Shop Name (Optional)', type: 'text', required: false },
  { name: 'rationMonth', label: 'Ration Month (YYYY-MM)', type: 'text', required: true, pattern: '^\\d{4}-\\d{2}$' },
  { name: 'commodity', label: 'Commodity', type: 'select', required: true, options: ['Rice', 'Wheat', 'Coarse Grains', 'Sugar', 'Kerosene', 'Other'] },
  { name: 'quantityShowed', label: 'Quantity Shown (kg)', type: 'number', required: true, min: 0 },
  { name: 'quantityReceived', label: 'Quantity Received (kg)', type: 'number', required: true, min: 0 },
  { name: 'reason', label: 'Reason Communicated', type: 'select', required: true, options: Object.keys(INCIDENT_REASON_CODES) },
  { name: 'additionalDetails', label: 'Additional Details', type: 'textarea', required: false },
];

// Default incident record structure
export const createDefaultIncident = (overrides = {}) => {
  const base = {
    id: `incident-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    district: '',
    blockOrWard: '',
    shopId: '',
    shopName: '',
    rationMonth: new Date().toISOString().slice(0, 7).split('T')[0], // YYYY-MM format
    commodity: 'Rice',
    quantityShowed: 0,
    quantityReceived: 0,
    reason: 'ePOS_FAILURE',
    additionalDetails: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // Derived / routing fields
    districtNormalized: '',
    grievanceChannel: null, // populated based on district
    // Audit metadata (no PII)
    auditMetadata: {
      sourceUrl: 'https://fcs.up.gov.in',
      effectiveDate: new Date().toISOString().split('T')[0],
      lastVerified: new Date().toISOString().split('T')[0],
      verifiedBy: 'Citizen-reported incident record',
    },
    // Duplicate detection
    isDuplicateOf: null, // reference to original incident ID if duplicate
  };
  // Apply overrides on top of base
  return { ...base, ...overrides }
};

// Validation: ensures no forbidden PII fields are present
export const validateIncidentNoPII = (incident) => {
  const forbiddenFields = [
    'aadhaar',
    'aadhaarNumber',
    'rationCardNumber',
    'rcNumber',
    'otp',
    'fingerprint',
    'faceData',
    'biometric',
    'userId',
    'email_personal',
    'phone_personal',
    'password',
    'token',
  ];

  const errors = [];

  const scan = (node, path) => {
    if (Array.isArray(node)) {
      node.forEach((item, index) => scan(item, `${path}[${index}]`));
      return;
    }
    if (node === null || typeof node !== 'object') return;

    Object.entries(node).forEach(([k, v]) => {
      const next = path ? `${path}.${k}` : k;
      if (forbiddenFields.includes(k)) {
        errors.push(`${next}: field is forbidden - no Aadhaar, OTP, biometric, or PII collected.`);
      }
      scan(v, next);
    });
  };

  scan(incident, '');
  return errors;
};

// Generate a district-specific grievance channel referral based on the incident
export const getGrievanceChannelForDistrict = (district) => {
  const baseChannels = [
    {
      name: 'UP Food & Civil Supplies Grievance Portal',
      url: 'https://fcs.up.gov.in',
      helpline: '1967',
      description: 'Official portal for ration-related grievances in Uttar Pradesh',
    },
    {
      name: 'State Helpline 1967',
      url: null,
      helpline: '1967',
      description: 'Toll-free helpline for public grievances including PDS/ration issues',
    },
  ];

  // District-specific additions or variations
  const districtSpecific = {
    Lucknow: {
      dsoContact: 'District Supply Officer, Collectorate Lucknow',
    },
    Kanpur: {
      dsoContact: 'District Supply Officer, Collectorate Kanpur',
    },
    Varanasi: {
      dsoContact: 'District Supply Officer, Collectorate Varanasi',
    },
    // Add more as needed
  };

  const spec = districtSpecific[district] || {};
  return {
    ...baseChannels,
    ...spec,
    district,
  };
};

// Stale source detection for UP-specific channels
export const checkUpSourceStaleness = (channels) => {
  const now = new Date();
  return channels.map((channel) => {
    const lastVerified = new Date(channel.lastVerified);
    const daysSinceVerified = Math.floor(
      (now.getTime() - lastVerified.getTime()) / (1000 * 60 * 60 * 24)
    );
    return {
      ...channel,
      stale: daysSinceVerified > 180,
      daysSinceVerified,
    };
  });
};

// Export incident as printable receipt text
export const exportIncidentAsReceipt = (incident) => {
  const validated = validateIncidentNoPII(incident);
  if (validated.length > 0) {
    return { error: 'Cannot generate receipt: incident contains forbidden fields', errors: validated };
  }

  const ch = getGrievanceChannelForDistrict(incident.district);
  
  const lines = [
    '============================================================',
    '   UP RATION INCIDENT RECEIPT',
    '============================================================',
    '',
    'Incident Reference ID: ' + incident.id,
    'Date Created: ' + new Date(incident.createdAt).toLocaleDateString(),
    '',
    'DISTRICT: ' + (incident.district || '[Not specified]'),
    incident.blockOrWard && incident.blockOrWard ? ('BLOCK / WARD: ' + incident.blockOrWard) : '',
    incident.shopId || incident.shopName ? ('SHOP: ' + (incident.shopName || incident.shopId)) : '',
    '',
    'RATION MONTH: ' + incident.rationMonth,
    'COMMODITY: ' + incident.commodity,
    '',
    'QUANTITY SHOWN (kg): ' + incident.quantityShowed,
    'QUANTITY RECEIVED (kg): ' + incident.quantityReceived,
    '',
    'REASON COMMUNICATED: ' + INCIDENT_REASON_CODES[incident.reason] || incident.reason,
    incident.additionalDetails ? ('Additional Details: ' + incident.additionalDetails) : '',
    '',
    '============================================================',
    '   GRIEVANCE REFERRAL INFORMATION',
    '============================================================',
    '',
    'Recommended Grievance Channels:',
    '  1. UP Food & Civil Supplies Grievance Portal: https://fcs.up.gov.in',
    '  2. State Helpline: Dial 1967',
    ch.district && ch.dsoContact ? ('  3. District Supply Officer: ' + ch.dsoContact) : '',
    '',
    'Incident Details Above Are CITIZEN-REPORTED FACTS.',
    'This receipt is a printable record for your grievance.',
    'Civic Help Setu does NOT submit complaints to government portals.',
    '============================================================',
  ];

  return lines.filter(Boolean).join('\n');
};