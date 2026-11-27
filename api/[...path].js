/* global process */
import { withApiErrorContract } from './_lib/errorContract.js';
import fairScheduler from "./_lib/fairSchedulerRoute.js";
import partnerIngestion from "./_lib/partner-ingestion.js";
import abuseControlPlane from "./_lib/abuse-control-plane.js";
import applicationEvents from "./_lib/application-events.js";
import civicAgentCostCarbon from "./_lib/civic-agent-cost-carbon.js";
import civicAgentPolicy from "./_lib/civic-agent-policy.js";
import civicContractTestMarketplace from "./_lib/civic-contract-test-marketplace.js";
import civicRecommendationExperimentation from "./_lib/civic-recommendation-experimentation.js";
import explainableServiceRanker from "./_lib/handlers/explainable-service-ranker.js";
import civicSourceFreshnessPrediction from "./_lib/civic-source-freshness-prediction.js";
import counterJourney from "./_lib/counter-journey.js";
import importBatches from "./_lib/import-batches.js";
import neighbourhoodResourceExchange from "./_lib/neighbourhood-resource-exchange.js";
import roadHazards from "./_lib/road-hazards.js";

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
import bottleneckFeedback from "./_lib/handlers/bottleneck-feedback.js";
import addressChange from "./_lib/handlers/address-change-corrections.js";
import businessLicence from "./_lib/handlers/business-licence-feedback.js";
import catalogueVisualQa from "./_lib/handlers/catalogue-visual-qa.js";
import communityFacility from "./_lib/handlers/community-facility-corrections.js";
import civicContributionPipeline from "./_lib/handlers/civic-contribution-pipeline.js";
import counterDemandReports from "./_lib/handlers/counter-demand-reports.js";
import crematorium from "./_lib/handlers/crematorium-corrections.js";
import emailPreferences from "./_lib/handlers/email/preferences.js";
import emailVerify from "./_lib/handlers/email/verify.js";
import fireCompliance from "./_lib/handlers/fire-compliance-feedback.js";
import knowledgeProvenance from "./_lib/handlers/knowledge-provenance.js";
import libraryCorrections from "./_lib/handlers/library-corrections.js";
import pdsObservations from "./_lib/handlers/pds-observations.js";
import officeComparison from "./_lib/handlers/office-comparison.js";
import officeVerificationCampaigns from "./_lib/handlers/office-verification-campaigns.js";
import privacyExports from "./_lib/handlers/privacy-exports.js";
import rentalChecklist from "./_lib/handlers/rental-checklist-corrections.js";
import sendEmail from "./_lib/handlers/send-email.js";
import shareByEmail from "./_lib/handlers/share-by-email.js";
import tenderCorrections from "./_lib/handlers/tender-corrections.js";
import transitConcessions from "./_lib/handlers/transit-concessions.js";
import openContractingAnalytics from "./_lib/handlers/open-contracting-analytics.js";
import wardBudgetProposals from "./_lib/handlers/ward-budget-proposals.js";
import wardAnalytics from "./_lib/handlers/ward-analytics.js";
import waterTankerReports from "./_lib/handlers/water-tanker-reports.js";
import civicSurveys from "./_lib/handlers/civic-surveys.js";
import temporalPolicy from "./_lib/handlers/temporal-policy.js";
import portalChangeMonitor from "./_lib/handlers/portal-change-monitor.js";
import agentReviewStudio from "./_lib/handlers/agent-review-studio.js";
import civicAgentEval from "./_lib/handlers/civic-agent-eval.js";

import verifiableEvidenceBundles from "./_lib/handlers/verifiable-evidence-bundles.js";

import zkAttributeProofVerify from "./_lib/handlers/zk-attribute-proof-verify.js";
import federatedCivicQuery from "./_lib/handlers/federated-civic-query.js";
import searchQueryRecovery from "./_lib/handlers/search-query-recovery.js";


import civicDataCleanRoom from "./_lib/handlers/civic-data-clean-room.js";

