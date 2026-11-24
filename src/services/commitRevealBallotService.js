/**
 * Commit-Reveal Ballot Integrity Service for Ward Budget Polls
 *
 * Implements a test-only commit-reveal polling protocol for non-binding civic polls:
 * - Clear Non-Binding Consultation Disclaimer:
 *   * Explicitly labeled as an advisory consultation, NOT an official or legally binding election
 * - Privacy Preservation:
 *   * Voter identity and chosen ballot options are NEVER published to chain transactions
 *   * In Commit Phase: Citizens publish a cryptographic commitment hash: H(choice + secretSalt)
 *   * In Reveal Phase: Citizens reveal (choice + secretSalt), which is verified against the commitment
 * - Boundary Enforcement:
 *   * Enforces strict chronological start and end windows for Commit and Reveal phases
 *   * Rejects duplicate commitments, early reveals, and late reveals
 *   * Aggregates results transparently with independent verification math
 */

export const POLL_PHASES = Object.freeze({
  NOT_STARTED: 'NOT_STARTED',
  COMMIT_PHASE: 'COMMIT_PHASE',
  REVEAL_PHASE: 'REVEAL_PHASE',
  CLOSED_FINAL: 'CLOSED_FINAL'
});

export const NON_BINDING_DISCLAIMER = Object.freeze(
  'ADVISORY POLL NOTICE: This is a non-binding neighborhood budget consultation poll. ' +
  'It is not a statutory election and carries no legal standing under Election Commission rules.'
);

/**
 * Computes deterministic ballot commitment
 * @param {string} choice Chosen option ID
 * @param {string} salt Secret voter salt
 * @returns {string} Commitment hash
 */
export function generateBallotCommitment(choice = '', salt = '') {
  const serialized = `${choice.trim().toLowerCase()}|${salt.trim()}`;
  let hash = 0;
  for (let i = 0; i < serialized.length; i++) {
    hash = ((hash << 5) - hash) + serialized.charCodeAt(i);
    hash |= 0;
  }
  return `bcmt_${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

export class CommitRevealBallotService {
  constructor(pollConfig = {}) {
    this.pollId = pollConfig.pollId || 'ward_poll_default';
    this.title = pollConfig.title || 'Ward Budget Allocation Preference';
    this.options = pollConfig.options || ['Parks', 'Roads', 'Streetlights', 'Drainage'];
    this.commitStartTime = pollConfig.commitStartTime || 0;
    this.commitEndTime = pollConfig.commitEndTime || 0;
    this.revealEndTime = pollConfig.revealEndTime || 0;

    this.commitments = new Map(); // commitmentHash -> VoterPseudonym
    this.revealedVotes = []; // Array<{ choice, salt }>
    this.tally = {};
    for (const opt of this.options) {
      this.tally[opt.toLowerCase()] = 0;
    }
  }

  /**
   * Evaluates the current poll phase based on timestamp
   * @param {number} currentTime
   * @returns {string} Poll phase
   */
  getPollPhase(currentTime = Date.now()) {
    if (currentTime < this.commitStartTime) return POLL_PHASES.NOT_STARTED;
    if (currentTime <= this.commitEndTime) return POLL_PHASES.COMMIT_PHASE;
    if (currentTime <= this.revealEndTime) return POLL_PHASES.REVEAL_PHASE;
    return POLL_PHASES.CLOSED_FINAL;
  }

  /**
   * Submits a hidden ballot commitment during COMMIT_PHASE
   * @param {string} commitmentHash
   * @param {string} voterPseudonym
   * @param {number} timestamp
   * @returns {Object} Submission verdict
   */
  submitCommitment(commitmentHash, voterPseudonym, timestamp = Date.now()) {
    const phase = this.getPollPhase(timestamp);
    if (phase !== POLL_PHASES.COMMIT_PHASE) {
      throw new Error(`Cannot submit commitment during ${phase}. Commit phase is active from ${new Date(this.commitStartTime).toISOString()} to ${new Date(this.commitEndTime).toISOString()}`);
    }

    if (this.commitments.has(commitmentHash)) {
      throw new Error('Duplicate commitment hash rejected.');
    }

    this.commitments.set(commitmentHash, voterPseudonym);
    return {
      success: true,
      commitmentHash,
      phase,
      disclaimer: NON_BINDING_DISCLAIMER
    };
  }

  /**
   * Reveals a committed vote during REVEAL_PHASE
   * @param {string} choice
   * @param {string} salt
   * @param {number} timestamp
   * @returns {Object} Reveal verdict
   */
  revealBallot(choice, salt, timestamp = Date.now()) {
    const phase = this.getPollPhase(timestamp);
    if (phase !== POLL_PHASES.REVEAL_PHASE) {
      throw new Error(`Cannot reveal ballot during ${phase}. Reveal phase is active until ${new Date(this.revealEndTime).toISOString()}`);
    }

    const normChoice = (choice || '').trim().toLowerCase();
    if (!this.options.some(opt => opt.toLowerCase() === normChoice)) {
      throw new Error(`Invalid ballot choice: ${choice}`);
    }

    const computedCommitment = generateBallotCommitment(normChoice, salt);
    if (!this.commitments.has(computedCommitment)) {
      throw new Error('No matching prior commitment found for this choice and salt combination.');
    }

    // Check if already revealed
    const alreadyRevealed = this.revealedVotes.some(r => r.salt === salt);
    if (alreadyRevealed) {
      throw new Error('This ballot salt has already been revealed.');
    }

    this.revealedVotes.push({ choice: normChoice, salt });
    this.tally[normChoice] = (this.tally[normChoice] || 0) + 1;

    return {
      success: true,
      choice: normChoice,
      currentTally: { ...this.tally }
    };
  }

  /**
   * Returns final certified results
   * @returns {Object} Results summary
   */
  getCertifiedResults() {
    return {
      pollId: this.pollId,
      title: this.title,
      disclaimer: NON_BINDING_DISCLAIMER,
      totalCommitments: this.commitments.size,
      totalRevealed: this.revealedVotes.length,
      unrevealedCount: this.commitments.size - this.revealedVotes.length,
      finalTally: { ...this.tally }
    };
  }
}
