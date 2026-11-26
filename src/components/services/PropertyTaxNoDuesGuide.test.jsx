import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PropertyTaxNoDuesGuide from './PropertyTaxNoDuesGuide';

describe('PropertyTaxNoDuesGuide Component (#531)', () => {
  describe('Header and Jurisdiction Navigation', () => {
    it('renders the scannable guide header, title, and verified municipal badge', () => {
      const html = renderToStaticMarkup(<PropertyTaxNoDuesGuide />);

      expect(html).toContain('Property Tax No-Dues Certificate &amp; Payment Receipt Guide');
      expect(html).toContain('Verified Municipal Revenue Guide • Issue #531');
      expect(html).toContain('Receipt ≠ No-Dues Certificate');
      expect(html).toContain('Neither document establishes property title');
    });

    it('renders accessible tab navigation with correct ARIA roles', () => {
      const html = renderToStaticMarkup(<PropertyTaxNoDuesGuide />);

      expect(html).toContain('role="tablist"');
      expect(html).toContain('role="tab"');
      expect(html).toContain('aria-selected="true"');
      expect(html).toContain('aria-controls="panel-overview"');
      expect(html).toContain('role="tabpanel"');
      expect(html).toContain('id="panel-overview"');
    });

    it('renders the cascading jurisdiction selector for State, District, and ULB', () => {
      const html = renderToStaticMarkup(<PropertyTaxNoDuesGuide />);

      expect(html).toContain('Select Jurisdiction (State / District / Urban Local Body)');
      expect(html).toContain('id="state-selector"');
      expect(html).toContain('id="district-selector"');
      expect(html).toContain('id="ulb-selector"');
      expect(html).toContain('Delhi');
      expect(html).toContain('Municipal Corporation of Delhi (MCD)');
    });
  });

  describe('Overview and Core Definitions Tab', () => {
    it('renders clear distinction between payment receipt and No-Dues Certificate', () => {
      const html = renderToStaticMarkup(<PropertyTaxNoDuesGuide initialTab="overview" />);

      expect(html).toContain('Critical Rule: A Payment Receipt is NOT a No-Dues Certificate');
      expect(html).toContain('What is Property Tax?');
      expect(html).toContain('What is a Property Tax Payment Receipt?');
      expect(html).toContain('What is a Property Tax No-Dues Certificate (NOC)?');
      expect(html).toContain('Why Receipts and No-Dues Certificates are NOT Interchangeable');
      expect(html).toContain('What Neither Document Establishes: Ownership &amp; Legal Title');
    });

    it('displays reasons why citizens need the certificate', () => {
      const html = renderToStaticMarkup(<PropertyTaxNoDuesGuide initialTab="overview" />);

      expect(html).toContain('When Do Citizens Need a Property Tax No-Dues Certificate?');
      expect(html).toContain('Property Sale and Title Conveyance');
      expect(html).toContain('Home Loan, Mortgage &amp; Refinancing');
      expect(html).toContain('Khata Transfer &amp; Municipal Mutation');
      expect(html).toContain('Sanction of Building Plan &amp; Addition Permits');
    });
  });

  describe('Jurisdictions and ULB Details Tab', () => {
    it('renders verified MCD details when Delhi is selected', () => {
      const html = renderToStaticMarkup(
        <PropertyTaxNoDuesGuide
          initialTab="jurisdictions"
          initialState="Delhi"
          initialDistrict="All Delhi Districts"
          initialJurisdictionId="delhi-mcd"
        />
      );

      expect(html).toContain('Municipal Corporation of Delhi (MCD)');
      expect(html).toContain('Assessment &amp; Collection Department');
      expect(html).toContain('Delhi Municipal Corporation Act, 1957');
      expect(html).toContain('https://mcdonline.nic.in');
      expect(html).toContain('Unique Property Identification Code (UPIC)');
      expect(html).toContain('MCD Property Tax No-Dues Certificate / Clearance Status');
      expect(html).toContain('155304');
    });

    it('renders verified BBMP details when Bengaluru is selected', () => {
      const html = renderToStaticMarkup(
        <PropertyTaxNoDuesGuide
          initialTab="jurisdictions"
          initialState="Karnataka"
          initialDistrict="Bengaluru Urban"
          initialJurisdictionId="bengaluru-bbmp"
        />
      );

      expect(html).toContain('Bruhat Bengaluru Mahanagara Palike (BBMP)');
      expect(html).toContain('https://bbmptax.karnataka.gov.in');
      expect(html).toContain('SAS Application Number / PID');
      expect(html).toContain('Karnataka Sakala Services Act');
    });

    it('renders verified BMC details when Mumbai is selected', () => {
      const html = renderToStaticMarkup(
        <PropertyTaxNoDuesGuide
          initialTab="jurisdictions"
          initialState="Maharashtra"
          initialDistrict="Mumbai City &amp; Mumbai Suburban"
          initialJurisdictionId="mumbai-bmc"
        />
      );

      expect(html).toContain('Brihanmumbai Municipal Corporation (BMC / MCGM)');
      expect(html).toContain('https://ptaxportal.mcgm.gov.in');
      expect(html).toContain('SAC Number (Section-Account-Code)');
      expect(html).toContain('Maharashtra Right to Public Services Act');
    });

    it('renders unverified jurisdiction notice for unlisted jurisdictions without fake URLs', () => {
      const html = renderToStaticMarkup(
        <PropertyTaxNoDuesGuide
          initialTab="jurisdictions"
          initialState="Unlisted State / UT"
          initialDistrict=""
          initialJurisdictionId="unverified-fallback"
        />
      );

      expect(html).toContain('Official information for this jurisdiction has not yet been verified.');
      expect(html).toContain('Unverified Urban Local Body');
      expect(html).not.toContain('https://undefined');
      expect(html).toContain('Not specified by the linked official source.');
    });
  });

  describe('10-Step Journey Tab', () => {
    it('renders online vs offline routes and ordered 10 stages', () => {
      const html = renderToStaticMarkup(<PropertyTaxNoDuesGuide initialTab="journey" />);

      expect(html).toContain('Online Route');
      expect(html).toContain('Offline / In-Person Route');
      expect(html).toContain('Ordered 10-Stage Application &amp; Verification Journey');
      expect(html).toContain('Identify Your Competent Municipal Authority');
      expect(html).toContain('Locate the Official Property Tax Portal or Office');
      expect(html).toContain('Find the Property Using Unique Identifier');
      expect(html).toContain('Inspect Assessment Year, Demands, Arrears &amp; Penalties');
      expect(html).toContain('Verify Property Attributes &amp; Rateable Calculations');
      expect(html).toContain('Clear All Outstanding Dues via Official Payment Methods');
      expect(html).toContain('Immediately Download the Official Payment Receipt');
      expect(html).toContain('Check if the Authority Issues a Separate No-Dues Certificate');
      expect(html).toContain('Submit the No-Dues Request and Supporting Documents');
      expect(html).toContain('Track Verification and Download Signed No-Dues Certificate');
    });
  });

  describe('Required Documents Tab', () => {
    it('renders document checklist with filter buttons and official basis', () => {
      const html = renderToStaticMarkup(<PropertyTaxNoDuesGuide initialTab="documents" />);

      expect(html).toContain('Document Checklist for Municipal Corporation of Delhi (MCD)');
      expect(html).toContain('All Documents');
      expect(html).toContain('Mandatory');
      expect(html).toContain('Conditional');
      expect(html).toContain('UPIC (Unique Property Identification Code) or Property Assessment ID');
      expect(html).toContain('Latest Property Tax Paid Receipt / G8 Challan');
      expect(html).toContain('Government Photo ID of Applicant');
      expect(html).toContain('Registered Sale Deed / Conveyance Deed / Title Deed');
      expect(html).toContain('Why Needed:');
      expect(html).toContain('Official Basis:');
    });
  });

  describe('Records & Date Tracker Tab', () => {
    it('renders informational tracking fields explaining what citizens must retain', () => {
      const html = renderToStaticMarkup(<PropertyTaxNoDuesGuide initialTab="tracking" />);

      expect(html).toContain('Essential Property Tax &amp; No-Dues Milestone Fields');
      expect(html).toContain('Property ID / Assessment Number');
      expect(html).toContain('Assessment Year / Period');
      expect(html).toContain('Tax Due Date');
      expect(html).toContain('Outstanding Principal Tax');
      expect(html).toContain('Accumulated Arrears');
      expect(html).toContain('Penalty / Interest Charges');
      expect(html).toContain('Payment Date');
      expect(html).toContain('Payment Reference / Transaction ID / UTR');
      expect(html).toContain('Payment Receipt Date');
      expect(html).toContain('No-Dues Application Submission Date');
      expect(html).toContain('Application Acknowledgement Date');
      expect(html).toContain('Certificate Issue Date');
      expect(html).toContain('Certificate Validity Date');
    });

    it('renders client-side milestone simulator without server transmission', () => {
      const html = renderToStaticMarkup(<PropertyTaxNoDuesGuide initialTab="tracking" />);

      expect(html).toContain('Client-Side Property Tax Calendar &amp; Grievance Milestone Calculator');
      expect(html).toContain('id="sim-payment-date"');
      expect(html).toContain('Compute Milestones');
    });
  });

  describe('Warnings & Title Caveats Tab', () => {
    it('displays prominent statutory warnings on ownership and regularization', () => {
      const html = renderToStaticMarkup(<PropertyTaxNoDuesGuide initialTab="caveats" />);

      expect(html).toContain('No Proof of Legal Ownership or Title');
      expect(html).toContain('No Regularization of Unauthorized Construction');
      expect(html).toContain('Beware of Fraudulent Payment Portals &amp; Phishing Links');
      expect(html).toContain('Resolution of Trailing Assessment Arrears');
      expect(html).toContain('What Should You Do If Municipal Demands or Receipts Are Delayed or Disputed?');
      expect(html).toContain('Do Not Make Duplicate Payments');
    });
  });

  describe('Citizen FAQs Tab', () => {
    it('renders expandable FAQ accordions with plain-language answers', () => {
      const html = renderToStaticMarkup(<PropertyTaxNoDuesGuide initialTab="faqs" />);

      expect(html).toContain('Frequently Asked Citizen Questions');
      expect(html).toContain('Is a property tax payment receipt the same as a No-Dues Certificate?');
      expect(html).toContain('Does paying property tax make me the legal owner of the property?');
      expect(html).toContain('What should I do if my bank account was debited but no receipt was generated?');
      expect(html).toContain('Can I get a No-Dues Certificate if previous years are under dispute or appeal?');
    });
  });
});
