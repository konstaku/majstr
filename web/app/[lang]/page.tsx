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

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ card?: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const { card } = await searchParams;
  const title = homeTitle(lang);
  const base: Metadata = {
    title,
    alternates: {
      canonical: abs(homePath(lang)),
      languages: languageAlternates((l) => homePath(l)),
    },
    openGraph: { title, url: abs(homePath(lang)), locale: OG_LOCALE[lang], type: "website" },
  };

  // When a card modal is open (?card=<id>), inject its OG image so sharing
  // the URL shows the master's card image rather than a blank preview.
  if (card) {
    const { master } = await getDataset().then(ds => ({
      master: ds.masters.find(m => m._id === card),
    }));
    if (master) {
      base.openGraph = {
        ...base.openGraph,
        images: [`${SITE_URL}/api/og?id=${card}`],
      };
    }
  }

  return base;
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
