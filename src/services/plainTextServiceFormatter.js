/**
 * Low-Bandwidth Plain-Text Service Formatter (#275)
 * Converts structured civic service guides into accessible, human-readable
 * plain text formats suitable for WhatsApp, SMS (160-char chunking),
 * and offline .txt file sharing in low-connectivity areas.
 */

/**
 * Format a service guide for messaging apps (WhatsApp, Telegram, Signal)
 */
export function formatForWhatsApp(service = {}) {
  const name = (service.name || 'Civic Service').toUpperCase();
  const dept = service.department || service.category || 'Public Administration';
  const time = service.processingTime || 'Standard statutory timeline';
  const fee = typeof service.fees === 'string' ? service.fees : 'Official statutory fees apply';
  const portal = service.officialLink || service.portalUrl || 'Official Government Portal';

  const docs = Array.isArray(service.documents) && service.documents.length > 0
    ? service.documents.map((d) => `• ${d}`).join('\n')
    : '• Standard identity & address proof';

  const warnings = Array.isArray(service.warnings) && service.warnings.length > 0
    ? `\n⚠️ *KEY NOTES:*\n${service.warnings.map((w) => `• ${w}`).join('\n')}`
    : '';

  const helpline = service.helpline || service.contact?.helpline || 'Call 1912 / State Civic Helpline';

  return `🏛️ *${name}*
🏢 Department: ${dept}
⏱️ Timeline: ${time}
💰 Fee: ${fee}

📋 *MANDATORY DOCUMENTS:*
${docs}${warnings}

🌐 Portal: ${portal}
📞 Helpline: ${helpline}
_Shared via Civic Help Setu (Citizen Information Portal)_`.trim();
}

/**
 * Format service guide into discrete SMS parts constrained by standard 160-character boundaries
 */
export function formatForSms(service = {}, maxLen = 160) {
  const name = service.name || 'Govt Service';
  const time = service.processingTime ? `Time: ${service.processingTime}` : '';
  const fee = service.fees ? `Fee: ${service.fees}` : '';
  const docsList = Array.isArray(service.documents) && service.documents.length > 0
    ? service.documents.slice(0, 3).join(', ')
    : 'Aadhaar, address proof';
  const portal = service.officialLink ? service.officialLink.replace(/^https?:\/\//, '') : '';
  const helpline = service.helpline || '1912';

  // Part 1: Basic identity, fee, documents
  const p1Draft = `${name}: ${fee ? fee + '. ' : ''}${time ? time + '. ' : ''}Docs: ${docsList}.`;
  
  // Part 2: Official Link, Helpline and Portal
  const p2Draft = `${name} (Contd): Apply at ${portal ? portal : 'official portal'}. Helpline: ${helpline}. CivicHelpSetu`;

  // Helper to split any string into maxLen chunks with [X/Y] prefix
  const rawSegments = [p1Draft.trim(), p2Draft.trim()];
  const totalParts = rawSegments.length;

  return rawSegments.map((seg, idx) => {
    const prefix = `[${idx + 1}/${totalParts}] `;
    const available = maxLen - prefix.length;
    const truncated = seg.length > available ? seg.slice(0, available - 3) + '...' : seg;
    return `${prefix}${truncated}`;
  });
}

/**
 * Format service guide into an offline plaintext document card with metadata
 */
export function formatForPlainTextCard(service = {}) {
  const line = '============================================================';
  const dateStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const docs = Array.isArray(service.documents) && service.documents.length > 0
    ? service.documents.map((d, i) => `  ${i + 1}. ${d}`).join('\n')
    : '  1. Standard Identity Verification Document\n  2. Proof of Current Residence';

  const steps = Array.isArray(service.steps) && service.steps.length > 0
    ? service.steps.map((s, i) => `  Step ${i + 1}: ${s}`).join('\n')
    : '  Step 1: Check eligibility guidelines\n  Step 2: Submit application at counter/portal';

  return `${line}
CIVIC SERVICE FACILITATION GUIDE (OFFLINE COPY)
Service: ${service.name || 'Civic Service'}
Category: ${service.category || 'General Administration'}
Generated: ${dateStr}
${line}

1. OVERVIEW & TIMELINES
   - Department: ${service.department || 'Government of India / State Department'}
   - Processing SLA: ${service.processingTime || 'As per Citizen Charter'}
   - Statutory Fee: ${service.fees || 'Free / As notified'}
   - Official Portal: ${service.officialLink || 'https://india.gov.in'}

2. MANDATORY CHECKLIST & DOCUMENTS
${docs}

3. APPLICATION PROCEDURE
${steps}

4. GRIEVANCE & CITIZEN HELPLINE
   - Official Helpline: ${service.helpline || '1912 / 1076'}
   - National Portal: https://services.india.gov.in

${line}
Disclaimer: Information provided for public facilitation.
Verify final guidelines on official departmental portal.
${line}`;
}

/**
 * Trigger client-side download of the plain text summary
 */
export function downloadPlainTextFile(service = {}) {
  if (typeof window === 'undefined') return;
  const content = formatForPlainTextCard(service);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const filename = `${(service.id || 'service').toLowerCase()}-instructions.txt`;
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
