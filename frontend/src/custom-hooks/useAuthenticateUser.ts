import { useEffect, useState } from "react";
import type { User } from "../schema/user/user.schema";
import { UserSchema } from "../schema/user/user.schema";
import { apiFetch } from "../api/client";

type AuthenticatedUserState = {
  user: User;
  loading: false;
  error: null;
};

type LoadingUserState = {
  user: null;
  loading: true;
  error: null;
};

type ErrorUserState = {
  user: null;
  loading: false;
  error: string;
};

// Settled, but no authenticated user (normal "not logged in" case).
type UnauthenticatedUserState = {
  user: null;
  loading: false;
  error: null;
};

export type UseAuthenticateUserState =
  | AuthenticatedUserState
  | LoadingUserState
  | ErrorUserState
  | UnauthenticatedUserState;

// Works on both surfaces: apiFetch attaches the JWT (web) or the
// Telegram initData (TMA) automatically. A 401 here is the normal
// "not logged in" case, so it resolves to a quiet null state rather
// than an error or a redirect.
export default function useAuthenticateUser(): UseAuthenticateUserState {
  const [state, setState] = useState<UseAuthenticateUserState>({
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    (async function () {
      setState({ user: null, loading: true, error: null });

      try {
        const response = await apiFetch(
          "/auth",
          { signal: controller.signal },
          { redirectOn401: false }
        );

        if (!response.ok) {
          // 401/404 → simply not authenticated. Quiet null, no error.
          setState({ user: null, loading: false, error: null });
          return;
        }

        const result = await response.json();
        if (!isUser(result)) {
          setState({
            user: null,
            loading: false,
            error: "Invalid user data received",
          });
          return;
        }

        setState({ user: result, loading: false, error: null });
        console.log(`User ${result.firstName} logged in!`);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setState({
          user: null,
          loading: false,
          error: `Failed to authenticate: ${
            err instanceof Error ? err.message : "unknown error"
          }`,
        });
        console.error(err);
      }
    })();

    return () => controller.abort();
  }, []);

  return state;
}

function isUser(data: unknown): data is User {
  return UserSchema.safeParse(data).success;
}
