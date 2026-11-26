/**
 * Multi-Modal Accessibility Audit Agents (#1177)
 *
 * Implements complementary specialized audit agents:
 * 1. Keyboard Navigation & Focus Trap Agent
 * 2. Screen-Reader Semantics & ARIA Agent
 * 3. Color Contrast & Visual Perception Agent
 * 4. Plain Language & Clarity Agent (Regional/Civic forms)
 * 5. Mobile Layout & Touch Target Agent (Mobile-first civic interfaces)
 */

import {
  AGENT_MODALITIES,
  FINDING_SEVERITY,
  WCAG_LEVEL,
  createCanonicalFinding
} from './swarmSchemas.js';

/**
 * 1. Keyboard Agent: Audits focusability, tab order, focus indicators, and traps
 */
export class KeyboardAccessibilityAgent {
  constructor() {
    this.modality = AGENT_MODALITIES.KEYBOARD;
  }

  /**
   * Run deterministic keyboard accessibility audit against DOM
   * @param {Object} target { domSnapshot, doc (optional DOM document) }
   * @returns {Promise<Array<Object>>}
   */
  async audit(target) {
    const findings = [];
    const html = target.domSnapshot || '';

    // Deterministic check: missing tabindex or negative tabindex on interactive elements
    // E.g. div with onClick but no role/tabindex
    const divButtons = html.match(/<div[^>]*onclick[^>]*>/gi) || [];
    divButtons.forEach((snippet, idx) => {
      if (!/role=["']button["']/i.test(snippet) || !/tabindex=/i.test(snippet)) {
        findings.push(createCanonicalFinding({
          modality: this.modality,
          ruleId: 'keyboard.non_focusable_interactive',
          wcagCriterion: '2.1.1 Keyboard',
          wcagLevel: WCAG_LEVEL.A,
          severity: FINDING_SEVERITY.HIGH,
          title: 'Interactive <div> lacking keyboard focus and button role',
          description: 'A clickable div was found without tabindex="0" and role="button". Keyboard-only users cannot activate it.',
          domSelector: `div[onclick]:nth-of-type(${idx + 1})`,
          domSnippet: snippet.slice(0, 200),
          remedyRecommendation: 'Convert to a native <button> or add role="button" and tabindex="0" with an Enter/Space key listener.',
          isSubjective: false,
          provenance: { generator: 'deterministic_keyboard_rule_engine' }
        }));
      }
    });

    // Check for explicit positive tabindex (> 0) which disrupts natural DOM reading order
    const positiveTabindex = html.match(/tabindex=["']([1-9]\d*)["']/gi) || [];
    if (positiveTabindex.length > 0) {
      findings.push(createCanonicalFinding({
        modality: this.modality,
        ruleId: 'keyboard.positive_tabindex',
        wcagCriterion: '2.4.3 Focus Order',
        wcagLevel: WCAG_LEVEL.A,
        severity: FINDING_SEVERITY.MEDIUM,
        title: 'Disruptive positive tabindex attribute detected',
        description: `Found ${positiveTabindex.length} elements with positive tabindex. This forces an unnatural focus navigation order.`,
        domSelector: '[tabindex]:not([tabindex="-1"]):not([tabindex="0"])',
        domSnippet: positiveTabindex[0],
        remedyRecommendation: 'Use tabindex="0" to insert into natural order, or reorder elements naturally in the DOM.',
        isSubjective: false,
        provenance: { generator: 'deterministic_keyboard_rule_engine' }
      }));
    }

    // Check for focus: outline: none without fallback
    if (/outline:\s*0|outline:\s*none/i.test(html) && !/focus-visible/i.test(html)) {
      findings.push(createCanonicalFinding({
        modality: this.modality,
        ruleId: 'keyboard.outline_none_suppressed',
        wcagCriterion: '2.4.7 Focus Visible',
        wcagLevel: WCAG_LEVEL.AA,
        severity: FINDING_SEVERITY.HIGH,
        title: 'Focus outlines suppressed without visible fallback',
        description: 'CSS rules suppress focus outlines (outline: none or outline: 0), making keyboard navigation invisible.',
        domSelector: 'style, [style*="outline"]',
        domSnippet: 'style containing outline: none',
        remedyRecommendation: 'Provide high-contrast focus rings using :focus-visible { outline: 2px solid var(--civic-focus-ring); }',
        isSubjective: false,
        provenance: { generator: 'deterministic_keyboard_rule_engine' }
      }));
    }

    return findings;
  }
}

/**
 * 2. Screen Reader Semantics & ARIA Agent
 */
export class ScreenReaderSemanticsAgent {
  constructor() {
    this.modality = AGENT_MODALITIES.SCREEN_READER;
  }

  async audit(target) {
    const findings = [];
    const html = target.domSnapshot || '';

    // Missing alt attributes on <img>
    const imgTags = html.match(/<img[^>]*>/gi) || [];
    imgTags.forEach((img, idx) => {
      if (!/alt=["'][^"']*["']/i.test(img)) {
        findings.push(createCanonicalFinding({
          modality: this.modality,
          ruleId: 'aria.missing_img_alt',
          wcagCriterion: '1.1.1 Non-text Content',
          wcagLevel: WCAG_LEVEL.A,
          severity: FINDING_SEVERITY.CRITICAL,
          title: 'Image missing required alt attribute',
          description: 'An image element lacks an alt attribute, causing screen readers to announce the raw filename or URL.',
          domSelector: `img:nth-of-type(${idx + 1})`,
          domSnippet: img.slice(0, 200),
          remedyRecommendation: 'Add an informative alt="descriptive text" attribute or alt="" if purely decorative.',
          isSubjective: false,
          provenance: { generator: 'deterministic_aria_rule_engine' }
        }));
      }
    });

    // Inputs missing labels
    const inputs = html.match(/<input(?![^>]*type=["'](?:hidden|submit|button|reset)["'])[^>]*>/gi) || [];
    inputs.forEach((input, idx) => {
      const hasAriaLabel = /aria-label=["'][^"']+["']/i.test(input);
      const hasAriaLabelledby = /aria-labelledby=["'][^"']+["']/i.test(input);
      const hasId = /id=["']([^"']+)["']/i.test(input);
      let hasAssociatedLabel = false;

      if (hasId) {
        const idMatch = input.match(/id=["']([^"']+)["']/i);
        const inputId = idMatch ? idMatch[1] : '';
        const labelRegex = new RegExp(`<label[^>]*for=["']${inputId}["'][^>]*>`, 'i');
        hasAssociatedLabel = labelRegex.test(html);
      }

      if (!hasAriaLabel && !hasAriaLabelledby && !hasAssociatedLabel) {
        findings.push(createCanonicalFinding({
          modality: this.modality,
          ruleId: 'aria.unlabeled_input',
          wcagCriterion: '4.1.2 Name, Role, Value',
          wcagLevel: WCAG_LEVEL.A,
          severity: FINDING_SEVERITY.HIGH,
          title: 'Form input control lacks programmatic label',
          description: 'A civic form input does not have an associated <label for="...">, aria-label, or aria-labelledby.',
          domSelector: `input:nth-of-type(${idx + 1})`,
          domSnippet: input.slice(0, 200),
          remedyRecommendation: 'Provide a visible <label for="inputId"> or aria-label detailing the required information.',
          isSubjective: false,
          provenance: { generator: 'deterministic_aria_rule_engine' }
        }));
      }
    });

    // Check for missing lang declaration on <html>
    if (html.includes('<html') && !/<html[^>]*lang=["'][^"']+["']/i.test(html)) {
      findings.push(createCanonicalFinding({
        modality: this.modality,
        ruleId: 'aria.missing_html_lang',
        wcagCriterion: '3.1.1 Language of Page',
        wcagLevel: WCAG_LEVEL.A,
        severity: FINDING_SEVERITY.MEDIUM,
        title: 'Missing lang attribute on <html> element',
        description: 'The root html element has no lang attribute (e.g. lang="en" or lang="hi"), confusing text-to-speech synthesizers.',
        domSelector: 'html',
        domSnippet: '<html ...>',
        remedyRecommendation: 'Specify primary document language, e.g. <html lang="en"> or <html lang="hi">.',
        isSubjective: false,
        provenance: { generator: 'deterministic_aria_rule_engine' }
      }));
    }

    return findings;
  }
}

/**
 * 3. Color Contrast & Visual Perception Agent
 */
export class ContrastAccessibilityAgent {
  constructor() {
    this.modality = AGENT_MODALITIES.CONTRAST;
  }

  /**
   * Calculates relative luminance of RGB
   */
  getLuminance(r, g, b) {
    const a = [r, g, b].map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  }

  /**
   * Calculates contrast ratio between two luminance values
   */
  getContrastRatio(lum1, lum2) {
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
  }

  async audit(target) {
    const findings = [];
    const html = target.domSnapshot || '';

    // Scan for low-contrast hex colors inline or common bad combos
    // e.g., #888888 or #999999 or #aaa on white (#ffffff)
    const grayOnWhiteRegex = /color:\s*(?:#999(?:999)?|#aaa(?:aaa)?|#bbb(?:bbb)?|#ccc(?:ccc)?|#888(?:888)?)/gi;
    const matches = html.match(grayOnWhiteRegex) || [];

    if (matches.length > 0) {
      findings.push(createCanonicalFinding({
        modality: this.modality,
        ruleId: 'contrast.insufficient_body_text',
        wcagCriterion: '1.4.3 Contrast (Minimum)',
        wcagLevel: WCAG_LEVEL.AA,
        severity: FINDING_SEVERITY.HIGH,
        title: 'Low contrast text detected (below 4.5:1 ratio)',
        description: `Found ${matches.length} elements using light gray text (#888-#ccc). On white backgrounds, this yields ~2.5:1 to 3.5:1, failing WCAG AA (4.5:1).`,
        domSelector: '[style*="color:"]',
        domSnippet: matches[0],
        remedyRecommendation: 'Darken text color to at least #595959 (or #4b5563) to achieve a 4.5:1 contrast ratio against white.',
        isSubjective: false,
        provenance: { generator: 'deterministic_contrast_calculator' }
      }));
    }

    return findings;
  }
}

/**
 * 4. Language Clarity & Reading Level Agent
 * Note: Subjective observations are tagged as UNVERIFIED suggestions
 */
export class LanguageClarityAgent {
  constructor() {
    this.modality = AGENT_MODALITIES.LANGUAGE_CLARITY;
  }

  async audit(target) {
    const findings = [];
    const html = target.domSnapshot || '';

    // Strip HTML tags to inspect prose
    const textOnly = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

    // Scan for complex bureaucratic jargon / dense legalese without plain explanation
    const jargonWords = [
      'inter alia',
      'heretofore',
      'mutatis mutandis',
      'notwithstanding',
      'indemnification',
      'ipso facto'
    ];

    const detectedJargon = jargonWords.filter(jargon =>
      new RegExp(`\\b${jargon}\\b`, 'i').test(textOnly)
    );

    if (detectedJargon.length > 0) {
      findings.push(createCanonicalFinding({
        modality: this.modality,
        ruleId: 'clarity.bureaucratic_jargon',
        wcagCriterion: '3.1.5 Reading Level',
        wcagLevel: WCAG_LEVEL.AAA,
        severity: FINDING_SEVERITY.LOW,
        title: 'Complex bureaucratic jargon found in public citizen instructions',
        description: `Found legalese/jargon (${detectedJargon.join(', ')}) that impedes reading comprehension for everyday citizens.`,
        domSelector: 'p, span, .description',
        domSnippet: detectedJargon.join(', '),
        remedyRecommendation: 'Replace archaic legal terminology with conversational plain language, e.g. "among other things" instead of "inter alia".',
        isSubjective: true, // Marked as subjective suggestion requiring maintainer approval
        provenance: {
          generator: 'language_clarity_analyzer',
          modelUsed: 'heuristic_civic_readability_v1',
          confidence: 0.85
        }
      }));
    }

    // Check sentence length complexity (sentences > 40 words)
    const longSentences = textOnly.split(/[.?!]/).filter(s => s.trim().split(/\s+/).length > 40);
    if (longSentences.length > 0) {
      findings.push(createCanonicalFinding({
        modality: this.modality,
        ruleId: 'clarity.overly_long_sentences',
        wcagCriterion: '3.1.5 Reading Level',
        wcagLevel: WCAG_LEVEL.AAA,
        severity: FINDING_SEVERITY.LOW,
        title: 'Long, complex sentence structure detected',
        description: `Detected ${longSentences.length} sentence(s) with over 40 words, which creates high cognitive load.`,
        domSelector: 'p',
        domSnippet: longSentences[0].trim().slice(0, 150) + '...',
        remedyRecommendation: 'Break compound sentences into shorter bullet points or concise 15-20 word statements.',
        isSubjective: true,
        provenance: {
          generator: 'language_clarity_analyzer',
          confidence: 0.8
        }
      }));
    }

    return findings;
  }
}

/**
 * 5. Mobile Layout & Touch Target Agent
 */
export class MobileLayoutAgent {
  constructor() {
    this.modality = AGENT_MODALITIES.MOBILE_LAYOUT;
  }

  async audit(target) {
    const findings = [];
    const html = target.domSnapshot || '';
    const viewport = target.viewport || { width: 375, height: 667 };

    // Viewport meta tag check
    if (html.includes('<html') || html.includes('<head')) {
      const hasViewport = /<meta[^>]*name=["']viewport["'][^>]*>/i.test(html);
      if (!hasViewport) {
        findings.push(createCanonicalFinding({
          modality: this.modality,
          ruleId: 'mobile.missing_viewport_meta',
          wcagCriterion: '1.4.10 Reflow',
          wcagLevel: WCAG_LEVEL.AA,
          severity: FINDING_SEVERITY.CRITICAL,
          title: 'Missing responsive viewport meta tag',
          description: 'Document lacks <meta name="viewport" content="width=device-width, initial-scale=1">, causing mobile browsers to render in desktop emulation mode.',
          domSelector: 'head',
          domSnippet: '<head>...</head>',
          remedyRecommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1.0"> to <head>.',
          isSubjective: false,
          provenance: { generator: 'deterministic_mobile_rule_engine' }
        }));
      }

      // Check for user-scalable=no or maximum-scale=1.0
      if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:\.0)?\b/i.test(html)) {
        findings.push(createCanonicalFinding({
          modality: this.modality,
          ruleId: 'mobile.zoom_disabled',
          wcagCriterion: '1.4.4 Resize Text',
          wcagLevel: WCAG_LEVEL.AA,
          severity: FINDING_SEVERITY.HIGH,
          title: 'Pinch-to-zoom disabled in viewport meta',
          description: 'The viewport meta tag disables pinch-to-zoom (user-scalable=no or maximum-scale=1.0), blocking low-vision users from magnifying content.',
          domSelector: 'meta[name="viewport"]',
          domSnippet: html.match(/<meta[^>]*name=["']viewport["'][^>]*>/i)?.[0] || 'meta viewport',
          remedyRecommendation: 'Remove user-scalable=no and allow magnification up to at least 200%.',
          isSubjective: false,
          provenance: { generator: 'deterministic_mobile_rule_engine' }
        }));
      }
    }

    // Small touch target warnings: buttons or links with explicit small dimensions < 44px
    const smallTargets = html.match(/(?:width|height):\s*(?:[1-3][0-9]|4[0-3]|[1-9])px/gi) || [];
    if (smallTargets.length > 0 && /<button|<a /i.test(html)) {
      findings.push(createCanonicalFinding({
        modality: this.modality,
        ruleId: 'mobile.undersized_touch_target',
        wcagCriterion: '2.5.5 Target Size',
        wcagLevel: WCAG_LEVEL.AAA,
        severity: FINDING_SEVERITY.MEDIUM,
        title: 'Interactive target smaller than 44x44px minimum',
        description: 'Interactive button or link styles specify dimensions under 44px, making accurate tapping difficult on mobile devices.',
        domSelector: 'button, a, input[type="button"]',
        domSnippet: smallTargets[0],
        remedyRecommendation: 'Ensure min-height and min-width are at least 44px (or 48px for Android Material standards).',
        isSubjective: false,
        provenance: { generator: 'deterministic_mobile_rule_engine' }
      }));
    }

    return findings;
  }
}
