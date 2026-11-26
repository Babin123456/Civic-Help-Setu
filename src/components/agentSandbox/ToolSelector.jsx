/**
 * src/components/agentSandbox/ToolSelector.jsx
 *
 * Tool, policy and document selection for the secure agent sandbox.
 * Emits the chosen parameters to the parent. Accessible, mobile-first.
 */

import { useState, useCallback } from 'react';
import { ShieldAlert, FileText, Database, Users, Clock } from 'lucide-react';

export function ToolSelector({
  policies,
  tools,
  documents,
  onParametersChange,
  defaultToolId,
  defaultPolicyId
}) {
  const [toolId, setToolId] = useState(defaultToolId || (tools[0]?.id || null));
  const [policyId, setPolicyId] = useState(defaultPolicyId || null);
  const [documentId, setDocumentId] = useState(null);
  const [inputData, setInputData] = useState('');
  const [networkAllowed, setNetworkAllowed] = useState(false);
  const [humanApproved, setHumanApproved] = useState(false);

  const tool = tools.find((t) => t.id === toolId) || null;
  const policy = policies.find((p) => p.id === policyId) || null;

  // Default policy = tool's default policy.
  const defaultPolicy = tool ? tool.defaultPolicyId : policies[0]?.id;

  const notify = useCallback(() => {
    onParametersChange({
      toolId,
      policyId: policyId || defaultPolicy,
      documentId,
      inputData,
      networkAllowed,
      humanApproved
    });
  }, [toolId, policyId, documentId, inputData, networkAllowed, humanApproved, onParametersChange, defaultPolicy]);

  return (
    <section className="sandbox-selector" aria-label="Sandbox configuration">
      <div className="selector-card">
        <h2 className="selector-title">Configure sandbox run</h2>

        <div className="selector-field">
          <ShieldAlert aria-hidden="true" />
          <label htmlFor="sandbox-tool">Agent tool / parser</label>
          <select
            id="sandbox-tool"
            value={toolId}
            onChange={(e) => { setToolId(e.target.value); setPolicyId((tools.find((x) => x.id === e.target.value) || null)?.defaultPolicyId || defaultPolicy); notify(); }}
            aria-describedby="sandbox-tool-desc"
          >
            {tools.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.documentType})
              </option>
            ))}
          </select>
          {tool && (
            <p id="sandbox-tool-desc" className="selector-hint">
              {tool.provenance}. {tool.riskNote}
            </p>
          )}
        </div>

        <div className="selector-grid">
          <div className="selector-field">
            <Database aria-hidden="true" />
            <label htmlFor="sandbox-policy">Sandbox policy</label>
            <select
              id="sandbox-policy"
              value={policyId || defaultPolicy}
              onChange={(e) => { setPolicyId(e.target.value); notify(); }}
            >
              {policies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.riskLevel} risk
                </option>
              ))}
            </select>
            {policy && (
              <p className="selector-hint">
                CPU {policy.cpuLimitMs} ms &bull; Memory {policy.memoryLimitMB} MB &bull; Time
                {policy.timeLimitMs} ms &bull; Network {policy.networkAllowed ? 'allowed' : 'disabled'}
              </p>
            )}
          </div>

          <div className="selector-field">
            <FileText aria-hidden="true" />
            <label htmlFor="sandbox-document">Synthetic document fixture</label>
            <select
              id="sandbox-document"
              value={documentId || ''}
              onChange={(e) => { setDocumentId(e.target.value || null); notify(); }}
            >
              <option value="">None (use input text)</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.type})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="selector-field">
          <label htmlFor="sandbox-input">Input text (safe fixture only)</label>
          <textarea
            id="sandbox-input"
            value={inputData}
            onChange={(e) => { setInputData(e.target.value); notify(); }}
            rows="3"
            placeholder="Safe synthetic input for the parser. No real citizen data."
          />
          <p className="selector-hint">Never enter real Aadhaar, PAN, phone numbers, OTPs or credentials.</p>
        </div>

        <div className="selector-field selector-inline">
          <label>
            <input
              type="checkbox"
              checked={networkAllowed}
              onChange={() => { setNetworkAllowed((v) => !v); notify(); }}
            />
            Network access
          </label>
          <span className="selector-hint">Only under an approved policy + human approval.</span>
        </div>

        <div className="selector-field selector-inline">
          <label>
            <input
              type="checkbox"
              checked={humanApproved}
              onChange={() => { setHumanApproved((v) => !v); notify(); }}
            />
            Explicit human approval
          </label>
          <span className="selector-hint">Required for network/permissive policies.</span>
        </div>

        <div className="selector-actions">
          <button
            className="btn btn-primary"
            type="button"
            onClick={notify}
            disabled={!toolId}
            aria-label="Run sandbox"
          >
            <Clock aria-hidden="true" /> Run in sandbox
          </button>
        </div>

        <div className="selector-risk">
          <Users aria-hidden="true" />
          <strong>High-impact actions require human approval.</strong> The sandbox never files
          applications, denies benefits or claims official verification. All output is untrusted
          and must be reviewed before any civic action.
        </div>
      </div>
    </section>
  );
}
