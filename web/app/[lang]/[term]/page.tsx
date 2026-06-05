import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { LANGS, isLang, OG_LOCALE, T, type Lang } from "@/lib/i18n";
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
import { buildSeed } from "@/lib/seed";
import AppShell from "@/spa/AppShell";
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
  const ds = await getDataset();
  const { masters, profById, locById } = ds;
  const seed = buildSeed(r.lang, ds, []);

  if (r.kind === "city") {
    const { lang, city } = r;
    const profs = professionsInCity(masters, city.id);
    return (
      <AppShell seed={seed}>
        <div className="seo-wrap">
          <Breadcrumbs
            items={[
              { name: "Majstr", href: `/${lang}` },
              { name: cityNom(city, lang), href: hubPath(lang, city.id) },
            ]}
          />
          <div className="seo-head">
            <h1 className="seo-h1">
              {lang === "ru" ? "Мастера" : "Майстри"} {cityPrep(city, lang)}
            </h1>
            <p className="seo-prose">{cityHubDescription(lang, cityPrep(city, lang))}</p>
          </div>
          <h2 className="seo-section-title">
            {T[lang].professionsIn} {cityNom(city, lang)}
          </h2>
          <div className="seo-related">
            {profs.map((x) => {
              const p = profById.get(x.professionID);
              if (!p) return null;
              return (
                <Link
                  key={x.professionID}
                  className="seo-pill"
                  href={landingPath(lang, professionSlug(p.id, lang), city.id)}
                >
                  {professionLead(p, lang)} <b>· {x.count}</b>
                </Link>
              );
            })}
          </div>
        </div>
      </AppShell>
    );
  }

  const { lang, prof } = r;
  const lead = professionLead(prof, lang);
  const cities = citiesOfProfession(masters, prof.id);
  return (
    <AppShell seed={seed}>
      <div className="seo-wrap">
        <Breadcrumbs
          items={[
            { name: "Majstr", href: `/${lang}` },
            { name: lead, href: hubPath(lang, professionSlug(prof.id, lang)) },
          ]}
        />
        <div className="seo-head">
          <h1 className="seo-h1">
            {lead} {lang === "ru" ? "в Италии" : "в Італії"}
          </h1>
          <p className="seo-prose">{professionHubDescription(lang, lead)}</p>
        </div>
        <h2 className="seo-section-title">{T[lang].citiesFor}</h2>
        <div className="seo-related">
          {cities.map((x) => {
            const c = locById.get(x.locationID);
            if (!c) return null;
            return (
              <Link
                key={x.locationID}
                className="seo-pill"
                href={landingPath(lang, professionSlug(prof.id, lang), c.id)}
              >
                {cityNom(c, lang)} <b>· {x.count}</b>
              </Link>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
