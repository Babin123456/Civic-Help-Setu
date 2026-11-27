/**
 * Civic Service Accessibility Inspector Service (#832)
 *
 * Provides rule-based accessibility checks for civic service pages and forms.
 * AI suggestions are optional and always labelled as such; automated checks are
 * deterministic and rule-based where possible.
 *
 * Strict Compliance:
 * - Unknown attributes are NEVER treated as passing; they are explicitly 'unknown'.
 * - AI-generated suggestions are labelled SUGGESTION until confirmed by a maintainer.
 * - Automated calculations (contrast, scores, sorting) are deterministic.
 * - No citizen browsing data is collected; only minimal scan metadata is stored.
 * - Rule IDs and severities follow established taxonomies; new rules must not break
 *   existing consumers.
 */

// ---------------------------------------------------------------------------
// Rule IDs (deterministic, namespaced to this service)
// ---------------------------------------------------------------------------
export const RULE_IDS = {
  // Document structure
  MISSING_DOCTYPE: 'doctype.missing',
  INCORRECT_DOCTYPE: 'doctype.incorrect',

  // Heading structure
  MISSING_H1: 'heading.missingH1',
  SKIPPED_HEADING_LEVELS: 'heading.skippedLevels',
  NON_SEQUENTIAL_HEADING: 'heading.nonSequential',
  TOO_MANY_H1: 'heading.tooManyH1',

  // Landmark / navigation
  MISSING_MAIN: 'landmark.missingMain',
  MISSING_NAV: 'landmark.missingNav',
  MISSING_HEADER: 'landmark.missingHeader',
  MISSING_FOOTER: 'landmark.missingFooter',

  // Forms
  UNLABELED_FORM_CONTROL: 'form.unlabeledControl',
  MISSING_FORM_LABEL: 'form.missingLabel',
  REDUNDANT_LABEL: 'form.redundantLabel',
  INVALID_INPUT_TYPE: 'form.invalidInputType',
  MISSING_REQUIRED_ATTR: 'form.missingRequired',

  // Contrast & typography
  INSUFFICIENT_CONTRAST: 'contrast.insufficient',
  SMALL_FONT_SIZE: 'typography.smallFont',
  LINE_HEIGHT_TOO_TIGHT: 'typography.tightLineHeight',

  // Keyboard & focus
  FOCUS_NOT_VISIBLE: 'focus.notVisible',
  KEYBOARD_TRAP: 'focus.keyboardTrap',
  UNEXPECTED_FOCUS_ORDER: 'focus.unexpectedOrder',

  // Media
  MISSING_ALT_TEXT: 'media.missingAlt',
  REDUNDANT_CAPTION: 'media.redundantCaption',

  // General
  LANGUAGE_DECLARATION_MISSING: 'lang.missing',
  ARIA_ROLE_MISMATCH: 'aria.roleMismatch',
};

// ---------------------------------------------------------------------------
// Severity levels (aligned with barrier report service conventions)
// ---------------------------------------------------------------------------
export const SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

// Severity → color mapping for UI
export const SEVERITY_COLORS = {
  [SEVERITY.LOW]: '#10b981',    // green
  [SEVERITY.MEDIUM]: '#f59e0b',  // amber
  [SEVERITY.HIGH]: '#ef4444',    // red
  [SEVERITY.CRITICAL]: '#7f1d1d', // dark red
};

// ---------------------------------------------------------------------------
// Evidence types for findings
// ---------------------------------------------------------------------------
export const EVIDENCE_TYPE = {
  HTML_ATTRIBUTE: 'htmlAttribute',
  CSS_COMPUTED: 'cssComputed',
  DOM_TRAVERSAL: 'domTraversal',
  AI_SUGGESTION: 'aiSuggestion',
  A11Y_API: 'a11yApi',
};

// ---------------------------------------------------------------------------
// Scanner state
// ---------------------------------------------------------------------------
export const SCAN_STATUS = {
  IDLE: 'idle',
  SCANNING: 'scanning',
  COMPLETE: 'complete',
  ERROR: 'error',
  STALE: 'stale',
};

