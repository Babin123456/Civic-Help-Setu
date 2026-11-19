import { describe, it, expect, beforeEach } from 'vitest';
import {
  isDataStale,
  resolveJurisdiction,
  getLicencesByTrack,
  getAmendmentRequirements,
  getSuspensionRequirements,
  getClosureWorkflow,
  calculateExpiryStatus,
  generateICalendarEvent,
  createEstablishmentProfile,
  getEstablishmentProfiles,
  getEstablishmentProfileById,
  updateEstablishmentProfile,
  deleteEstablishmentProfile,
  toggleChecklistItem,
  getEstablishmentProgress,
  resetEstablishmentProgress,
  sanitizeLicenceDataForExport,
  sanitizeAndRedactText,
  submitCorrectionProposal,
  getCorrectionProposals,
  reviewCorrectionProposal,
  _resetInternalStores
} from './smallBusinessLicenceService.js';

describe('smallBusinessLicenceService (#721)', () => {
  beforeEach(() => {
    _resetInternalStores();
  });

  describe('Jurisdiction Resolution & Anti-Assumption Fallback', () => {
    it('resolves verified municipal body for Delhi (MCD)', () => {
      const res = resolveJurisdiction('DELHI_MCD');
      expect(res.isSupported).toBe(true);
      expect(res.status).toBe('VERIFIED');
      expect(res.authorityName).toContain('Municipal Corporation of Delhi');
      expect(res.portalUrl).toBe('https://mcdonline.nic.in');
      expect(res.statutoryAct).toContain('Delhi Municipal Corporation Act');
      expect(res.disclaimer).toBeDefined();
    });

    it('resolves verified municipal body for Mumbai (BMC)', () => {
      const res = resolveJurisdiction('MAHARASHTRA_MUMBAI');
      expect(res.isSupported).toBe(true);
      expect(res.authorityName).toContain('Brihanmumbai Municipal Corporation');
      expect(res.statutoryAct).toContain('Mumbai Municipal Corporation Act');
    });

    it('returns explicit UNAVAILABLE_OR_UNVERIFIED for unlisted jurisdictions without guessing', () => {
      const res = resolveJurisdiction('UNKNOWN_TEHSIL_ULB');
      expect(res.isSupported).toBe(false);
      expect(res.status).toBe('UNAVAILABLE_OR_UNVERIFIED');
      expect(res.portalUrl).toBeNull();
      expect(res.recommendedAction).toContain('have not been verified against a dated municipal gazette');
    });
  });

  describe('Data Staleness Detection (180-Day Horizon)', () => {
    it('flags records older than 180 days as stale', () => {
      const staleRecord = { verificationTimestamp: '2020-01-01' };
      expect(isDataStale(staleRecord, 180)).toBe(true);
    });

    it('considers recently verified records fresh', () => {
      const freshRecord = { verificationTimestamp: new Date().toISOString() };
      expect(isDataStale(freshRecord, 180)).toBe(false);
    });

    it('treats missing or invalid timestamps as stale', () => {
      expect(isDataStale({})).toBe(true);
      expect(isDataStale({ verificationTimestamp: 'invalid-date' })).toBe(true);
    });
  });

  describe('Dual-Track Licence Filtering', () => {
    it('returns only municipal licences when track is MUNICIPAL', () => {
      const licences = getLicencesByTrack('MUNICIPAL');
      expect(licences.length).toBeGreaterThan(0);
      expect(licences.every((l) => l.track === 'MUNICIPAL')).toBe(true);
      expect(licences.some((l) => l.key === 'municipal_trade_licence')).toBe(true);
    });

    it('returns only sector-specific licences when track is SECTOR_SPECIFIC', () => {
      const licences = getLicencesByTrack('SECTOR_SPECIFIC');
      expect(licences.length).toBeGreaterThan(0);
      expect(licences.every((l) => l.track === 'SECTOR_SPECIFIC')).toBe(true);
      expect(licences.some((l) => l.key === 'shops_establishment_registration')).toBe(true);
      expect(licences.some((l) => l.key === 'fssai_licence_registration')).toBe(true);
    });

    it('filters licences based on business category applicability', () => {
      const foodLicences = getLicencesByTrack('ALL', 'FOOD_BEVERAGE');
      expect(foodLicences.some((l) => l.key === 'fssai_licence_registration')).toBe(true);
      expect(foodLicences.some((l) => l.key === 'health_trade_licence')).toBe(true);

      const servicesLicences = getLicencesByTrack('ALL', 'SERVICES');
      expect(servicesLicences.some((l) => l.key === 'fssai_licence_registration')).toBe(false);
      expect(servicesLicences.some((l) => l.key === 'shops_establishment_registration')).toBe(true);
    });
  });

  describe('Lifecycle Requirements: Amendment, Suspension, Closure', () => {
    it('returns comprehensive evidence requirements for Address Change', () => {
      const req = getAmendmentRequirements('ADDRESS_CHANGE');
      expect(req.title).toContain('Premises / Relocation');
      expect(req.evidenceChecklist.some((i) => i.id === 'new_registered_lease_or_deed')).toBe(true);
      expect(req.evidenceChecklist.some((i) => i.id === 'landlord_noc')).toBe(true);
      expect(req.evidenceChecklist.some((i) => i.id === 'new_electricity_bill')).toBe(true);
    });

    it('returns comprehensive evidence requirements for Ownership / Constitution Change', () => {
      const req = getAmendmentRequirements('OWNERSHIP_CONSTITUTION_CHANGE');
      expect(req.title).toContain('Ownership, Partners or Business Constitution');
      expect(req.evidenceChecklist.some((i) => i.id === 'partnership_deed_or_mca_certificate')).toBe(true);
      expect(req.evidenceChecklist.some((i) => i.id === 'transfer_indemnity_bond')).toBe(true);
      expect(req.evidenceChecklist.some((i) => i.id === 'pan_card_transferee')).toBe(true);
    });

    it('returns structured suspension checkpoints including written notice and labour compliance', () => {
      const suspension = getSuspensionRequirements();
      expect(suspension.checkpoints.some((c) => c.id === 'written_intimation')).toBe(true);
      expect(suspension.checkpoints.some((c) => c.id === 'labour_retrenchment_compliance')).toBe(true);
    });

    it('provides 3-phase closure workflow with mandatory surrender acknowledgement retention', () => {
      const closure = getClosureWorkflow();
      expect(closure.workflowPhases).toHaveLength(3);
      expect(closure.workflowPhases[0].stepId).toBe('FINAL_DUES_CLEARANCE');
      expect(closure.workflowPhases[1].stepId).toBe('FORMAL_SURRENDER_FILING');
      expect(closure.workflowPhases[2].stepId).toBe('SURRENDER_ACKNOWLEDGEMENT_RETAINER');
      expect(closure.mandatoryRetainerNote).toContain('minimum of 7 years');
    });
  });

  describe('Multi-Establishment Profile Management & Progress', () => {
    it('creates, retrieves, updates, and deletes establishment profiles', () => {
      const profile = createEstablishmentProfile({
        establishmentName: 'Connaught Bakeries',
        category: 'FOOD_BEVERAGE',
        jurisdictionKey: 'DELHI_MCD',
        municipalWard: 'Ward 45 Central',
        selectedLicenceKeys: ['municipal_trade_licence', 'fssai_licence_registration'],
        reminderOffsetDays: 60
      });

      expect(profile.id).toBeDefined();
      expect(profile.establishmentName).toBe('Connaught Bakeries');
      expect(profile.selectedLicenceKeys).toHaveLength(2);

      const all = getEstablishmentProfiles();
      expect(all).toHaveLength(1);

      const found = getEstablishmentProfileById(profile.id);
      expect(found.category).toBe('FOOD_BEVERAGE');

      const updated = updateEstablishmentProfile(profile.id, {
        establishmentName: 'Connaught Artisan Bakeries'
      });
      expect(updated.establishmentName).toBe('Connaught Artisan Bakeries');

      // Toggle checklist item
      toggleChecklistItem(profile.id, 'task_fssai_annual_fee');
      const progress = getEstablishmentProgress(profile.id);
      expect(progress.task_fssai_annual_fee).toBe(true);

      // Delete establishment
      deleteEstablishmentProfile(profile.id);
      expect(getEstablishmentProfiles()).toHaveLength(0);
      expect(getEstablishmentProgress(profile.id)).toEqual({});
    });

    it('resets checklist progress without deleting profile', () => {
      const profile = createEstablishmentProfile({ establishmentName: 'Test Shop' });
      toggleChecklistItem(profile.id, 'task_1');
      expect(getEstablishmentProgress(profile.id).task_1).toBe(true);

      resetEstablishmentProgress(profile.id);
      expect(getEstablishmentProgress(profile.id)).toEqual({});
    });
  });

  describe('Expiry Status Calculation & Calendar (.ics) Generation', () => {
    it('identifies expired, critical, due soon, and active statuses correctly', () => {
      const yesterday = new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0];
      const expired = calculateExpiryStatus(yesterday, 30);
      expect(expired.status).toBe('EXPIRED');
      expect(expired.isRenewalDue).toBe(true);

      const in3Days = new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0];
      const critical = calculateExpiryStatus(in3Days, 30);
      expect(critical.status).toBe('CRITICAL');
      expect(critical.isRenewalDue).toBe(true);

      const in20Days = new Date(Date.now() + 86400000 * 20).toISOString().split('T')[0];
      const dueSoon = calculateExpiryStatus(in20Days, 30);
      expect(dueSoon.status).toBe('DUE_SOON');
      expect(dueSoon.isRenewalDue).toBe(true);

      const in90Days = new Date(Date.now() + 86400000 * 90).toISOString().split('T')[0];
      const active = calculateExpiryStatus(in90Days, 30);
      expect(active.status).toBe('ACTIVE');
      expect(active.isRenewalDue).toBe(false);
    });

    it('generates valid RFC 5545 iCalendar event content', () => {
      const futureDate = '2027-03-31';
      const ics = generateICalendarEvent({
        title: 'Municipal Trade Licence',
        description: 'Annual renewal for Delhi shop',
        expiryDateStr: futureDate
      });

      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('VERSION:2.0');
      expect(ics).toContain('BEGIN:VEVENT');
      expect(ics).toContain('DTSTART;VALUE=DATE:20270331');
      expect(ics).toContain('SUMMARY:Municipal Trade Licence Expiry Deadline');
      expect(ics).toContain('END:VCALENDAR');
    });
  });

  describe('Privacy & Zero-PII Sanitization', () => {
    it('redacts PAN, GSTIN, Aadhaar, phone numbers, and emails from notes and text', () => {
      const dirtyText =
        'Contact Ramesh at 9876543210 or email ramesh.shop@gmail.com. GSTIN is 07AAAAA0000A1Z5 and PAN is ABCDE1234F. Aadhaar: 2345 6789 0123.';
      const clean = sanitizeAndRedactText(dirtyText);

      expect(clean).not.toContain('9876543210');
      expect(clean).not.toContain('ramesh.shop@gmail.com');
      expect(clean).not.toContain('07AAAAA0000A1Z5');
      expect(clean).not.toContain('ABCDE1234F');
      expect(clean).not.toContain('2345 6789 0123');

      expect(clean).toContain('[REDACTED_PHONE]');
      expect(clean).toContain('[REDACTED_EMAIL]');
      expect(clean).toContain('[REDACTED_GSTIN]');
      expect(clean).toContain('[REDACTED_PAN]');
      expect(clean).toContain('[REDACTED_AADHAAR]');
    });

    it('produces safe privacy-scrubbed export summary', () => {
      const est = {
        category: 'RETAIL',
        jurisdictionKey: 'DELHI_MCD',
        municipalWard: 'Ward 10 South',
        selectedLicenceKeys: ['municipal_trade_licence']
      };
      const progress = { task_1: true, task_2: false };
      const exported = sanitizeLicenceDataForExport(est, progress);

      expect(exported.exportVersion).toBe('1.0');
      expect(exported.establishmentSummary.municipalWard).toBe('[REDACTED_WARD]');
      expect(exported.completedTasksCount).toBe(1);
      expect(exported.completedTasks).toContain('task_1');
      expect(exported.disclaimer).toBeDefined();
    });
  });

  describe('Community Correction Proposals & Moderator Review', () => {
    it('submits valid proposal and rejects invalid URLs', () => {
      const proposal = submitCorrectionProposal({
        jurisdictionKey: 'DELHI_MCD',
        licenceKey: 'municipal_trade_licence',
        stage: 'RENEWAL',
        officialSourceUrl: 'https://mcdonline.nic.in/gazette-2026',
        notes: 'Updated late fee policy for FY 2026-27'
      });

      expect(proposal.id).toBeDefined();
      expect(proposal.status).toBe('PENDING_REVIEW');

      expect(() => {
        submitCorrectionProposal({
          jurisdictionKey: 'DELHI_MCD',
          officialSourceUrl: 'ftp://invalidsource.com'
        });
      }).toThrow('HTTP or HTTPS');
    });

    it('allows moderator to review, approve or reject proposals', () => {
      const p = submitCorrectionProposal({
        jurisdictionKey: 'KARNATAKA_BENGALURU',
        officialSourceUrl: 'https://bbmp.gov.in/circular',
        notes: 'Fee structure amended'
      });

      const reviewed = reviewCorrectionProposal(p.id, {
        status: 'APPROVED',
        adminNotes: 'Verified against notification dated 01 Nov 2026'
      });

      expect(reviewed.status).toBe('APPROVED');
      expect(reviewed.adminNotes).toContain('Verified against notification');

      const all = getCorrectionProposals();
      expect(all.find((item) => item.id === p.id).status).toBe('APPROVED');
    });
  });
});

