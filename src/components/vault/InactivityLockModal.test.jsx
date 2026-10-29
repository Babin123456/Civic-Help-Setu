import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import InactivityLockModal from './InactivityLockModal';

describe('InactivityLockModal Component', () => {
  it('renders nothing when closed', () => {
    const html = renderToStaticMarkup(
      <InactivityLockModal isOpen={false} secondsRemaining={30} />
    );
    expect(html).toBe('');
  });

  it('renders countdown and privacy warning when open', () => {
    const html = renderToStaticMarkup(
      <InactivityLockModal isOpen={true} secondsRemaining={18} />
    );

    expect(html).toContain('Inactivity Privacy Alert');
    expect(html).toContain('Auto-locking in 18s');
    expect(html).toContain('I&#x27;m Still Here (Extend)');
    expect(html).toContain('Lock Now');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
  });
});
