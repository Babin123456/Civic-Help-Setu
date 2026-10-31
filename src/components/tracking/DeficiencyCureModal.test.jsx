import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ToastProvider } from '../../context/ToastContext';
import DeficiencyCureModal from './DeficiencyCureModal';

describe('DeficiencyCureModal', () => {
  it('returns null when closed or without application', () => {
    const html1 = renderToString(
      <ToastProvider>
        <DeficiencyCureModal isOpen={false} application={{ id: 'APP-1' }} onClose={() => {}} />
      </ToastProvider>
    );
    expect(html1).toBe('');

    const html2 = renderToString(
      <ToastProvider>
        <DeficiencyCureModal isOpen={true} application={null} onClose={() => {}} />
      </ToastProvider>
    );
    expect(html2).toBe('');
  });

  it('renders objection modal with statutory timeline and compliance petition preview', () => {
    const app = {
      id: 'APP-999',
      serviceName: 'Caste Certificate',
      actionRequiredDate: '2026-10-25',
    };
    const html = renderToString(
      <ToastProvider>
        <DeficiencyCureModal
          isOpen={true}
          application={app}
          citizenName="Pooja Sharma"
          onClose={() => {}}
        />
      </ToastProvider>
    );

    expect(html).toContain('Statutory Deficiency Cure');
    expect(html).toContain('Caste Certificate');
    expect(html).toContain('APP-999');
    expect(html).toContain('Statutory Cure Window');
    expect(html).toContain('Illegible / Blurry Document Upload');
    expect(html).toContain('STATUTORY COMPLIANCE &amp; DEFICIENCY RECTIFICATION NOTICE');
    expect(html).toContain('Print Compliance Letter');
    expect(html).toContain('Copy Notice');
  });
});