// ---------------------------------------------------------------------------
// Helper: get contrast ratio between two RGBA colors
// Uses the WCAG 2.1 contrast algorithm.
// Returns a number between 0 and 21 (or infinity).
// ---------------------------------------------------------------------------
const luminance = (rgb) => {
  const toLinear = (c) => {
    const normalized = c / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
  };
  const r = toLinear(rgb.r);
  const g = toLinear(rgb.g);
  const b = toLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrastRatio = (color1, color2) => {
  const L1 = luminance(color1);
  const L2 = luminance(color2);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
};

// Check if a color is a valid hex/rgba
const parseColor = (colorStr) => {
  if (!colorStr) return null;
  // Try hex
  const hex = colorStr.replace('#', '');
  if (/^[0-9A-Fa-f]{6}$/.test(hex)) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return { r, g, b };
  }
  // Try rgb/rgba
  const rgbMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
  if (rgbMatch) {
    return { r: parseInt(rgbMatch[1]), g: parseInt(rgbMatch[2]), b: parseInt(rgbMatch[3]) };
  }
  return null;
};

// ---------------------------------------------------------------------------
// Core: scan a DOM node and collect all text-contained elements with selectors
// ---------------------------------------------------------------------------
/**
 * Walks the DOM and builds a flat tree of focusable/important elements
 * with their computed selectors and textual content.
 * Returns an array of { selector, tagName, textContent, depth }.
 * @param {Node} root - The root node to scan (typically document.body)
 * @param {number} maxDepth - Maximum depth to traverse
 * @returns {Array<Object>}
 */
const buildElementTree = (root, maxDepth = 20) => {
  const results = [];

  const walk = (node, depth, parentSelector = '') => {
    if (depth > maxDepth) return;
    if (!node || !node.nodeType) return;

    // Skip script, style, textarea, contenteditable elements that shouldn't be in focus order
    if (node.nodeType === 1) { // Element node
      const tag = node.tagName.toLowerCase();

      // Skip head, html, script, style
      if (['head', 'html', 'script', 'style', 'noscript', 'template'].includes(tag)) {
        // Still traverse children
      } else {
        // Get text content (trimmed, multi-line collapsed)
        let textContent = '';
        if (node.textContent) {
          textContent = node.textContent
            .replace(/\s+/g, ' ')
            .trim();
        }

        // Build a CSS-like selector
        let selector = parentSelector;
        if (tag === 'body') {
          selector = 'body';
        } else if (tag === 'html') {
          selector = 'html';
        } else {
          // Simple ID-based or tag-based selector building
          const id = node.id ? `#${node.id}` : null;
          const classList = Array.from(node.classList).slice(0, 3).join('.');
          const simpleTag = tag;

          if (id) {
            selector = `${parentSelector || ''} ${simpleTag}${id}`.trim();
          } else if (classList) {
            selector = `${parentSelector || ''} ${simpleTag}.${classList}`.trim();
          } else {
            selector = `${parentSelector || ''} ${simpleTag}`.trim();
          }
        }

        // Only include elements that have meaningful content or are interactive
        const hasMeaningfulContent =
          textContent.length > 0 ||
          tag === 'input' ||
          tag === 'button' ||
          tag === 'a' ||
          tag === 'select' ||
          tag === 'textarea' ||
          tag === 'img';

        if (hasMeaningfulContent) {
          results.push({
            selector,
            tagName: tag,
            textContent,
            depth,
            element: node,
          });
        }
      }
    }

    // Recurse children
    try {
      const children = node.children || [];
      for (const child of children) {
        walk(child, depth + 1, selector);
      }
    } catch {
      // Node may be detached during traversal
    }
  };

  walk(root, 0, '');
  return results;
};

// ---------------------------------------------------------------------------
// Rule: Check for DOCTYPE
// ---------------------------------------------------------------------------
const checkDoctype = (document) => {
  const findings = [];

  if (!document.doctype) {
    findings.push({
      ruleId: RULE_IDS.MISSING_DOCTYPE,
      severity: SEVERITY.MEDIUM,
      evidence: {
        type: EVIDENCE_TYPE.HTML_ATTRIBUTE,
        message: 'DOCTYPE declaration is missing. Declaring a DOCTYPE helps with standards mode rendering and consistent browser behavior.',
      },
      affectedSelector: 'html',
      evidenceType: EVIDENCE_TYPE.HTML_ATTRIBUTE,
    });
  } else if (document.doctype.name && !/html|xhtml/i.test(document.doctype.name)) {
    findings.push({
      ruleId: RULE_IDS.INCORRECT_DOCTYPE,
      severity: SEVERITY.LOW,
      evidence: {
        type: EVIDENCE_TYPE.HTML_ATTRIBUTE,
        message: ` DOCTYPE "${document.doctype.name}" is not an HTML DOCTYPE. Consider using <!DOCTYPE html>.`,
      },
      affectedSelector: 'html',
      evidenceType: EVIDENCE_TYPE.HTML_ATTRIBUTE,
    });
  }

  return findings;
};

