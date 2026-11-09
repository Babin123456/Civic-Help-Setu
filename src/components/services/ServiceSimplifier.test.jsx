import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ServiceSimplifier, { SimplifierPanel } from './ServiceSimplifier.jsx';
import { SIMPLIFIER_LABEL } from '../../ai/serviceSimplifier';

const noop = () => {};
const ready = (extra = {}) => ({
  status: 'ready',
  label: SIMPLIFIER_LABEL,
  purpose: 'Get a certificate to prove your age.',
  audience: 'Any adult resident.',
  nextStep: 'Visit the office.',
  missing: [],
  terms: [],
  source: { name: 'Sample portal', url: 'https://example.gov.in' },
  basedOn: ['shortDescription'],
  ...extra,
});

const panel = (props) =>
  renderToStaticMarkup(
    <SimplifierPanel officialText="Obtain a certificate in order to prove your age." onSimplify={noop} onShowView={noop} {...props} />,
  );

describe('SimplifierPanel (#382)', () => {
  it('starts with a button and shows no AI text yet', () => {
    const html = panel({ phase: 'idle' });
    expect(html).toContain('Simplify this service');
    expect(html).toContain('<button');
    expect(html).not.toContain(SIMPLIFIER_LABEL);
  });

  it('shows a loading state that is announced and marked busy', () => {
    const html = panel({ phase: 'loading' });
    expect(html).toContain('Simplifying this guide');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
  });

  it('labels the summary as an AI-generated explanation and shows all three parts', () => {
    const html = panel({ phase: 'done', result: ready(), view: 'simple' });
    expect(html).toContain(SIMPLIFIER_LABEL);
    expect(html).toContain('What it is');
    expect(html).toContain('Get a certificate to prove your age.');
    expect(html).toContain('Who it is for');
    expect(html).toContain('Any adult resident.');
    expect(html).toContain('What to do first');
    expect(html).toContain('Visit the office.');
    expect(html).toContain('It is not official and may leave details out.');
    expect(html).toContain('Check the official source before you apply.');
  });

  it('lets the reader switch between the simplified and the original text', () => {
    const simple = panel({ phase: 'done', result: ready(), view: 'simple' });
    expect(simple).toMatch(/aria-pressed="true"[^>]*>Simplified</);
    expect(simple).toMatch(/aria-pressed="false"[^>]*>Original</);
    const original = panel({ phase: 'done', result: ready(), view: 'original' });
    expect(original).toMatch(/aria-pressed="false"[^>]*>Simplified</);
    expect(original).toMatch(/aria-pressed="true"[^>]*>Original</);
    expect(original).toContain('Official description');
    expect(original).toContain('Obtain a certificate in order to prove your age.');
    expect(original).toContain('unchanged');
    expect(original).not.toContain(SIMPLIFIER_LABEL);
  });

  it('says so for a part the guide does not have, instead of filling it in', () => {
    const html = panel({ phase: 'done', result: ready({ audience: null, missing: ['audience'] }) });
    expect(html).toContain('Who it is for');
    expect(html).toContain('This guide does not say.');
  });

  it('lists jargon in plain terms when there is some', () => {
    const html = panel({ phase: 'done', result: ready({ terms: [{ id: 'domicile', term: 'Domicile', meaning: 'Proof of where you live.' }] }) });
    expect(html).toContain('Words in this guide, in plain terms');
    expect(html).toContain('Domicile');
    expect(html).toContain('Proof of where you live.');
  });

  it('links to the official source in a safe way, and drops an unsafe link', () => {
    const safe = panel({ phase: 'done', result: ready() });
    expect(safe).toContain('href="https://example.gov.in/"');
    expect(safe).toContain('rel="noopener noreferrer"');
    const unsafe = panel({ phase: 'done', result: ready({ source: { name: 'Bad', url: 'javascript:alert(1)' } }) });
    expect(unsafe).not.toContain('javascript:');
    expect(unsafe).not.toContain('Official source:');
  });

  it('shows the explanation when the guide has no description, with no summary parts', () => {
    const html = panel({ phase: 'done', result: { status: 'unavailable', message: 'This guide has no description to simplify, so no summary was made and nothing has been guessed.' } });
    expect(html).toContain('no description to simplify');
    expect(html).not.toContain('What it is');
    expect(html).not.toContain(SIMPLIFIER_LABEL);
  });

  it('shows an error that keeps the official text in place and offers to try again', () => {
    const html = panel({ phase: 'error' });
    expect(html).toContain('role="alert"');
    expect(html).toContain('could not simplify');
    expect(html).toContain('has not changed');
    expect(html).toContain('Try again');
  });

  it('writes text from the guide as text, never as markup', () => {
    const evil = '<img src=x onerror=alert(1)>';
    const html = panel({ phase: 'done', result: ready({ purpose: evil, audience: evil, nextStep: evil, terms: [{ id: 't', term: evil, meaning: evil }], source: { name: evil, url: 'https://example.gov.in' } }), officialText: evil });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    const original = panel({ phase: 'done', result: ready(), view: 'original', officialText: evil });
    expect(original).not.toContain('<img');
  });
});

describe('ServiceSimplifier', () => {
  it('renders the button and nothing else before it is used', () => {
    const html = renderToStaticMarkup(<ServiceSimplifier service={{ id: 'x', shortDescription: 'Obtain a certificate.' }} />);
    expect(html).toContain('Simplify this service');
    expect(html).not.toContain(SIMPLIFIER_LABEL);
  });
});
