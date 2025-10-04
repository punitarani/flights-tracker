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
      <AuthForms
        signInAction={signInAction}
        signUpAction={signUpAction}
        initialState={authInitialState}
      />
    </div>
  );
}
