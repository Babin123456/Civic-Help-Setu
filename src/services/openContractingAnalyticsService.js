/**
 * src/services/openContractingAnalyticsService.js
 * Deterministic, explainable red-flag anomaly detection engine for public procurement (#751).
 *
 * Implements Open Contracting Data Standard (OCDS) red-flag analytics:
 * 1. Repeated Single-Bid Awards (OCDS-RF-01)
 * 2. Abbreviated Bidding Window (OCDS-RF-02)
 * 3. Unusual Amendment Frequency & Cost Escalation (OCDS-RF-03)
 * 4. Price Outlier vs Estimated Benchmark (OCDS-RF-04)
 * 5. High Vendor Win Concentration (OCDS-RF-05)
 *
 * Core Ethical Principles:
 * - Transparent anomaly indicators with comparison cohorts.
 * - Never labels vendors corrupt or triggers automatic sanctions.
 * - Records ruleset version, input feature window, influencing fields, and timestamps.
 * - Deterministic, fast, offline-capable in-memory computation.
 */

import { RED_FLAG_INDICATORS } from '../data/openContractingContract.js';

export const RULESET_VERSION = 'v1.0.0-ocds-deterministic';
export const DEFAULT_FEATURE_WINDOW_DAYS = 180;

/**
 * Calculates days between two date strings or Date objects.
 */
export const calculateDaysBetween = (startIso, endIso) => {
  if (!startIso || !endIso) return 0;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
};

/**
 * Calculates cohort averages across procurement notices for benchmarking.
 */
export const computeCohortBaselines = (notices = [], bids = [], awards = [], amendments = []) => {
  const cohortStats = {};

  notices.forEach((notice) => {
    const key = `${notice.category || 'all'}|${notice.jurisdiction || 'all'}`;
    if (!cohortStats[key]) {
      cohortStats[key] = {
        noticeCount: 0,
        totalWindowDays: 0,
        totalBids: 0,
        noticesWithBids: 0,
        totalEstimatedValue: 0,
        totalAwardedValue: 0,
        noticesWithAwards: 0,
        totalAmendmentsCount: 0,
        totalAmendmentCostDelta: 0,
      };
    }

    const c = cohortStats[key];
    c.noticeCount += 1;

    const windowDays = calculateDaysBetween(notice.publicationDate, notice.submissionDeadline);
    c.totalWindowDays += windowDays;
    c.totalEstimatedValue += Number(notice.estimatedValue || 0);

    const noticeBids = bids.filter((b) => b.noticeId === notice.id);
    if (noticeBids.length > 0) {
      c.totalBids += noticeBids.length;
      c.noticesWithBids += 1;
    }

    const noticeAward = awards.find((a) => a.noticeId === notice.id);
    if (noticeAward) {
      c.totalAwardedValue += Number(noticeAward.awardedAmount || 0);
      c.noticesWithAwards += 1;

      const noticeAmends = amendments.filter((am) => am.awardId === noticeAward.id);
      c.totalAmendmentsCount += noticeAmends.length;
      const amendDelta = noticeAmends.reduce((acc, curr) => acc + Number(curr.costDelta || 0), 0);
      c.totalAmendmentCostDelta += amendDelta;
    }
  });

  // Calculate normalized averages
  const computed = {};
  Object.entries(cohortStats).forEach(([key, stats]) => {
    computed[key] = {
      noticeCount: stats.noticeCount,
      avgWindowDays: stats.noticeCount > 0 ? Number((stats.totalWindowDays / stats.noticeCount).toFixed(1)) : 14,
      avgBidsPerNotice: stats.noticesWithBids > 0 ? Number((stats.totalBids / stats.noticesWithBids).toFixed(1)) : 3.0,
      avgAwardVsEstimateRatio:
        stats.totalEstimatedValue > 0 && stats.totalAwardedValue > 0
          ? Number((stats.totalAwardedValue / stats.totalEstimatedValue).toFixed(2))
          : 0.98,
      avgAmendmentsPerAward:
        stats.noticesWithAwards > 0 ? Number((stats.totalAmendmentsCount / stats.noticesWithAwards).toFixed(1)) : 0.5,
      avgCostEscalationRate:
        stats.totalAwardedValue > 0
          ? Number(((stats.totalAmendmentCostDelta / stats.totalAwardedValue) * 100).toFixed(1))
          : 4.5,
    };
  });

  return computed;
};

/**
 * Runs the full red-flag detection suite across procurement records.
 */