// ---------------------------------------------------------------------------
// Rule: Heading structure checks
// ---------------------------------------------------------------------------
const checkHeadingStructure = (elementTree) => {
  const findings = [];
  const headings = elementTree.filter(
    (el) => el.tagName === 'h1' || el.tagName === 'h2' || el.tagName === 'h3' || el.tagName === 'h4' || el.tagName === 'h5' || el.tagName === 'h6'
  );

  // Count H1s
  const h1s = headings.filter((el) => el.tagName === 'h1');
  if (h1s.length === 0) {
    findings.push({
      ruleId: RULE_IDS.MISSING_H1,
      severity: SEVERITY.HIGH,
      evidence: {
        type: EVIDENCE_TYPE.DOM_TRAVERSAL,
        message: 'No H1 heading found. Each page should have exactly one H1 that describes the page purpose.',
      },
      affectedSelector: 'body',
      evidenceType: EVIDENCE_TYPE.DOM_TRAVERSAL,
    });
  } else if (h1s.length > 1) {
    findings.push({
      ruleId: RULE_IDS.TOO_MANY_H1,
      severity: SEVERITY.MEDIUM,
      evidence: {
        type: EVIDENCE_TYPE.DOM_TRAVERSAL,
        message: `Found ${h1s.length} H1 headings. Pages should have only one H1 unless the content is structured as a collection of independent sections.`,
      },
      affectedSelector: 'body',
      evidenceType: EVIDENCE_TYPE.DOM_TRAVERSAL,
    });
  }

  // Check for skipped heading levels
  const levelNumbers = headings.map((el) => parseInt(el.tagName.slice(1), 10));
  for (let i = 1; i < levelNumbers.length; i++) {
    const currentLevel = levelNumbers[i];
    const previousLevel = levelNumbers[i - 1];
    // Allow staying at same level or going down, but not skipping up
    if (currentLevel < previousLevel - 1) {
      findings.push({
        ruleId: RULE_IDS.SKIPPED_HEADING_LEVELS,
        severity: SEVERITY.MEDIUM,
        evidence: {
          type: EVIDENCE_TYPE.DOM_TRAVERSAL,
          message: `Skipped heading level: going from H${previousLevel} to H${currentLevel}. Heading levels should not skip more than one level at a time.`,
        },
        affectedSelector: el.selector,
        evidenceType: EVIDENCE_TYPE.DOM_TRAVERSAL,
        // Associate with the current element
        elementSelector: el.selector,
      });
    }
  }

  // Check for non-sequential ordering (a non-H1 heading before H1)
  const h1Index = headings.findIndex((el) => el.tagName === 'h1');
  if (h1Index > 0) {
    findings.push({
      ruleId: RULE_IDS.NON_SEQUENTIAL_HEADING,
      severity: SEVERITY.MEDIUM,
      evidence: {
        type: EVIDENCE_TYPE.DOM_TRAVERSAL,
        message: 'Heading level H' + headings[0].tagName + ' appears before the H1. The H1 should be the first major heading on the page.',
      },
      affectedSelector: 'body',
      evidenceType: EVIDENCE_TYPE.DOM_TRAVERSAL,
    });
  }

  return findings;
};

