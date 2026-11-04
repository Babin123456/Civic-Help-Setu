import { describe, it, expect } from 'vitest';
import {
  inspectDocumentReadability,
  SUPPORTED_IMAGE_TYPES,
  DOCUMENT_MARKER_TEMPLATES,
} from './documentQualityOcrInspectionService.js';

describe('documentQualityOcrInspectionService', () => {
  const cleanAadhaarText = 'Government of India Unique Identification Authority of India 1234 5678 9012 DOB: 15/08/1990 Resident Name';

  it('refuses inspection when user consent is not granted', () => {
    const report = inspectDocumentReadability({
      fileOrMetadata: { type: 'image/jpeg', size: 150000 },
      documentType: 'aadhaar',
      hasUserConsent: false,
    });

    expect(report.success).toBe(false);
    expect(report.status).toBe('CONSENT_REQUIRED');
    expect(report.error).toContain('explicit citizen consent');
  });

  it('handles clean, sharp document with all markers verified', () => {
    const report = inspectDocumentReadability({
      fileOrMetadata: { type: 'image/jpeg', size: 250000 },
      documentType: 'aadhaar',
      hasUserConsent: true,
      extractedTextMock: cleanAadhaarText,
      qualityMetricsOverride: {
        isBlurry: false,
        hasGlare: false,
        isLowContrast: false,
        isCutOff: false,
        sharpnessScore: 92,
        contrastScore: 88,
      },
    });

    expect(report.success).toBe(true);
    expect(report.status).toBe('PASSED');
    expect(report.readabilityScore).toBeGreaterThanOrEqual(90);
    expect(report.isReadable).toBe(true);
    expect(report.issuesDetected.length).toBe(0);
    expect(report.markerChecklist.every((m) => m.verified)).toBe(true);
    expect(report.privacyScrubbed).toBe(true);
  });

  it('detects blurry image and provides camera steadying guidance', () => {
    const report = inspectDocumentReadability({
      fileOrMetadata: { type: 'image/jpeg', size: 150000 },
      documentType: 'aadhaar',
      hasUserConsent: true,
      extractedTextMock: cleanAadhaarText,
      qualityMetricsOverride: {
        isBlurry: true,
        hasGlare: false,
        isLowContrast: false,
        isCutOff: false,
        sharpnessScore: 40,
      },
    });

    expect(report.success).toBe(true);
    expect(report.readabilityScore).toBeLessThan(75);
    const blurIssue = report.issuesDetected.find((i) => i.category === 'BLUR');
    expect(blurIssue).toBeDefined();
    expect(report.retakeGuidance.some((tip) => tip.includes('Hold your mobile phone with both hands'))).toBe(true);
  });

  it('detects glare and provides flash avoidance tips', () => {
    const report = inspectDocumentReadability({
      fileOrMetadata: { type: 'image/png', size: 200000 },
      documentType: 'pan',
      hasUserConsent: true,
      extractedTextMock: 'Income Tax Department Govt. of India ABCDE1234F Date of Birth: 01/01/1985',
      qualityMetricsOverride: {
        isBlurry: false,
        hasGlare: true,
        isLowContrast: false,
        isCutOff: false,
      },
    });

    expect(report.success).toBe(true);
    const glareIssue = report.issuesDetected.find((i) => i.category === 'GLARE');
    expect(glareIssue).toBeDefined();
    expect(report.retakeGuidance.some((tip) => tip.includes('Turn off camera flash'))).toBe(true);
  });

  it('detects cut off borders and missing markers', () => {
    const report = inspectDocumentReadability({
      fileOrMetadata: { type: 'image/jpeg', size: 200000 },
      documentType: 'pan',
      hasUserConsent: true,
      extractedTextMock: 'Partial scan with no valid pan format',
      qualityMetricsOverride: {
        isBlurry: false,
        hasGlare: false,
        isLowContrast: false,
        isCutOff: true,
      },
    });

    expect(report.success).toBe(true);
    expect(report.readabilityScore).toBeLessThan(60);
    const cutOffIssue = report.issuesDetected.find((i) => i.category === 'CUTOFF');
    expect(cutOffIssue).toBeDefined();
    const missingMarkerIssue = report.issuesDetected.find((i) => i.category === 'MISSING_MARKERS');
    expect(missingMarkerIssue).toBeDefined();
  });

  it('rejects unreadable images with both blur and glare', () => {
    const report = inspectDocumentReadability({
      fileOrMetadata: { type: 'image/jpeg', size: 20000 },
      documentType: 'general',
      hasUserConsent: true,
      extractedTextMock: '',
      qualityMetricsOverride: {
        isBlurry: true,
        hasGlare: true,
        isLowContrast: true,
        isCutOff: true,
      },
    });

    expect(report.success).toBe(true);
    expect(report.status).toBe('REJECTED_UNREADABLE');
    expect(report.isReadable).toBe(false);
  });

  it('handles unsupported file formats gracefully', () => {
    const report = inspectDocumentReadability({
      fileOrMetadata: { type: 'application/zip', size: 50000 },
      hasUserConsent: true,
    });

    expect(report.success).toBe(false);
    expect(report.status).toBe('UNSUPPORTED_FORMAT');
    expect(report.error).toContain('Unsupported format');
    expect(report.retakeGuidance.length).toBeGreaterThan(0);
  });

  it('handles missing input safely', () => {
    const report = inspectDocumentReadability({ hasUserConsent: true });
    expect(report.success).toBe(false);
    expect(report.status).toBe('INVALID_INPUT');
  });

  it('exports templates for standard civic documents', () => {
    expect(DOCUMENT_MARKER_TEMPLATES.aadhaar).toBeDefined();
    expect(DOCUMENT_MARKER_TEMPLATES.pan).toBeDefined();
    expect(DOCUMENT_MARKER_TEMPLATES.driving_license).toBeDefined();
    expect(DOCUMENT_MARKER_TEMPLATES.voter_id).toBeDefined();
    expect(SUPPORTED_IMAGE_TYPES).toContain('image/jpeg');
  });
});
