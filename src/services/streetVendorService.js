/**
 * streetVendorService.js
 *
 * Implements statutory eviction immunity evaluations, goods seizure reconciliations,
 * vending zone audits, and Section 20 Grievance Redressal Committee petition drafting under:
 * 1. Street Vendors (Protection of Livelihood and Regulation of Street Vending) Act, 2014.
 * 2. Section 3(3) - Absolute statutory ban on eviction prior to TVC survey completion and certificate issuance.
 * 3. Section 18 - Mandatory 30-day notice and alternative site allocation prior to relocation.
 * 4. Section 19 - Seizure and reclaim protocol for goods and perishable inventory.
 * 5. Supreme Court Precedents:
 *    - Maharashtra Ekta Hawkers Union v. Municipal Corporation of Greater Mumbai (2014) 1 SCC 490
 *    - Gainda Ram v. MCD (2010) 10 SCC 715
 */

/**
 * Street Vending Categories recognized under Section 2(m)
 */
export const VENDOR_CATEGORIES = {
  STATIONARY: {
    id: 'STATIONARY',
    label: 'Stationary Street Vendor (Fixed Pitch / Kiosk)',
    description: 'Vendor carrying out street vending on a regular basis at a specific fixed location.',
  },
  MOBILE: {
    id: 'MOBILE',
    label: 'Mobile Vendor (Push Cart / Thela / Cycle)',
    description: 'Vendor carrying out vending from place to place or moving goods on foot or by vehicle.',
  },
  WEEKLY_HAAT: {
    id: 'WEEKLY_HAAT',
    label: 'Weekly Haat / Night Bazaar / Festival Vendor',
    description: 'Vendor operating on designated days, weekly shandy markets, or festive natural markets.',
  },
};

/**
 * Vending Zone Classifications under Section 3
 */
export const VENDING_ZONE_TYPES = {
  RESTRICTION_FREE: {
    id: 'RESTRICTION_FREE',
    label: 'Restriction-Free Vending Zone',
    evictionAllowed: false,
    description: 'Vending permitted without time or space restrictions other than traffic clearance.',
  },
  RESTRICTED: {
    id: 'RESTRICTED',
    label: 'Restricted Vending Zone (Designated Timings)',
    evictionAllowed: false,
    description: 'Vending permitted during specific regulated morning or evening time windows.',
  },
  NO_VENDING: {
    id: 'NO_VENDING',
    label: 'No-Vending Zone (Requires Formal TVC Notification)',
    evictionAllowed: false, // Cannot evict without alternative allocation & notice under Sec 18
    description: 'Designated only after TVC survey and only when alternative vending site has been allocated.',
  },
};

/**
 * Standard Municipal Holding Charges & Perishable Release Benchmarks (Section 19)
 */
export const SEIZURE_BENCHMARKS = {
  PERISHABLE_RELEASE_DAYS: 2, // Must be returned within 2 working days
  MAX_PERISHABLE_FEE_INR: 300,
  MAX_NON_PERISHABLE_FEE_INR: 1000,
  INVENTORY_MEMO_MANDATORY: true,
};

/**
 * Evaluates vendor legal protection under the absolute statutory non-eviction bar of Section 3(3).
 *
 * @param {Object} params
 * @param {boolean} params.tvcSurveyCompleted - Whether Town Vending Committee survey has finished
 * @param {boolean} params.vendingCertificateIssued - Whether vendor has received Form VCoV
 * @param {boolean} params.hasSurveySlipOrReceipt - Whether vendor has survey application slip or municipal fee challan
 * @param {number} params.yearsVendingAtLocation - Number of years operating at current pitch
 * @param {string} params.zoneTypeKey - Key from VENDING_ZONE_TYPES
 * @returns {Object} Section 3(3) immunity assessment
 */
