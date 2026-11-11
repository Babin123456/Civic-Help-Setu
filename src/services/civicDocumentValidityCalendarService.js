/**
 * Civic Document Expiry, Renewal and Revalidation Calendar Service
 *
 * Extends the citizen document vault with structured validity tracking and opt-in reminders:
 *
 * 1. Distinction of Validity Archetypes:
 *    - NON_EXPIRING: Lifetime documents (e.g. Birth Certificates, permanent Caste Certificates).
 *    - PERIODIC_RENEWAL: Fixed-term validity (e.g. Passports, Driving Licences, Vehicle Pollution).
 *    - ANNUAL_REVALIDATION: Financial year renewal (e.g. Income Certificates, Non-Creamy Layer).
 *    - TEMPORARY_OR_CONDITIONAL: Conditional validity (e.g. Temporary Disability or Rent Agreements).
 * 2. State-Dependent Rule Localization:
 *    - Does NOT generalize rules nationally where states have independent statutory tenures.
 *    - Cites official government sources and verification dates for validity rules.
 * 3. Consent-Driven Opt-in Reminders:
 *    - Strictly requires user consent for reminders.
 *    - Allows citizens to configure, edit, disable, and delete notifications.
 * 4. Strict Content Exclusion in Notifications & Exports:
 *    - Notifications and exports NEVER contain document file contents, scans, or sensitive identity tokens.
 */

export const VALIDITY_TYPE = {
  NON_EXPIRING: 'NON_EXPIRING',
  PERIODIC_RENEWAL: 'PERIODIC_RENEWAL',
  ANNUAL_REVALIDATION: 'ANNUAL_REVALIDATION',
  TEMPORARY_OR_CONDITIONAL: 'TEMPORARY_OR_CONDITIONAL',
};

export const VALIDITY_STATUS = {
  VALID: 'VALID',
  EXPIRING_SOON: 'EXPIRING_SOON',
  EXPIRED: 'EXPIRED',
  PERMANENT_VALID: 'PERMANENT_VALID',
  UNKNOWN: 'UNKNOWN',
};

/**
 * Curated state and central statutory validity rules with provenance.
 */
export const DOCUMENT_VALIDITY_CATALOGUE = {
  TAMIL_NADU: {
    INCOME_CERTIFICATE: {
      docName: 'Income Certificate',
      validityType: VALIDITY_TYPE.ANNUAL_REVALIDATION,
      standardTenureMonths: 12,
      officialSource: 'Revenue Administration Dept, Govt of Tamil Nadu (G.O. Ms No. 370)',
      sourceUrl: 'https://cms.tn.gov.in/revenue',
      lastVerifiedDate: '2026-01-10',
    },
    COMMUNITY_CERTIFICATE: {
      docName: 'Community / Caste Certificate',
      validityType: VALIDITY_TYPE.NON_EXPIRING,
      officialSource: 'Adi Dravidar and Tribal Welfare Dept, Tamil Nadu',
      sourceUrl: 'https://tn.gov.in/adtw',
      lastVerifiedDate: '2026-01-15',
    },
  },
  MAHARASHTRA: {
    INCOME_CERTIFICATE: {
      docName: 'Income Certificate',
      validityType: VALIDITY_TYPE.ANNUAL_REVALIDATION,
      standardTenureMonths: 36, // Maharashtra issues 1-year or 3-year certificates
      officialSource: 'Revenue and Forest Department, Maharashtra (RTS Manual)',
      sourceUrl: 'https://aaplesarkar.mahaonline.gov.in',
      lastVerifiedDate: '2026-02-01',
    },
    DOMICILE_CERTIFICATE: {
      docName: 'Domicile / Residence Certificate',
      validityType: VALIDITY_TYPE.NON_EXPIRING,
      officialSource: 'Maharashtra Right to Public Services Commission',
      sourceUrl: 'https://aaplesarkar.mahaonline.gov.in',
      lastVerifiedDate: '2026-02-01',
    },
  },
  CENTRAL: {
    PASSPORT_ADULT: {
      docName: 'Indian Passport (Adult)',
      validityType: VALIDITY_TYPE.PERIODIC_RENEWAL,
      standardTenureMonths: 120, // 10 years
      officialSource: 'Passport Seva, Ministry of External Affairs',
      sourceUrl: 'https://passportindia.gov.in',
      lastVerifiedDate: '2026-01-05',
    },
    PUC_CERTIFICATE: {
      docName: 'Pollution Under Control (PUC) Certificate',
      validityType: VALIDITY_TYPE.PERIODIC_RENEWAL,
      standardTenureMonths: 6, // 6 months standard, 12 months for BS-VI
      officialSource: 'Parivahan Sewa, Ministry of Road Transport and Highways',
      sourceUrl: 'https://parivahan.gov.in',
      lastVerifiedDate: '2026-01-20',
    },
  },
};

/**
 * In-memory validity and reminder store.
 */
class DocumentValidityStore {
  constructor() {
    this.records = new Map();
  }

  reset() {
    this.records.clear();
  }

