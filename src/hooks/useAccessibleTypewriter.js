import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook to detect user preference for reduced motion.
 * Listens for real-time media query changes.
 *
 * @returns {boolean} Whether prefers-reduced-motion is active
 */
export function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }
    const mediaQueryList = window.matchMedia('(prefers-reduced-motion: reduce)');
    const listener = (event) => setPrefersReducedMotion(event.matches);

    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', listener);
    } else {
      mediaQueryList.addListener(listener);
    }

    return () => {
      if (mediaQueryList.removeEventListener) {
        mediaQueryList.removeEventListener('change', listener);
      } else {
        mediaQueryList.removeListener(listener);
      }
    };
  }, []);

  return prefersReducedMotion;
}

/**
 * Accessible Typewriter Hook with:
 * - Automatic detection of `prefers-reduced-motion` (returns static fallback).
 * - User-controllable pause / resume state.
 * - Cleanup of timers on unmount or paused transitions.
 * - Screen-reader friendly aria announcements without character-by-character spam.
 *
 * @param {string[]} words Words or phrases to cycle through
 * @param {Object} [options]
 * @param {number} [options.typingSpeed=80] Milliseconds per character typed
 * @param {number} [options.deletingSpeed=40] Milliseconds per character deleted
 * @param {number} [options.pauseDuration=2500] Milliseconds to pause on a complete word
 * @param {string} [options.staticFallback] Static word when motion is reduced
 */
export function useAccessibleTypewriter(
  words = [],
  {
    typingSpeed = 80,
    deletingSpeed = 40,
    pauseDuration = 2500,
    staticFallback
  } = {}
) {
  const prefersReduced = usePrefersReducedMotion();
  const defaultStatic = staticFallback || (words.length > 0 ? words[0] : '');

  const [text, setText] = useState(prefersReduced ? defaultStatic : '');
  const [wordIndex, setWordIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const timerRef = useRef(null);

  // If user prefers reduced motion, halt animation immediately and lock on static phrase
  useEffect(() => {
    if (prefersReduced) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setText(defaultStatic);
    }
  }, [prefersReduced, defaultStatic]);

  useEffect(() => {
    if (prefersReduced || isPaused || words.length === 0) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const currentWord = words[wordIndex] || '';

    if (isDeleting) {
      if (text === '') {
        setIsDeleting(false);
        setWordIndex((prev) => (prev + 1) % words.length);
        timerRef.current = setTimeout(() => {}, 400);
      } else {
        timerRef.current = setTimeout(() => {
          setText(currentWord.substring(0, text.length - 1));
        }, deletingSpeed);
      }
    } else {
      if (text === currentWord) {
        timerRef.current = setTimeout(() => {
          setIsDeleting(true);
        }, pauseDuration);
      } else {
        timerRef.current = setTimeout(() => {
          setText(currentWord.substring(0, text.length + 1));
        }, typingSpeed);
      }
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [text, isDeleting, wordIndex, words, isPaused, prefersReduced, typingSpeed, deletingSpeed, pauseDuration]);

  const togglePause = () => {
    setIsPaused((prev) => !prev);
  };

  return {
    text: prefersReduced ? defaultStatic : text,
    currentWord: words[wordIndex] || defaultStatic,
    isPaused,
    prefersReduced,
    togglePause,
    setIsPaused
  };
}