export function evaluateEvictionImmunity({
  tvcSurveyCompleted = false,
  vendingCertificateIssued = false,
  hasSurveySlipOrReceipt = true,
  yearsVendingAtLocation = 5,
  zoneTypeKey = 'RESTRICTION_FREE',
} = {}) {
  const zoneConfig = VENDING_ZONE_TYPES[zoneTypeKey] || VENDING_ZONE_TYPES.RESTRICTION_FREE;

  // Under Section 3(3): "no street vendor shall be evicted or relocated till the survey specified
  // under sub-section (1) has been completed and a certificate of vending has been issued to all street vendors."
  const hasAbsoluteStatutoryImmunity = !tvcSurveyCompleted || (!vendingCertificateIssued && hasSurveySlipOrReceipt);

  let immunityStrength = 'NONE';
  if (hasAbsoluteStatutoryImmunity) {
    if (yearsVendingAtLocation >= 3 || hasSurveySlipOrReceipt) {
      immunityStrength = 'ABSOLUTE';
    } else {
      immunityStrength = 'HIGH';
    }
  } else if (vendingCertificateIssued) {
    immunityStrength = 'CERTIFICATE_PROTECTED';
  }

  const violationsIfEvicted = [];
  if (hasAbsoluteStatutoryImmunity) {
    violationsIfEvicted.push({
      section: 'Section 3(3) Street Vendors Act 2014',
      name: 'Blanket Statutory Bar on Eviction / Relocation',
      detail: 'Eviction before survey completion and certificate distribution is ultra vires and unlawful.',
    });
    violationsIfEvicted.push({
      section: 'Supreme Court Precedent in Maharashtra Ekta Hawkers Union (2014)',
      name: 'Constitutional Right to Livelihood (Article 19(1)(g) & 21)',
      detail: 'No street vendor can be forcibly displaced without due process administered through the TVC.',
    });
  }

  return {
    hasAbsoluteStatutoryImmunity,
    immunityStrength,
    zoneType: zoneConfig.label,
    violationsIfEvicted,
    statutoryAdvice: hasAbsoluteStatutoryImmunity
      ? 'Vendor is fully shielded from summary municipal eviction under Section 3(3). Any eviction attempt is illegal and actionable.'
      : 'Vendor holds certificate of vending; relocation requires mandatory 30-day notice and alternative site under Section 18.',
  };
}

/**
 * Reconciles legality of goods and pushcart confiscation under Section 19.
 *
 * @param {Object} params
 * @param {boolean} params.inventoryMemoIssued - Was itemized seizure memo issued & signed by officer
 * @param {number} params.perishableStockValueInr - Value of perishable goods seized (vegetables, fruits, food)
 * @param {number} params.nonPerishableStockValueInr - Value of non-perishable goods and utensils
 * @param {number} params.cartEquipmentValueInr - Value of confiscated thela / push cart / counter
 * @param {number} params.seizureHoldingDays - Number of days items have been kept in municipal impound
 * @param {number} params.fineDemandedInr - Arbitrary fine / release fee demanded by municipal squad
 * @returns {Object} Confiscation audit and financial restitution claim
 */
export function reconcileGoodsSeizure({
  inventoryMemoIssued = false,
  perishableStockValueInr = 3000,
  nonPerishableStockValueInr = 5000,
  cartEquipmentValueInr = 12000,
  seizureHoldingDays = 3,
  fineDemandedInr = 4500,
} = {}) {
  const perishableVal = Math.max(0, Number(perishableStockValueInr) || 0);
  const nonPerishableVal = Math.max(0, Number(nonPerishableStockValueInr) || 0);
  const cartVal = Math.max(0, Number(cartEquipmentValueInr) || 0);
  const holdingDays = Math.max(0, Number(seizureHoldingDays) || 0);
  const fineDemanded = Math.max(0, Number(fineDemandedInr) || 0);

  const violations = [];

  if (!inventoryMemoIssued) {
    violations.push({
      rule: 'Section 19(1) Mandatory Inventory Memo',
      issue: 'Failure to issue official signed itemized seizure list at time of confiscation.',
    });
  }

  // Under Section 19(2), perishable goods must be returned within 2 working days after payment of holding fees
  let perishableDamagesInr = 0;
  if (holdingDays > SEIZURE_BENCHMARKS.PERISHABLE_RELEASE_DAYS && perishableVal > 0) {
    perishableDamagesInr = perishableVal; // Spoiled / destroyed goods
    violations.push({
      rule: 'Section 19(2) Perishable Goods Return Protocol',
      issue: `Perishables detained for ${holdingDays} days exceeding statutory 2-day limit; stock spoiled.`,
    });
  }

  // Maximum statutory holding fee allowed
  const statutoryMaxFeeInr = SEIZURE_BENCHMARKS.MAX_PERISHABLE_FEE_INR + SEIZURE_BENCHMARKS.MAX_NON_PERISHABLE_FEE_INR;
  const illegalFineOverchargeInr = Math.max(0, fineDemanded - statutoryMaxFeeInr);

  if (illegalFineOverchargeInr > 0) {
    violations.push({
      rule: 'Section 19(3) Holding Fee Regulation',
      issue: `Extortionate release fee of ₹${fineDemanded.toLocaleString('en-IN')} exceeds statutory holding fee cap.`,
    });
  }

  const totalRestitutionClaimInr = perishableDamagesInr + illegalFineOverchargeInr;
  const totalSeizedAssetValueInr = perishableVal + nonPerishableVal + cartVal;
  const isIllegalSeizure = violations.length > 0;

  return {
    isIllegalSeizure,
    violations,
    totalSeizedAssetValueInr,
    perishableDamagesInr,
    illegalFineOverchargeInr,
    totalRestitutionClaimInr,
    statutoryRemedy: isIllegalSeizure
      ? 'Seizure lacks statutory validity under Section 19. Immediate release of cart and refund of illegal fines claimable.'
      : 'Confiscation follows statutory inventory procedures.',
  };
}

