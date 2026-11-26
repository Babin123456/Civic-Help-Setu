import { describe, expect, it } from 'vitest';
import { describeApiFailure, apiFailureError } from './civicErrorContract.js';
describe('client API recovery', () => {
 it.each([[401,'UNAUTHENTICATED','sign_in'],[403,'FORBIDDEN','request_access'],[409,'CONFLICT','refresh'],[429,'RATE_LIMITED','wait'],[503,'DEPENDENCY_UNAVAILABLE','retry_later']])('uses codes/status, not arbitrary error text, for %s', (status,code,action) => {
  for(const body of [{error:'SYNTHETIC_PRIVATE_SENTINEL'}, {errorVersion:999,code:'NETWORK_ERROR',retryable:true}, null]) {
   const safe=describeApiFailure({status,body});expect(safe.code).toBe(code);expect(safe.recoveryAction).toBe(action);expect(JSON.stringify(safe)).not.toContain('SENTINEL');
  }
 });
 it('rejects malformed IDs/delays and never copies raw response details', () => {
  const safe=describeApiFailure({status:429,body:{errorVersion:1,code:'RATE_LIMITED',correlationId:'SYNTHETIC_PRIVATE_SENTINEL',retryAfterSeconds:999999,details:'SYNTHETIC_PRIVATE_SENTINEL'}});
  expect(safe.correlationId).toBeNull();expect(safe.retryAfterSeconds).toBeUndefined();expect(JSON.stringify(safe)).not.toContain('SENTINEL');
 });
 it('uses a safe network failure with no fabricated server correlation ID', () => {
  const error=apiFailureError();expect(error.code).toBe('NETWORK_ERROR');expect(error.retryable).toBe(true);expect(error.correlationId).toBeNull();expect(error.cause).toBeUndefined();
 });
});
