import { PROFILE_FIELDS, addCase, updateCase } from "./eligibilityTestBench.js";

/** Turns the form's raw answers into a case input for the given subject kind. */
export function buildInput(answers, kind) {
  const isScheme = kind === "scheme";
  const input = {};
  for (const [key, raw] of Object.entries(answers)) {
    if (raw === undefined) continue;
    const field = PROFILE_FIELDS.find((f) => f.key === key);
    if (isScheme && field?.type === "number")
      input[key] = raw === "" ? "" : Number(raw);
    else if (isScheme && field?.type === "boolean") input[key] = raw === "yes";
    else if (raw !== "") input[key] = raw;
  }
  return input;
}

/** Inverse of buildInput: the raw form answers for an existing case. */
export function answersFromCase(testCase) {
  const isScheme = testCase.subject.kind === "scheme";
  const answers = {};
  for (const [key, value] of Object.entries(testCase.input ?? {})) {
    const field = PROFILE_FIELDS.find((f) => f.key === key);
    if (isScheme && field?.type === "boolean")
      answers[key] = value ? "yes" : "no";
    else answers[key] = value === "" ? "" : String(value);
  }
  return answers;
}

export const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * Saves the form: updates the case with `editingId`, or adds a new one.
 * Returns the new list of custom cases. Throws with the first problem.
 */
export function saveFormCase(
  { editingId, subject, name, expected, answers },
  options,
) {
  const testCase = {
    id: editingId ?? slugify(`${subject.id}-${name}`),
    name: name.trim(),
    subject: { kind: subject.kind, id: subject.id },
    input: buildInput(answers, subject.kind),
    expected,
    synthetic: true,
  };
  return editingId ? updateCase(testCase, options) : addCase(testCase, options);
}

export function suiteNotice(summary) {
  return summary.mismatch + summary.error === 0
    ? `All ${summary.total} cases give the expected result.`
    : `${summary.pass} of ${summary.total} cases pass. Different result: ${summary.mismatch}. Could not run: ${summary.error}.`;
}

export const withoutResult = (results, id) =>
  Object.fromEntries(Object.entries(results).filter(([key]) => key !== id));