/**
 * Audits proposed relocation against Section 18 safeguards.
 *
 * @param {Object} params
 * @param {number} params.noticeDaysGiven - Number of days notice provided
 * @param {boolean} params.alternativeSiteAllocated - Was an alternative viable natural vending site provided
 * @param {boolean} params.tvcConsulted - Was relocation determined through the Town Vending Committee
 * @returns {Object} Section 18 relocation compliance evaluation
 */
export function auditRelocationCompliance({
  noticeDaysGiven = 0,
  alternativeSiteAllocated = false,
  tvcConsulted = false,
} = {}) {
  const violations = [];

  if (noticeDaysGiven < 30) {
    violations.push({
      section: 'Section 18(1) Notice Mandate',
      issue: `Notice served was ${noticeDaysGiven} days (statutory minimum is 30 days written notice).`,
    });
  }

  if (!alternativeSiteAllocated) {
    violations.push({
      section: 'Section 18(1) Alternative Site Requirement',
      issue: 'No designated alternative vending pitch provided before proposed displacement.',
    });
  }

  if (!tvcConsulted) {
    violations.push({
      section: 'Section 18(3) Town Vending Committee Consultation',
      issue: 'Relocation executed unilaterally without TVC recommendation.',
    });
  }

  const isIllegalRelocation = violations.length > 0;

  return {
    isIllegalRelocation,
    violations,
    status: isIllegalRelocation ? 'UNLAWFUL_RELOCATION' : 'PROCEDURALLY_COMPLIANT',
  };
}

/**
 * Generates a formal statutory petition to the Section 20 Grievance Redressal Committee.
 *
 * @param {Object} params
 * @returns {string} Formatted petition text
 */
