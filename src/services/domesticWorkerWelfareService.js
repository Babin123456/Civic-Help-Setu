/**
 * @file domesticWorkerWelfareService.js
 * @description Provides a state-aware informational hub for domestic worker protections,
 * welfare board registration guidelines, emergency channels, and printable checklists.
 * Does not collect or store worker/employer identity documents.
 */

import { DOMESTIC_WORKER_WELFARE_DATA } from '../data/domesticWorkerWelfareData.js';

export class DomesticWorkerWelfareService {
  constructor(data = DOMESTIC_WORKER_WELFARE_DATA) {
    this.welfareData = data;
    this.contentDisputes = [];
  }

  /**
   * Retrieves welfare information filtered by state and worker category.
   */
  getWelfareInfo(stateCode, workerCategory) {
    return this.welfareData.filter(item => {
      const stateMatch = item.state === 'ALL_INDIA' || (stateCode && item.state === stateCode);
      if (!stateMatch) return false;

      if (workerCategory) {
        const catMatch = item.workerCategoriesCovered.some(
          cat => cat.toLowerCase().includes(workerCategory.toLowerCase())
        );
        if (!catMatch) return false;
      }
      return true;
    });
  }

  /**
   * Distinguishes statutory minimum rights from scheme-specific discretionary benefits.
   */
  getRightsAndProtectionsBreakdown(stateCode) {
    const records = this.getWelfareInfo(stateCode);
    const statutoryRights = [];
    const schemeBenefits = [];

    records.forEach(rec => {
      rec.statutoryRights.forEach(right => {
        statutoryRights.push({
          sourceBoard: rec.boardName,
          state: rec.stateName,
          text: right
        });
      });

      rec.welfareBenefits.forEach(ben => {
        schemeBenefits.push({
          sourceBoard: rec.boardName,
          state: rec.stateName,
          benefitType: ben.benefitType,
          amountINR: ben.amountINR,
          description: ben.description
        });
      });
    });

    return {
      stateCode: stateCode || 'ALL',
      statutoryRights,
      schemeBenefits,
      privacyGuarantee: 'Civic Help Setu does not collect, verify, or store domestic worker or employer identity records in this informational module.'
    };
  }

  /**
   * Compiles an actionable, printable application checklist for workers and employers.
   */
  generateApplicationPreparationChecklist(stateCode) {
    const records = this.welfareData.filter(r => r.state === stateCode || r.state === 'ALL_INDIA');
    if (records.length === 0) {
      return {
        isAvailable: false,
        message: `No specific domestic worker board records currently verified for state ${stateCode}. Displaying central e-Shram guidance.`
      };
    }

    const stateBoard = records.find(r => r.state === stateCode) || records[0];

    return {
      isAvailable: true,
      boardName: stateBoard.boardName,
      administeringAuthority: stateBoard.administeringAuthority,
      registrationRoute: stateBoard.registrationRoute,
      requiredDocuments: stateBoard.requiredDocuments.map((doc, idx) => ({
        step: idx + 1,
        documentName: doc,
        completed: false
      })),
      emergencyHelplines: stateBoard.emergencyHelplines,
      officialSourceUrl: stateBoard.officialSourceUrl,
      lastVerifiedDate: stateBoard.lastVerifiedDate,
      plainLanguageNotice: 'Keep photocopies ready and ensure that bank account is mapped to Aadhaar in bank branch to receive direct benefit transfers.'
    };
  }

  /**
   * Enables community members or legal aid workers to submit a correction report for outdated guidelines.
   */
  submitCorrectionReport(report = {}) {
    if (!report.sourceBoardId || !report.correctionDetails) {
      throw new Error('sourceBoardId and correctionDetails are required.');
    }

    const entry = {
      reportId: `corr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sourceBoardId: report.sourceBoardId,
      submittedAt: new Date().toISOString(),
      reporterEmail: report.reporterEmail || 'anonymous@community',
      correctionDetails: report.correctionDetails,
      suggestedOfficialSource: report.suggestedOfficialSource || null,
      status: 'PENDING_EDITORIAL_AUDIT'
    };

    this.contentDisputes.push(entry);
    return entry;
  }
}

export const defaultDomesticWorkerWelfareService = new DomesticWorkerWelfareService();
