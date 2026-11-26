/**
 * National Civic Document Authenticity Check Guidance Hub
 * 
 * Catalogue of official document verification routes across Indian government services.
 * 
 * Safety & Privacy Principles:
 * 1. Zero Document Ingestion: Never upload, scan, or store full document contents.
 * 2. Allowlisted Verification Routes: Only official, source-reviewed URLs are included.
 * 3. QR Destination Preview: Decoded QR targets are shown; unsafe schemes are blocked.
 * 4. No Authenticity Claim: A valid QR code alone does not prove document authenticity.
 * 5. User-Controlled Data: Document numbers are never sent to third parties without explicit action.
 * 6. Suspicious-Link Reporting: Users can report questionable verification links.
 */

export const DOCUMENT_VERIFICATION_CATALOGUE = {
  // Structure: { id, documentType, issuer, state, officialVerificationURL, qrInstructions, limitations, categories }
  
  AADHAAR_UIDAI: {
    id: 'aadhaar_uidai',
    documentType: 'Aadhaar Card',
    issuer: 'UIDAI (Unique Identification Authority of India)',
    state: 'all',
    officialVerificationURL: 'https://myaadhaar.uidai.gov.in',
    qrInstructions: 'Scan QR code on Aadhaar/e-Aadhaar to verify authenticity on UIDAI portal. The QR code contains encrypted demographic data for validation.',
    limitations: 'QR code verification confirms the QR code decodes to UIDAI-recognised format. It does not verify whether the Aadhaar was legally issued or whether the holder is the rightful owner. Always cross-check with the official UIDAI portal.',
    categories: ['identity_proof'],
    verificationMethod: 'UIDAI myAadhaar portal / mAadhaar app',
  },

  VOTER_ID_ECI: {
    id: 'voter_id_eci',
    documentType: 'Voter ID Card',
    issuer: 'Election Commission of India (ECI)',
    state: 'all',
    officialVerificationURL: 'https://electoralsearch.eci.gov.in',
    qrInstructions: 'Some Voter ID cards include a QR code. Scanning it should redirect to the ECI verification portal. Do not scan QR codes from unverified sources claiming to be ECI.',
    limitations: 'QR code scanning alone does not authenticate the Voter ID. The card must have official ECI watermark, security features, and valid EPIC number. Cross-reference with the electoral roll on the official ECI portal.',
    categories: ['identity_proof'],
    verificationMethod: 'Electoral Search portal / Booth-level officer',
  },

  PAN_INCOME_TAX: {
    id: 'pan_income_tax',
    documentType: 'PAN Card',
    issuer: 'Income Tax Department',
    state: 'all',
    officialVerificationURL: 'https://www.incometax.gov.in',
    qrInstructions: 'PAN QR codes (introduced recently) contain encrypted PAN data. Scanning should only be done through the official Income Tax department app/portal. Unknown QR codes may lead to phishing sites.',
    limitations: 'QR code decoding confirms data format but does not confirm the PAN was issued by the Income Tax Department or is valid/active. Always verify PAN status on the official e-Filing portal.',
    categories: ['identity_proof'],
    verificationMethod: 'Income Tax e-Filing portal',
  },

  DRIVING_LICENSE: {
    id: 'driving_license',
    documentType: 'Driving License',
    issuer: 'Regional Transport Office (RTO)',
    state: 'state_wise',
    officialVerificationURL: 'https://parivahan.gov.in',
    qrInstructions: 'Some smart card driving licenses include a QR code. Scanning should redirect to the state RTO verification page. If the QR code redirects to an unknown domain, do not proceed.',
    limitations: 'QR code verification confirms the code structure but does not validate whether the license is suspended, expired, or fraudulent. Always check the license status on the official Parivahan portal with the license number.',
    categories: ['identity_proof'],
    verificationMethod: 'Parivahan Sewa portal',
  },

  PASSPORT_MINISTRY: {
    id: 'passport_ministry',
    documentType: 'Passport',
    issuer: 'Ministry of External Affairs',
    state: 'all',
    officialVerificationURL: 'https://www.passportindia.gov.in',
    qrInstructions: 'e-Passports include an electronic chip with biometric data. QR codes on service documents should redirect to the official Passport Seva portal. Verify the domain before entering any personal data.',
    limitations: 'QR code scanning does not authenticate the passport booklet. Chip data and biometric validation are separate security layers. Always use the official Passport Seva portal for status checks.',
    categories: ['identity_proof'],
    verificationMethod: 'Passport Seva Online Portal',
  },

  RATION_CARD: {
    id: 'ration_card',
    documentType: 'Ration Card',
    issuer: 'State Food & Civil Supplies Department',
    state: 'state_wise',
    officialVerificationURL: null,  // Varies by state; no central portal
    qrInstructions: 'Some state ration cards include QR codes for beneficiary verification. Scan only through the official state food supplies portal. State URLs vary - consult your state\'s public distribution system website.',
    limitations: 'No central all-India verification portal. QR code destinations vary significantly by state. A valid QR code does not guarantee the ration card is genuine or that the beneficiary is eligible. Always verify through the state-specific PDS portal.',
    categories: ['address_proof'],
    verificationMethod: 'State PDS / Food Supplies portal',
  },

  INCOME_CERTIFICATE: {
    id: 'income_certificate',
    documentType: 'Income Certificate',
    issuer: 'Revenue Authority (Tehsildar/SDM)',
    state: 'state_wise',
    officialVerificationURL: null,  // Varies by state
    qrInstructions: 'Income certificates may have QR codes for verification. Always use the state revenue department\'s official online verification system. Do not use generic QR scanner apps that upload data to unknown servers.',
    limitations: 'Verification URL is state-specific. There is no central income certificate verification service. A QR code alone cannot confirm the certificate\'s validity - it must be cross-checked with the issuing Tehsildar/SDM office.',
    categories: ['income_proof'],
    verificationMethod: 'State Revenue Department portal',
  },

  CASTE_CERTIFICATE: {
    id: 'caste_certificate',
    documentType: 'Caste/Community Certificate',
    issuer: 'District Magistrate / Revenue Authority',
    state: 'state_wise',
    officialVerificationURL: null,  // Varies by state
    qrInstructions: 'Some state-issued caste certificates include QR codes. Verification must be done through the state\'s social welfare department portal. State URLs vary - consult your district magistrate\'s office.',
    limitations: 'Verification URL is state-specific. No central all-India caste certificate verification service exists. A valid QR code does not confirm the certificate was legally issued or is currently valid. Always confirm with the issuing authority.',
    categories: ['caste_community_proof'],
    verificationMethod: 'State Social Welfare Department portal',
  },

  DISABILITY_CERTIFICATE: {
    id: 'disability_certificate',
    documentType: 'Disability Certificate',
    issuer: 'District Medical Board / Civil Surgeon',
    state: 'state_wise',
    officialVerificationURL: null,  // Varies by state
    qrInstructions: 'Disability certificates may include QR codes linking to the UDID portal or state medical verification system. Scan only through official government sources. Unknown QR codes may lead to data harvesting.',
    limitations: 'Verification URL is state-specific. The benchmark disability percentage and UDID number are authoritative - not the QR code. Always verify through the official state medical department or UDID portal.',
    categories: ['disability_medical_proof'],
    verificationMethod: 'State Health/Welfare Department portal',
  },

  LAND_RECORD: {
    id: 'land_record',
    documentType: 'Land Record / Property Document',
    issuer: 'State Revenue Department',
    state: 'state_wise',
    officialVerificationURL: null,  // Varies by state - BhuLekha, Land Records portals
    qrInstructions: 'Some state land records now include QR codes linking to the state\'s land records portal (e.g., BhuLekha, DILRMP). Scan only through the official state revenue department website. Verify the domain matches the expected state portal.',
    limitations: 'Verification is entirely state-specific. No central all-India land record verification service. QR code destination must be confirmed as the official state portal before use. A valid QR code does not confirm clear title or legal ownership.',
    categories: ['land_property_proof'],
    verificationMethod: 'State Land Records / BhuLekha portal',
  },
};