import floodIncidentReports from "./_lib/handlers/flood-incident-reports.js";
import schoolZoneAudits from "./_lib/handlers/school-zone-audits.js";
import civicDraftSync from "./_lib/handlers/civic-draft-sync.js";
import schoolDefectRegister from "./_lib/handlers/school-defect-register.js";
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
import disasterReliefBoard from "./_lib/handlers/disaster-relief-board.js";
import jurisdictionHandoff from "./_lib/handlers/jurisdiction-handoff.js";
import redactedSharingRoom from "./_lib/handlers/redacted-sharing-room.js";

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
import multiRegionStatus from "./_lib/handlers/multi-region-status.js";
import caseCollaboration from "./_lib/handlers/case-collaboration.js";
import syntheticDatasets from "./_lib/syntheticDatasets.js";
import cacheManagement from "./_lib/handlers/cache-management.js";
import { withRequestSecurity } from "./_lib/requestSecurity.js";
import { createMeshReadinessHandler } from "./_lib/handlers/mesh-readiness.js";
import { createMeshReadinessLayer } from "./_lib/mesh/middleware.js";
import { createDefaultGatewayMiddleware, getGatewayHealth, getGatewayMetrics } from "./_lib/gateway/gatewayMiddleware.js";
import { getDefaultRegistry as getContractRegistry } from "./_lib/versioning/contractRegistry.js";
import { SUPPORTED_VERSIONS, DEFAULT_VERSION } from "./_lib/versioning/versionConfig.js";
import { createIdempotencyLayer, resolveIdempotencyConfig } from "./_lib/idempotencyMiddleware.js";
import { createCacheMiddleware, getCacheSystem } from "./_lib/cacheMiddleware.js";
import { createCacheFeatureFlagEngine } from "../src/services/distributedCache/index.js";
import { createDefaultBackpressureMiddleware } from "./_lib/backpressureMiddleware.js";


