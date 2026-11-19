import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  STATUS,
  DEVICE_CLASS,
  ERROR_CATEGORY,
  PERMITTED_CHECK_METHODS,
  DEFAULT_CHECK_TIMEOUT_MS,
  DEFAULT_CHECK_TTL_HOURS,
  MAX_COMMUNITY_REPORTS_PER_SERVICE,
  runSyntheticCheck,
  submitAnonymousReport,
  publishOfficialAnnouncement,
  rateLimitCheck,
  classifyErrorCategory,
  OFFLINE_CHECKLIST_TEMPLATES,
  getOfflineChecklist,
} from './civicServiceStatusObservatoryService.js';

describe('civicServiceStatusObservatoryService - Constants', () => {
  it('has expected STATUS values', () => {
    expect(STATUS.REACHABLE).toBe('reachable');
    expect(STATUS.UNAVAILABLE).toBe('unavailable');
    expect(STATUS.UNVERIFIED).toBe('unverified');
    expect(STATUS.RATE_LIMITED).toBe('rateLimited');
    expect(STATUS.BLOCKED).toBe('blocked');
  });

  it('has expected DEVICE_CLASS values', () => {
    expect(DEVICE_CLASS.DESKTOP).toBe('desktop');
    expect(DEVICE_CLASS.MOBILE).toBe('mobile');
    expect(DEVICE_CLASS.TABLET).toBe('tablet');
    expect(DEVICE_CLASS.UNKNOWN).toBe('unknown');
  });

  it('has expected ERROR_CATEGORY values', () => {
    expect(ERROR_CATEGORY.CONNECTIVITY).toBe('connectivity');
    expect(ERROR_CATEGORY.PORTAL_OUTAGE).toBe('portalOutage');
    expect(ERROR_CATEGORY.MAINTENANCE).toBe('maintenance');
    expect(ERROR_CATEGORY.FORM_SUBMISSION).toBe('formSubmission');
    expect(ERROR_CATEGORY.AUTHENTICATION).toBe('authentication');
    expect(ERROR_CATEGORY.UNKNOWN).toBe('unknown');
  });

  it('PERMITTED_CHECK_METHODS is an array with GET', () => {
    expect(PERMITTED_CHECK_METHODS).toContain('GET');
    expect(PERMITTED_CHECK_METHODS.length).toBe(1);
  });

  it('has reasonable default timeout', () => {
    expect(DEFAULT_CHECK_TIMEOUT_MS).toBe(8000);
  });

  it('has default TTL of 24 hours', () => {
    expect(DEFAULT_CHECK_TTL_HOURS).toBe(24);
  });

  it('has max community reports limit', () => {
    expect(MAX_COMMUNITY_REPORTS_PER_SERVICE).toBe(50);
  });
});

