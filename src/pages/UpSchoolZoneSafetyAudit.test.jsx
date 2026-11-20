import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import UpSchoolZoneSafetyAudit from './UpSchoolZoneSafetyAudit';
import SchoolZoneSafetyHeader from '../components/schoolZoneSafety/SchoolZoneSafetyHeader';
import SchoolZoneAuditFeed from '../components/schoolZoneSafety/SchoolZoneAuditFeed';
import SchoolZoneDirectoryTable from '../components/schoolZoneSafety/SchoolZoneDirectoryTable';
import SchoolZoneAuditModal from '../components/schoolZoneSafety/SchoolZoneAuditModal';
import SchoolZoneStatusTrackerModal from '../components/schoolZoneSafety/SchoolZoneStatusTrackerModal';
import SmcPrintableAuditModal from '../components/schoolZoneSafety/SmcPrintableAuditModal';
import { SEED_UP_SCHOOL_ZONES, SEED_UP_SCHOOL_AUDITS } from '../data/upSchoolZoneSafetySeed';
import {
  NON_LEGAL_FAULT_DISCLAIMER,
} from '../data/upSchoolZoneSafetyContract';

describe('UpSchoolZoneSafetyAudit Page & UI Components (#984)', () => {
  let mockStore;

  beforeEach(() => {
    mockStore = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key) => (mockStore.has(key) ? mockStore.get(key) : null),
      setItem: (key, val) => mockStore.set(key, String(val)),
      removeItem: (key) => mockStore.delete(key),
      clear: () => mockStore.clear(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const renderPage = () => {
    return renderToStaticMarkup(
      <MemoryRouter>
        <UpSchoolZoneSafetyAudit />
      </MemoryRouter>
    );
  };

  it('renders page header, pilot banner, metrics, and default feed', () => {
    const html = renderPage();

    expect(html).toContain('School-Zone Road Safety Audit System');
    expect(html).toContain('Uttar Pradesh Pilot Initiative:');
    expect(html).toContain('Registered School Zones');
    expect(html).toContain('Reported Active Hazards');
    expect(html).toContain('Conduct Safety Audit');
    expect(html).toContain('Export SMC Audit Dossier');

    // Default tab
    expect(html).toContain('Audit Reports &amp; Live Feed');
    expect(html).toContain('Government Girls Inter College (GGIC), Shahmina Road');
    expect(html).toContain('UDISE: 09300501201');
  });

  it('renders SchoolZoneSafetyHeader with scope and filter controls', () => {
    const html = renderToStaticMarkup(
      <SchoolZoneSafetyHeader
        stats={{ totalSchools: 5, activeHazards: 3, inProgress: 2, resolved: 1 }}
        searchQuery=""
        onSearchChange={() => {}}
        selectedDistrict=""
        onDistrictChange={() => {}}
        selectedLocationType=""
        onLocationTypeChange={() => {}}
        selectedHazardType=""
        onHazardTypeChange={() => {}}
        selectedStatus=""
        onStatusChange={() => {}}
        selectedAuthority=""
        onAuthorityChange={() => {}}
        onOpenAuditModal={() => {}}
        onOpenSmcExportModal={() => {}}
        activeTab="audits"
        onTabChange={() => {}}
      />
    );

    expect(html).toContain('IRC:SP:88 &amp; RTE Act Sec 21 Compliant');
    expect(html).toContain('All Hazard Categories');
    expect(html).toContain('All Road Authorities');
    expect(html).toContain('All Statuses');
    expect(html).toContain('Urban Municipal');
    expect(html).toContain('Rural Link Approach');
  });

  it('renders SchoolZoneAuditFeed with privacy redaction and authority tags', () => {
    const html = renderToStaticMarkup(
      <SchoolZoneAuditFeed
        audits={SEED_UP_SCHOOL_AUDITS}
        onSelectAuditForTracking={() => {}}
        onEndorseAudit={() => {}}
        onOpenSmcExportForSchool={() => {}}
      />
    );

    expect(html).toContain('AC-2 Privacy Redacted: Faces &amp; Plates Blurred');
    expect(html).toContain('Assigned Road Authority:');
    expect(html).toContain('Uttar Pradesh Public Works Department (UP PWD)');
    expect(html).toContain('Reviewed UP PWD Major District Road Directory');
    expect(html).toContain('Track Lifecycle');
    expect(html).toContain('Co-sign');
  });

  it('renders SchoolZoneDirectoryTable with UDISE codes and verified entrance gates', () => {
    const html = renderToStaticMarkup(
      <SchoolZoneDirectoryTable
        schools={SEED_UP_SCHOOL_ZONES}
        onConductAuditForSchool={() => {}}
        onExportSmcForSchool={() => {}}
      />
    );

    expect(html).toContain('09300501201');
    expect(html).toContain('09300401503');
    expect(html).toContain('Mohanlalganj Block');
    expect(html).toContain('Main Gate - North Frontage');
    expect(html).toContain('Kurauni-Mohanlalganj Rural Link Road');
  });

  it('renders SchoolZoneAuditModal with non-legal-fault disclaimer and privacy notice', () => {
    const html = renderToStaticMarkup(
      <SchoolZoneAuditModal
        isOpen={true}
        onClose={() => {}}
        schoolZones={SEED_UP_SCHOOL_ZONES}
        onSubmitAudit={() => {}}
      />
    );

    expect(html).toContain('Conduct School-Zone Road Safety Audit');
    expect(html).toContain('Select Government School (UDISE+ Registered)');
    expect(html).toContain('Hazard Dimension / Infrastructure Deficiency');
    expect(html).toContain('Road Ownership Jurisdiction Routing');
    expect(html).toContain('Civil Observation Notice:');
    expect(html).toContain(NON_LEGAL_FAULT_DISCLAIMER);
  });

  it('renders SchoolZoneStatusTrackerModal enforcing lifecycle stage progression', () => {
    const targetAudit = SEED_UP_SCHOOL_AUDITS[0];
    const html = renderToStaticMarkup(
      <SchoolZoneStatusTrackerModal
        isOpen={true}
        onClose={() => {}}
        audit={targetAudit}
        onUpdateStatus={() => {}}
      />
    );

    expect(html).toContain('Safety Audit Lifecycle Tracker');
    expect(html).toContain('Statutory Resolution Audit Trail');
    expect(html).toContain('Advance Lifecycle Stage');
    expect(html).toContain('Site Inspection Completed');
  });

  it('renders SmcPrintableAuditModal formatted for RTE Section 21 statutory compliance', () => {
    const html = renderToStaticMarkup(
      <SmcPrintableAuditModal
        isOpen={true}
        onClose={() => {}}
        schoolZones={SEED_UP_SCHOOL_ZONES}
        audits={SEED_UP_SCHOOL_AUDITS}
        initialSchoolId="SCH-UP-LKO-001"
      />
    );

    expect(html).toContain('STATUTORY SCHOOL-ZONE ROAD SAFETY AUDIT DOSSIER');
    expect(html).toContain('Section 21 of the Right of Children to Free and Compulsory Education (RTE) Act');
    expect(html).toContain('Government Girls Inter College (GGIC), Shahmina Road');
    expect(html).toContain('1. Verified Entrance Gates &amp; Road Frontage Geometry');
    expect(html).toContain('2. Documented Road Safety Hazards &amp; Infrastructure Deficiencies');
    expect(html).toContain('3. Recommended SMC Resolutions &amp; Authority Submissions');
    expect(html).toContain('SMC Chairperson / Parent Representative');
    expect(html).toContain('Head Teacher / Principal');
    expect(html).toContain('Ward Junior Engineer / Traffic Nodal Officer');
    expect(html).toContain('Print Dossier');
  });
});
