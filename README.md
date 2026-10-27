# 🏛️ Civic Help Setu

### Bridging Citizens and Public Services Through Technology

<p align="center">
  <img src="https://img.shields.io/badge/Nexus%20Spring%20of%20Code-Winter%20Edition-blueviolet?style=for-the-badge" alt="Nexus Spring of Code Winter Edition" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/Vite-Powered-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License" />
</p>

<p align="center">
  <strong>Discover. Understand. Access.</strong>
  <br />
  Making civic services simpler, more accessible, and easier to navigate for everyone.
</p>

<p align="center">
  <a href="https://civic-help-setu.vercel.app/">🌐 Live Demo</a> •
  <a href="https://github.com/GoldRay19/Civic-Help-Setu">📦 Repository</a> •
  <a href="https://github.com/GoldRay19/Civic-Help-Setu/issues">🐛 Report an Issue</a> •
  <a href="https://github.com/GoldRay19/Civic-Help-Setu/pulls">🔧 Pull Requests</a>
</p>

---

## 🌟 About the Project

**Civic Help Setu** is a modern civic-tech platform designed to make public services easier to discover, understand, and access.

Proudly part of **Nexus Spring of Code – Winter Edition (NSOC)**, the project brings together open-source collaboration, practical problem-solving, modern frontend engineering, and technology for public good.

Government services are often distributed across multiple websites, departments, and complicated application processes. Citizens may struggle to understand eligibility requirements, identify the correct documents, or determine what to do next.

Civic Help Setu addresses these challenges through a unified, citizen-friendly digital experience that helps users explore public services, access simplified guidance, save useful resources, track service journeys, and manage important documents.

Our goal is simple:

> **Make civic information easier to understand and public services easier to navigate.**

## 🎯 Our Mission

To build an accessible, intuitive, and user-centered digital platform that helps citizens navigate civic services with greater clarity and confidence.

We aim to:

* 🧭 Simplify the discovery of public services.
* 📚 Make service requirements and procedures easier to understand.
* 🤖 Provide AI-assisted civic guidance.
* 📊 Help users organize and follow their service journeys.
* 🔐 Support secure authentication and document management.
* 🌍 Encourage inclusive access through responsive and accessible design.
* 🤝 Build a collaborative open-source community through NSOC.

---

## ✨ Key Features

### 🤖 1. AI-Powered Civic Assistant

An assistant designed to help users understand civic information, explore public services, and navigate common service-related questions.

### 🏛️ 2. Public Service Discovery

Explore a catalog of civic and government services through a structured interface designed to make information easier to find.

### 📋 3. Detailed Service Information

Understand service eligibility, requirements, application steps, and other relevant information through dedicated service pages.

### ❤️ 4. Saved Services

Save useful services for convenient access and revisit important information when needed.

On the Saved page, a collection switcher groups guides by their folder. A guide lives in exactly one folder, so nothing is duplicated and removing a guide updates every collection. Collections exist only while a saved guide uses them; a collection created empty is kept in memory for the current visit and is not stored.

### 📈 5. Service Journey Tracking

Use the tracking dashboard to organize service journeys and review available progress information.

### 🔐 6. Secure Authentication

Authentication powered by Clerk, with support for email-based authentication and Google sign-in where configured.

### 🗄️ 7. Digital Document Vault

A dedicated interface for organizing important citizen documents and credentials, subject to the application's configured storage and security implementation.

### 👤 8. Personalized Profile

Access profile-related features and a more personalized platform experience.

### 🛡️ 9. Administrative Dashboard

Provide authorized administrators with tools for reviewing and managing service resources.

### 📥 10. Bulk Service Import

Support importing service records from CSV or JSON files, with validation and duplicate checks.

### 🌗 11. Responsive Interface and Theme Support

A responsive design with theme support, built to provide a consistent experience across supported screen sizes.

### ♿ 12. Accessibility-Focused Design

Clear navigation, readable content, consistent interaction patterns, and a user-centered approach to public-service information.

---

## 📊 Project at a Glance

