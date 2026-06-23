import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { isLang, isCountry, countryID, COUNTRIES, isIndexable, INDEXED_LANGS, nomName, OG_LOCALE, type Lang } from "@/lib/i18n";
import {
  findMasterBySlug,
  allMasterParams,
  getDataset,
  professionLead,
  cityNom,
  cityPrep,
} from "@/lib/data";
import { masterTitle, masterDescription } from "@/lib/content";
import { abs, masterPath, languageAlternates } from "@/lib/urls";
import { buildSeed } from "@/lib/seed";
import AppShell from "@/spa/AppShell";
import Main from "@/spa/pages/Main";
import JsonLd from "@/components/JsonLd";

export const revalidate = 3600;
export const dynamicParams = true;

type Params = { country: string; lang: string; slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  // Pre-render only indexed locales; a gated locale (en while unpublished) still
  // renders on demand via dynamicParams, keeping build time/cost flat.
  const out: Params[] = [];
  for (const country of COUNTRIES) {
    const slugs = await allMasterParams(countryID(country));
    for (const lang of INDEXED_LANGS)
      for (const s of slugs) out.push({ country, lang, slug: s.slug });
  }
  return out;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { country: rawCountry, lang: raw, slug } = await params;
  if (!isLang(raw) || !isCountry(rawCountry)) return {};
  const lang = raw as Lang;
  const found = await findMasterBySlug(slug, countryID(rawCountry));
  if (!found || !found.prof || !found.loc) return {};
  const { master, prof, loc, canonical } = found;
  const profTitle = nomName(prof.name, lang) || professionLead(prof, lang);
  const title = masterTitle(lang, master.name, profTitle, cityPrep(loc, lang));
  const description = masterDescription(lang, master.name, profTitle, cityPrep(loc, lang));
  return {
    title,
    description,
    robots: isIndexable(lang) ? undefined : { index: false, follow: true },
    alternates: {
      canonical: abs(masterPath(lang, canonical)),
      languages: languageAlternates((l) => masterPath(l, canonical)),
    },
    openGraph: {
      title,
      description,
      url: abs(masterPath(lang, canonical)),
      locale: OG_LOCALE[lang],
      type: "profile",
      // Only the Playwright-rendered card image (backend generateOpenGraph).
      // Cards without one fall back to the site-wide opengraph-image.
      ...(master.OGimage ? { images: [master.OGimage] } : {}),
    },
  };
}

export default async function MasterPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { country: rawCountry, lang: raw, slug } = await params;
  if (!isLang(raw) || !isCountry(rawCountry)) notFound();
  const lang = raw as Lang;
  const found = await findMasterBySlug(slug, countryID(rawCountry));
  if (!found || !found.prof || !found.loc) notFound();
  const { master, prof, loc, canonical } = found;
  if (canonical !== slug) permanentRedirect(masterPath(lang, canonical));

  const ds = await getDataset(countryID(rawCountry));
  const profTitle = nomName(prof.name, lang) || professionLead(prof, lang);
  const hasRating = typeof master.rating === "number" && master.rating > 0;

  // Open this master's modal on the main page, with its city + category
  // filters pre-set — exactly the SPA experience.
  const seed = buildSeed(
    lang,
    ds,
    {
      selectedCity: loc.id,
      selectedProfessionCategory: prof.categoryID ?? "",
    },
    master._id, // keep this master full so the pre-opened modal needs no fetch
    countryID(rawCountry)
  );

  return (
    <>
      <AppShell seed={seed}>
        <Main initialCard={master._id} />
      </AppShell>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Person",
          name: master.name,
          jobTitle: profTitle,
          knowsLanguage: ["uk", "ru"],
          areaServed: cityNom(loc, lang),
          ...(master.about ? { description: master.about } : {}),
          ...(master.photo ? { image: master.photo } : {}),
          address: {
            "@type": "PostalAddress",
            addressLocality: cityNom(loc, lang),
            addressCountry: "IT",
          },
          ...(hasRating
            ? {
                aggregateRating: {
                  "@type": "AggregateRating",
                  ratingValue: master.rating,
                  reviewCount: master.reviewCount ?? 1,
                },
              }
            : {}),
        }}
      />
    </>
  );
}
