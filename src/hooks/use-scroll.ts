import { useEffect, useState } from "react";

export type ScrollDirection = "up" | "down" | null;

export interface UseScrollOptions {
  /**
   * The threshold in pixels before a scroll direction change is registered
   * @default 10
   */
  threshold?: number;
  /**
   * Debounce time in milliseconds
   * @default 0
   */
  debounce?: number;
}

export interface UseScrollReturn {
  /** Current scroll Y position */
  scrollY: number;
  /** Current scroll direction */
  scrollDirection: ScrollDirection;
  /** Whether the user is at the top of the page */
  isAtTop: boolean;
  /** Whether the header should be shown (based on scroll direction) */
  showHeader: boolean;
}

/**
 * Hook to track scroll position, direction, and provide header visibility state
 */
export function useScroll(options: UseScrollOptions = {}): UseScrollReturn {
  const { threshold = 10, debounce = 0 } = options;

  const [scrollY, setScrollY] = useState(0);
  const [scrollDirection, setScrollDirection] = useState<ScrollDirection>(null);
  const [isAtTop, setIsAtTop] = useState(true);
  const [showHeader, setShowHeader] = useState(true);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;
    let timeoutId: NodeJS.Timeout | null = null;

    const updateScrollState = () => {
      const currentScrollY = window.scrollY;
      const diff = currentScrollY - lastScrollY;

      // Update scroll Y position
      setScrollY(currentScrollY);

      // Check if at top
      const atTop = currentScrollY < threshold;
      setIsAtTop(atTop);

      // Always show header when at top
      if (atTop) {
        setShowHeader(true);
        setScrollDirection(null);
        lastScrollY = currentScrollY;
        ticking = false;
        return;
      }

      // Only update direction if scrolled more than threshold
      if (Math.abs(diff) > threshold) {
        const newDirection = diff > 0 ? "down" : "up";

        // Only update if direction actually changed
        setScrollDirection((prev) => {
          if (prev !== newDirection) {
            setShowHeader(newDirection === "up");
            return newDirection;
          }
          return prev;
        });

        lastScrollY = currentScrollY;
      }

      ticking = false;
    };

    const handleScroll = () => {
      if (debounce > 0) {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
          if (!ticking) {
            window.requestAnimationFrame(updateScrollState);
            ticking = true;
          }
        }, debounce);
      } else {
        if (!ticking) {
          window.requestAnimationFrame(updateScrollState);
          ticking = true;
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    // Initialize state
    updateScrollState();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [threshold, debounce]);

  return {
    scrollY,
    scrollDirection,
    isAtTop,
    showHeader,
  };
}
