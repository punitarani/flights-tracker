/**
 * Unit tests for user utilities
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";
import { createMockSupabaseUserResponse } from "../test/fixtures";
import { createMockEnv, mockFetchResponse } from "../test/setup";
import { getUserEmail } from "./user";

describe("getUserEmail", () => {
  const env = createMockEnv();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // Reset fetch mock before each test
    globalThis.fetch = originalFetch;
  });

  test("fetches user email successfully", async () => {
    const userId = "user-123";
    const mockUser = createMockSupabaseUserResponse(userId, "test@example.com");

    globalThis.fetch = mock(() => Promise.resolve(mockFetchResponse(mockUser)));

    const email = await getUserEmail(env, userId);

    expect(email).toBe("test@example.com");
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${env.SUPABASE_URL}/auth/v1/admin/users/${userId}`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  test("returns null when user not found", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        mockFetchResponse({ error: "User not found" }, 404, false),
      ),
    );

    const email = await getUserEmail(env, "nonexistent-user");

    expect(email).toBeNull();
  });

  test("returns null when response has no email", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(mockFetchResponse({ id: "user-123" })),
    );

    const email = await getUserEmail(env, "user-123");

    expect(email).toBeNull();
  });

  test("handles fetch errors gracefully", async () => {
    globalThis.fetch = mock(() => Promise.reject(new Error("Network error")));

    const email = await getUserEmail(env, "user-123");

    expect(email).toBeNull();
  });

  test("handles non-ok responses", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(mockFetchResponse({ error: "Server error" }, 500, false)),
    );

    const email = await getUserEmail(env, "user-123");

    expect(email).toBeNull();
  });
});