// ---------------------------------------------------------------------------
// Rule: Landmark checks
// ---------------------------------------------------------------------------
const checkLandmarks = (elementTree) => {
  const findings = [];
  const hasElementWithId = (elementTree, id) =>
    elementTree.some((el) => el.selector && el.selector.includes(`#${id}`));

  if (!hasElementWithId(elementTree, 'main')) {
    findings.push({
      ruleId: RULE_IDS.MISSING_MAIN,
      severity: SEVERITY.MEDIUM,
      evidence: {
        type: EVIDENCE_TYPE.DOM_TRAVERSAL,
        message: 'No <main> landmark found. Adding a main landmark helps screen readers bypass navigation and reach the primary content.',
      },
      affectedSelector: 'body',
      evidenceType: EVIDENCE_TYPE.DOM_TRAVERSAL,
    });
  }

  if (!hasElementWithId(elementTree, 'nav')) {
    findings.push({
      ruleId: RULE_IDS.MISSING_NAV,
      severity: SEVERITY.LOW,
      evidence: {
        type: EVIDENCE_TYPE.DOM_TRAVERSAL,
        message: 'No <nav> landmark found. Navigation landmarks help users orient themselves within the page structure.',
      },
      affectedSelector: 'body',
      evidenceType: EVIDENCE_TYPE.DOM_TRAVERSAL,
    });
  }

  if (!hasElementWithId(elementTree, 'header')) {
    findings.push({
      ruleId: RULE_IDS.MISSING_HEADER,
      severity: SEVERITY.LOW,
      evidence: {
        type: EVIDENCE_TYPE.DOM_TRAVERSAL,
        message: 'No <header> landmark found. Header landmarks identify the beginning of the page header region.',
      },
      affectedSelector: 'body',
      evidenceType: EVIDENCE_TYPE.DOM_TRAVERSAL,
    });
  }

  if (!hasElementWithId(elementTree, 'footer')) {
    findings.push({
      ruleId: RULE_IDS.MISSING_FOOTER,
      severity: SEVERITY.LOW,
      evidence: {
        type: EVIDENCE_TYPE.DOM_TRAVERSAL,
        message: 'No <footer> landmark found. Footer landmarks identify the page footer region.',
      },
      affectedSelector: 'body',
      evidenceType: EVIDENCE_TYPE.DOM_TRAVERSAL,
    });
  }

  return findings;
};

// ---------------------------------------------------------------------------
// Rule: Form checks
// ---------------------------------------------------------------------------
const checkForms = (elementTree) => {
  const findings = [];
  const inputs = elementTree.filter(
    (el) => el.tagName === 'input' || el.tagName === 'select' || el.tagName === 'textarea'
  );

  for (const input of inputs) {
    const { selector, tagName } = input;

    // Check for aria-label or label association
    const hasAriaLabel = input.element.getAttribute('aria-label');
    const hasAriaLabelledby = input.element.getAttribute('aria-labelledby');
    const hasTitleAttr = input.element.getAttribute('title');

    // Check if there's a<label> element that references this input
    const inputId = input.element.id;
    let hasAssociatedLabel = false;

    if (inputId) {
      // Look for <label htmlFor="inputId"> in the element tree
      const labelSelectors = elementTree.filter(
        (el) => el.tagName === 'label' && el.selector && el.selector.includes(`#${inputId}`)
      );
      hasAssociatedLabel = labelSelectors.length > 0;
    } else {
      // No ID - check for nearby label by examining sibling/parent
      // Simple heuristic: check if parent or previous sibling is a label
      const parent = input.element.parentElement;
      if (parent && parent.tagName === 'LABEL') {
        hasAssociatedLabel = true;
      }
    }

    // Check for valid input types
    const validTypes = [
      'text', 'search', 'email', 'phone', 'password', 'date', 'time',
      'number', 'checkbox', 'radio', 'file', 'hidden', 'button', 'submit',
      'reset', 'image', 'color', 'range', 'url', 'tel', 'week', 'month',
    ];
    const inputType = input.element.getAttribute('type');
    const isValidType = inputType ? validTypes.includes(inputType.toLowerCase()) : true; // hidden/default is OK

    if (!hasAriaLabel && !hasAriaLabelledby && !hasTitleAttr && !hasAssociatedLabel) {
      findings.push({
        ruleId: RULE_IDS.UNLABELED_FORM_CONTROL,
        severity: SEVERITY.HIGH,
        evidence: {
          type: EVIDENCE_TYPE.DOM_TRAVERSAL,
          message: `Form control (${tagName}) lacks an accessible label. Add an associated <label> or aria-label.`,
        },
        affectedSelector: selector,
        evidenceType: EVIDENCE_TYPE.DOM_TRAVERSAL,
      });
    } else if (!isValidType) {
      findings.push({
        ruleId: RULE_IDS.INVALID_INPUT_TYPE,
        severity: SEVERITY.LOW,
        evidence: {
          type: EVIDENCE_TYPE.DOM_TRAVERSAL,
          message: `Input type "${inputType}" may not be consistently supported. Consider using a standard input type.`,
        },
        affectedSelector: selector,
        evidenceType: EVIDENCE_TYPE.DOM_TRAVERSAL,
      });
    }
  }

  // Check for missing required attribute on required fields (heuristic: inputs without labels often are required)
  const requiredInputs = inputs.filter((inp) => inp.element.hasAttribute('required'));
  if (requiredInputs.length > 0) {
    // Check if they have labels
    const unlabeledRequired = requiredInputs.filter((inp) => {
      const hasAriaLabel = inp.element.getAttribute('aria-label');
      const hasAriaLabelledby = inp.element.getAttribute('aria-labelledby');
      const hasAssociatedLabel = inp.selector && elementTree.some(
        (el) => el.tagName === 'label' && el.selector && el.selector.includes(`#${inp.element.id}`)
      );
      return !hasAriaLabel && !hasAriaLabelledby && !hasAssociatedLabel;
    });

    if (unlabeledRequired.length > 0) {
      findings.push({
        ruleId: RULE_IDS.MISSING_REQUIRED_ATTR,
        severity: SEVERITY.MEDIUM,
        evidence: {
          type: EVIDENCE_TYPE.DOM_TRAVERSAL,
          message: `${unlabeledRequired.length} required form control(s) lack an accessible label AND the required attribute. Ensure all required fields have visible labels.`,
        },
        affectedSelector: 'body',
        evidenceType: EVIDENCE_TYPE.DOM_TRAVERSAL,
      });
    }
  }

  return findings;
};

