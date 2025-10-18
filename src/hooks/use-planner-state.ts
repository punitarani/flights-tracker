import { create } from "zustand";
import type { PageView } from "@/server/schemas/planner-view";

/**
 * Global state for planner
 * Manages current view state synchronized with chat messages
 *
 * NO PERSISTENCE - All state is in-memory only (as requested)
 * When user refreshes page, state resets to default
 */

interface PlannerState {
  // Current view state
  currentView: PageView;
  setCurrentView: (view: PageView) => void;

  // Reset to default
  reset: () => void;
}

const defaultView: PageView = { mode: "map", view: "popular" };

export const usePlannerState = create<PlannerState>()((set) => ({
  currentView: defaultView,
  setCurrentView: (view) => set({ currentView: view }),
  reset: () => set({ currentView: defaultView }),
}));
