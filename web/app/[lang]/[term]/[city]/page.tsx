import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { LANGS, isLang, nomName, OG_LOCALE, T, type Lang } from "@/lib/i18n";
import {
  getDataset,
  landingCombos,
  mastersFor,
  resolveProfessionBySlug,
  resolveCityBySlug,
  professionSlug,
  professionLead,
  professionSub,
  cityNom,
  cityPrep,
  masterSlug,
  citiesOfProfession,
  professionsInCity,
} from "@/lib/data";
import {
  landingTitle,
  landingDescription,
  landingH1,
  landingIntro,
  landingBody,
  landingFaq,
} from "@/lib/content";
import { abs, landingPath, hubPath, masterPath, languageAlternates } from "@/lib/urls";
import { Header, Footer } from "@/components/Chrome";
import Breadcrumbs from "@/components/Breadcrumbs";
import MasterCard from "@/components/MasterCard";
import FaqBlock from "@/components/Faq";
import JsonLd from "@/components/JsonLd";

export const revalidate = 3600;
export const dynamicParams = true;

type Params = { lang: string; term: string; city: string };

export async function generateStaticParams(): Promise<Params[]> {
  const { masters, profById, locById } = await getDataset();
  const out: Params[] = [];
  for (const c of landingCombos(masters)) {
    const prof = profById.get(c.professionID);
    const loc = locById.get(c.locationID);
    if (!prof || !loc) continue;
    for (const lang of LANGS)
      out.push({ lang, term: professionSlug(prof.id, lang), city: loc.id });
  }
  return out;
}

async function resolve(p: Params) {
  if (!isLang(p.lang)) return null;
  const lang = p.lang as Lang;
  const { masters, professions, locations } = await getDataset();
  const prof = resolveProfessionBySlug(p.term, lang, professions);
  const loc = resolveCityBySlug(p.city, locations);
  if (!prof || !loc) return null;
  const list = mastersFor(masters, prof.id, loc.id);
  if (list.length === 0) return null;
  return { lang, prof, loc, list };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const r = await resolve(await params);
  if (!r) return {};
  const { lang, prof, loc, list } = r;
  const lead = professionLead(prof, lang);
  const title = landingTitle(lang, lead, cityNom(loc, lang), list.length);
  const description = landingDescription(lang, lead, cityPrep(loc, lang));
  const canonical = landingPath(lang, professionSlug(prof.id, lang), loc.id);
  return {
    title,
    description,
    alternates: {
      canonical: abs(canonical),
      languages: languageAlternates((l) =>
        landingPath(l, professionSlug(prof.id, l), loc.id)
      ),
    },
    openGraph: {
      title,
      description,
      url: abs(canonical),
      locale: OG_LOCALE[lang],
      type: "website",
    },
  };
}

export default async function LandingPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const r = await resolve(await params);
  if (!r) notFound();
  const { lang, prof, loc, list } = r;
  const { profById, locById } = await getDataset();

  const lead = professionLead(prof, lang);
  const prep = cityPrep(loc, lang);
  const h1 = landingH1(lead, prep);
  const intro = landingIntro(lang, lead, prep, loc.id, list.length, professionSub(prof.id, lang));
  const body = landingBody(lang, prof.id);
  const faq = landingFaq(lang, lead, prep);
  const profTitle = nomName(prof.name, lang) || lead;

  // Cards with precomputed slugs
  const cards = list.map((m) => ({
    master: m,
    slug: masterSlug(m, prof, loc),
  }));

  // Link mesh
  const { masters } = await getDataset();
  const otherProfs = professionsInCity(masters, loc.id)
    .filter((x) => x.professionID !== prof.id)
    .slice(0, 12);
  const otherCities = citiesOfProfession(masters, prof.id)
    .filter((x) => x.locationID !== loc.id)
    .slice(0, 12);

  const switchHref = (l: Lang) =>
    landingPath(l, professionSlug(prof.id, l), loc.id);

  return (
    <>
      <Header lang={lang} switchHref={switchHref} />
      <main className="wrap" lang={lang}>
        <Breadcrumbs
          items={[
            { name: "Majstr", href: `/${lang}` },
            { name: cityNom(loc, lang), href: hubPath(lang, loc.id) },
            { name: lead, href: landingPath(lang, professionSlug(prof.id, lang), loc.id) },
          ]}
        />

        <div className="page-head">
          <span className="kicker">{T[lang].masonryTagline}</span>
          <h1 className="title">{h1}</h1>
          <p className="speaks-note">{T[lang].speaksNote}</p>
        </div>

        <section className="grid">
          {cards.map(({ master, slug }) => (
            <MasterCard
              key={master._id}
              master={master}
              slug={slug}
              profName={profTitle}
              lang={lang}
            />
          ))}
        </section>

        <section className="prose" style={{ marginTop: 28 }}>
          <p>{intro}</p>
          <p>{body}</p>
        </section>

        {otherProfs.length > 0 && (
          <>
            <h2 className="section">
              {T[lang].otherProfessions} {cityNom(loc, lang)}
            </h2>
            <div className="pills">
              {otherProfs.map((x) => {
                const op = profById.get(x.professionID);
                if (!op) return null;
                return (
                  <Link
                    key={x.professionID}
                    className="pill"
                    href={landingPath(lang, professionSlug(op.id, lang), loc.id)}
                  >
                    {professionLead(op, lang)} <b>· {x.count}</b>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        {otherCities.length > 0 && (
          <>
            <h2 className="section">
              {lead} — {T[lang].otherCities}
            </h2>
            <div className="pills">
              {otherCities.map((x) => {
                const oc = locById.get(x.locationID);
                if (!oc) return null;
                return (
                  <Link
                    key={x.locationID}
                    className="pill"
                    href={landingPath(lang, professionSlug(prof.id, lang), oc.id)}
                  >
                    {cityNom(oc, lang)} <b>· {x.count}</b>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        <FaqBlock items={faq} lang={lang} />
      </main>
      <Footer lang={lang} />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: h1,
          numberOfItems: cards.length,
          itemListElement: cards.map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: abs(masterPath(lang, c.slug)),
            name: c.master.name,
          })),
        }}
      />
    </>
  );
}
