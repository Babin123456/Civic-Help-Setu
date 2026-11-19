/**
 * Public Library & Civic Learning Resource Service (#727).
 * Provides library filtering, cascading jurisdiction handling,
 * freshness evaluation, low-bandwidth text formatting, and checklist preparation.
 *
 * Invariants:
 *  1. No speculative live seat tracking or fake availability.
 *  2. Official statutory instructions kept distinct from editorial summaries.
 *  3. Explicit unavailable/unverified data states for incomplete records.
 */

import { VERIFIED_LIBRARY_FACILITIES } from '../data/libraryFacilities';
import { getVerificationFreshness } from './sourceVerificationService';
import { LIBRARY_TYPE_LABELS, MEMBERSHIP_CATEGORY_LABELS } from '../data/libraryContract';
import { REQUIREMENT_LABELS } from './requirementTypes';

const clean = (val) => (typeof val === 'string' ? val.trim().toLowerCase() : '');

/**
 * Filter libraries by jurisdiction, type, accessibility, digital resources, and query.
 */
export function filterLibraries(libraries = VERIFIED_LIBRARY_FACILITIES, filters = {}) {
  const {
    state = '',
    district = '',
    libraryType = 'all',
    onlyWheelchair = false,
    onlyBraille = false,
    onlyScreenReaders = false,
    onlyDigitalResources = false,
    searchQuery = '',
  } = filters;

  const targetState = clean(state);
  const targetDistrict = clean(district);
  const targetType = clean(libraryType);
  const targetQuery = clean(searchQuery);

  return libraries.filter((library) => {
    if (targetState) {
      const matchState =
        clean(library.state) === targetState ||
        (Array.isArray(library.jurisdiction?.states) &&
          library.jurisdiction.states.some((s) => clean(s) === targetState));
      if (!matchState) return false;
    }

    if (targetDistrict) {
      const matchDistrict =
        clean(library.district) === targetDistrict ||
        (Array.isArray(library.jurisdiction?.districts) &&
          library.jurisdiction.districts.some((d) => clean(d) === targetDistrict));
      if (!matchDistrict) return false;
    }

    if (targetType && targetType !== 'all' && clean(library.libraryType) !== targetType) {
      return false;
    }

    if (onlyWheelchair && library.accessibility?.wheelchairAccessible !== true) {
      return false;
    }

    if (onlyBraille && library.accessibility?.brailleSection !== true) {
      return false;
    }

    if (onlyScreenReaders && library.accessibility?.screenReaderWorkstations !== true) {
      return false;
    }

    if (
      onlyDigitalResources &&
      (!Array.isArray(library.digitalLearningResources) || library.digitalLearningResources.length === 0)
    ) {
      return false;
    }

    if (targetQuery) {
      const matchName = clean(library.name).includes(targetQuery);
      const matchAddress = clean(library.address).includes(targetQuery);
      const matchAuthority = clean(library.managingAuthority).includes(targetQuery);
      const matchDistrict = clean(library.district).includes(targetQuery);
      const matchPincode = clean(library.pincode).includes(targetQuery);
      const matchResources =
        Array.isArray(library.digitalLearningResources) &&
        library.digitalLearningResources.some(
          (r) => clean(r.name).includes(targetQuery) || clean(r.description).includes(targetQuery)
        );

      if (!matchName && !matchAddress && !matchAuthority && !matchDistrict && !matchPincode && !matchResources) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Retrieves a single library record by ID.
 */
export function getLibraryById(id, customList = []) {
  if (!id) return null;
  const matchCustom = customList.find((f) => f.id === id);
  if (matchCustom) return matchCustom;
  return VERIFIED_LIBRARY_FACILITIES.find((f) => f.id === id) || null;
}

/**
 * Evaluates library data freshness status.
 */
export function getLibraryFreshness(library) {
  const lastVerified = library?.auditMetadata?.lastVerified;
  return getVerificationFreshness(lastVerified);
}

/**
 * Formats official library instructions for low-bandwidth plain-text viewing,
 * SMS/WhatsApp sharing, and offline checklists.
 */
export function formatLibraryInstructions(library) {
  if (!library || typeof library !== 'object') {
    return 'Library information unavailable.';
  }

  const sections = [];

  // 1. Header & Authority
  sections.push(`${library.name || 'Public Library'}`);
  const typeLabel = LIBRARY_TYPE_LABELS[library.libraryType] || 'Public Facility';
  sections.push(`Type: ${typeLabel}`);
  sections.push(`Authority: ${library.managingAuthority || 'Municipal/State Library Department'}`);
  sections.push(`Address: ${library.address}, ${library.district}, ${library.state} - ${library.pincode}`);

  // 2. Official Contact & Catalogue Links
  sections.push('\n--- OFFICIAL CONTACT & CATALOGUES ---');
  if (Array.isArray(library.officialContact?.phone) && library.officialContact.phone.length > 0) {
    sections.push(`Phone: ${library.officialContact.phone.join(', ')}`);
  }
  if (library.officialContact?.email) {
    sections.push(`Email: ${library.officialContact.email}`);
  }
  if (library.officialContact?.portalUrl) {
    sections.push(`Official Portal: ${library.officialContact.portalUrl}`);
  }
  if (library.officialContact?.opacCatalogueUrl) {
    sections.push(`OPAC Online Catalogue: ${library.officialContact.opacCatalogueUrl}`);
  }

  // 3. Operating Hours
  sections.push('\n--- OPERATING HOURS ---');
  sections.push(`General Hours: ${library.operatingHours?.hours || 'Not published officially'}`);
  if (library.operatingHours?.readingRoomHours) {
    sections.push(`Reading Room: ${library.operatingHours.readingRoomHours}`);
  }
  if (Array.isArray(library.operatingHours?.closedDays) && library.operatingHours.closedDays.length > 0) {
    sections.push(`Closed on: ${library.operatingHours.closedDays.join(', ')}`);
  }

  // 4. Membership & Statutory Charges
  sections.push('\n--- MEMBERSHIP CATEGORIES & CHARGES ---');
  if (library.statutoryCharges?.isFree) {
    sections.push('Reading Room Access: Free and open to all citizens.');
  }
  if (Array.isArray(library.membershipCategories) && library.membershipCategories.length > 0) {
    library.membershipCategories.forEach((cat) => {
      const catLabel = MEMBERSHIP_CATEGORY_LABELS[cat.category] || cat.category;
      sections.push(
        `• ${catLabel}: Annual Fee ₹${cat.annualFee}, Caution Deposit ₹${cat.cautionDeposit || 0} (${
          cat.isDepositRefundable ? 'Refundable' : 'Non-refundable'
        }), Max Books: ${cat.maxBooksAllowed}, Loan Period: ${cat.loanPeriodDays} days.`
      );
    });
  } else {
    sections.push('Membership charges: Not officially published or verified.');
  }

  // 5. Renewal Rules
  sections.push('\n--- RENEWAL & BORROWING RULES ---');
  if (library.renewalRules) {
    sections.push(
      `Loan Period: ${library.renewalRules.loanPeriodDays} days | Max Renewals: ${library.renewalRules.maxRenewalsAllowed}`
    );
    sections.push(
      `Online Renewal: ${library.renewalRules.onlineRenewalAvailable ? 'Supported via OPAC' : 'In-person circulation counter only'}`
    );
    if (library.renewalRules.conditions) {
      sections.push(`Rules: ${library.renewalRules.conditions}`);
    }
  } else {
    sections.push('Official renewal rules unavailable.');
  }

  // 6. Digital Learning Resources
  if (Array.isArray(library.digitalLearningResources) && library.digitalLearningResources.length > 0) {
    sections.push('\n--- DIGITAL LEARNING RESOURCES ---');
    library.digitalLearningResources.forEach((res) => {
      sections.push(`• ${res.name} (${res.provider})`);
      if (res.url) sections.push(`  URL: ${res.url}`);
      if (res.description) sections.push(`  Note: ${res.description}`);
    });
  }

  // 7. Required Application Documents
  if (Array.isArray(library.requiredDocuments) && library.requiredDocuments.length > 0) {
    sections.push('\n--- APPLICATION REQUIREMENTS & PROOFS ---');
    library.requiredDocuments.forEach((doc) => {
      const reqLabel = REQUIREMENT_LABELS[doc.type] || 'Requirement';
      sections.push(`• [${reqLabel}] ${doc.name}${doc.condition ? ` - (${doc.condition})` : ''}`);
    });
  }

  // 8. Provenance & Verification
  sections.push('\n--- OFFICIAL PROVENANCE ---');
  sections.push(`Source: ${library.auditMetadata?.sourceUrl || 'Municipal Gazette'}`);
  sections.push(`Last Verified: ${library.auditMetadata?.lastVerified || 'Pending verification'}`);
  sections.push(`Verified By: ${library.auditMetadata?.verifiedBy || 'Civic Help Setu Audit Board'}`);
  sections.push('Notice: Live seating counts are strictly prohibited. Visit or call facility directly.');

  return sections.join('\n');
}

/**
 * Builds standard checklist items for library membership application.
 */
export function buildLibraryChecklistItems(library, categoryKey = 'general_adult') {
  if (!library) return [];

  const items = [];

  // Add document requirements
  if (Array.isArray(library.requiredDocuments)) {
    library.requiredDocuments.forEach((doc) => {
      if (doc.type === 'required') {
        items.push(`Original & Photocopy of ${doc.name}`);
      } else if (doc.type === 'conditional') {
        if (categoryKey === 'student' && doc.name.toLowerCase().includes('student')) {
          items.push(`Bona fide Student ID Card / College Bonafide Letter (${doc.condition || 'Student Concession'})`);
        } else {
          items.push(`${doc.name} (If applicable: ${doc.condition || 'Conditional requirement'})`);
        }
      } else {
        items.push(`${doc.name}`);
      }
    });
  }

  // Add category specific statutory fee checklist item
  const selectedCat = Array.isArray(library.membershipCategories)
    ? library.membershipCategories.find((c) => c.category === categoryKey)
    : null;

  if (selectedCat) {
    const totalPayable = (selectedCat.annualFee || 0) + (selectedCat.cautionDeposit || 0);
    if (totalPayable > 0) {
      items.push(
        `Application fee & caution deposit: ₹${totalPayable} (Fee: ₹${selectedCat.annualFee}, Deposit: ₹${selectedCat.cautionDeposit})`
      );
    }
  }

  items.push('Filled and signed Library Membership Application Form');
  items.push('Verification at Circulation Desk during working hours');

  return [...new Set(items)];
}

