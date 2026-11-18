import { describe, it, expect, vi, afterEach } from 'vitest';
import CgrfPetitionDrafterCard from './electricity/CgrfPetitionDrafterCard.jsx';
import RtePetitionDrafter from './rte/RtePetitionDrafter.jsx';
import TvcGrievanceDrafterCard from './vendor/TvcGrievanceDrafterCard.jsx';

// There is no DOM in this test setup, so the components are called directly with a stand-in
// useState: the first state slot (the consumer / child / vendor name) starts with PAYLOAD, every
// other slot keeps its default. Then the Print button's onClick is run against a fake window that
// records document.write calls and the title / body it is given.
const PAYLOAD = '</title><img src=x onerror=alert(document.domain)> & "Co"';
const TITLE_PAYLOAD = '</title><img src=x onerror=alert(document.domain)>';

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal();
  let slot = 0;
  return {
    ...actual,
    default: actual,
    useState: (initial) => {
      const value = slot++ === 0 ? globalThis.__PRINT_TEST_NAME__ : initial;
      return [typeof value === 'function' ? value() : value, () => {}];
    },
    useMemo: (factory) => factory(),
    __resetSlots: () => {
      slot = 0;
    },
  };
});

const React = await import('react');

const findPrintButton = (node) => {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findPrintButton(child);
      if (found) return found;
    }
    return null;
  }
  if (node.type === 'button' && typeof node.props?.onClick === 'function') {
    const text = JSON.stringify(node.props.children);
    if (/Print/.test(text)) return node;
  }
  return findPrintButton(node.props?.children);
};

const clickPrint = (Component, props = {}) => {
  globalThis.__PRINT_TEST_NAME__ = PAYLOAD;
  React.__resetSlots();
  const tree = Component(props);
  const button = findPrintButton(tree);
  expect(button, 'print button found').toBeTruthy();
  const writes = [];
  const fakeWindow = {
    document: {
      title: '',
      body: { style: { cssText: '' }, textContent: '' },
      write: (html) => writes.push(html),
      close: () => {},
    },
    focus: () => {},
    print: vi.fn(),
  };
  vi.stubGlobal('window', { open: () => fakeWindow });
  button.props.onClick();
  return { writes, doc: fakeWindow.document, print: fakeWindow.print };
};

afterEach(() => {
  vi.unstubAllGlobals();
  delete globalThis.__PRINT_TEST_NAME__;
});

describe.each([
  ['CgrfPetitionDrafterCard (consumerName)', CgrfPetitionDrafterCard, 'CGRF Section 42(5) Petition'],
  ['RtePetitionDrafter (childName)', RtePetitionDrafter, 'RTE Section 32 Statutory Complaint'],
  ['TvcGrievanceDrafterCard (vendorName)', TvcGrievanceDrafterCard, 'Section 20 Street Vendor Statutory Appeal'],
])('print window of %s', (_label, Component, titlePrefix) => {
  it('does not write the typed name into the new window as markup', () => {
    const { writes } = clickPrint(Component);
    expect(writes).toEqual([]);
  });

  it('shows the typed name as the title text and the petition as body text', () => {
    const { doc, print } = clickPrint(Component);
    expect(doc.title).toBe(`${titlePrefix} - ${PAYLOAD}`);
    expect(doc.title).toContain(TITLE_PAYLOAD);
    expect(doc.body.textContent).toContain(PAYLOAD);
    expect(doc.body.style.cssText).toContain('white-space: pre-wrap');
    expect(print).toHaveBeenCalledTimes(1);
  });
});
