/**
 * src/data/openContractingSeed.js
 * Grounded seed dataset for Open Contracting Red-Flag Analytics Workspace (#751).
 *
 * Modeled after real Indian municipal & state procurement portals
 * (KPPP Karnataka, GeM, CPWD, MahaTenders).
 *
 * Contains 5 linked procurement dossiers illustrating:
 * - Scenario 1: Healthy multi-bid competitive works tender with standard turnaround & minor variation.
 * - Scenario 2: High-value civil drainage contract with single-bid award anomaly & vendor concentration.
 * - Scenario 3: Road surfacing tender with abbreviated 4-day bidding window.
 * - Scenario 4: Hospital equipment contract with repeated amendments causing 42% cost escalation.
 * - Scenario 5: Streetlight LED retrofit with price outlier award 38% above estimate.
 */

import { SCHEMA_VERSION } from './openContractingContract.js';

export const SEED_VENDORS = [
  {
    id: 'VND-KA-2018-0912',
    name: 'Shree Balaji Infrastructure Pvt Ltd',
    tradeRegistration: '29AAACS1234F1Z5',
    jurisdiction: 'Karnataka / Bengaluru Urban',
    category: 'works',
    isMsme: false,
    incorporationYear: 2018,
    activeContractsCount: 14,
    verifiedStatus: 'active',
  },
  {
    id: 'VND-KA-2021-4410',
    name: 'Cauvery Geo-Tech & Drainage Solutions',
    tradeRegistration: '29BBBCS5678G2Z3',
    jurisdiction: 'Karnataka / Bengaluru Urban',
    category: 'works',
    isMsme: true,
    incorporationYear: 2021,
    activeContractsCount: 8,
    verifiedStatus: 'active',
  },
  {
    id: 'VND-MH-2016-8821',
    name: 'Sahyadri Urban Roadworks LLP',
    tradeRegistration: '27CCCCS9012H3Z1',
    jurisdiction: 'Maharashtra / Pune & Mumbai',
    category: 'works',
    isMsme: false,
    incorporationYear: 2016,
    activeContractsCount: 19,
    verifiedStatus: 'active',
  },
  {
    id: 'VND-DL-2020-3319',
    name: 'Apex Healthcare Diagnostics & Supplies',
    tradeRegistration: '07DDDES3456J4Z8',
    jurisdiction: 'Delhi NCR',
    category: 'goods',
    isMsme: true,
    incorporationYear: 2020,
    activeContractsCount: 6,
    verifiedStatus: 'active',
  },
  {
    id: 'VND-KA-2022-7744',
    name: 'LumenTech Smart Lighting Solutions',
    tradeRegistration: '29EEEES7890K5Z6',
    jurisdiction: 'Karnataka / Bengaluru Urban',
    category: 'goods',
    isMsme: true,
    incorporationYear: 2022,
    activeContractsCount: 4,
    verifiedStatus: 'active',
  },
  {
    id: 'VND-TN-2019-1120',
    name: 'Coromandel Civil Engineering Corp',
    tradeRegistration: '33FFFFS2345L6Z4',
    jurisdiction: 'Tamil Nadu / Chennai',
    category: 'works',
    isMsme: false,
    incorporationYear: 2019,
    activeContractsCount: 11,
    verifiedStatus: 'active',
  },
];

