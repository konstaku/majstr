import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { isLang, type Lang } from "@/lib/i18n";
import { abs, homePath, languageAlternates } from "@/lib/urls";
import { API_BASE } from "@/lib/config";

interface PolicySection {
  id: string;
  title: { uk: string; en: string };
  body: { uk: string; en: string };
}

interface PrivacyPolicy {
  id: string;
  version: string;
  effectiveDate: string;
  lastUpdated: string;
  sections: PolicySection[];
}

async function getPrivacyPolicy(): Promise<PrivacyPolicy> {
  const res = await fetch(`${API_BASE}/api/legal/privacy-policy`, {
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`Privacy policy fetch failed: ${res.status}`);
  return res.json() as Promise<PrivacyPolicy>;
}

// Pick the content language: uk and en are available; ru falls back to uk.
function contentLang(lang: Lang): "uk" | "en" {
  return lang === "ru" ? "uk" : lang;
}

function privacyPath(lang: Lang) {
  return `/${lang}/privacy`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang: raw } = await params;
  if (!isLang(raw)) return {};
  const lang = raw as Lang;
  const title = "Privacy Policy | Majstr";
  return {
    title,
    alternates: {
      canonical: abs(privacyPath(lang)),
      languages: languageAlternates((l) => privacyPath(l)),
    },
    openGraph: {
      title,
      url: abs(privacyPath(lang)),
      type: "website",
    },
  };
}

// Render a body string: split on \n\n → <p>, **text** → <strong>, \n → <br />
function renderBody(text: string): React.ReactNode[] {
  return text.split(/\n\n/).map((para, i) => {
    // Split on **...** to find bold segments
    const parts = para.split(/\*\*([^*]+)\*\*/g);
    const children = parts.map((part, j) => {
      // Odd indices are the captured bold text
      if (j % 2 === 1) return <strong key={j}>{part}</strong>;
      // Replace single \n with <br /> within the paragraph
      const lines = part.split("\n");
      return lines.map((line, k) =>
        k < lines.length - 1 ? [line, <br key={`${j}-${k}`} />] : line
      );
    });
    return <p key={i} className="privacy-page__body-para">{children}</p>;
  });
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: raw } = await params;
  if (!isLang(raw)) notFound();
  const lang = raw as Lang;
  const cl = contentLang(lang);

  let policy: PrivacyPolicy;
  try {
    policy = await getPrivacyPolicy();
  } catch {
    notFound();
  }

  const formattedDate = new Date(policy.effectiveDate).toLocaleDateString(
    cl === "uk" ? "uk-UA" : "en-GB",
    { year: "numeric", month: "long", day: "numeric" }
  );

  return (
    <div className="privacy-page">
      <div className="privacy-page__inner">
        <Link href={homePath(lang)} className="privacy-page__back">
          &larr; Back
        </Link>

        <header className="privacy-page__header">
          <h1 className="privacy-page__title">Privacy Policy</h1>
          <p className="privacy-page__meta">
            Version {policy.version} &middot; Effective {formattedDate}
          </p>
        </header>

        {policy.sections.map((section) => (
          <section key={section.id} className="privacy-page__section">
            <h2 className="privacy-page__section-title">{section.title[cl]}</h2>
            <div className="privacy-page__section-body">
              {renderBody(section.body[cl])}
            </div>
          </section>
        ))}

        <footer className="privacy-page__footer">
          <Link href={homePath(lang)} className="privacy-page__back">
            &larr; Back to Majstr
          </Link>
        </footer>
      </div>
    </div>
  );
}
