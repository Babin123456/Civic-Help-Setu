import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import SafeAuthErrorBanner from './SafeAuthErrorBanner';

describe('SafeAuthErrorBanner Component (#209)', () => {
  const mockError = {
    name: 'ClerkAPIResponseError',
    code: 'form_identifier_exists',
    message: 'Raw server exception with token sk_live_9988',
  };

  it('renders safe sanitized error message without leaking raw provider exception', () => {
    const html = renderToStaticMarkup(
      <SafeAuthErrorBanner error={mockError} />
    );

    expect(html).toContain('Account Already Exists');
    expect(html).toContain('An account is already registered with this email address.');
    expect(html).toContain('Try signing in with your existing account instead.');
    expect(html).not.toContain('sk_live_9988');
    expect(html).not.toContain('ClerkAPIResponseError');
  });

  it('does not render when error is null or undefined', () => {
    const html = renderToStaticMarkup(<SafeAuthErrorBanner error={null} />);
    expect(html).toBe('');
  });
});
