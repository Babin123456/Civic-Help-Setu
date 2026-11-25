import { withApiErrorContract } from './_lib/errorContract.js';
/**
 * Single Vercel serverless entry point for all Civic Help Setu API routes.
 * Keeping handlers under api/_lib prevents Vercel from deploying each file
 * as a separate function while preserving their public /api/* URLs.
 *
 * All mutation endpoints are protected by CSRF, Origin and CORS validation
 * (api/_lib/requestSecurity.js). Read-only endpoints (GET/HEAD/OPTIONS) remain
 * publicly accessible. Configuration is via server-only environment variables:
 *   APP_ORIGIN, APP_ALLOWED_ORIGINS, APP_CORS_ALLOW_CREDENTIALS,
 *   CSRF_COOKIE_NAME, CSRF_HEADER_NAME, APP_REQUIRE_ORIGIN, APP_ALLOW_MISSING_ORIGIN
 */
import addressChange from "./_lib/handlers/address-change-corrections.js";
import businessLicence from "./_lib/handlers/business-licence-feedback.js";
import catalogueVisualQa from "./_lib/handlers/catalogue-visual-qa.js";
import communityFacility from "./_lib/handlers/community-facility-corrections.js";
import counterDemandReports from "./_lib/handlers/counter-demand-reports.js";
import crematorium from "./_lib/handlers/crematorium-corrections.js";
import emailPreferences from "./_lib/handlers/email/preferences.js";
import emailVerify from "./_lib/handlers/email/verify.js";
import fireCompliance from "./_lib/handlers/fire-compliance-feedback.js";
import knowledgeProvenance from "./_lib/handlers/knowledge-provenance.js";
import libraryCorrections from "./_lib/handlers/library-corrections.js";
import pdsObservations from "./_lib/handlers/pds-observations.js";
import officeComparison from "./_lib/handlers/office-comparison.js";
import privacyExports from "./_lib/handlers/privacy-exports.js";
import rentalChecklist from "./_lib/handlers/rental-checklist-corrections.js";
import sendEmail from "./_lib/handlers/send-email.js";
import shareByEmail from "./_lib/handlers/share-by-email.js";
import tenderCorrections from "./_lib/handlers/tender-corrections.js";
import transitConcessions from "./_lib/handlers/transit-concessions.js";
import openContractingAnalytics from "./_lib/handlers/open-contracting-analytics.js";
import wardBudgetProposals from "./_lib/handlers/ward-budget-proposals.js";
import waterTankerReports from "./_lib/handlers/water-tanker-reports.js";
import civicSurveys from "./_lib/handlers/civic-surveys.js";

import civicDataCleanRoom from "./_lib/handlers/civic-data-clean-room.js";

import floodIncidentReports from "./_lib/handlers/flood-incident-reports.js";
import schoolZoneAudits from "./_lib/handlers/school-zone-audits.js";
import heatReliefObservations from "./_lib/handlers/heat-relief-observations.js";

import { GET as graphGET, POST as graphPOST } from "./_lib/graphRoute.js";
import {
  GET_REVIEW_QUEUE as reviewQueueGET,
  POST as reviewPOST,
  POST_APPROVE as approvePOST,
  POST_REJECT as rejectPOST,
} from "./_lib/graphRoute.js";

import accessibilityInspector from "./_lib/handlers/accessibility-inspector.js";

import publicToilets from "./_lib/handlers/public-toilets.js";
import pedestrianBarriers from "./_lib/handlers/pedestrian-barriers.js";
import waterQualityRegister from "./_lib/handlers/water-quality-register.js";
import publicProjects from "./_lib/handlers/public-projects.js";
import wardIssueHeatmap from "./_lib/handlers/ward-issue-heatmap.js";
import tenantAdministration from "./_lib/handlers/tenant-administration.js";
import ghgInventory from "./_lib/handlers/ghg-inventory.js";
import microVolunteer from "./_lib/handlers/micro-volunteer.js";
import reliefOperations from "./_lib/handlers/relief-operations.js";
import jurisdictionHandoff from "./_lib/handlers/jurisdiction-handoff.js";

import agentSandbox from "./_lib/handlers/agent-sandbox.js";
import agentIncidentResponse from "./_lib/handlers/agent-incident-response.js";
import policySimulation from "./_lib/handlers/policy-simulation.js";
import serviceChangeSandbox from "./_lib/handlers/service-change-sandbox.js";
import civicReleaseLedger from "./_lib/handlers/civic-release-ledger.js";
import civicChaosEngineering from "./_lib/handlers/civic-chaos-engineering.js";
import complaintQualityCoach from "./_lib/handlers/complaint-quality-coach.js";
import civicEvidenceLocker from "./_lib/handlers/civic-evidence-locker.js";
import journeyBenchmark from "./_lib/handlers/journey-benchmark.js";
import civicKnowledgeGraph from "./_lib/handlers/civic-knowledge-graph.js";
import caseCollaboration from "./_lib/handlers/case-collaboration.js";
import syntheticDatasets from "./_lib/syntheticDatasets.js";

import { withRequestSecurity, internalErrorResponse } from "./_lib/requestSecurity.js";