/**
 * State-specific verification URL mappings for documents that vary by state.
 * These are official state portals that have been source-reviewed.
 */
export const STATE_VERIFICATION_PORTALS = {
  // Map of state -> { documentType, portalUrl, portalName }
  maharashtra: {
    documentType: 'ration_card',
    portalUrl: 'https://publicsuppliesmaharashtra.gov.in',
    portalName: 'Maharashtra Public Supplies Department',
  },
  delhi: {
    documentType: 'ration_card',
    portalUrl: 'https://dfc.delhi.gov.in',
    portalName: 'Delhi Food & Civil Supplies Department',
  },
  karnataka: {
    documentType: 'land_record',
    portalUrl: 'https://kavatha.karnataka.gov.in',
    portalName: 'Karnataka Land Records (BhuLekha)',
  },
  tamil_nadu: {
    documentType: 'land_record',
    portalUrl: 'https://eservices.tn.gov.in/landrecords',
    portalName: 'Tamil Nadu Land Records',
  },
  gujarat: {
    documentType: 'ration_card',
    portalUrl: 'https://foodGujarat.gov.in',
    portalName: 'Gujarat Food & Civil Supplies',
  },
  west_bengal: {
    documentType: 'land_record',
    portalUrl: 'https://banglarbhumi.gov.in',
    portalName: 'West Bengal Land Records',
  },
};

