import { describe, it, expect, beforeEach } from 'vitest';
import { EndToEndDistributedTracingService } from './distributedTracingService.js';

describe('EndToEndDistributedTracingService (#1250)', () => {
  let service;

  beforeEach(() => {
    service = new EndToEndDistributedTracingService({ sampleRate: 1.0 }); // 100% for tests
  });

  it('generates W3C compliant traceparent headers', () => {
    const traceContext = service.startTrace({ isHighSeverity: true });
    expect(traceContext.traceParent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    expect(traceContext.isSampled).toBe(true);
  });

  it('records spans and scrubs sensitive PII attributes automatically', () => {
    const { traceId, rootSpanId } = service.startTrace();
    
    service.recordSpan(traceId, {
      name: 'citizen-aadhaar-verification',
      parentSpanId: rootSpanId,
      attributes: {
        endpoint: '/api/v1/verify',
        aadhaarNumber: '1234-5678-9012',
        authToken: 'secret_jwt_bearer',
        httpStatus: 200
      }
    });

    const summary = service.getTraceSummary(traceId);
    expect(summary.totalSpans).toBe(1);
    expect(summary.spans[0].attributes.aadhaarNumber).toBe('[REDACTED_PII]');
    expect(summary.spans[0].attributes.authToken).toBe('[REDACTED_PII]');
    expect(summary.spans[0].attributes.httpStatus).toBe(200);
  });
});
