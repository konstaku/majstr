import { useEffect, useState } from "react";
import type { User } from "../schema/user/user.schema";
import { UserSchema } from "../schema/user/user.schema";

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

export type UseAuthenticateUserState =
  | AuthenticatedUserState
  | LoadingUserState
  | ErrorUserState;

export default function useAuthenticateUser(): UseAuthenticateUserState {
  const [state, setState] = useState<UseAuthenticateUserState>({
    user: null,
    loading: true,
    error: null,
  });

  const [token] = useState(() =>
    JSON.parse(localStorage.getItem("token") as string)
  );

  useEffect(() => {
    const controller = new AbortController();

    (async function () {
      setState(() => ({ user: null, loading: true, error: null }));

      if (!token) {
        throw new Error("Token not found, authentication not possible");
      }

      try {
        const response = await fetch("https://api.majstr.com/auth", {
          headers: { Authorization: token },
          signal: controller.signal,
        });

        if (!response.ok) {
          setState({
            user: null,
            loading: false,
            error: `Failed to authenticate: ${response.statusText}`,
          });
          throw new Error(`Failed to authenticate: ${response.statusText}`);
        }

        const result = await response.json();
        if (!isUser(result)) {
          setState({
            user: null,
            loading: false,
            error: `Invalid user data received`,
          });
          throw new Error("Invalid user data received");
        }

        setState(() => ({ user: result, loading: false, error: null }));

        console.log(`User ${result.firstName} logged in!`);
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setState({
            user: null,
            loading: false,
            error: `Failed to authenticate: ${err.message}`,
          });
          console.error(err);
        }
      }
    })();

    return () => controller.abort();
  }, [token]);

  // console.log("returning user:", user);
  return state;
}

function isUser(data: unknown): data is User {
  return UserSchema.safeParse(data).success;
}
