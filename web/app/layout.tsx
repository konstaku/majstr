import type { Metadata } from "next";
import { SITE_URL } from "@/lib/config";
// The REAL design system, imported once globally (variables first).
import "@/spa/ui/tokens.css";
import "@/spa/styles.css";
// Minimal styling for SEO-only blocks that don't exist in the app design
// (intro paragraph, FAQ, breadcrumbs, related-links). On-brand via tokens.
import "./seo.css";

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
    <html lang="uk">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Golos+Text:wght@800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&family=JetBrains+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
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
