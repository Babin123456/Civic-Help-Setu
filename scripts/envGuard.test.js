import { describe, it, expect } from 'vitest';
import { findSecretLikeVars, formatFindings } from './envGuard';

describe('findSecretLikeVars', () => {
  it('accepts the public config this app actually uses', () => {
    expect(findSecretLikeVars({ VITE_CLERK_PUBLISHABLE_KEY: 'pk_live_abc123' })).toEqual([]);
    expect(findSecretLikeVars({ VITE_CLERK_PUBLISHABLE_KEY: 'pk_test_abc123' })).toEqual([]);
    expect(findSecretLikeVars({})).toEqual([]);
    expect(findSecretLikeVars()).toEqual([]);
  });

  it('accepts public keys other providers hand out for browsers', () => {
    expect(
      findSecretLikeVars({
        VITE_FIREBASE_API_KEY: 'AIzaSyA1234567890abcdefghij',
        VITE_FIREBASE_PROJECT_ID: 'civic-help-setu',
        VITE_MAPS_API_KEY: 'AIzaSyB1234567890abcdefghij',
        VITE_MAPBOX_TOKEN: 'pk.eyJ1IjoiZm9vIn0.bar',
      })
    ).toEqual([]);
  });

  it('flags variables named like server secrets', () => {
    const names = [
      'VITE_OPENAI_API_KEY',
      'VITE_CLERK_SECRET_KEY',
      'VITE_FIREBASE_SERVICE_ACCOUNT',
      'VITE_DB_PASSWORD',
      'VITE_PRIVATE_KEY',
      'VITE_ANTHROPIC_KEY',
    ];
    const found = findSecretLikeVars(Object.fromEntries(names.map((n) => [n, 'x']))).map((f) => f.name);
    expect(found.sort()).toEqual([...names].sort());
  });

  it('flags secret-looking values even under an innocent name', () => {
    expect(findSecretLikeVars({ VITE_API_URL: 'sk_live_abcdef' })).toHaveLength(1);
    expect(findSecretLikeVars({ VITE_THING: 'sk-abcdefghijklmnopqrstuvwx' })).toHaveLength(1);
    expect(findSecretLikeVars({ VITE_THING: '-----BEGIN PRIVATE KEY-----\nabc' })).toHaveLength(1);
    expect(findSecretLikeVars({ VITE_THING: 'ghp_abcdefghijklmnopqrstuvwx' })).toHaveLength(1);
  });

  it('flags a Clerk secret key pasted into the publishable key variable', () => {
    const found = findSecretLikeVars({ VITE_CLERK_PUBLISHABLE_KEY: 'sk_test_abcdef' });
    expect(found).toHaveLength(1);
    expect(found[0].name).toBe('VITE_CLERK_PUBLISHABLE_KEY');
  });

  it('ignores variables that are not exposed to the client anyway', () => {
    expect(findSecretLikeVars({ CLERK_SECRET_KEY: 'sk_live_abcdef', OPENAI_API_KEY: 'sk-abcdefghijklmnopqrstuvwx' })).toEqual([]);
  });

  it('never puts the value in the report', () => {
    const report = formatFindings(findSecretLikeVars({ VITE_OPENAI_API_KEY: 'sk-supersecretvalue1234567890' }));
    expect(report).toContain('VITE_OPENAI_API_KEY');
    expect(report).not.toContain('supersecretvalue');
  });
});
