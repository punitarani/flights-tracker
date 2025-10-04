export type AuthState = {
  error: string | null;
  success: string | null;
};

export const authInitialState: AuthState = {
  error: null,
  success: null,
};