describe('civicServiceStatusObservatoryService - runSyntheticCheck', () => {
  const mockFetch = (init) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(init));
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('blocks invalid URL (non-https)', async () => {
    const result = await runSyntheticCheck('ftp://files.gov.in/data');
    expect(result.status).toBe(STATUS.BLOCKED);
  });

  it('blocks empty URL', async () => {
    const result = await runSyntheticCheck('');
    expect(result.status).toBe(STATUS.BLOCKED);
  });

  it('blocks URL not in allowlisted official domain', async () => {
    mockFetch({
      status: 200,
      type: 'basic',
      ok: true,
    });

    const result = await runSyntheticCheck('http://invalid-service.com');
    expect(result.status).toBe(STATUS.BLOCKED);
    expect(result.error).toBe('URL not in allowlisted official domain');
    expect(result.synthetic).toBe(true);
    expect(result.method).toBe('GET');
  });

  it('performs successful reachable check', async () => {
    mockFetch({
      status: 200,
      type: 'basic',
      ok: true,
    });

    const result = await runSyntheticCheck('https://services.india.gov.in/service');
    expect(result.status).toBe(STATUS.REACHABLE);
    expect(result.httpStatus).toBe(200);
    expect(result.synthetic).toBe(true);
    expect(result.method).toBe('GET');
    expect(result.error).toBeNull();
  });

  it('classifies 503 as unavailable', async () => {
    mockFetch({
      status: 503,
      type: 'basic',
      ok: false,
    });

    const result = await runSyntheticCheck('https://portal.example.gov.in');
    expect(result.status).toBe(STATUS.UNAVAILABLE);
    expect(result.httpStatus).toBe(503);
  });

  it('classifies 403 as rate limited (access restricted)', async () => {
    mockFetch({
      status: 403,
      type: 'basic',
      ok: false,
    });

    const result = await runSyntheticCheck('https://portal.example.gov.in');
    expect(result.status).toBe(STATUS.RATE_LIMITED);
    expect(result.httpStatus).toBe(403);
  });

  it('classifies 401 as rate limited', async () => {
    mockFetch({
      status: 401,
      type: 'basic',
      ok: false,
    });

    const result = await runSyntheticCheck('https://portal.example.gov.in');
    expect(result.status).toBe(STATUS.RATE_LIMITED);
    expect(result.httpStatus).toBe(401);
  });

  it('classifies 429 as rate limited', async () => {
    mockFetch({
      status: 429,
      type: 'basic',
      ok: false,
    });

    const result = await runSyntheticCheck('https://portal.example.gov.in');
    expect(result.status).toBe(STATUS.RATE_LIMITED);
    expect(result.httpStatus).toBe(429);
  });

  it('classifies 407 as rate limited', async () => {
    mockFetch({
      status: 407,
      type: 'basic',
      ok: false,
    });

    const result = await runSyntheticCheck('https://portal.example.gov.in');
    expect(result.status).toBe(STATUS.RATE_LIMITED);
    expect(result.httpStatus).toBe(407);
  });

  it('handles timeout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network timeout')));

    const result = await runSyntheticCheck('https://slow-portal.gov.in', {
      timeoutMs: 100,
    });
    expect(result.status).toBe(STATUS.UNVERIFIED);
    // reason field may contain timeout info
    expect(result.error).toBeDefined();
  });

  it('handles CORS/blocked errors gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue({
      name: 'AbortError',
      message: 'CORS policy blocking request',
    }));

    const result = await runSyntheticCheck('https://portal-with-cors-restrictions.gov.in');
    expect(result.status).toBe(STATUS.UNVERIFIED);
    expect(result.error).toBeDefined();
  });

  it('uses GET method for all checks', async () => {
    const testUrls = [
      'https://services.india.gov.in/service',
      'https://parivahan.gov.in/rc',
      'https://cmhelpline.tnega.org',
    ];

    for (const url of testUrls) {
      mockFetch({
        status: 200,
        type: 'basic',
        ok: true,
      });

      const result = await runSyntheticCheck(url);
      expect(result.method).toBe('GET');
      expect(result.synthetic).toBe(true);
    }
  });
});

describe('civicServiceStatusObservatoryService - submitAnonymousReport', () => {
  it('requires serviceKey', () => {
    const reporter = () => submitAnonymousReport({ description: 'Portal down' });
    expect(reporter).toThrow('Valid serviceKey is required for community report');
  });

  it('requires description', () => {
    const reporter = () => submitAnonymousReport({ serviceKey: 'TEST_SERVICE' });
    expect(reporter).toThrow('Description of the failure is required');
  });

  it('creates report with correct tier and structure', () => {
    const report = submitAnonymousReport({
      serviceKey: 'VAHAN_PORTAL',
      description: 'Payment gateway returning 504 Gateway Timeout during UPI checkout.',
      errorCategory: ERROR_CATEGORY.PORTAL_OUTAGE,
      deviceClass: DEVICE_CLASS.MOBILE,
    });

    expect(report.tier).toBe('COMMUNITY_REPORTED');
    expect(report.serviceKey).toBe('VAHAN_PORTAL');
    expect(report.description).toContain('Payment gateway');
    expect(report.errorCategory).toBe(ERROR_CATEGORY.PORTAL_OUTAGE);
    expect(report.deviceClass).toBe(DEVICE_CLASS.MOBILE);
    expect(report.isModerated).toBe(false);
    expect(report.id).toMatch(/^obs_comm_/);
  });

  it('uses default deviceClass when not specified', () => {
    const report = submitAnonymousReport({
      serviceKey: 'TEST_SERVICE',
      description: 'Cannot load the portal.',
    });
    expect(report.deviceClass).toBe(DEVICE_CLASS.UNKNOWN);
  });

  it('omits IP bucket for privacy', () => {
    const report = submitAnonymousReport({
      serviceKey: 'TEST_SERVICE',
      description: 'Portal down',
    });
    // Privacy by design: no userIpBucket field should exist
    expect(report).not.toHaveProperty('userIpBucket');
  });
});

