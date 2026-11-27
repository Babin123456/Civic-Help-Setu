import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import LibraryResourceDirectoryWorkspace from './LibraryResourceDirectoryWorkspace.jsx';
import { resetLocalLibraryDirectoryState } from '../services/libraryResourceDirectoryStorage.js';

describe('LibraryResourceDirectoryWorkspace (#1439)', () => {
  beforeEach(() => {
    resetLocalLibraryDirectoryState();
  });

  it('renders heading, origin badges, accessibility filters, opening-hour exceptions, and moderation form', () => {
    const html = renderToString(<LibraryResourceDirectoryWorkspace />);
    expect(html).toContain('Public Library &amp; Community Learning Resource Directory');
    expect(html).toContain('Official Library Record');
    expect(html).toContain('Moderated Community Update');
    expect(html).toContain('AI / Community Advisory');
    expect(html).toContain('Wheelchair Accessible');
    expect(html).toContain('Braille Collection');
    expect(html).toContain('Screen Reader Workstation');
    expect(html).toContain('Opening-Hour Exceptions');
    expect(html).toContain('Submit for Moderation');
  });
});