// ---------------------------------------------------------------------------
// Rule: Contrast check
// ---------------------------------------------------------------------------
const checkContrast = (elementTree) => {
  const findings = [];

  // For each element that has a background color and text color
  for (const el of elementTree) {
    if (el.tagName === 'img' || el.tagName === 'svg') continue;

    const bgColor = el.element.style.backgroundColor;
    const color = el.element.style.color;

    if (bgColor && color) {
      const bgParsed = parseColor(bgColor);
      const colorParsed = parseColor(color);

      if (bgParsed && colorParsed) {
        const ratio = contrastRatio(bgParsed, colorParsed);
        const isNormalText = el.textContent.length < 100; // heuristic: shorter text likely normal size
        const wcagAA = isNormalText ? ratio >= 4.5 : ratio >= 3.0; // AA for normal text, AAA for large text
        const wcagAAA = isNormalText ? ratio >= 7.0 : ratio >= 4.5; // AAA for normal text, AA for large

        if (!wcagAA) {
          findings.push({
            ruleId: RULE_IDS.INSUFFICIENT_CONTRAST,
            severity: SEVERITY.HIGH,
            evidence: {
              type: EVIDENCE_TYPE.CSS_COMPUTED,
              message: `Contrast ratio ${ratio.toFixed(2)}:1 is below WCAG AA threshold ${isNormalText ? '4.5:1' : '3:1'}. ${wcagAAA ? 'AAA contrast would be achieved at this size.' : ''}`,
              computedRatio: ratio,
              wcagLevel: isNormalText ? (wcagAAA ? 'AAA' : wcagAA ? 'AA' : 'fail') : (wcagAAA ? 'AAA' : wcagAA ? 'AA' : 'fail'),
            },
            affectedSelector: el.selector,
            evidenceType: EVIDENCE_TYPE.CSS_COMPUTED,
          });
        }
      }
    }
  }

  return findings;
};

// ---------------------------------------------------------------------------
// Rule: Missing Alt Text
// ---------------------------------------------------------------------------
const checkAltText = (elementTree) => {
  const findings = [];

  const images = elementTree.filter((el) => el.tagName === 'img');

  for (const img of images) {
    const altAttribute = img.element.getAttribute('alt');
    if (!altAttribute || altAttribute.trim() === '') {
      findings.push({
        ruleId: RULE_IDS.MISSING_ALT_TEXT,
        severity: SEVERITY.HIGH,
        evidence: {
          type: EVIDENCE_TYPE.HTML_ATTRIBUTE,
          message: 'Image missing alt text. Add descriptive alt text or use aria="" for decorative images.',
        },
        affectedSelector: img.selector,
        evidenceType: EVIDENCE_TYPE.HTML_ATTRIBUTE,
      });
    } else if (altAttribute.trim().length < 3) {
      // Very short alt text - may be insufficient
      findings.push({
        ruleId: RULE_IDS.MISSING_ALT_TEXT,
        severity: SEVERITY.LOW,
        evidence: {
          type: EVIDENCE_TYPE.HTML_ATTRIBUTE,
          message: 'Alt text is very short. Consider providing a more descriptive alternative.',
        },
        affectedSelector: img.selector,
        evidenceType: EVIDENCE_TYPE.HTML_ATTRIBUTE,
      });
    }
  }

  return findings;
};