describe('civicServiceStatusObservatoryService - publishOfficialAnnouncement', () => {
  it('requires authorization for unknown role', () => {
    const reporter = () =>
      publishOfficialAnnouncement(
        {
          serviceKey: 'TEST_SERVICE',
          title: 'Test Outage',
          officialSource: 'Test Source',
        },
        'UNKNOWN_ROLE'
      );
    expect(reporter).toThrow('Authorization Error');
  });

  it('authorizes OFFICIAL_EDITOR role', () => {
    const result = publishOfficialAnnouncement(
      {
        serviceKey: 'TEST_SERVICE',
        title: 'Test Outage',
        officialSource: 'Test Source',
      },
      'OFFICIAL_EDITOR'
    );
    expect(result).toBeDefined();
    expect(result.tier).toBe('VERIFIED_OFFICIAL');
  });

  it('authorizes ADMIN role', () => {
    const result = publishOfficialAnnouncement(
      {
        serviceKey: 'TEST_SERVICE',
        title: 'Test Outage',
        officialSource: 'Test Source',
      },
      'ADMIN'
    );
    expect(result).toBeDefined();
    expect(result.tier).toBe('VERIFIED_OFFICIAL');
  });

  it('rejects when missing required fields', () => {
    const reporter = () =>
      publishOfficialAnnouncement(
        {
          title: 'Test Outage',
          // missing serviceKey
          officialSource: 'Test Source',
        },
        'ADMIN'
      );
    expect(reporter).toThrow('Valid serviceKey, title, and officialSource are required');
  });

  it('rejects when missing title', () => {
    const reporter = () =>
      publishOfficialAnnouncement(
        {
          serviceKey: 'TEST_SERVICE',
          // missing title
          officialSource: 'Test Source',
        },
        'ADMIN'
      );
    expect(reporter).toThrow('Valid serviceKey, title, and officialSource are required');
  });

  it('rejects when missing officialSource', () => {
    const reporter = () =>
      publishOfficialAnnouncement(
        {
          serviceKey: 'TEST_SERVICE',
          title: 'Test Outage',
          // missing officialSource
        },
        'ADMIN'
      );
    expect(reporter).toThrow('Valid serviceKey, title, and officialSource are required');
  });

  it('validates alternative channel URLs - filters invalid', () => {
    const result = publishOfficialAnnouncement(
      {
        serviceKey: 'TEST_SERVICE',
        title: 'Test Outage',
        officialSource: 'Test Source',
        alternativeChannels: [
          {
            type: 'SECONDARY_PORTAL',
            name: 'Alternative Portal',
            url: 'https://thirdparty-service.com', // Not official domain
          },
        ],
      },
      'ADMIN'
    );
    // Invalid URLs are silently filtered out
    expect(result.alternativeChannels.length).toBe(0);
  });

  it('accepts valid official alternative channel URLs', () => {
    const result = publishOfficialAnnouncement(
      {
        serviceKey: 'TEST_SERVICE',
        title: 'Test Outage',
        officialSource: 'Test Source',
        alternativeChannels: [
          {
            type: 'SECONDARY_PORTAL',
            name: 'Alternative Portal',
            url: 'https://services.india.gov.in/service',
          },
        ],
      },
      'ADMIN'
    );
    expect(result.alternativeChannels.length).toBe(1);
    expect(result.alternativeChannels[0].url).toContain('services.india.gov.in');
  });
});

describe('civicServiceStatusObservatoryService - rateLimitCheck', () => {
  // Note: rateLimitCheck gracefully handles environments without localStorage
  // by always allowing the check. In test environments without localStorage,
  // the function returns true regardless of interval.

  it('allows check when no previous check recorded (no localStorage)', () => {
    const canCheck = rateLimitCheck('TEST_SERVICE');
    expect(canCheck).toBe(true);
  });

  it('allows check when no localStorage available (e.g., SSR)', () => {
    // When localStorage is unavailable, rateLimitCheck always allows
    const canCheck = rateLimitCheck('TEST_SERVICE');
    expect(canCheck).toBe(true);
  });
});

