/**
 * Single Vercel serverless entry point for all Civic Help Setu API routes.
 * Keeping handlers under api/_lib prevents Vercel from deploying each file
 * as a separate function while preserving their public /api/* URLs.
 */
import addressChange from "./_lib/handlers/address-change-corrections.js";
import businessLicence from "./_lib/handlers/business-licence-feedback.js";
import communityFacility from "./_lib/handlers/community-facility-corrections.js";
import crematorium from "./_lib/handlers/crematorium-corrections.js";
import emailPreferences from "./_lib/handlers/email/preferences.js";
import emailVerify from "./_lib/handlers/email/verify.js";
import fireCompliance from "./_lib/handlers/fire-compliance-feedback.js";
import libraryCorrections from "./_lib/handlers/library-corrections.js";
import pdsObservations from "./_lib/handlers/pds-observations.js";
import privacyExports from "./_lib/handlers/privacy-exports.js";
import rentalChecklist from "./_lib/handlers/rental-checklist-corrections.js";
import sendEmail from "./_lib/handlers/send-email.js";
import shareByEmail from "./_lib/handlers/share-by-email.js";
import tenderCorrections from "./_lib/handlers/tender-corrections.js";
import wardBudgetProposals from "./_lib/handlers/ward-budget-proposals.js";
import waterTankerReports from "./_lib/handlers/water-tanker-reports.js";
import civicSurveys from "./_lib/handlers/civic-surveys.js";
import agentReviewStudio from "./_lib/handlers/agent-review-studio.js";

const handlers = {
  "address-change-corrections": addressChange,
  "agent-review-studio": agentReviewStudio,
  "business-licence-feedback": businessLicence,
  "civic-surveys": civicSurveys,
  "community-facility-corrections": communityFacility,
  "crematorium-corrections": crematorium,
  "email/preferences": emailPreferences,
  "email/verify": emailVerify,
  "fire-compliance-feedback": fireCompliance,
  "library-corrections": libraryCorrections,
  "pds-observations": pdsObservations,
  "privacy-exports": privacyExports,
  "rental-checklist-corrections": rentalChecklist,
  "send-email": sendEmail,
  "share-by-email": shareByEmail,
  "tender-corrections": tenderCorrections,
  "ward-budget-proposals": wardBudgetProposals,
  "water-tanker-reports": waterTankerReports,
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

export default async function handler(req, res) {
  const route = getRoute(req);
  const routeHandler = handlers[route];

  if (!routeHandler) {
    return res.status(404).json({ error: "API route not found" });
  }

  try {
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
  } catch (error) {
    console.error(`API dispatcher error for "${route}":`, error);
    if (!res.writableEnded) {
      return res.status(500).json({ error: "Internal Server Error" });
    }
    return undefined;
  }
}
