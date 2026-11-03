import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import MultilingualVoiceNavigationModal from './MultilingualVoiceNavigationModal';

describe('MultilingualVoiceNavigationModal', () => {
  it('does not render when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <MultilingualVoiceNavigationModal isOpen={false} onClose={() => {}} />
      </MemoryRouter>
    );
    expect(html).toBe('');
  });

  it('renders modal dialog with language dropdown and microphone button when open', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <MultilingualVoiceNavigationModal isOpen={true} onClose={() => {}} />
      </MemoryRouter>
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('Multilingual Voice Navigation &amp; Service Discovery');
    expect(html).toContain('Select Spoken Language:');
    expect(html).toContain('हिन्दी (Hindi)');
    expect(html).toContain('English (India)');
    expect(html).toContain('Start voice search');
    expect(html).toContain('Spoken Transcript');
  });
});
