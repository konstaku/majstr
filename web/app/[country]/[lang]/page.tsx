import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  LANGS,
  COUNTRIES,
  isLang,
  isCountry,
  countryID,
  isIndexable,
  OG_LOCALE,
  COUNTRY_IN,
  COUNTRY_ISO,
  type Lang,
  type Country,
} from "@/lib/i18n";
import { getDataset } from "@/lib/data";
import { buildSeed } from "@/lib/seed";
import { abs, homePath, languageAlternates, defaultOgImage, originFor } from "@/lib/urls";
import AppShell from "@/spa/AppShell";
import Main from "@/spa/pages/Main";
import JsonLd from "@/components/JsonLd";

export const revalidate = 3600;
export const dynamicParams = true;

export function generateStaticParams() {
  return COUNTRIES.flatMap((country) => LANGS.map((lang) => ({ country, lang })));
}

function homeTitle(lang: Lang, country: Country) {
  const inC = COUNTRY_IN[country][lang];
  if (lang === "ru") return `Русско- и украиноязычные мастера ${inC} | Majstr`;
  if (lang === "en") return `Ukrainian- and Russian-speaking masters ${inC} | Majstr`;
  return `Україно- та російськомовні майстри ${inC} | Majstr`;
}

function homeDescription(lang: Lang, country: Country) {
  const inC = COUNTRY_IN[country][lang];
  if (lang === "ru")
    return `Majstr — каталог проверенных русско- и украиноязычных мастеров ${inC}: маникюр, парикмахеры, косметологи, электрики, врачи и другие. Запись в Telegram, бесплатно.`;
  if (lang === "en")
    return `Majstr — directory of trusted Ukrainian- and Russian-speaking masters ${inC}: manicurists, hairdressers, beauticians, electricians, doctors and more. Book on Telegram, free.`;
  return `Majstr — каталог перевірених україно- та російськомовних майстрів ${inC}: манікюр, перукарі, косметологи, електрики, лікарі та інші. Запис у Telegram, безкоштовно.`;
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
  params: Promise<{ country: string; lang: string }>;
}): Promise<Metadata> {
  const { country: rawCountry, lang } = await params;
  if (!isLang(lang) || !isCountry(rawCountry)) return {};
  const title = homeTitle(lang, rawCountry);
  const description = homeDescription(lang, rawCountry);
  return {
    title,
    description,
    robots: isIndexable(lang) ? undefined : { index: false, follow: true },
    alternates: {
      canonical: abs(homePath(lang), rawCountry),
      languages: languageAlternates((l) => homePath(l), rawCountry),
    },
    openGraph: { title, description, url: abs(homePath(lang), rawCountry), locale: OG_LOCALE[lang], type: "website", images: [defaultOgImage(rawCountry)] },
  };
}

export default async function Home({
  params,
}: {
  params: Promise<{ country: string; lang: string }>;
}) {
  const { country: rawCountry, lang: raw } = await params;
  if (!isLang(raw) || !isCountry(rawCountry)) notFound();
  const lang = raw as Lang;
  const ds = await getDataset(countryID(rawCountry));
  const seed = buildSeed(lang, ds, undefined, undefined, countryID(rawCountry));
  const origin = originFor(rawCountry);

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
              "@id": `${origin}/#organization`,
              name: "Majstr",
              url: origin,
              areaServed: COUNTRY_ISO[rawCountry],
            },
            {
              "@type": "WebSite",
              "@id": `${origin}/#website`,
              url: origin,
              name: "Majstr",
              inLanguage: lang,
              publisher: { "@id": `${origin}/#organization` },
            },
          ],
        }}
      />
    </>
  );
}
