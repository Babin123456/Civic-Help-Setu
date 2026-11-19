import { useEffect, useState } from 'react';

/**
 * Hook to detect and observe prefers-reduced-motion media query.
 * Returns [reducedMotion, setReducedMotion].
 */
export const useReducedMotion = () => {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e) => setMatches(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  return [matches, setMatches];
};

export default useReducedMotion;
