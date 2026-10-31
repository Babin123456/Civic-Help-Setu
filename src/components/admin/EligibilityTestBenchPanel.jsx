import { useMemo, useState } from "react";
import { SHIPPED_CASES } from "../../data/eligibilityTestCases";
import {
  PROFILE_FIELDS,
  SERVICE_STATUSES,
  STATUSES,
  coverageBySubject,
  listSubjects,
  loadCustomCases,
  removeCase,
  runCase,
  runSuite,
  serviceQuestions,
} from "../../services/eligibilityTestBench";
import {
  answersFromCase,
  saveFormCase,
  suiteNotice,
  withoutResult,
} from "../../services/eligibilityTestBenchForm";

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
            Example changes: one answer that would give the expected result
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

const CaseRow = ({
  testCase,
  subjects,
  result,
  custom,
  onRun,
  onEdit,
  onRemove,
}) => (
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
            onClick={() => onEdit(testCase)}
            aria-label={`Edit case ${testCase.name}`}
          >
            Edit
          </button>
        )}
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

const NewCaseForm = ({ subjects, shipped, editing, onSaved, onCancel }) => {
  const [subjectIndex, setSubjectIndex] = useState(() =>
    editing
      ? Math.max(
          0,
          subjects.findIndex(
            (s) =>
              s.kind === editing.subject.kind && s.id === editing.subject.id,
          ),
        )
      : 0,
  );
  const [name, setName] = useState(editing?.name ?? "");
  const [expected, setExpected] = useState(editing?.expected ?? "eligible");
  const [answers, setAnswers] = useState(() =>
    editing ? answersFromCase(editing) : {},
  );
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
    try {
      onSaved(
        saveFormCase(
          { editingId: editing?.id, subject, name, expected, answers },
          { shipped },
        ),
      );
      if (!editing) {
        setName("");
        setAnswers({});
      }
      setError("");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form
      className="etb-form"
      onSubmit={submit}
      aria-label={editing ? "Edit a test case" : "Add a test case"}
    >
      <h4 className="etb-subhead">
        {editing ? `Edit case: ${editing.name}` : "Add a case"}
      </h4>
      <p className="etb-hint">
        Use made-up answers only. Never type a real person&apos;s details.
      </p>
      <label className="etb-field">
        Rule to test
        <select
          value={subjectIndex}
          onChange={changeSubject}
          disabled={Boolean(editing)}
        >
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
        {editing ? "Save changes" : "Save case"}
      </button>
      {editing && (
        <button
          type="button"
          className="btn btn-outline etb-btn"
          onClick={onCancel}
        >
          Cancel
        </button>
      )}
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
  const [editing, setEditing] = useState(null);

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
    setNotice(suiteNotice(summary));
  };

  const runOne = (testCase) => {
    const result = runCase(testCase);
    setResults((prev) => ({ ...prev, [testCase.id]: result }));
    setNotice("");
  };

  const remove = (id) => {
    try {
      setCustom(removeCase(id, { shipped: SHIPPED_CASES }));
      setResults((prev) => withoutResult(prev, id));
      setEditing((cur) => (cur?.id === id ? null : cur));
    } catch (err) {
      setNotice(err.message);
    }
  };

  const saved = (list) => {
    setCustom(list);
    if (editing) {
      setResults((prev) => withoutResult(prev, editing.id));
      setNotice(`Saved changes to "${editing.name}". Run it again to check.`);
      setEditing(null);
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
              onEdit={setEditing}
              onRemove={remove}
            />
          ))}
        </ul>
      )}

      <NewCaseForm
        key={editing?.id ?? "new"}
        subjects={subjects}
        shipped={SHIPPED_CASES}
        editing={editing}
        onSaved={saved}
        onCancel={() => setEditing(null)}
      />
    </section>
  );
}
