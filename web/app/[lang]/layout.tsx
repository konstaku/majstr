import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import Script from "next/script";
import {
  Archivo_Black,
  Golos_Text,
  DM_Sans,
  JetBrains_Mono,
} from "next/font/google";
import { isLang, HTML_LANG, type Lang } from "@/lib/i18n";

// Self-hosted, preloaded, swap-rendered fonts. Replaces the render-blocking
// Google Fonts <link> (two extra round-trips on the critical path) with files
// served from our own origin and a zero-layout-shift fallback metric.
// adjustFontFallback:false — Archivo Black is latin-only, and next/font's
// auto-injected metric fallback has no unicode-range, so it would otherwise
// catch Cyrillic glyphs (rendering them as Arial) before the stack reaches
// Golos Text. Disabling it lets Cyrillic display text fall through to Golos.
const archivo = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
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
// preload:false on the secondary faces — they'd otherwise add ~6 render-blocking
// font preloads to the critical path (12 total), starving HTML/CSS on slow links.
// Golos (Cyrillic display fallback) and JetBrains (metadata mono) load on demand
// and swap in; DM Sans (body) + Archivo Black (Latin display) stay preloaded.
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

const GTM_ID = "GTM-MB2CPXFD";
// Direct GA4 (gtag). The measurement ID is public (it ships in client JS), so a
// production default is fine; env can override per-deploy. Gated to production so
// local `next dev` doesn't pollute the GA4 property. GTM still loads independently.
const GA4_ID =
  process.env.NEXT_PUBLIC_GA4_ID ||
  (process.env.NODE_ENV === "production" ? "G-V2TNM71Q6G" : undefined);

// This layout owns <html>/<body> so the `lang` attribute reflects the URL
// locale (uk/ru/en) — the root layout is above the [lang] segment and can't
// read it. Every HTML page lives under /[lang], so this is the correct owner;
// the apex (/) only redirects and renders no markup.
export default async function LangLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return (
    <html lang={HTML_LANG[lang as Lang]} className={fontVars}>
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
        {/* GA4 (gtag) — conversion events fire via track() in lib/analytics.ts */}
        {GA4_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA4_ID}');`}
            </Script>
          </>
        )}
        {children}
      </body>
    </html>
  );
}
