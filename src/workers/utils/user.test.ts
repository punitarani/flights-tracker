/**
 * Unit tests for user utilities
 */

import { describe, expect, mock, test } from "bun:test";
import { createMockSupabaseUserResponse } from "../test/fixtures";
import { createMockEnv } from "../test/setup";
import { getUserEmail } from "./user";

describe("getUserEmail", () => {
  const env = createMockEnv();

  test("fetches user email successfully", async () => {
    const userId = "user-123";
    const mockUser = createMockSupabaseUserResponse(userId, "test@example.com");
    const createClientMock = mock(() => ({
      auth: {
        admin: {
          getUserById: mock(() =>
            Promise.resolve({ data: { user: mockUser }, error: null }),
          ),
        },
      },
    }));

    const email = await getUserEmail(env, userId, createClientMock as never);

    expect(email).toBe("test@example.com");
    expect(createClientMock).toHaveBeenCalledWith(env);
  });

  test("returns null when user not found", async () => {
    const createClientMock = mock(() => ({
      auth: {
        admin: {
          getUserById: mock(() =>
            Promise.resolve({ data: { user: null }, error: null }),
          ),
        },
      },
    }));

    const email = await getUserEmail(
      env,
      "nonexistent-user",
      createClientMock as never,
    );

    expect(email).toBeNull();
  });

  test("returns null when response has no email", async () => {
    const createClientMock = mock(() => ({
      auth: {
        admin: {
          getUserById: mock(() =>
            Promise.resolve({
              data: { user: { id: "user-123" } },
              error: null,
            }),
          ),
        },
      },
    }));

    const email = await getUserEmail(
      env,
      "user-123",
      createClientMock as never,
    );

    expect(email).toBeNull();
  });

  test("handles fetch errors gracefully", async () => {
    const createClientMock = mock(() => ({
      auth: {
        admin: {
          getUserById: mock(() => Promise.reject(new Error("Network error"))),
        },
      },
    }));

    const email = await getUserEmail(
      env,
      "user-123",
      createClientMock as never,
    );

    expect(email).toBeNull();
  });

  test("handles non-ok responses", async () => {
    const createClientMock = mock(() => ({
      auth: {
        admin: {
          getUserById: mock(() =>
            Promise.resolve({ data: null, error: new Error("Server error") }),
          ),
        },
      },
    }));

    const email = await getUserEmail(
      env,
      "user-123",
      createClientMock as never,
    );

    expect(email).toBeNull();
  });
});