export function generateSection20GrievancePetition({
  vendorName = 'Vendor Name',
  vendingCategory = 'Stationary Street Vendor',
  vendingPitchLocation = 'Natural Market Pitch, Ward 10',
  yearsActive = 6,
  wardNumber = 'Ward 10',
  zoneName = 'South Zone',
  municipalityName = 'Municipal Corporation',
  contactPhone = 'XXXXXXXXXX',
  goodsSeizureData = null,
  immunityData = null,
  relocationData = null,
  grievanceSummary = 'Arbitrary eviction and seizure of goods without inventory memo in violation of Section 3(3)',
} = {}) {
  const today = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const restitutionClaim = goodsSeizureData?.totalRestitutionClaimInr || 0;
  const assetValue = goodsSeizureData?.totalSeizedAssetValueInr || 0;

  return `FORMAL STATUTORY APPEAL UNDER SECTION 20 OF THE STREET VENDORS (PROTECTION OF LIVELIHOOD AND REGULATION OF STREET VENDING) ACT, 2014

BEFORE THE INDEPENDENT GRIEVANCE REDRESSAL COMMITTEE, ${municipalityName.toUpperCase()}
(Presided over by a retired District Judge under Section 20)
AND THE CHAIRPERSON, TOWN VENDING COMMITTEE (TVC)

APPLICANT / AGGRIEVED VENDOR:
Name: ${vendorName}
Vending Category: ${vendingCategory}
Operational Pitch Location: ${vendingPitchLocation}
Duration of Continuous Vending: ${yearsActive} Years
Ward / Municipal Zone: ${wardNumber}, ${zoneName}
Contact Telephone: ${contactPhone}

RESPONDENTS:
1. The Chairperson & Members, Town Vending Committee (TVC), ${municipalityName}
2. The Municipal Commissioner / Assistant Commissioner (Encroachment Removal Squad),
   ${municipalityName}, ${zoneName}

SUBJECT: URGENT STATUTORY APPEAL UNDER SECTION 20 AGAINST ILLEGAL EVICTION IN BREACH OF SECTION 3(3) STATUTORY BAR, FOR RESTITUTION OF SEIZED PROPERTY UNDER SECTION 19, AND RESTORATION OF LIVELIHOOD

MOST RESPECTFULLY SHOWETH:

1. STATUTORY STANDING & JURISDICTION:
The Applicant is a micro-entrepreneur and street vendor earning their daily bread under the protection of Article 19(1)(g) and Article 21 of the Constitution of India, and is entitled to the full protective umbrella of the Street Vendors Act, 2014. Under Section 20, this Hon'ble Committee has the statutory power to adjudicate grievances, quash illegal evictions, and award damages.

2. STATEMENT OF GRIEVANCE & FACTS:
(a) The Applicant has been peacefully vending at ${vendingPitchLocation} for over ${yearsActive} years as part of a recognized natural market.
(b) Statement of Grievance: "${grievanceSummary}".
${immunityData?.hasAbsoluteStatutoryImmunity ? `(c) CONTRAVENTION OF SECTION 3(3) (BLANKET STATUTORY BAR):
Under Section 3(3) of the Act and the binding ruling of the Hon'ble Supreme Court in 'Maharashtra Ekta Hawkers Union v. BMC (2014) 1 SCC 490', no street vendor can be evicted or relocated until the statutory survey is completed and certificates of vending are issued. The Respondent's attempt to dislodge the Applicant is void ab initio.` : ''}
${goodsSeizureData?.isIllegalSeizure ? `(d) UNLAWFUL SEIZURE & PROPERTY CONFINEMENT (SECTION 19):
The municipal squad confiscated the Applicant's livelihood assets (valued at INR ${assetValue.toLocaleString('en-IN')}) in flagrant violation of law:
${goodsSeizureData.violations.map((v) => `- ${v.rule}: ${v.issue}`).join('\n')}
- Statutory Restitution & Damages Payable: INR ${restitutionClaim.toLocaleString('en-IN')}.` : ''}
${relocationData?.isIllegalRelocation ? `(e) CONTRAVENTION OF SECTION 18 (RELOCATION SAFEGUARDS):
The Respondents failed to serve 30 days mandatory notice and failed to allocate a designated alternative natural market site.` : ''}

3. PRAYERS:
In light of the statutory contraventions, the Applicant respectfully prays that this Hon'ble Committee may be pleased to:
(i) Grant an immediate ex-parte stay restraining the Respondents from evicting or disturbing the Applicant at ${vendingPitchLocation};
(ii) Direct the immediate release and unconditional restitution of the seized push cart, weighing scales, and utensils;
(iii) Direct the Respondents to pay statutory compensation of INR ${restitutionClaim.toLocaleString('en-IN')} towards spoiled perishable goods and illegal holding penalties;
(iv) Order the immediate inclusion of the Applicant in the ongoing TVC survey and issuance of a Vending Certificate (VCoV) under Section 4;
(v) Award daily subsistence compensation of INR 500 per day for unlawful deprivation of livelihood.

VERIFICATION:
I, ${vendorName}, do hereby verify that the facts stated above are true and correct to the best of my knowledge, and no material facts have been concealed.

Place: ${zoneName}, ${municipalityName}
Date: ${today}

___________________________
Signature / Thumb Impression of Vendor
`;
}
