import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ToastProvider } from '../../context/ToastContext';
import WatermarkAttestationModal from './WatermarkAttestationModal';

describe('WatermarkAttestationModal', () => {
  it('returns null when closed or without doc', () => {
    const html1 = renderToString(
      <ToastProvider>
        <WatermarkAttestationModal isOpen={false} doc={{ name: 'Aadhaar' }} onClose={() => {}} />
      </ToastProvider>
    );
    expect(html1).toBe('');

    const html2 = renderToString(
      <ToastProvider>
        <WatermarkAttestationModal isOpen={true} doc={null} onClose={() => {}} />
      </ToastProvider>
    );
    expect(html2).toBe('');
  });

  it('renders modal header, presets, and live watermark preview', () => {
    const doc = {
      id: 'doc-pan',
      name: 'PAN Card',
      type: 'Identity',
    };
    const html = renderToString(
      <ToastProvider>
        <WatermarkAttestationModal
          isOpen={true}
          doc={doc}
          defaultCitizenName="Suman Patel"
          onClose={() => {}}
        />
      </ToastProvider>
    );

    expect(html).toContain('Watermark &amp; Purpose Attestation');
    expect(html).toContain('PAN Card');
    expect(html).toContain('Passport Seva Application');
    expect(html).toContain('UIDAI &amp; MeitY advisory');
    expect(html).toContain('Print / Export Document');
    expect(html).toContain('Copy Attestation');
  });
});
