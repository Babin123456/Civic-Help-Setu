import { describe, it, expect } from "vitest";
import {
  CASES_STORAGE_KEY,
  MAX_CASES_PER_SUBJECT,
  addCase,
  coverageBySubject,
  defaultEvaluators,
  listSubjects,
  loadCustomCases,
  removeCase,
  runCase,
  runSuite,
  serviceQuestions,
  updateCase,
  validateCase,
} from "./eligibilityTestBench.js";
import { SHIPPED_CASES } from "../data/eligibilityTestCases.js";

const memoryStorage = () => {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
};

const schemeCase = (over = {}) => ({
  id: "farmer-with-land",
  name: "Farmer with land",
  subject: { kind: "scheme", id: "pm-kisan" },
  input: {
    age: 40,
    annualIncome: 200000,
    employment: "farmer",
    ownsAgriculturalLand: true,
    hasAadhaar: true,
  },
  expected: "eligible",
  synthetic: true,
  ...over,
});

const serviceCase = (over = {}) => ({
  id: "adult-with-ll",
  name: "Adult with a learner licence",
  subject: { kind: "service", id: "driving-license" },
  input: {
    age: "18_plus",
    learner_license: "valid_ll_30_days",
    test_vehicle: "yes",
  },
  expected: "eligible",
  synthetic: true,
  ...over,
});

// An evaluator whose answer the test controls
const fixed = (evaluation) => ({
  scheme: () => evaluation,
  service: () => evaluation,
});

describe("validateCase", () => {
  it("accepts a well-formed scheme case and service case", () => {
    expect(validateCase(schemeCase())).toEqual([]);
    expect(validateCase(serviceCase())).toEqual([]);
  });

  it("rejects things that are not objects", () => {
    expect(validateCase(null)).toHaveLength(1);
    expect(validateCase("x")).toHaveLength(1);
    expect(validateCase([])).toHaveLength(1);
  });

  it("refuses personal fields at the top level and inside the input", () => {
    const top = validateCase(schemeCase({ aadhaarNumber: "1" }));
    expect(top.map((e) => e.field)).toContain("aadhaarNumber");
    const inner = validateCase(schemeCase({ input: { age: 30, mobile: "9" } }));
    expect(inner.map((e) => e.field)).toContain("mobile");
  });

  it("requires synthetic: true, a slug id and a short name", () => {
    expect(
      validateCase(schemeCase({ synthetic: false })).map((e) => e.field),
    ).toContain("synthetic");
    expect(
      validateCase(schemeCase({ id: "Not A Slug" })).map((e) => e.field),
    ).toContain("id");
    expect(
      validateCase(schemeCase({ name: "x".repeat(81) })).map((e) => e.field),
    ).toContain("name");
    expect(
      validateCase(schemeCase({ note: "x".repeat(301) })).map((e) => e.field),
    ).toContain("note");
  });

  it("rejects an unknown subject and an expected status the kind cannot return", () => {
    expect(
      validateCase(schemeCase({ subject: { kind: "scheme", id: "nope" } })).map(
        (e) => e.field,
      ),
    ).toContain("subject");
    expect(
      validateCase(schemeCase({ subject: { kind: "other", id: "x" } })).map(
        (e) => e.field,
      ),
    ).toContain("subject");
    expect(
      validateCase(serviceCase({ expected: "unknown" })).map((e) => e.field),
    ).toContain("expected");
    expect(validateCase(schemeCase({ expected: "unknown" }))).toEqual([]);
  });

  it("checks scheme inputs against the wizard fields", () => {
    const bad = validateCase(
      schemeCase({
        input: { age: -1, employment: "pilot", hasPan: "yes", nonsense: 1 },
      }),
    );
    const fields = bad.map((e) => e.field);
    expect(fields).toEqual(
      expect.arrayContaining([
        "input.age",
        "input.employment",
        "input.hasPan",
        "input.nonsense",
      ]),
    );
    expect(
      validateCase(schemeCase({ input: { age: "", annualIncome: "" } })),
    ).toEqual([]);
  });

  it("checks service inputs against the questions of that service", () => {
    const bad = validateCase(
      serviceCase({ input: { age: "ancient", made_up: "yes" } }),
    );
    expect(bad.map((e) => e.field)).toEqual(
      expect.arrayContaining(["input.age", "input.made_up"]),
    );
  });

  it("only allows expectedCriteria on scheme cases, with real states", () => {
    expect(
      validateCase(serviceCase({ expectedCriteria: { a: "satisfied" } })).map(
        (e) => e.field,
      ),
    ).toContain("expectedCriteria");
    expect(
      validateCase(schemeCase({ expectedCriteria: { income: "bogus" } })).map(
        (e) => e.field,
      ),
    ).toContain("expectedCriteria");
    expect(
      validateCase(schemeCase({ expectedCriteria: { income: "satisfied" } })),
    ).toEqual([]);
  });
});

