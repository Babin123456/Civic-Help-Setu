import {
  CLAIM_STATUS,
  COMPLETION_STATUS,
  TASK_STATUS,
} from '../../data/microVolunteerContract.js';

export const TASK_STATUS_TONE = Object.freeze({
  [TASK_STATUS.DRAFT]: 'neutral',
  [TASK_STATUS.OPEN]: 'success',
  [TASK_STATUS.ASSIGNED]: 'accent',
  [TASK_STATUS.AWAITING_REVIEW]: 'warning',
  [TASK_STATUS.COMPLETED]: 'success',
  [TASK_STATUS.REOPENED]: 'warning',
  [TASK_STATUS.ARCHIVED]: 'neutral',
});

export const CLAIM_STATUS_TONE = Object.freeze({
  [CLAIM_STATUS.ACTIVE]: 'accent',
  [CLAIM_STATUS.SUBMITTED]: 'warning',
  [CLAIM_STATUS.CHANGES_REQUESTED]: 'warning',
  [CLAIM_STATUS.APPROVED]: 'success',
  [CLAIM_STATUS.REJECTED]: 'danger',
  [CLAIM_STATUS.REOPENED]: 'warning',
  [CLAIM_STATUS.WITHDRAWN]: 'neutral',
  [CLAIM_STATUS.EXPIRED]: 'neutral',
});

export const COMPLETION_STATUS_TONE = Object.freeze({
  [COMPLETION_STATUS.SUBMITTED]: 'warning',
  [COMPLETION_STATUS.UNDER_REVIEW]: 'warning',
  [COMPLETION_STATUS.CHANGES_REQUESTED]: 'warning',
  [COMPLETION_STATUS.APPROVED]: 'success',
  [COMPLETION_STATUS.REJECTED]: 'danger',
  [COMPLETION_STATUS.REOPENED]: 'warning',
  [COMPLETION_STATUS.WITHDRAWN]: 'neutral',
});

export const formatDate = (value) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatDateTime = (value) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatMinutes = (minutes) => {
  const value = Number(minutes);
  if (!Number.isFinite(value)) return 'Time not recorded';
  if (value < 60) return `${value} min`;
  const hours = Math.floor(value / 60);
  const remainder = value % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
};

export const generateIdempotencyKey = (prefix) => {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${random}`;
};
