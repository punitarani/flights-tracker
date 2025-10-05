import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AuthForms from "./auth-forms";
import { type AuthState, authInitialState } from "./form-state";

async function signInAction(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  "use server";

  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string") {
    return {
      error: "Email and password are required",
      success: null,
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      error: error.message,
      success: null,
    };
  }

  redirect("/");
}

async function signUpAction(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  "use server";

  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string") {
    return {
      error: "Email and password are required",
      success: null,
    };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return {
      error: error.message,
      success: null,
    };
  }

  if (data.session) {
    redirect("/");
  }

  return {
    error: null,
    success: "Check your email to confirm your account",
  };
}

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="text-4xl" role="img" aria-label="flight">
            ✈️
          </span>
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight">
              Flights Tracker
            </h1>
            <p className="text-muted-foreground text-sm">
              Sign in or create an account to manage your flight alerts.
            </p>
          </div>
        </div>
        <AuthForms
          signInAction={signInAction}
          signUpAction={signUpAction}
          initialState={authInitialState}
        />
      </div>
    </div>
  );
}
