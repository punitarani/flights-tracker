import type { Metadata } from "next";
import { PlannerShell } from "@/components/planner/planner-shell";

export const metadata: Metadata = {
  title: "AI Flight Planner | GrayPane",
  description: "Let AI help you find the perfect flights for your next trip",
};

export default function PlannerPage() {
  return <PlannerShell />;
}