describe("listSubjects and serviceQuestions", () => {
  it("lists the six schemes and four services", () => {
    const subjects = listSubjects();
    expect(
      subjects
        .filter((s) => s.kind === "scheme")
        .map((s) => s.id)
        .sort(),
    ).toEqual([
      "driving-license",
      "passport",
      "pm-kisan",
      "ration-card",
      "scholarship-post-matric",
      "udyam-registration",
    ]);
    expect(
      subjects
        .filter((s) => s.kind === "service")
        .map((s) => s.id)
        .sort(),
    ).toEqual([
      "aadhaar-card",
      "birth-certificate",
      "driving-license",
      "pan-card",
    ]);
  });

  it("returns the questions of a service, and none for an unknown one", () => {
    expect(serviceQuestions("pan-card").length).toBeGreaterThan(0);
    expect(serviceQuestions("nope")).toEqual([]);
  });
});

describe("runCase", () => {
  it("passes when the real evaluator agrees", () => {
    const result = runCase(schemeCase());
    expect(result.status).toBe("pass");
    expect(result.actual).toBe("eligible");
  });

  it("reports a mismatch with the status the evaluator returned", () => {
    const result = runCase(schemeCase({ expected: "ineligible" }));
    expect(result.status).toBe("mismatch");
    expect(result.actual).toBe("eligible");
    expect(result.message).toContain("Expected ineligible");
  });

  it("lists the criteria that are not satisfied as the drivers", () => {
    const result = runCase(
      schemeCase({
        input: {
          age: 40,
          annualIncome: 200000,
          employment: "salaried",
          ownsAgriculturalLand: false,
          hasAadhaar: true,
        },
        expected: "eligible",
      }),
    );
    expect(result.status).toBe("mismatch");
    expect(result.drivers.length).toBeGreaterThan(0);
    expect(result.drivers.every((d) => d.state !== "satisfied")).toBe(true);
  });

  it("suggests single input changes that would give the expected status", () => {
    const input = {
      age: 40,
      annualIncome: 200000,
      employment: "salaried",
      ownsAgriculturalLand: false,
      hasAadhaar: true,
    };
    const result = runCase(schemeCase({ input, expected: "eligible" }));
    expect(result.status).toBe("mismatch");
    expect(result.suggestions.length).toBeGreaterThan(0);
    for (const s of result.suggestions) {
      const retried = defaultEvaluators.scheme("pm-kisan", {
        ...input,
        [s.input]: s.to,
      });
      expect(retried.status).toBe("eligible");
    }
    expect(result.suggestions.length).toBeLessThanOrEqual(5);
  });

  it('handles a blank number as "not answered" rather than zero', () => {
    const blank = runCase(
      schemeCase({
        input: {
          age: 40,
          annualIncome: "",
          employment: "farmer",
          ownsAgriculturalLand: true,
          hasAadhaar: true,
        },
        expected: "conditional",
      }),
    );
    expect(blank.status).toBe("pass");
    expect(blank.drivers.some((d) => d.state === "unknown")).toBe(true);
  });

  it("can end in the unknown status for the scheme checker", () => {
    const result = runCase({
      id: "age-not-answered",
      name: "Age not answered",
      subject: { kind: "scheme", id: "driving-license" },
      input: { age: "", hasLearnerLicense: true, isStudent: false },
      expected: "unknown",
      synthetic: true,
    });
    expect(result.status).toBe("pass");
  });

  it("checks pinned criteria and reports the ones that changed", () => {
    const ok = runCase(
      schemeCase({ expectedCriteria: { landholding: "satisfied" } }),
    );
    expect(ok.status).toBe("pass");

    const evaluation = {
      status: "eligible",
      criteria: [
        {
          id: "landholding",
          label: "Land",
          state: "missing",
          detail: "No land",
        },
      ],
    };
    const changed = runCase(
      schemeCase({ expectedCriteria: { landholding: "satisfied" } }),
      fixed(evaluation),
    );
    expect(changed.status).toBe("mismatch");
    expect(changed.criteriaMismatches).toEqual([
      {
        id: "landholding",
        label: "Land",
        expected: "satisfied",
        actual: "missing",
        detail: "No land",
      },
    ]);
    expect(changed.suggestions).toEqual([]);
  });

  it("reports a criterion that is no longer evaluated as absent", () => {
    const result = runCase(
      schemeCase({ expectedCriteria: { gone: "satisfied" } }),
      fixed({ status: "eligible", criteria: [] }),
    );
    expect(result.status).toBe("mismatch");
    expect(result.criteriaMismatches[0]).toMatchObject({
      id: "gone",
      actual: "absent",
    });
  });

  it("never throws: an evaluator failure becomes an error result", () => {
    const boom = {
      scheme: () => {
        throw new Error("rule exploded");
      },
      service: () => {
        throw new Error("rule exploded");
      },
    };
    const result = runCase(schemeCase(), boom);
    expect(result.status).toBe("error");
    expect(result.message).toContain("rule exploded");
  });

  it("reports an invalid case as an error without calling the evaluator", () => {
    let called = false;
    const spy = {
      scheme: () => {
        called = true;
        return { status: "eligible" };
      },
      service: () => ({ status: "eligible" }),
    };
    const result = runCase(schemeCase({ synthetic: false }), spy);
    expect(result.status).toBe("error");
    expect(called).toBe(false);
    expect(runCase(undefined).status).toBe("error");
  });

  it("does not let an evaluator change the stored input", () => {
    const testCase = schemeCase();
    const before = JSON.stringify(testCase);
    runCase(testCase, {
      scheme: (_id, input) => {
        input.age = 1;
        return { status: "eligible", criteria: [] };
      },
      service: () => ({}),
    });
    expect(JSON.stringify(testCase)).toBe(before);
  });

  it("runs service cases through the question-based rules", () => {
    expect(runCase(serviceCase()).status).toBe("pass");
    const mismatch = runCase(serviceCase({ expected: "ineligible" }));
    expect(mismatch.status).toBe("mismatch");
    expect(mismatch.actual).toBe("eligible");
  });
});

