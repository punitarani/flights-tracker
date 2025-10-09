import { useEffect, useState } from "react";

interface UseScrollPositionOptions {
  /**
   * Scroll threshold in pixels to trigger the scrolled state
   * @default 50
   */
  threshold?: number;
  /**
   * Debounce delay in milliseconds
   * @default 10
   */
  debounceMs?: number;
}

/**
 * Hook to detect if the user has scrolled past a threshold
 * Useful for implementing collapsible headers
 */
export function useScrollPosition(options: UseScrollPositionOptions = {}) {
  const { threshold = 50, debounceMs = 10 } = options;
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    const handleScroll = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        const scrollY = window.scrollY;
        setIsScrolled(scrollY > threshold);
      }, debounceMs);
    };

    // Set initial state
    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [threshold, debounceMs]);

  return isScrolled;
}
