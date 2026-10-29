import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  classifyRequirement,
  getDocumentRequirements,
  toRequirementMap,
  summarizeRequirementProgress,
} from './requirementTypes';
import Checklist from '../components/Checklist';
import ServiceGuide from '../components/services/ServiceGuide';
import { MOCK_SERVICES } from '../data/services';

const service = {
  id: 's',
  name: 'S',
  documents: ['ID card', 'Hospital letter', 'Spare photo', 'Mystery form'],
  documentRequirements: {
    'ID card': { type: 'required', source: { name: 'Gov portal', url: 'https://example.gov.in' } },
    'Hospital letter': { type: 'conditional', condition: 'Born in hospital' },
    'Spare photo': { type: 'optional' },
  },
};

describe('classifyRequirement', () => {
  it('falls back to unverified without data', () => {
    expect(classifyRequirement('x', undefined).type).toBe('unverified');
    expect(classifyRequirement('x', {}).type).toBe('unverified');
    expect(classifyRequirement('x', { x: 'required' }).type).toBe('unverified');
  });
  it('rejects unknown types and conditional items with no condition', () => {
    expect(classifyRequirement('x', { x: { type: 'mandatory' } }).type).toBe('unverified');
    expect(classifyRequirement('x', { x: { type: 'conditional' } }).type).toBe('unverified');
    expect(classifyRequirement('x', { x: { type: 'conditional', condition: '  ' } }).type).toBe('unverified');
  });
  it('keeps the source only for required items', () => {
    const src = { name: 'A', url: 'https://a.gov.in' };
    expect(classifyRequirement('x', { x: { type: 'required', source: src } }).source).toEqual(src);
    expect(classifyRequirement('x', { x: { type: 'optional', source: src } }).source).toBeNull();
  });
});

describe('getDocumentRequirements', () => {
  it('classifies a mixed list and defaults the rest to unverified', () => {
    expect(getDocumentRequirements(service).map((r) => r.type)).toEqual([
      'required', 'conditional', 'optional', 'unverified',
    ]);
  });
  it('handles services without documents', () => {
    expect(getDocumentRequirements({})).toEqual([]);
    expect(getDocumentRequirements(null)).toEqual([]);
  });
  it('gives every existing catalogue service a safe type for each document', () => {
    for (const svc of MOCK_SERVICES) {
      const reqs = getDocumentRequirements(svc);
      expect(reqs).toHaveLength((svc.documents || []).length);
      reqs.forEach((r) => expect(['required', 'conditional', 'optional', 'unverified']).toContain(r.type));
    }
  });
});

describe('summarizeRequirementProgress', () => {
  const items = service.documents;
  const map = toRequirementMap(service);
  it('counts only official requirements as mandatory', () => {
    expect(summarizeRequirementProgress(items, [], map)).toEqual({
      mandatoryTotal: 1, mandatoryDone: 0, conditionalCount: 1, optionalCount: 1, unverifiedCount: 1,
    });
  });
  it('ticking an optional or unverified item does not change mandatory progress', () => {
    const s = summarizeRequirementProgress(items, ['Spare photo', 'Mystery form'], map);
    expect(s.mandatoryDone).toBe(0);
    expect(summarizeRequirementProgress(items, ['ID card'], map).mandatoryDone).toBe(1);
  });
  it('treats everything as unverified when no data exists', () => {
    expect(summarizeRequirementProgress(['a', 'b'], ['a'], {}).mandatoryTotal).toBe(0);
  });
});

describe('markup', () => {
  it('Checklist shows each type, the condition, the source and mandatory-only progress', () => {
    const html = renderToStaticMarkup(
      <Checklist items={service.documents} requirements={toRequirementMap(service)} label="Docs" />
    );
    expect(html).toContain('0 of 1 official requirements completed');
    expect(html).toContain('Official requirement');
    expect(html).toContain('Conditional requirement');
    expect(html).toContain('Applies when: Born in hospital');
    expect(html).toContain('Optional suggestion');
    expect(html).toContain('Not verified');
    expect(html).toContain('href="https://example.gov.in/"');
  });
  it('ServiceGuide labels documents and does not guess for unclassified ones', () => {
    const html = renderToStaticMarkup(
      <ServiceGuide service={service} onToggleFocusMode={() => {}} />
    );
    expect(html).toContain('Conditional requirement');
    expect(html).toContain('Not verified');
    const plain = renderToStaticMarkup(
      <ServiceGuide service={{ id: 'p', name: 'P', documents: ['Only doc'] }} onToggleFocusMode={() => {}} />
    );
    expect(plain).toContain('Not verified');
    expect(plain).not.toContain('Official requirement</span>');
  });
});
