"use client";

import { Loader2 } from "lucide-react";
import { type ReactNode, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AuthState } from "./form-state";

type AuthFormsProps = {
  signInAction: (state: AuthState, formData: FormData) => Promise<AuthState>;
  signUpAction: (state: AuthState, formData: FormData) => Promise<AuthState>;
  initialState: AuthState;
};

function SubmitButton({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <Button className="w-full" type="submit" disabled={pending}>
      {pending ? (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          {children}
        </span>
      ) : (
        children
      )}
    </Button>
  );
}

export default function AuthForms({
  signInAction,
  signUpAction,
  initialState,
}: AuthFormsProps) {
  const [signInState, signInDispatch] = useActionState(
    signInAction,
    initialState,
  );
  const [signUpState, signUpDispatch] = useActionState(
    signUpAction,
    initialState,
  );

  return (
    <Tabs defaultValue="sign-in" className="w-full max-w-md">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="sign-in">Sign In</TabsTrigger>
        <TabsTrigger value="sign-up">Sign Up</TabsTrigger>
      </TabsList>
      <TabsContent value="sign-in">
        <Card>
          <CardHeader>
            <CardTitle>Sign in to your account</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={signInDispatch} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sign-in-email">Email</Label>
                <Input
                  id="sign-in-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sign-in-password">Password</Label>
                <Input
                  id="sign-in-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              {signInState.error ? (
                <p className="text-sm text-destructive">{signInState.error}</p>
              ) : null}
              <SubmitButton>Sign In</SubmitButton>
            </form>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="sign-up">
        <Card>
          <CardHeader>
            <CardTitle>Create a new account</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={signUpDispatch} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sign-up-email">Email</Label>
                <Input
                  id="sign-up-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sign-up-password">Password</Label>
                <Input
                  id="sign-up-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                />
              </div>
              {signUpState.error ? (
                <p className="text-sm text-destructive">{signUpState.error}</p>
              ) : null}
              {signUpState.success ? (
                <p className="text-sm text-muted-foreground">
                  {signUpState.success}
                </p>
              ) : null}
              <SubmitButton>Sign Up</SubmitButton>
            </form>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
