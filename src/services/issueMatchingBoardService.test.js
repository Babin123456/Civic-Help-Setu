import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeToken,
  evaluateIssueMatch,
  IssueMatchingBoard,
  DIFFICULTY_LEVELS
} from './issueMatchingBoardService.js';

describe('issueMatchingBoardService', () => {
  describe('normalizeToken', () => {
    it('strips punctuation and converts to lowercase', () => {
      expect(normalizeToken('Good-First-Issue!')).toBe('goodfirstissue');
      expect(normalizeToken('React.js')).toBe('reactjs');
      expect(normalizeToken('')).toBe('');
      expect(normalizeToken(null)).toBe('');
    });
  });

  describe('evaluateIssueMatch', () => {
    const mockIssueA = {
      number: 938,
      title: '[level1] Fix mobile navbar accessibility button contrast',
      labels: ['accessibility', 'good-first-issue', 'ui'],
      body: 'Improve contrast ratio for screen reader citizens'
    };

    const mockIssueB = {
      number: 939,
      title: '[level3] Build advanced distributed cache architecture for grievance records',
      labels: ['level3', 'security', 'architecture'],
      body: 'Scale redis caching with encrypted session keys'
    };

    it('matches beginner accessibility issue with matching preferences', () => {
      const prefs = {
        skills: ['accessibility', 'css'],
        preferredDifficulty: DIFFICULTY_LEVELS.LEVEL_1_BEGINNER,
        domains: ['ui']
      };

      const match = evaluateIssueMatch(mockIssueA, prefs);
      expect(match.matchScore).toBeGreaterThan(50);
      expect(match.recommended).toBe(true);
      expect(match.matchHighlights.some(h => h.includes('accessibility'))).toBe(true);
      expect(match.matchHighlights.some(h => h.includes('Beginner-friendly'))).toBe(true);
    });

    it('matches advanced security issue with advanced preference', () => {
      const prefs = {
        skills: ['security', 'nodejs'],
        preferredDifficulty: DIFFICULTY_LEVELS.LEVEL_3_ADVANCED,
        domains: ['grievance']
      };

      const match = evaluateIssueMatch(mockIssueB, prefs);
      expect(match.matchScore).toBeGreaterThan(40);
      expect(match.recommended).toBe(true);
      expect(match.matchHighlights.some(h => h.includes('security'))).toBe(true);
    });

    it('assigns zero score when there is no skill or domain overlap', () => {
      const prefs = {
        skills: ['rust', 'csharp'],
        domains: ['crypto']
      };

      const match = evaluateIssueMatch(mockIssueA, prefs);
      expect(match.matchScore).toBe(0);
      expect(match.recommended).toBe(false);
    });
  });

  describe('IssueMatchingBoard', () => {
    let board;
    const issues = [
      {
        number: 101,
        title: 'Document civic API endpoints',
        labels: ['documentation', 'good-first-issue'],
        body: 'Write comprehensive guides'
      },
      {
        number: 102,
        title: 'Refactor React grievance state machine',
        labels: ['react', 'level2'],
        body: 'Enhance form validation'
      },
      {
        number: 103,
        title: 'Harden cryptographic signature checks',
        labels: ['security', 'level3'],
        body: 'SLSA attestation'
      }
    ];

    beforeEach(() => {
      board = new IssueMatchingBoard(issues);
    });

    it('returns ranked recommendations prioritized by score', () => {
      const recommendations = board.getRecommendations({
        skills: ['react', 'documentation'],
        preferredDifficulty: DIFFICULTY_LEVELS.LEVEL_2_INTERMEDIATE
      });

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].issueId).toBe(102); // React + Level 2 match
    });
  });
});
