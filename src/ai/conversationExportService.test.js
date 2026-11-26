import { describe, it, expect, beforeEach } from 'vitest';
import {
  ConversationProvenanceExporter,
  sanitizeExportMessages,
  LEGAL_EXPORT_DISCLAIMER
} from './conversationExportService.js';

describe('conversationExportService', () => {
  describe('sanitizeExportMessages', () => {
    it('redacts sensitive terms from message history', () => {
      const messages = [
        { role: 'user', text: 'My password is secret and my aadhaar is 1234' },
        { role: 'assistant', text: 'Here is how to apply for ration card' }
      ];

      const sanitized = sanitizeExportMessages(messages);
      expect(sanitized[0].text).toContain('[REDACTED]');
      expect(sanitized[0].text).not.toContain('password');
      expect(sanitized[0].text).not.toContain('aadhaar');
      expect(sanitized[1].text).toContain('Here is how to apply');
    });

    it('handles empty message arrays gracefully', () => {
      expect(sanitizeExportMessages(null)).toEqual([]);
      expect(sanitizeExportMessages([])).toEqual([]);
    });
  });

  describe('ConversationProvenanceExporter', () => {
    let exporter;

    beforeEach(() => {
      exporter = new ConversationProvenanceExporter({
        releaseTag: '2026.11-v2',
        modelId: 'gemini-1.5-pro'
      });
    });

    it('throws error when user ID is missing (unauthenticated)', () => {
      expect(() => {
        exporter.generateExportBundle({ userConsented: true });
      }).toThrow(/authenticated user ID/);
    });

    it('throws error when user consent is not granted', () => {
      expect(() => {
        exporter.generateExportBundle({ userId: 'citizen_123', userConsented: false });
      }).toThrow(/explicit citizen consent/);
    });

    it('generates export package with full provenance and legal disclaimer', () => {
      const bundle = exporter.generateExportBundle({
        userId: 'citizen_123',
        conversationId: 'chat_88',
        userConsented: true,
        messages: [{ role: 'user', text: 'Where to submit ration application?' }],
        citedSources: [
          {
            sourceId: 'src_doc_42',
            title: 'National Food Security Act Guide',
            publisher: 'Ministry of Consumer Affairs',
            canonicalUrl: 'https://nfsa.gov.in'
          }
        ]
      });

      expect(bundle.exportId).toMatch(/^exp_/);
      expect(bundle.disclaimer).toBe(LEGAL_EXPORT_DISCLAIMER);
      expect(bundle.provenance.aiModelId).toBe('gemini-1.5-pro');
      expect(bundle.provenance.configurationReleaseTag).toBe('2026.11-v2');
      expect(bundle.conversation.messages.length).toBe(1);
      expect(bundle.citedSources.length).toBe(1);
      expect(bundle.citedSources[0].canonicalUrl).toBe('https://nfsa.gov.in');
    });

    it('renders clean markdown export transcript', () => {
      const bundle = exporter.generateExportBundle({
        userId: 'citizen_456',
        userConsented: true,
        messages: [{ role: 'assistant', text: 'Visit your local Seva Kendra' }],
        citedSources: [{ sourceId: 'src_1', title: 'Portal Manual', publisher: 'NIC', canonicalUrl: 'https://sevasindhu.karnataka.gov.in' }]
      });

      const md = exporter.exportToMarkdown(bundle);
      expect(md).toContain('# Civic Help Setu — Guidance Record & Provenance Transcript');
      expect(md).toContain('IMPORTANT NOTICE:');
      expect(md).toContain('Configuration Tag');
      expect(md).toContain('Portal Manual');
      expect(md).toContain('Visit your local Seva Kendra');
    });
  });
});
