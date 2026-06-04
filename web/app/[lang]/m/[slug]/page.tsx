import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { isLang, LANGS, nomName, OG_LOCALE, T, type Lang } from "@/lib/i18n";
import type { Contact } from "@/lib/api";
import {
  findMasterBySlug,
  allMasterParams,
  professionLead,
  professionSlug,
  cityNom,
  cityPrep,
} from "@/lib/data";
import { masterTitle, masterDescription } from "@/lib/content";
import { abs, masterPath, landingPath, hubPath, languageAlternates } from "@/lib/urls";
import { Header, Footer } from "@/components/Chrome";
import Breadcrumbs from "@/components/Breadcrumbs";
import JsonLd from "@/components/JsonLd";

export const revalidate = 3600;
export const dynamicParams = true;

type Params = { lang: string; slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  const slugs = await allMasterParams();
  return LANGS.flatMap((lang) => slugs.map((s) => ({ lang, slug: s.slug })));
}

function contactHref(c: Contact): string | null {
  const v = (c.value || "").trim();
  switch (c.contactType) {
    case "telegram":
      return `https://t.me/${v.replace(/^@/, "")}`;
    case "instagram":
      return `https://instagram.com/${v.replace(/^@/, "")}`;
    case "phone":
      return `tel:${v.replace(/\s+/g, "")}`;
    case "whatsapp":
      return `https://wa.me/${v.replace(/[^\d]/g, "")}`;
    default:
      return v.startsWith("http") ? v : null;
  }
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
      images: master.OGimage ? [master.OGimage] : ["/og-image.png"],
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

  const profTitle = nomName(prof.name, lang) || professionLead(prof, lang);
  const prep = cityPrep(loc, lang);
  const initial = (master.name || "•").trim().charAt(0).toUpperCase();
  const tags = master.tags?.[lang === "uk" ? "ua" : "ru"] ?? master.tags?.ua ?? [];
  const hasRating = typeof master.rating === "number" && master.rating > 0;

  const primary = (master.contacts ?? []).find((c) => c.contactType === "telegram") ??
    (master.contacts ?? [])[0];
  const cta = primary ? contactHref(primary) : null;

  return (
    <>
      <Header lang={lang} switchHref={(l) => masterPath(l, canonical)} />
      <main className="wrap" lang={lang}>
        <Breadcrumbs
          items={[
            { name: "Majstr", href: `/${lang}` },
            { name: cityNom(loc, lang), href: hubPath(lang, loc.id) },
            {
              name: professionLead(prof, lang),
              href: landingPath(lang, professionSlug(prof.id, lang), loc.id),
            },
            { name: master.name, href: masterPath(lang, canonical) },
          ]}
        />

        <div className="master-hero">
          <div className="avatar" aria-hidden>
            {initial}
          </div>
          <div>
            <h1 className="title" style={{ fontSize: "clamp(26px,5vw,40px)" }}>
              {master.name}
            </h1>
            <p className="card-prof" style={{ fontSize: 16 }}>
              {profTitle} · {prep}
            </p>
            {hasRating && (
              <p className="card-meta">
                <span className="rating">★ {master.rating!.toFixed(1)}</span>
                {master.reviewCount ? <span>·&nbsp;{master.reviewCount}</span> : null}
              </p>
            )}
          </div>
        </div>

        {master.about && <p className="master-about">{master.about}</p>}

        {tags.length > 0 && (
          <div className="tag-row" style={{ marginBottom: 18 }}>
            {tags.map((t, i) => (
              <span className="tag" key={i}>
                {t}
              </span>
            ))}
          </div>
        )}

        {cta && (
          <p>
            <a className="cta-btn" href={cta} target="_blank" rel="nofollow noopener">
              {T[lang].bookTelegram}
            </a>
          </p>
        )}

        <p>
          <Link
            href={landingPath(lang, professionSlug(prof.id, lang), loc.id)}
            className="card-cta"
          >
            ← {professionLead(prof, lang)} {prep}
          </Link>
        </p>
      </main>
      <Footer lang={lang} />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Person",
          name: master.name,
          jobTitle: profTitle,
          knowsLanguage: ["uk", "ru"],
          areaServed: cityNom(loc, lang),
          ...(master.about ? { description: master.about } : {}),
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
