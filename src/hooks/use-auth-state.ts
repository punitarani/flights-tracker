"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Hook for managing user authentication state
 * @param shouldFetch - Whether to actively fetch user state (e.g., when a modal is open)
 * @returns Object containing userEmail and isAuthenticated
 */
export function useAuthState(shouldFetch = false) {
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!shouldFetch || userEmail) {
      return;
    }

    const supabase = createClient();
    let isMounted = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (isMounted) {
        setUserEmail(data.user?.email ?? null);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setUserEmail(session?.user?.email ?? null);
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [shouldFetch, userEmail]);

  return {
    userEmail,
    isAuthenticated: Boolean(userEmail),
  };
}
