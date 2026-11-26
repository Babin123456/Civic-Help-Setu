import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ClaimProvenanceGuidance from './ClaimProvenanceGuidance';

describe('ClaimProvenanceGuidance Component (#1154)', () => {
  const sampleProvenance = {
    version: '1.0.0',
    indexVersion: 'idx-v1-abcdef',
    status: 'SUCCESS',
    jurisdiction: {
      requestedCode: 'IN-MH',
      resolvedLevel: 'state',
      isStateSpecific: true,
      ambiguityNotice: 'Rules differ between Maharashtra and Delhi; please confirm local ward rules.',
    },
    failClosedNotice: 'Caution: Verify fees at the official municipal counter.',
    claims: [
      {
        claimId: 'claim-1',
        text: 'Passport renewal requires existing passport and proof of present address.',
        status: 'SUPPORTED',
        riskCategory: 'GENERAL_FACT',
        confidence: 0.88,
        citations: [
          {
            chunkId: 'chunk-passport-doc',
            serviceId: 'passport-services',
            serviceName: 'Passport Seva',
            department: 'Ministry of External Affairs',
            title: 'Required Documents',
            url: 'https://passportindia.gov.in',
            passageExcerpt: 'Mandatory documents include current passport, address proof, and online appointment receipt.',
            lastVerified: '2024-03-01',
          },
        ],
      },
      {
        claimId: 'claim-2',
        text: 'Statutory application fee is 1500 INR payable online.',
        status: 'SUPPORTED',
        riskCategory: 'HIGH_RISK_FEE',
        confidence: 0.92,
        citations: [
          {
            chunkId: 'chunk-passport-fees',
            serviceId: 'passport-services',
            serviceName: 'Passport Seva',
            department: 'Ministry of External Affairs',
            title: 'Statutory Fees',
            url: 'https://passportindia.gov.in',
            passageExcerpt: 'Standard 36-page booklet fee is Rs. 1500 for adult normal application.',
            lastVerified: '2024-03-01',
          },
        ],
      },
      {
        claimId: 'claim-3',
        text: 'VIP fast-track passports are delivered within 2 hours without police verification.',
        status: 'UNKNOWN',
        riskCategory: 'HIGH_RISK_DEADLINE',
        confidence: 0.12,
        citations: [],
      },
      {
        claimId: 'claim-4',
        text: 'Passport applicants are exempt from citizenship proof.',
        status: 'CONTRADICTED',
        riskCategory: 'HIGH_RISK_PENALTY_LEGAL',
        confidence: 0.75,
        citations: [],
      },
    ],
    unsupportedClaims: [
      {
        claimId: 'claim-3',
        text: 'VIP fast-track passports are delivered within 2 hours without police verification.',
        status: 'UNKNOWN',
        reason: 'Claim lacks direct clause-level citation in active government records.',
      },
      {
        claimId: 'claim-4',
        text: 'Passport applicants are exempt from citizenship proof.',
        status: 'CONTRADICTED',
        reason: 'Claim directly conflicts with official statutory documentation.',
      },
    ],
  };

  it('renders verified claims with badges, passage citations, and index version', () => {
    const html = renderToStaticMarkup(
      <ClaimProvenanceGuidance
        provenance={sampleProvenance}
        claims={sampleProvenance.claims}
        unsupportedClaims={sampleProvenance.unsupportedClaims}
        disclaimer="Notice: This guidance is retrieved from approved civic service guidelines."
      />
    );

    expect(html).toContain('Claim-Level Source Provenance');
    expect(html).toContain('Index: idx-v1-abcdef');
    expect(html).toContain('Verified Claim');
    expect(html).toContain('Passport renewal requires existing passport');
    expect(html).toContain('Passage Citations (1 source)');
  });

  it('isolates unknown / unsupported claims with warning callouts', () => {
    const html = renderToStaticMarkup(
      <ClaimProvenanceGuidance
        provenance={sampleProvenance}
        claims={sampleProvenance.claims}
        unsupportedClaims={sampleProvenance.unsupportedClaims}
      />
    );

    expect(html).toContain('Unverified High-Risk Claim');
    expect(html).toContain('Contradicted Claim');
    expect(html).toContain('Uncorroborated Claims Flagged (2)');
    expect(html).toContain('VIP fast-track passports are delivered within 2 hours');
    expect(html).toContain('Claim lacks direct clause-level citation in active government records');
  });

  it('renders jurisdiction ambiguity warning when present', () => {
    const html = renderToStaticMarkup(
      <ClaimProvenanceGuidance
        provenance={sampleProvenance}
        claims={sampleProvenance.claims}
      />
    );

    expect(html).toContain('Rules differ between Maharashtra and Delhi');
  });

  it('renders fail-closed notice when high-risk claims or contradictions occur', () => {
    const html = renderToStaticMarkup(
      <ClaimProvenanceGuidance
        provenance={sampleProvenance}
        claims={sampleProvenance.claims}
        failClosedNotice="Caution: Verify fees at the official municipal counter."
      />
    );

    expect(html).toContain('Caution: Verify fees at the official municipal counter');
  });

  it('renders nothing when no claims are provided', () => {
    const html = renderToStaticMarkup(
      <ClaimProvenanceGuidance claims={[]} unsupportedClaims={[]} />
    );
    expect(html).toBe('');
  });
});
