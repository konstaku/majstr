import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLang, LANGS, nomName, OG_LOCALE, type Lang } from "@/lib/i18n";
import {
  getDataset,
  resolveCityBySlug,
  resolveCategoryBySlug,
  cityCategoryCombos,
  categoryIdOfProfession,
  cityNom,
  cityPrep,
} from "@/lib/data";
import { buildSeed } from "@/lib/seed";
import { abs } from "@/lib/urls";
import AppShell from "@/spa/AppShell";
import Main from "@/spa/pages/Main";

export const revalidate = 3600;
export const dynamicParams = true;

type Params = { lang: string; city: string; category: string };

export async function generateStaticParams(): Promise<Params[]> {
  const { masters, professions, locById } = await getDataset();
  const out: Params[] = [];
  for (const c of cityCategoryCombos(masters, professions)) {
    if (!locById.get(c.locationID)) continue;
    for (const lang of LANGS)
      out.push({ lang, city: c.locationID, category: c.categoryID });
  }
  return out;
}

async function resolve(p: Params) {
  if (!isLang(p.lang)) return null;
  const lang = p.lang as Lang;
  const ds = await getDataset();
  const city = resolveCityBySlug(p.city, ds.locations);
  const cat = resolveCategoryBySlug(p.category, ds.profCategories);
  if (!city || !cat) return null;
  const count = ds.masters.filter(
    (m) =>
      m.locationID === city.id &&
      categoryIdOfProfession(m.professionID, ds.professions) === cat.id
  ).length;
  if (count === 0) return null;
  return { lang, ds, city, cat, count };
}

const langAlt = (city: string, category: string) =>
  Object.fromEntries(LANGS.map((l) => [l, abs(`/${l}/${city}/${category}`)]));

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const r = await resolve(await params);
  if (!r) return {};
  const { lang, city, cat } = r;
  const catName = nomName(cat.name, lang);
  const title =
    lang === "ru"
      ? `${catName} ${cityPrep(city, lang)} — русскоязычные мастера | Majstr`
      : `${catName} ${cityPrep(city, lang)} — україномовні майстри | Majstr`;
  const description =
    lang === "ru"
      ? `${catName} ${cityPrep(city, lang)}: проверенные русскоязычные мастера. Цены, отзывы, запись напрямую в Telegram. Бесплатно, без посредников.`
      : `${catName} ${cityPrep(city, lang)}: перевірені україномовні майстри. Ціни, відгуки, запис напряму в Telegram. Безкоштовно, без посередників.`;
  return {
    title,
    description,
    alternates: {
      canonical: abs(`/${lang}/${city.id}/${cat.id}`),
      languages: langAlt(city.id, cat.id),
    },
    openGraph: { title, description, locale: OG_LOCALE[lang], type: "website" },
  };
}

export default async function CityCategoryPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const r = await resolve(await params);
  if (!r) notFound();
  return (
    <AppShell
      seed={buildSeed(r.lang, r.ds, {
        selectedCity: r.city.id,
        selectedProfessionCategory: r.cat.id,
      })}
    >
      <Main />
    </AppShell>
  );
}
