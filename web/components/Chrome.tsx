import Link from "next/link";
import { LANGS, T, type Lang } from "@/lib/i18n";

// Site header with brand + language switcher. `switchHref(lang)` returns the
// equivalent path in another language so users (and crawlers following links)
// can move between localized versions.
export function Header({
  lang,
  switchHref,
}: {
  lang: Lang;
  switchHref?: (l: Lang) => string;
}) {
  return (
    <header className="site-header">
      <div className="wrap">
        <Link href={`/${lang}`} className="brand" aria-label="Majstr">
          MAJ<span>STR</span>
        </Link>
        <nav className="lang-switch" aria-label="Language">
          {LANGS.map((l) => (
            <Link
              key={l}
              href={switchHref ? switchHref(l) : `/${l}`}
              className={l === lang ? "active" : ""}
              hrefLang={l}
            >
              {l === "uk" ? "УКР" : "РУС"}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function Footer({ lang }: { lang: Lang }) {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div>© Majstr · {T[lang].masonryTagline}</div>
        <div>{T[lang].free}</div>
      </div>
    </footer>
  );
}
