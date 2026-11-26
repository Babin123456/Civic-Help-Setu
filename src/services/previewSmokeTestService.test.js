import { describe, it, expect, beforeEach } from 'vitest';
import {
  sanitizeBaseUrl,
  evaluateRouteSmoke,
  PreviewSmokeRunner,
  SMOKE_ROUTES,
  ROUTE_TYPES
} from './previewSmokeTestService.js';

describe('previewSmokeTestService', () => {
  describe('sanitizeBaseUrl', () => {
    it('normalizes preview URLs by removing trailing slashes', () => {
      expect(sanitizeBaseUrl('https://preview-deploy-123.vercel.app/')).toBe('https://preview-deploy-123.vercel.app');
      expect(sanitizeBaseUrl('https://civic-help.org///')).toBe('https://civic-help.org');
      expect(sanitizeBaseUrl('')).toBe('http://localhost:3000');
      expect(sanitizeBaseUrl(null)).toBe('http://localhost:3000');
    });
  });

  describe('evaluateRouteSmoke', () => {
    const homeRoute = SMOKE_ROUTES.find(r => r.path === '/');
    const adminRoute = SMOKE_ROUTES.find(r => r.path === '/admin/audit');
    const apiRoute = SMOKE_ROUTES.find(r => r.path === '/api/health');

    it('passes when landing page returns 200 with required content snippet', () => {
      const response = {
        status: 200,
        bodyText: '<main><h1>Civic Help Setu</h1><p>Empowering citizens</p></main>'
      };

      const verdict = evaluateRouteSmoke(homeRoute, response);
      expect(verdict.passed).toBe(true);
      expect(verdict.failures.length).toBe(0);
    });

    it('fails when landing page returns 500 server error', () => {
      const response = {
        status: 500,
        bodyText: 'Internal Server Error'
      };

      const verdict = evaluateRouteSmoke(homeRoute, response);
      expect(verdict.passed).toBe(false);
      expect(verdict.failures).toContain('Expected HTTP status 200, received 500');
    });

    it('fails when landing page is missing mandatory text snippet', () => {
      const response = {
        status: 200,
        bodyText: '<main><h1>Generic Title</h1></main>'
      };

      const verdict = evaluateRouteSmoke(homeRoute, response);
      expect(verdict.passed).toBe(false);
      expect(verdict.failures[0]).toContain('Missing required text snippet');
    });

    it('passes protected admin route when unauthenticated redirect is enforced', () => {
      const responseRedirect = {
        status: 302,
        headers: { location: '/sign-in' }
      };

      const verdict = evaluateRouteSmoke(adminRoute, responseRedirect);
      expect(verdict.passed).toBe(true);
    });

    it('fails protected admin route when open to unauthenticated visitors with 200 OK', () => {
      const responseLeak = {
        status: 200,
        bodyText: '<div>Sensitive Administrative Audit Logs</div>'
      };

      const verdict = evaluateRouteSmoke(adminRoute, responseLeak);
      expect(verdict.passed).toBe(false);
      expect(verdict.failures[0]).toContain('Expected unauthenticated redirect or auth challenge');
    });

    it('validates API health JSON responses accurately', () => {
      const validHealth = {
        status: 200,
        bodyJson: { status: 'ok', uptime: 3600 }
      };
      expect(evaluateRouteSmoke(apiRoute, validHealth).passed).toBe(true);

      const degradedHealth = {
        status: 200,
        bodyJson: { status: 'degraded' }
      };
      expect(evaluateRouteSmoke(apiRoute, degradedHealth).passed).toBe(false);
    });
  });

  describe('PreviewSmokeRunner', () => {
    it('evaluates complete suite and aggregates smoke test verdicts', () => {
      const runner = new PreviewSmokeRunner('https://preview.vercel.app');
      const mockSuiteResponses = [
        { status: 200, bodyText: 'Civic Help Setu Citizen Portal' },
        { status: 200, bodyText: 'Citizen Schemes Catalog' },
        { status: 200, bodyText: 'Ask your civic question' },
        { status: 302, headers: { location: '/sign-in' } },
        { status: 200, bodyJson: { status: 'ok' } }
      ];

      const report = runner.evaluateSuite(mockSuiteResponses);
      expect(report.totalRoutes).toBe(5);
      expect(report.passedRoutes).toBe(5);
      expect(report.failedRoutes).toBe(0);
      expect(report.allPassed).toBe(true);
    });
  });
});