export const SEED_PROCUREMENT_NOTICES = [
  {
    id: 'NOT-2026-BLR-001',
    tenderRefNumber: 'BBMP/EE/SWD/2026/0491',
    title: 'Remodeling of Secondary Stormwater Drain and RCC Culvert in Mahadevapura Ward 84',
    issuingAuthority: 'Bruhat Bengaluru Mahanagara Palike (BBMP)',
    jurisdiction: 'Bengaluru Urban, Karnataka',
    category: 'works',
    procurementMethod: 'open_competitive',
    estimatedValue: 6500000,
    currency: 'INR',
    publicationDate: '2026-01-10T10:00:00Z',
    submissionDeadline: '2026-02-05T17:00:00Z', // 26 days window (healthy)
    bidsOpeningDate: '2026-02-06T11:00:00Z',
    stage: 'completed',
    sourceUrl: 'https://kppp.karnataka.gov.in/portal/tender/BBMP-2026-0491',
    sourceDocumentHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    createdAt: '2026-01-10T10:00:00Z',
  },
  {
    id: 'NOT-2026-BLR-002',
    tenderRefNumber: 'BBMP/EE/RRR/2026/1102',
    title: 'Desilting and Deepening of Bellandur Inflow Channels and Silt Trap Construction',
    issuingAuthority: 'Bruhat Bengaluru Mahanagara Palike (BBMP)',
    jurisdiction: 'Bengaluru Urban, Karnataka',
    category: 'works',
    procurementMethod: 'open_competitive',
    estimatedValue: 12500000,
    currency: 'INR',
    publicationDate: '2026-01-15T09:30:00Z',
    submissionDeadline: '2026-02-12T17:00:00Z', // 28 days
    bidsOpeningDate: '2026-02-13T11:00:00Z',
    stage: 'contract',
    sourceUrl: 'https://kppp.karnataka.gov.in/portal/tender/BBMP-2026-1102',
    sourceDocumentHash: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
    createdAt: '2026-01-15T09:30:00Z',
  },
  {
    id: 'NOT-2026-PUN-003',
    tenderRefNumber: 'PMC/RHO/2026/304',
    title: 'Asphalt Concrete Overlay and Junction Safety Tabletop Resurfacing - Baner Road',
    issuingAuthority: 'Pune Municipal Corporation (PMC)',
    jurisdiction: 'Pune, Maharashtra',
    category: 'works',
    procurementMethod: 'open_competitive',
    estimatedValue: 8200000,
    currency: 'INR',
    publicationDate: '2026-02-01T11:00:00Z',
    submissionDeadline: '2026-02-05T15:00:00Z', // 4 days (abnormally short!)
    bidsOpeningDate: '2026-02-06T10:00:00Z',
    stage: 'award',
    sourceUrl: 'https://mahatenders.gov.in/portal/tender/PMC-2026-304',
    sourceDocumentHash: '9f8e7d6c5b4a3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b',
    createdAt: '2026-02-01T11:00:00Z',
  },
  {
    id: 'NOT-2026-DEL-004',
    tenderRefNumber: 'DGHS/MED/2026/719',
    title: 'Procurement of High-Capacity Automated Biochemistry Analyzers for Sub-Divisional Hospitals',
    issuingAuthority: 'Directorate General of Health Services (DGHS Delhi)',
    jurisdiction: 'Delhi NCR',
    category: 'goods',
    procurementMethod: 'open_competitive',
    estimatedValue: 18000000,
    currency: 'INR',
    publicationDate: '2025-11-10T10:00:00Z',
    submissionDeadline: '2025-12-10T17:00:00Z',
    bidsOpeningDate: '2025-12-11T11:00:00Z',
    stage: 'amendment',
    sourceUrl: 'https://gem.gov.in/tenders/GEM-2025-B-9921',
    sourceDocumentHash: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
    createdAt: '2025-11-10T10:00:00Z',
  },
  {
    id: 'NOT-2026-BLR-005',
    tenderRefNumber: 'BESCOM/DSM/2026/884',
    title: 'Supply and Installation of 70W Energy Efficient Smart LED Streetlights in Outer Ring Wards',
    issuingAuthority: 'Bangalore Electricity Supply Company (BESCOM)',
    jurisdiction: 'Bengaluru Urban, Karnataka',
    category: 'goods',
    procurementMethod: 'open_competitive',
    estimatedValue: 9500000,
    currency: 'INR',
    publicationDate: '2026-01-20T09:00:00Z',
    submissionDeadline: '2026-02-18T17:00:00Z',
    bidsOpeningDate: '2026-02-19T11:00:00Z',
    stage: 'award',
    sourceUrl: 'https://kppp.karnataka.gov.in/portal/tender/BESCOM-2026-884',
    sourceDocumentHash: '3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d',
    createdAt: '2026-01-20T09:00:00Z',
  },
];

