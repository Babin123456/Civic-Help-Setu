import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkIssueReferences,
  scanForSensitiveFiles,
  checkSupportingFiles,
  PrReadinessMentor
} from './prReadinessMentorService.js';

describe('prReadinessMentorService', () => {
  describe('checkIssueReferences', () => {
    it('detects standard closing issue keywords in title or body', () => {
      const res1 = checkIssueReferences('feat: add dark mode', 'Closes #939 and fixes #940');
      expect(res1.hasClosingReference).toBe(true);
      expect(res1.matchedIssues).toEqual([939, 940]);
      expect(res1.feedback).toContain('Found valid closing reference');

      const res2 = checkIssueReferences('fix(a11y): button contrast (resolves #102)');
      expect(res2.hasClosingReference).toBe(true);
      expect(res2.matchedIssues).toEqual([102]);
    });

    it('warns when no issue reference is provided', () => {
      const res = checkIssueReferences('misc updates', 'some small styling changes');
      expect(res.hasClosingReference).toBe(false);
      expect(res.matchedIssues).toEqual([]);
      expect(res.feedback).toContain('Please include "Closes #XYZ"');
    });
  });

  describe('scanForSensitiveFiles', () => {
    it('approves pull requests with clean file lists', () => {
      const files = ['src/components/Header.jsx', 'src/services/api.js', 'docs/guide.md'];
      const res = scanForSensitiveFiles(files);
      expect(res.clean).toBe(true);
      expect(res.leakingFiles).toEqual([]);
    });

    it('flags dangerous environment and key files immediately', () => {
      const files = ['src/index.js', '.env.local', 'serviceAccountKey.json'];
      const res = scanForSensitiveFiles(files);
      expect(res.clean).toBe(false);
      expect(res.leakingFiles).toEqual(['.env.local', 'serviceAccountKey.json']);
      expect(res.feedback).toContain('High risk: Detected sensitive files');
    });
  });

  describe('checkSupportingFiles', () => {
    it('detects presence of test files and markdown documentation', () => {
      const files = ['src/services/auth.js', 'src/services/auth.test.js', 'docs/auth.md'];
      const res = checkSupportingFiles(files);
      expect(res.hasTests).toBe(true);
      expect(res.hasDocs).toBe(true);
    });

    it('returns guidance when tests or documentation are absent', () => {
      const files = ['src/services/auth.js'];
      const res = checkSupportingFiles(files);
      expect(res.hasTests).toBe(false);
      expect(res.hasDocs).toBe(false);
      expect(res.testFeedback).toContain('Notice: No unit or integration test');
    });
  });

  describe('PrReadinessMentor', () => {
    let mentor;

    beforeEach(() => {
      mentor = new PrReadinessMentor();
    });

    it('scores full readiness when PR satisfies all criteria', () => {
      const report = mentor.evaluateReadiness({
        title: 'feat: add mentor service',
        body: 'Closes #939',
        modifiedFiles: [
          'src/services/prReadinessMentorService.js',
          'src/services/prReadinessMentorService.test.js',
          'docs/pr-readiness-mentor.md'
        ]
      });

      expect(report.score).toBe(100);
      expect(report.readyForReview).toBe(true);
      expect(report.actionItems.length).toBe(0);
      expect(report.mentorNote).toContain('ready for maintainer review');
    });

    it('blocks review readiness if sensitive files are committed', () => {
      const report = mentor.evaluateReadiness({
        title: 'feat: add secret setup',
        body: 'Closes #939',
        modifiedFiles: ['.env', 'src/services/auth.test.js']
      });

      expect(report.readyForReview).toBe(false);
      expect(report.checks.sensitiveFiles.clean).toBe(false);
    });
  });
});
