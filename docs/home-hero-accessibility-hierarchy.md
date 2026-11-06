# Home Hero Responsive Hierarchy and Accessible Animation Guide

## Overview
This document outlines the architectural enhancements introduced for the Home page hero section in Civic Help Setu (addressing Issues `#564` and `#565`).

The objective is to establish an accessible, mobile-first visual hierarchy that remains fully compliant with Web Content Accessibility Guidelines (WCAG 2.1 AA / 2.2 Section 2.3.3 Animation from Interactions & Section 2.2.2 Pause, Stop, Hide).

---

## 1. Visual Hierarchy & Responsive Spacing (#564)

### Fluid Typography using `clamp()`
The hero headline now uses CSS `clamp()` scaling to adapt gracefully between compact mobile screens (320px) and wide desktop displays (1920px+):
- **Headline Font Size**: `clamp(2rem, 5vw + 1rem, 3.75rem)`
- **Subtitle Line Height**: `leading-relaxed` with capped `max-w-2xl` for optimal reading comprehension (50-75 characters per line).
- **Stat Cards Grid**: Responsive 1-column on mobile, 3-column on tablet/desktop (`grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4`).

### Call-to-Action Grouping & Touch Targets
- Primary and secondary buttons maintain a minimum touch target size of 44x44px.
- Spacing between primary action ("Browse Directory") and secondary assistance ("Need Help Deciding?") is unified with responsive gaps (`gap-3 sm:gap-4`) and centered orientation.
- Focus outlines are clearly visible with high contrast ring styling (`focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2`).

---

## 2. Accessible Animation & Reduced Motion (#565)

### `prefers-reduced-motion` Respect
Users with vestibular disorders or motion sensitivities can set their OS preference to reduced motion. The `useAccessibleTypewriter` hook automatically listens to `(prefers-reduced-motion: reduce)` via `window.matchMedia`:
1. If reduced motion is enabled, character-by-character typewriter loops and blinking carets are completely halted.
2. The active phrase is rendered statically in full text immediately.
3. Media query event listeners dynamically handle runtime toggles between standard and reduced motion modes.

### User Pause & Play Controls
Even for users without system-level reduced motion active:
- An accessible toggle button with `aria-label` ("Pause hero text animation" / "Resume hero text animation") is positioned adjacent to the typewriter display.
- Clicking the toggle pauses interval updates and remembers the user's manual preference.
- Tooltip title and SVG iconography clearly reflect the running vs paused state (pause bar icon vs play triangle icon).

### Screen Reader Live Announcement
- The dynamic tagline is enclosed within a dedicated `aria-live="polite"` region with `aria-atomic="true"`.
- This ensures screen reader users receive concise, non-disruptive announcements without repeated character-level spamming.

---

## 3. Hook Interface: `useAccessibleTypewriter`

```js
const {
  displayText,   // Currently visible characters or full phrase when motion reduced
  isPaused,      // Boolean indicating if animation is paused
  togglePause,   // Function to toggle pause/play state
  prefersReducedMotion // Boolean reflecting OS media query state
} = useAccessibleTypewriter(wordsArray, {
  typingSpeed: 75,
  deletingSpeed: 40,
  pauseDuration: 2200,
});
```

---

## 4. Verification & Testing
- Unit tests verify static phrase display when `prefers-reduced-motion: reduce` matches.
- Component tests verify markup rendering, button role existence, and aria labels.
- Tested across light, dark, and high-contrast color themes.
