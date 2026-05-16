import React from "react";
import ReactDOM from "react-dom/client";
import { MasterContextProvider } from "./context";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { TelegramContextProvider } from "./surface/useTelegramContext";
import { PopupProvider } from "./ui/usePopup";
import { ThemeBridge } from "./ui/ThemeBridge";
import "./ui/tokens.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <TelegramContextProvider>
      <ThemeBridge />
      <PopupProvider>
        <MasterContextProvider>
          <RouterProvider router={router} />
        </MasterContextProvider>
      </PopupProvider>
    </TelegramContextProvider>
  </React.StrictMode>
);
