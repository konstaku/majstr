import Link from "next/link";
import type { Master } from "@/lib/api";
import { masterPath } from "@/lib/urls";
import { T, type Lang } from "@/lib/i18n";

// A single master in a results grid. Links to the master page. We render an
// initials avatar (not the scraped image) to avoid republishing third-party
// photos and broken-image noise; contacts live on the master page behind a CTA.
export default function MasterCard({
  master,
  slug,
  profName,
  lang,
}: {
  master: Master;
  slug: string;
  profName: string;
  lang: Lang;
}) {
  const initial = (master.name || "•").trim().charAt(0).toUpperCase();
  const tags = master.tags?.[lang === "uk" ? "ua" : "ru"] ?? master.tags?.ua ?? [];
  const hasRating = typeof master.rating === "number" && master.rating! > 0;
  return (
    <Link href={masterPath(lang, slug)} className="card">
      <div className="card-top">
        <div className="avatar" aria-hidden>
          {initial}
        </div>
        <div>
          <div className="card-name">{master.name}</div>
          <div className="card-prof">{profName}</div>
        </div>
      </div>
      {hasRating && (
        <div className="card-meta">
          <span className="rating">★ {master.rating!.toFixed(1)}</span>
          {master.reviewCount ? <span>·&nbsp;{master.reviewCount}</span> : null}
        </div>
      )}
      {tags.length > 0 && (
        <div className="tag-row">
          {tags.slice(0, 3).map((t, i) => (
            <span className="tag" key={i}>
              {t}
            </span>
          ))}
        </div>
      )}
      <div className="card-cta">{T[lang].viewProfile} →</div>
    </Link>
  );
}
