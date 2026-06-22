import type { ReactNode } from "react";
import {
  Archivo_Black,
  Golos_Text,
  DM_Sans,
  JetBrains_Mono,
} from "next/font/google";
import AppProviders from "./AppProviders";

// Fonts mirror app/[lang]/layout.tsx so the app surfaces share the design
// system's display/body faces. (Duplicated rather than shared to avoid touching
// the catalogue layout; DRY into app/fonts.ts later if it drifts.)
const archivo = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-archivo",
  adjustFontFallback: false,
});
const golos = Golos_Text({
  weight: "800",
  subsets: ["cyrillic"],
  display: "swap",
  variable: "--font-golos",
  preload: false,
});
const dmSans = DM_Sans({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-dm",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jb",
  preload: false,
});

const fontVars = `${archivo.variable} ${golos.variable} ${dmSans.variable} ${jetbrains.variable}`;

// Owns <html>/<body> for the interactive app surfaces (outside the [lang] SEO
// tree). Loads the Telegram Mini App bridge in <head> so window.Telegram /
// initData exist before the app reads them, and marks the surfaces noindex —
// they're authed, non-SEO screens (onboarding/claim/my-cards/admin).
export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uk" className={fontVars}>
      <head>
        <meta name="robots" content="noindex" />
        <script src="https://telegram.org/js/telegram-web-app.js" />
      </head>
      {/* The global styles.css paints body with the catalogue's --cream and, on
          mobile, adds padding-top for the site header — both wrong for the app
          surfaces (a beige stripe above the wizard). The old wizard.css fix
          keyed on the Vite `#root` node, which doesn't exist in Next. Set the
          app/theme background + drop the header offset directly on this body. */}
      <body style={{ background: "var(--app-bg)", paddingTop: 0 }}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
