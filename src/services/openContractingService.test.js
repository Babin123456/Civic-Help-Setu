import { describe, it, expect, beforeEach } from 'vitest';
import { openContractingService } from './openContractingService.js';
import { resetOpenContractingData } from './openContractingStorage.js';

describe('openContractingService (#751)', () => {
  beforeEach(() => {
    resetOpenContractingData();
  });

  it('lists notices with category and jurisdiction filtering and pagination', () => {
    const all = openContractingService.listNotices();
    expect(all.total).toBe(5);
    expect(all.notices.length).toBe(5);

    const works = openContractingService.listNotices({ category: 'works' });
    expect(works.total).toBeGreaterThan(0);
    expect(works.notices.every((n) => n.category === 'works')).toBe(true);

    const blr = openContractingService.listNotices({ jurisdiction: 'Bengaluru Urban, Karnataka' });
    expect(blr.total).toBeGreaterThan(0);
    expect(blr.notices.every((n) => n.jurisdiction === 'Bengaluru Urban, Karnataka')).toBe(true);
  });

  it('assembles complete linked procurement lifecycle for a notice', () => {
    const lifecycle = openContractingService.getLinkedProcurementLifecycle('NOT-2026-BLR-001');
    expect(lifecycle).toBeDefined();
    expect(lifecycle.notice.id).toBe('NOT-2026-BLR-001');
    expect(lifecycle.bids.length).toBe(3);
    expect(lifecycle.award).toBeDefined();
    expect(lifecycle.award.vendor.name).toBe('Cauvery Geo-Tech & Drainage Solutions');
    expect(lifecycle.amendments.length).toBe(1);
  });

  it('redacts confidential auditor notes when accessed by citizen role', () => {
    const lifecycle = openContractingService.getLinkedProcurementLifecycle('NOT-2026-BLR-002', 'citizen');
    expect(lifecycle.reviews.length).toBeGreaterThan(0);
    expect(lifecycle.reviews[0].justification).toContain('Reviewed and certified by official oversight auditor.');
    expect(lifecycle.reviews[0].reviewerId).toBeUndefined();
  });

  it('allows auditor to submit review and records tamper-evident audit seal', () => {
    const result = openContractingService.submitAuditReview({
      flagId: 'FLAG-TEST-001',
      noticeId: 'NOT-2026-BLR-001',
      reviewerId: 'AUD-KAR-401',
      reviewerRole: 'auditor',
      disposition: 'marked_false_positive',
      justification: 'Monsoon emergency drain desilting completed under Commissioner sanction with zero cost variation.',
      evidenceDocumentUrl: 'https://bbmp.karnataka.gov.in/proceedings/2026-drain-monsoon.pdf',
    });

    expect(result.status).toBe('persisted');
    expect(result.review.auditSeal).toMatch(/^AUDIT-SEAL-[0-9A-F]{4}-[0-9A-F]{4}$/);

    const auditLogs = openContractingService.getAuditLogs();
    expect(auditLogs.some((l) => l.flagId === 'FLAG-TEST-001')).toBe(true);
  });

  it('rejects audit review attempts by unauthorized citizen role', () => {
    expect(() =>
      openContractingService.submitAuditReview({
        flagId: 'FLAG-TEST-002',
        reviewerRole: 'citizen',
        disposition: 'marked_false_positive',
        justification: 'Valid citizen comment regarding works.',
      })
    ).toThrow(/PERMISSION_DENIED/);
  });

  it('queues review actions when offline and syncs them upon reconnection', () => {
    const offlineResult = openContractingService.submitAuditReview({
      flagId: 'FLAG-OFFLINE-001',
      noticeId: 'NOT-2026-BLR-001',
      reviewerId: 'AUD-KAR-401',
      reviewerRole: 'auditor',
      disposition: 'under_investigation',
      justification: 'Investigating anomalous amendment pattern during site inspection.',
      isOffline: true,
    });

    expect(offlineResult.status).toBe('queued_offline');

    const syncResult = openContractingService.syncOfflineQueue();
    expect(syncResult.syncedCount).toBe(1);
  });

  it('exports an audit dossier with public role redaction', () => {
    const dossier = openContractingService.exportAuditDossier({ userRole: 'citizen' });
    expect(dossier.summary.totalNotices).toBe(5);
    expect(dossier.provenance.rulesetVersion).toBeDefined();
    expect(dossier.auditReviews.every((r) => r.reviewerId === undefined)).toBe(true);
  });
});
