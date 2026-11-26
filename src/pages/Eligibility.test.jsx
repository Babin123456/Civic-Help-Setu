import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import Eligibility from './Eligibility.jsx';
import { ToastProvider } from '../context/ToastContext.jsx';

describe('Eligibility Page Vertical Slice Integration', () => {
  it('renders the Eligibility page with the Simulation & Counterfactuals tab', () => {
    const router = createMemoryRouter([
      {
        path: '/',
        element: (
          <ToastProvider>
            <Eligibility />
          </ToastProvider>
        ),
      },
    ]);

    const html = renderToStaticMarkup(<RouterProvider router={router} />);

    expect(html).toContain('Citizen Entitlement Guide');
    expect(html).toContain('Interactive Eligibility Checker');
    expect(html).toContain('Simulation &amp; Counterfactuals');
    expect(html).toContain('Scheme Matrix');
    expect(html).toContain('Run Eligibility Wizard');
  });
});
