import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  AgentSandboxLoading,
  AgentSandboxEmpty,
  AgentSandboxError,
  AgentSandboxBlocked,
  AgentSandboxPermissionDenied
} from './AgentSandboxStates';
import { ToolSelector } from './ToolSelector';
import { SandboxResults } from './SandboxResults';
import { listPolicies, listTools, listDocuments } from '../../data/civicAgentSandboxData.js';

const policies = listPolicies();
const tools = listTools();
const documents = listDocuments();
const strict = policies.find((p) => p.id === 'policy-strict-default') || policies[0];
const pdf = tools.find((t) => t.id === 'tool-pdf-text-extractor') || tools[0];

const fakeRun = {
  runId: 'run-1',
  toolId: 'tool-pdf-text-extractor',
  policyId: 'policy-strict-default',
  status: 'completed',
  toolName: 'Civic PDF Text Extractor',
  policyName: 'Strict Default',
  output: {
    result: 'Processed text',
    illustrative: true,
    noCitizenData: true,
    resourcesUsed: { cpuMs: 1000, memoryMB: 30, timeMs: 2000 },
    networkUsed: false
  },
  resourcesUsed: { cpuMs: 1000, memoryMB: 30, timeMs: 2000 },
  networkUsed: false,
  humanApproved: false,
  provenance: 'test v1',
  policyVersion: '1.0.0',
  schemaVersion: 'civic-agent-sandbox-v1',
  dataVersion: '2026-11-21',
  reviewedAt: '2026-11-21',
  isStale: false,
  disclaimer: 'Sandbox output is illustrative and untrusted.',
  untrusted: true,
  requiresHumanReview: true
};

const fakeResult = { run: fakeRun, scan: { pre: [], post: [], blocked: false, redacted: false } };

describe('AgentSandbox states', () => {
  it('renders loading state', () => {
    const html = renderToStaticMarkup(<AgentSandboxLoading />);
    expect(html).toContain('Preparing sandbox');
  });

  it('renders empty state', () => {
    const html = renderToStaticMarkup(<AgentSandboxEmpty />);
    expect(html).toContain('No sandbox run yet');
  });

  it('renders error state with message and retry', () => {
    const html = renderToStaticMarkup(<AgentSandboxError message="Boom" onRetry={() => {}} />);
    expect(html).toContain('Sandbox error');
    expect(html).toContain('Boom');
    expect(html).toContain('Retry');
  });

  it('renders blocked state with threats', () => {
    const html = renderToStaticMarkup(
      <AgentSandboxBlocked threats={[{ threatName: 'Embedded Script', severity: 'critical', description: 'blocked' }]} onRetry={() => {}} />
    );
    expect(html).toContain('Run blocked by sandbox policy');
    expect(html).toContain('Embedded Script');
  });

  it('renders permission denied state', () => {
    const html = renderToStaticMarkup(<AgentSandboxPermissionDenied />);
    expect(html).toContain('Authentication required');
  });
});

describe('ToolSelector static markup', () => {
  it('renders tool, policy, document selection and run button', () => {
    const html = renderToStaticMarkup(
      <ToolSelector
        policies={policies}
        tools={tools}
        documents={documents}
        onParametersChange={() => {}}
        defaultToolId={pdf.id}
        defaultPolicyId={strict.id}
      />
    );
    expect(html).toContain('Configure sandbox run');
    expect(html).toContain(pdf.name);
    expect(html).toContain(strict.name);
    expect(html).toContain('Run in sandbox');
    expect(html).toContain('Explicit human approval');
    expect(html).toContain('Network access');
  });

  it('renders risk disclaimer', () => {
    const html = renderToStaticMarkup(
      <ToolSelector
        policies={policies}
        tools={tools}
        documents={documents}
        onParametersChange={() => {}}
        defaultToolId={pdf.id}
        defaultPolicyId={strict.id}
      />
    );
    expect(html).toContain('High-impact actions require human approval');
    expect(html).toContain('untrusted');
  });
});

describe('SandboxResults static markup', () => {
  it('renders output, resources, threat scan', () => {
    const html = renderToStaticMarkup(<SandboxResults result={fakeResult} />);
    expect(html).toContain('Sandbox run complete');
    expect(html).toContain('Resources used');
    expect(html).toContain('Sandbox output (untrusted)');
    expect(html).toContain('Threat scan');
    expect(html).toContain('No threats detected');
    expect(html).toContain('illustrative');
  });

  it('renders detected threats when present', () => {
    const resultWithThreats = {
      run: fakeRun,
      scan: {
        pre: [{ threatId: 't1', threatName: 'Eval', severity: 'critical', action: 'block', detectedIn: 'input', description: 'bad' }],
        post: [],
        blocked: true,
        redacted: false
      }
    };
    const html = renderToStaticMarkup(<SandboxResults result={resultWithThreats} />);
    expect(html).toContain('Eval');
    expect(html).toContain('Detected threats');
  });
});
