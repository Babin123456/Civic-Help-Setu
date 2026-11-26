import { describe, it, expect, beforeEach } from 'vitest';
import { CivicKnowledgeWatchtowerService } from './civicKnowledgeWatchtowerService.js';

describe('CivicKnowledgeWatchtowerService', () => {
  let watchtower;

  beforeEach(() => {
    watchtower = new CivicKnowledgeWatchtowerService([
      {
        id: 'src_bbmp_trade_licence',
        name: 'BBMP Trade Licence Gazette',
        url: 'https://bbmp.gov.in/notifications/trade-licence-2025.html',
        jurisdictionId: 'IN-KA-BLR',
        lastKnownHash: 'a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef'
      }
    ]);
  });

  it('detects content drift and gates updates behind editorial review', () => {
    const newContent = 'Updated Rule: Penalty for late renewal waived until April 30, 2026.';
    const result = watchtower.processContentCheck('src_bbmp_trade_licence', {
      isSuccess: true,
      content: newContent
    });

    expect(result.status).toBe('CONTENT_DRIFT_PENDING_REVIEW');
    expect(result.driftDetected).toBe(true);
    expect(result.reviewRequired).toBe(true);

    // Source's active hash remains unchanged until editor approval
    const source = watchtower.getSource('src_bbmp_trade_licence');
    expect(source.lastKnownHash).toBe('a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef');
  });

  it('allows editorial review and approval to update the active hash', () => {
    const newContent = 'Amended fees for commercial establishments.';
    const checkResult = watchtower.processContentCheck('src_bbmp_trade_licence', {
      isSuccess: true,
      content: newContent
    });

    const approval = watchtower.approveDriftUpdate(
      'src_bbmp_trade_licence',
      checkResult.proposedHash,
      'Verified with Gazette notification no. 144'
    );

    expect(approval.status).toBe('DRIFT_APPROVED_AND_COMMITTED');
    const source = watchtower.getSource('src_bbmp_trade_licence');
    expect(source.lastKnownHash).toBe(checkResult.proposedHash);
  });

  it('degrades health score upon consecutive network failures', () => {
    watchtower.processContentCheck('src_bbmp_trade_licence', { isSuccess: false, error: 'TIMEOUT_504' });
    watchtower.processContentCheck('src_bbmp_trade_licence', { isSuccess: false, error: 'TIMEOUT_504' });

    const source = watchtower.getSource('src_bbmp_trade_licence');
    const score = watchtower.computeHealthScore(source);
    expect(score).toBeLessThan(50);
  });
});
