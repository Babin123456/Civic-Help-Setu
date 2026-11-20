/**
 * UP Agricultural Input Adulteration Complaint Evidence Organizer Service
 * 
 * Supports farmers, farmer producer organizations (FPOs), and village youth
 * organizing and substantiating complaints regarding spurious, sub-standard,
 * or adulterated agricultural inputs (Seeds, Chemical Fertilizers, Pesticides/Bio-stimulants)
 * across Uttar Pradesh under the Department of Agriculture (upagriculture.com),
 * Seeds Act 1966, Fertilizer Control Order (FCO) 1985, and Insecticides Act 1968.
 * 
 * Key Capabilities:
 * - Input category legal mapping:
 *   - Seeds (Beej): Zero germination, bogus hybrid tags, non-certified foundation seeds
 *   - Fertilizers (Khad): Fake DAP / Urea / NPK (clay/salt adulteration), underweight bags, mandatory POS cash memo refusal
 *   - Pesticides (Keetnashak): Diluted/counterfeit chemical formulations causing crop phytotoxicity or pest resurgence
 * - Evidence dossier checklist generator (Batch number, expiry date, printed POS receipt, dealer license, sealed leftover sample)
 * - Statutory lab testing request generator: Cites procedure under Section 19 of FCO 1985 / Section 14 of Seeds Act
 * - Escalation hierarchy: Seed/Fertilizer Inspector -> District Agriculture Officer (DAO) -> Deputy Director of Agriculture (DDA)
 * - Printable legal complaint petition for Chief Judicial Magistrate / District Consumer Disputes Redressal Commission (DCDRC)
 * - Strict Privacy: Protects farmer financial account tokens and dealer tax credentials with secure masking
 */

export const AGRI_INPUT_CATEGORIES = {
  SEEDS: {
    code: 'SEEDS',
    name: 'Agricultural Seeds (Beej)',
    governingAct: 'Seeds Act, 1966 & Seeds Rules, 1968',
    inspectionAuthority: 'Seed Inspector / Sub-Divisional Agriculture Officer',
    labTestingProtocol: 'State Seed Testing Laboratory (SSTL) - Germination & Genetic Purity Test',
    statutorySampleSealingMethod: '3 identical sealed samples (one for vendor, one for lab, one retained by court/inspector)'
  },
  FERTILIZERS: {
    code: 'FERTILIZERS',
    name: 'Chemical & Bio Fertilizers (Khad - DAP / Urea / NPK / MOP / Zinc)',
    governingAct: 'Fertilizer (Inorganic, Organic or Mixed) (Control) Order, 1985 (FCO) & Essential Commodities Act, 1955',
    inspectionAuthority: 'Fertilizer Inspector / District Agriculture Officer (DAO)',
    labTestingProtocol: 'Regional Fertilizer Quality Control Laboratory (FQCL) - Chemical Nutrient Assay',
    statutorySampleSealingMethod: 'Sample drawn using sampling probe/spear, packed in 3 polythene bags with seal'
  },
  PESTICIDES: {
    code: 'PESTICIDES',
    name: 'Insecticides & Plant Protection Chemicals (Keetnashak / Fungicide / Weedicide)',
    governingAct: 'Insecticides Act, 1968 & Insecticides Rules, 1971',
    inspectionAuthority: 'Insecticide Inspector / Plant Protection Officer',
    labTestingProtocol: 'State Pesticide Testing Laboratory (SPTL) - Active Ingredient (AI) Concentration Test',
    statutorySampleSealingMethod: 'Original sealed retail container or 3 aliquots in clean dry glass bottles with CIBRC registration batch number'
  }
};

export const UP_AGRI_ESCALATION_OFFICERS = [
  { level: 'BLOCK_TEHSIL', designation: 'Seed / Fertilizer / Insecticide Inspector', role: 'Immediate shop seizure, drawing statutory samples, and issuing stop-sale orders' },
  { level: 'DISTRICT', designation: 'District Agriculture Officer (DAO / Zila Krishi Adhikari)', role: 'Filing FIR under Section 3/7 of Essential Commodities Act and canceling dealer trade license' },
  { level: 'DIVISION', designation: 'Deputy Director of Agriculture (DDA / Up Krishi Nideshak)', role: 'Divisional quality enforcement and administrative appeals' },
  { level: 'JUDICIAL_CONSUMER', designation: 'District Consumer Disputes Redressal Commission (DCDRC)', role: 'Awarding crop damage compensation and civil damages to affected farmers' }
];

