import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ObcNonCreamyLayerGuide from './ObcNonCreamyLayerGuide';

describe('ObcNonCreamyLayerGuide Component (#505)', () => {
  it('renders scannable OBC Non-Creamy Layer guide with central and state list toggles', () => {
    const html = renderToStaticMarkup(<ObcNonCreamyLayerGuide />);

    expect(html).toContain('OBC Non-Creamy Layer (NCL) Certificate Guide');
    expect(html).toContain('Central Government (NCBC)');
    expect(html).toContain('State Government (BC/MBC)');
    expect(html).toContain('OBC Caste Certificate vs. NCL Certificate');
    expect(html).toContain('Central vs. State List Warnings');
  });
});
