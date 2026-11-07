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
  Copy,
  Check,
  Sparkles,
  GitFork,
  Zap,
} from 'lucide-react';

import LiveContributorsSection from '../components/community/LiveContributorsSection';

const OpenSource = () => {
  const [activePathway, setActivePathway] = useState('code');
  const [copiedCommand, setCopiedCommand] = useState('');

  const repoBaseUrl = 'https://github.com/GoldRay19/Civic-Help-Setu';

  const pathways = [
    {
      id: 'code',
      title: 'Code & Core Engineering',
      icon: Code2,
      badge: 'React · Vite · Vitest',
      description:
        'Build reliable civic technology, offline-first tools, reusable components, and intelligent assistance features.',
      skills: ['React', 'JavaScript', 'Tailwind CSS', 'Vitest'],
      tasks: [
        'Implement offline-first PWA caching and service workers',
        'Enhance AI-powered civic assistance modules',
        'Improve document vault and data privacy utilities',
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
        'Create intuitive, accessible, and responsive experiences that make complicated government processes easier to understand.',
      skills: ['Figma', 'Responsive Design', 'CSS', 'Information Architecture'],
      tasks: [
        'Improve mobile layouts and touch targets',
        'Design application progress roadmaps',
        'Simplify checklists and service comparison interfaces',
      ],
      linkText: 'View UI/UX Tasks',
      linkUrl: `${repoBaseUrl}/issues?q=is%3Aissue+is%3Aopen+label%3Aui`,
    },
    {
      id: 'a11y',
      title: 'Accessibility',
      icon: Accessibility,
      badge: 'Inclusive Technology',
      description:
        'Help citizens with different abilities use the platform through accessible interfaces and assistive technology support.',
      skills: ['ARIA', 'Screen Readers', 'Keyboard Navigation', 'WCAG'],
      tasks: [
        'Audit keyboard navigation and focus indicators',
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
      badge: 'Official Sources',
      description:
        'Research government services, eligibility requirements, statutory fees, documents, and application procedures.',
      skills: ['Government Research', 'Documentation', 'Markdown', 'Data Verification'],
      tasks: [
        'Create guides for state and central government services',
        'Verify official fees and application timelines',
        'Prepare document checklists to prevent application rejection',
      ],
      linkText: 'Help with Civic Guides',
      linkUrl: `${repoBaseUrl}/issues?q=is%3Aissue+is%3Aopen+label%3Adocumentation`,
    },
    {
      id: 'testing',
      title: 'Testing & Quality Assurance',
      icon: Shield,
      badge: 'Reliable Software',
      description:
        'Improve application reliability through automated tests, security checks, regression testing, and practical quality reviews.',
      skills: ['Vitest', 'Unit Testing', 'Security Testing', 'Debugging'],
      tasks: [
        'Write tests for service and application workflows',
        'Identify edge cases and regression issues',
        'Validate offline behaviour and error handling',
      ],
      linkText: 'Explore Testing Issues',
      linkUrl: `${repoBaseUrl}/issues?q=is%3Aissue+is%3Aopen+label%3Atesting`,
    },
    {
      id: 'docs',
      title: 'Documentation & Translation',
      icon: BookOpen,
      badge: 'Multilingual India',
      description:
        'Make technical and civic information understandable through clear documentation, translations, and practical guides.',
      skills: ['Technical Writing', 'Translation', 'Markdown', 'Research'],
      tasks: [
        'Translate civic terminology into Indian languages',
        'Improve README and contribution documentation',
        'Document setup and troubleshooting procedures',
      ],
      linkText: 'Contribute to Documentation',
      linkUrl: `${repoBaseUrl}/blob/main/CONTRIBUTING.md`,
    },
  ];

  const setupCommands = [
    {
      title: 'Clone the repository',
      comment: '# 1. Clone your fork',
      command:
        'git clone https://github.com/<your-username>/Civic-Help-Setu.git\ncd Civic-Help-Setu',
    },
    {
      title: 'Install dependencies',
      comment: '# 2. Install project dependencies',
      command: 'npm install',
    },
    {
      title: 'Start development',
      comment: '# 3. Start the development server',
      command: 'npm run dev',
    },
    {
      title: 'Run quality checks',
      comment: '# 4. Run tests and security checks',
      command: 'npm test\nnpm run lint:security',
    },
  ];

  const copyCommand = async (command, index) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedCommand(String(index));

      window.setTimeout(() => {
        setCopiedCommand('');
      }, 1800);
    } catch (error) {
      console.error('Unable to copy command:', error);
    }
  };

  const selectedPathway = pathways.find(
    (pathway) => pathway.id === activePathway
  );

  const SelectedIcon = selectedPathway?.icon;

  return (
    <main className="min-h-screen overflow-hidden bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      {/* Background decoration */}
      <div className="pointer-events-none absolute left-0 right-0 top-20 -z-0 overflow-hidden">
        <div className="mx-auto h-72 max-w-5xl rounded-full bg-blue-500/10 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 lg:px-8">

        {/* HERO */}
        <section className="relative mb-20 overflow-hidden rounded-[2rem] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-6 py-14 text-center shadow-sm dark:border-blue-900/40 dark:from-blue-950/50 dark:via-gray-900 dark:to-indigo-950/40 sm:px-12 sm:py-20">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-blue-400/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-indigo-400/10 blur-3xl" />

          <div className="relative mx-auto max-w-4xl">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-4 py-2 text-xs font-bold uppercase tracking-wider text-blue-700 shadow-sm dark:border-blue-800 dark:bg-gray-900/80 dark:text-blue-300">
              <Sparkles size={15} />
              Civic Help Setu Community
            </div>

            <h1 className="mb-6 text-4xl font-black leading-tight tracking-tight text-gray-950 dark:text-white sm:text-5xl lg:text-6xl">
              Building India's Public Tech
              <span className="block bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Infrastructure Together.
              </span>
            </h1>

            <p className="mx-auto max-w-3xl text-base leading-8 text-gray-600 dark:text-gray-300 sm:text-lg">
              Civic Help Setu is an open-source, non-governmental civic
              assistance platform. We turn complicated government procedures
              into clear, actionable information that everyone can understand.
            </p>

            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <a
                href={repoBaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-1 hover:bg-blue-700"
              >
                <Code2 size={18} />
                Explore Repository
                <ArrowUpRight size={16} />
              </a>

              <a
                href={`${repoBaseUrl}/blob/main/CONTRIBUTING.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3.5 text-sm font-bold text-gray-800 transition hover:-translate-y-1 hover:border-blue-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              >
                <BookOpen size={18} />
                Contribution Guide
                <ExternalLink size={15} />
              </a>
            </div>

            <div className="mt-10 flex flex-wrap justify-center gap-x-7 gap-y-3 text-sm font-medium text-gray-500 dark:text-gray-400">
              <span className="inline-flex items-center gap-2">
                <GitFork size={16} />
                Open Collaboration
              </span>
              <span className="inline-flex items-center gap-2">
                <Heart size={16} />
                Public Good First
              </span>
              <span className="inline-flex items-center gap-2">
                <Zap size={16} />
                Community Driven
              </span>
            </div>
          </div>
        </section>

        {/* QUICK LINKS */}
        <section className="mb-20">
          <div className="mb-7 text-center">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
              Get involved
            </p>
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Everything starts here
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: 'GitHub Repository',
                description: 'Explore the source code.',
                icon: Code2,
                url: repoBaseUrl,
              },
              {
                title: 'Open Issues',
                description: 'Find tasks and report problems.',
                icon: AlertCircle,
                url: `${repoBaseUrl}/issues`,
              },
              {
                title: 'Pull Requests',
                description: 'Review ongoing contributions.',
                icon: GitPullRequest,
                url: `${repoBaseUrl}/pulls`,
              },
              {
                title: 'Contribution Guide',
                description: 'Learn how to get started.',
                icon: BookOpen,
                url: `${repoBaseUrl}/blob/main/CONTRIBUTING.md`,
              },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <a
                  key={item.title}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-2xl border border-gray-200 bg-white p-5 transition duration-300 hover:-translate-y-1 hover:border-blue-300 hover:shadow-xl hover:shadow-blue-500/5 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-700"
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-950 dark:text-blue-300">
                    <Icon size={21} />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold">{item.title}</h3>
                    <ArrowUpRight
                      size={17}
                      className="text-gray-400 transition group-hover:text-blue-600"
                    />
                  </div>

                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {item.description}
                  </p>
                </a>
              );
            })}
          </div>
        </section>

        {/* PRINCIPLES */}
        <section className="mb-20">
          <div className="mb-8 text-center">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
              What we believe
            </p>
            <h2 className="text-2xl font-extrabold sm:text-3xl">
              Principles behind the project
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-gray-500 dark:text-gray-400">
              Our community is guided by transparency, accessibility, and
              responsible civic information.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-7 transition hover:-translate-y-1 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-300">
                <Heart size={24} />
              </div>
              <h3 className="mb-3 text-lg font-bold">Public Good First</h3>
              <p className="text-sm leading-7 text-gray-500 dark:text-gray-400">
                Public-service information should be understandable and
                accessible. Our goal is to reduce confusion, not create
                barriers.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-7 transition hover:-translate-y-1 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300">
                <Shield size={24} />
              </div>
              <h3 className="mb-3 text-lg font-bold">Privacy & Data Dignity</h3>
              <p className="text-sm leading-7 text-gray-500 dark:text-gray-400">
                We value responsible data handling, privacy-conscious
                development, and transparency around how citizen information
                is used.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-7 transition hover:-translate-y-1 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                <CheckCircle2 size={24} />
              </div>
              <h3 className="mb-3 text-lg font-bold">Verified Information</h3>
              <p className="text-sm leading-7 text-gray-500 dark:text-gray-400">
                Civic requirements, fees, and timelines should be checked
                against official government portals and reliable sources.
              </p>
            </div>
          </div>
        </section>

        {/* CONTRIBUTION PATHWAYS */}
        <section className="mb-20">
          <div className="mb-9 text-center">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
              Find your role
            </p>
            <h2 className="text-2xl font-extrabold sm:text-3xl">
              Choose your contribution pathway
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-gray-500 dark:text-gray-400">
              You do not need to be a full-stack developer to contribute.
              Research, testing, design, accessibility, and documentation
              matter just as much.
            </p>
          </div>

          <div
            className="mb-6 flex flex-wrap justify-center gap-2"
            role="tablist"
            aria-label="Contribution pathways"
          >
            {pathways.map((item) => {
              const Icon = item.icon;
              const isSelected = activePathway === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  aria-controls={`panel-${item.id}`}
                  id={`tab-${item.id}`}
                  onClick={() => setActivePathway(item.id)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                    isSelected
                      ? 'border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-blue-700'
                  }`}
                >
                  <Icon size={17} />
                  {item.title}
                </button>
              );
            })}
          </div>

          {selectedPathway && SelectedIcon && (
            <div
              key={selectedPathway.id}
              role="tabpanel"
              id={`panel-${selectedPathway.id}`}
              aria-labelledby={`tab-${selectedPathway.id}`}
              className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-9"
            >
              <div className="flex flex-col justify-between gap-5 border-b border-gray-100 pb-7 dark:border-gray-800 sm:flex-row sm:items-center">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                    <SelectedIcon size={27} />
                  </div>

                  <div>
                    <span className="mb-1 inline-block text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                      Contribution area
                    </span>
                    <h3 className="text-xl font-extrabold sm:text-2xl">
                      {selectedPathway.title}
                    </h3>
                    <span className="mt-2 inline-block rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                      {selectedPathway.badge}
                    </span>
                  </div>
                </div>

                <a
                  href={selectedPathway.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                >
                  {selectedPathway.linkText}
                  <ArrowUpRight size={16} />
                </a>
              </div>

              <p className="max-w-3xl py-7 text-sm leading-8 text-gray-600 dark:text-gray-300">
                {selectedPathway.description}
              </p>

              <div className="grid grid-cols-1 gap-8 border-t border-gray-100 pt-7 dark:border-gray-800 md:grid-cols-2">
                <div>
                  <h4 className="mb-4 text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Skills and focus areas
                  </h4>

                  <div className="flex flex-wrap gap-2">
                    {selectedPathway.skills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="mb-4 text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Possible contributions
                  </h4>

                  <ul className="space-y-3">
                    {selectedPathway.tasks.map((task) => (
                      <li
                        key={task}
                        className="flex items-start gap-3 text-sm leading-6 text-gray-600 dark:text-gray-300"
                      >
                        <CheckCircle2
                          size={17}
                          className="mt-0.5 shrink-0 text-emerald-500"
                        />
                        {task}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* CONTRIBUTORS */}
        <section className="mb-20">
          <div className="mb-8 text-center">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
              Our community
            </p>
            <h2 className="text-2xl font-extrabold sm:text-3xl">
              Meet the contributors
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-gray-500 dark:text-gray-400">
              Every contribution helps make civic information more accessible.
              Explore the people building Civic Help Setu together.
            </p>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-8">
            <LiveContributorsSection />
          </div>
        </section>

        {/* DEVELOPER SETUP */}
        <section className="mb-20">
          <div className="overflow-hidden rounded-3xl border border-gray-800 bg-gray-950 text-white shadow-xl">
            <div className="border-b border-gray-800 px-6 py-7 sm:px-9">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400">
                  <Terminal size={22} />
                </div>

                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                    Developer guide
                  </span>
                  <h2 className="text-xl font-extrabold sm:text-2xl">
                    Start contributing in minutes
                  </h2>
                </div>
              </div>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-gray-400">
                Set up your local development environment and start working on
                Civic Help Setu.
              </p>
            </div>

            <div className="space-y-4 p-6 sm:p-9">
              {setupCommands.map((item, index) => (
                <div
                  key={item.title}
                  className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-gray-800 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/15 text-xs font-bold text-blue-400">
                        {index + 1}
                      </span>
                      <span className="text-sm font-semibold text-gray-200">
                        {item.title}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => copyCommand(item.command, index)}
                      className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-gray-400 transition hover:bg-gray-800 hover:text-white"
                      aria-label={`Copy ${item.title} command`}
                    >
                      {copiedCommand === String(index) ? (
                        <>
                          <Check size={14} className="text-emerald-400" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          Copy
                        </>
                      )}
                    </button>
                  </div>

                  <div className="overflow-x-auto px-5 py-4">
                    <p className="mb-2 text-xs text-gray-500">
                      {item.comment}
                    </p>
                    <pre className="whitespace-pre-wrap font-mono text-xs leading-7 text-emerald-300 sm:text-sm">
                      {item.command}
                    </pre>
                  </div>
                </div>
              ))}

              <div className="flex items-start gap-3 rounded-xl border border-blue-900/60 bg-blue-950/40 p-4">
                <AlertCircle
                  size={18}
                  className="mt-0.5 shrink-0 text-blue-400"
                />
                <p className="text-xs leading-6 text-gray-300">
                  Before opening a pull request, check the repository's
                  contribution guidelines and verify that the scripts in
                  package.json match the commands you run.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="relative overflow-hidden rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50 via-indigo-50 to-white px-6 py-12 text-center dark:border-blue-900/50 dark:from-blue-950/60 dark:via-indigo-950/40 dark:to-gray-900 sm:px-12 sm:py-16">
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-blue-400/10 blur-3xl" />
          <div className="relative">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
              <Users size={27} />
            </div>

            <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
              Have an idea? Let's build it together.
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-gray-600 dark:text-gray-300">
              Found an issue with civic information? Have a feature idea?
              Want to improve the platform? Share your ideas or contribute
              directly to the project.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a
                href={`${repoBaseUrl}/issues/new`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-1 hover:bg-blue-700"
              >
                Open a New Issue
                <ArrowUpRight size={16} />
              </a>

              <a
                href={`${repoBaseUrl}/blob/main/CODE_OF_CONDUCT.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3.5 text-sm font-bold text-gray-800 transition hover:-translate-y-1 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              >
                <BookOpen size={17} />
                Code of Conduct
              </a>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
};

export default OpenSource;
