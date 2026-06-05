import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLang, LANGS, nomName, OG_LOCALE, type Lang } from "@/lib/i18n";
import {
  getDataset,
  resolveCityBySlug,
  resolveCategoryBySlug,
  categoriesWithMasters,
  cityPrep,
} from "@/lib/data";
import { buildSeed } from "@/lib/seed";
import { abs } from "@/lib/urls";
import AppShell from "@/spa/AppShell";
import Main from "@/spa/pages/Main";

export const revalidate = 3600;
export const dynamicParams = true;

type Params = { lang: string; city: string };

export async function generateStaticParams(): Promise<Params[]> {
  const { masters, locById, professions } = await getDataset();
  const out: Params[] = [];
  const cityIds = new Set(masters.map((m) => m.locationID));
  const cats = categoriesWithMasters(masters, professions);
  for (const lang of LANGS) {
    for (const id of cityIds) if (locById.get(id)) out.push({ lang, city: id });
    for (const c of cats) out.push({ lang, city: c });
  }
  return out;
}

async function resolve(p: Params) {
  if (!isLang(p.lang)) return null;
  const lang = p.lang as Lang;
  const ds = await getDataset();
  const city = resolveCityBySlug(p.city, ds.locations);
  if (city && ds.masters.some((m) => m.locationID === city.id))
    return { lang, ds, kind: "city" as const, city };
  const cat = resolveCategoryBySlug(p.city, ds.profCategories);
  if (cat && categoriesWithMasters(ds.masters, ds.professions).has(cat.id))
    return { lang, ds, kind: "cat" as const, cat };
  return null;
}

const langAlt = (seg: string) =>
  Object.fromEntries(LANGS.map((l) => [l, abs(`/${l}/${seg}`)]));

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const r = await resolve(await params);
  if (!r) return {};
  if (r.kind === "city") {
    const { lang, city } = r;
    const title =
      lang === "ru"
        ? `Русскоязычные мастера ${cityPrep(city, lang)} | Majstr`
        : `Україномовні майстри ${cityPrep(city, lang)} | Majstr`;
    return {
      title,
      alternates: { canonical: abs(`/${lang}/${city.id}`), languages: langAlt(city.id) },
      openGraph: { title, locale: OG_LOCALE[lang], type: "website" },
    };
  }
  const { lang, cat } = r;
  const catName = nomName(cat.name, lang);
  const title =
    lang === "ru"
      ? `${catName} в Италии — русскоязычные мастера | Majstr`
      : `${catName} в Італії — україномовні майстри | Majstr`;
  return {
    title,
    alternates: { canonical: abs(`/${lang}/${cat.id}`), languages: langAlt(cat.id) },
    openGraph: { title, locale: OG_LOCALE[lang], type: "website" },
  };
}

export default async function FilterPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const r = await resolve(await params);
  if (!r) notFound();
  const sp =
    r.kind === "city"
      ? { selectedCity: r.city.id }
      : { selectedProfessionCategory: r.cat.id };
  return (
    <AppShell seed={buildSeed(r.lang, r.ds, sp)}>
      <Main />
    </AppShell>
  );
}
