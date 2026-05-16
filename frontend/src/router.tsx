import { createBrowserRouter } from "react-router-dom";
import AddNewRecord from "./pages/AddNewRecord";

import { mainRoute } from "./pages/Main";
import { adminRoute } from "./pages/Admin";
import Root from "./components/Root";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import ErrorPage from "./pages/ErrorPage";
import OnboardingWizard from "./onboarding/OnboardingWizard";

export const router = createBrowserRouter([
  {
    path: "/onboard",
    element: <OnboardingWizard />,
    errorElement: <ErrorPage />,
  },
  {
    path: "/",
    element: <Root />,
    children: [
      {
        errorElement: <ErrorPage />,
        children: [
          {
            index: true,
            ...mainRoute,
          },
          {
            path: "/add",
            element: <AddNewRecord />,
          },
          {
            path: "/login",
            element: <Login />,
          },
          {
            path: "/profile",
            element: <Profile />,
          },
          {
            path: "/admin",
            ...adminRoute,
          },
        ],
      },
    ],
  },
]);
