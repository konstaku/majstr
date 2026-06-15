import { createBrowserRouter } from "react-router-dom";
import AddNewRecord from "./pages/AddNewRecord";

import { mainRoute } from "./pages/Main";
import { adminRoute } from "./pages/Admin";
import { miningReviewRoute } from "./pages/MiningReview";
import Root from "./components/Root";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import ErrorPage from "./pages/ErrorPage";
import OnboardingWizard from "./onboarding/OnboardingWizard";
import MyCards from "./pages/MyCards";
import ClaimCard from "./pages/ClaimCard";

// Exported so tests can mount the exact same route tree through a memory
// router (see src/test/renderRoute.tsx) — that way a route forgetting a
// required provider is caught, instead of being masked by a test wrapper.
export const routes = [
  {
    path: "/onboard",
    element: <OnboardingWizard />,
    errorElement: <ErrorPage />,
  },
  // Claim flow + card management share the add-master wizard look: standalone
  // screens without the website header/branding.
  {
    path: "/claim/:masterId",
    element: <ClaimCard />,
    errorElement: <ErrorPage />,
  },
  {
    path: "/my-cards",
    element: <MyCards />,
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
          {
            path: "/admin/mining",
            ...miningReviewRoute,
          },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