describe("defaultEvaluators", () => {
  it("throws for an unknown scheme or service (runCase turns it into an error)", () => {
    expect(() => defaultEvaluators.scheme("nope", {})).toThrow();
    expect(() => defaultEvaluators.service("nope", {})).toThrow();
  });
});

describe("runSuite", () => {
  it("counts add up to the number of cases", () => {
    const { results, summary } = runSuite([
      schemeCase(),
      schemeCase({ id: "wrong", expected: "ineligible" }),
      schemeCase({ id: "broken", synthetic: false }),
    ]);
    expect(results).toHaveLength(3);
    expect(summary).toEqual({ total: 3, pass: 1, mismatch: 1, error: 1 });
  });

  it("treats a non-array as an empty suite", () => {
    expect(runSuite(null).summary).toEqual({
      total: 0,
      pass: 0,
      mismatch: 0,
      error: 0,
    });
  });
});

describe("coverageBySubject", () => {
  it("marks subjects without a case as not regression-tested", () => {
    const subjects = [
      { kind: "scheme", id: "pm-kisan", name: "PM Kisan" },
      { kind: "scheme", id: "passport", name: "Passport" },
    ];
    const coverage = coverageBySubject([schemeCase()], subjects);
    expect(coverage[0]).toMatchObject({
      id: "pm-kisan",
      cases: 1,
      regressionTested: true,
    });
    expect(coverage[1]).toMatchObject({
      id: "passport",
      cases: 0,
      regressionTested: false,
    });
  });

  it("does not mix a scheme and a service that share an id", () => {
    const coverage = coverageBySubject(
      [serviceCase()],
      [
        { kind: "scheme", id: "driving-license", name: "DL scheme" },
        { kind: "service", id: "driving-license", name: "DL service" },
      ],
    );
    expect(coverage.map((c) => c.cases)).toEqual([0, 1]);
  });
});

