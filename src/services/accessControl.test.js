import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import {
  PERMISSIONS,
  PermissionDeniedError,
  setCurrentActor,
  getCurrentActor,
  checkPermission,
  can,
  roleOf,
  requirePermission,
  actorLabel,
} from './accessControl';
import {
  saveAdminService,
  importAdminServices,
  deleteAdminService,
  archiveAdminServices,
  getReports,
  resolveReport,
  dismissReport,
  getAuditLogs,
  addAuditLog,
  getUserList,
  updateUserRole,
  getServiceSubmissions,
  approveServiceSubmission,
  rejectServiceSubmission,
  submitErrorReport,
} from './adminService';
import { deleteAvailabilityNotice } from './serviceAvailabilityNoticeService';
import { getOwnershipMap, assignServiceOwnership } from './serviceOwnershipService';
import { resolveAuditReport, getAuditReports } from './communityAuditService';
import { resolveSourceConflict, reopenSourceConflict } from './sourceConflictService';
import {
  reviewBottleneckFeedback,
  queryFeedbackForModeration,
  resetFeedbackDefaults,
} from './bottleneckFeedbackService';
import { addNotice, updateNotice, changeNoticeStatus, resetNoticesToDefault } from './noticeDigestService';
import { moderateBarrierReport } from './barrierReportService';
import { recordServiceReview } from './dataFreshnessTrustService';
import { saveLinkCheck } from './linkHealthService';

const memoryStorage = () => {
  const data = new Map();
  return {
    getItem: vi.fn((key) => (data.has(key) ? data.get(key) : null)),
    setItem: vi.fn((key, value) => data.set(key, String(value))),
    removeItem: vi.fn((key) => data.delete(key)),
    data,
  };
};

const ANONYMOUS = null;
const CITIZEN = { id: 'u1', role: 'citizen', username: 'Asha' };
const ADMIN = { id: 'a1', role: 'admin', username: 'Verified Admin' };

let store;
let moduleStorage;

