import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { createApiDispatcher } from '../api/[...path].js';
import {
  createMeshReadinessLayer,
  createMeshServiceClient,
  createServiceKeyring,
  generateServiceKeyPair,
  signServiceAssertion,
  MESH_AUTH_MODES,
} from '../api/_lib/mesh/index.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    writableEnded: false,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      this.writableEnded = true;
      return this;
    },
    end() {
      this.writableEnded = true;
      return this;
    },
  };
}

describe('Service Mesh Readiness Integration', () => {
  it('maintains backward compatibility in disabled and permissive modes while propagating traces', async () => {
    const disabledLayer = createMeshReadinessLayer({ mode: MESH_AUTH_MODES.DISABLED });
    const disabledDispatcher = createApiDispatcher({ meshLayer: disabledLayer });

    const res1 = createMockRes();
    await disabledDispatcher(
      { method: 'GET', url: '/api/mesh-readiness?action=status', query: { path: 'mesh-readiness', action: 'status' }, headers: {} },
      res1
    );
    expect(res1.statusCode).toBe(200);
    expect(res1.body.ok).toBe(true);
    expect(res1.headers.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    expect(res1.headers['x-correlation-id']).toBeTruthy();
    expect(res1.headers['x-mesh-auth-status']).toBe('skipped');

    const permissiveLayer = createMeshReadinessLayer({ mode: MESH_AUTH_MODES.PERMISSIVE });
    const permissiveDispatcher = createApiDispatcher({ meshLayer: permissiveLayer });

    const res2 = createMockRes();
    await permissiveDispatcher(
      {
        method: 'GET',
        url: '/api/mesh-readiness?action=status',
        query: { path: 'mesh-readiness', action: 'status' },
        headers: { traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01' },
      },
      res2
    );
    expect(res2.statusCode).toBe(200);
    expect(res2.headers['x-mesh-auth-status']).toBe('permissive_bypass');
    expect(res2.headers.traceparent).toContain('4bf92f3577b34da6a3ce929d0e0e4736');
    expect(permissiveLayer.telemetry.getCounters().authPermissiveBypass).toBe(1);

    // Control-plane mutations (POST /api/mesh-readiness) fail closed even in disabled/permissive modes
    for (const disp of [disabledDispatcher, permissiveDispatcher]) {
      const mutRes = createMockRes();
      await disp(
        {
          method: 'POST',
          url: '/api/mesh-readiness',
          query: { path: 'mesh-readiness' },
          headers: {},
          body: { action: 'revoke-key', kid: 'any-kid' },
        },
        mutRes
      );
      expect(mutRes.statusCode).toBe(401);
      expect(mutRes.body.error).toBe('service_auth_required');
    }
  });

  it('authenticates service-to-service calls independently of end-user Clerk sessions in enforced mode', async () => {
    const gatewayKey = generateServiceKeyPair({ serviceId: 'civic-api-gateway', kid: 'gw-1' });
    const workerKey = generateServiceKeyPair({ serviceId: 'svc-worker', kid: 'wk-1' });

    const keyring = createServiceKeyring({
      initialKeys: [
        { ...gatewayKey, allowedAudiences: ['*'], allowedScopes: ['*'] },
        {
          ...workerKey,
          allowedAudiences: ['civic-api-gateway'],
          allowedScopes: ['internal:read', 'internal:admin'],
        },
      ],
    });

    const meshLayer = createMeshReadinessLayer({
      mode: MESH_AUTH_MODES.ENFORCED,
      serviceId: 'civic-api-gateway',
      keyring,
      signingKey: gatewayKey,
      routeScopes: {
        'mesh-readiness': { GET: ['internal:read'], POST: ['internal:admin'] },
        'internal/echo': { POST: ['internal:read'] },
      },
    });

    const dispatcher = createApiDispatcher({
      meshLayer,
      extraHandlers: {
        'internal/echo': async (req) => ({
          status: 200,
          headers: {},
          body: {
            callerService: req.meshContext.servicePrincipal?.serviceId || null,
            endUserIsolated: req.meshContext.endUserIsolated,
            traceId: req.meshContext.trace.traceId,
            parentSpanId: req.meshContext.trace.parentSpanId,
          },
        }),
      },
    });

    // End-user Clerk token alone CANNOT authenticate internal service route
    const userOnlyRes = createMockRes();
    await dispatcher(
      {
        method: 'POST',
        url: '/api/internal/echo',
        query: { path: 'internal/echo' },
        headers: { authorization: 'Bearer clerk_end_user_session_token_abc' },
        body: { hello: 'world' },
      },
      userOnlyRes
    );
    expect(userOnlyRes.statusCode).toBe(401);
    expect(userOnlyRes.body.code).toBe('MESH_SERVICE_ASSERTION_MISSING');

    // Service client performs multi-hop call with mutual server proof verification
    const client = createMeshServiceClient({
      callerServiceId: 'svc-worker',
      signingKey: workerKey,
      keyring,
      requireServerProof: true,
      fetchImpl: async (url, init) => {
        const parsed = new URL(url, 'http://internal.mesh');
        const route = parsed.pathname.replace(/^\/api\/?/, '');
        const mockRes = createMockRes();
        await dispatcher(
          {
            method: init.method,
            url: `${parsed.pathname}${parsed.search}`,
            query: {
              path: route,
              ...Object.fromEntries(parsed.searchParams.entries()),
            },
            headers: init.headers,
            body: init.body ? JSON.parse(init.body) : undefined,
          },
          mockRes
        );
        return {
          status: mockRes.statusCode,
          headers: { get: (k) => mockRes.headers[k.toLowerCase()] },
          body: mockRes.body,
        };
      },
    });

    const rootTrace = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const rootSpan = 'bbbbbbbbbbbbbbbb';
    const hopCall = await client.call({
      targetServiceId: 'civic-api-gateway',
      url: '/api/internal/echo',
      method: 'POST',
      scopes: ['internal:read'],
      parentTraceContext: {
        traceId: rootTrace,
        spanId: rootSpan,
        correlationId: 'corr-root-integration',
      },
      body: { synthetic: true },
    });

    expect(hopCall.response.status).toBe(200);
    expect(hopCall.response.body.callerService).toBe('svc-worker');
    expect(hopCall.response.body.endUserIsolated).toBe(true);
    expect(hopCall.response.body.traceId).toBe(rootTrace);
    expect(hopCall.response.body.parentSpanId).toBe(hopCall.traceContext.spanId);

    // Service without internal:admin scope gets 403 on POST /api/mesh-readiness
    const readOnlyToken = signServiceAssertion({
      signingKey: workerKey,
      audience: 'civic-api-gateway',
      scopes: ['internal:read'],
    });
    const forbiddenRes = createMockRes();
    await dispatcher(
      {
        method: 'POST',
        url: '/api/mesh-readiness',
        query: { path: 'mesh-readiness' },
        headers: { 'x-service-assertion': readOnlyToken },
        body: { action: 'prune-expired' },
      },
      forbiddenRes
    );
    expect(forbiddenRes.statusCode).toBe(403);
    expect(forbiddenRes.body.code).toBe('MESH_INSUFFICIENT_SCOPE');

    // Admin scope rotates key and revokes old key via /api/mesh-readiness
    const nextWorkerKey = generateServiceKeyPair({ serviceId: 'svc-worker', kid: 'wk-2' });
    const rotateRes = await client.call({
      targetServiceId: 'civic-api-gateway',
      url: '/api/mesh-readiness',
      method: 'POST',
      scopes: ['internal:admin'],
      idempotencyKey: 'rot-wk-2',
      body: {
        action: 'rotate-key',
        kid: nextWorkerKey.kid,
        serviceId: nextWorkerKey.serviceId,
        publicKeyPem: nextWorkerKey.publicKeyPem,
      },
    });
    expect(rotateRes.response.status).toBe(200);
    expect(keyring.getKey('wk-1').status).toBe('grace');
    expect(keyring.getKey('wk-2').status).toBe('active');

    // GET /api/mesh-readiness?action=keys never leaks private keys
    const keysRes = await client.call({
      targetServiceId: 'civic-api-gateway',
      url: '/api/mesh-readiness?action=keys',
      method: 'GET',
      scopes: ['internal:read'],
    });
    expect(keysRes.response.status).toBe(200);
    for (const k of keysRes.response.body.keys) {
      expect(k.privateKeyPem).toBeUndefined();
      expect(k.publicKeyPem).toBeUndefined();
    }
  });

  it('loads all api/_lib/mesh modules cleanly under plain Node ESM', () => {
    const meshBarrel = join(ROOT, 'api', '_lib', 'mesh', 'index.js');
    const readinessHandler = join(ROOT, 'api', '_lib', 'handlers', 'mesh-readiness.js');
    const probe = `
      const mesh = await import(${JSON.stringify(meshBarrel)});
      const handlerMod = await import(${JSON.stringify(readinessHandler)});
      console.log('@@OK@@' + JSON.stringify({
        hasLayer: typeof mesh.createMeshReadinessLayer === 'function',
        hasHandler: typeof handlerMod.createMeshReadinessHandler === 'function',
      }));
    `;
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', probe], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 30_000,
    });
    expect(child.status, child.stderr).toBe(0);
    const parsed = JSON.parse(child.stdout.split('@@OK@@')[1]);
    expect(parsed).toEqual({ hasLayer: true, hasHandler: true });
  });
});
