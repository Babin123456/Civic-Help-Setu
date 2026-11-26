/**
 * src/pages/FederatedQueryExplorer.test.jsx
 * Component tests for FederatedQueryExplorer (#1162).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";
import FederatedQueryExplorer from "./FederatedQueryExplorer";
import { resetAllConnectors } from "../services/federatedConnectors/index.js";

describe("FederatedQueryExplorer (#1162)", () => {
  beforeEach(() => {
    resetAllConnectors();
  });

  const renderComponent = () => {
    return renderToString(<FederatedQueryExplorer />);
  };

  it("renders the main heading and decentralized architecture badge", () => {
    const html = renderComponent();
    expect(html).toContain("Federated Civic Data Query Layer");
    expect(html).toContain("Decentralized Architecture v1.0.0");
  });

  it("renders statutory scope boundary and legal disclaimer", () => {
    const html = renderComponent();
    expect(html).toContain("Scope &amp; Operational Disclaimer:");
    expect(html).toContain("Data summaries do not confer official administrative verification");
  });

  it("renders registered department connector status cards", () => {
    const html = renderComponent();
    expect(html).toContain("DWSS");
    expect(html).toContain("Department of Water Supply &amp; Sewerage");
    expect(html).toContain("PWRD");
    expect(html).toContain("Public Works &amp; Roads Department");
    expect(html).toContain("MHSD");
    expect(html).toContain("Municipal Health &amp; Sanitation Directorate");
    expect(html).toContain("DUPT");
    expect(html).toContain("Directorate of Urban Public Transit");
  });

  it("renders query configuration inputs and authorized civic purposes", () => {
    const html = renderComponent();
    expect(html).toContain("Query Configuration &amp; Purpose Scope");
    expect(html).toContain("Authorized Civic Purpose (Required)");
    expect(html).toContain("Civic Infrastructure Planning &amp; Maintenance");
    expect(html).toContain("Execute Federated Query");
  });

  it("renders maintainer failure simulation button", () => {
    const html = renderComponent();
    expect(html).toContain("Simulate Failures");
  });
});
