import type { Metadata } from "next";
import Script from "next/script";
import {
  Archivo_Black,
  Golos_Text,
  DM_Sans,
  JetBrains_Mono,
} from "next/font/google";
import { SITE_URL } from "@/lib/config";
// The REAL design system, imported once globally (variables first).
import "@/spa/ui/tokens.css";
import "@/spa/styles.css";

// Self-hosted, preloaded, swap-rendered fonts. Replaces the render-blocking
// Google Fonts <link> (two extra round-trips on the critical path) with files
// served from our own origin and a zero-layout-shift fallback metric.
// adjustFontFallback:false — Archivo Black is latin-only, and next/font's
// auto-injected metric fallback has no unicode-range, so it would otherwise
// catch Cyrillic glyphs (rendering them as Arial) before the stack reaches
// Golos Text. Disabling it lets Cyrillic display text fall through to Golos.
const archivo = Archivo_Black({
  weight: "400",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-archivo",
  adjustFontFallback: false,
});
// Pinned to 800 (ExtraBold), matching the original `Golos+Text:wght@800` link.
// Golos is the Cyrillic companion to Archivo Black (a single-weight black face)
// in --font-display; display elements don't set an explicit font-weight, so
// loading the full variable range would render Cyrillic at the 400 default —
// noticeably thinner than the Latin Archivo Black. A single 800 face keeps
// Cyrillic display text heavy regardless of the inherited weight.
const golos = Golos_Text({
  weight: "800",
  subsets: ["latin", "latin-ext", "cyrillic"],
  display: "swap",
  variable: "--font-golos",
});
const dmSans = DM_Sans({
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-dm",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin", "latin-ext", "cyrillic"],
  display: "swap",
  variable: "--font-jb",
});

const fontVars = `${archivo.variable} ${golos.variable} ${dmSans.variable} ${jetbrains.variable}`;

const GTM_ID = "GTM-MB2CPXFD";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Majstr — каталог україно- та російськомовних майстрів в Італії",
    template: "%s",
  },
  description:
    "Majstr — каталог перевірених україно- та російськомовних майстрів в Італії: манікюр, перукарі, косметологи, електрики, лікарі та інші. Запис у Telegram, безкоштовно.",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  openGraph: { type: "website", siteName: "Majstr", images: ["/og-image.png"] },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/favicon.png" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uk" className={fontVars}>
      <body>
        {/* GTM — loaded after hydration so it never blocks first paint. */}
        <Script id="gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`}
        </Script>
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        {children}
      </body>
    </html>
  );
}
