import { describe, it, expect, beforeEach } from 'vitest';
import {
  generatePreparationPlan,
  calculatePlanProgress,
  toggleTaskCompletion,
  addCustomTask,
  removeTaskFromPlan,
  editTaskInPlan,
  getStoredPlan,
  saveStoredPlan,
  clearStoredPlan,
  TASK_CATEGORIES,
} from './applicationPreparationPlanService';

describe('applicationPreparationPlanService (#398)', () => {
  const serviceId = 'birth-certificate-v1';

  beforeEach(() => {
    clearStoredPlan(serviceId);
  });

  const richService = {
    id: serviceId,
    title: 'Birth Certificate Registration',
    department: 'Municipal Corporation',
    eligibility: [
      'Child born within municipal corporation jurisdiction',
      'Reported within 21 days of birth event',
    ],
    documents: [
      'Hospital discharge summary / institutional birth record',
      'Identity proof of parents (Aadhaar or Voter ID)',
      'Marriage certificate of parents',
    ],
    fees: '₹50 (Free if registered within 21 days)',
    process: [
      'Fill Form 1 at municipal ward office or state portal',
      'Attach hospital birth intimation slip and parent IDs',
      'Verify details with registrar of births and deaths',
      'Download digitally signed birth certificate',
    ],
    officialUrl: 'https://crsorgi.gov.in',
  };

  it('generates an actionable plan strictly derived from rich service requirements', () => {
    const plan = generatePreparationPlan(richService);

    expect(plan.serviceId).toBe(serviceId);
    expect(plan.tasks.length).toBe(11); // 2 elig + 3 doc + 1 fee + 4 process + 1 url

    // Verify eligibility tasks
    const eligTasks = plan.tasks.filter((t) => t.category === TASK_CATEGORIES.ELIGIBILITY);
    expect(eligTasks.length).toBe(2);
    expect(eligTasks[0].sourceField).toBe('eligibility');
    expect(eligTasks[0].sourceRequirement).toContain('Child born within municipal');

    // Verify document tasks
    const docTasks = plan.tasks.filter((t) => t.category === TASK_CATEGORIES.DOCUMENTS);
    expect(docTasks.length).toBe(3);
    expect(docTasks[0].sourceField).toBe('documents');
    expect(docTasks[0].sourceRequirement).toContain('Hospital discharge summary');
    // Document collection order is advisory
    expect(docTasks[0].isSuggestedOrder).toBe(true);

    // Verify fee readiness task
    const feeTask = plan.tasks.find((t) => t.category === TASK_CATEGORIES.FEES);
    expect(feeTask).toBeDefined();
    expect(feeTask.sourceRequirement).toContain('₹50');

    // Verify process tasks
    const processTasks = plan.tasks.filter((t) => t.category === TASK_CATEGORIES.PROCESS);
    expect(processTasks.length).toBe(4);
    expect(processTasks[0].title).toContain('Fill Form 1');

    // Verify submission endpoint task
    const subTask = plan.tasks.find((t) => t.category === TASK_CATEGORIES.SUBMISSION);
    expect(subTask).toBeDefined();
    expect(subTask.sourceRequirement).toBe('https://crsorgi.gov.in');
  });

  it('does not hallucinate external requirements for minimal service records', () => {
    const minimalService = {
      id: 'simple-scheme',
      title: 'General Civic Awareness Programme',
      description: 'Public awareness drive with no formal filing.',
    };

    const plan = generatePreparationPlan(minimalService);
    expect(plan.tasks.length).toBe(1);
    expect(plan.tasks[0].sourceRequirement).toBe('General catalogue entry');
    // Must not hallucinate arbitrary documents like "Aadhaar Card" or "Passport"
    const hasHallucinatedDocs = plan.tasks.some((t) => t.category === TASK_CATEGORIES.DOCUMENTS);
    expect(hasHallucinatedDocs).toBe(false);
  });

  it('calculates plan progress accurately', () => {
    let plan = generatePreparationPlan(richService);
    let progress = calculatePlanProgress(plan);
    expect(progress.total).toBe(11);
    expect(progress.completed).toBe(0);
    expect(progress.percentage).toBe(0);

    // Toggle 2 tasks
    plan = toggleTaskCompletion(plan, plan.tasks[0].id);
    plan = toggleTaskCompletion(plan, plan.tasks[1].id);

    progress = calculatePlanProgress(plan);
    expect(progress.completed).toBe(2);
    expect(progress.percentage).toBe(Math.round((2 / 11) * 100));
  });

  it('allows user to customize plan: add custom tasks, edit, and remove tasks', () => {
    let plan = generatePreparationPlan(richService);
    const initialCount = plan.tasks.length;

    // Add personal task
    plan = addCustomTask(plan, {
      title: 'Make 2 photocopies of hospital discharge slip',
      notes: 'Store in home documents folder',
    });
    expect(plan.tasks.length).toBe(initialCount + 1);
    const customTask = plan.tasks[plan.tasks.length - 1];
    expect(customTask.category).toBe(TASK_CATEGORIES.CUSTOM);
    expect(customTask.title).toBe('Make 2 photocopies of hospital discharge slip');

    // Edit task
    plan = editTaskInPlan(plan, customTask.id, {
      title: 'Make 3 photocopies of hospital discharge slip',
      notes: 'Notarized copies',
    });
    const editedTask = plan.tasks.find((t) => t.id === customTask.id);
    expect(editedTask.title).toBe('Make 3 photocopies of hospital discharge slip');
    expect(editedTask.notes).toBe('Notarized copies');

    // Remove task
    plan = removeTaskFromPlan(plan, customTask.id);
    expect(plan.tasks.length).toBe(initialCount);
    expect(plan.tasks.some((t) => t.id === customTask.id)).toBe(false);
  });

  it('persists customized plan and retrieves it correctly', () => {
    let plan = generatePreparationPlan(richService);
    plan = toggleTaskCompletion(plan, plan.tasks[0].id);

    const stored = getStoredPlan(serviceId);
    expect(stored).toBeDefined();
    expect(stored.tasks[0].completed).toBe(true);

    clearStoredPlan(serviceId);
    expect(getStoredPlan(serviceId)).toBeNull();
  });
});
