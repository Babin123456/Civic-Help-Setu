import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CIVIC_EVENT_TYPE, OUTBOX_STATUS, stageOutboxEvent, registerEventConsumer, dispatchPendingOutboxEvents, replayDeadLetterEvent, getEventBusHealthMetrics, getEventConsumerInventory, _resetEventBusInternalStores } from './civicDomainEventBusService.js';

const type = CIVIC_EVENT_TYPE.APPLICATION_SUBMITTED;
const input = extra => ({ eventType: type, aggregateId: 'synthetic-application', producerDomain: 'APPLICATION_PORTAL', payload: { serviceId: 'SYNTHETIC_SERVICE' }, ...extra });
beforeEach(() => { _resetEventBusInternalStores(); vi.useRealTimers(); });

describe('registered contract enforcement through the existing event bus', () => {
  it('preserves the legacy JSON payload and default consumer behavior', async () => {
    const handler = vi.fn(); registerEventConsumer('legacy', [type], handler);
    const event = stageOutboxEvent(input({ payload: ['legacy', { freeform: true }] }));
    await dispatchPendingOutboxEvents();
    expect(handler).toHaveBeenCalledWith(event);
    expect(event.schemaVersion).toBe('1.0.0');
    expect(getEventConsumerInventory()[0]).toMatchObject({ contractVersions: { [type]: ['1.0.0'] }, declared: false, owner: null });
  });

  it('rejects unknown versions and malformed typed payloads before an idempotency hit or state write', () => {
    stageOutboxEvent(input({ idempotencyKey: 'retry' }));
    expect(() => stageOutboxEvent(input({ idempotencyKey: 'retry', schemaVersion: '9.0.0' }))).toThrow('Unknown event contract');
    expect(() => stageOutboxEvent(input({ schemaVersion: '2.0.0', payload: { serviceId: 7 } }))).toThrow('expected string');
    expect(() => stageOutboxEvent(input({ schemaVersion: '2.0.0', producerDomain: 'spoofed-producer' }))).toThrow('Producer is not declared');
    expect(getEventBusHealthMetrics()).toMatchObject({ outboxDepth: 1, contractRejectedCount: 3 });
  });

  it('requires old consumers to opt in before a typed producer can publish', async () => {
    const handler = vi.fn(); registerEventConsumer('reader', [type], handler);
    expect(() => stageOutboxEvent(input({ schemaVersion: '2.0.0' }))).toThrow('migrate it before publishing');
    registerEventConsumer('reader', [type], handler, { contractVersions: { [type]: ['1.0.0', '2.0.0'] }, owner: 'synthetic-owner' });
    const event = stageOutboxEvent(input({ schemaVersion: '2.0.0' }));
    await dispatchPendingOutboxEvents();expect(handler).toHaveBeenCalledExactlyOnceWith(event);
    const inventory = getEventConsumerInventory();inventory[0].contractVersions[type].length = 0;
    expect(getEventConsumerInventory()[0].contractVersions[type]).toHaveLength(2);
    expect(inventory[0]).not.toHaveProperty('handlerFn');
  });

  it('does not allow another tenant’s incompatible consumer to block admission', () => {
    registerEventConsumer('other-tenant', [type], vi.fn(), { tenantScope: 'other' });
    expect(() => stageOutboxEvent(input({ tenantId: 'fixture', schemaVersion: '2.0.0' }))).not.toThrow();
  });

  it('keeps failed registration atomic and rejects prototype/unknown subscriptions', () => {
    registerEventConsumer('reader', [type], vi.fn());
    expect(() => registerEventConsumer('reader', [type], vi.fn(), { contractVersions: { [type]: ['missing'] } })).toThrow();
    expect(getEventConsumerInventory()[0].contractVersions[type]).toEqual(['1.0.0']);
    expect(() => registerEventConsumer('bad', ['toString'], vi.fn())).toThrow();
    expect(() => stageOutboxEvent(input({ eventType: 'constructor' }))).toThrow('Invalid or unsupported');
  });

  it('isolates tenant idempotency, rejects changed retries, and coalesces concurrent same-contract publication', async () => {
    const events = await Promise.all(Array.from({ length: 64 }, () => Promise.resolve().then(() => stageOutboxEvent(input({ tenantId: 'one', idempotencyKey: 'fixture-key' })))));
    expect(new Set(events.map(event => event.eventId)).size).toBe(1);
    const other = stageOutboxEvent(input({ tenantId: 'two', idempotencyKey: 'fixture-key' }));
    expect(other.eventId).not.toBe(events[0].eventId);
    expect(() => stageOutboxEvent(input({ tenantId: 'one', idempotencyKey: 'fixture-key', schemaVersion: '2.0.0' }))).toThrow('Idempotency key conflicts');
    expect(getEventBusHealthMetrics().outboxDepth).toBe(2);
  });

  it('retries a consumer contract regression and supports explicit recovery/replay without silent delivery', async () => {
    const handler = vi.fn();registerEventConsumer('reader', [type], handler, { contractVersions: { [type]: ['2.0.0'] } });
    const event = stageOutboxEvent(input({ schemaVersion: '2.0.0', maxAttempts: 1 }));
    registerEventConsumer('reader', [type], handler);
    await dispatchPendingOutboxEvents();expect(handler).not.toHaveBeenCalled();expect(event.status).toBe(OUTBOX_STATUS.DEAD_LETTERED);
    registerEventConsumer('reader', [type], handler, { contractVersions: { [type]: ['1.0.0', '2.0.0'] } });
    await replayDeadLetterEvent(`dlq_${event.eventId}`, 'synthetic-operator', 'Consumer declaration repaired');
    expect(handler).toHaveBeenCalledTimes(1);expect(event.status).toBe(OUTBOX_STATUS.DELIVERED);
    expect(getEventBusHealthMetrics().consumerContractFailureCount).toBe(1);
  });

  it('reserves a dispatcher batch before awaiting consumers so overlapping drains do not double-execute', async () => {
    let release;const gate = new Promise(resolve => { release = resolve; });
    const handler = vi.fn(async event => { if (event.aggregateId === 'first') await gate; });
    registerEventConsumer('reader', [type], handler);
    stageOutboxEvent(input({ aggregateId: 'first' }));stageOutboxEvent(input({ aggregateId: 'second' }));
    const first = dispatchPendingOutboxEvents({ batchSize: 2 });
    expect((await dispatchPendingOutboxEvents({ batchSize: 2 })).dispatchedCount).toBe(0);
    release();await first;expect(handler).toHaveBeenCalledTimes(2);
  });

  it('drains a bounded synthetic burst through the real staging/consumer path', async () => {
    const handler = vi.fn();registerEventConsumer('reader', [type], handler, { contractVersions: { [type]: ['2.0.0'] } });
    for (let i = 0; i < 500; i += 1) stageOutboxEvent(input({ aggregateId: `synthetic-${i}`, schemaVersion: '2.0.0', idempotencyKey: `fixture-${i}` }));
    while (getEventBusHealthMetrics().pendingCount) await dispatchPendingOutboxEvents({ batchSize: 32 });
    expect(handler).toHaveBeenCalledTimes(500);expect(getEventBusHealthMetrics()).toMatchObject({ deliveredCount: 500, deadLetterCount: 0 });
  });
});
