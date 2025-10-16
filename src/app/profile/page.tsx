import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { SignOutButton } from "@/components/sign-out-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const email = user.email ?? "Unknown user";

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-background">
      <Header />
      <main className="flex flex-1 items-start justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Your account details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="text-lg font-medium">{email}</p>
              </div>
            </CardContent>
          </Card>
          <SignOutButton
            variant="destructive"
            size="lg"
            className="w-full gap-2"
          />
        </div>
      </main>
    </div>
  );
}
