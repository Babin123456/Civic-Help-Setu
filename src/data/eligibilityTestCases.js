// Synthetic applicant cases for the eligibility test bench (docs/ELIGIBILITY_TEST_BENCH.md).
//
// Every case is fictional: the name describes a situation, not a person, and the answers are
// invented. They are kept here, apart from anything a citizen stores, and nothing in the citizen
// flows reads this file. A test runs all of them against the current rules, so a change to a rule
// that alters one of these outcomes fails there (and shows in the admin test bench) before it is
// published. A subject with no case here is simply "not regression-tested yet".
//
// `input` holds only what the wizard asks. Leaving a number out or blank means "not answered".
// `expectedCriteria` (optional) pins the state of single requirements; the other criteria are not checked.

const scheme = (id, name, input, expected, extra = {}) => ({
  id: `${id}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  name: extra.title ?? name,
  subject: { kind: "scheme", id },
  input,
  expected,
  synthetic: true,
  ...(extra.note ? { note: extra.note } : {}),
  ...(extra.expectedCriteria
    ? { expectedCriteria: extra.expectedCriteria }
    : {}),
});

const service = (id, name, input, expected, note) => ({
  id: `${id}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  name,
  subject: { kind: "service", id },
  input,
  expected,
  synthetic: true,
  ...(note ? { note } : {}),
});

// A fictional adult used as the starting point of the scheme cases.
const ADULT = {
  age: 30,
  annualIncome: 300000,
  employment: "salaried",
  category: "General",
  state: "Sampleland",
  isStudent: false,
  ownsAgriculturalLand: false,
  hasAadhaar: true,
  hasPan: true,
  hasLearnerLicense: false,
  hasIncomeCertificate: false,
};

export const SHIPPED_CASES = [
  // PM Kisan: land-owning farmer families only, with an income ceiling and Aadhaar e-KYC
  scheme(
    "pm-kisan",
    "farmer with land",
    { ...ADULT, employment: "farmer", ownsAgriculturalLand: true },
    "eligible",
  ),
  scheme(
    "pm-kisan",
    "farmer with land but no Aadhaar",
    {
      ...ADULT,
      employment: "farmer",
      ownsAgriculturalLand: true,
      hasAadhaar: false,
    },
    "conditional",
    { note: "Aadhaar e-KYC is needed to receive the benefit." },
  ),
  scheme(
    "pm-kisan",
    "farmer with land above the income ceiling",
    {
      ...ADULT,
      employment: "farmer",
      ownsAgriculturalLand: true,
      annualIncome: 900000,
    },
    "ineligible",
  ),
  scheme(
    "pm-kisan",
    "salaried applicant without land",
    { ...ADULT },
    "ineligible",
  ),

  // Post-matric scholarship: students in a reserved category under an income limit
  scheme(
    "scholarship-post-matric",
    "student SC low income",
    {
      ...ADULT,
      age: 19,
      isStudent: true,
      employment: "student",
      category: "SC",
      annualIncome: 150000,
    },
    "eligible",
  ),
  scheme(
    "scholarship-post-matric",
    "student SC income not answered",
    {
      ...ADULT,
      age: 19,
      isStudent: true,
      employment: "student",
      category: "SC",
      annualIncome: "",
    },
    "conditional",
    {
      note: 'A blank income is "not answered", not zero, so the result cannot be a clean yes.',
    },
  ),
  scheme(
    "scholarship-post-matric",
    "working adult not a student",
    { ...ADULT },
    "ineligible",
  ),

  // Driving licence: an age floor and a learner licence
  scheme(
    "driving-license",
    "seventeen year old",
    { ...ADULT, age: 17 },
    "ineligible",
  ),
  scheme(
    "driving-license",
    "adult with learner licence",
    { ...ADULT, age: 18, hasLearnerLicense: true },
    "eligible",
  ),
  scheme(
    "driving-license",
    "adult without learner licence",
    { ...ADULT },
    "conditional",
  ),

  // Udyam registration: PAN and Aadhaar for self-employed applicants
  scheme(
    "udyam-registration",
    "self-employed with PAN and Aadhaar",
    { ...ADULT, employment: "self-employed" },
    "eligible",
  ),
  scheme(
    "udyam-registration",
    "self-employed without PAN",
    { ...ADULT, employment: "self-employed", hasPan: false },
    "conditional",
  ),

  // Ration card: income-based, with a certificate
  scheme(
    "ration-card",
    "low income with income certificate",
    { ...ADULT, annualIncome: 90000, hasIncomeCertificate: true },
    "eligible",
  ),
  scheme(
    "ration-card",
    "high income",
    {
      ...ADULT,
      employment: "farmer",
      ownsAgriculturalLand: true,
      annualIncome: 900000,
    },
    "ineligible",
  ),

  // Passport
  scheme("passport", "adult with Aadhaar", { ...ADULT }, "eligible"),
  scheme(
    "passport",
    "adult without Aadhaar",
    { ...ADULT, hasAadhaar: false },
    "conditional",
  ),

  // Birth certificate (question flow)
  service(
    "birth-certificate",
    "registered on time with both parent IDs",
    {
      registered_21_days: "yes",
      has_parent_id: "yes",
      has_hospital_slip: "yes",
    },
    "eligible",
  ),
  service(
    "birth-certificate",
    "no parent ID",
    {
      registered_21_days: "yes",
      has_parent_id: "no",
      has_hospital_slip: "yes",
    },
    "ineligible",
  ),
  service(
    "birth-certificate",
    "registered more than a year late",
    {
      registered_21_days: "very_late",
      has_parent_id: "yes",
      has_hospital_slip: "yes",
    },
    "conditional",
  ),

  // Driving licence (question flow)
  service(
    "driving-license",
    "underage applicant",
    {
      age: "underage",
      learner_license: "valid_ll_30_days",
      test_vehicle: "yes",
    },
    "ineligible",
  ),
  service(
    "driving-license",
    "adult with a learner licence of 30 days",
    {
      age: "18_plus",
      learner_license: "valid_ll_30_days",
      test_vehicle: "yes",
    },
    "eligible",
  ),
  service(
    "driving-license",
    "adult with no learner licence",
    { age: "18_plus", learner_license: "no_ll", test_vehicle: "yes" },
    "conditional",
  ),

  // Aadhaar (question flow)
  service(
    "aadhaar-card",
    "resident with identity and address proof",
    { residency: "resident", has_poi_poa: "yes" },
    "eligible",
  ),
  service(
    "aadhaar-card",
    "foreign visitor",
    { residency: "foreign_visitor", has_poi_poa: "yes" },
    "ineligible",
  ),
  service(
    "aadhaar-card",
    "resident relying on the head of family",
    { residency: "resident", has_poi_poa: "hof" },
    "conditional",
  ),

  // PAN (question flow)
  service(
    "pan-card",
    "first-time applicant with Aadhaar OTP",
    { aadhaar_linked: "instant_otp", existing_pan: "first_time" },
    "eligible",
  ),
  service(
    "pan-card",
    "applicant who already has a PAN",
    { aadhaar_linked: "instant_otp", existing_pan: "duplicate" },
    "conditional",
  ),
  service(
    "pan-card",
    "first-time applicant without Aadhaar",
    { aadhaar_linked: "no_aadhaar", existing_pan: "first_time" },
    "conditional",
  ),
];