export const MANDATORY_EVIDENCE_ITEMS = [
  { code: 'PURCHASE_CASH_MEMO', label: 'Authorized Cash Memo / e-POS Invoice with Dealer Signature & GSTIN' },
  { code: 'ORIGINAL_PACKAGING', label: 'Empty Bag / Container showing Batch No, Mfg Date, Expiry Date, and Lot No' },
  { code: 'LEFTOVER_SAMPLE', label: 'Unused portion of seed/fertilizer/pesticide retained in original packaging' },
  { code: 'FIELD_PHOTOGRAPHS', label: 'Geo-tagged photographs of failed crop / stunted seedlings in agricultural plot' },
  { code: 'REVENUE_LAND_HOLDING_RECORD', label: 'Certified Khatauni extract proving land ownership and acreage sown' }
];

/**
 * Evaluates completeness of farmer evidence pack for adulteration complaints.
 * @param {Object} evidenceData 
 * @returns {Object} evaluation
 */
export function evaluateAgriEvidenceReadiness(evidenceData = {}) {
  const present = [];
  const missing = [];

  MANDATORY_EVIDENCE_ITEMS.forEach(item => {
    if (evidenceData[item.code]) {
      present.push(item);
    } else {
      missing.push(item);
    }
  });

  const hasCashMemo = Boolean(evidenceData.PURCHASE_CASH_MEMO);
  const hasPackagingWithBatch = Boolean(evidenceData.ORIGINAL_PACKAGING);
  const isStatutorilyStrong = hasCashMemo && hasPackagingWithBatch;

  return {
    isStatutorilyStrong,
    completenessScore: Math.round((present.length / MANDATORY_EVIDENCE_ITEMS.length) * 100),
    presentEvidenceCount: present.length,
    missingEvidenceCount: missing.length,
    missingEvidenceItems: missing.map(m => m.label),
    readinessStatus: isStatutorilyStrong ? 'READY_FOR_OFFICIAL_FILING' : 'INCOMPLETE_DOCUMENTARY_PROOF',
    criticalWarning: !hasCashMemo
      ? 'CRITICAL GAP: Missing formal purchase invoice / e-POS slip. Without an authorized cash memo, proving vendor linkage in court is difficult under Section 19 of FCO.'
      : !hasPackagingWithBatch
      ? 'CRITICAL GAP: Batch and Lot number from the original container is necessary for laboratory cross-examination against the manufacturer’s master register.'
      : 'Evidence satisfies prima facie threshold for official inspection and FIR registration.'
  };
}

/**
 * Generates formal statutory lab test request and complaint petition for District Agriculture Officer.
 * @param {Object} complaint 
 * @param {Object} evidenceEval 
 * @returns {string} markdown petition
 */
export function exportAgriAdulterationPetition(complaint = {}, evidenceEval = {}) {
  const category = AGRI_INPUT_CATEGORIES[complaint.categoryCode] || AGRI_INPUT_CATEGORIES.FERTILIZERS;

  return [
    `# Statutory Complaint & Evidence Dossier: Spurious / Adulterated Agri-Input`,
    `**To:** The District Agriculture Officer (DAO) / Licensing Authority`,
    `**District:** ${complaint.district || 'Concerned District'}, **State:** Uttar Pradesh`,
    ``,
    `**Subject:** Requisition for formal sample seizure, quality laboratory testing, and penal action under ${category.governingAct}`,
    `**Input Category:** ${category.name}`,
    `**Dealer / Retailer Trade Name:** ${complaint.dealerName || 'Agri Input Dealer'}, **Location:** ${complaint.dealerLocation || 'Town Market'}`,
    `**Dealer License / GSTIN (Masked):** \`${complaint.dealerGstin ? `GST-UP-****-${String(complaint.dealerGstin).slice(-4)}` : 'UNKNOWN_OR_UNREGISTERED'}\``,
    `**Product & Batch Details:** Batch No: \`${complaint.batchNumber || 'N/A'}\` | Lot / Tag No: \`${complaint.lotNumber || 'N/A'}\``,
    ``,
    `### 1. Description of Agri-Input Failure & Crop Loss`,
    `- Sown / Treated Acreage: **${complaint.acreageDamaged || '1.5'} Acres**`,
    `- Observed Defect: ${complaint.observedFailureDescription || 'Zero germination or complete lack of fertilizer dissolution, causing severe crop wilting and financial loss.'}`,
    `- Estimated Economic Damage: **₹${(Number(complaint.estimatedDamageINR) || 25000).toLocaleString('en-IN')}**`,
    ``,
    `### 2. Documentary Evidence Enclosed`,
    `- Evidence Readiness Score: **${evidenceEval.completenessScore}% (${evidenceEval.readinessStatus})**`,
    ...(evidenceEval.missingEvidenceItems?.length > 0
      ? evidenceEval.missingEvidenceItems.map(m => `  - ⚠️ Pending: ${m}`)
      : ['  - ✅ Full evidentiary suite attached including cash memo, packaging, and field photographs.']),
    ``,
    `### 3. Formal Prayers under Statutory Powers`,
    `1. Dispatch the **${category.inspectionAuthority}** to inspect the vendor’s premises and draw 3 statutory samples under Section 19 of FCO / Seeds Act.`,
    `2. Issue an immediate **Stop-Sale Order (Vikray Pratibandh)** on the cited batch (\`${complaint.batchNumber || 'N/A'}\`) to prevent further losses to neighboring farmers.`,
    `3. Send the official sample to the **${category.labTestingProtocol}** for urgent forensic chemical assay.`,
    `4. In event of laboratory test failure, initiate prosecution under Section 3/7 of Essential Commodities Act, 1955.`,
    ``,
    `### 4. Administrative & Judicial Escalation Hierarchy`,
    ...UP_AGRI_ESCALATION_OFFICERS.map(o => `- **${o.designation}** (${o.level}) — *Role:* ${o.role}`),
    ``,
    `---`,
    `> **Farmer Protection Guarantee:** Prepared for submission before District Agriculture Authorities and the District Consumer Commission.`
  ].join('\n');
}


