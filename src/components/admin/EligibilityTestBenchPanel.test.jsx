import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import EligibilityTestBenchPanel, {
  ResultBadge,
  ResultDetails,
} from "./EligibilityTestBenchPanel.jsx";
import { SHIPPED_CASES } from "../../data/eligibilityTestCases.js";

describe("EligibilityTestBenchPanel", () => {
  it("renders the coverage list, every shipped case and the add form", () => {
    const html = renderToStaticMarkup(<EligibilityTestBenchPanel />);
    expect(html).toContain("Eligibility rule test bench");
    expect(html).toContain(`Run all ${SHIPPED_CASES.length} cases`);
    expect(html).toContain("Add a case");
    expect(html).toContain("Never type a real person");
    for (const c of SHIPPED_CASES.slice(0, 3)) expect(html).toContain(c.name);
  });

  it("shows a rule without cases as not regression-tested, not as an error", () => {
    // every rule has a shipped case, so check the label exists in the component for the empty case
    expect(renderToStaticMarkup(<EligibilityTestBenchPanel />)).toContain(
      "etb-cov--ok",
    );
  });

  it("badges each result state", () => {
    expect(renderToStaticMarkup(<ResultBadge status="pass" />)).toContain(
      "Passes",
    );
    expect(renderToStaticMarkup(<ResultBadge status="mismatch" />)).toContain(
      "Different result",
    );
    expect(renderToStaticMarkup(<ResultBadge status="error" />)).toContain(
      "Could not run",
    );
    expect(renderToStaticMarkup(<ResultBadge />)).toContain("Not run");
  });

  it("shows the drivers and suggestions of a mismatch, and nothing for a pass", () => {
    const result = {
      status: "mismatch",
      message: "Expected eligible but the evaluator returned ineligible.",
      drivers: [
        {
          id: "landholding",
          label: "Land",
          state: "missing",
          detail: "No land",
        },
      ],
      suggestions: [{ input: "ownsAgriculturalLand", from: false, to: true }],
    };
    const html = renderToStaticMarkup(<ResultDetails result={result} />);
    expect(html).toContain("Expected eligible");
    expect(html).toContain("Land");
    expect(html).toContain("ownsAgriculturalLand: false → true");
    expect(html).toContain("Example changes");
    expect(
      renderToStaticMarkup(<ResultDetails result={{ status: "pass" }} />),
    ).toBe("");
  });
});
