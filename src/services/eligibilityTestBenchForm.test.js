import { describe, it, expect } from "vitest";
import {
  answersFromCase,
  buildInput,
  saveFormCase,
  suiteNotice,
  withoutResult,
} from "./eligibilityTestBenchForm.js";
import { loadCustomCases, removeCase } from "./eligibilityTestBench.js";

const memory = () => {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
};
const subject = { kind: "scheme", id: "pm-kisan", name: "PM-Kisan" };

describe("test bench form state", () => {
  it("converts answers to typed input and back", () => {
    const input = buildInput(
      { age: "40", ownsAgriculturalLand: "yes", x: "" },
      "scheme",
    );
    expect(input).toEqual({ age: 40, ownsAgriculturalLand: true });
    expect(
      answersFromCase({
        subject,
        input: { age: 40, ownsAgriculturalLand: false },
      }),
    ).toEqual({ age: "40", ownsAgriculturalLand: "no" });
  });

  it("adds, edits (keeping the id) and removes a case", () => {
    const storage = memory();
    const opts = { shipped: [], storage };
    saveFormCase(
      { subject, name: "Farmer", expected: "eligible", answers: { age: "40" } },
      opts,
    );
    const [added] = loadCustomCases(storage);
    expect(added.name).toBe("Farmer");

    const list = saveFormCase(
      {
        editingId: added.id,
        subject,
        name: "Farmer renamed",
        expected: "ineligible",
        answers: { age: "17" },
      },
      opts,
    );
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id: added.id,
      name: "Farmer renamed",
      expected: "ineligible",
      input: { age: 17 },
    });
    expect(removeCase(added.id, opts)).toEqual([]);
  });

  it("surfaces errors for a blank name, a duplicate add and a missing edit", () => {
    const opts = { shipped: [], storage: memory() };
    const base = { subject, expected: "eligible", answers: {} };
    expect(() => saveFormCase({ ...base, name: "  " }, opts)).toThrow();
    saveFormCase({ ...base, name: "One" }, opts);
    expect(() => saveFormCase({ ...base, name: "One" }, opts)).toThrow(
      /already exists/,
    );
    expect(() =>
      saveFormCase({ ...base, name: "x", editingId: "nope" }, opts),
    ).toThrow(/No custom case/);
  });

  it("words the run-all banner and drops one result", () => {
    expect(suiteNotice({ total: 3, pass: 3, mismatch: 0, error: 0 })).toBe(
      "All 3 cases give the expected result.",
    );
    expect(suiteNotice({ total: 3, pass: 1, mismatch: 1, error: 1 })).toBe(
      "1 of 3 cases pass. Different result: 1. Could not run: 1.",
    );
    expect(withoutResult({ a: 1, b: 2 }, "a")).toEqual({ b: 2 });
  });
});
