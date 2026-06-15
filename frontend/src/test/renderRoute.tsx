import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { TelegramContextProvider } from "../surface/useTelegramContext";
import { PopupProvider } from "../ui/usePopup";
import { MasterContextProvider } from "../context";
import { routes } from "../router";

// Mounts a single app route through the *real* provider stack from main.tsx
// and the *real* route definitions from router.tsx. The point is fidelity:
// if a route uses a context hook (useOnbT, etc.) but isn't wrapped in the
// matching provider, this render reproduces the production crash instead of
// hiding it behind a hand-rolled test wrapper.
//
// Crashes during render are caught by each route's `errorElement` (ErrorPage),
// so a broken route shows "Щось пішло не так" rather than throwing out of
// render() — assert against that, see `expectNoRouteError`.
export function renderRoute(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <TelegramContextProvider>
      <PopupProvider>
        <MasterContextProvider>
          <RouterProvider router={router} />
        </MasterContextProvider>
      </PopupProvider>
    </TelegramContextProvider>
  );
}

// The router's errorElement renders this copy when a route throws in render.
export const ROUTE_ERROR_TEXT = /Щось пішло не так/;
