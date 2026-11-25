/**
 * src/services/wardIssueHeatmapStorage.js
 * Storage adapter and synthetic civic issue repository for ward analytics (#1163).
 *
 * Provides persistent and in-memory storage of civic reports with
 * deterministic seed generation for tests and demonstration.
 */

import { validateRawCivicReport } from '../data/wardAnalyticsContract';

export const STORAGE_KEY = 'civic_ward_issue_reports_v1';

/**
 * Generates deterministic synthetic complaint reports across municipal wards.
 * Deliberately contains both dense clusters (20-30 reports) and sparse cohorts (1-3 reports)
 * to test sparse-cell suppression.
 */
export const generateDefaultCivicReports = () => {
  const reports = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const categories = [
    'potholes_roads',
    'sanitation_garbage',
    'water_supply',
    'streetlights',
    'drainage_flooding',
    'public_health',
  ];

  const wards = [
    'WARD-101', 'WARD-102', 'WARD-103', 'WARD-104', 'WARD-105',
    'WARD-106', 'WARD-107', 'WARD-108', 'WARD-109', 'WARD-110',
  ];

  let counter = 1000;

  // Distribution matrix configuration
  wards.forEach((ward, wIdx) => {
    categories.forEach((cat, cIdx) => {
      // Deterministic pseudo-count: some high, some medium, some sparse (< 5)
      let count;
      if (wIdx % 3 === 0 && cIdx % 2 === 0) {
        count = 18 + (wIdx * 2); // Dense cell
      } else if (wIdx % 2 === 1 && cIdx % 3 === 1) {
        count = 8 + cIdx; // Medium cell
      } else if ((wIdx + cIdx) % 4 === 0) {
        count = 2; // Sparse cell (< 5, should be suppressed)
      } else if ((wIdx + cIdx) % 5 === 0) {
        count = 1; // Extremely sparse cell
      } else {
        count = 6; // Just above threshold
      }

      for (let i = 0; i < count; i++) {
        counter++;
        // Distribute timestamp within the last 60 days
        const daysAgo = (i * 3 + wIdx + cIdx) % 60;
        const timestamp = new Date(now - (daysAgo * dayMs) - (i * 3600000)).toISOString();

        reports.push({
          id: `RPT-${counter}`,
          wardId: ward,
          category: cat,
          timestamp,
          status: i % 2 === 0 ? 'resolved' : 'in_progress',
        });
      }
    });
  });

  return reports;
};

let memoryStore = null;

/**
 * Retrieves all stored civic reports, initializing with synthetic seeds if empty.
 */
export const getCivicReports = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback to in-memory store
    }
  }

  if (!memoryStore) {
    memoryStore = generateDefaultCivicReports();
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryStore));
      } catch {
        // Storage write fail
      }
    }
  }

  return [...memoryStore];
};

/**
 * Appends a new validated civic report.
 */
export const saveCivicReport = (report) => {
  const validation = validateRawCivicReport(report);
  if (!validation.valid) {
    throw new Error(`Invalid report: ${validation.errors.join(', ')}`);
  }

  const reports = getCivicReports();
  reports.push(report);
  memoryStore = reports;

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
    } catch {
      // Storage write fail
    }
  }

  return report;
};

/**
 * Resets storage to default synthetic dataset.
 */
export const resetCivicReports = (customReports = null) => {
  memoryStore = customReports ? [...customReports] : generateDefaultCivicReports();
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryStore));
    } catch {
      // Storage write fail
    }
  }
  return [...memoryStore];
};

/**
 * Filters a report list by rolling time window ('7d', '14d', '30d', '90d').
 */
export const filterReportsByWindow = (reports = [], windowStr = '30d') => {
  const windowDays = parseInt(windowStr, 10) || 30;
  const cutoffTime = Date.now() - (windowDays * 24 * 60 * 60 * 1000);

  return reports.filter((rpt) => {
    const reportTime = new Date(rpt.timestamp).getTime();
    return !Number.isNaN(reportTime) && reportTime >= cutoffTime;
  });
};
