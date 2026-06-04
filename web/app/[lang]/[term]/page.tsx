import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { LANGS, isLang, nomName, OG_LOCALE, T, type Lang } from "@/lib/i18n";
import {
  getDataset,
  resolveCityBySlug,
  resolveProfessionBySlug,
  professionSlug,
  professionLead,
  cityNom,
  cityPrep,
  professionsInCity,
  citiesOfProfession,
} from "@/lib/data";
import {
  cityHubTitle,
  cityHubDescription,
  professionHubTitle,
  professionHubDescription,
} from "@/lib/content";
import { abs, hubPath, landingPath, languageAlternates } from "@/lib/urls";
import { Header, Footer } from "@/components/Chrome";
import Breadcrumbs from "@/components/Breadcrumbs";

export const revalidate = 3600;
export const dynamicParams = true;

type Params = { lang: string; term: string };

export async function generateStaticParams(): Promise<Params[]> {
  const { masters, profById, locById } = await getDataset();
  const cityIds = new Set(masters.map((m) => m.locationID));
  const profIds = new Set(masters.map((m) => m.professionID));
  const out: Params[] = [];
  for (const lang of LANGS) {
    for (const id of cityIds) if (locById.get(id)) out.push({ lang, term: id });
    for (const id of profIds) {
      const p = profById.get(id);
      if (p) out.push({ lang, term: professionSlug(p.id, lang) });
    }
  }
  return out;
}

// Resolve a hub term as either a city (city hub) or a profession (profession hub).
async function resolve(p: Params) {
  if (!isLang(p.lang)) return null;
  const lang = p.lang as Lang;
  const { masters, professions, locations } = await getDataset();
  const city = resolveCityBySlug(p.term, locations);
  if (city && masters.some((m) => m.locationID === city.id))
    return { kind: "city" as const, lang, city };
  const prof = resolveProfessionBySlug(p.term, lang, professions);
  if (prof && masters.some((m) => m.professionID === prof.id))
    return { kind: "prof" as const, lang, prof };
  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const r = await resolve(await params);
  if (!r) return {};
  if (r.kind === "city") {
    const { lang, city } = r;
    const title = cityHubTitle(lang, cityPrep(city, lang));
    return {
      title,
      description: cityHubDescription(lang, cityPrep(city, lang)),
      alternates: {
        canonical: abs(hubPath(lang, city.id)),
        languages: languageAlternates((l) => hubPath(l, city.id)),
      },
      openGraph: { title, locale: OG_LOCALE[lang], type: "website" },
    };
  }
  const { lang, prof } = r;
  const lead = professionLead(prof, lang);
  const title = professionHubTitle(lang, lead);
  return {
    title,
    description: professionHubDescription(lang, lead),
    alternates: {
      canonical: abs(hubPath(lang, professionSlug(prof.id, lang))),
      languages: languageAlternates((l) => hubPath(l, professionSlug(prof.id, l))),
    },
    openGraph: { title, locale: OG_LOCALE[lang], type: "website" },
  };
}

export default async function HubPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const r = await resolve(await params);
  if (!r) notFound();
  const { masters, profById, locById } = await getDataset();

  if (r.kind === "city") {
    const { lang, city } = r;
    const profs = professionsInCity(masters, city.id);
    return (
      <>
        <Header lang={lang} switchHref={(l) => hubPath(l, city.id)} />
        <main className="wrap" lang={lang}>
          <Breadcrumbs
            items={[
              { name: "Majstr", href: `/${lang}` },
              { name: cityNom(city, lang), href: hubPath(lang, city.id) },
            ]}
          />
          <div className="page-head">
            <h1 className="title">
              {lang === "ru" ? "Мастера" : "Майстри"} {cityPrep(city, lang)}
            </h1>
            <p className="lead">{cityHubDescription(lang, cityPrep(city, lang))}</p>
          </div>
          <h2 className="section">{T[lang].professionsIn} {cityNom(city, lang)}</h2>
          <div className="pills">
            {profs.map((x) => {
              const p = profById.get(x.professionID);
              if (!p) return null;
              return (
                <Link
                  key={x.professionID}
                  className="pill"
                  href={landingPath(lang, professionSlug(p.id, lang), city.id)}
                >
                  {professionLead(p, lang)} <b>· {x.count}</b>
                </Link>
              );
            })}
          </div>
        </main>
        <Footer lang={lang} />
      </>
    );
  }

  const { lang, prof } = r;
  const lead = professionLead(prof, lang);
  const cities = citiesOfProfession(masters, prof.id);
  return (
    <>
      <Header lang={lang} switchHref={(l) => hubPath(l, professionSlug(prof.id, l))} />
      <main className="wrap" lang={lang}>
        <Breadcrumbs
          items={[
            { name: "Majstr", href: `/${lang}` },
            { name: lead, href: hubPath(lang, professionSlug(prof.id, lang)) },
          ]}
        />
        <div className="page-head">
          <h1 className="title">
            {lead} {lang === "ru" ? "в Италии" : "в Італії"}
          </h1>
          <p className="lead">{professionHubDescription(lang, lead)}</p>
        </div>
        <h2 className="section">{T[lang].citiesFor}</h2>
        <div className="pills">
          {cities.map((x) => {
            const c = locById.get(x.locationID);
            if (!c) return null;
            return (
              <Link
                key={x.locationID}
                className="pill"
                href={landingPath(lang, professionSlug(prof.id, lang), c.id)}
              >
                {cityNom(c, lang)} <b>· {x.count}</b>
              </Link>
            );
          })}
        </div>
      </main>
      <Footer lang={lang} />
    </>
  );
}
