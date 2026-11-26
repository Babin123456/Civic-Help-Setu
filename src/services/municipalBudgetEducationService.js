import {
  MUNICIPAL_BUDGET_GLOSSARY,
  BUDGET_LIFECYCLE_STAGES,
  SAMPLE_WARD_BUDGETS
} from '../data/municipalBudgetData.js';

/**
 * @file municipalBudgetEducationService.js
 * @description Educational service breaking down complex municipal budgets, ward allocations,
 * and public procurement workflows into plain-language civic insights.
 */

export class MunicipalBudgetEducationService {
  constructor() {
    this.glossary = [...MUNICIPAL_BUDGET_GLOSSARY];
    this.stages = [...BUDGET_LIFECYCLE_STAGES];
    this.wardBudgets = [...SAMPLE_WARD_BUDGETS];
  }

  getGlossary() {
    return this.glossary;
  }

  searchGlossary(query) {
    if (!query) return this.glossary;
    const q = query.toLowerCase().trim();
    return this.glossary.filter(item =>
      item.term.toLowerCase().includes(q) ||
      item.plainExplanation.toLowerCase().includes(q)
    );
  }

  getBudgetLifecycle() {
    return this.stages;
  }

  getWardBudget(wardNumber, fiscalYear = '2025-2026') {
    return this.wardBudgets.find(b => b.wardNumber === Number(wardNumber) && b.fiscalYear === fiscalYear) || null;
  }

  calculateSpendingSummary(wardBudget) {
    if (!wardBudget || !wardBudget.categories) {
      return null;
    }

    const totalAllocated = wardBudget.categories.reduce((acc, c) => acc + c.allocatedLakhs, 0);
    const totalSpent = wardBudget.categories.reduce((acc, c) => acc + c.spentLakhs, 0);
    const utilizationRate = totalAllocated > 0 ? Number(((totalSpent / totalAllocated) * 100).toFixed(1)) : 0;

    const categoryBreakdown = wardBudget.categories.map(c => ({
      category: c.category,
      allocatedLakhs: c.allocatedLakhs,
      spentLakhs: c.spentLakhs,
      percentageOfWardBudget: Number(((c.allocatedLakhs / totalAllocated) * 100).toFixed(1)),
      utilizationRate: Number(((c.spentLakhs / c.allocatedLakhs) * 100).toFixed(1))
    }));

    return {
      wardNumber: wardBudget.wardNumber,
      wardName: wardBudget.wardName,
      fiscalYear: wardBudget.fiscalYear,
      totalAllocatedLakhs: totalAllocated,
      totalSpentLakhs: totalSpent,
      overallUtilizationRate: utilizationRate,
      categories: categoryBreakdown
    };
  }

  generateCitizenBudgetGuide(topic) {
    const topicNormalized = (topic || '').toLowerCase();
    if (topicNormalized.includes('ward') || topicNormalized.includes('committee')) {
      return {
        title: 'How to Track and Influence Your Ward Budget',
        steps: [
          'Attend monthly Ward Committee meetings where local expenditure plans are tabled.',
          'Review the allocated funds under 15th Finance Commission or Municipal Ward Grants.',
          'Demand inspection of work orders and measure book entries for local civil works.',
          'Lodge queries on municipal grievance portals if sanctioned works remain unexecuted.'
        ]
      };
    }

    return {
      title: 'Understanding Municipal Finances',
      steps: [
        'Municipal revenue comes from Property Tax, State Transfers, User Charges, and Grants.',
        'Budgets are segregated into Capital Works (durable infrastructure) and Revenue (daily operations).',
        'Transparent e-procurement portals allow citizens to inspect contractor bids and execution milestones.'
      ]
    };
  }
}

export const defaultBudgetEducationService = new MunicipalBudgetEducationService();
