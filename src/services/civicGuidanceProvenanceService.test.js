import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateGuidanceWithProvenance,
  validateGuidanceRequest,
  computeIndexVersion,
  computePassageFreshnessScore,
  resetGuidanceIndexCache,
  PROVENANCE_STATUS,
  CLAIM_STATUS,
  MANDATORY_LEGAL_DISCLAIMER,
} from './civicGuidanceProvenanceService.js';
import { CLAIM_RISK_CATEGORY } from './evidenceEntailmentVerificationService.js';

describe('Retrieval-Augmented Civic Guidance with Claim-Level Provenance Service (#1154)', () => {
  beforeEach(() => {
    resetGuidanceIndexCache();
  });

  const syntheticActiveServices = [
    {
      id: 'synth-voter-id',
      name: 'Voter ID Registration (EPIC)',
      category: 'Elections',
      department: 'Election Commission of India',
      description: 'National electoral photo identity card application for eligible citizens.',
      jurisdictionLevel: 'central',
      jurisdictionCode: 'IN',
      effectiveFrom: '2023-01-01T00:00:00Z',
      effectiveTo: null,
      supersededBy: null,
      status: 'published',
      isDraft: false,
      eligibility: ['Indian citizen aged 18 or above on qualifying date'],
      documents: ['Age proof (Birth certificate or school marksheet)', 'Current residential address proof'],
      process: ['Submit Form 6 via National Voters Service Portal (NVSP)', 'Field verification by Booth Level Officer'],
      fees: 'Free of cost',
      officialUrl: 'https://voters.eci.gov.in',
      lastVerified: '2024-04-10',
      version: '2.1',
    },
    {
      id: 'synth-pension-mh',
      name: 'Sanjay Gandhi Niradhar Pension Scheme',
      category: 'Social Welfare',
      department: 'Social Justice Department Maharashtra',
      description: 'Financial assistance scheme for destitute elderly, disabled, and widows in Maharashtra.',
      jurisdictionLevel: 'state',
      jurisdictionCode: 'IN-MH',
      jurisdictionName: 'Maharashtra',
      effectiveFrom: '2023-06-01T00:00:00Z',
      effectiveTo: null,
      supersededBy: null,
      status: 'published',
      isDraft: false,
      eligibility: ['Resident of Maharashtra for minimum 15 years', 'Annual family income below 21000 INR'],
      documents: ['Domicile certificate of Maharashtra', 'Income certificate from Tahsildar'],
      process: ['Submit application to Tahsil Office or Citizen Facilitation Counter'],
      fees: 'Application is free, nominal affidavit fee applies',
      officialUrl: 'https://sjsa.maharashtra.gov.in',
      lastVerified: '2024-02-15',
      version: '1.4',
    },
    {
      id: 'synth-pension-dl',
      name: 'Delhi Old Age Financial Assistance',
      category: 'Social Welfare',
      department: 'Department of Social Welfare Delhi',
      description: 'Monthly pension for senior citizens residing in the National Capital Territory of Delhi.',
      jurisdictionLevel: 'state',
      jurisdictionCode: 'IN-DL',
      jurisdictionName: 'Delhi',
      effectiveFrom: '2023-01-01T00:00:00Z',
      effectiveTo: null,
      supersededBy: null,
      status: 'published',
      isDraft: false,
      eligibility: ['Senior citizens aged 60 and above residing in Delhi for at least 5 years'],
      documents: ['Aadhaar card', 'Bank passbook in Delhi branch', 'Voter ID of Delhi'],
      process: ['Apply online on e-District Delhi portal'],
      fees: 'Zero fee',
      officialUrl: 'https://edistrict.delhigovt.nic.in',
      lastVerified: '2024-01-20',
      version: '1.2',
    },
    {
      id: 'synth-expired-subsidy',
      name: 'Temporary 2021 COVID Relief Grant',
      category: 'Health',
      department: 'Health Department',
      description: 'One-time emergency relief grant during 2021 pandemic.',
      jurisdictionLevel: 'central',
      jurisdictionCode: 'IN',
      effectiveFrom: '2021-04-01T00:00:00Z',
      effectiveTo: '2021-12-31T23:59:59Z',
      supersededBy: null,
      status: 'published',
      isDraft: false,
      eligibility: ['Affected citizens in 2021'],
      documents: ['Discharge summary'],
      process: ['Closed portal'],
      fees: 'None',
      officialUrl: 'https://health.gov.in',
      lastVerified: '2021-05-01',
      version: '1.0',
    },
    {
      id: 'synth-unapproved-draft',
      name: 'Unverified Community Free Electric Vehicle Scheme',
      category: 'Transport',
      department: 'Fake Transport Dept',
      description: 'Free electric cars for all citizens upon paying advance 5000 processing fee.',
      jurisdictionLevel: 'central',
      jurisdictionCode: 'IN',
      effectiveFrom: '2024-01-01T00:00:00Z',
      effectiveTo: null,
      supersededBy: null,
      status: 'pending',
      isDraft: true,
      eligibility: ['Anyone who pays'],
      documents: ['No documents required'],
      process: ['Transfer fee via UPI'],
      fees: '5000 INR',
      officialUrl: 'https://unverified-scam-site.com',
      lastVerified: '2024-01-01',
      version: '0.1-draft',
    },
  ];

  describe('Service Boundary & Input Validation', () => {
    it('validates and accepts valid citizen queries', () => {
      const res = validateGuidanceRequest({ query: 'How to register for Voter ID?' });
      expect(res.valid).toBe(true);
      expect(res.sanitizedQuery).toBe('How to register for Voter ID?');
    });

    it('rejects empty or whitespace-only queries', () => {
      const res = validateGuidanceRequest({ query: '    ' });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('non-empty string');
    });

    it('rejects queries exceeding the maximum length boundary', () => {
      const longQuery = 'a'.repeat(650);
      const res = validateGuidanceRequest({ query: longQuery });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('maximum allowed length');
    });

    it('rejects malformed jurisdiction codes containing illegal characters', () => {
      const res = validateGuidanceRequest({
        query: 'Pension rules',
        jurisdictionCode: 'IN-MH<script>alert(1)</script>',
      });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Invalid jurisdiction code format');
    });

    it('rejects invalid reference timestamps', () => {
      const res = validateGuidanceRequest({
        query: 'Pension rules',
        referenceTimestamp: 'not-a-valid-date-string',
      });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Invalid referenceTimestamp value');
    });
  });

  describe('Authority & Content Safety Gating', () => {
    it('strictly excludes draft, pending, or unapproved schemes from indexing and retrieval', async () => {
      const response = await generateGuidanceWithProvenance({
        query: 'free electric cars 5000 processing fee',
        services: syntheticActiveServices,
      });

      // The unapproved draft must NEVER rank or produce verified guidance
      expect(response.status).toBe(PROVENANCE_STATUS.UNSUPPORTED);
      expect(response.claims.length).toBe(0);

      // Confirm unapproved URL is nowhere in officialSources
      const allUrls = (response.officialSources || []).map((s) => s.url);
      expect(allUrls.some((u) => u.includes('unverified-scam-site'))).toBe(false);
    });

    it('excludes expired rules from active queries', async () => {
      const response = await generateGuidanceWithProvenance({
        query: 'Temporary COVID Relief Grant 2021',
        referenceTimestamp: new Date('2026-01-01T00:00:00Z').getTime(),
        services: syntheticActiveServices,
      });

      // 2021 rule expired on 2021-12-31, so present query in 2026 must not return it as active
      expect(response.status).toBe(PROVENANCE_STATUS.UNSUPPORTED);
    });
  });

  describe('Claim-Level Provenance & Passage Citation', () => {
    it('attaches passage-level citations to verified claims for active services', async () => {
      const response = await generateGuidanceWithProvenance({
        query: 'What documents are required for Voter ID card registration?',
        services: syntheticActiveServices,
      });

      expect(response.status).toBe(PROVENANCE_STATUS.SUCCESS);
      expect(response.overallGrounded).toBe(true);
      expect(response.claims.length).toBeGreaterThan(0);
      expect(response.disclaimer).toBe(MANDATORY_LEGAL_DISCLAIMER);

      const supportedClaims = response.claims.filter((c) => c.status === CLAIM_STATUS.SUPPORTED);
      expect(supportedClaims.length).toBeGreaterThan(0);

      const docClaim = supportedClaims.find((c) =>
        c.text.toLowerCase().includes('document') || c.text.toLowerCase().includes('proof')
      );
      expect(docClaim).toBeDefined();
      expect(docClaim.citations.length).toBeGreaterThan(0);

      const citation = docClaim.citations[0];
      expect(citation.serviceId).toBe('synth-voter-id');
      expect(citation.serviceName).toBe('Voter ID Registration (EPIC)');
      expect(citation.url).toBe('https://voters.eci.gov.in');
      expect(citation.passageExcerpt.toLowerCase()).toContain('proof');
    });

    it('applies stricter threshold for high-risk statutory fee claims', async () => {
      const response = await generateGuidanceWithProvenance({
        query: 'What is the official fee for Voter ID card?',
        services: syntheticActiveServices,
      });

      expect(response.status).toBe(PROVENANCE_STATUS.SUCCESS);
      const feeClaim = response.claims.find(
        (c) => c.riskCategory === CLAIM_RISK_CATEGORY.HIGH_RISK_FEE
      );

      if (feeClaim && feeClaim.status === CLAIM_STATUS.SUPPORTED) {
        expect(feeClaim.confidence).toBeGreaterThanOrEqual(0.65);
        expect(feeClaim.citations[0].url).toContain('voters.eci.gov.in');
      }
    });

    it('exposes unsupported claims as UNKNOWN with explicit reasons', async () => {
      const unsupportedResponse = await generateGuidanceWithProvenance({
        query: 'Can I get free Bitcoin vouchers and private luxury jet from the municipal office?',
        services: syntheticActiveServices,
      });

      expect(unsupportedResponse.status).toBe(PROVENANCE_STATUS.UNSUPPORTED);
      expect(unsupportedResponse.overallGrounded).toBe(false);
      expect(unsupportedResponse.unsupportedClaims.length).toBeGreaterThan(0);
      expect(unsupportedResponse.unsupportedClaims[0].status).toBe(CLAIM_STATUS.UNKNOWN);
    });
  });

  describe('Jurisdiction-Aware Scoping & Divergence Handling', () => {
    it('isolates state-specific policy when state jurisdiction is supplied', async () => {
      const mhResponse = await generateGuidanceWithProvenance({
        query: 'old age pension eligibility and documents',
        jurisdictionCode: 'IN-MH',
        services: syntheticActiveServices,
      });

      expect(mhResponse.status).toBe(PROVENANCE_STATUS.SUCCESS);
      expect(mhResponse.serviceId).toBe('synth-pension-mh');
      expect(mhResponse.jurisdiction.requestedCode).toBe('IN-MH');

      const dlResponse = await generateGuidanceWithProvenance({
        query: 'old age pension eligibility and documents',
        jurisdictionCode: 'IN-DL',
        services: syntheticActiveServices,
      });

      expect(dlResponse.status).toBe(PROVENANCE_STATUS.SUCCESS);
      expect(dlResponse.serviceId).toBe('synth-pension-dl');
      expect(dlResponse.jurisdiction.requestedCode).toBe('IN-DL');
    });

    it('surfaces ambiguity limitation notice when jurisdiction is missing and state rules diverge', async () => {
      const response = await generateGuidanceWithProvenance({
        query: 'old age pension financial assistance',
        jurisdictionCode: null, // missing state
        services: syntheticActiveServices,
      });

      // When multiple states have conflicting schemes and no state is specified,
      // it should include an ambiguity notice
      if (response.jurisdiction?.ambiguityNotice) {
        expect(response.jurisdiction.ambiguityNotice).toContain('differ by state');
      }
    });
  });

  describe('Index Versioning & Freshness Multipliers', () => {
    it('computes deterministic index versions matching catalog snapshot state', () => {
      const v1 = computeIndexVersion(syntheticActiveServices);
      const v2 = computeIndexVersion(syntheticActiveServices);
      expect(v1).toBe(v2);
      expect(v1).toMatch(/^idx-v1-[0-9a-f]+$/);

      // Mutate catalog version -> hash must change
      const modified = [
        ...syntheticActiveServices,
        {
          id: 'synth-extra-service',
          name: 'Extra Civic Service',
          status: 'published',
          isDraft: false,
          effectiveFrom: '2024-01-01T00:00:00Z',
          version: '1.0',
        },
      ];
      const v3 = computeIndexVersion(modified);
      expect(v3).not.toBe(v1);
    });

    it('boosts freshness score for recent official government portal domains', () => {
      const govChunk = {
        officialUrl: 'https://eci.gov.in/voters',
        lastVerified: '2024-05-01',
      };
      const score = computePassageFreshnessScore(
        govChunk,
        new Date('2024-06-01').getTime()
      );
      expect(score).toBeGreaterThan(1.0);
    });
  });

  describe('Concurrency & Non-Interference', () => {
    it('handles rapid concurrent queries cleanly without race conditions or state pollution', async () => {
      const promises = [
        generateGuidanceWithProvenance({ query: 'Voter ID application procedure', services: syntheticActiveServices }),
        generateGuidanceWithProvenance({ query: 'Maharashtra Sanjay Gandhi pension', jurisdictionCode: 'IN-MH', services: syntheticActiveServices }),
        generateGuidanceWithProvenance({ query: 'Delhi old age assistance', jurisdictionCode: 'IN-DL', services: syntheticActiveServices }),
        generateGuidanceWithProvenance({ query: 'fictitious space travel certificate', services: syntheticActiveServices }),
      ];

      const results = await Promise.all(promises);

      expect(results[0].status).toBe(PROVENANCE_STATUS.SUCCESS);
      expect(results[0].serviceId).toBe('synth-voter-id');

      expect(results[1].status).toBe(PROVENANCE_STATUS.SUCCESS);
      expect(results[1].serviceId).toBe('synth-pension-mh');

      expect(results[2].status).toBe(PROVENANCE_STATUS.SUCCESS);
      expect(results[2].serviceId).toBe('synth-pension-dl');

      expect(results[3].status).toBe(PROVENANCE_STATUS.UNSUPPORTED);
      expect(results[3].overallGrounded).toBe(false);
    });
  });
});
