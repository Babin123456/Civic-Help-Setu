// Heuristic prompts, not findings of liability. Multiple categories can apply.
export const PATTERNS = [
  ['False urgency', /countdown|hurry|limited time|only \d+ left/i],
  ['Basket sneaking', /pre.?select|added to (?:my |the )?(?:basket|cart)|insurance added/i],
  ['Confirm shaming', /no thanks.*(?:hate|don't care|do not care)|shame/i],
  ['Forced action', /must (?:subscribe|register|share)|forced action/i],
  ['Subscription trap', /(?:hard|difficult|unable) to cancel|subscription trap|auto.?renew/i],
  ['Interface interference', /hidden (?:button|option)|interface interference|misleading button/i],
  ['Bait and switch', /bait and switch|different (?:product|offer)/i],
  ['Drip pricing', /hidden (?:fee|charge)|drip pricing|checkout surcharge/i],
  ['Disguised advertisement', /disguised ad|undisclosed (?:ad|sponsor)/i],
  ['Nagging', /repeated (?:prompt|popup)|nagging/i],
  ['Trick question', /trick question|double negative|confusing checkbox/i],
  ['SaaS billing', /saas billing|free trial.*(?:charged|billing)/i],
  ['Rogue malwares', /rogue malware|fake virus warning|scareware/i],
];
export function classifyPatterns(text) {
  return PATTERNS.filter(([, expression]) => expression.test(text || '')).map(([label]) => label);
}
export function auditPricing(headline, final, disclosed = 0) {
  const values = [headline, final, disclosed].map(v => v === '' || v == null ? NaN : Number(v));
  if (values.some(v => !Number.isFinite(v) || v < 0)) throw new Error('Enter valid non-negative amounts.');
  const [base, total, known] = values;
  const difference = Math.round((total - base) * 100) / 100;
  const unexplained = Math.max(0, Math.round((difference - known) * 100) / 100);
  return { difference, unexplained, percentage: base > 0 ? Math.round(unexplained / base * 10000) / 100 : null,
    assessment: unexplained > 0 ? 'Possible drip pricing: review when and how charges were disclosed.' : 'No unexplained increase identified; this does not establish compliance.' };
}
export function draftNotice(data, kind) {
  const { trader = '[Trader]', facts = '[Describe facts]', amount = '[Amount]', patterns = [] } = data;
  const common = `Trader: ${trader || '[Trader]'}\nFacts and evidence: ${facts || '[Describe facts]'}\nPotential patterns: ${patterns.join(', ') || '[Identify patterns]'}\nAmount sought: ₹${amount === '' || amount == null ? '[Amount]' : amount}`;
  if (kind === 'notice') return `LEGAL NOTICE — Consumer Protection Act 2019, Section 2(47)\n\nTo ${trader || '[Trader]'}\n\n${common}\n\nI request a refund of the disputed charges and cessation of the described practices within 15 days of receipt. Please provide a written response and preserve relevant records. I reserve my legal remedies.\n\n[Name, address, date and signature]`;
  if (kind === 'ccpa') return `PETITION TO THE CHIEF COMMISSIONER, CENTRAL CONSUMER PROTECTION AUTHORITY\n\nSubject: Request for inquiry concerning consumer interests (Sections 10 and 20)\n\n${common}\n\nI request consideration of an inquiry under the Consumer Protection Act 2019, including Section 20 where applicable, and appropriate action. Section 21 provides for penalties for false or misleading advertisements up to ₹10 lakh, and up to ₹50 lakh for subsequent contraventions, subject to statutory conditions; I request such action only if applicable. Please examine evidence and any wider consumer impact.\n\n[Complainant details, date and signature]`;
  return `COMPLAINT BEFORE THE DISTRICT CONSUMER DISPUTES REDRESSAL COMMISSION\nConsumer Protection Act 2019, Section 35\n\n${common}\n\nI request refund, compensation, costs and, where justified, punitive damages.\n\n[State jurisdiction, dates, parties, cause of action, valuation, supporting evidence, verification and signature. Check applicable jurisdiction, limitation and filing requirements.]`;
}
