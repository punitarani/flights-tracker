import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Flight Planner",
  description: "AI-powered flight planning assistant",
};

export default function PlannerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
