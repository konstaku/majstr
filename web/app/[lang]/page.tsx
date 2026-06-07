import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LANGS, isLang, OG_LOCALE, type Lang } from "@/lib/i18n";
import { getDataset } from "@/lib/data";
import { buildSeed } from "@/lib/seed";
import { abs, homePath, languageAlternates } from "@/lib/urls";
import { SITE_URL } from "@/lib/config";
import AppShell from "@/spa/AppShell";
import Main from "@/spa/pages/Main";
import JsonLd from "@/components/JsonLd";

export const revalidate = 3600;
export const dynamicParams = true;

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

function homeTitle(lang: Lang) {
  return lang === "ru"
    ? "Русско- и украиноязычные мастера в Италии | Majstr"
    : "Україно- та російськомовні майстри в Італії | Majstr";
}

// NOTE: deliberately does NOT read searchParams. Reading searchParams here opts
// the whole route out of static generation, forcing a per-request serverless
// render (x-vercel-cache: MISS, ~0.5-1s TTFB, no edge caching). The legacy
// ?card= OG-image injection isn't worth that cost — canonical master sharing is
// /{lang}/m/{slug} (with its own per-master OG), and the ?card modal still opens
// client-side. Keeping this static lets the home page be edge-cached like the
// city/master pages.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const title = homeTitle(lang);
  return {
    title,
    alternates: {
      canonical: abs(homePath(lang)),
      languages: languageAlternates((l) => homePath(l)),
    },
    openGraph: { title, url: abs(homePath(lang)), locale: OG_LOCALE[lang], type: "website" },
  };
}

export default async function Home({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: raw } = await params;
  if (!isLang(raw)) notFound();
  const lang = raw as Lang;
  const ds = await getDataset();
  const seed = buildSeed(lang, ds);

  return (
    <>
      <AppShell seed={seed}>
        <Main />
      </AppShell>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": `${SITE_URL}/#organization`,
              name: "Majstr",
              url: SITE_URL,
              areaServed: "IT",
            },
            {
              "@type": "WebSite",
              "@id": `${SITE_URL}/#website`,
              url: SITE_URL,
              name: "Majstr",
              inLanguage: lang === "ru" ? "ru" : "uk",
              publisher: { "@id": `${SITE_URL}/#organization` },
            },
          ],
        }}
      />
    </>
  );
}
