import { describe, it, expect } from 'vitest';
import {
  analyzeDocumentDifferences,
  generateComparisonMarkdown,
  generateComparisonPlainText,
} from './serviceComparisonExportService.js';

describe('serviceComparisonExportService (#436)', () => {
  const serviceA = {
    id: 'passport-normal',
    name: 'Normal Passport',
    department: 'MEA',
    category: 'Identity',
    fees: '₹1500',
    timeRequired: '30 days',
    documents: ['Aadhaar Card', 'Birth Certificate', 'Proof of Address'],
    eligibility: ['Indian Citizen', 'Valid Age'],
    officialUrl: 'https://passportindia.gov.in',
  };

  const serviceB = {
    id: 'passport-tatkal',
    name: 'Tatkaal Passport',
    department: 'MEA',
    category: 'Identity',
    fees: '₹3500',
    timeRequired: '3 days',
    documents: ['Aadhaar Card', 'Verification Certificate Annexure F', 'Proof of Address'],
    eligibility: ['Indian Citizen', 'Urgent Travel Justification'],
    officialUrl: 'https://passportindia.gov.in',
  };

  describe('analyzeDocumentDifferences', () => {
    it('correctly identifies common documents and service-unique documents', () => {
      const { commonDocuments, uniqueDocuments } = analyzeDocumentDifferences([serviceA, serviceB]);

      // Aadhaar Card and Proof of Address are in both
      expect(commonDocuments.length).toBe(2);
      expect(commonDocuments).toContain('Aadhaar Card');
      expect(commonDocuments).toContain('Proof of Address');

      // Birth Certificate is unique to Normal Passport
      expect(uniqueDocuments['passport-normal']).toContain('Birth Certificate');

      // Annexure F is unique to Tatkaal Passport
      expect(uniqueDocuments['passport-tatkal']).toContain('Verification Certificate Annexure F');
    });

    it('handles empty services array gracefully', () => {
      const result = analyzeDocumentDifferences([]);
      expect(result.commonDocuments).toEqual([]);
      expect(result.uniqueDocuments).toEqual({});
    });
  });

  describe('generateComparisonMarkdown', () => {
    it('generates markdown with titles, tables, document differences, and portal links', () => {
      const md = generateComparisonMarkdown([serviceA, serviceB]);

      expect(md).toContain('# Civic Help Setu — Service Comparison Dossier');
      expect(md).toContain('## 1. Executive Comparison Matrix');
      expect(md).toContain('| Attribute | Normal Passport | Tatkaal Passport |');
      expect(md).toContain('## 2. Document Requirement Analysis');
      expect(md).toContain('### Documents Common to All Services:');
      expect(md).toContain('- [x] Aadhaar Card');
      expect(md).toContain('### Distinct Requirements by Service:');
      expect(md).toContain('#### Normal Passport');
      expect(md).toContain('- [ ] Birth Certificate');
      expect(md).toContain('## 3. Official Links & Application Portals');
      expect(md).toContain('https://passportindia.gov.in');
    });

    it('handles empty service lists cleanly', () => {
      const md = generateComparisonMarkdown([]);
      expect(md).toContain('No services selected for comparison');
    });
  });

  describe('generateComparisonPlainText', () => {
    it('generates formatted 80-column ascii report with checklist headers', () => {
      const text = generateComparisonPlainText([serviceA, serviceB]);

      expect(text).toContain('CIVIC HELP SETU — CITIZEN SERVICE COMPARISON DOSSIER');
      expect(text).toContain('[SERVICE 1]: NORMAL PASSPORT');
      expect(text).toContain('[SERVICE 2]: TATKAAL PASSPORT');
      expect(text).toContain('DOCUMENT COMPARISON SUMMARY:');
      expect(text).toContain('Common Checklist for Both Services:');
      expect(text).toContain('* Aadhaar Card');
    });

    it('handles empty input', () => {
      expect(generateComparisonPlainText([])).toContain('NO SERVICES SELECTED');
    });
  });
});
