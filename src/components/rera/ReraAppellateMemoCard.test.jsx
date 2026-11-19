import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ReraAppellateMemoCard from './ReraAppellateMemoCard.jsx';

describe('ReraAppellateMemoCard Component (#875)', () => {
  it('renders appellate workspace with Section 43(5) pre-deposit callout', () => {
    const html = renderToStaticMarkup(<ReraAppellateMemoCard />);

    expect(html).toContain('RERA Appellate Tribunal (REAT)');
    expect(html).toContain('Section 43(5) &amp; 44 Workspace');
    expect(html).toContain('Newtech Promoters, 2021');
    expect(html).toContain('Builder Filed Appeal Against Me');
    expect(html).toContain('I Want to Appeal Authority Order');
    expect(html).toContain('Pre-Deposit Requirement');
    expect(html).toContain('100%');
  });

  it('renders save button when onSaveAppeal is provided', () => {
    const html = renderToStaticMarkup(<ReraAppellateMemoCard onSaveAppeal={() => {}} />);

    expect(html).toContain('Save Document');
    expect(html).toContain('Copy Document');
    expect(html).toContain('Download Slip');
  });
});
