import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { LANGS, isLang, nomName, OG_LOCALE, T, mastersCount, type Lang } from "@/lib/i18n";
import {
  getDataset,
  professionLead,
  professionSlug,
  cityNom,
} from "@/lib/data";
import { abs, hubPath, homePath, languageAlternates } from "@/lib/urls";
import { SITE_URL } from "@/lib/config";
import { Header, Footer } from "@/components/Chrome";
import JsonLd from "@/components/JsonLd";

export const revalidate = 3600;
export const dynamicParams = true;

type Params = { lang: string };

export function generateStaticParams(): Params[] {
  return LANGS.map((lang) => ({ lang }));
}

function homeTitle(lang: Lang) {
  return lang === "ru"
    ? "Русско- и украиноязычные мастера в Италии | Majstr"
    : "Україно- та російськомовні майстри в Італії | Majstr";
}
function homeH1(lang: Lang) {
  return lang === "ru"
    ? "Русскоязычные мастера в Италии"
    : "Україномовні майстри в Італії";
}
function homeIntro(lang: Lang, count: number) {
  return lang === "ru"
    ? `Majstr — бесплатный каталог проверенных русско- и украиноязычных мастеров в Италии. ${count} специалистов: маникюр, парикмахеры, косметологи, массаж, электрики, сантехники, врачи, переводчики и другие. Выберите город и услугу, читайте отзывы и записывайтесь напрямую через Telegram — без посредников и комиссии.`
    : `Majstr — безкоштовний каталог перевірених україно- та російськомовних майстрів в Італії. ${count} спеціалістів: манікюр, перукарі, косметологи, масаж, електрики, сантехніки, лікарі, перекладачі та інші. Оберіть місто й послугу, читайте відгуки та записуйтесь напряму через Telegram — без посередників і комісії.`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
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

export default async function Home({ params }: { params: Promise<Params> }) {
  const { lang: raw } = await params;
  if (!isLang(raw)) notFound();
  const lang = raw as Lang;
  const { masters, profById, locById } = await getDataset();

  const cityCounts = new Map<string, number>();
  const profCounts = new Map<string, number>();
  for (const m of masters) {
    cityCounts.set(m.locationID, (cityCounts.get(m.locationID) ?? 0) + 1);
    profCounts.set(m.professionID, (profCounts.get(m.professionID) ?? 0) + 1);
  }
  const cities = [...cityCounts.entries()]
    .map(([id, count]) => ({ loc: locById.get(id), count }))
    .filter((x) => x.loc)
    .sort((a, b) => b.count - a.count);
  const profs = [...profCounts.entries()]
    .map(([id, count]) => ({ prof: profById.get(id), count }))
    .filter((x) => x.prof)
    .sort((a, b) => b.count - a.count)
    .slice(0, 18);

  return (
    <>
      <Header lang={lang} switchHref={(l) => homePath(l)} />
      <main className="wrap" lang={lang}>
        <div className="page-head">
          <span className="kicker">{T[lang].masonryTagline}</span>
          <h1 className="title">{homeH1(lang)}</h1>
          <p className="lead">{homeIntro(lang, masters.length)}</p>
        </div>

        <h2 className="section">{T[lang].citiesFor}</h2>
        <div className="pills">
          {cities.map(({ loc, count }) => (
            <Link key={loc!.id} className="pill" href={hubPath(lang, loc!.id)}>
              {cityNom(loc!, lang)} <b>· {count}</b>
            </Link>
          ))}
        </div>

        <h2 className="section">
          {lang === "ru" ? "Популярные услуги" : "Популярні послуги"}
        </h2>
        <div className="pills">
          {profs.map(({ prof, count }) => (
            <Link
              key={prof!.id}
              className="pill"
              href={hubPath(lang, professionSlug(prof!.id, lang))}
            >
              {professionLead(prof!, lang)} <b>· {count}</b>
            </Link>
          ))}
        </div>
      </main>
      <Footer lang={lang} />

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
