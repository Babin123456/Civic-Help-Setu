import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import TransgenderCertificateWelfareGuide from './TransgenderCertificateWelfareGuide';

describe('TransgenderCertificateWelfareGuide Component (#1104)', () => {
  it('renders statutory overview with Act reference, self-determination guarantee, and Quick Exit', () => {
    const html = renderToStaticMarkup(<TransgenderCertificateWelfareGuide initialTab="overview" />);

    expect(html).toContain('Transgender Certificate &amp; Welfare Scheme Application Navigator');
    expect(html).toContain('Transgender Persons (Protection of Rights) Act, 2019');
    expect(html).toContain('Self-Determination Guarantee');
    expect(html).toContain('Quick Exit (ESC)');
    expect(html).toContain('National Portal for Transgender Persons');
    expect(html).toContain('Competent Issuing Officer');
    expect(html).toContain('Prohibited by Law');
  });

  it('renders application route (Form 1) tab with statutory checklist', () => {
    const html = renderToStaticMarkup(<TransgenderCertificateWelfareGuide initialTab="application" />);

    expect(html).toContain('Certificate Application Route');
    expect(html).toContain('Register on the National Portal for Transgender Persons');
    expect(html).toContain('Submit Form 1 (Application for Certificate of Identity)');
    expect(html).toContain('Affidavit in Form 2');
    expect(html).toContain('District Magistrate Scrutiny &amp; Statutory Timeline');
  });

  it('renders gender affirmation revision and correction tab (Sections 6 & 7)', () => {
    const html = renderToStaticMarkup(<TransgenderCertificateWelfareGuide initialTab="revision" />);

    expect(html).toContain('Correction &amp; Gender Affirmation Routes (Sections 6 &amp; 7)');
    expect(html).toContain('Minor Corrections (Name typo, DOB, Address)');
    expect(html).toContain('Revised Certificate Post-Medical Intervention (Section 6 &amp; 7)');
    expect(html).toContain('Form 3');
    expect(html).toContain('Section 7(3) Universal Modification Mandate');
  });

  it('renders statutory appeal routes and 30-day limitation notice', () => {
    const html = renderToStaticMarkup(<TransgenderCertificateWelfareGuide initialTab="appeals" />);

    expect(html).toContain('Statutory Appeal &amp; Grievance Routes (Rule 11)');
    expect(html).toContain('Demand Written Rejection Memo with Reasons');
    expect(html).toContain('Statutory First Appeal (Within 30 Days)');
    expect(html).toContain('30-Day Limitation Window');
  });

  it('renders central and state welfare schemes', () => {
    const html = renderToStaticMarkup(<TransgenderCertificateWelfareGuide initialTab="schemes" />);

    expect(html).toContain('Welfare Programmes:');
    expect(html).toContain('SMILE: Support for Marginalised Individuals for Livelihood and Enterprise');
    expect(html).toContain('Ayushman Bharat TG Plus Health Package');
    expect(html).toContain('Garima Greh: Shelter Homes for Transgender Persons');
  });

  it('renders verified support directory with helplines and legal aid', () => {
    const html = renderToStaticMarkup(<TransgenderCertificateWelfareGuide initialTab="directory" />);

    expect(html).toContain('Verified Support Resources Directory');
    expect(html).toContain('National Tele-Counselling Helpline for Transgender Persons');
    expect(html).toContain('14567');
    expect(html).toContain('National Women &amp; TG Emergency Helpline');
    expect(html).toContain('181');
    expect(html).toContain('National Legal Services Authority (NALSA)');
  });

  it('renders privacy, zero-document collection disclosure, and local storage management', () => {
    const html = renderToStaticMarkup(<TransgenderCertificateWelfareGuide initialTab="privacy" />);

    expect(html).toContain('Privacy &amp; Safe-Device Guidance');
    expect(html).toContain('Zero Document Collection &amp; Zero Telemetry');
    expect(html).toContain('No Eligibility Assumptions');
    expect(html).toContain('Clear Saved Progress');
  });

  it('renders multilingual statutory glossary', () => {
    const html = renderToStaticMarkup(<TransgenderCertificateWelfareGuide initialTab="multilingual" />);

    expect(html).toContain('Multilingual &amp; Plain Language Access');
    expect(html).toContain('Plain Language Statutory Glossary');
    expect(html).toContain('Certificate of Identity');
    expect(html).toContain('Form 2 Affidavit');
    expect(html).toContain('Form 3 Certificate');
    expect(html).toContain('Garima Greh');
  });

  it('switches state jurisdiction context seamlessly', () => {
    const html = renderToStaticMarkup(
      <TransgenderCertificateWelfareGuide initialStateId="tamil_nadu" initialTab="schemes" />
    );

    expect(html).toContain('Tamil Nadu Destitute Transgender Monthly Pension');
    expect(html).toContain('Full Higher Education Fee Waiver (Tamil Nadu)');
  });
});
