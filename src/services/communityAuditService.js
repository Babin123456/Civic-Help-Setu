import { requirePermission } from './accessControl';
/**
 * Community Audit & Discrepancy Corroboration Service
 * Enables crowd-sourced verification of reported civic changes (e.g. fee updates, office closures)
 * with community consensus scoring and administrator resolution.
 */
import { logDiagnostic } from '../utils/diagnostics';

import { sanitizeTextFields } from '../utils/safeContent';
const STORAGE_KEY = 'civicbridge_community_audits';

const DEFAULT_AUDIT_REPORTS = [
  {
    id: 'audit-inc-01',
    serviceId: 'income-certificate',
    category: 'FEES_UPDATE',
    title: 'CSC e-Mitra processing fee revised from ₹30 to ₹50',
    description: 'Local facilitation centers (e-Mitra / CSC) are now charging ₹50 statutory convenience fee instead of ₹30 as per Department Notification dated Jan 2026.',
    reportedBy: 'Citizen_Voter_42',
    reportedDate: '2026-02-12',
    upvotes: 14,
    downvotes: 1,
    status: 'COMMUNITY_VERIFIED', // 'PENDING_CORROBORATION' | 'COMMUNITY_VERIFIED' | 'RESOLVED'
    adminNote: null
  },
  {
    id: 'audit-dl-02',
    serviceId: 'driving-license',
    category: 'DOCUMENT_REQUIREMENT',
    title: 'Blood group lab report no longer mandatory if donor card produced',
    description: 'Sarathi portal now accepts Red Cross or hospital blood donor card as valid blood group certificate.',
    reportedBy: 'Kailash_J',
    reportedDate: '2026-03-01',
    upvotes: 8,
    downvotes: 0,
    status: 'COMMUNITY_VERIFIED',
    adminNote: null
  }
];

let memoryCache = null;

export function getAuditReports(serviceId = null) {
  let list = memoryCache || [...DEFAULT_AUDIT_REPORTS];
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        list = Array.isArray(parsed) ? sanitizeTextFields(parsed) : list;
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_AUDIT_REPORTS));
      }
    } catch {
      list = memoryCache || [...DEFAULT_AUDIT_REPORTS];
    }
  }

  memoryCache = list;
  if (!serviceId) return list;
  const clean = serviceId.toLowerCase().replace(/\s+/g, '-');
  return list.filter(r => r.serviceId === clean);
}

export function saveAuditReport(reportData) {
  const all = getAuditReports();
  const cleanServiceId = (reportData.serviceId || 'general').toLowerCase().replace(/\s+/g, '-');

  const newReport = {
    id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    serviceId: cleanServiceId,
    category: reportData.category || 'GENERAL_DISCREPANCY',
    title: reportData.title || 'Reported Civic Discrepancy',
    description: reportData.description || '',
    reportedBy: reportData.reportedBy || 'Citizen Contributor',
    reportedDate: new Date().toISOString().split('T')[0],
    upvotes: 1,
    downvotes: 0,
    status: 'PENDING_CORROBORATION',
    adminNote: null
  };

  const updated = [newReport, ...all];
  memoryCache = updated;

  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      logDiagnostic('Storage write failed', err);
    }
  }
  return newReport;
}

export function voteAuditReport(reportId, voteType = 'UP') {
  const all = getAuditReports();
  const idx = all.findIndex(r => r.id === reportId);
  if (idx === -1) return null;

  const rep = { ...all[idx] };
  if (voteType === 'UP') {
    rep.upvotes += 1;
  } else {
    rep.downvotes += 1;
  }

  // Consensus threshold: 5+ net upvotes qualifies as COMMUNITY_VERIFIED
  const netScore = rep.upvotes - rep.downvotes;
  if (rep.status !== 'RESOLVED') {
    if (netScore >= 5) {
      rep.status = 'COMMUNITY_VERIFIED';
    } else if (netScore < 0) {
      rep.status = 'DISPUTED';
    } else {
      rep.status = 'PENDING_CORROBORATION';
    }
  }

  all[idx] = rep;
  memoryCache = all;

  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {}
  }
  return rep;
}

export function resolveAuditReport(reportId, adminNote = '', resolvedBy = 'SuperAdmin') {
  requirePermission('communityAudits.resolve');
  const all = getAuditReports();
  const idx = all.findIndex(r => r.id === reportId);
  if (idx === -1) return null;

  const rep = { ...all[idx], status: 'RESOLVED', adminNote, resolvedBy };
  all[idx] = rep;
  memoryCache = all;

  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {}
  }
  return rep;
}
