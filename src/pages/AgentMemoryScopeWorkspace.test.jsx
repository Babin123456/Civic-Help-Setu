import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import AgentMemoryScopeWorkspace from './AgentMemoryScopeWorkspace.jsx';
import { resetLocalMemoryScopeState } from '../services/agentMemory/memoryScopeStorage.js';

describe('AgentMemoryScopeWorkspace (#1447)', () => {
  beforeEach(() => {
    resetLocalMemoryScopeState();
  });

  it('renders user-visible context controls, origin badges, and isolated partition table', () => {
    const html = renderToString(<AgentMemoryScopeWorkspace />);
    expect(html).toContain('Civic Agent Memory Scope &amp; Per-Case Context Isolation');
    expect(html).toContain('User-Visible Context Controls');
    expect(html).toContain('No-Memory Mode: OFF');
    expect(html).toContain('Citizen-Entered Fact');
    expect(html).toContain('Official Record');
    expect(html).toContain('AI / Community Suggestion');
    expect(html).toContain('Delete Case Partition');
  });
});
