/**
 * Eligibility-rule test bench: named, synthetic applicant cases with an expected outcome, run through
 * the SAME evaluators the citizen-facing flows use. A maintainer runs the cases before publishing a
 * change to a criterion and sees which ones now give a different answer, and which criterion is behind it.
 *
 * Two evaluators exist in the app, so a case names which one it targets (`subject.kind`):
 *   'scheme'   the profile-based scheme checker: evaluateAllSchemes() then applyCriteria(), exactly what
 *              UniversalEligibilityWizard does. Statuses: eligible, conditional, ineligible, unknown.
 *   'service'  the question-based service check: ELIGIBILITY_RULES[id].evaluate(answers), exactly what
 *              EligibilityWizard does. Statuses: eligible, conditional, ineligible.
 *
 * Nothing here evaluates a rule itself (no copy of the logic) and nothing changes a service or a citizen's
 * saved assessment. A case holds only fictional answers; real personal fields are refused.
 * Docs: docs/ELIGIBILITY_TEST_BENCH.md
 */
import { ELIGIBILITY_RULES } from "../data/eligibilityRules.js";
import { FORBIDDEN_FIELDS } from "../data/serviceContract.js";
import {
  SCHEME_EVALUATION_RULES,
  evaluateAllSchemes,
} from "./assessmentStorage.js";
import { applyCriteria } from "./eligibilityCriteria.js";

export const STATUSES = ["eligible", "conditional", "ineligible", "unknown"];
export const SERVICE_STATUSES = ["eligible", "conditional", "ineligible"];
export const SUBJECT_KINDS = ["scheme", "service"];
export const CASES_STORAGE_KEY = "civicbridge_eligibility_test_cases_v1";
export const MAX_CASES_PER_SUBJECT = 50;

/** The only inputs a scheme case may hold: the wizard's own fields, nothing identifying. */
export const PROFILE_FIELDS = [
  { key: "age", label: "Age", type: "number", min: 0, max: 120 },
  {
    key: "annualIncome",
    label: "Annual family income (INR)",
    type: "number",
    min: 0,
    max: 1e9,
  },
  {
    key: "employment",
    label: "Occupation",
    type: "choice",
    options: [
      "salaried",
      "self-employed",
      "farmer",
      "student",
      "unemployed",
      "homemaker",
    ],
  },
  {
    key: "category",
    label: "Category",
    type: "choice",
    options: ["General", "EWS", "OBC", "SC", "ST"],
  },
  { key: "state", label: "State / UT", type: "text", max: 60 },
  { key: "isStudent", label: "Is a student", type: "boolean" },
  {
    key: "ownsAgriculturalLand",
    label: "Owns agricultural land",
    type: "boolean",
  },
  { key: "hasAadhaar", label: "Has Aadhaar", type: "boolean" },
  { key: "hasPan", label: "Has PAN", type: "boolean" },
  { key: "hasLearnerLicense", label: "Has a learner licence", type: "boolean" },
  {
    key: "hasIncomeCertificate",
    label: "Has an income certificate",
    type: "boolean",
  },
];
const FIELD_BY_KEY = new Map(PROFILE_FIELDS.map((f) => [f.key, f]));

