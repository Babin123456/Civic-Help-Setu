import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from 'vitest';

// Import agent registry from supervisor
import SupervisorAgentRegistry from '../../src/supervisor/agentRegistry.js';
import { createAgentRegistryEntry } from '../../src/supervisor/agentRegistry.js';

describe('supervisor agent registry', () => {
  let registry;
  let entry1;
  let entry2;

  beforeEach(() => {
    registry = new SupervisorAgentRegistry();
    entry1 = createAgentRegistryEntry({
      agentId: 'agent-pwd-delhi',
      department: 'Public Works',
      jurisdictionLevel: 'state',
      agentName: 'PWD Delhi Agent',
      contactEmail: 'pwd-delhi@example.com',
      capabilities: ['investigate', 'evidence-review'],
      permittedTools: ['document-upload', 'portal-query'],
      maxConcurrentTasks: 3,
      slaDays: 7,
      authorizedJurisdictions: ['Delhi', 'NCR'],
    });
    entry2 = createAgentRegistryEntry({
      agentId: 'agent-water-mum',
      department: 'Municipal Sanitation',
      jurisdictionLevel: 'local',
      agentName: 'Mumbai Water Agent',
      contactEmail: 'mumbai-water@example.com',
      capabilities: ['investigate', 'escalate'],
      permittedTools: ['document-upload', 'email-notify'],
      maxConcurrentTasks: 5,
      slaDays: 3,
      authorizedJurisdictions: ['Mumbai'],
    });
  });

  describe('SupervisorAgentRegistry class', () => {
    it('registers an agent and makes it available by department', () => {
      registry.register(entry1);
      const agents = registry.getAgentsByDepartment('Public Works');
      expect(agents).toHaveLength(1);
      expect(agents[0].agentId).toBe('agent-pwd-delhi');
    });

    it('indexes agent by agentId for quick lookup', () => {
      registry.register(entry1);
      expect(registry._byAgentId.get('agent-pwd-delhi')).toBeDefined();
      expect(registry._byAgentId.get('agent-pwd-delhi').agentName).toBe(
        'PWD Delhi Agent'
      );
    });

    it('indexes by (department, jurisdictionLevel) key', () => {
      registry.register(entry1);
      const byJur = registry.getAgentsByJurisdiction('Public Works', 'state');
      expect(byJur).toHaveLength(1);
      expect(byJur[0].agentId).toBe('agent-pwd-delhi');
    });

    it('unregisters an agent', () => {
      registry.register(entry1);
      const result = registry.unregister('agent-pwd-delhi');
      expect(result).toBe(true);
      expect(registry._byAgentId.get('agent-pwd-delhi')).toBeUndefined();
      const agents = registry.getAgentsByDepartment('Public Works');
      expect(agents).toHaveLength(0);
    });

    it('unregisters non-agent returns false', () => {
      registry.register(entry1);
      const result = registry.unregister('non-existent-agent');
      expect(result).toBe(false);
    });

    it('gets agents by department returns empty array for unknown department', () => {
      const agents = registry.getAgentsByDepartment('NonExistentDept');
      expect(agents).toHaveLength(0);
    });

    it('finds agents for evidence', () => {
      registry.register(entry1);
      // Valid evidence for Delhi
      const evidence = {
        sourceType: 'statutory-portal',
        sourceId: 'Delhi',
        sourceUrl: 'https://pgportal.gov.in',
        citedBy: 'supervisor-service',
        citedAt: new Date().toISOString(),
        provenance: 'official government portal',
      };
      const agents = registry.findAgentsForEvidence(evidence, 'Public Works');
      expect(agents).toHaveLength(1);
      expect(agents[0].agentId).toBe('agent-pwd-delhi');
    });

    it('returns no agents for invalid evidence', () => {
      registry.register(entry1);
      const badEvidence = {
        sourceType: 'invalid',
        sourceId: '',
        sourceUrl: '',
        citedBy: '',
        citedAt: '',
        provenance: '',
      };
      const agents = registry.findAgentsForEvidence(badEvidence, 'Public Works');
      expect(agents).toHaveLength(0);
    });

    it('gets departments list', () => {
      registry.register(entry1);
      registry.register(entry2);
      const departments = registry.getDepartments();
      expect(departments).toContain('Public Works');
      expect(departments).toContain('Municipal Sanitation');
    });

    it('gets agent count', () => {
      registry.register(entry1);
      registry.register(entry2);
      expect(registry.getAgentCount()).toBe(2);
    });

    it('checks agent availability', () => {
      registry.register(entry1); // maxConcurrentTasks: 3
      expect(registry.isAgentAvailable('agent-pwd-delhi', 0)).toBe(true);
      expect(registry.isAgentAvailable('agent-pwd-delhi', 3)).toBe(false);
      expect(registry.isAgentAvailable('agent-pwd-delhi', 5)).toBe(false);
    });

    it('gets agents sorted by SLA', () => {
      registry.register(entry1); // slaDays: 7
      registry.register(entry2); // slaDays: 3
      const sorted = registry.getAgentsSortedBySla('Municipal Sanitation', 'local');
      // Only entry2 is for Municipal Sanitation/local
      expect(sorted).toHaveLength(1);
      expect(sorted[0].slaDays).toBe(3);
    });
  });

  describe('createAgentRegistryEntry', () => {
    it('creates a valid entry with all fields', () => {
      const entry = createAgentRegistryEntry({
        agentId: 'test-agent',
        department: 'Test Dept',
        jurisdictionLevel: 'local',
        agentName: 'Test Agent',
        contactEmail: 'test@example.com',
        capabilities: ['investigate'],
        permittedTools: ['tool-a'],
      });
      expect(entry.agentId).toBe('test-agent');
      expect(entry.department).toBe('Test Dept');
      expect(entry.jurisdictionLevel).toBe('local');
      expect(entry.agentName).toBe('Test Agent');
      expect(entry.contactEmail).toBe('test@example.com');
      expect(entry.capabilities).toEqual(['investigate']);
      expect(entry.permittedTools).toEqual(['tool-a']);
      expect(entry.maxConcurrentTasks).toBe(5); // default
      expect(entry.slaDays).toBe(7); // default
    });

    it('validates agentId is non-empty string', () => {
      expect(() =>
        createAgentRegistryEntry({
          agentId: '',
          department: 'Test',
          jurisdictionLevel: 'local',
          agentName: 'Test',
          contactEmail: 'test@example.com',
          capabilities: ['investigate'],
          permittedTools: ['tool'],
        })
      ).toThrow('agentId must be a non-empty string');
    });

    it('validates department is non-empty string', () => {
      expect(() =>
        createAgentRegistryEntry({
          agentId: 'test',
          department: '',
          jurisdictionLevel: 'local',
          agentName: 'Test',
          contactEmail: 'test@example.com',
          capabilities: ['investigate'],
          permittedTools: ['tool'],
        })
      ).toThrow('department must be a non-empty string');
    });

    it('validates jurisdictionLevel', () => {
      expect(() =>
        createAgentRegistryEntry({
          agentId: 'test',
          department: 'Test',
          jurisdictionLevel: 'invalid',
          agentName: 'Test',
          contactEmail: 'test@example.com',
          capabilities: ['investigate'],
          permittedTools: ['tool'],
        })
      ).toThrow(
        "jurisdictionLevel must be one of: 'local', 'state', 'national'"
      );
    });

    it('validates contactEmail format', () => {
      expect(() =>
        createAgentRegistryEntry({
          agentId: 'test',
          department: 'Test',
          jurisdictionLevel: 'local',
          agentName: 'Test',
          contactEmail: 'not-an-email',
          capabilities: ['investigate'],
          permittedTools: ['tool'],
        })
      ).toThrow('contactEmail must be a valid email address');
    });

    it('validates capabilities is non-empty array', () => {
      expect(() =>
        createAgentRegistryEntry({
          agentId: 'test',
          department: 'Test',
          jurisdictionLevel: 'local',
          agentName: 'Test',
          contactEmail: 'test@example.com',
          capabilities: [],
          permittedTools: ['tool'],
        })
      ).toThrow('capabilities must be a non-empty array');
    });

    it('validates permittedTools is non-empty array', () => {
      expect(() =>
        createAgentRegistryEntry({
          agentId: 'test',
          department: 'Test',
          jurisdictionLevel: 'local',
          agentName: 'Test',
          contactEmail: 'test@example.com',
          capabilities: ['investigate'],
          permittedTools: [],
        })
      ).toThrow('permittedTools must be a non-empty array');
    });

    it('validates maxConcurrentTasks is positive', () => {
      expect(() =>
        createAgentRegistryEntry({
          agentId: 'test',
          department: 'Test',
          jurisdictionLevel: 'local',
          agentName: 'Test',
          contactEmail: 'test@example.com',
          capabilities: ['investigate'],
          permittedTools: ['tool'],
          maxConcurrentTasks: 0,
        })
      ).toThrow('maxConcurrentTasks must be a positive number');
    });

    it('validates slaDays is positive', () => {
      expect(() =>
        createAgentRegistryEntry({
          agentId: 'test',
          department: 'Test',
          jurisdictionLevel: 'local',
          agentName: 'Test',
          contactEmail: 'test@example.com',
          capabilities: ['investigate'],
          permittedTools: ['tool'],
          slaDays: 0,
        })
      ).toThrow('slaDays must be a positive number');
    });

    it('validates authorizedJurisdictions', () => {
      expect(() =>
        createAgentRegistryEntry({
          agentId: 'test',
          department: 'Test',
          jurisdictionLevel: 'local',
          agentName: 'Test',
          contactEmail: 'test@example.com',
          capabilities: ['investigate'],
          permittedTools: ['tool'],
          authorizedJurisdictions: ['', 'Valid'],
        })
      ).toThrow('authorizedJurisdictions must be an array of non-empty strings');
    });
  });
});