const handlers = {
  "agent-incident-response": agentIncidentResponse,
  "address-change-corrections": addressChange,
  "business-licence-feedback": businessLicence,

  "civic-data-clean-room": civicDataCleanRoom,

  "catalogue-visual-qa": catalogueVisualQa,

  "civic-surveys": civicSurveys,
  "accessibility-inspector": accessibilityInspector,
  "community-facility-corrections": communityFacility,
  "counter-demand-reports": counterDemandReports,
  "crematorium-corrections": crematorium,
  "email/preferences": emailPreferences,
  "email/verify": emailVerify,
  "fire-compliance-feedback": fireCompliance,
  "flood-incident-reports": floodIncidentReports,
  "heat-relief-observations": heatReliefObservations,
  "knowledge-provenance": knowledgeProvenance,
  "civic-release-ledger": civicReleaseLedger,
  "library-corrections": libraryCorrections,
  "office-comparison": officeComparison,
  "open-contracting-analytics": openContractingAnalytics,
  "pds-observations": pdsObservations,
  "pedestrian-barriers": pedestrianBarriers,
  "privacy-exports": privacyExports,
  "public-toilets": publicToilets,
  "rental-checklist-corrections": rentalChecklist,
  "send-email": sendEmail,
  "share-by-email": shareByEmail,
  "tender-corrections": tenderCorrections,
  "transit-concessions": transitConcessions,
  "ward-budget-proposals": wardBudgetProposals,
  "water-quality-register": waterQualityRegister,
  "ward-issue-heatmap": wardIssueHeatmap,
  "water-tanker-reports": waterTankerReports,
  "school-zone-audits": schoolZoneAudits,
  "public-projects": publicProjects,
  "tenant-administration": tenantAdministration,
  "ghg-inventory": ghgInventory,
  "micro-volunteer": microVolunteer,
  "micro-volunteer-board": microVolunteer,
  "relief-operations": reliefOperations,
  "jurisdiction-handoff": jurisdictionHandoff,
  "agent-sandbox": agentSandbox,
  "policy-simulation": policySimulation,
  "civic-chaos-engineering": civicChaosEngineering,
  "complaint-quality-coach": complaintQualityCoach,
  "civic-evidence-locker": civicEvidenceLocker,
  "service-change-sandbox": serviceChangeSandbox,
  "journey-benchmark": journeyBenchmark,
  "civic-knowledge-graph": civicKnowledgeGraph,
  "knowledge-graph": civicKnowledgeGraph,
  "case-collaboration": caseCollaboration,
  "synthetic-datasets": syntheticDatasets,
};

// Adapt Fetch-style graph handlers to Vercel's Node request/response API.
async function invokeGraphHandler(req, res, graphHandler) {
  const forwardedHost = req.headers?.["x-forwarded-host"] || req.headers?.host || "localhost";
  const forwardedProto = req.headers?.["x-forwarded-proto"] || "https";
  const requestUrl = new URL(req.url || "/", `${forwardedProto}://${forwardedHost}`);
  const method = (req.method || "GET").toUpperCase();
  const headers = new Headers();

  for (const [name, value] of Object.entries(req.headers || {})) {
    if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
    else if (value !== undefined) headers.set(name, String(value));
  }

  const init = { method, headers };
  if (method !== "GET" && method !== "HEAD") {
    init.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
  }

  const graphResponse = await graphHandler(new Request(requestUrl, init));
  graphResponse.headers.forEach((value, name) => res.setHeader(name, value));
  const body = await graphResponse.text();
  return res.status(graphResponse.status).send(body);
}

// Terminology graph routes. Keep /review as a backwards-compatible alias.
const graphRoutes = {
  "graph": graphGET,
  "graph/review": reviewQueueGET,
  "graph/review/queue": reviewQueueGET,
};

const graphPostRoutes = {
  "graph": graphPOST,
  "graph/review": reviewPOST,
  "graph/review/approve": approvePOST,
  "graph/review/reject": rejectPOST,
};

function getRoute(req) {
  const routeParam = req.query?.path;
  const route = Array.isArray(routeParam)
    ? routeParam.join("/")
    : typeof routeParam === "string"
      ? routeParam
      : (req.url || "").split("?")[0].replace(/^\/api\/?/, "");

  return decodeURIComponent(route).replace(/^\/+|\/+$/g, "");
}

async function handler(req, res) {
  const route = getRoute(req);

  // Handle terminology graph routes
  if (graphRoutes[route] && req.method === "GET") {
    return await invokeGraphHandler(req, res, graphRoutes[route]);
  }

  if (graphPostRoutes[route] && req.method === "POST") {
    return await invokeGraphHandler(req, res, graphPostRoutes[route]);
  }

  const routeHandler = handlers[route];

  if (!routeHandler) {
    return res.status(404).json({ error: "API route not found" });
  }

  const result = await routeHandler(req, res);

  // Normalize legacy handlers that return { status, headers, body } rather
  // than writing directly to the Vercel response object.
  if (
    result &&
    typeof result.status === "number" &&
    Object.prototype.hasOwnProperty.call(result, "body") &&
    !res.writableEnded
  ) {
    for (const [name, value] of Object.entries(result.headers || {})) {
      res.setHeader(name, value);
    }
    return res.status(result.status).json(result.body);
  }

  return result;
}

// Wrap the dispatcher with Error Contract and CSRF/Origin/CORS enforcement.
// allowMissingOrigin: true keeps direct server-to-server calls working on
// legacy top-level functions; forged Origins and cookie CSRF are always enforced.
export default withApiErrorContract(withRequestSecurity(handler, { allowMissingOrigin: true }));