const baseHandlers = {
  "bottleneck-feedback": bottleneckFeedback,
  "fair-scheduler": fairScheduler,
  "partner-ingestion": partnerIngestion,
  "abuse-control-plane": abuseControlPlane,
  "application-events": applicationEvents,
  "civic-agent-cost-carbon": civicAgentCostCarbon,
  "civic-agent-policy": civicAgentPolicy,
  "civic-contract-test-marketplace": civicContractTestMarketplace,
  "civic-recommendation-experimentation": civicRecommendationExperimentation,
  "explainable-service-ranker": explainableServiceRanker,
  "civic-source-freshness-prediction": civicSourceFreshnessPrediction,
  "counter-journey": counterJourney,
  "import-batches": importBatches,
  "neighbourhood-resource-exchange": neighbourhoodResourceExchange,
  "road-hazards": roadHazards,
  "agent-incident-response": agentIncidentResponse,
  "address-change-corrections": addressChange,
  "agent-review-studio": agentReviewStudio,
  "civic-agent-eval": civicAgentEval,
  "business-licence-feedback": businessLicence,

  "civic-data-clean-room": civicDataCleanRoom,

  "catalogue-visual-qa": catalogueVisualQa,

  "civic-surveys": civicSurveys,
  "accessibility-inspector": accessibilityInspector,
  "community-facility-corrections": communityFacility,
  "civic-contribution-pipeline": civicContributionPipeline,
  "counter-demand-reports": counterDemandReports,
  "crematorium-corrections": crematorium,
  "email/preferences": emailPreferences,
  "email/verify": emailVerify,
  "federated-civic-query": federatedCivicQuery,
  "search-query-recovery": searchQueryRecovery,
  "fire-compliance-feedback": fireCompliance,
  "flood-incident-reports": floodIncidentReports,
  "heat-relief-observations": heatReliefObservations,
  "heatwave-cooling-directory": heatReliefObservations,
  "knowledge-provenance": knowledgeProvenance,
  "civic-release-ledger": civicReleaseLedger,
  "library-corrections": libraryCorrections,
  "office-comparison": officeComparison,
  "office-verification-campaigns": officeVerificationCampaigns,
  "open-contracting-analytics": openContractingAnalytics,
  "pds-observations": pdsObservations,
  "pedestrian-barriers": pedestrianBarriers,
  "privacy-exports": privacyExports,
  "public-toilets": publicToilets,
  "rental-checklist-corrections": rentalChecklist,
  "send-email": sendEmail,
  "share-by-email": shareByEmail,
  "temporal-policy": temporalPolicy,
  "portal-change-monitor": portalChangeMonitor,
  "tender-corrections": tenderCorrections,

  "verifiable-evidence-bundles": verifiableEvidenceBundles,


  "ward-analytics": wardAnalytics,

  "transit-concessions": transitConcessions,


  "ward-budget-proposals": wardBudgetProposals,
  "water-quality-register": waterQualityRegister,
  "ward-issue-heatmap": wardIssueHeatmap,
  "water-tanker-reports": waterTankerReports,

  "zk-attribute-proof-verify": zkAttributeProofVerify,

  "school-zone-audits": schoolZoneAudits,
  "civic-draft-sync": civicDraftSync,
  "school-defect-register": schoolDefectRegister,
  "public-projects": publicProjects,
  "tenant-administration": tenantAdministration,
  "ghg-inventory": ghgInventory,
  "micro-volunteer": microVolunteer,
  "micro-volunteer-board": microVolunteer,
  "relief-operations": reliefOperations,
  "disaster-relief-board": disasterReliefBoard,
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
  "multi-region-health": multiRegionStatus,
  "multi-region-status": multiRegionStatus,
  "multi-region-metrics": multiRegionStatus,
  "case-collaboration": caseCollaboration,
  "redacted-sharing-room": redactedSharingRoom,
  "synthetic-datasets": syntheticDatasets,
  "cache": cacheManagement,
  "cache/status": cacheManagement,
  "cache/metrics": cacheManagement,
  "cache/invalidate": cacheManagement,
  "cache/flush": cacheManagement,
  "cache/health": cacheManagement,
  "cache-management": cacheManagement,
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

function normalizeLegacyResult(result, res) {
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

// Cache system singleton for the dispatcher
let cacheSystemPromise = null;
let cacheMiddleware = null;

/**
 * Initialize the cache system and middleware.
 */
async function initializeCacheSystem() {
  if (cacheSystemPromise) return cacheSystemPromise;

  cacheSystemPromise = (async () => {
    // Create feature flag engine for cache rollout
    const ffEngine = createCacheFeatureFlagEngine({
      initialFlags: {
        'civic.cache.distributed': { defaultEnabled: true, rolloutPercentage: 100, killSwitch: false, exposure: 'server' },
        'civic.cache.invalidation': { defaultEnabled: true, rolloutPercentage: 100, killSwitch: false, exposure: 'server' },
      },
    });

    const cacheSystem = await getCacheSystem({
      featureFlagEngine: ffEngine,
      featureFlagContext: {}, // Will be populated per-request
      onMetric: (metric) => {
        // In production, send to metrics system
        if (process.env.NODE_ENV !== 'test') {
          console.debug('[Cache Metric]', JSON.stringify(metric));
        }
      },
      onError: (err) => console.error('[Cache System]', err),
    });

    cacheMiddleware = createCacheMiddleware(cacheSystem);
    return cacheSystem;
  })();

  return cacheSystemPromise;
}

export function createApiDispatcher({
  meshLayer = createMeshReadinessLayer(),
  idempotencyLayer = createIdempotencyLayer(resolveIdempotencyConfig()),
  extraHandlers = {},
  gatewayMiddleware = createDefaultGatewayMiddleware(),
  backpressureMiddleware = createDefaultBackpressureMiddleware(),
} = {}) {
  const openApiHandler = async (req, res) => {
    const rawRoute = getRoute(req) || "";
    const routeParts = rawRoute.replace(/^(v\d+)\//, "").split("/");
    const pathVersion = routeParts.length > 1 && routeParts[0] === "openapi" ? routeParts[1] : null;
    const requestedVersion = req.query?.version || pathVersion || req.apiVersion || DEFAULT_VERSION;

    if (!SUPPORTED_VERSIONS.includes(requestedVersion)) {
      return res.status(400).json({
        error: "unsupported_version",
        code: "UNSUPPORTED_VERSION",
        message: `Version ${requestedVersion} is not supported. Supported versions: ${SUPPORTED_VERSIONS.join(", ")}`,
        supportedVersions: SUPPORTED_VERSIONS,
      });
    }

    const registry = getContractRegistry();
    const contract = await registry.getContract(requestedVersion);

    if (req.headers?.["if-none-match"] && contract.etag && req.headers["if-none-match"] === contract.etag) {
      return res.status(304).end();
    }

    res.setHeader("Content-Type", "application/json");
    if (contract.etag) {
      res.setHeader("ETag", contract.etag);
    }
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    return res.status(200).json(contract.spec);
  };

  const handlers = {
    ...baseHandlers,
    "mesh-readiness": createMeshReadinessHandler({ meshLayer }),
    "gateway-health": async (req, res) => res.json(getGatewayHealth()),
    "gateway-metrics": async (req, res) => res.json(getGatewayMetrics()),
    "openapi": openApiHandler,
    "openapi/v1": openApiHandler,
    "openapi/v2": openApiHandler,
    ...extraHandlers,
  };

  return async function handler(req, res) {
    const rawRoute = getRoute(req);
    const versionPrefixMatch = rawRoute.match(/^(v\d+)\/(.*)$/);
    const targetRoute = versionPrefixMatch ? versionPrefixMatch[2] : rawRoute;

    if (gatewayMiddleware) {
      await new Promise((resolve, reject) => {
        let settled = false;
        const done = (err) => {
          if (settled) return;
          settled = true;
          if (err) reject(err);
          else resolve();
        };

        Promise.resolve(gatewayMiddleware(req, res, done))
          .then(() => {
            if (!settled) {
              settled = true;
              resolve();
            }
          })
          .catch((err) => {
            if (!settled) {
              settled = true;
              reject(err);
            }
          });
      }).catch(() => {
        return;
      });

      if (res.writableEnded) return;
    }

    // Backpressure middleware (after gateway, before route handler)
    if (backpressureMiddleware) {
      await new Promise((resolve, reject) => {
        let settled = false;
        const done = (err) => {
          if (settled) return;
          settled = true;
          if (err) reject(err);
          else resolve();
        };

        Promise.resolve(backpressureMiddleware(req, res, done))
          .then(() => {
            if (!settled) {
              settled = true;
              resolve();
            }
          })
          .catch((err) => {
            if (!settled) {
              settled = true;
              reject(err);
            }
          });
      }).catch(() => {
        return;
      });

      if (res.writableEnded) return;
    }

    const delegatedApiRoutes = [
      "abuse-control-plane",
      "application-events",
      "civic-agent-cost-carbon",
      "civic-agent-eval",
      "school-defect-register",
      "civic-agent-policy",
      "civic-contract-test-marketplace",
      "civic-recommendation-experimentation",
      "civic-source-freshness-prediction",
      "counter-journey",
      "import-batches",
      "neighbourhood-resource-exchange",
      "road-hazards",
    ];
    const delegatedRoute = delegatedApiRoutes.find(
      (route) => targetRoute === route || targetRoute.startsWith(`${route}/`)
    );

    const routeHandler =
      (graphRoutes[rawRoute] || graphRoutes[targetRoute]) && req.method === "GET"
        ? (r, s) => invokeGraphHandler(r, s, graphRoutes[rawRoute] || graphRoutes[targetRoute])
        : (graphPostRoutes[rawRoute] || graphPostRoutes[targetRoute]) && req.method === "POST"
          ? (r, s) => invokeGraphHandler(r, s, graphPostRoutes[rawRoute] || graphPostRoutes[targetRoute])
          : handlers[rawRoute] || handlers[targetRoute] || (delegatedRoute ? handlers[delegatedRoute] : undefined);

    if (!routeHandler) {
      return res.status(404).json({ error: "API route not found" });
    }

    try {
      // Initialize cache system on first request
      await initializeCacheSystem();

      // Apply cache middleware to attach cache helpers to request
      await new Promise((resolve, reject) => {
        cacheMiddleware(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const effectiveRoute = targetRoute || rawRoute;
      let delegatedRequest = req;
      if (delegatedRoute) {
        const forwardedHost = req.headers?.["x-forwarded-host"] || req.headers?.host || "localhost";
        const forwardedProto = req.headers?.["x-forwarded-proto"] || "https";
        const normalizedUrl = new URL(req.url || "/", `${forwardedProto}://${forwardedHost}`);
        normalizedUrl.pathname = `/api/${targetRoute}`;
        normalizedUrl.searchParams.delete("path");
        delegatedRequest = Object.create(req);
        delegatedRequest.url = `${normalizedUrl.pathname}${normalizedUrl.search}`;
        delegatedRequest.query = { ...(req.query || {}) };
        delete delegatedRequest.query.path;
      }
      const wrappedHandler = (r, s) => {
        const request = delegatedRoute ? delegatedRequest : r;
        return idempotencyLayer.execute(
          request,
          s,
          effectiveRoute,
          () => routeHandler(request, s)
        );
      };
      const result = await meshLayer.executeRoute(req, res, effectiveRoute, wrappedHandler);
      return normalizeLegacyResult(result, res);
    } catch (error) {
      console.error(`API dispatcher error for "${targetRoute}":`, error);
      if (!res.writableEnded) {
        return res.status(500).json({ error: "Internal Server Error" });
      }
      return undefined;
    }
  };
}

// Wrap the dispatcher with Error Contract and CSRF/Origin/CORS enforcement.
// allowMissingOrigin: true keeps direct server-to-server calls working on
// legacy top-level functions; forged Origins and cookie CSRF are always enforced.
export default withApiErrorContract(withRequestSecurity(createApiDispatcher(), { allowMissingOrigin: true }));