/**
 * Get verification catalogue entry by ID
 */
export const getVerificationEntry = (id) => {
  return DOCUMENT_VERIFICATION_CATALOGUE[id];
};

/**
 * Get entries filtered by document type category
 */
export const getEntriesByCategory = (category) => {
  return Object.values(DOCUMENT_VERIFICATION_CATALOGUE).filter(
    (entry) => entry.categories && entry.categories.includes(category)
  );
};

/**
 * Get entries for a specific state
 */
export const getEntriesByState = (state) => {
  return Object.values(DOCUMENT_VERIFICATION_CATALOGUE).filter(
    (entry) => entry.state === state || entry.state === 'all'
  );
};

/**
 * Get state-specific portal info
 */
export const getStatePortal = (stateKey) => {
  return STATE_VERIFICATION_PORTALS[stateKey] || null;
};

/**
 * Safely decode a QR code data URI and validate the scheme.
 * Returns the decoded URL if safe, or null if unsafe.
 * 
 * Safety: Only allows http:// and https:// schemes. Blocks data:, javascript:, mailto:, etc.
 */
export const validateQrDestination = (qrData) => {
  if (!qrData) return null;

  try {
    // Decode any URI component
    const decoded = decodeURIComponent(String(qrData));
    
    // Parse the URL
    const url = new URL(decoded);
    
    // Only allow https: scheme (strict safety)
    if (url.protocol !== 'https:') {
      return {
        safe: false,
        reason: `Unsafe scheme: ${url.protocol}. Only HTTPS connections are allowed for verification.`,
        decodedUrl: decoded,
      };
    }
    
    // Block known malicious domains / lookalikes
    const blockedTlds = ['.xyz', '.top', '.loan', '.club', '.party', '.download', '.stream'];
    const hostname = url.hostname.toLowerCase();
    
    for (const tld of blockedTlds) {
      if (hostname.endsWith(tld)) {
        return {
          safe: false,
          reason: `Blocked top-level domain: ${tld}. This may be a lookalike or untrusted domain.`,
          decodedUrl: decoded,
        };
      }
    }
    
    // Block internal/loopback addresses
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
      return {
        safe: false,
        reason: `Localhost/private IP address detected. Verification must use official public domains.`,
        decodedUrl: decoded,
      };
    }
    
    return {
      safe: true,
      reason: 'Valid HTTPS destination for verification.',
      decodedUrl: decoded,
    };
  } catch (e) {
    return {
      safe: false,
      reason: `Unable to parse QR code data: ${e.message}`,
      decodedUrl: null,
    };
  }
};

/**
 * Check if a verification URL is allowlisted (source-reviewed).
 */
export const isAllowlistedUrl = (url) => {
  if (!url) return false;
  
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    
    // Allowlisted official domains
    const allowlistedDomains = [
      'uidai.gov.in',
      'myaadhaar.uidai.gov.in',
      'appointments.uidai.gov.in',
      'electoralsearch.eci.gov.in',
      'incometax.gov.in',
      'parivahan.gov.in',
      'passportindia.gov.in',
      // State portals
      'publicsuppliesmaharashtra.gov.in',
      'dfc.delhi.gov.in',
      'kavatha.karnataka.gov.in',
      'eservices.tn.gov.in',
      'foodgujarat.gov.in',
      'banglarbhumi.gov.in',
    ];
    
    return allowlistedDomains.some((domain) => hostname.includes(domain));
  } catch {
    return false;
  }
};

/**
 * Extract document type category from a document identifier string.
 * Uses pattern matching similar to the document type guidance service.
 */
export const categorizeDocumentId = (idString) => {
  const lower = (idString || '').toLowerCase();
  
  const categoryPatterns = [
    { category: 'identity_proof', regex: /(aadhaar|uid|voter.?id|e.?pic|pan card|pan|driving.?license|licence)/i },
    { category: 'address_proof', regex: /(ration card|address|residence|electricity.?bill|water.?bill)/i },
    { category: 'income_proof', regex: /(income certificate|salary slip|form 16|itr)/i },
    { category: 'caste_community_proof', regex: /(caste.|tribe.|obc|scheduled.?caste)/i },
    { category: 'disability_medical_proof', regex: /(disability|udid|handicapped)/i },
    { category: 'land_property_proof', regex: /(land record|property|deed|patta|khasra)/i },
  ];
  
  for (const { category, regex } of categoryPatterns) {
    if (regex.test(lower)) {
      return category;
    }
  }
  
  return 'custom_or_ambiguous';
};