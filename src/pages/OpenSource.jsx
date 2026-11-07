
import React, { useState } from 'react';
import {
  Code2,
  GitPullRequest,
  AlertCircle,
  BookOpen,
  Heart,
  ShieldCheck,
  Accessibility,
  FileCheck2,
  Palette,
  CheckCircle2,
  ExternalLink,
  Terminal,
  Users,
  ArrowUpRight,
  Sparkles,
  Github,
  Globe2,
  Copy,
  Layers3,
  ChevronRight,
  Rocket,
  Lightbulb,
  Star,
  GitBranch,
  Monitor,
  HandHeart,
  ClipboardCheck,
} from 'lucide-react';

import LiveContributorsSection from '../components/community/LiveContributorsSection';

const OpenSource = () => {
  const [activePathway, setActivePathway] = useState('code');
  const [copiedCommand, setCopiedCommand] = useState('');

  const repoBaseUrl = 'https://github.com/GoldRay19/Civic-Help-Setu';

  const pathways = [
    {
      id: 'code',
      title: 'Code & Engineering',
      subtitle: 'Build the foundation',
      icon: Code2,
      badge: 'Development',
      description:
        'Engineer reliable civic technology through thoughtful architecture, intelligent automation, and scalable applications that make public services easier to access.',
      skills: ['React', 'JavaScript', 'Vite', 'Tailwind CSS', 'Vitest'],
      tasks: [
        'Develop offline-first PWA experiences and service workers',
        'Improve AI-powered civic assistance and retrieval systems',
        'Build secure document vaults and privacy-first utilities',
      ],
      linkText: 'Explore code issues',
      linkUrl: `${repoBaseUrl}/issues?q=is%3Aissue+is%3Aopen+label%3Aenhancement`,
      color: 'blue',
    },
    {
      id: 'ui',
      title: 'UI & UX Design',
      subtitle: 'Design for everyone',
      icon: Palette,
      badge: 'Design',
      description:
        'Create intuitive, welcoming interfaces that transform complex government procedures into simple, understandable experiences for every citizen.',
      skills: ['Figma', 'Responsive Design', 'UX Research', 'CSS', 'Accessibility'],
      tasks: [
        'Improve mobile layouts, spacing, and interactive elements',
        'Design visual application progress and milestone trackers',
        'Simplify document checklists and service comparison experiences',
      ],
      linkText: 'Explore design issues',
      linkUrl: `${repoBaseUrl}/issues?q=is%3Aissue+is%3Aopen+label%3Aui`,
      color: 'purple',
    },
    {
      id: 'a11y',
      title: 'Accessibility',
      subtitle: 'Technology without barriers',
      icon: Accessibility,
      badge: 'Inclusive Technology',
      description:
        'Make civic information accessible to people with different abilities, devices, languages, and assistive technologies.',
      skills: ['WCAG', 'ARIA', 'Keyboard Navigation', 'NVDA', 'Screen Readers'],
      tasks: [
        'Audit keyboard navigation and visible focus indicators',
        'Improve screen-reader announcements and semantic HTML',
        'Implement reduced-motion and high-contrast support',
      ],
      linkText: 'Explore accessibility issues',
      linkUrl: `${repoBaseUrl}/issues?q=is%3Aissue+is%3Aopen+label%3Aaccessibility`,
      color: 'emerald',
    },
    {
      id: 'civic-data',
      title: 'Civic Research & Data',
      subtitle: 'Make information trustworthy',
      icon: FileCheck2,
      badge: 'Civic Research',
      description:
        'Research government services, eligibility conditions, official portals, documentation requirements, and application procedures across India.',
      skills: ['Government Research', 'Legal Awareness', 'Markdown', 'Data Verification'],
      tasks: [
        'Create structured guides for state and central government services',
        'Verify official fees, eligibility rules, and application timelines',
        'Prepare document checklists that prevent application rejection',
      ],
      linkText: 'Explore documentation issues',
      linkUrl: `${repoBaseUrl}/issues?q=is%3Aissue+is%3Aopen+label%3Adocumentation`,
      color: 'amber',
    },
    {
      id: 'testing',
      title: 'Testing & Security',
      subtitle: 'Build with confidence',
      icon: ShieldCheck,
      badge: 'Quality Assurance',
      description:
        'Protect the reliability of civic services through automated testing, security reviews, and continuous quality improvements.',
      skills: ['Vitest', 'Unit Testing', 'Security', 'Regression Testing', 'ESLint'],
      tasks: [
        'Create automated tests for service and eligibility components',
        'Identify security weaknesses and vulnerable code patterns',
        'Test offline functionality and network failure scenarios',
      ],
      linkText: 'Explore testing issues',
      linkUrl: `${repoBaseUrl}/issues?q=is%3Aissue+is%3Aopen+label%3Atesting`,
      color: 'rose',
    },
    {
      id: 'docs',
      title: 'Documentation & Languages',
      subtitle: 'Knowledge belongs to everyone',
      icon: BookOpen,
      badge: 'Community Knowledge',
      description:
        'Make technical documentation and government terminology easier to understand through clear writing, translations, and practical guides.',
      skills: ['Technical Writing', 'Translation', 'Markdown', 'Indian Languages'],
      tasks: [
        'Translate important civic terminology into Indian languages',
        'Improve README and contributor documentation',
        'Document environment setup and troubleshooting procedures',
      ],
      linkText: 'Explore documentation',
      linkUrl: `${repoBaseUrl}/blob/main/CONTRIBUTING.md`,
      color: 'cyan',
    },
  ];

  const principles = [
    {
      icon: Heart,
      title: 'Public Good First',
      description:
        'Civic information should remain accessible. We believe in building useful public-interest technology without paywalls or unnecessary barriers.',
      color: 'rose',
    },
    {
      icon: ShieldCheck,
      title: 'Privacy by Design',
      description:
        'Respect citizen data. Minimize unnecessary collection, protect personal documents, and make privacy an essential part of every feature.',
      color: 'emerald',
    },
    {
      icon: CheckCircle2,
      title: 'Trust & Transparency',
      description:
        'Government procedures, fees, and requirements should be backed by official sources and presented with clear verification context.',
      color: 'blue',
    },
  ];

  const setupSteps = [
    {
      title: 'Clone the repository',
      description: 'Get the project onto your local machine.',
      command: `git clone https://github.com/<your-username>/Civic-Help-Setu.git
cd Civic-Help-Setu`,
    },
    {
      title: 'Install dependencies',
      description: 'Install the packages required by the project.',
      command: `npm install
npm run dev`,
    },
    {
      title: 'Run quality checks',
      description: 'Check your changes before submitting a pull request.',
      command: `npm test
npm run lint:security`,
    },
  ];

  const activeItem = pathways.find(
    (item) => item.id === activePathway
  );

  const ActiveIcon = activeItem.icon;

  const copyCommand = async (command, index) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedCommand(String(index));
      window.setTimeout(() => setCopiedCommand(''), 2000);
    } catch {
      setCopiedCommand('');
    }
  };

  const colorStyles = {
    blue: {
      icon: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      badge: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
      selected: 'border-blue-500 bg-blue-500/[0.06]',
      dot: 'bg-blue-500',
    },
    purple: {
      icon: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
      badge: 'bg-purple-500/10 text-purple-700 dark:text-purple-300',
      selected: 'border-purple-500 bg-purple-500/[0.06]',
      dot: 'bg-purple-500',
    },
    emerald: {
      icon: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      selected: 'border-emerald-500 bg-emerald-500/[0.06]',
      dot: 'bg-emerald-500',
    },
    amber: {
      icon: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
      selected: 'border-amber-500 bg-amber-500/[0.06]',
      dot: 'bg-amber-500',
    },
    rose: {
      icon: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
      badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
      selected: 'border-rose-500 bg-rose-500/[0.06]',
      dot: 'bg-rose-500',
    },
    cyan: {
      icon: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
      badge: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
      selected: 'border-cyan-500 bg-cyan-500/[0.06]',
      dot: 'bg-cyan-500',
    },
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-white text-gray-900 dark:bg-[#080d18] dark:text-gray-100">

      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-48 left-1/2 h-[480px] w-[700px] -translate-x-1/2 rounded-full bg-blue-500/[0.08] blur-[120px]" />
        <div className="absolute right-0 top-[600px] h-80 w-80 rounded-full bg-purple-500/[0.05] blur-[100px]" />
        <div className="absolute left-0 top-[1200px] h-80 w-80 rounded-full bg-cyan-500/[0.05] blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-12 sm:px-6 lg:px-8 lg:pt-20">

        {/* HERO */}
        <section className="relative mb-20 overflow-hidden rounded-[32px] border border-gray-200 bg-gradient-to-br from-gray-50 via-white to-blue-50/70 px-6 py-14 dark:border-white/10 dark:from-[#111827] dark:via-[#0d1422] dark:to-[#101e36] sm:px-12 sm:py-20 lg:px-16">

          <div className="absolute -right-20 -top-28 h-80 w-80 rounded-full border border-blue-500/10" />
          <div className="absolute -right-8 -top-16 h-56 w-56 rounded-full border border-blue-500/10" />

          <div className="relative z-10 max-w-4xl">

            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-4 py-2 text-xs font-bold tracking-wide text-blue-700 shadow-sm dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-300">
              <Sparkles size={15} />
              THE CIVIC HELP SETU COMMUNITY
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              OPEN SOURCE
            </div>

            <h1 className="max-w-4xl text-4xl font-black leading-[1.12] tracking-tight sm:text-5xl lg:text-7xl">
              Build technology
              <br />
              that makes a
              <span className="bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent">
                {' '}difference.
              </span>
            </h1>

            <p className="mt-7 max-w-2xl text-base leading-8 text-gray-600 dark:text-gray-400 sm:text-lg">
              Join a community building more accessible, transparent,
              and understandable civic services for India. Every line
              of code, verified guide, and thoughtful contribution
              moves us forward.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <a
                href={`${repoBaseUrl}/issues`}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5 hover:bg-blue-700"
              >
                <Rocket size={17} />
                Start Contributing
                <ArrowUpRight size={16} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>

              <a
                href={repoBaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-6 py-3.5 text-sm font-bold text-gray-800 transition-all hover:border-gray-400 hover:bg-gray-50 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
              >
                <Github size={17} />
                Explore Repository
                <ExternalLink size={14} />
              </a>
            </div>

            <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-gray-200 pt-7 dark:border-white/10">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Globe2 size={17} className="text-blue-500" />
                Built for India
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <HandHeart size={17} className="text-rose-500" />
                Public-interest technology
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Users size={17} className="text-emerald-500" />
                Community-driven
              </div>
            </div>

          </div>
        </section>

        {/* QUICK LINKS */}
        <section className="mb-20">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
                Get involved
              </p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight">
                Your contribution starts here.
              </h2>
            </div>
            <ArrowUpRight className="hidden text-gray-400 sm:block" size={24} />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">

            {[
              {
                title: 'Repository',
                subtitle: 'Explore the code',
                icon: Github,
                href: repoBaseUrl,
              },
              {
                title: 'Issues',
                subtitle: 'Find something to solve',
                icon: AlertCircle,
                href: `${repoBaseUrl}/issues`,
              },
              {
                title: 'Pull Requests',
                subtitle: 'Review contributions',
                icon: GitPullRequest,
                href: `${repoBaseUrl}/pulls`,
              },
              {
                title: 'Guidelines',
                subtitle: 'Learn how to contribute',
                icon: BookOpen,
                href: `${repoBaseUrl}/blob/main/CONTRIBUTING.md`,
              },
            ].map((link) => {
              const Icon = link.icon;

              return (
                <a
                  key={link.title}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-2xl border border-gray-200 bg-white p-4 transition-all hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-500/5 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-blue-400/40 sm:p-5"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <Icon size={20} />
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-sm font-bold">{link.title}</span>
                    <ArrowUpRight size={15} className="text-gray-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-blue-500" />
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {link.subtitle}
                  </p>
                </a>
              );
            })}
          </div>
        </section>

        {/* PRINCIPLES */}
        <section className="mb-24">
          <div className="mb-9 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
              What drives us
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Technology with a purpose.
            </h2>
            <p className="mt-3 text-sm leading-7 text-gray-600 dark:text-gray-400">
              We believe meaningful technology begins with people,
              transparency, and a commitment to the public good.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {principles.map((item) => {
              const Icon = item.icon;
              const styles = colorStyles[item.color];

              return (
                <article
                  key={item.title}
                  className="group rounded-2xl border border-gray-200 bg-white p-7 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-gray-900/5 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.05]"
                >
                  <div className={`mb-6 flex h-12 w-12 items-center justify-center rounded-2xl ${styles.icon}`}>
                    <Icon size={24} />
                  </div>
                  <h3 className="text-lg font-extrabold">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-gray-600 dark:text-gray-400">
                    {item.description}
                  </p>
                  <div className="mt-6 h-1 w-10 rounded-full bg-gray-200 transition-all group-hover:w-20 group-hover:bg-blue-500 dark:bg-white/10" />
                </article>
              );
            })}
          </div>
        </section>

        {/* CONTRIBUTION PATHWAYS */}
        <section className="mb-24">

          <div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
                Find your place
              </p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Choose your pathway.
              </h2>
              <p className="mt-3 text-sm leading-7 text-gray-600 dark:text-gray-400">
                You don't need to do everything. Pick the area where
                your skills can create the greatest impact.
              </p>
            </div>

            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
              <Layers3 size={15} className="text-blue-500" />
              6 contribution pathways
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[320px_1fr] lg:items-start">

            {/* Pathway selector */}
            <div
              className="flex gap-2 overflow-x-auto pb-3 lg:flex-col lg:overflow-visible lg:pb-0"
              role="tablist"
              aria-label="Contribution pathways"
              aria-orientation="vertical"
            >
              {pathways.map((item) => {
                const Icon = item.icon;
                const selected = activePathway === item.id;
                const styles = colorStyles[item.color];

                return (
                  <button
                    key={item.id}
                    id={`tab-${item.id}`}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls={`panel-${item.id}`}
                    onClick={() => setActivePathway(item.id)}
                    className={`flex min-w-[230px] items-center gap-3 rounded-2xl border p-4 text-left transition-all lg:min-w-0 ${
                      selected
                        ? `${styles.selected} shadow-sm`
                        : 'border-gray-200 bg-white hover:border-gray-300 dark:border-white/10 dark:bg-white/[0.02] dark:hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}>
                      <Icon size={21} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">
                        {item.title}
                      </span>
                      <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                        {item.subtitle}
                      </span>
                    </div>

                    <ChevronRight
                      size={17}
                      className={`shrink-0 transition-transform ${
                        selected
                          ? 'translate-x-0.5 text-blue-500'
                          : 'text-gray-400'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Active pathway details */}
            <article
              key={activeItem.id}
              id={`panel-${activeItem.id}`}
              role="tabpanel"
              aria-labelledby={`tab-${activeItem.id}`}
              tabIndex={0}
              className="min-w-0 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#101827] sm:p-9"
            >

              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${colorStyles[activeItem.color].icon}`}>
                    <ActiveIcon size={27} />
                  </div>
                  <div>
                    <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${colorStyles[activeItem.color].badge}`}>
                      {activeItem.badge}
                    </span>
                    <h3 className="mt-2 text-xl font-extrabold sm:text-2xl">
                      {activeItem.title}
                    </h3>
                  </div>
                </div>
              </div>

              <p className="mt-7 max-w-2xl text-sm leading-8 text-gray-600 dark:text-gray-400">
                {activeItem.description}
              </p>

              <div className="my-8 h-px bg-gray-100 dark:bg-white/10" />

              <div className="grid gap-9 sm:grid-cols-2">

                <div>
                  <div className="mb-4 flex items-center gap-2">
                    <Star size={16} className="text-amber-500" />
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Skills & technologies
                    </h4>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {activeItem.skills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-4 flex items-center gap-2">
                    <ClipboardCheck size={16} className="text-emerald-500" />
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Potential contributions
                    </h4>
                  </div>

                  <ul className="space-y-4">
                    {activeItem.tasks.map((task) => (
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

              <div className="mt-9 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gray-50 p-4 dark:bg-white/[0.04]">
                <div>
                  <p className="text-sm font-bold">
                    Ready to make an impact?
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Find an opportunity in this contribution area.
                  </p>
                </div>

                <a
                  href={activeItem.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-bold text-white transition-all hover:bg-blue-700"
                >
                  {activeItem.linkText}
                  <ArrowUpRight size={15} />
                </a>
              </div>
            </article>

          </div>
        </section>

        {/* LIVE CONTRIBUTORS */}
        <section className="mb-24">
          <div className="mb-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
              The people behind the project
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Meet the contributors.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-600 dark:text-gray-400">
              Open source grows through people who share their time,
              ideas, and skills. Discover the community contributing
              to Civic Help Setu.
            </p>
          </div>

          <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03] sm:p-8">
            <LiveContributorsSection />
          </div>
        </section>

        {/* DEVELOPER SETUP */}
        <section className="mb-24 overflow-hidden rounded-3xl border border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-[#101827]">

          <div className="grid lg:grid-cols-[0.85fr_1.15fr]">

            <div className="p-7 sm:p-10 lg:p-12">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Terminal size={24} />
              </div>

              <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
                Developer quickstart
              </p>

              <h2 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight">
                From zero to your first contribution.
              </h2>

              <p className="mt-4 text-sm leading-8 text-gray-600 dark:text-gray-400">
                Set up your local environment, explore the codebase,
                and prepare your first contribution to the project.
              </p>

              <a
                href={`${repoBaseUrl}/blob/main/CONTRIBUTING.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                Read contribution guidelines
                <ArrowUpRight size={16} />
              </a>
            </div>

            <div className="space-y-4 bg-white p-5 dark:bg-[#0b1220] sm:p-8">

              {setupSteps.map((step, index) => (
                <div
                  key={step.title}
                  className="overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-white/10">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-xs font-extrabold text-blue-600 dark:text-blue-400">
                        0{index + 1}
                      </span>
                      <div>
                        <h3 className="text-xs font-bold">
                          {step.title}
                        </h3>
                        <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                          {step.description}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => copyCommand(step.command, index)}
                      aria-label={`Copy commands for ${step.title}`}
                      className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-2 text-[10px] font-bold text-gray-600 transition-colors hover:bg-gray-100 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10"
                    >
                      {copiedCommand === String(index) ? (
                        <>
                          <CheckCircle2 size={13} />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy size={13} />
                          Copy
                        </>
                      )}
                    </button>
                  </div>

                  <pre className="overflow-x-auto bg-[#0b1220] p-5 text-xs leading-7 text-emerald-300">
                    <code>{step.command}</code>
                  </pre>
                </div>
              ))}

            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 px-6 py-14 text-center text-white shadow-xl shadow-blue-600/10 sm:px-12 sm:py-16">

          <div className="pointer-events-none absolute -left-20 -top-28 h-72 w-72 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -right-16 -bottom-32 h-96 w-96 rounded-full border border-white/10" />

          <div className="relative z-10 mx-auto max-w-2xl">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
              <Lightbulb size={27} />
            </div>

            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-100">
              Every contribution counts
            </p>

            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">
              Have an idea? Let's build it together.
            </h2>

            <p className="mt-5 text-sm leading-8 text-blue-100 sm:text-base">
              Found outdated civic information, identified an
              improvement, or want to introduce a new feature?
              Share your idea with the community.
            </p>

            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <a
                href={`${repoBaseUrl}/issues/new`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-extrabold text-blue-700 transition-all hover:-translate-y-0.5 hover:bg-blue-50"
              >
                Open an issue
                <ArrowUpRight size={17} />
              </a>

              <a
                href={`${repoBaseUrl}/blob/main/CODE_OF_CONDUCT.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3.5 text-sm font-bold text-white transition-all hover:bg-white/20"
              >
                <Heart size={16} />
                Code of Conduct
              </a>
            </div>

            <p className="mt-8 text-xs text-blue-100/80">
              Civic Help Setu · Open source · Built for the public good
            </p>
          </div>
        </section>

      </div>
    </main>
  );
};

export default OpenSource;