export const SEED_BID_SUBMISSIONS = [
  // NOT-2026-BLR-001 (Healthy 3 bids)
  {
    id: 'BID-001-A',
    noticeId: 'NOT-2026-BLR-001',
    vendorId: 'VND-KA-2021-4410',
    bidAmount: 6350000,
    submittedAt: '2026-02-03T14:30:00Z',
    isTechnicallyQualified: true,
    rank: 1,
  },
  {
    id: 'BID-001-B',
    noticeId: 'NOT-2026-BLR-001',
    vendorId: 'VND-KA-2018-0912',
    bidAmount: 6480000,
    submittedAt: '2026-02-04T10:15:00Z',
    isTechnicallyQualified: true,
    rank: 2,
  },
  {
    id: 'BID-001-C',
    noticeId: 'NOT-2026-BLR-001',
    vendorId: 'VND-TN-2019-1120',
    bidAmount: 6600000,
    submittedAt: '2026-02-05T11:00:00Z',
    isTechnicallyQualified: true,
    rank: 3,
  },

  // NOT-2026-BLR-002 (Single-bid anomaly on open competitive!)
  {
    id: 'BID-002-A',
    noticeId: 'NOT-2026-BLR-002',
    vendorId: 'VND-KA-2018-0912',
    bidAmount: 12450000,
    submittedAt: '2026-02-11T16:00:00Z',
    isTechnicallyQualified: true,
    rank: 1,
  },

  // NOT-2026-PUN-003 (2 bids, rushed turnaround)
  {
    id: 'BID-003-A',
    noticeId: 'NOT-2026-PUN-003',
    vendorId: 'VND-MH-2016-8821',
    bidAmount: 8150000,
    submittedAt: '2026-02-05T12:00:00Z',
    isTechnicallyQualified: true,
    rank: 1,
  },
  {
    id: 'BID-003-B',
    noticeId: 'NOT-2026-PUN-003',
    vendorId: 'VND-TN-2019-1120',
    bidAmount: 8300000,
    submittedAt: '2026-02-05T14:45:00Z',
    isTechnicallyQualified: false,
    disqualificationReason: 'Incomplete experience certificate for hot-mix asphalt plant within 40km radius.',
    rank: 2,
  },

  // NOT-2026-DEL-004 (2 bids)
  {
    id: 'BID-004-A',
    noticeId: 'NOT-2026-DEL-004',
    vendorId: 'VND-DL-2020-3319',
    bidAmount: 17500000,
    submittedAt: '2025-12-08T15:20:00Z',
    isTechnicallyQualified: true,
    rank: 1,
  },
  {
    id: 'BID-004-B',
    noticeId: 'NOT-2026-DEL-004',
    vendorId: 'VND-TN-2019-1120',
    bidAmount: 18200000,
    submittedAt: '2025-12-09T11:10:00Z',
    isTechnicallyQualified: true,
    rank: 2,
  },

  // NOT-2026-BLR-005 (Price outlier single winner)
  {
    id: 'BID-005-A',
    noticeId: 'NOT-2026-BLR-005',
    vendorId: 'VND-KA-2022-7744',
    bidAmount: 13150000, // 38.4% above estimatedValue 9,500,000!
    submittedAt: '2026-02-17T15:00:00Z',
    isTechnicallyQualified: true,
    rank: 1,
  },
];

export const SEED_AWARDS = [
  {
    id: 'AWD-2026-001',
    noticeId: 'NOT-2026-BLR-001',
    vendorId: 'VND-KA-2021-4410',
    awardedAmount: 6350000,
    currency: 'INR',
    awardDate: '2026-02-15T12:00:00Z',
    contractSigningDate: '2026-02-22T10:00:00Z',
    evaluationMethod: 'lowest_evaluated_price',
  },
  {
    id: 'AWD-2026-002',
    noticeId: 'NOT-2026-BLR-002',
    vendorId: 'VND-KA-2018-0912',
    awardedAmount: 12450000,
    currency: 'INR',
    awardDate: '2026-02-20T14:30:00Z',
    contractSigningDate: '2026-02-28T11:00:00Z',
    evaluationMethod: 'single_bid_negotiated',
  },
  {
    id: 'AWD-2026-003',
    noticeId: 'NOT-2026-PUN-003',
    vendorId: 'VND-MH-2016-8821',
    awardedAmount: 8150000,
    currency: 'INR',
    awardDate: '2026-02-12T16:00:00Z',
    contractSigningDate: '2026-02-18T10:30:00Z',
    evaluationMethod: 'lowest_evaluated_price',
  },
  {
    id: 'AWD-2026-004',
    noticeId: 'NOT-2026-DEL-004',
    vendorId: 'VND-DL-2020-3319',
    awardedAmount: 17500000,
    currency: 'INR',
    awardDate: '2025-12-20T11:00:00Z',
    contractSigningDate: '2026-01-05T14:00:00Z',
    evaluationMethod: 'lowest_evaluated_price',
  },
  {
    id: 'AWD-2026-005',
    noticeId: 'NOT-2026-BLR-005',
    vendorId: 'VND-KA-2022-7744',
    awardedAmount: 13150000,
    currency: 'INR',
    awardDate: '2026-02-25T15:00:00Z',
    contractSigningDate: '2026-03-05T10:00:00Z',
    evaluationMethod: 'sole_compliant_bid',
  },
];