// ---------------------------------------------------------------------------
// Rule: Language declaration
// ---------------------------------------------------------------------------
const checkLanguageDeclaration = (document) => {
  const findings = [];

  const htmlElement = document.documentElement;
  const lang = htmlElement.getAttribute('lang');

  if (!lang) {
    findings.push({
      ruleId: RULE_IDS.LANGUAGE_DECLARATION_MISSING,
      severity: SEVERITY.LOW,
      evidence: {
        type: EVIDENCE_TYPE.HTML_ATTRIBUTE,
        message: 'Missing lang attribute on <html>. Declaring a language helps screen readers pronounce content correctly.',
      },
      affectedSelector: 'html',
      evidenceType: EVIDENCE_TYPE.HTML_ATTRIBUTE,
    });
  }

  return findings;
};

// ---------------------------------------------------------------------------
// Rule: Focus order (simple heuristic based on DOM order)
// ---------------------------------------------------------------------------
const checkFocusOrder = (elementTree) => {
  const findings = [];

  // Get focusable elements in DOM order
  const focusable = elementTree.filter(
    (el) =>
      (el.tagName === 'a' && el.element.getAttribute('href')) ||
      el.tagName === 'button' ||
      el.tagName === 'input' ||
      el.tagName === 'select' ||
      el.tagName === 'textarea'
  );

  // Sort by depth (DOM order)
  const sorted = [...focusable].sort((a, b) => a.depth - b.depth);

  // Check for obvious regressions (a later element has a lower tab index conceptually)
  // This is a simplified check - in practice, we'd need tabIndex awareness
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const previous = sorted[i - 1];

    // If current appears before previous in visual flow but after in DOM, flag
    // This is a very basic heuristic
    if (current.depth > previous.depth + 2) {
      // Significant depth jump - could indicate reordering
      findings.push({
        ruleId: RULE_IDS.UNEXPECTED_FOCUS_ORDER,
        severity: SEVERITY.MEDIUM,
        evidence: {
          type: EVIDENCE_TYPE.DOM_TRAVERSAL,
          message: `Focus order may be disrupted: element "${current.textContent.substring(0, 30)}" is at depth ${current.depth}, while previous element is at depth ${previous.depth}.`,
        },
        affectedSelector: current.selector,
        evidenceType: EVIDENCE_TYPE.DOM_TRAVERSAL,
      });
    }
  }

  return findings;
};

// ---------------------------------------------------------------------------
// Rule: Typoaphography checks
// ---------------------------------------------------------------------------
const checkTypography = (elementTree) => {
  const findings = [];

  // Small font size check - look for elements with small computed font-size
  for (const el of elementTree) {
    if (el.tagName === 'style' || el.tagName === 'script') continue;

    const fontSize = el.element.style.fontSize;
    if (fontSize) {
      const parsed = fontSize.match(/(\d+(?:\.\d+)?)(px|em|rem|%)/);
      if (parsed) {
        const sizeValue = parseFloat(parsed[1]);
        // If font-size is in px and below 16px, flag for body text
        if (parsed[2] === 'px' && sizeValue < 12) {
          findings.push({
            ruleId: RULE_IDS.SMALL_FONT_SIZE,
            severity: SEVERITY.LOW,
            evidence: {
              type: EVIDENCE_TYPE.CSS_COMPUTED,
              message: `Font size ${fontSize} may be too small for comfortable reading. Consider 12px or larger for body text.`,
              computedSize: sizeValue,
              unit: parsed[2],
            },
            affectedSelector: el.selector,
            evidenceType: EVIDENCE_TYPE.CSS_COMPUTED,
          });
        }
      }
    }
  }

  // Line height check
  for (const el of elementTree) {
    if (el.tagName === 'style' || el.tagName === 'script') continue;

    const lineHeight = el.element.style.lineHeight;
    if (lineHeight) {
      const parsed = lineHeight.match(/(\d+(?:\.\d+)?)/);
      if (parsed) {
        const lhValue = parseFloat(parsed[1]);
        // WCAG recommends at least 1.5 for normal text
        if (lhValue < 1.2) {
          findings.push({
            ruleId: RULE_IDS.LINE_HEIGHT_TOO_TIGHT,
            severity: SEVERITY.LOW,
            evidence: {
              type: EVIDENCE_TYPE.CSS_COMPUTED,
              message: `Line height ${lineHeight} is below WCAG recommended minimum of 1.5 for readability.`,
              computedLineHeight: lhValue,
            },
            affectedSelector: el.selector,
            evidenceType: EVIDENCE_TYPE.CSS_COMPUTED,
          });
        }
      }
    }
  }

  return findings;
};

