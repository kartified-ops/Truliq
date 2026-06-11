import React, { useEffect, useState, cloneElement, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * PageTransition - Provides smooth page transitions without blocking navigation
 * Uses simple opacity fade for fast, non-intrusive page changes
 * Also handles global scroll restoration during transitions
 */
const PageTransition = ({ children }) => {
  const location = useLocation();
  const navType = useNavigationType(); // "POP" (back/forward), "PUSH" (new), "REPLACE"
  const [displayLocation, setDisplayLocation] = useState(location);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Continuously track scroll position so we have the exact position BEFORE route changes
  const scrollPositions = useRef({});
  const currentPath = location.pathname;

  useEffect(() => {
    const handleScroll = () => {
      // Only track if not transitioning, to avoid capturing transient 0 values
      if (!isTransitioning) {
        scrollPositions.current[currentPath] = window.scrollY || document.documentElement.scrollTop;
      }
    };

    // Use passive listener for performance
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [currentPath, isTransitioning]);

  useEffect(() => {
    if (location.pathname !== displayLocation.pathname) {
      // Start transition immediately
      setIsTransitioning(true);

      // Quick fade out then swap content
      const timeout = setTimeout(() => {
        setDisplayLocation(location);
        setIsTransitioning(false);

        // Wait for DOM to render the new page
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            // If the user clicked back (POP) and we have a saved position, restore it
            if (navType === 'POP' && scrollPositions.current[location.pathname] !== undefined) {
              const targetY = scrollPositions.current[location.pathname];
              window.scrollTo({ top: targetY, behavior: 'instant' });

              // Fallback for heavy lazy-loaded pages: keep trying to scroll down for 1.5s 
              // as components and images slowly expand the page height.
              let attempts = 0;
              const scrollInterval = setInterval(() => {
                attempts++;
                // If we've reached the target scroll, or if we've tried for 1.5 seconds, stop
                if (window.scrollY >= targetY || attempts > 15) {
                  clearInterval(scrollInterval);
                } else {
                  window.scrollTo({ top: targetY, behavior: 'instant' });
                }
              }, 100);
            }
            // If it's a completely new navigation (PUSH/REPLACE) and no state requested a specific scroll, go to top
            else if (!location.state?.scrollToTop && !location.state?.scrollToSection) {
              window.scrollTo({ top: 0, behavior: 'instant' });
            }
          });
        });

      }, 100); // Very quick transition (100ms)

      return () => clearTimeout(timeout);
    }
  }, [location.pathname, displayLocation.pathname, location, navType]);

  return (
    <div
      style={{
        opacity: isTransitioning ? 0.7 : 1,
        transition: 'opacity 100ms ease-out',
        willChange: 'opacity',
      }}
    >
      {cloneElement(children, { location: displayLocation })}
    </div>
  );
};

export default PageTransition;



