import React from "react";
import ReactDOM from "react-dom/client";
import { MasterContextProvider } from "./context";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <MasterContextProvider>
      <RouterProvider router={router} />
    </MasterContextProvider>
  </React.StrictMode>
);
