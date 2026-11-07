import React, { useState } from 'react';
import {
  Code2,
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
  Users,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';

import LiveContributorsSection from '../components/community/LiveContributorsSection';
import './OpenSource.css';

const OpenSource = () => {
  const [activePathway, setActivePathway] = useState('code');

  const repoBaseUrl = 'https://github.com/GoldRay19/Civic-Help-Setu';

  const pathways = [
    {
      id: 'code',
      title: 'Code & Core Engineering',
      icon: Code2,
      badge: 'React 18 / Vite / Vitest',
      description:
        'Build robust civic tools, offline caching, and responsive UI components with clean architecture.',
      skills: ['React', 'JavaScript', 'Tailwind / CSS', 'Vitest'],
      tasks: [
        'Implement offline-first PWA caching and service workers',
        'Enhance AI retrieval-augmented civic assistance modules',
        'Improve document vault utilities and local data handling',
      ],
      linkText: 'Browse Code Issues',
      linkUrl: `${repoBaseUrl}/issues?q=is%3Aissue+is%3Aopen+label%3Aenhancement`,
    },
    {
      id: 'ui',
      title: 'UI & UX Design',
      icon: Palette,
      badge: 'User-Centric Design',
      description:
        'Craft intuitive, clutter-free layouts that help citizens navigate complex bureaucratic workflows.',
      skills: ['Figma', 'Responsive Design', 'UX Research', 'Accessibility'],
      tasks: [
        'Refine mobile viewport spacing and touch targets',
        'Design visual progress roadmaps and milestone trackers',
        'Simplify application checklists and service comparisons',
      ],
      linkText: 'View UI/UX Tasks',
      linkUrl: `${repoBaseUrl}/issues?q=is%3Aissue+is%3Aopen+label%3Aui`,
    },
    {
      id: 'a11y',
      title: 'Accessibility',
      icon: Accessibility,
      badge: 'Inclusive by Design',
      description:
        'Make civic information accessible to every citizen, including people using assistive technologies.',
      skills: ['ARIA', 'Screen Readers', 'Keyboard Navigation', 'WCAG'],
      tasks: [
        'Audit keyboard focus and skip-to-content links',
        'Improve screen-reader announcements',
        'Support reduced-motion preferences',
      ],
      linkText: 'Explore Accessibility Issues',
      linkUrl: `${repoBaseUrl}/issues?q=is%3Aissue+is%3Aopen+label%3Aaccessibility`,
    },
    {
      id: 'civic-data',
      title: 'Civic Data & Scheme Guides',
      icon: FileCheck2,
      badge: 'Verified Sources',
      description:
        'Research government portals, fee schedules, eligibility rules, and document requirements.',
      skills: ['Government Research', 'Writing', 'Markdown', 'Data Verification'],
      tasks: [
        'Add clear guides for State and UT certificates',
        'Verify official fees and application timelines',
        'Create document checklists to prevent application rejection',
      ],
      linkText: 'Help with Civic Guides',
      linkUrl: `${repoBaseUrl}/issues?q=is%3Aissue+is%3Aopen+label%3Adocumentation`,
    },
    {
      id: 'testing',
      title: 'Testing & Quality Assurance',
      icon: Shield,
      badge: 'Quality First',
      description:
        'Strengthen automated tests and security checks to keep the platform reliable.',
      skills: ['Unit Testing', 'Vitest', 'Security', 'Regression Testing'],
      tasks: [
        'Write tests for newly introduced service cards',
        'Run security checks and identify vulnerable patterns',
        'Validate offline functionality under simulated disconnection',
      ],
      linkText: 'Check Testing Tasks',
      linkUrl: `${repoBaseUrl}/issues?q=is%3Aissue+is%3Aopen+label%3Atesting`,
    },
    {
      id: 'docs',
      title: 'Docs & Translation',
      icon: BookOpen,
      badge: 'Multilingual India',
      description:
        'Translate bureaucratic terminology into plain Indian languages and maintain developer documentation.',
      skills: ['Translation', 'Technical Writing', 'Glossaries', 'Documentation'],
      tasks: [
        'Translate civic acronyms and statutory terminology',
        'Improve README and contribution guidelines',
        'Document environment setup and troubleshooting',
      ],
      linkText: 'Contribute to Docs',
      linkUrl: `${repoBaseUrl}/blob/main/CONTRIBUTING.md`,
    },
  ];

  const principles = [
    {
      icon: Heart,
      title: 'Public Good First',
      description:
        'No paywalls, ads, or monetization. Public-service information should be freely accessible to every citizen.',
      color: 'rose',
    },
    {
      icon: Shield,
      title: 'Privacy & Data Dignity',
      description:
        'Respect citizen privacy, minimize data collection, and prioritize secure local-first document handling.',
      color: 'green',
    },
    {
      icon: CheckCircle2,
      title: 'Verified Information',
      description:
        'Civic guidance should be backed by official government portals, notifications, and verified sources.',
      color: 'blue',
    },
  ];

  const activeItem = pathways.find((item) => item.id === activePathway);
  const ActiveIcon = activeItem.icon;

  return (
    <main className="opensource-page">
      {/* HERO */}
      <section className="os-hero">
        <div className="os-hero-glow os-glow-one" />
        <div className="os-hero-glow os-glow-two" />

        <div className="os-hero-content">
          <div className="os-label">
            <Sparkles size={15} />
            <span>CIVIC HELP SETU COMMUNITY</span>
          </div>

          <h1>
            Building India's Public Tech Infrastructure,
            <span> Together.</span>
          </h1>

          <p className="os-hero-description">
            Civic Help Setu is an open-source civic assistance platform.
            We transform fragmented bureaucratic rules into clear,
            actionable guidance for every Indian citizen.
          </p>

          <div className="os-hero-actions">
            <a
              href={repoBaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="os-btn os-btn-primary"
            >
              <Code2 size={18} />
              Explore Repository
              <ArrowUpRight size={16} />
            </a>

            <a
              href={`${repoBaseUrl}/blob/main/CONTRIBUTING.md`}
              target="_blank"
              rel="noopener noreferrer"
              className="os-btn os-btn-outline"
            >
              <BookOpen size={18} />
              Contribution Guide
            </a>
          </div>

          <div className="os-hero-meta">
            <span><Users size={15} /> Open community</span>
            <span><Heart size={15} /> Built for public good</span>
            <span><Code2 size={15} /> Open source</span>
          </div>
        </div>
      </section>

      {/* QUICK LINKS */}
      <section className="os-quick-links" aria-label="Repository links">
        <a href={repoBaseUrl} target="_blank" rel="noopener noreferrer">
          <Code2 size={19} />
          <span>Repository</span>
          <ArrowUpRight size={15} />
        </a>

        <a href={`${repoBaseUrl}/issues`} target="_blank" rel="noopener noreferrer">
          <AlertCircle size={19} />
          <span>Issues</span>
          <ArrowUpRight size={15} />
        </a>

        <a href={`${repoBaseUrl}/pulls`} target="_blank" rel="noopener noreferrer">
          <GitPullRequest size={19} />
          <span>Pull Requests</span>
          <ArrowUpRight size={15} />
        </a>

        <a
          href={`${repoBaseUrl}/blob/main/CODE_OF_CONDUCT.md`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Heart size={19} />
          <span>Code of Conduct</span>
          <ArrowUpRight size={15} />
        </a>
      </section>

      {/* PRINCIPLES */}
      <section className="os-section">
        <div className="os-section-heading">
          <span className="os-section-kicker">OUR VALUES</span>
          <h2>Technology with a purpose.</h2>
          <p>
            We believe technology should make public information easier
            to understand, access, and use.
          </p>
        </div>

        <div className="os-principles-grid">
          {principles.map((item) => {
            const Icon = item.icon;

            return (
              <article className="os-principle-card" key={item.title}>
                <div className={`os-principle-icon os-${item.color}`}>
                  <Icon size={24} />
                </div>

                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      {/* CONTRIBUTION PATHWAYS */}
      <section className="os-section os-pathways-section">
        <div className="os-section-heading">
          <span className="os-section-kicker">GET INVOLVED</span>
          <h2>Find your way to contribute.</h2>
          <p>
            Whether you write code, design interfaces, test features,
            or research civic policies, there is a place for you.
          </p>
        </div>

        <div className="os-pathway-layout">
          <div className="os-pathway-tabs" role="tablist" aria-label="Contribution pathways">
            {pathways.map((item) => {
              const Icon = item.icon;
              const selected = activePathway === item.id;

              return (
                <button
                  type="button"
                  key={item.id}
                  role="tab"
                  id={`os-tab-${item.id}`}
                  aria-selected={selected}
                  aria-controls={`os-panel-${item.id}`}
                  className={`os-pathway-tab ${selected ? 'active' : ''}`}
                  onClick={() => setActivePathway(item.id)}
                >
                  <span className="os-tab-icon"><Icon size={19} /></span>
                  <span>{item.title}</span>
                  <ArrowUpRight size={15} className="os-tab-arrow" />
                </button>
              );
            })}
          </div>

          <article
            className="os-pathway-detail"
            role="tabpanel"
            id={`os-panel-${activeItem.id}`}
            aria-labelledby={`os-tab-${activeItem.id}`}
          >
            <div className="os-detail-header">
              <div className="os-detail-icon">
                <ActiveIcon size={27} />
              </div>

              <div className="os-detail-title">
                <span className="os-detail-badge">{activeItem.badge}</span>
                <h3>{activeItem.title}</h3>
              </div>
            </div>

            <p className="os-detail-description">
              {activeItem.description}
            </p>

            <div className="os-detail-columns">
              <div>
                <h4>Skills & Focus Areas</h4>
                <div className="os-skill-list">
                  {activeItem.skills.map((skill) => (
                    <span key={skill}>{skill}</span>
                  ))}
                </div>
              </div>

              <div>
                <h4>Ways You Can Help</h4>
                <ul className="os-task-list">
                  {activeItem.tasks.map((task) => (
                    <li key={task}>
                      <CheckCircle2 size={16} />
                      <span>{task}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <a
              className="os-detail-link"
              href={activeItem.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {activeItem.linkText}
              <ArrowUpRight size={16} />
            </a>
          </article>
        </div>
      </section>

      {/* LIVE CONTRIBUTORS */}
      <section className="os-contributors-wrapper">
        <div className="os-section-heading">
          <span className="os-section-kicker">THE PEOPLE BEHIND THE PROJECT</span>
          <h2>Meet the contributors.</h2>
          <p>
            Every improvement is made possible by people who share
            their time, knowledge, and ideas.
          </p>
        </div>

        <LiveContributorsSection />
      </section>

      {/* LOCAL SETUP */}
      <section className="os-section">
        <div className="os-setup-card">
          <div className="os-setup-heading">
            <div className="os-setup-icon">
              <Terminal size={23} />
            </div>
            <div>
              <span className="os-section-kicker">START BUILDING</span>
              <h2>Run the project locally.</h2>
            </div>
          </div>

          <p className="os-setup-description">
            Follow these commands to get Civic Help Setu running on
            your development machine.
          </p>

          <div className="os-code-steps">
            <div className="os-code-step">
              <div className="os-code-step-heading">
                <span>01</span>
                <strong>Clone the repository</strong>
              </div>
              <pre>
                <code>
                  git clone https://github.com/GoldRay19/Civic-Help-Setu.git
                  {'\n'}cd Civic-Help-Setu
                </code>
              </pre>
            </div>

            <div className="os-code-step">
              <div className="os-code-step-heading">
                <span>02</span>
                <strong>Install dependencies</strong>
              </div>
              <pre><code>npm install</code></pre>
            </div>

            <div className="os-code-step">
              <div className="os-code-step-heading">
                <span>03</span>
                <strong>Start the development server</strong>
              </div>
              <pre><code>npm run dev</code></pre>
            </div>

            <div className="os-code-step">
              <div className="os-code-step-heading">
                <span>04</span>
                <strong>Run tests</strong>
              </div>
              <pre><code>npm test</code></pre>
            </div>
          </div>

          <a
            className="os-setup-link"
            href={`${repoBaseUrl}/blob/main/README.md`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Read full setup documentation <ArrowUpRight size={15} />
          </a>
        </div>
      </section>

      {/* COMMUNITY CTA */}
      <section className="os-community-cta">
        <div className="os-cta-decoration">
          <Code2 size={100} />
        </div>

        <div className="os-cta-content">
          <span className="os-section-kicker">YOUR CONTRIBUTION MATTERS</span>
          <h2>Have an idea? Let's build it together.</h2>
          <p>
            Found an issue in civic guidance, spotted a missing feature,
            or want to improve the platform? Share your idea with the community.
          </p>

          <div className="os-cta-actions">
            <a
              href={`${repoBaseUrl}/issues/new`}
              target="_blank"
              rel="noopener noreferrer"
              className="os-btn os-btn-primary"
            >
              Open an Issue <ArrowUpRight size={16} />
            </a>

            <a
              href={`${repoBaseUrl}/pulls`}
              target="_blank"
              rel="noopener noreferrer"
              className="os-btn os-btn-outline"
            >
              Submit a Pull Request <GitPullRequest size={16} />
            </a>
          </div>
        </div>
      </section>
    </main>
  );
};

export default OpenSource;
