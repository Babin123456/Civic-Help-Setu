import { describe, it, expect, beforeEach } from 'vitest';
import {
  CommitRevealBallotService,
  generateBallotCommitment,
  POLL_PHASES,
  NON_BINDING_DISCLAIMER
} from './commitRevealBallotService.js';

describe('commitRevealBallotService', () => {
  const tCommitStart = 1000;
  const tCommitEnd = 2000;
  const tRevealEnd = 3000;

  describe('generateBallotCommitment', () => {
    it('generates consistent deterministic commitment hashes prefixed with bcmt_', () => {
      const c1 = generateBallotCommitment('Parks', 'secret_salt_1');
      const c2 = generateBallotCommitment('Parks', 'secret_salt_1');
      const c3 = generateBallotCommitment('Roads', 'secret_salt_1');

      expect(c1).toBe(c2);
      expect(c1).toMatch(/^bcmt_[a-f0-9]{8}$/);
      expect(c1).not.toBe(c3);
    });
  });

  describe('CommitRevealBallotService', () => {
    let service;

    beforeEach(() => {
      service = new CommitRevealBallotService({
        pollId: 'poll_ward_71',
        options: ['Parks', 'Roads', 'Streetlights'],
        commitStartTime: tCommitStart,
        commitEndTime: tCommitEnd,
        revealEndTime: tRevealEnd
      });
    });

    it('identifies phases accurately based on timestamp', () => {
      expect(service.getPollPhase(500)).toBe(POLL_PHASES.NOT_STARTED);
      expect(service.getPollPhase(1500)).toBe(POLL_PHASES.COMMIT_PHASE);
      expect(service.getPollPhase(2500)).toBe(POLL_PHASES.REVEAL_PHASE);
      expect(service.getPollPhase(3500)).toBe(POLL_PHASES.CLOSED_FINAL);
    });

    it('rejects commitment submissions outside the commit window', () => {
      const commitment = generateBallotCommitment('Parks', 'salt_a');
      expect(() => {
        service.submitCommitment(commitment, 'voter_1', 2500); // During reveal phase
      }).toThrow(/Cannot submit commitment during REVEAL_PHASE/);
    });

    it('rejects duplicate commitments in commit phase', () => {
      const commitment = generateBallotCommitment('Parks', 'salt_a');
      service.submitCommitment(commitment, 'voter_1', 1500);

      expect(() => {
        service.submitCommitment(commitment, 'voter_2', 1600);
      }).toThrow(/Duplicate commitment hash rejected/);
    });

    it('successfully commits, reveals, and tallies votes', () => {
      const salt1 = 'salt_alpha';
      const c1 = generateBallotCommitment('Parks', salt1);
      service.submitCommitment(c1, 'voter_1', 1500);

      const salt2 = 'salt_beta';
      const c2 = generateBallotCommitment('Roads', salt2);
      service.submitCommitment(c2, 'voter_2', 1500);

      // Reveal phase (t = 2500)
      const r1 = service.revealBallot('Parks', salt1, 2500);
      expect(r1.success).toBe(true);
      expect(r1.currentTally.parks).toBe(1);

      const r2 = service.revealBallot('Roads', salt2, 2500);
      expect(r2.success).toBe(true);
      expect(r2.currentTally.roads).toBe(1);

      const results = service.getCertifiedResults();
      expect(results.totalCommitments).toBe(2);
      expect(results.totalRevealed).toBe(2);
      expect(results.unrevealedCount).toBe(0);
      expect(results.disclaimer).toBe(NON_BINDING_DISCLAIMER);
    });

    it('rejects reveals with mismatched salt or uncommitted choices', () => {
      const c = generateBallotCommitment('Parks', 'real_salt');
      service.submitCommitment(c, 'voter_1', 1500);

      expect(() => {
        service.revealBallot('Parks', 'fake_salt', 2500);
      }).toThrow(/No matching prior commitment found/);
    });
  });
});
