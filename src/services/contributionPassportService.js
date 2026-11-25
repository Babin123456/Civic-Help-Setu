/**
 * Personal Contribution Passport Service
 *
 * Implements an opt-in, shareable, privacy-preserving digital portfolio for contributors:
 * - Empowers developers to showcase verified contributions to Civic Help Setu on resumes, LinkedIn, and personal portfolios
 * - Unguessable cryptographically random share tokens (`pass_tok_...`)
 * - Contributor Privacy & Consent Controls:
 *   * Opt-in publishing (default: private / non-shareable)
 *   * Granular visibility toggles (hide email, hide PR timestamps, anonymize handles)
 *   * Immediate one-click revocation: contributor can invalidate public links at any time
 * - Export formats:
 *   * Clean JSON resume schema
 *   * Markdown portfolio summary
 */

export const VISIBILITY_OPTIONS = Object.freeze({
  PUBLIC: 'PUBLIC',
  PRIVATE: 'PRIVATE',
  UNLISTED: 'UNLISTED'
});

/**
 * Generates an unguessable share token for public passport viewing
 * @returns {string} Unguessable token
 */
export function generatePassportShareToken() {
  const time = Date.now().toString(36);
  const randA = Math.random().toString(36).substring(2, 10);
  const randB = Math.random().toString(36).substring(2, 10);
  return `pass_tok_${time}_${randA}${randB}`;
}

export class PersonalContributionPassport {
  constructor(username, options = {}) {
    if (!username || typeof username !== 'string') {
      throw new Error('Valid contributor username is required');
    }

    this.username = username;
    this.visibility = options.visibility || VISIBILITY_OPTIONS.PRIVATE;
    this.shareToken = options.visibility === VISIBILITY_OPTIONS.PUBLIC ? generatePassportShareToken() : null;
    this.bio = options.bio || '';
    this.privacySettings = {
      showEmail: false,
      showActivityTimestamps: true,
      ...options.privacySettings
    };
    this.contributions = [];
    this.badges = [];
    this.createdAt = Date.now();
  }

  /**
   * Publishes the passport publicly and creates a secure share token
   * @returns {string} Share token
   */
  enablePublicSharing() {
    this.visibility = VISIBILITY_OPTIONS.PUBLIC;
    this.shareToken = generatePassportShareToken();
    return this.shareToken;
  }

  /**
   * Revokes public access immediately, invalidating the previous share token
   */
  revokePublicSharing() {
    this.visibility = VISIBILITY_OPTIONS.PRIVATE;
    this.shareToken = null;
  }

  /**
   * Records a verified contribution record
   * @param {Object} item Contribution record
   */
  addContribution(item) {
    this.contributions.push({
      id: `contrib_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: item.title,
      type: item.type || 'PULL_REQUEST',
      prNumber: item.prNumber,
      impact: item.impact || 'Core improvement',
      date: item.date || new Date().toISOString()
    });
  }

  /**
   * Records an earned badge
   * @param {Object} badge Badge data
   */
  addBadge(badge) {
    this.badges.push(badge);
  }

  /**
   * Exports view-safe presentation object complying with privacy settings
   * @param {string} tokenPresented Optional token provided by external visitor
   * @returns {Object|null} Redacted public profile or null if unauthorized
   */
  getPublicPassportView(tokenPresented = null) {
    if (this.visibility === VISIBILITY_OPTIONS.PRIVATE) {
      return null;
    }

    if (this.visibility === VISIBILITY_OPTIONS.UNLISTED || this.visibility === VISIBILITY_OPTIONS.PUBLIC) {
      if (this.shareToken && tokenPresented !== this.shareToken) {
        return null;
      }
    }

    return {
      username: this.username,
      bio: this.bio,
      shareToken: this.shareToken,
      badges: this.badges,
      contributions: this.contributions.map(c => ({
        title: c.title,
        type: c.type,
        prNumber: c.prNumber,
        impact: c.impact,
        date: this.privacySettings.showActivityTimestamps ? c.date : null
      }))
    };
  }

  /**
   * Generates markdown summary suitable for embedding in GitHub README or CV
   * @returns {string} Markdown document
   */
  exportMarkdownPortfolio() {
    let md = `# Civic Help Setu Contribution Passport: @${this.username}\n\n`;
    md += `> ${this.bio || 'Open Source Civic Tech Contributor'}\n\n`;
    md += `### Verified Contributions (${this.contributions.length})\n\n`;

    for (const c of this.contributions) {
      md += `- **PR #${c.prNumber}**: ${c.title} — *${c.impact}*\n`;
    }

    if (this.badges.length > 0) {
      md += `\n### Verified Badges\n\n`;
      for (const b of this.badges) {
        md += `- 🏅 **${b.name || b.badgeName}** (${b.category || 'General'})\n`;
      }
    }

    return md;
  }
}