export const SEED_AMENDMENTS = [
  // AWD-2026-001 (Minor standard 3.1% change)
  {
    id: 'AMD-001-01',
    awardId: 'AWD-2026-001',
    amendmentDate: '2026-03-10T10:00:00Z',
    variationType: 'scope_change',
    costDelta: 200000,
    revisedTotalAmount: 6550000,
    percentageVariation: 3.15,
    statutoryRationale: 'Additional 20 meters of culvert wing-wall reinforced as per on-site ground soil inspection by Executive Engineer.',
  },

  // AWD-2026-004 (High cost creep: 3 successive amendments inflating price by 42.8%!)
  {
    id: 'AMD-004-01',
    awardId: 'AWD-2026-004',
    amendmentDate: '2026-01-20T11:00:00Z',
    variationType: 'cost_escalation',
    costDelta: 2500000,
    revisedTotalAmount: 20000000,
    percentageVariation: 14.28,
    statutoryRationale: 'Scope expansion to include 5 additional year AMC warranty package.',
  },
  {
    id: 'AMD-004-02',
    awardId: 'AWD-2026-004',
    amendmentDate: '2026-02-15T15:00:00Z',
    variationType: 'cost_escalation',
    costDelta: 2800000,
    revisedTotalAmount: 22800000,
    percentageVariation: 16.0,
    statutoryRationale: 'Reagent cassette compatibility upgrade for emergency toxicology screening.',
  },
  {
    id: 'AMD-004-03',
    awardId: 'AWD-2026-004',
    amendmentDate: '2026-03-01T12:00:00Z',
    variationType: 'cost_escalation',
    costDelta: 2200000,
    revisedTotalAmount: 25000000,
    percentageVariation: 12.57, // Cumulative variation: (25M - 17.5M) / 17.5M = 42.8%!
    statutoryRationale: 'Supply of proprietary uninterruptible power units and dual-compressor backup.',
  },
];

export const SEED_INITIAL_REVIEWS = [
  {
    id: 'REV-2026-001',
    flagId: 'FLAG-AUTO-001',
    noticeId: 'NOT-2026-BLR-002',
    reviewerId: 'AUD-KA-9912',
    reviewerRole: 'auditor',
    jurisdiction: 'Bengaluru Urban, Karnataka',
    disposition: 'under_investigation',
    justification: 'Requested original tender notice publication tear-sheets and log of portal visitors to determine why only 1 bid was submitted for a ₹1.25 Cr competitive works contract.',
    timestamp: '2026-03-02T11:15:00Z',
    auditSeal: 'AUDIT-SEAL-8B41-2A99',
  },
  {
    id: 'REV-2026-002',
    flagId: 'FLAG-AUTO-002',
    noticeId: 'NOT-2026-PUN-003',
    reviewerId: 'AUD-MH-1004',
    reviewerRole: 'auditor',
    jurisdiction: 'Pune, Maharashtra',
    disposition: 'marked_false_positive',
    justification: 'Verified municipal commissioner administrative sanction file no. PMC/W/2026/89: emergency road repair ordered prior to Prime Ministerial convoy movement along Baner bypass under Disaster Management Act emergency powers.',
    timestamp: '2026-02-20T14:40:00Z',
    auditSeal: 'AUDIT-SEAL-C3D1-91FA',
  },
  {
    id: 'REV-2026-003',
    flagId: 'FLAG-AUTO-003',
    noticeId: 'NOT-2026-DEL-004',
    reviewerId: 'AUD-DL-7731',
    reviewerRole: 'auditor',
    jurisdiction: 'Delhi NCR',
    disposition: 'escalated_for_formal_audit',
    justification: 'Cumulative variation of +42.8% on awarded contract value exceeds the 15% statutory variation ceiling without pre-approval from Finance Department. Escalated to Directorate of Audit for formal inspection.',
    timestamp: '2026-03-10T16:00:00Z',
    auditSeal: 'AUDIT-SEAL-E8F0-77B2',
  },
];

export const OPEN_CONTRACTING_SEED_DATA = Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  vendors: SEED_VENDORS,
  notices: SEED_PROCUREMENT_NOTICES,
  bids: SEED_BID_SUBMISSIONS,
  awards: SEED_AWARDS,
  amendments: SEED_AMENDMENTS,
  reviews: SEED_INITIAL_REVIEWS,
});
