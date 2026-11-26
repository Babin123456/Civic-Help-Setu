import React, { createContext, useContext, useEffect, useState } from 'react';

// Create the context with a default value for server-side rendering
const ReducedMotionContext = createContext({
  prefersReducedMotion: false,
});

/** 
 * Hook to detect reduced-motion preference from the user's OS/settings.
 * Supports reduced-motion accessibility requirement.
 */
export const useReducedMotion = () => {
  const { prefersReducedMotion } = useContext(ReducedMotionContext);
  return prefersReducedMotion;
};

/** 
 * Provider for the reduced-motion context.
 * Checks the CSS media query for prefers-reduced-motion.
 */
export const ReducedMotionProvider = ({ children }) => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e) => setPrefersReducedMotion(e.matches);
    mediaQuery.addListener(handler);

    return () => mediaQuery.removeListener(handler);
  }, []);

  return (
    <ReducedMotionContext.Provider value={{ prefersReducedMotion }}>
      {children}
    </ReducedMotionContext.Provider>
  );
};

/** 
 * Hook to easily apply reduced-motion styles to elements.
 * Disables transitions, animations, and hover effects when user prefers reduced motion.
 */
export const useReducedMotionStyles = () => {
  const { prefersReducedMotion } = useContext(ReducedMotionContext);
  
  const transitionDuration = prefersReducedMotion ? '0s' : 'var(--transition-fast, 0.2s)';
  const animationDuration = prefersReducedMotion ? '0s' : 'initial';
  
  return {
    transitionDuration,
    animationDuration,
  };
};

export const useReducedMotionClasses = () => {
  const { prefersReducedMotion } = useContext(ReducedMotionContext);
  
  const reducedClass = prefersReducedMotion ? ' reduced-motion' : '';
  
  return {
    reducedClass,
  };
};

export default ReducedMotionContext;