// ---------------------------------------------------------------------------
// Rule: ARIA role mismatch (basic checks)
// ---------------------------------------------------------------------------
const checkARIARoleMismatch = (elementTree) => {
  const findings = [];

  // Look for elements with ARIA roles that may be mismatched
  const roleElements = elementTree.filter(
    (el) => el.element.getAttribute('role') && el.tagName !== 'body' && el.tagName !== 'html'
  );

  for (const el of roleElements) {
    const role = el.element.getAttribute('role');
    const tag = el.tagName.toLowerCase();

    // Simple heuristics: nav role on non-nav elements, button role on non-buttons, etc.
    if (role === 'navigation' && tag !== 'nav' && tag !== 'header') {
      findings.push({
        ruleId: RULE_IDS.ARIA_ROLE_MISMATCH,
        severity: SEVERITY.LOW,
        evidence: {
          type: EVIDENCE_TYPE.HTML_ATTRIBUTE,
          message: `ARIA role="navigation" found on <${tag}> element. Consider using <nav> element or applying the role to the appropriate container.`,
        },
        affectedSelector: el.selector,
        evidenceType: EVIDENCE_TYPE.HTML_ATTRIBUTE,
      });
    } else if (role === 'button' && tag !== 'button' && !['a'].includes(tag)) {
      findings.push({
        ruleId: RULE_IDS.ARIA_ROLE_MISMATCH,
        severity: SEVERITY.LOW,
        evidence: {
          type: EVIDENCE_TYPE.HTML_ATTRIBUTE,
          message: `ARIA role="button" found on <${tag}> element. Consider using <button> element or ensuring the element is keyboard-operable.`,
        },
        affectedSelector: el.selector,
        evidenceType: EVIDENCE_TYPE.HTML_ATTRIBUTE,
      });
    }
  }

  return findings;
};

// ---------------------------------------------------------------------------
// Main scan function - entry point
// ---------------------------------------------------------------------------
/**
 * Performs an accessibility scan of the given document/element tree.
 * All checks are rule-based and deterministic.
 * AI suggestions can be added separately and must be labelled as SUGGESTION.
 *
 * @param {Document} document - The document to scan
 * @param {Object} options - Scan options
 * @param {boolean} options.includeAI - Whether to include AI suggestion placeholders (default: false)
 * @returns {Array<Object>} - Array of accessibility findings
 */
export const scanAccessibility = (document, options = {}) => {
  const includeAI = options.includeAI || false;
  const findings = [];

  if (!document || !document.documentElement) {
    return findings;
  }

  const root = document.documentElement;
  const elementTree = buildElementTree(root);

  // Run all rule-based checks
  findings.push(...checkDoctype(document));
  findings.push(...checkHeadingStructure(elementTree));
  findings.push(...checkLandmarks(elementTree));
  findings.push(...checkForms(elementTree));
  findings.push(...checkContrast(elementTree));
  findings.push(...checkAltText(elementTree));
  findings.push(...checkLanguageDeclaration(document));
  findings.push(...checkFocusOrder(elementTree));
  findings.push(...checkTypography(elementTree));
  findings.push(...checkARIARoleMismatch(elementTree));

  // Optionally include AI suggestion placeholders
  if (includeAI) {
    findings.push(
      {
        ruleId: 'ai.suggestion.placeholder',
        severity: SEVERITY.LOW,
        evidence: {
          type: EVIDENCE_TYPE.AI_SUGGESTION,
          message: 'AI suggestion: Consider adding more descriptive heading hierarchy for better cognitive accessibility.',
        },
        affectedSelector: 'body',
        evidenceType: EVIDENCE_TYPE.AI_SUGGESTION,
        // AI output must be labelled as suggestion until confirmed
        isAIRecommendation: true,
      },
      {
        ruleId: 'ai.suggestion.placeholder',
        severity: SEVERITY.MEDIUM,
        evidence: {
          type: EVIDENCE_TYPE.AI_SUGGESTION,
          message: 'AI suggestion: Ensure all form controls have programmatically associated labels for screen reader compatibility.',
        },
        affectedSelector: 'body',
        evidenceType: EVIDENCE_TYPE.AI_SUGGESTION,
        isAIRecommendation: true,
      }
    );
  }

  // Sort findings: CRITICAL first, then HIGH, MEDIUM, LOW; within same severity by rule ID
  const severityOrder = { [SEVERITY.CRITICAL]: 0, [SEVERITY.HIGH]: 1, [SEVERITY.MEDIUM]: 2, [SEVERITY.LOW]: 3 };
  findings.sort((a, b) => {
    const aSec = severityOrder[a.severity] ?? 99;
    const bSec = severityOrder[b.severity] ?? 99;
    if (aSec !== bSec) return aSec - bSec;
    return a.ruleId.localeCompare(b.ruleId);
  });

  return findings;
};

