import React, { useState } from 'react';
import { 
  Code, 
  GitPullRequest, 
  AlertCircle, 
  BookOpen, 
  Heart, 
  Shield, 
  Accessibility, 
  FileCheck2, 
  Palette, 
  CheckCircle2, 
  ExternalLink, 
  Terminal, 
  Users 
} from 'lucide-react';
import LiveContributorsSection from '../components/community/LiveContributorsSection';

/**
 * OpenSource Component - Civic Help Setu Contributors Hub
 * Provides a dedicated community center outlining contribution pathways,
 * verified repository links, governance values, and step-by-step local setup.
 */
const OpenSource = () => {
  const [activePathway, setActivePathway] = useState('code');

  const repoBaseUrl = 'https://github.com/GoldRay19/Civic-Help-Setu';

  const pathways = [
    {
      id: 'code',
      title: 'Code & Core Engineering',
      icon: Code,
      badge: 'React 18 / Vite / Vitest',
      description: 'Build robust client-side civic tools, offline caching, and responsive UI components with clean architecture.',
      skills: ['React', 'JavaScript (ES6+)', 'Tailwind / CSS Variables', 'Vitest'],
      tasks: [
        'Implement offline-first PWA caching and service workers',
        'Enhance AI retrieval-augmented civic assistance modules',
        'Improve local data minimization and document vault utilities'
      ],
      linkText: 'Browse Code Issues',
      linkUrl: `${repoBaseUrl}/issues?q=is%3Aissue+is%3Aopen+label%3Aenhancement`
    },
    {
      id: 'ui',
      title: 'UI & UX Design',
      icon: Palette,
      badge: 'User-Centric Design',
      description: 'Craft intuitive, clutter-free layouts that help citizens navigate complex bureaucratic workflows calmly.',
      skills: ['Figma', 'Responsive Layouts', 'Information Architecture', 'Plain UI'],
      tasks: [
        'Refine mobile viewport spacing and touch targets',
        'Design visual progress roadmaps and milestone trackers',
        'Simplify application checklists and service comparison trays'
      ],
      linkText: 'View UI/UX Tasks',
      linkUrl: `${repoBaseUrl}/issues?q=is%3Aissue+is%3Aopen+label%3Aui`
    },
    {
      id: 'a11y',
      title: 'Accessibility (a11y)',
      icon: Accessibility,
      badge: 'WCAG 2.1 AA Standard',
      description: 'Ensure every citizen, regardless of ability or assistive technology, can access public guidance seamlessly.',
      skills: ['ARIA landmark roles', 'Screen Reader Auditing', 'Keyboard Navigation', 'High Contrast'],
      tasks: [
        'Audit keyboard focus rings and skip-to-content links',
        'Verify NVDA/VoiceOver announcement readability',
        'Support prefers-reduced-motion across interactive banners'
      ],
      linkText: 'Explore a11y Issues',
      linkUrl: `${repoBaseUrl}/issues?q=is%3Aissue+is%3Aopen+label%3Aaccessibility`
    },
    {
      id: 'civic-data',
      title: 'Civic Data & Scheme Guides',
      icon: FileCheck2,
      badge: 'Verified Portals Only',
      description: 'Research statutory government portals, fee schedules, and required document checklists for state and central services.',
      skills: ['Legal/Govt Research', 'Plain-Language Writing', 'Markdown', 'Regulatory Auditing'],
      tasks: [
        'Add card-based guides for State/UT certificates and documents',
        'Audit official fee rules and turnaround timelines',
        'Draft rejection prevention checklists for common applications'
      ],
      linkText: 'Help with Civic Guides',
      linkUrl: `${repoBaseUrl}/issues?q=is%3Aissue+is%3Aopen+label%3Adocumentation`
    },
    {
      id: 'testing',
      title: 'Testing & Quality Assurance',
      icon: Shield,
      badge: 'Zero Regressions',
      description: 'Strengthen automated test suites and security guardrails to maintain software reliability.',
      skills: ['Unit Testing', 'ESLint Security', 'Edge-Case Auditing', 'Regression Tests'],
      tasks: [
        'Write Vitest suites for newly introduced service cards',
        'Run security linting to catch vulnerable patterns early',
        'Validate offline caching fallbacks under simulated disconnects'
      ],
      linkText: 'Check Testing Tasks',
      linkUrl: `${repoBaseUrl}/issues?q=is%3Aissue+is%3Aopen+label%3Atesting`
    },
    {
      id: 'docs',
      title: 'Docs & Translation',
      icon: BookOpen,
      badge: 'Multilingual India',
      description: 'Help translate bureaucratic terminology into plain Indian languages and maintain comprehensive developer guides.',
      skills: ['Multilingual Translation', 'Technical Documentation', 'Glossary Curation'],
      tasks: [
        'Translate civic acronyms and statutory legal terms',
        'Keep README and CONTRIBUTING guidelines crystal clear',
        'Document environment setup and offline troubleshooting tips'
      ],
      linkText: 'Contribute to Docs',
      linkUrl: `${repoBaseUrl}/blob/main/CONTRIBUTING.md`
    }
  ];

  return (
    <div className="container max-w-5xl pt-16 pb-24 text-gray-900 dark:text-gray-100">
      {/* Hero Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 mb-4">
          <Users size={14} />
          <span>Civic Help Setu Community Hub</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-4 tracking-tight">
          Building India&apos;s Public Tech Infrastructure, Together
        </h1>
        <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto leading-relaxed">
          Civic Help Setu is a 100% open-source, non-governmental civic assistance platform.
          We transform fragmented bureaucratic rules into clear, actionable, verified steps for every Indian citizen.
        </p>

        {/* Quick Hub Links */}
        <div className="flex flex-wrap justify-center gap-3 mt-6">
          <a
            href={repoBaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary inline-flex items-center gap-2 text-sm font-semibold"
            aria-label="Visit Civic Help Setu GitHub repository (opens in new tab)"
          >
            <Code size={16} />
            <span>GitHub Repository</span>
            <ExternalLink size={14} className="opacity-70" />
          </a>
          <a
            href={`${repoBaseUrl}/blob/main/CONTRIBUTING.md`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary inline-flex items-center gap-2 text-sm font-semibold"
            aria-label="Read Civic Help Setu contribution guidelines (opens in new tab)"
          >
            <BookOpen size={16} />
            <span>Contribution Guidelines</span>
            <ExternalLink size={14} className="opacity-70" />
          </a>
          <a
            href={`${repoBaseUrl}/issues`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary inline-flex items-center gap-2 text-sm font-semibold"
            aria-label="Browse open issues on GitHub (opens in new tab)"
          >
            <AlertCircle size={16} />
            <span>Open Issues</span>
            <ExternalLink size={14} className="opacity-70" />
          </a>
          <a
            href={`${repoBaseUrl}/pulls`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary inline-flex items-center gap-2 text-sm font-semibold"
            aria-label="Review active Pull Requests on GitHub (opens in new tab)"
          >
            <GitPullRequest size={16} />
            <span>Pull Requests</span>
            <ExternalLink size={14} className="opacity-70" />
          </a>
        </div>
      </div>

      {/* Guiding Principles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        <div className="p-6 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
          <div className="w-12 h-12 rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 flex items-center justify-center mb-4">
            <Heart size={24} />
          </div>
          <h2 className="text-lg font-bold mb-2">Public Good First</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-normal">
            No paywalls, ads, or monetization. Public-service procedures and legal awareness belong freely to every citizen.
          </p>
        </div>

        <div className="p-6 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
          <div className="w-12 h-12 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center mb-4">
            <Shield size={24} />
          </div>
          <h2 className="text-lg font-bold mb-2">Privacy &amp; Data Dignity</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-normal">
            No tracking of citizen inquiries, zero data brokering, and local-first browser storage for all personal documents.
          </p>
        </div>

        <div className="p-6 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
          <div className="w-12 h-12 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 flex items-center justify-center mb-4">
            <CheckCircle2 size={24} />
          </div>
          <h2 className="text-lg font-bold mb-2">Government Verified Only</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-normal">
            Every timeline, fee, and requirement links directly to verified government gazettes and official department portals.
          </p>
        </div>
      </div>

      {/* Contribution Pathways Section */}
      <section className="mb-16">
        <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-8">
          <h2 className="text-2xl font-bold tracking-tight">Choose Your Contribution Pathway</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Whether you write code, design accessible experiences, test features, or research civic policies, there is a place for you.
          </p>
        </div>

        {/* Pathway Pills */}
        <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label="Contribution Pathways">
          {pathways.map((item) => {
            const IconComponent = item.icon;
            const isSelected = activePathway === item.id;
            return (
              <button
                key={item.id}
                role="tab"
                aria-selected={isSelected}
                aria-controls={`panel-${item.id}`}
                id={`tab-${item.id}`}
                onClick={() => setActivePathway(item.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/50'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300'
                }`}
              >
                <IconComponent size={16} />
                <span>{item.title}</span>
              </button>
            );
          })}
        </div>

        {/* Selected Pathway Details Card */}
        {pathways
          .filter((p) => p.id === activePathway)
          .map((item) => {
            const IconComponent = item.icon;
            return (
              <div
                key={item.id}
                role="tabpanel"
                id={`panel-${item.id}`}
                aria-labelledby={`tab-${item.id}`}
                className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      <IconComponent size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{item.title}</h3>
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                        {item.badge}
                      </span>
                    </div>
                  </div>
                  <a
                    href={item.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <span>{item.linkText}</span>
                    <ExternalLink size={14} />
                  </a>
                </div>

                <p className="text-gray-700 dark:text-gray-300 text-sm mb-6 leading-relaxed">
                  {item.description}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100 dark:border-gray-800 text-sm">
                  <div>
                    <h4 className="font-semibold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                      Key Skills &amp; Focus Areas
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {item.skills.map((skill, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                      Typical High-Impact Contributions
                    </h4>
                    <ul className="space-y-1.5 text-xs text-gray-600 dark:text-gray-300">
                      {item.tasks.map((task, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-emerald-500 font-bold">•</span>
                          <span>{task}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
      </section>

      {/* Live GitHub Contributors Section */}
      <LiveContributorsSection />

      {/* Quick Local Setup Guide */}
      <section className="mb-16 p-6 sm:p-8 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-3">
          <Terminal size={20} className="text-blue-600 dark:text-blue-400" />
          <h2 className="text-xl font-bold">Fast-Track Local Development Setup</h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Get Civic Help Setu running on your local machine in under 2 minutes:
        </p>

        <div className="space-y-3 font-mono text-xs">
          <div className="p-3 rounded-lg bg-gray-900 text-gray-100 overflow-x-auto">
            <span className="text-gray-500"># 1. Clone your fork of the repository</span>
            <br />
            git clone https://github.com/&lt;your-username&gt;/Civic-Help-Setu.git
            <br />
            cd Civic-Help-Setu
          </div>

          <div className="p-3 rounded-lg bg-gray-900 text-gray-100 overflow-x-auto">
            <span className="text-gray-500"># 2. Install dependencies &amp; start dev server</span>
            <br />
            npm install
            <br />
            npm run dev
          </div>

          <div className="p-3 rounded-lg bg-gray-900 text-gray-100 overflow-x-auto">
            <span className="text-gray-500"># 3. Verify tests and security lint before opening PR</span>
            <br />
            npm test
            <br />
            npm run lint:security
          </div>
        </div>
      </section>

      {/* Community Callout & Code of Conduct */}
      <div className="text-center p-8 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
        <h2 className="text-2xl font-bold mb-2">Have an Idea or Found a Gap?</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 max-w-xl mx-auto mb-6">
          If an official civic procedure has changed in your state or you noticed an error in guidance,
          open an issue directly or submit a pull request. Every contribution helps fellow citizens save hours of confusion.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href={`${repoBaseUrl}/issues/new`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary inline-flex items-center gap-2 text-sm font-semibold"
          >
            <span>Open a New Issue</span>
            <ExternalLink size={14} />
          </a>
          <a
            href={`${repoBaseUrl}/blob/main/CODE_OF_CONDUCT.md`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary inline-flex items-center gap-2 text-sm font-semibold"
          >
            <span>Code of Conduct</span>
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
};

export default OpenSource;