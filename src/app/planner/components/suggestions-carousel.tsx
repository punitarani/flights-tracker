"use client";

import AutoScroll from "embla-carousel-auto-scroll";
import useEmblaCarousel from "embla-carousel-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Suggestion } from "@/components/ai-elements/suggestion";
import { cn } from "@/lib/utils";

import { SUGGESTION_SETS } from "../constants/suggestion-sets";

type SuggestionsCarouselProps = {
  onSuggestionSelect: (suggestion: string) => void;
  className?: string;
  intervalMs?: number;
};

const DEFAULT_INTERVAL = 6000;
const AUTO_SCROLL_SPEED = 2;

type CarouselRowProps = {
  items: string[];
  onSuggestionSelect: (suggestion: string) => void;
  prefersReducedMotion: boolean;
};

const CarouselRow = ({
  items,
  onSuggestionSelect,
  prefersReducedMotion,
}: CarouselRowProps) => {
  const autoScrollPlugin = useMemo(
    () =>
      AutoScroll({
        speed: AUTO_SCROLL_SPEED,
        stopOnMouseEnter: true,
        stopOnInteraction: false,
        stopOnFocusIn: true,
        playOnInit: true,
        startDelay: 0,
      }),
    [],
  );

  const [carouselRef, emblaApi] = useEmblaCarousel(
    {
      loop: true,
      align: "start",
    },
    prefersReducedMotion ? [] : [autoScrollPlugin],
  );

  const trackItems = useMemo(() => {
    if (items.length === 0) return [] as { key: string; value: string }[];
    return Array.from({ length: 10 }, (_, repeatIndex) =>
      items.map((value, idx) => ({
        key: `${value}-${repeatIndex}-${idx}-${value.length}`,
        value,
      })),
    ).flat();
  }, [items]);

  useEffect(() => {
    if (!emblaApi) return;
    const plugin = emblaApi.plugins()?.autoScroll;
    if (!plugin) return;

    if (prefersReducedMotion) {
      plugin.stop();
      return;
    }

    plugin.play(0);

    return () => {
      plugin.stop();
    };
  }, [emblaApi, prefersReducedMotion]);

  return (
    <div ref={carouselRef} className="overflow-hidden">
      <div className="flex items-center gap-3">
        {trackItems.map(({ key, value }) => (
          <div key={key} className="shrink-0">
            <Suggestion suggestion={value} onClick={onSuggestionSelect} />
          </div>
        ))}
      </div>
    </div>
  );
};

export const SuggestionsCarousel = ({
  onSuggestionSelect,
  className,
  intervalMs = DEFAULT_INTERVAL,
}: SuggestionsCarouselProps) => {
  const suggestionSets = useMemo(() => SUGGESTION_SETS, []);
  const prefersReducedMotion = usePrefersReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isRotationEnabled, setIsRotationEnabled] = useState(true);

  useEffect(() => {
    if (
      prefersReducedMotion ||
      !isRotationEnabled ||
      suggestionSets.length <= 1
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % suggestionSets.length);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [
    intervalMs,
    isRotationEnabled,
    prefersReducedMotion,
    suggestionSets.length,
  ]);

  const handlePause = useCallback(() => setIsRotationEnabled(false), []);
  const _handleResume = useCallback(() => setIsRotationEnabled(true), []);

  const activeSet = suggestionSets[activeIndex];

  return (
    <div className={cn("space-y-2", className)}>
      {[activeSet.popularRoutes, activeSet.funIdeas].map((rowItems, index) => (
        <CarouselRow
          key={`${activeSet.id}-${index}`}
          items={rowItems}
          onSuggestionSelect={(value) => {
            handlePause();
            onSuggestionSelect(value);
          }}
          prefersReducedMotion={prefersReducedMotion}
        />
      ))}
      {!prefersReducedMotion && !isRotationEnabled && (
        <div className="sr-only" aria-live="polite">
          Suggestions rotation paused after selection.
        </div>
      )}
    </div>
  );
};

const usePrefersReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return prefersReducedMotion;
};