| Category           | Details                               |
| ------------------ | ------------------------------------- |
| Project            | Civic Help Setu                       |
| Domain             | Civic Technology / GovTech            |
| Program            | Nexus Spring of Code – Winter Edition |
| Frontend           | React 19                              |
| Build Tool         | Vite                                  |
| Routing            | React Router                          |
| Authentication     | Clerk                                 |
| Icons              | Lucide React                          |
| Code Quality       | ESLint                                |
| Deployment         | Vercel-ready                          |
| License            | MIT                                   |
| Contribution Model | Open Source                           |

---

## 🧭 Application Routes

The platform includes the following major application areas:

| Route / Section | Purpose                                   |
| --------------- | ----------------------------------------- |
| Home            | Introduction and service highlights       |
| Assistant       | AI-assisted civic guidance                |
| Services        | Explore available services                |
| Service Details | Review individual service information     |
| Saved           | Revisit saved services                    |
| Track           | Organize service journeys                 |
| Vault           | Access the document vault                 |
| Profile         | Manage profile-related information        |
| Login / Sign Up | Authenticate with the platform            |
| Open Source     | Explore community contributions           |
| Privacy Policy  | Review privacy-related information        |
| Admin           | Access authorized administrative features |

The availability of individual features depends on the application's current implementation and configuration.

---

## 🛠️ Tech Stack

| Technology   | Purpose                                     |
| ------------ | ------------------------------------------- |
| React 19     | Component-based user interface              |
| Vite         | Development server and build tooling        |
| React Router | Client-side navigation                      |
| Clerk        | Authentication and identity management      |
| Lucide React | Interface icons                             |
| CSS          | Styling, responsive layouts, and animations |
| ESLint       | Code quality and linting                    |
| Vercel       | Deployment and hosting                      |

---

## 📂 Project Structure

```text
Civic-Help-Setu/
├── .github/
├── public/
├── src/
│   ├── ai/
│   ├── assets/
│   ├── components/
│   ├── context/
│   ├── data/
│   ├── pages/
│   ├── App.css
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── .env.example
├── .gitignore
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── CHANGELOG.md
├── SECURITY.md
├── eslint.config.js
├── index.html
├── package.json
├── package-lock.json
├── refactor.js
├── vercel.json
├── vite.config.js
├── LICENSE
└── README.md
```

---

## 🚀 Getting Started

Follow these steps to run Civic Help Setu locally.

### Prerequisites

Make sure you have installed:

* [Node.js](https://nodejs.org/) 18 or newer, compatible with the project's dependencies.
* npm.
* Git.

### 1. Clone the Repository

```bash
git clone https://github.com/GoldRay19/Civic-Help-Setu.git
cd Civic-Help-Setu
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a local environment file using the example provided in the repository.

```bash
cp .env.example .env
```

On Windows PowerShell, you can also run:

```powershell
Copy-Item .env.example .env
```

Configure the variables required by the application:

```env
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
```

**Important security notes:**

* Use only the environment variables required by the actual implementation.
* Variables prefixed with `VITE_` are exposed to client-side code and must not contain private API secrets.
* Do not expose an OpenAI secret key in a React frontend. Route AI requests through a secured backend or another appropriate server-side integration.
* Never commit `.env` files containing credentials.
* Verify that the document vault uses appropriate access controls and secure storage before uploading sensitive documents.

### 4. Configure Clerk

1. Create an account through the [Clerk Dashboard](https://dashboard.clerk.com/).
2. Configure your application and authentication methods.
3. Add the publishable key to your local environment file.
4. Configure the required sign-in methods and allowed application URLs.
5. If the application uses Clerk metadata for roles, ensure administrative permissions are assigned and verified server-side.

**Important:** Hiding administrative controls in the frontend is not sufficient to secure administrative operations. Any privileged backend actions must independently verify the user's permissions.

### 5. Start the Development Server

```bash
npm run dev
```

Open the local URL printed by Vite. The default is generally:

```text
http://localhost:5173
```

### 6. Build for Production

```bash
npm run build
```

### 7. Run Linting

```bash
npm run lint
```

### 8. Run Tests

```bash
npm test
```

Run this command if a test script is configured in `package.json`. If the script is not configured, use the test command provided by the project.

---

## 🌐 Deployment

Civic Help Setu includes a Vercel configuration and is structured for frontend deployment.

### Deployment Checklist

* Import the repository into Vercel.
* Configure the required environment variables.
* Configure authentication redirect URLs.
* Verify that the production domain is allowed by the authentication provider.
* Confirm that client-side routes work after refreshing a page.
* Test the AI assistant and any required backend integrations.
* Check mobile responsiveness and accessibility.
* Verify that sensitive information is never exposed through frontend bundles or public API responses.

**Live Application:** https://civic-help-setu.vercel.app/

---

## 🤝 Open Source & NSOC Contributions

Civic Help Setu is part of **Nexus Spring of Code – Winter Edition**, encouraging developers to collaborate on practical software projects and contribute to meaningful open-source development.

We welcome contributors interested in frontend engineering, UI/UX, accessibility, AI-assisted civic guidance, data validation, testing, documentation, and improving the citizen experience.

Whether you are new to open source or an experienced developer, you can help make civic information easier to navigate.

### 🟢 Level 1 — Beginner-Friendly Contributions

**Ideal for:** First-time contributors and developers learning open source.

Example tasks:

* Fix minor UI inconsistencies.
* Improve typography, spacing, and responsive layouts.
* Correct spelling or grammar in the interface.
* Improve README documentation.
* Add accessibility labels and descriptive text.
* Fix simple CSS or styling bugs.
* Improve empty states and loading messages.
* Report reproducible bugs.

**Goal:** Build confidence with the repository, Git, GitHub, and the contribution workflow.

### 🟡 Level 2 — Intermediate Contributions

**Ideal for:** Contributors comfortable working across components and application logic.

Example tasks:

* Improve reusable React components.
* Enhance service discovery and filtering.
* Improve form validation and error handling.
* Strengthen responsive behavior across pages.
* Improve service data normalization and validation.
* Enhance authentication-related UI flows.
* Add tests for existing components or utility functions.
* Improve the usability of saved services and tracking pages.

**Goal:** Deliver focused improvements to application functionality, maintainability, and user experience.

### 🔴 Level 3 — Advanced Contributions

**Ideal for:** Experienced contributors ready to handle complex features or architectural improvements.

Example tasks:

* Improve the architecture of the AI assistant.
* Implement robust service data import and validation workflows.
* Strengthen authorization and administrative workflows.
* Improve secure document-management integrations.
* Design reliable backend API integrations.
* Develop comprehensive testing and error-handling strategies.
* Optimize application performance and accessibility.
* Address complex bugs spanning multiple components.

**Goal:** Deliver substantial, well-tested improvements with clear documentation and appropriate security considerations.

> **Contribution levels are indicative complexity categories.** The actual level, eligibility, assignment, and acceptance criteria should follow the relevant issue labels and NSOC program rules.

---

## 🧑‍💻 How to Contribute

We appreciate contributions of every size, from a small documentation fix to a substantial feature.

### Step 1: Explore the Repository

Visit the [Civic Help Setu repository](https://github.com/GoldRay19/Civic-Help-Setu).

Review the README, contribution guidelines, open issues, and existing pull requests.

### Step 2: Find an Issue

Browse the [open issues](https://github.com/GoldRay19/Civic-Help-Setu/issues).

Look for tasks marked with:

* `level1` — beginner-friendly tasks.
* `level2` — intermediate tasks.
* `level3` — advanced tasks.
* `bug` — fixes for existing functionality.
* `enhancement` — feature improvements.
* `documentation` — documentation-related work.

Use the labels that actually exist in the repository; the names above are suggested conventions.

### Step 3: Discuss Before Starting

Comment on the issue describing your proposed approach.

Wait for the project maintainer or authorized issue assignee to confirm the task and clarify the expected outcome.

Avoid duplicating another contributor's work.

### Step 4: Fork and Clone

```bash
git clone https://github.com/YOUR-USERNAME/Civic-Help-Setu.git
cd Civic-Help-Setu
```

Add the upstream repository:

```bash
git remote add upstream https://github.com/GoldRay19/Civic-Help-Setu.git
```

Create a focused branch:

```bash
git checkout -b fix/short-description
```

### Step 5: Make and Validate Your Changes

Keep changes focused, readable, and consistent with the existing codebase.

Run the available checks:

```bash
npm run lint
npm run build
```

Run the project's configured tests where applicable.

### Step 6: Open a Pull Request

Push your branch and open a pull request against the appropriate repository branch.

Include:

* The issue number.
* A clear description of the problem.
* The changes you implemented.
* Testing performed.
* Screenshots for significant UI changes.
* Any relevant accessibility or security considerations.

### Step 7: Collaborate During Review

Respond constructively to review feedback, make requested changes, and keep your branch updated when necessary.

Contributions are reviewed according to project standards and applicable program rules.

---

## 🌟 Contributors

Open source grows through people who share ideas, solve problems, review code, improve documentation, and help others learn.

A big thank-you to everyone who contributes to Civic Help Setu!

### Meet the Community

<a href="https://github.com/GoldRay19/Civic-Help-Setu/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=GoldRay19/Civic-Help-Setu" alt="Civic Help Setu contributors" />
</a>

*Contributor avatars are generated using the repository's public contribution graph. Displayed contributors may vary as repository activity changes.*

### Ways to Contribute

You do not need to build a complete feature to make a difference.

You can contribute by:

* Writing or improving documentation.
* Reporting bugs with clear reproduction steps.
* Reviewing pull requests.
* Improving accessibility.
* Testing the application on different devices.
* Improving the quality and accuracy of service information.
* Helping new contributors understand the codebase.

**Every thoughtful contribution helps make the platform better.**

---

## 🔒 Security & Privacy

Civic Help Setu is intended to help citizens navigate public services responsibly.

Because the platform may involve authentication, administrative permissions, AI integrations, and document-related features, security and privacy deserve particular attention.

Contributors should:

* Never commit credentials, API keys, or personal documents.
* Avoid including real identity documents in screenshots or test data.
* Validate imported service records before accepting them.
* Ensure administrative actions enforce authorization checks.
* Avoid sending sensitive personal information to AI services unnecessarily.
* Report potential vulnerabilities privately according to `SECURITY.md`.

Please review the repository's security policy before reporting sensitive issues.

---

## 🗺️ Future Improvement Areas

Potential areas for future development include:

* 🌐 Multilingual civic information.
* 🧠 More reliable AI-assisted service guidance.
* 🔎 Better service search and filtering.
* ♿ Further accessibility improvements.
* 📱 Enhanced mobile usability.
* 🔔 Notifications for relevant service updates.
* 🧪 Expanded automated testing.
* 🛡️ Stronger privacy and security controls.
* 📊 Improved service tracking and progress visibility.
* 🗂️ More robust service data management.

These are potential directions rather than a promise that every feature is already implemented or scheduled.

---

## 📜 License

Civic Help Setu is released under the **MIT License**.

See the [`LICENSE`](https://github.com/GoldRay19/Civic-Help-Setu/blob/main/LICENSE) file for details.

---

## 📬 Contact & Community

Have a question, discovered a bug, or want to contribute?

* **Repository:** [GoldRay19/Civic-Help-Setu](https://github.com/GoldRay19/Civic-Help-Setu)
* **Live Application:** [Civic Help Setu](https://civic-help-setu.vercel.app/)
* **Issues:** [Report a bug or suggest a feature](https://github.com/GoldRay19/Civic-Help-Setu/issues)
* **Pull Requests:** [Explore contributions](https://github.com/GoldRay19/Civic-Help-Setu/pulls)
* **Contributors:** [Meet the contributors](https://github.com/GoldRay19/Civic-Help-Setu/graphs/contributors)

For collaboration, please use the repository's issue and pull-request workflows.

---

<p align="center">
  <strong>Built with ❤️ for citizens, by the open-source community.</strong>
  <br />
  <em>Part of Nexus Spring of Code – Winter Edition.</em>
  <br /><br />
  <strong>Civic Help Setu — Connecting People with Public Services.</strong>
</p>