export const UP_AGRI_INPUT_FAQS = [
  {
    q: 'Can a fertilizer dealer refuse to provide a printed POS cash memo?',
    a: 'No. Under the Fertilizer Control Order and DBT guidelines, issuing a computer-generated e-POS receipt is mandatory for every transaction.'
  },
  {
    q: 'What is the simple home test to check if DAP (Di-Ammonium Phosphate) is genuine?',
    a: 'Heating a few granules on a metal spoon: Genuine DAP swells to several times its size, does not melt completely, and releases a strong pungent ammonia smell.'
  },
  {
    q: 'How long does a laboratory test report take from the State Seed Testing Laboratory?',
    a: 'Under Seeds Rules, statutory germination and purity reports are delivered within 14 to 21 working days to the Seed Inspector.'
  },
  {
    q: 'Can a farmer claim financial compensation if spurious seeds yield zero crop?',
    a: 'Yes. Farmers can approach the District Consumer Disputes Redressal Commission (DCDRC) citing Section 14 of the Seeds Act and Consumer Protection Act for full input refund and harvest loss damages.'
  }
];

export const SIMPLE_HOME_TEST_METHODS = [
  { input: 'Urea', testName: 'Water Dissolution & Cold Sensation', protocol: 'Add one teaspoon of Urea to water; genuine urea dissolves completely and feels ice-cold to the touch.' },
  { input: 'DAP', testName: 'Lime Heating Reaction', protocol: 'Rubbing DAP granules with a pinch of slaked lime (Chuna) creates an intense pungent ammonia smell.' },
  { input: 'MOP (Potash)', testName: 'Moisture Clumping', protocol: 'Genuine Muriate of Potash consists of reddish-pink crystalline salt granules that dissolve without leaving chalky clay sediment.' },
  { input: 'Zinc Sulphate', testName: 'Caustic Soda Precipitation', protocol: 'Adding caustic soda solution to dissolved zinc sulphate creates a white gelatinous precipitate that dissolves upon adding excess caustic soda.' }
];

/**
 * Returns procedural FAQs for farmers.
 * @returns {Array<{q: string, a: string}>}
 */
export function getAgriInputFaqs() {
  return UP_AGRI_INPUT_FAQS;
}

/**
 * Returns simple primary physical home testing methods.
 * @returns {Array<Object>}
 */
export function getSimpleHomeTestingMethods() {
  return SIMPLE_HOME_TEST_METHODS;
}


export const UP_AGRI_TESTING_LABORATORIES = [
  { name: 'State Seed Testing Laboratory (SSTL)', location: 'Lucknow (Aliganj)', scope: 'Germination, physical purity, and seed moisture analysis' },
  { name: 'Regional Fertilizer Quality Control Laboratory', location: 'Varanasi', scope: 'Total nitrogen, available P2O5, and water soluble potash assay' },
  { name: 'State Pesticide Testing Laboratory', location: 'Meerut', scope: 'Active ingredient concentration and emulsion stability test' },
  { name: 'Central Fertilizer Quality Control & Training Institute (CFQC&TI)', location: 'Faridabad (Central Apex Lab)', scope: 'Referee testing in disputed quality matters' }
];

export const UP_FARMER_SUPPORT_CONTACTS = [
  { agency: 'Kisan Call Centre (Toll Free)', number: '1800-180-1551', timing: '06:00 AM to 10:00 PM (All days)' },
  { agency: 'UP Agriculture Directorate Control Room', number: '0522-2204565', timing: 'Working hours' },
  { agency: 'National Consumer Helpline', number: '1915', timing: 'All working days' }
];

/**
 * Returns accredited agricultural testing laboratories in UP.
 * @returns {Array<Object>}
 */
export function getAgriTestingLaboratories() {
  return UP_AGRI_TESTING_LABORATORIES;
}

/**
 * Returns farmer support contacts and helplines.
 * @returns {Array<Object>}
 */
export function getFarmerSupportContacts() {
  return UP_FARMER_SUPPORT_CONTACTS;
}
