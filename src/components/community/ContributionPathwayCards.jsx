import React from 'react';
import {
  Code2,
  Palette,
  Accessibility,
  Database,
  Bot,
  TestTube2,
  FileText,
  ArrowUpRight,
  Sparkles,
  GitPullRequest
} from 'lucide-react';
import './ContributionPathwayCards.css';

export const CONTRIBUTION_PATHWAYS = [
  {
    id: 'frontend-ui',
    title: 'Frontend & UI Engineering',
    category: 'Engineering',
    icon: Code2,
    badge: 'Good First Issue',
    summary: 'Build and polish responsive React components, improve layout ergonomics, and refine design system tokens.',
    skills: ['React 18', 'Tailwind / CSS', 'Component Ergonomics'],
    issueSearchQuery: 'label%3Aui+label%3Agood-first-issue+is%3Aopen',
    repoPath: 'src/components',
    recommendedStartingPoint: 'Component style refinements & responsive padding'
  },
  {
    id: 'accessibility',
    title: 'Accessibility & Screen Readers',
    category: 'Design & A11y',
    icon: Accessibility,
    badge: 'High Impact',
    summary: 'Ensure ARIA live regions, keyboard focus traps, high contrast modes, and WCAG AA compliance across citizen portals.',
    skills: ['ARIA', 'WCAG AA', 'Keyboard Traversal', 'Screen Readers'],
    issueSearchQuery: 'label%3Aaccessibility+is%3Aopen',
    repoPath: 'src/utils/accessibility.js',
    recommendedStartingPoint: 'Focus outlines and aria-expanded announcements'
  },
  {
    id: 'civic-data',
    title: 'Civic Service Data & Schemas',
    category: 'Data & Policy',
    icon: Database,
    badge: 'Citizen Critical',
    summary: 'Curate official state and central scheme schemas, verify document requirements, and update statutory deadlines.',
    skills: ['JSON Schema', 'Government Schemes', 'Data Verification'],
    issueSearchQuery: 'label%3Adata+label%3Agood-first-issue+is%3Aopen',
    repoPath: 'src/data/services',
    recommendedStartingPoint: 'Verify state department fees and required affidavits'
  },
  {
    id: 'ai-guidance',
    title: 'AI Policy & Safe Guidance',
    category: 'AI & Safety',
    icon: Bot,
    badge: 'Innovative',
    summary: 'Refine retrieval-augmented prompts, hallucination mitigation filters, and deterministic clarification templates.',
    skills: ['RAG', 'Prompt Engineering', 'Policy Guardrails'],
    issueSearchQuery: 'label%3Aai+is%3Aopen',
    repoPath: 'src/services/ai',
    recommendedStartingPoint: 'Clarification intent extraction filters'
  },
  {
    id: 'testing-qa',
    title: 'Testing & Chaos Automation',
    category: 'Quality Assurance',
    icon: TestTube2,
    badge: 'Reliability',
    summary: 'Write Vitest unit and integration suites, synthetic fixtures, mock backpressure, and edge-case contracts.',
    skills: ['Vitest', 'Testing Library', 'Synthetic Data'],
    issueSearchQuery: 'label%3Atest+label%3Agood-first-issue+is%3Aopen',
    repoPath: 'tests',
    recommendedStartingPoint: 'Add missing failure-path unit tests'
  },
  {
    id: 'documentation',
    title: 'Documentation & Guides',
    category: 'Community',
    icon: FileText,
    badge: 'Welcoming',
    summary: 'Write clear architectural guides, contribution playbooks, multilingual glossaries, and plain-language runbooks.',
    skills: ['Technical Writing', 'Markdown', 'Localization'],
    issueSearchQuery: 'label%3Adocumentation+label%3Agood-first-issue+is%3Aopen',
    repoPath: 'docs',
    recommendedStartingPoint: 'Step-by-step local development troubleshooting guide'
  }
];

export default function ContributionPathwayCards({ repoBaseUrl = 'https://github.com/GoldRay19/Civic-Help-Setu' }) {
  return (
    <section className="cpc-container" aria-label="First-time contributor pathways">
      <div className="cpc-header">
        <div className="cpc-badge">
          <Sparkles size={16} aria-hidden="true" />
          <span>FIRST-TIME CONTRIBUTOR PATHWAYS</span>
        </div>
        <h2 className="cpc-title">Find Your Entry Point into Public Tech</h2>
        <p className="cpc-description">
          Whether you write code, design accessible experiences, verify government rules, or test reliability,
          there is an active pathway for your contributions.
        </p>
      </div>

      <div className="cpc-grid" role="list">
        {CONTRIBUTION_PATHWAYS.map((pathway) => {
          const Icon = pathway.icon;
          const searchUrl = `${repoBaseUrl}/issues?q=${pathway.issueSearchQuery}`;
          const codeUrl = `${repoBaseUrl}/tree/main/${pathway.repoPath}`;

          return (
            <article key={pathway.id} className="cpc-card" role="listitem">
              <div className="cpc-card-top">
                <div className="cpc-icon-wrapper" aria-hidden="true">
                  <Icon size={24} />
                </div>
                <span className="cpc-pill">{pathway.badge}</span>
              </div>

              <h3 className="cpc-card-title">{pathway.title}</h3>
              <p className="cpc-card-summary">{pathway.summary}</p>

              <div className="cpc-card-meta">
                <span className="cpc-meta-label">Starting Point:</span>
                <span className="cpc-meta-value">{pathway.recommendedStartingPoint}</span>
              </div>

              <div className="cpc-tags" aria-label={`Skills for ${pathway.title}`}>
                {pathway.skills.map((skill) => (
                  <span key={skill} className="cpc-tag">
                    {skill}
                  </span>
                ))}
              </div>

              <div className="cpc-actions">
                <a
                  href={searchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cpc-btn cpc-btn-primary"
                  aria-label={`Find good first issues for ${pathway.title} on GitHub`}
                >
                  <GitPullRequest size={16} aria-hidden="true" />
                  <span>Good First Issues</span>
                  <ArrowUpRight size={14} aria-hidden="true" />
                </a>
                <a
                  href={codeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cpc-btn cpc-btn-secondary"
                  aria-label={`Explore repository files for ${pathway.title}`}
                >
                  <span>Explore Code</span>
                  <ArrowUpRight size={14} aria-hidden="true" />
                </a>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
