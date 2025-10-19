import type { ReactNode } from "react";

type PlannerLayoutProps = {
  children: ReactNode;
};

/**
 * Planner layout - No footer, full height
 */
export default function PlannerLayout({ children }: PlannerLayoutProps) {
  return <>{children}</>;
}
