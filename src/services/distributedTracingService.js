import crypto from 'node:crypto';

export class EndToEndDistributedTracingService {
  constructor(config = {}) {
    this.sampleRate = config.sampleRate ?? 0.1; // 10% sampling default
    this.activeTraces = new Map();
  }

  generateTraceId() {
    return crypto.randomBytes(16).toString('hex');
  }

  generateSpanId() {
    return crypto.randomBytes(8).toString('hex');
  }

  shouldSample(traceId, isHighSeverity = false) {
    if (isHighSeverity) return true;
    const hashVal = parseInt(traceId.substring(0, 4), 16);
    return (hashVal / 0xffff) <= this.sampleRate;
  }

  startTrace(context = {}) {
    const traceId = context.traceId || this.generateTraceId();
    const rootSpanId = this.generateSpanId();
    const isSampled = this.shouldSample(traceId, context.isHighSeverity);

    const trace = {
      traceId,
      rootSpanId,
      isSampled,
      spans: []
    };

    if (isSampled) {
      this.activeTraces.set(traceId, trace);
    }

    return {
      traceParent: `00-${traceId}-${rootSpanId}-${isSampled ? '01' : '00'}`,
      traceId,
      rootSpanId,
      isSampled
    };
  }

  recordSpan(traceId, spanData = {}) {
    const trace = this.activeTraces.get(traceId);
    if (!trace || !trace.isSampled) return null;

    const spanId = spanData.spanId || this.generateSpanId();
    const sanitizedAttributes = this.scrubSensitiveData(spanData.attributes || {});

    const span = {
      spanId,
      parentSpanId: spanData.parentSpanId || trace.rootSpanId,
      name: spanData.name || 'unnamed-span',
      startTime: spanData.startTime || Date.now(),
      durationMs: spanData.durationMs || 10,
      attributes: sanitizedAttributes
    };

    trace.spans.push(span);
    return span;
  }

  scrubSensitiveData(attributes = {}) {
    const scrubbed = {};
    const sensitiveKeys = ['aadhaar', 'pan', 'password', 'token', 'phone', 'email', 'otp'];

    for (const [key, val] of Object.entries(attributes)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        scrubbed[key] = '[REDACTED_PII]';
      } else {
        scrubbed[key] = val;
      }
    }
    return scrubbed;
  }

  getTraceSummary(traceId) {
    const trace = this.activeTraces.get(traceId);
    if (!trace) return null;

    return {
      traceId: trace.traceId,
      totalSpans: trace.spans.length,
      spans: trace.spans
    };
  }
}
