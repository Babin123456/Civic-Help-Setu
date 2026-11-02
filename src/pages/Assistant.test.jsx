import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Assistant from './Assistant';
import { ToastProvider } from '../context/ToastContext';
import { LanguageProvider } from '../context/LanguageContext';
import { STARTER_PROMPTS } from '../ai/conversationContext';

// No localStorage in node, so the page starts as a fresh chat with only the welcome message
describe('Assistant page, fresh chat', () => {
  const html = renderToStaticMarkup(
    <LanguageProvider>
      <ToastProvider>
        <MemoryRouter>
          <Assistant />
        </MemoryRouter>
      </ToastProvider>
    </LanguageProvider>
  );

  it('shows the empty state with the starter questions', () => {
    expect(html).toContain('What can I help you with?');
    STARTER_PROMPTS.forEach((item) => expect(html).toContain(item.prompt));
  });

  it('has a New conversation button that is disabled until something is asked', () => {
    const btn = html.match(/<button[^>]*>(?:(?!<\/button>).)*New conversation<\/button>/s)[0];
    expect(btn).toContain('disabled');
  });

  it('does not render the reset dialog or the undo notice yet', () => {
    expect(html).not.toContain('role="alertdialog"');
    expect(html).not.toContain('Conversation cleared');
  });

  it('is not busy and shows no loading message', () => {
    expect(html).toContain('aria-busy="false"');
    expect(html).not.toContain('Consulting official civic rules');
  });

  it('renders the civic question suggestion panel with fallback questions', () => {
    expect(html).toContain('Suggested Questions');
    expect(html).toContain('Which documents are usually needed for this service?');
    expect(html).toContain('Where can I find the official application link?');
  });

  it('adapts starter questions when a service context is passed in the URL', () => {
    const serviceHtml = renderToStaticMarkup(
      <LanguageProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={['/assistant?serviceId=birth-certificate']}>
            <Assistant />
          </MemoryRouter>
        </ToastProvider>
      </LanguageProvider>
    );

    expect(serviceHtml).toContain('Context tailored to Birth Certificate');
    expect(serviceHtml).toContain('Which documents are usually needed for Birth Certificate?');
    expect(serviceHtml).toContain('Where can I find the official application link for Birth Certificate?');
  });
});
