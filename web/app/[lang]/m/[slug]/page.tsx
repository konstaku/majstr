import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { isLang, LANGS, nomName, OG_LOCALE, type Lang } from "@/lib/i18n";
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

type Params = { lang: string; slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  const slugs = await allMasterParams();
  return LANGS.flatMap((lang) => slugs.map((s) => ({ lang, slug: s.slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { lang: raw, slug } = await params;
  if (!isLang(raw)) return {};
  const lang = raw as Lang;
  const found = await findMasterBySlug(slug);
  if (!found || !found.prof || !found.loc) return {};
  const { master, prof, loc, canonical } = found;
  const profTitle = nomName(prof.name, lang) || professionLead(prof, lang);
  const title = masterTitle(lang, master.name, profTitle, cityPrep(loc, lang));
  const description = masterDescription(lang, master.name, profTitle, cityPrep(loc, lang));
  const img = master.OGimage || master.photo;
  return {
    title,
    description,
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
      images: [img || "/og-image.png"],
    },
  };
}

export default async function MasterPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { lang: raw, slug } = await params;
  if (!isLang(raw)) notFound();
  const lang = raw as Lang;
  const found = await findMasterBySlug(slug);
  if (!found || !found.prof || !found.loc) notFound();
  const { master, prof, loc, canonical } = found;
  if (canonical !== slug) permanentRedirect(masterPath(lang, canonical));

  const ds = await getDataset();
  const profTitle = nomName(prof.name, lang) || professionLead(prof, lang);
  const hasRating = typeof master.rating === "number" && master.rating > 0;

  // Open this master's modal on the main page, with its city + category
  // filters pre-set — exactly the SPA experience.
  const seed = buildSeed(lang, ds, {
    selectedCity: loc.id,
    selectedProfessionCategory: prof.categoryID ?? "",
  });

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