describe('civicServiceStatusObservatoryService - classifyErrorCategory', () => {
  it('classifies RATE_LIMITED as CONNECTIVITY', () => {
    const result = classifyErrorCategory({ status: STATUS.RATE_LIMITED });
    expect(result).toBe(ERROR_CATEGORY.CONNECTIVITY);
  });

  it('classifies UNAVAILABLE as PORTAL_OUTAGE', () => {
    const result = classifyErrorCategory({ status: STATUS.UNAVAILABLE });
    expect(result).toBe(ERROR_CATEGORY.PORTAL_OUTAGE);
  });

  it('classifies UNVERIFIED with timeout as CONNECTIVITY', () => {
    const result = classifyErrorCategory({ status: STATUS.UNVERIFIED, error: 'Request timed out' });
    expect(result).toBe(ERROR_CATEGORY.CONNECTIVITY);
  });

  it('classifies UNVERIFIED with blocked-or-network as CONNECTIVITY', () => {
    const result = classifyErrorCategory({ status: STATUS.UNVERIFIED, error: 'CORS policy blocking request' });
    expect(result).toBe(ERROR_CATEGORY.CONNECTIVITY);
  });

  it('classifies BLOCKED as UNKNOWN', () => {
    const result = classifyErrorCategory({ status: STATUS.BLOCKED });
    expect(result).toBe(ERROR_CATEGORY.UNKNOWN);
  });

  it('classifies REACHABLE as UNKNOWN (no error)', () => {
    const result = classifyErrorCategory({ status: STATUS.REACHABLE });
    expect(result).toBe(ERROR_CATEGORY.UNKNOWN);
  });
});

describe('civicServiceStatusObservatoryService - OFFLINE_CHECKLIST_TEMPLATES', () => {
  it('has templates for all device classes', () => {
    expect(OFFLINE_CHECKLIST_TEMPLATES[DEVICE_CLASS.DESKTOP]).toBeDefined();
    expect(OFFLINE_CHECKLIST_TEMPLATES[DEVICE_CLASS.MOBILE]).toBeDefined();
    expect(OFFLINE_CHECKLIST_TEMPLATES[DEVICE_CLASS.TABLET]).toBeDefined();
    expect(OFFLINE_CHECKLIST_TEMPLATES[DEVICE_CLASS.UNKNOWN]).toBeDefined();
  });

  it('desktop checklist has expected structure', () => {
    const checklist = OFFLINE_CHECKLIST_TEMPLATES[DEVICE_CLASS.DESKTOP];
    expect(checklist.title).toContain('Desktop');
    expect(checklist.steps).toBeInstanceOf(Array);
    expect(checklist.steps.length).toBeGreaterThan(0);
  });

  it('mobile checklist has expected structure', () => {
    const checklist = OFFLINE_CHECKLIST_TEMPLATES[DEVICE_CLASS.MOBILE];
    expect(checklist.title).toContain('Mobile');
    expect(checklist.steps).toBeInstanceOf(Array);
  });

  it('tablet checklist has expected structure', () => {
    const checklist = OFFLINE_CHECKLIST_TEMPLATES[DEVICE_CLASS.TABLET];
    expect(checklist.title).toContain('Tablet');
    expect(checklist.steps).toBeInstanceOf(Array);
  });

  it('getOfflineChecklist returns correct template', () => {
    expect(getOfflineChecklist(DEVICE_CLASS.MOBILE)).toMatchObject({
      title: expect.stringContaining('Mobile'),
    });
  });

  it('getOfflineChecklist defaults to UNKNOWN when invalid class provided', () => {
    expect(getOfflineChecklist('invalid-class')).toBeDefined();
    expect(getOfflineChecklist()).toBeDefined();
  });

  it('UNKNOWN device class has checklist', () => {
    const checklist = OFFLINE_CHECKLIST_TEMPLATES[DEVICE_CLASS.UNKNOWN];
    expect(checklist.title).toContain('Unknown Device');
    expect(checklist.steps).toBeInstanceOf(Array);
  });
});