beforeEach(() => {
  store = memoryStorage();
  moduleStorage = memoryStorage();
  vi.stubGlobal('localStorage', store);
  setCurrentActor(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  setCurrentActor(null);
});

// One entry per privileged action: a call that goes through the data layer.
const service = { name: 'Test Guide', category: 'Identity', shortDescription: 'x' };
const CALLS = {
  'services.write': () => saveAdminService(service),
  'services.import': () => importAdminServices([service]),
  'services.delete': () => deleteAdminService('some-id'),
  'services.archive': () => archiveAdminServices(['some-id']),
  'reports.read': () => getReports(),
  'reports.resolve': () => resolveReport('rep-101', 'done'),
  'reports.dismiss': () => dismissReport('rep-101'),
  'audit.read': () => getAuditLogs(),
  'audit.write': () => addAuditLog({ action: 'FORGED', actor: 'Someone', target: 't' }),
  'users.read': () => getUserList(),
  'users.updateRole': () => updateUserRole('usr-1', 'admin'),
  'submissions.read': () => getServiceSubmissions(),
  'submissions.review': () => rejectServiceSubmission('sub-1', 'no'),
  'communityAudits.resolve': () => resolveAuditReport('x', 'note'),
  'sourceConflicts.review': () =>
    resolveSourceConflict(
      { conflictId: 'c1', chosenValue: 'v', resolutionNotes: 'long enough', reviewerRole: 'admin' },
      moduleStorage
    ),
  'barriers.moderate': () => moderateBarrierReport({ reportId: 'b1', action: 'approve', userRole: 'admin' }, moduleStorage),
  'feedback.moderate': () => reviewBottleneckFeedback('f1', 'reviewed', 'Mod', '', moduleStorage),
  'notices.manage': () => resetNoticesToDefault(moduleStorage),
  'availabilityNotices.manage': () => deleteAvailabilityNotice('n1', moduleStorage),
  'freshness.review': () => recordServiceReview('svc', 'Rev', '', moduleStorage),
  'links.check': () => saveLinkCheck('svc:0', { url: 'https://a.gov.in/', status: 'reachable' }, moduleStorage),
  'ownership.read': () => getOwnershipMap(moduleStorage),
  'ownership.manage': () => assignServiceOwnership('svc', { team: 'Docs' }, { storage: moduleStorage }),
};

const outcome = (fn) => {
  try {
    fn();
    return 'ran';
  } catch (error) {
    return error instanceof PermissionDeniedError || error?.code === 'UNAUTHORIZED_ACCESS' ? 'denied' : 'ran';
  }
};

describe('the permission table', () => {
  it('has a test call for every action, so a new action cannot be added untested', () => {
    expect(Object.keys(CALLS).sort()).toEqual(Object.keys(PERMISSIONS).sort());
  });

  it('describes each action and names what it protects', () => {
    for (const [action, rule] of Object.entries(PERMISSIONS)) {
      expect(rule.description, action).toBeTruthy();
      expect(rule.resource, action).toBeTruthy();
      expect(rule.roles.length, action).toBeGreaterThan(0);
    }
  });

  it('grants nothing to citizens', () => {
    for (const rule of Object.values(PERMISSIONS)) expect(rule.roles).not.toContain('citizen');
  });

  it('is actually enforced by the data layer: every action is required somewhere in src/services', () => {
    const dir = new URL('./', import.meta.url);
    const source = readdirSync(dir)
      .filter((name) => name.endsWith('.js') && !name.endsWith('.test.js'))
      .map((name) => readFileSync(new URL(name, dir), 'utf8'))
      .join('\n');
    for (const action of Object.keys(PERMISSIONS)) {
      const guarded = source.includes(`requirePermission('${action}')`) || source.includes(`can('${action}')`);
      expect(guarded, action).toBe(true);
    }
  });
});

describe('roleOf', () => {
  it('only the exact role "admin" is an admin', () => {
    expect(roleOf({ role: 'admin' })).toBe('admin');
    for (const role of ['Admin', 'ADMIN', ' admin', 'moderator', 'superadmin', 'editor', '', null, undefined, 1, true, ['admin']]) {
      expect(roleOf({ role }), String(role)).toBe('citizen');
    }
    expect(roleOf(null)).toBe('citizen');
    expect(roleOf({})).toBe('citizen');
  });
});

describe('checkPermission and can', () => {
  it('denies by default', () => {
    expect(checkPermission('services.write')).toBe('unauthenticated');
    expect(checkPermission('does.not.exist', ADMIN)).toBe('unknown-action');
    expect(checkPermission('__proto__', ADMIN)).toBe('unknown-action');
    expect(checkPermission('constructor', ADMIN)).toBe('unknown-action');
    expect(checkPermission(undefined, ADMIN)).toBe('unknown-action');
  });

  it('separates anonymous, citizen and admin', () => {
    expect(checkPermission('users.updateRole', ANONYMOUS)).toBe('unauthenticated');
    expect(checkPermission('users.updateRole', CITIZEN)).toBe('forbidden');
    expect(checkPermission('users.updateRole', ADMIN)).toBe('ok');
  });

  it('uses the signed-in user when none is passed, and the UI helper agrees', () => {
    expect(can('services.write')).toBe(false);
    setCurrentActor(CITIZEN);
    expect(can('services.write')).toBe(false);
    setCurrentActor(ADMIN);
    expect(can('services.write')).toBe(true);
    expect(getCurrentActor()).toBe(ADMIN);
  });

  it('ignores a non-object actor', () => {
    setCurrentActor('admin');
    expect(getCurrentActor()).toBeNull();
    expect(checkPermission('services.write', 'admin')).toBe('unauthenticated');
  });

  it('requirePermission throws a PermissionDeniedError that says what and why', () => {
    expect.assertions(4);
    try {
      requirePermission('services.write');
    } catch (error) {
      expect(error).toBeInstanceOf(PermissionDeniedError);
      expect(error.code).toBe('FORBIDDEN');
      expect(error.action).toBe('services.write');
      expect(error.reason).toBe('unauthenticated');
    }
  });
});

describe.each(Object.keys(CALLS))('%s', (action) => {
  it('is refused for an anonymous visitor and writes nothing', () => {
    setCurrentActor(ANONYMOUS);
    expect(outcome(CALLS[action])).toBe('denied');
    expect(store.setItem).not.toHaveBeenCalled();
    expect(moduleStorage.setItem).not.toHaveBeenCalled();
  });

  it('is refused for an ordinary signed-in user and writes nothing', () => {
    setCurrentActor(CITIZEN);
    expect(outcome(CALLS[action])).toBe('denied');
    expect(store.setItem).not.toHaveBeenCalled();
    expect(moduleStorage.setItem).not.toHaveBeenCalled();
  });

  it('is refused when the user object only claims a similar role', () => {
    setCurrentActor({ id: 'x', role: 'superadmin' });
    expect(outcome(CALLS[action])).toBe('denied');
  });

  it('is allowed past the permission check for an admin', () => {
    setCurrentActor(ADMIN);
    expect(outcome(CALLS[action])).toBe('ran');
  });
});

describe('what the data layer does for an admin', () => {
  it('lets an admin read the queues and save a guide', () => {
    setCurrentActor(ADMIN);
    expect(Array.isArray(getReports())).toBe(true);
    expect(Array.isArray(getAuditLogs())).toBe(true);
    expect(Array.isArray(getUserList())).toBe(true);
    expect(Array.isArray(getServiceSubmissions())).toBe(true);
    saveAdminService({ name: 'Admin Guide', category: 'Identity', shortDescription: 'x' });
    expect(store.setItem).toHaveBeenCalled();
  });

  it('stops working as soon as the user signs out or is demoted', () => {
    setCurrentActor(ADMIN);
    expect(() => getUserList()).not.toThrow();
    setCurrentActor({ ...ADMIN, role: 'citizen' });
    expect(() => getUserList()).toThrow(PermissionDeniedError);
    setCurrentActor(null);
    expect(() => getUserList()).toThrow(PermissionDeniedError);
  });
});

describe('claims made by the caller are not trusted', () => {
  it('a citizen who passes userRole "admin" cannot moderate a barrier report', () => {
    setCurrentActor(CITIZEN);
    expect(() => moderateBarrierReport({ reportId: 'b1', action: 'approve', userRole: 'admin' }, moduleStorage)).toThrow(
      expect.objectContaining({ code: 'UNAUTHORIZED_ACCESS' })
    );
    expect(moduleStorage.setItem).not.toHaveBeenCalled();
  });

  it('a citizen cannot pass reviewerRole "admin" to resolve a source conflict', () => {
    setCurrentActor(CITIZEN);
    expect(() =>
      resolveSourceConflict(
        { conflictId: 'c1', chosenValue: 'v', resolutionNotes: 'long enough', reviewerName: 'Boss', reviewerRole: 'admin' },
        moduleStorage
      )
    ).toThrow(PermissionDeniedError);
  });

  it('a citizen cannot pass an admin actor name to change roles or write the audit trail', () => {
    setCurrentActor(CITIZEN);
    expect(() => updateUserRole('usr-1', 'admin', {}, 'SuperAdmin')).toThrow(PermissionDeniedError);
    expect(() => addAuditLog({ action: 'ROLE_CHANGED', actor: 'SuperAdmin' })).toThrow(PermissionDeniedError);
  });

  it('actorLabel names the verified user and falls back when nobody is signed in', () => {
    expect(actorLabel()).toBe('Admin');
    expect(actorLabel('Unknown')).toBe('Unknown');
    setCurrentActor(ADMIN);
    expect(actorLabel()).toBe('Verified Admin');
  });
});

describe('public actions stay public', () => {
  it('anyone can submit an error report', () => {
    setCurrentActor(ANONYMOUS);
    expect(() =>
      submitErrorReport({ serviceId: 's', serviceName: 'S', issueType: 'Broken link', description: 'It 404s' })
    ).not.toThrow();
    expect(store.setItem).toHaveBeenCalled();
  });

  it('anyone can read the community audit reports', () => {
    setCurrentActor(ANONYMOUS);
    expect(() => getAuditReports()).not.toThrow();
  });

  it('a citizen submitting a report does not get to read the queue', () => {
    setCurrentActor(CITIZEN);
    submitErrorReport({ serviceId: 's', serviceName: 'S', issueType: 'Broken link', description: 'It 404s' });
    expect(() => getReports()).toThrow(PermissionDeniedError);
  });
});

describe('other privileged entry points refuse non-admins too', () => {
  it.each([
    ['queryFeedbackForModeration', () => queryFeedbackForModeration(moduleStorage)],
    ['resetFeedbackDefaults', () => resetFeedbackDefaults(moduleStorage)],
    ['reopenSourceConflict', () => reopenSourceConflict({ conflictId: 'c', reopenReason: 'new evidence' }, moduleStorage)],
    ['addNotice', () => addNotice({}, 'Admin', moduleStorage)],
    ['updateNotice', () => updateNotice('n1', {}, 'Admin', moduleStorage)],
    ['changeNoticeStatus', () => changeNoticeStatus('n1', 'approved', 'Admin', '', moduleStorage)],
    ['approveServiceSubmission', () => approveServiceSubmission('sub-1')],
  ])('%s', (_name, call) => {
    setCurrentActor(CITIZEN);
    expect(call).toThrow(PermissionDeniedError);
    setCurrentActor(null);
    expect(call).toThrow(PermissionDeniedError);
    expect(store.setItem).not.toHaveBeenCalled();
    expect(moduleStorage.setItem).not.toHaveBeenCalled();
  });
});
