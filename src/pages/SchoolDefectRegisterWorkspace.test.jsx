import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import SchoolDefectRegisterWorkspace from './SchoolDefectRegisterWorkspace.jsx';
import { resetLocalSchoolDefectState } from '../services/schoolDefectRegisterStorage.js';

describe('SchoolDefectRegisterWorkspace (#1437)', () => {
  beforeEach(() => {
    resetLocalSchoolDefectState();
  });

  it('renders heading, origin badges, school/ward aggregates, routing table, status history, and child privacy controls', () => {
    const html = renderToString(<SchoolDefectRegisterWorkspace />);
    expect(html).toContain('Public School Infrastructure Defect &amp; Follow-Up Register');
    expect(html).toContain('Parent / Community Report');
    expect(html).toContain('Official School / Dept Record');
    expect(html).toContain('AI / Community Advisory');
    expect(html).toContain('School &amp; Ward Public Progress Summary');
    expect(html).toContain('Status History');
    expect(html).toContain('Contains Student Faces or Minors');
  });
});