export const runProcurementRedFlagAnalytics = ({
  notices = [],
  bids = [],
  awards = [],
  amendments = [],
  vendors = [],
  featureWindowDays = DEFAULT_FEATURE_WINDOW_DAYS,
  jurisdictionFilter = null,
} = {}) => {
  const filteredNotices = jurisdictionFilter
    ? notices.filter((n) => n.jurisdiction === jurisdictionFilter)
    : notices;

  const cohorts = computeCohortBaselines(notices, bids, awards, amendments);
  const redFlags = [];

  // Vendor win tracking for concentration analysis
  const vendorWins = {};
  const totalAwardsCount = awards.length;

  awards.forEach((award) => {
    vendorWins[award.vendorId] = (vendorWins[award.vendorId] || 0) + 1;
  });

  filteredNotices.forEach((notice) => {
    const noticeBids = bids.filter((b) => b.noticeId === notice.id);
    const noticeAward = awards.find((a) => a.noticeId === notice.id);
    const noticeAmendments = noticeAward
      ? amendments.filter((am) => am.awardId === noticeAward.id)
      : [];

    const cohortKey = `${notice.category || 'all'}|${notice.jurisdiction || 'all'}`;
    const fallbackKey = `all|all`;
    const cohort = cohorts[cohortKey] || cohorts[fallbackKey] || {
      avgWindowDays: 21,
      avgBidsPerNotice: 3.2,
      avgCostEscalationRate: 5.0,
      avgAwardVsEstimateRatio: 0.98,
      noticeCount: 1,
    };

    // ----------------------------------------------------
    // 1. Single-Bid Award in Open Competitive Procurement
    // ----------------------------------------------------
    if (notice.procurementMethod === 'open_competitive') {
      const qualifiedBids = noticeBids.filter((b) => b.isTechnicallyQualified !== false);
      if (noticeBids.length === 1 || (noticeBids.length > 1 && qualifiedBids.length === 1)) {
        redFlags.push({
          id: `FLAG-SBA-${notice.id}`,
          indicatorId: 'single_bid_award',
          indicatorCode: RED_FLAG_INDICATORS.single_bid_award.code,
          indicatorName: RED_FLAG_INDICATORS.single_bid_award.name,
          severity: 'high',
          noticeId: notice.id,
          tenderRefNumber: notice.tenderRefNumber,
          category: notice.category,
          jurisdiction: notice.jurisdiction,
          vendorId: noticeAward?.vendorId || noticeBids[0]?.vendorId,
          title: `Single-Bid Award Pattern on Open Competitive Notice`,
          explanation: `Notice was published under open competitive bidding but only ${noticeBids.length} valid bid was evaluated. Single-bid awards on open tenders reduce competitive price tension.`,
          influencingFields: [
            `procurementMethod: "${notice.procurementMethod}"`,
            `totalBidsSubmitted: ${noticeBids.length}`,
            `qualifiedBidders: ${qualifiedBids.length}`,
          ],
          cohortBenchmark: {
            cohortName: `${notice.category} in ${notice.jurisdiction}`,
            cohortSize: cohort.noticeCount,
            metricLabel: 'Average Bids per Open Notice',
            benchmarkValue: cohort.avgBidsPerNotice,
            recordValue: noticeBids.length,
            variance: `${((1 - (noticeBids.length / cohort.avgBidsPerNotice)) * 100).toFixed(0)}% below cohort average`,
          },
          recommendedAuditorAction: 'Inspect whether minimum advertisement thresholds and bid qualification criteria were restrictive or customized to a specific vendor.',
          rulesetVersion: RULESET_VERSION,
          featureWindowDays,
          executedAt: new Date().toISOString(),
          status: 'pending_review',
        });
      }
    }

    // ----------------------------------------------------
    // 2. Abbreviated Bidding Window (Notice Turnaround Anomaly)
    // ----------------------------------------------------
    const windowDays = calculateDaysBetween(notice.publicationDate, notice.submissionDeadline);
    const statutoryMinDays = Number(notice.estimatedValue) > 5000000 ? 14 : 7;

    if (windowDays > 0 && windowDays < statutoryMinDays) {
      redFlags.push({
        id: `FLAG-SBW-${notice.id}`,
        indicatorId: 'short_bidding_window',
        indicatorCode: RED_FLAG_INDICATORS.short_bidding_window.code,
        indicatorName: RED_FLAG_INDICATORS.short_bidding_window.name,
        severity: windowDays <= 5 ? 'high' : 'medium',
        noticeId: notice.id,
        tenderRefNumber: notice.tenderRefNumber,
        category: notice.category,
        jurisdiction: notice.jurisdiction,
        vendorId: noticeAward?.vendorId,
        title: `Abbreviated Submission Window (${windowDays} Days vs Minimum ${statutoryMinDays} Days)`,
        explanation: `Tender was published with only ${windowDays} days between publication and closing date, falling short of the recommended statutory ${statutoryMinDays}-day advertising window.`,
        influencingFields: [
          `publicationDate: "${notice.publicationDate}"`,
          `submissionDeadline: "${notice.submissionDeadline}"`,
          `windowDays: ${windowDays}`,
          `estimatedValue: ₹${Number(notice.estimatedValue).toLocaleString('en-IN')}`,
        ],
        cohortBenchmark: {
          cohortName: `${notice.category} in ${notice.jurisdiction}`,
          cohortSize: cohort.noticeCount,
          metricLabel: 'Cohort Average Advertising Window (Days)',
          benchmarkValue: cohort.avgWindowDays,
          recordValue: windowDays,
          variance: `${cohort.avgWindowDays - windowDays} days shorter than cohort average`,
        },
        recommendedAuditorAction: 'Check whether an administrative emergency waiver exists in the procurement file, or if pre-bid queries were received.',
        rulesetVersion: RULESET_VERSION,
        featureWindowDays,
        executedAt: new Date().toISOString(),
        status: 'pending_review',
      });
    }

    // ----------------------------------------------------
    // 3. Unusual Amendment Frequency & Cumulative Cost Escalation
    // ----------------------------------------------------
    if (noticeAward && noticeAmendments.length > 0) {
      const originalAward = Number(noticeAward.awardedAmount || 0);
      const totalCostDelta = noticeAmendments.reduce((sum, am) => sum + Number(am.costDelta || 0), 0);
      const cumulativeEscalationPercent = originalAward > 0 ? (totalCostDelta / originalAward) * 100 : 0;

      if (noticeAmendments.length >= 2 || cumulativeEscalationPercent > 15.0) {
        const severity = cumulativeEscalationPercent > 25.0 ? 'critical' : 'high';
        redFlags.push({
          id: `FLAG-AMD-${notice.id}`,
          indicatorId: 'unusual_amendments',
          indicatorCode: RED_FLAG_INDICATORS.unusual_amendments.code,
          indicatorName: RED_FLAG_INDICATORS.unusual_amendments.name,
          severity,
          noticeId: notice.id,
          tenderRefNumber: notice.tenderRefNumber,
          category: notice.category,
          jurisdiction: notice.jurisdiction,
          vendorId: noticeAward.vendorId,
          title: `High Cost Escalation via Amendments (+${cumulativeEscalationPercent.toFixed(1)}% over Award)`,
          explanation: `Contract received ${noticeAmendments.length} post-award amendments totaling +₹${totalCostDelta.toLocaleString('en-IN')} (+${cumulativeEscalationPercent.toFixed(1)}% increase), exceeding statutory variation norms.`,
          influencingFields: [
            `originalAwardAmount: ₹${originalAward.toLocaleString('en-IN')}`,
            `amendmentsCount: ${noticeAmendments.length}`,
            `totalCostDelta: ₹${totalCostDelta.toLocaleString('en-IN')}`,
            `escalationPercentage: ${cumulativeEscalationPercent.toFixed(1)}%`,
          ],
          cohortBenchmark: {
            cohortName: `${notice.category} in ${notice.jurisdiction}`,
            cohortSize: cohort.noticeCount,
            metricLabel: 'Average Contract Cost Escalation Rate (%)',
            benchmarkValue: `${cohort.avgCostEscalationRate}%`,
            recordValue: `${cumulativeEscalationPercent.toFixed(1)}%`,
            variance: `+${(cumulativeEscalationPercent - cohort.avgCostEscalationRate).toFixed(1)}% above cohort baseline`,
          },
          recommendedAuditorAction: 'Examine variation approval orders, site inspection reports, and verify whether variations represent genuine unforeseen site conditions or scope alterations that required a fresh tender.',
          rulesetVersion: RULESET_VERSION,
          featureWindowDays,
          executedAt: new Date().toISOString(),
          status: 'pending_review',
        });
      }
    }

    // ----------------------------------------------------
    // 4. Award Price Outlier vs Estimated Cost
    // ----------------------------------------------------
    if (noticeAward) {
      const estimated = Number(notice.estimatedValue || 0);
      const awarded = Number(noticeAward.awardedAmount || 0);

      if (estimated > 0 && awarded > 0) {
        const variancePct = ((awarded - estimated) / estimated) * 100;

        // Flag awards that are substantially (>20%) higher than department estimate
        if (variancePct > 20.0) {
          redFlags.push({
            id: `FLAG-PO-${notice.id}`,
            indicatorId: 'price_outlier',
            indicatorCode: RED_FLAG_INDICATORS.price_outlier.code,
            indicatorName: RED_FLAG_INDICATORS.price_outlier.name,
            severity: variancePct > 35.0 ? 'critical' : 'high',
            noticeId: notice.id,
            tenderRefNumber: notice.tenderRefNumber,
            category: notice.category,
            jurisdiction: notice.jurisdiction,
            vendorId: noticeAward.vendorId,
            title: `Award Amount Substantially Above Administrative Estimate (+${variancePct.toFixed(1)}%)`,
            explanation: `The awarded amount of ₹${awarded.toLocaleString('en-IN')} is ${variancePct.toFixed(1)}% higher than the published official departmental estimate of ₹${estimated.toLocaleString('en-IN')}.`,
            influencingFields: [
              `estimatedValue: ₹${estimated.toLocaleString('en-IN')}`,
              `awardedAmount: ₹${awarded.toLocaleString('en-IN')}`,
              `premiumPercentage: +${variancePct.toFixed(1)}%`,
            ],
            cohortBenchmark: {
              cohortName: `${notice.category} in ${notice.jurisdiction}`,
              cohortSize: cohort.noticeCount,
              metricLabel: 'Cohort Average Award-to-Estimate Ratio',
              benchmarkValue: `${(cohort.avgAwardVsEstimateRatio * 100).toFixed(0)}%`,
              recordValue: `${((awarded / estimated) * 100).toFixed(0)}%`,
              variance: `+${(((awarded / estimated) - cohort.avgAwardVsEstimateRatio) * 100).toFixed(1)}% variance from cohort ratio`,
            },
            recommendedAuditorAction: 'Verify tender committee minutes and rate justification analysis. Confirm if market rates rose sharply or if the technical specification contained proprietary requirements.',
            rulesetVersion: RULESET_VERSION,
            featureWindowDays,
            executedAt: new Date().toISOString(),
            status: 'pending_review',
          });
        }
      }
    }
  });

  // ----------------------------------------------------
  // 5. Vendor Concentration Anomaly across Agency/Cohort
  // ----------------------------------------------------
  if (totalAwardsCount >= 3) {
    Object.entries(vendorWins).forEach(([vendorId, winCount]) => {
      const winShare = (winCount / totalAwardsCount) * 100;
      // If a single vendor has won 40% or more of all awards in the sample
      if (winCount >= 2 && winShare >= 40.0) {
        const vendor = vendors.find((v) => v.id === vendorId) || { name: vendorId };
        redFlags.push({
          id: `FLAG-VND-${vendorId}`,
          indicatorId: 'vendor_concentration',
          indicatorCode: RED_FLAG_INDICATORS.vendor_concentration.code,
          indicatorName: RED_FLAG_INDICATORS.vendor_concentration.name,
          severity: 'medium',
          vendorId,
          title: `Elevated Contract Win Concentration (${vendor.name})`,
          explanation: `Vendor ${vendor.name} has secured ${winCount} out of ${totalAwardsCount} (${winShare.toFixed(1)}%) awarded contracts within the active analysis window.`,
          influencingFields: [
            `vendorId: "${vendorId}"`,
            `vendorName: "${vendor.name}"`,
            `winCount: ${winCount}`,
            `totalAwardsEvaluated: ${totalAwardsCount}`,
            `winSharePercentage: ${winShare.toFixed(1)}%`,
          ],
          cohortBenchmark: {
            cohortName: 'All Evaluated Vendors in Portfolio',
            cohortSize: vendors.length,
            metricLabel: 'Expected Neutral Market Share per Vendor',
            benchmarkValue: `${(100 / Math.max(vendors.length, 1)).toFixed(1)}%`,
            recordValue: `${winShare.toFixed(1)}%`,
            variance: `${(winShare - (100 / Math.max(vendors.length, 1))).toFixed(1)}% concentration over evenly distributed baseline`,
          },
          recommendedAuditorAction: 'Review whether qualification criteria consistently align with this vendor unique assets, and verify rotation policies across empanelled contractors.',
          rulesetVersion: RULESET_VERSION,
          featureWindowDays,
          executedAt: new Date().toISOString(),
          status: 'pending_review',
        });
      }
    });
  }

  return {
    rulesetVersion: RULESET_VERSION,
    executedAt: new Date().toISOString(),
    totalNoticesAnalyzed: filteredNotices.length,
    totalAwardsAnalyzed: awards.length,
    totalRedFlagsDetected: redFlags.length,
    flagsBySeverity: {
      critical: redFlags.filter((f) => f.severity === 'critical').length,
      high: redFlags.filter((f) => f.severity === 'high').length,
      medium: redFlags.filter((f) => f.severity === 'medium').length,
      low: redFlags.filter((f) => f.severity === 'low').length,
    },
    redFlags,
  };
};
