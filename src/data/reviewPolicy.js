// Which service-guide edits need a second reviewer before they can be published (docs/SERVICE_REVIEW.md).
//
// A field is "high impact" when a wrong value can send many citizens to the wrong office, the wrong
// amount of money or the wrong document list. The keys are record fields (the same keys the draft
// comparison uses). To add one, add a line here; nothing else needs to change.
export const HIGH_IMPACT_FIELDS = [
  { key: 'eligibility', label: 'Eligibility', why: 'Decides who is told they may apply.' },
  { key: 'documents', label: 'Required documents', why: 'Citizens gather these before visiting an office.' },
  { key: 'fees', label: 'Fees', why: 'A wrong amount means a wasted trip or an overpayment.' },
  { key: 'officialSources', label: 'Official application links', why: 'Citizens follow this link to apply.' },
];

export const HIGH_IMPACT_KEYS = HIGH_IMPACT_FIELDS.map((f) => f.key);

// Edits that touch none of the fields above go straight to publishing, as they did before.
// Set to true to require review for every change.
export const REVIEW_ALL_CHANGES = false;

export const REASON_MIN = 3;
export const REASON_MAX = 300;
export const SOURCE_REFERENCE_MAX = 300;
