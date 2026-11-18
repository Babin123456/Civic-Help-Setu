// Screening benchmarks from the issue; actual applicability depends on context and current standards.
export const CHECKS = [
  { key: 'ramp', label: 'Ramp slope no steeper than 1:12', critical: true },
  { key: 'rails', label: 'Handrails at both 760 mm and 900 mm', critical: true },
  { key: 'door', label: 'Doorway clearance at least 900 mm', critical: true },
  { key: 'tactile', label: 'Tactile ground surface indicators', critical: false },
  { key: 'washroom', label: 'Washroom at least 2200 × 2000 mm with grab rails', critical: false },
  { key: 'lift', label: 'Lift has auditory and Braille indicators, if applicable', critical: false },
];
export function evaluateAudit(answers) {
  const assessed = CHECKS.filter(c => answers[c.key] === 'yes' || answers[c.key] === 'no');
  const passed = assessed.filter(c => answers[c.key] === 'yes').length;
  return {
    score: assessed.length ? Math.round(passed * 100 / assessed.length) : null,
    assessed: assessed.length,
    hazards: CHECKS.filter(c => c.critical && answers[c.key] === 'no').map(c => c.label),
    failures: CHECKS.filter(c => answers[c.key] === 'no').map(c => c.label),
  };
}
export function estimatePenalty(offence) {
  if (offence === 'first') return 'Up to ₹10,000 for a first contravention, subject to Section 89 and adjudication.';
  if (offence === 'subsequent') return '₹50,000 to ₹5,00,000 for a subsequent contravention, subject to Section 89 and adjudication.';
  return 'Select a contravention history. Penalties are not automatic; subsequent contravention is not the same as each day of continuing failure.';
}
export function draftAccessibilityPetition({ authority, facility, district, facts, audit }) {
  return `To: ${authority === 'chief' ? 'Chief Commissioner' : 'State Commissioner'} for Persons with Disabilities\n\nSubject: Request for inquiry into accessibility barriers under the Rights of Persons with Disabilities Act, 2016\n\nFacility: ${facility || '[facility name]'}\nDistrict and State: ${district || '[district and state]'}\nDescription and dates: ${facts || '[describe barriers and dates]'}\n\nReported failed checks: ${audit.failures.join('; ') || '[describe specific barriers]'}\n\nI request an inquiry and on-site accessibility inspection, a time-bound plan to remedy identified barriers, and appropriate action under the Act. Please consider Sections 75 and 80 as applicable to the chosen authority, and Section 89 where warranted.\n\n[Add evidence, prior correspondence, contact details, date and signature. Verify applicable law, jurisdiction and standards before filing.]`;
}
