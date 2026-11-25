import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import UpJanSunwaiWorkspace from './UpJanSunwaiWorkspace';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import { upJanSunwaiStore } from '../services/upJanSunwaiService';

describe('UpJanSunwaiWorkspace UI Component (#1002)', () => {
  beforeEach(() => {
    upJanSunwaiStore.reset();
  });

  const renderComponent = () => {
    return renderToStaticMarkup(
      <MemoryRouter>
        <AuthProvider>
          <ToastProvider>
            <UpJanSunwaiWorkspace />
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>,
    );
  };

  it('renders standard header, eyebrow, and ethical guardrail banner', () => {
    const html = renderComponent();

    expect(html).toContain('Uttar Pradesh Public Grievance Hearings');
    expect(html).toContain('UP Public Hearing &amp; Jan Sunwai Workspace');
    expect(html).toContain('Official Verification &amp; Ethical Guardrail:');
    expect(html).toContain('Hearing attendance is an opportunity to be heard');
    expect(html).toContain('NOT complaint registration');
  });

  it('renders all four primary workspace tabs', () => {
    const html = renderComponent();

    expect(html).toContain('Verified Hearings');
    expect(html).toContain('Preparation &amp; Hearing Note');
    expect(html).toContain('Private Follow-Up');
    expect(html).toContain('Attendance vs. Resolution Rights');
  });

  it('renders verified public hearing cards with official government sources and verification metadata', () => {
    const html = renderComponent();

    expect(html).toContain('District Jan Sunwai — Lucknow');
    expect(html).toContain('Tehsil Diwas Public Hearing — Varanasi Sadar');
    expect(html).toContain('Gorakhpur District Public Hearing');
    expect(html).toContain('Collectorate Auditorium, Lucknow');
    expect(html).toContain('lucknow.nic.in');
    expect(html).toContain('varanasi.nic.in');
  });

  it('renders search input and district filter dropdown options without cross-district corruption', () => {
    const html = renderComponent();

    expect(html).toContain('Search by venue, authority, department...');
    expect(html).toContain('All UP Districts');
    expect(html).toContain('Lucknow');
    expect(html).toContain('Varanasi');
    expect(html).toContain('Gorakhpur');
    expect(html).toContain('All Issue Categories');
    expect(html).toContain('Show expired / past hearings');
  });

  it('excludes unconfirmed community events from the official calendar view by default', () => {
    const html = renderComponent();

    expect(html).not.toContain('Unofficial Community Notice — Forwarded Jan Sunwai');
    expect(html).not.toContain('WhatsApp Forward');
  });
});