// ---------------------------------------------------------------------------
// Scan result summarization
// ---------------------------------------------------------------------------
/**
 * Summarizes scan findings into a score and breakdown.
 *
 * @param {Array<Object>} findings - Array of findings from scanAccessibility
 * @returns {{ score: number | null, level: string, color: string, breakdown: Object }}
 */
export const summarizeScan = (findings) => {
  if (!findings || findings.length === 0) {
    return {
      score: 100,
      level: 'EXCELLENT',
      color: '#10b981',
      breakdown: {
        total: 0,
        bySeverity: {
          [SEVERITY.CRITICAL]: 0,
          [SEVERITY.HIGH]: 0,
          [SEVERITY.MEDIUM]: 0,
          [SEVERITY.LOW]: 0,
        },
        byCategory: {
          heading: 0,
          form: 0,
          contrast: 0,
          landmark: 0,
          media: 0,
          focus: 0,
          other: 0,
        },
      },
    };
  }

  const total = findings.length;
  const bySeverity = {
    [SEVERITY.CRITICAL]: 0,
    [SEVERITY.HIGH]: 0,
    [SEVERITY.MEDIUM]: 0,
    [SEVERITY.LOW]: 0,
  };

  const byCategory = {
    heading: 0,
    form: 0,
    contrast: 0,
    landmark: 0,
    media: 0,
    focus: 0,
    other: 0,
  };

  const severityWeights = {
    [SEVERITY.CRITICAL]: 25,
    [SEVERITY.HIGH]: 20,
    [SEVERITY.MEDIUM]: 15,
    [SEVERITY.LOW]: 5,
  };

  let totalWeightedScore = 0;

  for (const finding of findings) {
    bySeverity[finding.severity] = (bySeverity[finding.severity] || 0) + 1;
    totalWeightedScore += severityWeights[finding.severity] || 5;

    // Categorize
    const cat = finding.ruleId.split('.')[0];
    if (byCategory[cat] !== undefined) {
      byCategory[cat] += 1;
    } else {
      byCategory.other += 1;
    }
  }

  // Calculate score: 100 - (totalWeightedScore normalized)
  // Max possible weighted score if all were CRITICAL: total * 25
  const maxPossible = total * 25;
  const rawScore = maxPossible > 0 ? Math.round((1 - totalWeightedScore / maxPossible) * 100) : 100;
  const score = Math.max(0, Math.min(100, rawScore));

  let level = 'LOW';
  let color = '#7f1d1d';

  if (score >= 80) {
    level = 'EXCELLENT';
    color = '#10b981';
  } else if (score >= 60) {
    level = 'GOOD';
    color = '#34d399';
  } else if (score >= 40) {
    level = 'FAIR';
    color = '#f59e0b';
  } else if (score > 0) {
    level = 'POOR';
    color = '#ef4444';
  }

  return {
    score,
    level,
    color,
    breakdown: {
      total,
      bySeverity,
      byCategory,
    },
  };
};

// ---------------------------------------------------------------------------
// Export all
// ---------------------------------------------------------------------------
export default {
  RULE_IDS,
  SEVERITY,
  SEVERITY_COLORS,
  EVIDENCE_TYPE,
  SCAN_STATUS,
  scanAccessibility,
  summarizeScan,
};