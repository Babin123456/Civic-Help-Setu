/**
 * Transgender Certificate and Welfare Scheme Service
 * Provides data-resolution and business logic helpers for the TransgenderCertificateWelfareGuide.
 *
 * Grounded in:
 * - The Transgender Persons (Protection of Rights) Act, 2019
 * - The Transgender Persons (Protection of Rights) Rules, 2020
 * - MoSJE National Portal for Transgender Persons (transgender.dosje.gov.in)
 *
 * Keeps all logic browser-side; no server or telemetry calls.
 */

import {
  NATIONAL_PORTAL_INFO,
  TRANSGENDER_CERTIFICATE_STATES,
  getTransgenderCertificateStateData,
  getSupportResources
} from '../data/transgenderCertificateWelfareData';

/**
 * Resolve the competent authority and statutory parameters for a given state ID.
 * Returns authorityName, competentOfficer, portalUrl, statutoryTurnaroundDays,
 * fee, inspectionProhibited, and statutoryBasis.
 */
export const resolveTransgenderAuthority = (stateId = 'national') => {
  const stateData = getTransgenderCertificateStateData(stateId);

  return {
    authorityName: stateData.competentAuthority || 'District Magistrate / Collector',
    competentOfficer: stateId === 'national' ? 'District Magistrate' : `District Magistrate / ${stateData.state} Welfare Officer`,
    portalUrl: stateData.applicationPortal || NATIONAL_PORTAL_INFO.portalUrl,
    officialInfoPortal: stateData.officialPortal || NATIONAL_PORTAL_INFO.portalUrl,
    turnaroundDays: 30, // Rule 6(1) of Central Rules mandates 30 days
    inspectionProhibited: true, // Section 5 specifically protects against medical tests for identity cert
    fee: 'Nil (Free under Central Rules)',
    statutoryBasis: `${NATIONAL_PORTAL_INFO.statutoryAct} & ${NATIONAL_PORTAL_INFO.statutoryRules}`,
    helpline: NATIONAL_PORTAL_INFO.helpline,
    verificationTimestamp: '2026-11-20',
    maxStaleDays: 180
  };
};

/**
 * Evaluate application applicability for the selected state/configuration.
 * Returns { isMandatory, isExempt, ruleSummary, legalReference }.
 */
export const evaluateApplicationApplicability = () => {
  return {
    isMandatory: false, // Applying is an individual right, not an imposed duty
    isVoluntaryRight: true,
    ruleSummary: 'Under Section 4 and 5 of the 2019 Act, every transgender person has a statutory right to self-perceived gender identity and to obtain a Certificate of Identity from the District Magistrate without intrusive medical examination.',
    legalReference: 'Section 4 & 5, Transgender Persons (Protection of Rights) Act, 2019'
  };
};

/**
 * Get the application stage checklist for the selected state.
 * Returns requiredCategories with step-by-step checklist items.
 */
export const getApplicationStageChecklist = (stateId = 'national') => {
  const stateData = getTransgenderCertificateStateData(stateId);
  const steps = stateData?.applicationProcess?.steps || [];

  const items = steps.map((step, idx) => ({
    id: step.id || `step-${idx + 1}`,
    stepNumber: idx + 1,
    title: step.title,
    description: step.description,
    documents: step.documents || [],
    mandatory: Boolean(step.mandatory && step.mandatory.length > 0),
    mandatoryItems: step.mandatory || []
  }));

  return {
    stageTitle: `Certificate Application Route (${stateData.state})`,
    estimatedTimeline: stateData.applicationProcess?.estimatedTimeline || '30 statutory days',
    fee: stateData.applicationProcess?.fee || 'Nil',
    items
  };
};

/**
 * Get correction and gender reaffirmation revision routes for a state.
 */
export const getCorrectionRoutes = (stateId = 'national') => {
  const stateData = getTransgenderCertificateStateData(stateId);
  return stateData.correctionRoutes || TRANSGENDER_CERTIFICATE_STATES.national.correctionRoutes;
};

/**
 * Get statutory appeal routes for a state.
 */
export const getAppealRoutes = (stateId = 'national') => {
  const stateData = getTransgenderCertificateStateData(stateId);
  return stateData.appealRoutes || TRANSGENDER_CERTIFICATE_STATES.national.appealRoutes;
};

/**
 * Filter support resources by state and optional category.
 * Categories: 'all' | 'Helpline' | 'Legal Aid' | 'Healthcare' | 'Shelter & Livelihood'
 */
export const filterSupportResources = (stateId = 'national', category = 'all') => {
  const resources = getSupportResources(stateId);
  if (!category || category === 'all') {
    return resources;
  }
  return resources.filter((res) => {
    const typeLower = (res.type || '').toLowerCase();
    const catLower = category.toLowerCase();
    return typeLower.includes(catLower);
  });
};

/**
 * Check whether the data is stale (older than maxStaleDays).
 */
export const isDataStale = (verificationTimestamp, maxStaleDays = 180) => {
  if (!verificationTimestamp) return false;
  const lastVerify = new Date(verificationTimestamp).getTime();
  const now = Date.now();
  const diffDays = (now - lastVerify) / (1000 * 60 * 60 * 24);
  return diffDays > maxStaleDays;
};
