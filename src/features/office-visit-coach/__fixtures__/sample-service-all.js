/**
 * Synthetic fixtures for Multi-Agent Office Visit Preparation and Follow-Up Coach tests.
 * All data is synthetic - no real citizen PII, credentials, or documents.
 * Used for unit, integration and E2E test suites.
 */

// Combined service fixture for comprehensive tests
export const SAMPLE_COMPREHENSIVE_SERVICE = {
  name: 'Multi-Service Civic Visit',
  category: 'General Civic',
  department: 'Multiple Departments',
  fees: '₹300 - ₹800 (varies by service)',
  processingTime: '15 - 45 days',
  documents: [
    'Valid Identity Proof (Aadhaar / Voter ID / Passport)',
    'Valid Proof of Address (Utility Bill / Domicile Certificate)',
    'Passport-size photographs with plain white background (x3)',
    'Self-declaration affidavit (if applicable)',
    'Valid Driving License (if applicable)',
  ],
  steps: [
    { title: 'Token Collection', description: 'Present yourself at reception token kiosk 15 minutes before slot.' },
    { title: 'Document Verification', description: 'Submit original documents and 2 self-attested photocopy sets at counter.' },
    { title: 'Biometrics & Fee Payment', description: 'Provide biometric capture and pay statutory treasury fees.' },
    { title: 'Acknowledgment Slip', description: 'Collect physical receipt with application reference ID.' },
  ],
  officialSources: [
    { name: 'National Government Services Portal', url: 'https://services.india.gov.in', verified: true },
  ],
  lastVerified: '2026-11-20',
};

// Service with ambiguous requirements (tests uncertainty preservation)
export const SERVICE_WITH_AMBIGUOUS_REQS = {
  name: 'Service with Conditional Requirements',
  category: 'General Civic',
  department: 'Various Departments',
  fees: 'To be confirmed',
  processingTime: 'To be confirmed',
  documents: [
    'Document that may be required (may vary by region)',
    'Document that is optional but recommended',
    'Document required if applying for specific category',
    'Document? (questionable requirement)',
  ],
  steps: [
    { title: 'Step 1', description: 'First step of the process.' },
    { title: 'Step 2', description: 'Second step, conditional on prior outcomes.' },
  ],
  officialSources: [],
  lastVerified: '2026-01-01', // Stale data test
};

// Service with only optional documents
export const SERVICE_WITH_ONLY_OPTIONAL = {
  name: 'Service with Optional Documents',
  category: 'General Civic',
  department: 'Optional Services Department',
  fees: '₹0 (no mandatory fees)',
  processingTime: 'No processing time',
  documents: [
    'Optional supporting document 1',
    'Optional supporting document 2 (recommended but not mandatory)',
  ],
  steps: [],
  officialSources: [],
  lastVerified: '2026-11-24',
};

// Service missing some fields (tests graceful handling)
export const SERVICE_MINIMAL = {
  name: 'Minimal Service',
  category: 'General',
  department: 'Minimal Dept',
  // fees, processingTime, documents, steps, officialSources all optional
};

export {
  SAMPLE_RTO_SERVICE,
  SAMPLE_TEHSILDAR_SERVICE,
  SAMPLE_PSK_SERVICE,
  SAMPLE_CSC_AADHAAR_SERVICE,
  SAMPLE_MUNICIPAL_SERVICE,
} from './sample-service-rto.js';
