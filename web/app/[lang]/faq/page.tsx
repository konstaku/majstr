import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLang, isIndexable, LANGS, OG_LOCALE, type Lang } from "@/lib/i18n";
import { abs, languageAlternates, DEFAULT_OG_IMAGE } from "@/lib/urls";
import AppShell from "@/spa/AppShell";
import Faq from "@/spa/components/Faq";

export const revalidate = 86400;

const faqPath = (lang: Lang) => `/${lang}/faq`;

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

function meta(lang: Lang) {
  if (lang === "ru")
    return {
      title: "Частые вопросы — Majstr",
      description:
        "Как работает Majstr: откуда данные, что значит «перевірено», как мастеру добавить или удалить профиль, юридические и финансовые вопросы.",
    };
  if (lang === "en")
    return {
      title: "FAQ — Majstr",
      description:
        "How Majstr works: where the data comes from, what «перевірено» means, how masters add or remove a profile, plus legal and financial questions.",
    };
  return {
    title: "Поширені запитання — Majstr",
    description:
      "Як працює Majstr: звідки дані, що означає «перевірено», як майстру додати чи видалити профіль, юридичні та фінансові питання.",
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang: raw } = await params;
  if (!isLang(raw)) return {};
  const lang = raw as Lang;
  const { title, description } = meta(lang);
  return {
    title,
    description,
    robots: isIndexable(lang) ? undefined : { index: false, follow: true },
    alternates: {
      canonical: abs(faqPath(lang)),
      languages: languageAlternates(faqPath),
    },
    openGraph: { title, description, url: abs(faqPath(lang)), locale: OG_LOCALE[lang], type: "website", images: [DEFAULT_OG_IMAGE] },
  };
}

export default async function FaqPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: raw } = await params;
  if (!isLang(raw)) notFound();
  const lang = raw as Lang;

  // Minimal seed: FAQ shows no masters; seed only what the shared header/footer
  // need. countrySet:false keeps Root from fetching masters.
  const seed = { lang, countrySet: false, loading: false };

  return (
    <AppShell seed={seed} showWordmark={false}>
      <main className="faq-page">
        <section className="faq-head">
          <div className="faq-head-inner">
            <div>
              <div className="faq-kicker">Поширені запитання</div>
              <h1 className="faq-h1">FAQ</h1>
            </div>
            <p className="faq-note">
              Не знайшли відповідь? Напишіть мені в телеграм{" "}
              <a href="https://t.me/wondercooler">@wondercooler</a>
            </p>
          </div>
        </section>
        <Faq lang={lang} />
      </main>
    </AppShell>
  );
}
