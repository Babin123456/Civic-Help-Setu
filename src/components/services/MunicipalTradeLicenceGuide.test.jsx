import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import MunicipalTradeLicenceGuide from './MunicipalTradeLicenceGuide';
import {
  MUNICIPAL_JURISDICTIONS,
  MANDATORY_DOCUMENTS,
  CONDITIONAL_DOCUMENTS,
  OPTIONAL_DOCUMENTS,
  ORDERED_JOURNEY_STAGES
} from '../../data/municipalTradeLicenceData';

describe('MunicipalTradeLicenceGuide Component', () => {
  it('renders the scannable guide header, legal scope, and critical title caveat', () => {
    const html = renderToStaticMarkup(<MunicipalTradeLicenceGuide />);

    expect(html).toContain('Municipal Trade Licence Application &amp; Renewal Guide');
    expect(html).toContain('Urban Local Body (ULB) Statutory Guide');
    expect(html).toContain('Trade Licence ≠ Property Ownership or Title Guarantee');
    expect(html).toContain('does not confer legal ownership, does not regularize illegal or unauthorized constructions');
  });

  it('renders accessible navigation tabs and tab panels with correct ARIA roles', () => {
    const html = renderToStaticMarkup(<MunicipalTradeLicenceGuide />);

    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('aria-controls="panel-overview"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('id="panel-overview"');
  });

  it('renders primary trade licence classifications with plain-language definitions in overview', () => {
    const html = renderToStaticMarkup(<MunicipalTradeLicenceGuide initialTab="overview" />);

    expect(html).toContain('1. General Commercial Trade');
    expect(html).toContain('2. Food &amp; Health Establishments');
    expect(html).toContain('3. Dangerous &amp; Offensive (D&amp;O) Trades');
    expect(html).toContain('4. Veterinary &amp; Pet Establishments');
  });

  it('renders verified municipal profile for Delhi (MCD) in jurisdictions tab', () => {
    const html = renderToStaticMarkup(
      <MunicipalTradeLicenceGuide initialTab="jurisdictions" initialJurisdictionId="delhi" />
    );

    expect(html).toContain('Municipal Corporation of Delhi (MCD)');
    expect(html).toContain('Delhi Municipal Corporation Act, 1957');
    expect(html).toContain('https://mcdonline.nic.in');
    expect(html).toContain('Official Verified Source');
    expect(html).toContain('7 to 15 working days');
  });

  it('renders verified municipal profile for Chennai (GCC) in jurisdictions tab', () => {
    const html = renderToStaticMarkup(
      <MunicipalTradeLicenceGuide initialTab="jurisdictions" initialJurisdictionId="chennai" />
    );

    expect(html).toContain('Greater Chennai Corporation (GCC)');
    expect(html).toContain('Tamil Nadu Urban Local Bodies Act, 1998 &amp; Rules 2023');
    expect(html).toContain('https://chennaicorporation.gov.in');
    expect(html).toContain('Official Verified Source');
    expect(html).toContain('Sanitary Inspector (SI) / Zonal Health Officer');
  });

  it('renders verified municipal profile for Bengaluru (BBMP) in jurisdictions tab', () => {
    const html = renderToStaticMarkup(
      <MunicipalTradeLicenceGuide initialTab="jurisdictions" initialJurisdictionId="bengaluru" />
    );

    expect(html).toContain('Bruhat Bengaluru Mahanagara Palike (BBMP)');
    expect(html).toContain('Bruhat Bengaluru Mahanagara Palike Act, 2020');
    expect(html).toContain('https://bbmptax.karnataka.gov.in');
    expect(html).toContain('Sakala Services Act');
  });

  it('renders verified municipal profile for Kolkata (KMC) in jurisdictions tab', () => {
    const html = renderToStaticMarkup(
      <MunicipalTradeLicenceGuide initialTab="jurisdictions" initialJurisdictionId="kolkata" />
    );

    expect(html).toContain('Kolkata Municipal Corporation (KMC)');
    expect(html).toContain('Kolkata Municipal Corporation Act, 1980 (Section 199)');
    expect(html).toContain('https://www.kmcgov.in');
    expect(html).toContain('Certificate of Enlistment');
  });

  it('renders verified municipal profile for Mumbai (BMC) in jurisdictions tab', () => {
    const html = renderToStaticMarkup(
      <MunicipalTradeLicenceGuide initialTab="jurisdictions" initialJurisdictionId="mumbai" />
    );

    expect(html).toContain('Brihanmumbai Municipal Corporation (BMC / MCGM)');
    expect(html).toContain('Mumbai Municipal Corporation Act, 1888 (Section 394)');
    expect(html).toContain('https://portal.mcgm.gov.in');
    expect(html).toContain('Schedule M of MMC Act');
  });

  it('displays "Not specified by the linked official source." when jurisdiction source is missing or unverified', () => {
    const html = renderToStaticMarkup(
      <MunicipalTradeLicenceGuide initialTab="jurisdictions" initialJurisdictionId="unspecified" />
    );

    expect(html).toContain('Unverified Authority');
    expect(html).toContain('Not specified by the linked official source.');
  });

  it('renders the ordered 6-stage application journey with separate date labels in journey tab', () => {
    const html = renderToStaticMarkup(<MunicipalTradeLicenceGuide initialTab="journey" />);

    expect(html).toContain('Ordered Application &amp; Renewal Journey');
    expect(html).toContain('Premises Land-Use &amp; Master Plan Permissibility Check');
    expect(html).toContain('Jurisdiction Identification &amp; Municipal Portal Onboarding');
    expect(html).toContain('Application Submission &amp; Provisional Acknowledgement');
    expect(html).toContain('Departmental Scrutiny &amp; Field Site Inspection');
    expect(html).toContain('Statutory Verification &amp; Final Scrutiny Approval');
    expect(html).toContain('Statutory Fee Payment, Licence Issuance &amp; Annual Renewal');

    expect(html).toContain('Application Date');
    expect(html).toContain('Acknowledgement Date');
    expect(html).toContain('Appointment / Inspection Date');
    expect(html).toContain('Verification Date');
    expect(html).toContain('Issue Date &amp; Validity / Renewal Dates');
  });

  it('segregates mandatory vs conditional vs optional documents in documents tab', () => {
    const html = renderToStaticMarkup(<MunicipalTradeLicenceGuide initialTab="documents" />);

    // Mandatory
    expect(html).toContain('1. Mandatory Documents (Required for All Applicants)');
    expect(html).toContain('Identity Proof of Applicant / Proprietor / Authorised Partner');
    expect(html).toContain('Proof of Legal Occupancy of Business Premises');
    expect(html).toContain('Utility Bill of Commercial Premises');
    expect(html).toContain('Entity Constitution &amp; Registration Document');
    expect(html).toContain('Premises Key Plan / Dimensioned Layout Sketch');

    // Conditional
    expect(html).toContain('2. Conditional Requirements (Trade-Specific Clearances &amp; NOCs)');
    expect(html).toContain('Fire Safety Certificate / Fire NOC');
    expect(html).toContain('State Pollution Control Board Consent (CTE / CTO)');
    expect(html).toContain('FSSAI Registration / Food Safety Licence');

    // Optional
    expect(html).toContain('3. Optional / Voluntary Supporting Documents');
    expect(html).toContain('Udyam MSME Registration Certificate');
    expect(html).toContain('Goods and Services Tax (GSTIN) Certificate');
  });

  it('renders the 8 distinct milestone date labels and privacy guarantee in dates tab', () => {
    const html = renderToStaticMarkup(<MunicipalTradeLicenceGuide initialTab="dates" />);

    expect(html).toContain('Statutory Milestone Date Fields');
    expect(html).toContain('1. Application Date');
    expect(html).toContain('2. Acknowledgement Date');
    expect(html).toContain('3. Appointment / Inspection Date');
    expect(html).toContain('4. Verification Date');
    expect(html).toContain('5. Issue Date');
    expect(html).toContain('6. Validity Expiry Date');
    expect(html).toContain('7. Renewal Window Date');
    expect(html).toContain('8. Late Renewal Penalty Date');

    // Privacy guarantee
    expect(html).toContain('Privacy Guarantee: This calculation runs entirely in your local browser');
    expect(html).toContain('No dates, identity documents, or personal data are stored or uploaded');
  });

  it('flags conflicting third-party myths and displays transparency disclaimers in caveats tab', () => {
    const html = renderToStaticMarkup(<MunicipalTradeLicenceGuide initialTab="caveats" />);

    expect(html).toContain('Flagged Conflicting &amp; Misleading Online Information');
    expect(html).toContain('Myth: &quot;A Municipal Trade Licence has Lifetime Validity.&quot;');
    expect(html).toContain('Myth: &quot;One Trade Licence fee applies uniformly across all of India.&quot;');
    expect(html).toContain('Myth: &quot;Getting a Trade Licence regularizes illegal construction or allows shops on any residential street.&quot;');
    expect(html).toContain('Information Transparency Disclaimer');
    expect(html).toContain('Not specified by the linked official source.');
  });

  it('verifies dataset integrity for municipal bodies, mandatory, conditional, and optional documents', () => {
    expect(MUNICIPAL_JURISDICTIONS.length).toBeGreaterThanOrEqual(6);
    MUNICIPAL_JURISDICTIONS.forEach((j) => {
      expect(j.id).toBeDefined();
      expect(j.state).toBeTruthy();
      expect(j.localBody).toBeTruthy();
      expect(j.statutoryAct).toBeTruthy();
      expect(j.department).toBeTruthy();
    });

    expect(MANDATORY_DOCUMENTS.length).toBe(5);
    MANDATORY_DOCUMENTS.forEach((doc) => {
      expect(doc.id).toBeDefined();
      expect(doc.title).toBeTruthy();
      expect(doc.description).toBeTruthy();
      expect(doc.category).toBe('mandatory');
      expect(doc.officialBasis).toBeTruthy();
    });

    expect(CONDITIONAL_DOCUMENTS.length).toBe(5);
    CONDITIONAL_DOCUMENTS.forEach((doc) => {
      expect(doc.id).toBeDefined();
      expect(doc.title).toBeTruthy();
      expect(doc.condition).toBeTruthy();
      expect(doc.category).toBe('conditional');
    });

    expect(OPTIONAL_DOCUMENTS.length).toBe(3);
    OPTIONAL_DOCUMENTS.forEach((doc) => {
      expect(doc.id).toBeDefined();
      expect(doc.title).toBeTruthy();
      expect(doc.category).toBe('optional');
    });

    expect(ORDERED_JOURNEY_STAGES.length).toBe(6);
    ORDERED_JOURNEY_STAGES.forEach((stage, idx) => {
      expect(stage.stage).toBe(idx + 1);
      expect(stage.title).toBeTruthy();
      expect(stage.description).toBeTruthy();
      expect(stage.dateLabel).toBeTruthy();
      expect(stage.milestone).toBeTruthy();
    });
  });
});
