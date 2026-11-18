import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AddressChangeCorrectionQueue from './AddressChangeCorrectionQueue';
import { ToastProvider } from '../../context/ToastContext';

describe('AddressChangeCorrectionQueue (#725)', () => {
  it('renders seed community corrections and displays verification seals', () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <AddressChangeCorrectionQueue />
      </ToastProvider>
    );

    expect(html).toContain('Moving-Home Address Change Corrections Queue');
    expect(html).toContain('Driving Licence Change of Address');
    expect(html).toContain('AC-CORR-1A90-44F2');
    expect(html).toContain('Approve');
    expect(html).toContain('Reject');
    expect(html).toContain('Verify Official Source URL');
  });
});

