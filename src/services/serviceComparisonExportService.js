/**
 * Service Comparison Printable & Markdown Export Engine (#436)
 *
 * Transforms side-by-side service comparisons into structured, exportable
 * formats (GitHub Flavored Markdown, 80-column plain text, and print-ready HTML)
 * enabling citizens, village counseling centers, and family members to save,
 * print, or share offline civic service evaluations.
 */

import { comparisonService } from './comparisonService.js';

/**
 * Computes common document requirements shared across all compared services
 * and documents unique to each individual service.
 * @param {Array} services
 * @returns {{ commonDocuments: string[], uniqueDocuments: Record<string, string[]> }}
 */
export function analyzeDocumentDifferences(services = []) {
  if (!Array.isArray(services) || services.length === 0) {
    return { commonDocuments: [], uniqueDocuments: {} };
  }

  const docLists = services.map((s) => (s.documents || []).map((d) => String(d).trim().toLowerCase()));
  const allUnique = new Set();
  services.forEach((s) => (s.documents || []).forEach((d) => allUnique.add(String(d).trim())));

  const commonDocuments = [];
  const uniqueDocuments = {};

  services.forEach((s) => {
    uniqueDocuments[s.id] = [];
  });

  allUnique.forEach((originalDoc) => {
    const lower = originalDoc.toLowerCase();
    const presentInAll = docLists.every((list) => list.includes(lower));

    if (presentInAll) {
      commonDocuments.push(originalDoc);
    } else {
      services.forEach((s) => {
        const sDocs = (s.documents || []).map((d) => d.toLowerCase());
        if (sDocs.includes(lower)) {
          uniqueDocuments[s.id].push(originalDoc);
        }
      });
    }
  });

  return { commonDocuments, uniqueDocuments };
}

/**
 * Generates an official Markdown comparison dossier with tables and deep links.
 * @param {Array} services List of compared service objects
 * @returns {string} Markdown text
 */
export function generateComparisonMarkdown(services = []) {
  if (!Array.isArray(services) || services.length === 0) {
    return '# Civic Service Comparison\n\nNo services selected for comparison.';
  }

  const generatedDate = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const matrix = comparisonService.buildComparisonMatrix(services);
  const { commonDocuments, uniqueDocuments } = analyzeDocumentDifferences(services);

  const lines = [
    `# Civic Help Setu — Service Comparison Dossier`,
    `*Generated on: ${generatedDate}*`,
    '',
    `Comparing **${services.length} citizen services** side-by-side:`,
    services.map((s) => `- **${s.name}** (${s.department || 'Government Department'})`).join('\n'),
    '',
    '## 1. Executive Comparison Matrix',
    '',
  ];

  // Markdown Table Header
  const headers = ['Attribute', ...services.map((s) => s.name.replace(/\|/g, '-'))];
  lines.push(`| ${headers.join(' | ')} |`);
  lines.push(`| ${headers.map(() => '---').join(' | ')} |`);

  // Table rows from comparison matrix
  matrix.forEach((row) => {
    const cells = [
      row.label,
      ...row.values.map((val) => {
        if (!val || val.length === 0) return 'Not Available';
        return val.join('; ').replace(/\|/g, '-');
      }),
    ];
    lines.push(`| ${cells.join(' | ')} |`);
  });

  lines.push('');
  lines.push('## 2. Document Requirement Analysis');
  lines.push('');

  if (commonDocuments.length > 0) {
    lines.push('### Documents Common to All Services:');
    lines.push(commonDocuments.map((doc) => `- [x] ${doc}`).join('\n'));
    lines.push('');
  }

  lines.push('### Distinct Requirements by Service:');
  services.forEach((service) => {
    lines.push(`#### ${service.name}`);
    const unique = uniqueDocuments[service.id] || [];
    if (unique.length > 0) {
      lines.push(unique.map((doc) => `- [ ] ${doc}`).join('\n'));
    } else {
      lines.push('- *No unique documents required beyond common checklist.*');
    }
    lines.push('');
  });

  lines.push('## 3. Official Links & Application Portals');
  lines.push('');
  services.forEach((service) => {
    const url = service.officialUrl || service.url || '#';
    lines.push(`- **${service.name}**: [Official Application Portal](${url})`);
  });

  lines.push('');
  lines.push('---');
  lines.push('*Dossier generated offline by Civic Help Setu — Verified Open Civic Infrastructure.*');

  return lines.join('\n');
}

/**
 * Generates an 80-column plain-text comparison dossier suitable for printing,
 * terminal viewing, or pasting into SMS/WhatsApp.
 * @param {Array} services
 * @returns {string} Plain text dossier
 */
export function generateComparisonPlainText(services = []) {
  if (!Array.isArray(services) || services.length === 0) {
    return 'CIVIC HELP SETU — NO SERVICES SELECTED FOR COMPARISON';
  }

  const separator = '='.repeat(70);
  const subSeparator = '-'.repeat(70);

  const lines = [
    separator,
    'CIVIC HELP SETU — CITIZEN SERVICE COMPARISON DOSSIER',
    separator,
    `Date: ${new Date().toLocaleDateString()}`,
    `Services Compared: ${services.map((s) => s.name).join(' vs ')}`,
    separator,
    '',
  ];

  services.forEach((service, index) => {
    lines.push(`[SERVICE ${index + 1}]: ${service.name.toUpperCase()}`);
    lines.push(`Department: ${service.department || 'N/A'}`);
    lines.push(`Category: ${service.category || 'N/A'}`);
    lines.push(`Official Fee: ${service.fees || service.fee || 'Free / Nil'}`);
    lines.push(`Processing Timeline: ${service.timeRequired || service.timeline || '15-30 days'}`);
    lines.push(`Mode: ${service.type || 'Online / Portal'}`);
    lines.push('Eligibility:');
    (service.eligibility || ['General citizen criteria apply']).forEach((e) => {
      lines.push(`  * ${e}`);
    });
    lines.push('Required Documents:');
    (service.documents || ['Standard identity & address proof']).forEach((d) => {
      lines.push(`  [ ] ${d}`);
    });
    lines.push(subSeparator);
    lines.push('');
  });

  lines.push('DOCUMENT COMPARISON SUMMARY:');
  const { commonDocuments } = analyzeDocumentDifferences(services);
  if (commonDocuments.length > 0) {
    lines.push('Common Checklist for Both Services:');
    commonDocuments.forEach((doc) => lines.push(`  * ${doc}`));
  } else {
    lines.push('No shared documents identified.');
  }

  lines.push('');
  lines.push(separator);
  lines.push('CITIZEN ADVISORY: Always verify statutory fees and rules at official desks.');
  lines.push(separator);

  return lines.join('\n');
}

/**
 * Triggers a native browser file download for text/markdown blobs.
 * @param {string} content
 * @param {string} filename
 * @param {string} mimeType
 */
export function downloadTextBlob(content, filename, mimeType = 'text/markdown;charset=utf-8') {
  if (typeof window === 'undefined') return;

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default {
  analyzeDocumentDifferences,
  generateComparisonMarkdown,
  generateComparisonPlainText,
  downloadTextBlob,
};