const isObject = (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const isText = (v) => typeof v === "string" && v.trim().length > 0;
const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// ---- what can be tested ----------------------------------------------------------------------

/** Every subject a case can target: { kind, id, name }. */
export function listSubjects() {
  const schemes = SCHEME_EVALUATION_RULES.map((s) => ({
    kind: "scheme",
    id: s.id,
    name: s.name,
  }));
  const services = Object.values(ELIGIBILITY_RULES).map((r) => ({
    kind: "service",
    id: r.serviceId,
    name: r.title,
  }));
  return [...schemes, ...services];
}

const subjectKey = (subject) => `${subject.kind}:${subject.id}`;
const subjectExists = (subject) =>
  listSubjects().some((s) => s.kind === subject.kind && s.id === subject.id);

/** The questions of a service rule: [{ id, prompt, options: [{ label, value }] }]. */
export function serviceQuestions(serviceId) {
  return ELIGIBILITY_RULES[serviceId]?.questions ?? [];
}

// ---- validating a case ----------------------------------------------------------------------

/** Errors for one case as [{ field, reason }]; empty means it can be saved and run. */
export function validateCase(testCase) {
  const errors = [];
  const fail = (field, reason) => errors.push({ field, reason });
  if (!isObject(testCase))
    return [{ field: "(case)", reason: "must be an object" }];

  for (const key of [
    ...FORBIDDEN_FIELDS,
    "aadhaarNumber",
    "mobile",
    "dob",
    "dateOfBirth",
    "fullName",
  ]) {
    if (key in testCase || (isObject(testCase.input) && key in testCase.input))
      fail(
        key,
        "personal data is not allowed in a test case; use fictional answers only",
      );
  }

  if (!isText(testCase.id) || !ID_PATTERN.test(testCase.id))
    fail("id", 'must be a lower-case slug such as "farmer-with-land"');
  if (!isText(testCase.name) || testCase.name.trim().length > 80)
    fail("name", "is required, at most 80 characters");
  if (
    testCase.note !== undefined &&
    (typeof testCase.note !== "string" || testCase.note.length > 300)
  )
    fail("note", "must be text of at most 300 characters");
  if (testCase.synthetic !== true)
    fail("synthetic", "must be true: test cases hold fictional answers only");

  const subject = testCase.subject;
  if (
    !isObject(subject) ||
    !SUBJECT_KINDS.includes(subject.kind) ||
    !isText(subject.id)
  ) {
    fail("subject", 'must be { kind: "scheme" | "service", id }');
    return errors;
  }
  if (!subjectExists(subject))
    fail("subject", `"${subject.id}" is not a known ${subject.kind}`);

  const allowed = subject.kind === "service" ? SERVICE_STATUSES : STATUSES;
  if (!allowed.includes(testCase.expected))
    fail("expected", `must be one of: ${allowed.join(", ")}`);

  if (!isObject(testCase.input)) {
    fail("input", "must be an object of answers");
    return errors;
  }
  if (subject.kind === "scheme") {
    for (const [key, value] of Object.entries(testCase.input)) {
      const field = FIELD_BY_KEY.get(key);
      if (!field) {
        if (!FORBIDDEN_FIELDS.includes(key))
          fail(`input.${key}`, "is not an eligibility field");
        continue;
      }
      if (
        field.type === "number" &&
        value !== "" &&
        !(
          typeof value === "number" &&
          Number.isFinite(value) &&
          value >= field.min &&
          value <= field.max
        )
      )
        fail(
          `input.${key}`,
          `must be a number from ${field.min} to ${field.max}, or blank`,
        );
      if (field.type === "choice" && !field.options.includes(value))
        fail(`input.${key}`, `must be one of: ${field.options.join(", ")}`);
      if (field.type === "boolean" && typeof value !== "boolean")
        fail(`input.${key}`, "must be true or false");
      if (
        field.type === "text" &&
        !(typeof value === "string" && value.length <= field.max)
      )
        fail(`input.${key}`, `must be text of at most ${field.max} characters`);
    }
  } else {
    const questions = serviceQuestions(subject.id);
    for (const [key, value] of Object.entries(testCase.input)) {
      const question = questions.find((q) => q.id === key);
      if (!question) fail(`input.${key}`, `is not a question of ${subject.id}`);
      else if (!question.options.some((o) => o.value === value))
        fail(
          `input.${key}`,
          `must be one of: ${question.options.map((o) => o.value).join(", ")}`,
        );
    }
  }

  if (testCase.expectedCriteria !== undefined) {
    if (subject.kind !== "scheme")
      fail("expectedCriteria", "is only available for scheme cases");
    else if (
      !isObject(testCase.expectedCriteria) ||
      !Object.values(testCase.expectedCriteria).every((s) =>
        ["satisfied", "missing", "unknown", "confirm"].includes(s),
      )
    ) {
      fail(
        "expectedCriteria",
        "must map criterion ids to satisfied, missing, unknown or confirm",
      );
    }
  }
  return errors;
}

// ---- running a case ---------------------------------------------------------------------------

/** The evaluators the app uses. Tests (or a maintainer previewing a changed rule) can pass others. */
export const defaultEvaluators = {
  scheme(schemeId, profile) {
    const evaluation = evaluateAllSchemes(profile).find(
      (e) => e.schemeId === schemeId,
    );
    if (!evaluation) throw new Error(`No scheme "${schemeId}"`);
    return applyCriteria(evaluation, profile);
  },
  service(serviceId, answers) {
    const rule = ELIGIBILITY_RULES[serviceId];
    if (!rule) throw new Error(`No eligibility rule for "${serviceId}"`);
    return rule.evaluate(answers);
  },
};

const driversOf = (evaluation) =>
  (Array.isArray(evaluation?.criteria) ? evaluation.criteria : [])
    .filter((c) => c.state !== "satisfied")
    .map((c) => ({
      id: c.id,
      label: c.label,
      state: c.state,
      detail: c.detail,
      field: c.field,
    }));

/** Single changes to the inputs that would give the expected status: the likely cause of a mismatch. */
function findChanges(testCase, evaluators) {
  const { subject, input, expected } = testCase;
  const options = [];
  if (subject.kind === "scheme") {
    for (const field of PROFILE_FIELDS) {
      if (field.type === "boolean")
        options.push([field.key, !input[field.key]]);
      if (field.type === "choice")
        field.options
          .filter((o) => o !== input[field.key])
          .forEach((o) => options.push([field.key, o]));
      if (
        field.type === "number" &&
        input[field.key] !== "" &&
        input[field.key] !== undefined
      )
        options.push([field.key, ""], [field.key, 0]);
      if (
        field.type === "number" &&
        (input[field.key] === "" || input[field.key] === undefined)
      )
        options.push([field.key, field.key === "age" ? 30 : 100000]);
    }
  } else {
    for (const question of serviceQuestions(subject.id)) {
      question.options
        .filter((o) => o.value !== input[question.id])
        .forEach((o) => options.push([question.id, o.value]));
    }
  }
  const found = [];
  for (const [key, value] of options) {
    try {
      const result = evaluators[subject.kind](subject.id, {
        ...input,
        [key]: value,
      });
      if (result.status === expected)
        found.push({ input: key, from: input[key] ?? null, to: value });
    } catch {
      // a change the evaluator cannot take is not a suggestion
    }
    if (found.length >= 5) break;
  }
  return found;
}

/**
 * Runs one case. Never throws: an evaluator error is reported as status "error".
 * @returns {{ caseId, status: 'pass'|'mismatch'|'error', expected, actual, message, drivers, criteriaMismatches, suggestions }}
 */
export function runCase(testCase, evaluators = defaultEvaluators) {
  const base = {
    caseId: testCase?.id ?? "",
    expected: testCase?.expected ?? null,
    actual: null,
    message: "",
    drivers: [],
    criteriaMismatches: [],
    suggestions: [],
  };
  const problems = validateCase(testCase);
  if (problems.length)
    return {
      ...base,
      status: "error",
      message: `Invalid case: ${problems[0].field} ${problems[0].reason}`,
    };

  let evaluation;
  try {
    evaluation = evaluators[testCase.subject.kind](
      testCase.subject.id,
      structuredClone(testCase.input),
    );
  } catch (error) {
    return {
      ...base,
      status: "error",
      message: `The evaluator failed: ${error.message}`,
    };
  }

  const actual = evaluation?.status ?? null;
  const drivers = driversOf(evaluation);
  const criteriaMismatches = [];
  for (const [id, expectedState] of Object.entries(
    testCase.expectedCriteria ?? {},
  )) {
    const row = (evaluation.criteria ?? []).find((c) => c.id === id);
    const actualState = row ? row.state : "absent";
    if (actualState !== expectedState)
      criteriaMismatches.push({
        id,
        label: row?.label ?? id,
        expected: expectedState,
        actual: actualState,
        detail: row?.detail ?? "This criterion is no longer evaluated.",
      });
  }

  const statusMatches = actual === testCase.expected;
  if (statusMatches && criteriaMismatches.length === 0)
    return {
      ...base,
      status: "pass",
      actual,
      message: "As expected.",
      drivers,
    };

  const parts = [];
  if (!statusMatches)
    parts.push(
      `Expected ${testCase.expected} but the evaluator returned ${actual}.`,
    );
  for (const m of criteriaMismatches)
    parts.push(
      `Criterion "${m.label}": expected ${m.expected}, got ${m.actual}.`,
    );
  return {
    ...base,
    status: "mismatch",
    actual,
    message: parts.join(" "),
    drivers,
    criteriaMismatches,
    suggestions: statusMatches ? [] : findChanges(testCase, evaluators),
  };
}

/** Runs a list of cases. The summary counts add up to the number of cases. */
export function runSuite(cases, evaluators = defaultEvaluators) {
  const results = (Array.isArray(cases) ? cases : []).map((c) =>
    runCase(c, evaluators),
  );
  const count = (status) => results.filter((r) => r.status === status).length;
  return {
    results,
    summary: {
      total: results.length,
      pass: count("pass"),
      mismatch: count("mismatch"),
      error: count("error"),
    },
  };
}

/**
 * Per subject: how many cases it has, and whether it is regression-tested. A subject with no case is
 * still valid; it is just reported as "not regression-tested".
 */
export function coverageBySubject(cases, subjects = listSubjects()) {
  const list = Array.isArray(cases) ? cases : [];
  return subjects.map((subject) => {
    const own = list.filter(
      (c) => c?.subject && subjectKey(c.subject) === subjectKey(subject),
    );
    return { ...subject, cases: own.length, regressionTested: own.length > 0 };
  });
}

// ---- the cases ---------------------------------------------------------------------------------

const safeStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

/** Maintainer-defined cases, from their own storage key. Entries that are not valid cases are left out. */
export function loadCustomCases(storage = safeStorage()) {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(CASES_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((c) => validateCase(c).length === 0)
      : [];
  } catch {
    return [];
  }
}

const write = (cases, storage) => {
  if (!storage) throw new Error("Browser storage is not available.");
  storage.setItem(CASES_STORAGE_KEY, JSON.stringify(cases));
  return cases;
};

/** Adds a case. Throws with the first problem when it is invalid, a duplicate, or the subject is full. */
export function addCase(
  testCase,
  { shipped = [], storage = safeStorage() } = {},
) {
  const problems = validateCase(testCase);
  if (problems.length)
    throw new Error(`${problems[0].field} ${problems[0].reason}`);
  const custom = loadCustomCases(storage);
  if ([...shipped, ...custom].some((c) => c.id === testCase.id))
    throw new Error(`A case with id "${testCase.id}" already exists.`);
  if (
    custom.filter((c) => subjectKey(c.subject) === subjectKey(testCase.subject))
      .length >= MAX_CASES_PER_SUBJECT
  ) {
    throw new Error(
      `A subject can have at most ${MAX_CASES_PER_SUBJECT} custom cases.`,
    );
  }
  return write([...custom, structuredClone(testCase)], storage);
}

/** Replaces the case with the same id. Shipped cases cannot be edited (copy them under a new id). */
export function updateCase(
  testCase,
  { shipped = [], storage = safeStorage() } = {},
) {
  const problems = validateCase(testCase);
  if (problems.length)
    throw new Error(`${problems[0].field} ${problems[0].reason}`);
  if (shipped.some((c) => c.id === testCase.id))
    throw new Error("Shipped cases cannot be edited. Copy it under a new id.");
  const custom = loadCustomCases(storage);
  if (!custom.some((c) => c.id === testCase.id))
    throw new Error(`No custom case "${testCase.id}".`);
  return write(
    custom.map((c) => (c.id === testCase.id ? structuredClone(testCase) : c)),
    storage,
  );
}

export function removeCase(id, { shipped = [], storage = safeStorage() } = {}) {
  if (shipped.some((c) => c.id === id))
    throw new Error("Shipped cases cannot be removed.");
  const custom = loadCustomCases(storage);
  if (!custom.some((c) => c.id === id))
    throw new Error(`No custom case "${id}".`);
  return write(
    custom.filter((c) => c.id !== id),
    storage,
  );
}
