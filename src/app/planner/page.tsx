import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { PlannerShell } from "@/components/planner/planner-shell";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "AI Flight Planner | GrayPane",
  description: "Let AI help you find the perfect flights for your next trip",
};

export default async function PlannerPage() {
  // Require authentication
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/planner");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <PlannerShell />
      </main>
    </div>
  );
}
