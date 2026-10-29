import { useMemo, useState } from "react";
import { SHIPPED_CASES } from "../../data/eligibilityTestCases";
import {
  PROFILE_FIELDS,
  SERVICE_STATUSES,
  STATUSES,
  addCase,
  coverageBySubject,
  listSubjects,
  loadCustomCases,
  removeCase,
  runCase,
  runSuite,
  serviceQuestions,
} from "../../services/eligibilityTestBench";

const RESULT_LABEL = {
  pass: "Passes",
  mismatch: "Different result",
  error: "Could not run",
};

const subjectLabel = (subjects, subject) =>
  subjects.find((s) => s.kind === subject.kind && s.id === subject.id)?.name ??
  subject.id;

export const ResultBadge = ({ status }) => (
  <span className={`etb-badge etb-badge--${status}`}>
    <span className="etb-dot" aria-hidden="true" />
    {RESULT_LABEL[status] ?? "Not run"}
  </span>
);

export const ResultDetails = ({ result }) => {
  if (!result || result.status === "pass") return null;
  return (
    <div className="etb-details">
      <p className="etb-message">{result.message}</p>
      {result.drivers.length > 0 && (
        <>
          <h5 className="etb-subhead">Requirements behind this result</h5>
          <ul className="etb-list">
            {result.drivers.map((d) => (
              <li key={d.id}>
                <strong>{d.label}</strong> ({d.state})
                {d.detail ? `: ${d.detail}` : ""}
              </li>
            ))}
          </ul>
        </>
      )}
      {result.suggestions.length > 0 && (
        <>
          <h5 className="etb-subhead">
            Changing one answer would give the expected result
          </h5>
          <ul className="etb-list">
            {result.suggestions.map((s) => (
              <li key={`${s.input}:${String(s.to)}`}>
                {s.input}: {s.from === null ? "not answered" : String(s.from)} →{" "}
                {s.to === "" ? "not answered" : String(s.to)}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

const inputSummary = (input) =>
  Object.entries(input)
    .map(([k, v]) => `${k}: ${v === "" ? "not answered" : String(v)}`)
    .join(", ");

const CaseRow = ({ testCase, subjects, result, custom, onRun, onRemove }) => (
  <li className="etb-case">
    <div className="etb-case__head">
      <div className="etb-case__main">
        <div className="etb-case__name">{testCase.name}</div>
        <div className="etb-case__meta">
          {subjectLabel(subjects, testCase.subject)} · expects{" "}
          <strong>{testCase.expected}</strong>
          {result?.actual && result.status !== "pass" ? (
            <>
              {" "}
              · got <strong>{result.actual}</strong>
            </>
          ) : null}
          {custom ? " · your case" : ""}
        </div>
      </div>
      <div className="etb-case__actions">
        <ResultBadge status={result?.status} />
        <button
          type="button"
          className="btn btn-outline etb-btn"
          onClick={() => onRun(testCase)}
        >
          Run
        </button>
        {custom && (
          <button
            type="button"
            className="btn btn-outline etb-btn"
            onClick={() => onRemove(testCase.id)}
            aria-label={`Delete case ${testCase.name}`}
          >
            Delete
          </button>
        )}
      </div>
    </div>
    <details className="etb-inputs">
      <summary>Answers used</summary>
      <p>{inputSummary(testCase.input) || "No answers."}</p>
      {testCase.note && <p className="etb-note">{testCase.note}</p>}
    </details>
    <ResultDetails result={result} />
  </li>
);

const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const NewCaseForm = ({ subjects, shipped, onAdded }) => {
  const [subjectIndex, setSubjectIndex] = useState(0);
  const [name, setName] = useState("");
  const [expected, setExpected] = useState("eligible");
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState("");

  const subject = subjects[subjectIndex];
  const isScheme = subject.kind === "scheme";
  const statuses = isScheme ? STATUSES : SERVICE_STATUSES;

  const changeSubject = (event) => {
    setSubjectIndex(Number(event.target.value));
    setAnswers({});
    setExpected("eligible");
  };

  const setAnswer = (key, value) =>
    setAnswers((prev) => ({ ...prev, [key]: value }));

  const submit = (event) => {
    event.preventDefault();
    const input = {};
    for (const [key, raw] of Object.entries(answers)) {
      if (raw === undefined) continue;
      const field = PROFILE_FIELDS.find((f) => f.key === key);
      if (isScheme && field?.type === "number")
        input[key] = raw === "" ? "" : Number(raw);
      else if (isScheme && field?.type === "boolean")
        input[key] = raw === "yes";
      else if (raw !== "") input[key] = raw;
    }
    try {
      onAdded(
        addCase(
          {
            id: slugify(`${subject.id}-${name}`),
            name: name.trim(),
            subject: { kind: subject.kind, id: subject.id },
            input,
            expected,
            synthetic: true,
          },
          { shipped },
        ),
      );
      setName("");
      setAnswers({});
      setError("");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="etb-form" onSubmit={submit} aria-label="Add a test case">
      <h4 className="etb-subhead">Add a case</h4>
      <p className="etb-hint">
        Use made-up answers only. Never type a real person&apos;s details.
      </p>
      <label className="etb-field">
        Rule to test
        <select value={subjectIndex} onChange={changeSubject}>
          {subjects.map((s, i) => (
            <option key={`${s.kind}:${s.id}`} value={i}>
              {s.name} (
              {s.kind === "scheme" ? "scheme checker" : "service questions"})
            </option>
          ))}
        </select>
      </label>
      <label className="etb-field">
        Case name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          required
          placeholder="e.g. farmer with land, no Aadhaar"
        />
      </label>

      {isScheme
        ? PROFILE_FIELDS.map((f) => (
            <label className="etb-field" key={f.key}>
              {f.label}
              {f.type === "boolean" ? (
                <select
                  value={answers[f.key] ?? ""}
                  onChange={(e) => setAnswer(f.key, e.target.value)}
                >
                  <option value="">Not set</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              ) : f.type === "choice" ? (
                <select
                  value={answers[f.key] ?? ""}
                  onChange={(e) => setAnswer(f.key, e.target.value)}
                >
                  <option value="">Not set</option>
                  {f.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : f.type === "number" ? (
                <input
                  type="number"
                  min={f.min}
                  max={f.max}
                  value={answers[f.key] ?? ""}
                  onChange={(e) => setAnswer(f.key, e.target.value)}
                  placeholder="Leave blank for not answered"
                />
              ) : (
                <input
                  value={answers[f.key] ?? ""}
                  maxLength={f.max}
                  onChange={(e) => setAnswer(f.key, e.target.value)}
                />
              )}
            </label>
          ))
        : serviceQuestions(subject.id).map((q) => (
            <label className="etb-field" key={q.id}>
              {q.prompt}
              <select
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswer(q.id, e.target.value)}
              >
                <option value="">Not set</option>
                {q.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ))}

      <label className="etb-field">
        Expected result
        <select value={expected} onChange={(e) => setExpected(e.target.value)}>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p className="etb-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary etb-btn">
        Save case
      </button>
    </form>
  );
};

/**
 * Admin panel for the eligibility-rule test bench (docs/ELIGIBILITY_TEST_BENCH.md).
 * It runs fictional cases through the same evaluators the citizen flows use and changes nothing else.
 */
export default function EligibilityTestBenchPanel() {
  const subjects = useMemo(() => listSubjects(), []);
  const [custom, setCustom] = useState(() => loadCustomCases());
  const [results, setResults] = useState({});
  const [filter, setFilter] = useState("all");
  const [notice, setNotice] = useState("");

  const cases = useMemo(() => [...SHIPPED_CASES, ...custom], [custom]);
  const customIds = useMemo(() => new Set(custom.map((c) => c.id)), [custom]);
  const coverage = useMemo(
    () => coverageBySubject(cases, subjects),
    [cases, subjects],
  );
  const visible = cases.filter(
    (c) => filter === "all" || `${c.subject.kind}:${c.subject.id}` === filter,
  );

  const runAll = () => {
    const { results: list, summary } = runSuite(cases);
    setResults(Object.fromEntries(list.map((r) => [r.caseId, r])));
    setNotice(
      summary.mismatch + summary.error === 0
        ? `All ${summary.total} cases give the expected result.`
        : `${summary.pass} of ${summary.total} cases pass. Different result: ${summary.mismatch}. Could not run: ${summary.error}.`,
    );
  };

  const runOne = (testCase) => {
    const result = runCase(testCase);
    setResults((prev) => ({ ...prev, [testCase.id]: result }));
    setNotice("");
  };

  const remove = (id) => {
    try {
      setCustom(removeCase(id, { shipped: SHIPPED_CASES }));
      setResults((prev) =>
        Object.fromEntries(Object.entries(prev).filter(([key]) => key !== id)),
      );
    } catch (err) {
      setNotice(err.message);
    }
  };

  return (
    <section className="etb" aria-labelledby="etb-title">
      <h3 id="etb-title" className="etb-title">
        Eligibility rule test bench
      </h3>
      <p className="etb-intro">
        Run fictional applicant cases through the live eligibility rules before
        you change a criterion. A case that gives a different answer shows which
        requirement is behind it. Nothing here changes a service or
        anyone&apos;s saved check.
      </p>

      <h4 className="etb-subhead">Coverage</h4>
      <ul className="etb-coverage">
        {coverage.map((c) => (
          <li
            key={`${c.kind}:${c.id}`}
            className={
              c.regressionTested
                ? "etb-cov etb-cov--ok"
                : "etb-cov etb-cov--none"
            }
          >
            <span>
              {c.name}{" "}
              <span className="etb-kind">
                ({c.kind === "scheme" ? "scheme" : "service"})
              </span>
            </span>
            <span>
              {c.regressionTested
                ? `${c.cases} case${c.cases === 1 ? "" : "s"}`
                : "Not regression-tested"}
            </span>
          </li>
        ))}
      </ul>

      <div className="etb-toolbar">
        <button
          type="button"
          className="btn btn-primary etb-btn"
          onClick={runAll}
        >
          Run all {cases.length} cases
        </button>
        <label className="etb-field etb-field--inline">
          Show
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All rules</option>
            {subjects.map((s) => (
              <option key={`${s.kind}:${s.id}`} value={`${s.kind}:${s.id}`}>
                {s.name} ({s.kind})
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="etb-notice" role="status" aria-live="polite">
        {notice}
      </p>

      {visible.length === 0 ? (
        <p className="etb-empty">
          No cases for this rule yet. It is valid, but changes to it are not
          regression-tested.
        </p>
      ) : (
        <ul className="etb-cases">
          {visible.map((c) => (
            <CaseRow
              key={c.id}
              testCase={c}
              subjects={subjects}
              result={results[c.id]}
              custom={customIds.has(c.id)}
              onRun={runOne}
              onRemove={remove}
            />
          ))}
        </ul>
      )}

      <NewCaseForm
        subjects={subjects}
        shipped={SHIPPED_CASES}
        onAdded={setCustom}
      />
    </section>
  );
}
