import {
  Sparkles,
  ShieldCheck,
  FileText,
  CreditCard,
  Building2,
  HeartHandshake,
  AlertCircle,
  HelpCircle,
  Compass,
} from 'lucide-react';

/**
 * Categorized starter prompts mapped to common civic tasks
 */
export const CATEGORIZED_STARTER_PROMPTS = [
  {
    category: 'Identity & Vital Records',
    icon: FileText,
    prompts: [
      {
        label: 'Birth Certificate',
        prompt: 'My baby was just born. How do I get a birth certificate?',
        desc: 'Registration timelines, hospital slips, and municipal portals.',
      },
      {
        label: 'Lost Aadhaar',
        prompt: 'I lost my Aadhaar card. What should I do?',
        desc: 'Online retrieval using registered mobile or demographic match.',
      },
    ],
  },
  {
    category: 'Licences & Transport',
    icon: Compass,
    prompts: [
      {
        label: 'Driving Licence',
        prompt: 'What documents do I need for a driving license?',
        desc: 'Learner stage, Parivahan portal, age proof, and fees.',
      },
      {
        label: 'Passport Issuance',
        prompt: 'How do I apply for a new passport?',
        desc: 'Appointment scheduling, Annexures, and PSK verification.',
      },
    ],
  },
  {
    category: 'Welfare & Grievances',
    icon: HeartHandshake,
    prompts: [
      {
        label: 'Farmer Support',
        prompt: 'Am I eligible for PM Kisan Samman Nidhi?',
        desc: 'Landholding records, eKYC status, and installment schedules.',
      },
      {
        label: 'Public Grievance',
        prompt: 'How do I file a public grievance against a department?',
        desc: 'CPGRAMS portal escalation, timelines, and nodal appeals.',
      },
    ],
  },
];

/**
 * ChatEmptyState Component (#584)
 *
 * Provides a reassuring, informative starting surface for citizens interacting
 * with the Civic Assistant. Clearly defines assistant capabilities and data sources
 * without implying official government authority.
 */
const ChatEmptyState = ({ prompts = [], onSelectPrompt, disabled = false }) => {
  return (
    <section
      className="chat-empty-state glass-panel animate-fade-in"
      aria-labelledby="chat-empty-title"
      style={{
        padding: '1.75rem',
        borderRadius: '1.25rem',
        marginBottom: '2rem',
        border: '1px solid var(--border-light)',
        background: 'var(--glass-bg)',
      }}
    >
      {/* Scope and Trust Banner */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem', marginBottom: '1.25rem' }}>
        <div
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: 'rgba(56, 189, 248, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-main)',
            flexShrink: 0,
          }}
        >
          <Sparkles size={20} aria-hidden="true" />
        </div>
        <div>
          <h2
            id="chat-empty-title"
            style={{
              fontSize: '1.25rem',
              fontWeight: '800',
              margin: '0 0 0.4rem 0',
              color: 'var(--text-primary)',
            }}
          >
            What can I help you with?
          </h2>
          <p
            style={{
              fontSize: '0.93rem',
              color: 'var(--text-secondary)',
              lineHeight: '1.6',
              margin: 0,
              maxWidth: '680px',
            }}
          >
            Ask about public services in plain language. I can explain who is eligible, which documents you
            need, the fees, the steps to apply and the official portals. Pick an example below or type your own question.
          </p>
        </div>
      </div>

      {/* Advisory Note on Limitations & Official Status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.65rem',
          padding: '0.75rem 1rem',
          background: 'var(--bg-main)',
          borderRadius: '0.65rem',
          border: '1px solid var(--border-light)',
          fontSize: '0.82rem',
          color: 'var(--text-secondary)',
          lineHeight: '1.5',
          marginBottom: '1.5rem',
        }}
      >
        <ShieldCheck size={16} color="var(--accent-main)" style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
        <div>
          <strong style={{ color: 'var(--text-primary)' }}>Civic Consultation Notice:</strong> This assistant provides informational guidance derived from verified public sources. It does not replace direct official submissions or administrative orders. Always complete formal filings on official government portals.
        </div>
      </div>

      {/* Grouped Starter Prompts by Civic Scenario */}
      <div>
        <p
          style={{
            fontSize: '0.78rem',
            fontWeight: '700',
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '0.85rem',
          }}
        >
          Popular Civic Consultation Scenarios
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {CATEGORIZED_STARTER_PROMPTS.map((group) => {
            const GroupIcon = group.icon;
            return (
              <div key={group.category}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.82rem',
                    fontWeight: '700',
                    color: 'var(--accent-main)',
                    marginBottom: '0.5rem',
                  }}
                >
                  <GroupIcon size={14} aria-hidden="true" />
                  <span>{group.category}</span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '0.65rem',
                  }}
                >
                  {group.prompts.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => onSelectPrompt?.(item.prompt)}
                      disabled={disabled}
                      className="starter-prompt-card card"
                      style={{
                        textAlign: 'left',
                        padding: '0.85rem 1rem',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        background: 'var(--glass-bg)',
                        color: 'var(--text-primary)',
                        borderRadius: '0.75rem',
                        border: '1px solid var(--border-light)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <strong
                        style={{
                          display: 'block',
                          fontSize: '0.88rem',
                          color: 'var(--text-primary)',
                          marginBottom: '0.2rem',
                        }}
                      >
                        {item.label}
                      </strong>
                      <span
                        style={{
                          fontSize: '0.82rem',
                          color: 'var(--text-secondary)',
                          display: 'block',
                          lineHeight: '1.4',
                        }}
                      >
                        {item.prompt}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ChatEmptyState;
