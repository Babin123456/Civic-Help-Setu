import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CheckoutTimeline from './CheckoutTimeline.jsx';
it('offers an accessible empty state and guarded exports', () => {
  const html = renderToStaticMarkup(<CheckoutTimeline />);
  expect(html).toContain('Checkout price disclosure timeline');
  expect(html).toContain('Add checkout stage');
  expect(html).toContain('Add at least two checkout stages.');
  expect(html).toContain('disabled');
});
