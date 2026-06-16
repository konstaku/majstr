import type { Metadata } from "next";
import { SITE_URL } from "@/lib/config";
// The REAL design system, imported once globally (variables first).
import "@/spa/ui/tokens.css";
import "@/spa/styles.css";

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
  openGraph: { type: "website", siteName: "Majstr" },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/favicon.png" },
  // Search Console + Yandex Webmaster ownership. Tokens come from env (set in
  // Vercel); when absent the tags are simply omitted. Yandex matters as much as
  // Google here — it's where the RU diaspora pages are meant to rank.
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    yandex: process.env.YANDEX_VERIFICATION,
  },
};

// <html>/<body> live in app/[lang]/layout.tsx so the `lang` attribute can
// reflect the URL locale. This root only carries global CSS + base metadata
// and passes children through. Every HTML route is under /[lang]; the apex (/)
// redirects without rendering markup.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