describe("custom case storage", () => {
  it("starts empty and without storage", () => {
    expect(loadCustomCases(memoryStorage())).toEqual([]);
    expect(loadCustomCases(null)).toEqual([]);
  });

  it("adds, updates and removes a case under its own key", () => {
    const storage = memoryStorage();
    addCase(schemeCase(), { storage });
    expect(storage.getItem(CASES_STORAGE_KEY)).toContain("farmer-with-land");
    expect(loadCustomCases(storage)).toHaveLength(1);

    updateCase(schemeCase({ name: "Renamed" }), { storage });
    expect(loadCustomCases(storage)[0].name).toBe("Renamed");

    removeCase("farmer-with-land", { storage });
    expect(loadCustomCases(storage)).toEqual([]);
  });

  it("rejects an invalid case and a duplicate id, including one of the shipped cases", () => {
    const storage = memoryStorage();
    expect(() =>
      addCase(schemeCase({ synthetic: false }), { storage }),
    ).toThrow(/synthetic/);
    addCase(schemeCase(), { storage });
    expect(() => addCase(schemeCase(), { storage })).toThrow(/already exists/);
    expect(() =>
      addCase(schemeCase({ id: "shipped-one" }), {
        storage,
        shipped: [{ id: "shipped-one" }],
      }),
    ).toThrow(/already exists/);
  });

  it("refuses to edit or remove a shipped case", () => {
    const storage = memoryStorage();
    const shipped = [schemeCase()];
    expect(() => updateCase(schemeCase(), { storage, shipped })).toThrow(
      /Shipped/,
    );
    expect(() => removeCase("farmer-with-land", { storage, shipped })).toThrow(
      /Shipped/,
    );
  });

  it("fails clearly when the case to update or remove does not exist", () => {
    const storage = memoryStorage();
    expect(() => updateCase(schemeCase(), { storage })).toThrow(
      /No custom case/,
    );
    expect(() => removeCase("nothing", { storage })).toThrow(/No custom case/);
  });

  it("caps the custom cases of one subject", () => {
    const storage = memoryStorage();
    for (let i = 0; i < MAX_CASES_PER_SUBJECT; i += 1)
      addCase(schemeCase({ id: `case-${i}` }), { storage });
    expect(() =>
      addCase(schemeCase({ id: "one-too-many" }), { storage }),
    ).toThrow(/at most/);
    // another subject is not affected
    expect(() => addCase(serviceCase(), { storage })).not.toThrow();
  });

  it("ignores corrupt storage and entries that are not valid cases", () => {
    const storage = memoryStorage();
    storage.setItem(CASES_STORAGE_KEY, "{not json");
    expect(loadCustomCases(storage)).toEqual([]);
    storage.setItem(
      CASES_STORAGE_KEY,
      JSON.stringify([schemeCase(), { id: "junk" }, "text"]),
    );
    expect(loadCustomCases(storage).map((c) => c.id)).toEqual([
      "farmer-with-land",
    ]);
    storage.setItem(CASES_STORAGE_KEY, JSON.stringify({ not: "a list" }));
    expect(loadCustomCases(storage)).toEqual([]);
  });

  it("throws a readable error when storage is unavailable for a write", () => {
    expect(() => addCase(schemeCase(), { storage: null })).toThrow(
      /storage is not available/,
    );
  });
});

describe("shipped cases", () => {
  it("are all valid, fictional and have unique ids", () => {
    const ids = SHIPPED_CASES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of SHIPPED_CASES) {
      expect(validateCase(c), c.id).toEqual([]);
      expect(c.synthetic).toBe(true);
    }
  });

  it("all pass against the current rules", () => {
    const { results, summary } = runSuite(SHIPPED_CASES);
    const failing = results
      .filter((r) => r.status !== "pass")
      .map((r) => `${r.caseId}: ${r.message}`);
    expect(failing).toEqual([]);
    expect(summary.pass).toBe(SHIPPED_CASES.length);
  });

  it("cover every scheme and every service", () => {
    const missing = coverageBySubject(SHIPPED_CASES)
      .filter((c) => !c.regressionTested)
      .map((c) => `${c.kind}:${c.id}`);
    expect(missing).toEqual([]);
  });
});
