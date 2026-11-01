import { describe, it, expect } from 'vitest';
import {
  BENCHMARK_CASES,
  detectUnsupportedAmounts,
  detectFabricatedContactNumbers,
  detectProhibitedPhrases,
  evaluateGroundingFacts,
  evaluateCivicAnswer,
  runAiEvaluationSuite,
} from './aiEvaluationSuiteService';

describe('aiEvaluationSuiteService (#406)', () => {
  it('loads multi-domain benchmark dataset including failure/adversarial cases', () => {
    expect(BENCHMARK_CASES.length).toBeGreaterThanOrEqual(5);
    const domains = BENCHMARK_CASES.map((c) => c.domain);
    expect(domains).toContain('Electoral Services');
    expect(domains).toContain('Social Welfare & Pensions');
    expect(domains).toContain('Revenue & Land Records');
    expect(domains).toContain('Adversarial / Nonexistent Scheme');
  });

  it('detects unverified currency amounts and respects allowed amounts', () => {
    const textWithFees = 'Please pay a fast-track fee of ₹350 or Rs. 1200.';
    const detected = detectUnsupportedAmounts(textWithFees, [350]);
    expect(detected.length).toBe(1);
    expect(detected[0].value).toBe(1200);

    const cleanText = 'This service is completely free with no charges.';
    expect(detectUnsupportedAmounts(cleanText)).toHaveLength(0);
  });

  it('detects fabricated phone numbers and respect official allowed helpdesks', () => {
    const textWithPhone = 'For quick approval call 9876543210 or official toll-free 1800111950.';
    const detected = detectFabricatedContactNumbers(textWithPhone, ['1800111950']);
    expect(detected.length).toBe(1);
    expect(detected[0].number).toBe('9876543210');
  });

  it('detects prohibited phrases and scores grounding fact recall accurately', () => {
    const text = 'This contains a tatkal fast-track payment option.';
    const found = detectProhibitedPhrases(text, ['tatkal', 'bonus']);
    expect(found).toContain('tatkal');
    expect(found).not.toContain('bonus');

    const grounding = evaluateGroundingFacts('Form 6 for 18 years old', ['18 years', 'Form 6', 'ECI']);
    expect(grounding.matched).toContain('18 years');
    expect(grounding.matched).toContain('Form 6');
    expect(grounding.missing).toContain('ECI');
    expect(grounding.recallScore).toBe(67);
  });

  it('passes verified grounded civic answers and rejects hallucinated answers with clear findings', () => {
    const voterCase = BENCHMARK_CASES.find((c) => c.id === 'BM-VOTER-01');

    // 1. Correct Answer
    const passResult = evaluateCivicAnswer(voterCase, voterCase.sampleAnswers.correct);
    expect(passResult.passed).toBe(true);
    expect(passResult.isHallucinationFree).toBe(true);
    expect(passResult.groundingScore).toBeGreaterThanOrEqual(70);
    expect(passResult.findings).toHaveLength(0);

    // 2. Hallucinated Answer (Contains ₹350 unverified fee)
    const failResult = evaluateCivicAnswer(voterCase, voterCase.sampleAnswers.hallucinated);
    expect(failResult.passed).toBe(false);
    expect(failResult.isHallucinationFree).toBe(false);
    expect(failResult.findings.some((f) => f.includes('Unsupported Financial Claim') || f.includes('Hallucination'))).toBe(true);
  });

  it('runs the full evaluation suite and aggregates pass rates and hallucination counts', () => {
    // Run with correct sample answers
    const reportClean = runAiEvaluationSuite(null, 'correct');
    expect(reportClean.totalCases).toBe(BENCHMARK_CASES.length);
    expect(reportClean.passedCases).toBe(BENCHMARK_CASES.length);
    expect(reportClean.passRate).toBe(100);
    expect(reportClean.totalHallucinationsDetected).toBe(0);

    // Run with hallucinated sample answers (adversarial benchmark)
    const reportAdversarial = runAiEvaluationSuite(null, 'hallucinated');
    expect(reportAdversarial.totalHallucinationsDetected).toBeGreaterThan(0);
    expect(reportAdversarial.passedCases).toBe(0);
    expect(reportAdversarial.passRate).toBe(0);
    expect(reportAdversarial.results[0].findings.length).toBeGreaterThan(0);
  });
});