  create(record, userId) {
    if (!userId) throw new Error('Authenticated userId is required');
    if (!record.documentTitle) throw new Error('Valid documentTitle is required');

    const id = record.id || `val_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const evaluated = evaluateDocumentValidity(record);

    const docRecord = {
      id,
      userId,
      documentTitle: record.documentTitle.trim(),
      category: record.category || 'General Document',
      stateKey: record.stateKey || 'CENTRAL',
      validityType: evaluated.validityType,
      issueDate: record.issueDate ? new Date(record.issueDate).toISOString().slice(0, 10) : null,
      expiryDate: evaluated.expiryDate,
      validityStatus: evaluated.status,
      daysRemaining: evaluated.daysRemaining,
      remindersEnabled: Boolean(record.remindersEnabled),
      reminderPreferences: {
        optInInApp: Boolean(record.reminderPreferences?.optInInApp ?? true),
        optInEmail: Boolean(record.reminderPreferences?.optInEmail ?? false),
        advanceDays: record.reminderPreferences?.advanceDays || [30, 15, 7],
      },
      renewalGuidanceUrl: evaluated.renewalGuidanceUrl,
      officialSource: evaluated.officialSource,
      lastVerifiedDate: evaluated.lastVerifiedDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.records.set(id, docRecord);
    return docRecord;
  }

  get(id, userId) {
    const r = this.records.get(id);
    if (!r) return null;
    if (r.userId !== userId) throw new Error('Access Denied');
    return r;
  }

  update(id, updates = {}, userId) {
    const existing = this.get(id, userId);
    if (!existing) throw new Error('Record not found');

    const updated = {
      ...existing,
      ...updates,
      id: existing.id,
      userId: existing.userId,
      updatedAt: new Date().toISOString(),
    };

    this.records.set(id, updated);
    return updated;
  }

  disableReminder(id, userId) {
    const existing = this.get(id, userId);
    existing.remindersEnabled = false;
    existing.updatedAt = new Date().toISOString();
    this.records.set(id, existing);
    return existing;
  }

  delete(id, userId) {
    const existing = this.get(id, userId);
    this.records.delete(id);
    return true;
  }

  listByUser(userId) {
    const results = [];
    for (const r of this.records.values()) {
      if (r.userId === userId) {
        results.push(r);
      }
    }
    return results;
  }
}

export const documentValidityStore = new DocumentValidityStore();

/**
 * Evaluates document validity status based on issue date, expiry date, or state rules.
 *
 * @param {Object} input
 * @returns {Object} Evaluation summary
 */
export function evaluateDocumentValidity(input = {}) {
  const { category, stateKey = 'CENTRAL', issueDate, expiryDate, manualValidityType } = input;

  const stateCatalog = DOCUMENT_VALIDITY_CATALOGUE[stateKey.toUpperCase()] || DOCUMENT_VALIDITY_CATALOGUE.CENTRAL;
  const rule = category ? stateCatalog[category.toUpperCase()] : null;

  const validityType =
    manualValidityType || (rule ? rule.validityType : VALIDITY_TYPE.PERIODIC_RENEWAL);

  if (validityType === VALIDITY_TYPE.NON_EXPIRING) {
    return {
      validityType,
      status: VALIDITY_STATUS.PERMANENT_VALID,
      expiryDate: null,
      daysRemaining: null,
      officialSource: rule ? rule.officialSource : 'Statutory permanent record',
      lastVerifiedDate: rule ? rule.lastVerifiedDate : '2026-01-01',
      renewalGuidanceUrl: rule ? rule.sourceUrl : null,
    };
  }

  let finalExpiry = expiryDate ? new Date(expiryDate).toISOString().slice(0, 10) : null;

  // Calculate projected expiry from tenure if only issueDate provided
  if (!finalExpiry && issueDate && rule && rule.standardTenureMonths) {
    const dt = new Date(issueDate);
    dt.setMonth(dt.getMonth() + rule.standardTenureMonths);
    finalExpiry = dt.toISOString().slice(0, 10);
  }

  if (!finalExpiry) {
    return {
      validityType,
      status: VALIDITY_STATUS.UNKNOWN,
      expiryDate: null,
      daysRemaining: null,
      officialSource: rule ? rule.officialSource : 'Manual record',
      lastVerifiedDate: rule ? rule.lastVerifiedDate : null,
      renewalGuidanceUrl: rule ? rule.sourceUrl : null,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expDt = new Date(finalExpiry);
  expDt.setHours(0, 0, 0, 0);

  const diffMs = expDt.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  let status = VALIDITY_STATUS.VALID;
  if (daysRemaining < 0) {
    status = VALIDITY_STATUS.EXPIRED;
  } else if (daysRemaining <= 45) {
    status = VALIDITY_STATUS.EXPIRING_SOON;
  }

  return {
    validityType,
    status,
    expiryDate: finalExpiry,
    daysRemaining,
    officialSource: rule ? rule.officialSource : 'User specified',
    lastVerifiedDate: rule ? rule.lastVerifiedDate : null,
    renewalGuidanceUrl: rule ? rule.sourceUrl : null,
  };
}

/**
 * Exports a clean document validity calendar summary strictly omitting document contents.
 *
 * @param {Array<Object>} records
 * @returns {Object} Export payload
 */
export function exportValidityCalendarSummary(records = []) {
  const items = records.map((r) => ({
    documentTitle: r.documentTitle,
    validityType: r.validityType,
    validityStatus: r.validityStatus,
    expiryDate: r.expiryDate || 'N/A (Lifetime)',
    daysRemaining: r.daysRemaining !== null ? r.daysRemaining : 'Permanent',
    officialSource: r.officialSource || 'N/A',
    renewalLink: r.renewalGuidanceUrl || 'N/A',
  }));

  return {
    exportedAt: new Date().toISOString(),
    totalTrackedDocuments: items.length,
    disclaimer:
      'This document validity calendar tracks statutory renewal schedules. No document contents or ' +
      'identity credentials are saved in this export.',
    schedule: items,
  };
}
