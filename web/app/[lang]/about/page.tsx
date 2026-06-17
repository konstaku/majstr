import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  isLang,
  isIndexable,
  LANGS,
  OG_LOCALE,
  type Lang,
} from "@/lib/i18n";
import { abs, homePath, languageAlternates } from "@/lib/urls";
import AppShell from "@/spa/AppShell";

export const revalidate = 86400;

const aboutPath = (lang: Lang) => `/${lang}/about`;

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

function meta(lang: Lang) {
  if (lang === "ru")
    return {
      title: "О нас — Majstr",
      description:
        "Почему появился Majstr: личная история основателя и каталог украино- и русскоязычных специалистов в Италии, собранный из рекомендаций сообщества.",
    };
  if (lang === "en")
    return {
      title: "About — Majstr",
      description:
        "Why Majstr exists: the founder's story and a curated directory of Ukrainian- and Russian-speaking specialists in Italy, built from community recommendations.",
    };
  return {
    title: "Про нас — Majstr",
    description:
      "Чому з'явився Majstr: особиста історія засновника й каталог україно- та російськомовних фахівців в Італії, зібраний із рекомендацій спільноти.",
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
      canonical: abs(aboutPath(lang)),
      languages: languageAlternates(aboutPath),
    },
    openGraph: { title, description, url: abs(aboutPath(lang)), locale: OG_LOCALE[lang], type: "website" },
  };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: raw } = await params;
  if (!isLang(raw)) notFound();
  const lang = raw as Lang;

  // Minimal seed: the About page shows no masters, so seed only what the shared
  // header/footer need (lang). countrySet:false keeps Root from fetching masters.
  const seed = { lang, countrySet: false, loading: false };

  return (
    <AppShell seed={seed}>
      <main className="about-page">
        <div className="about-inner">
          <div className="about-kicker">Про нас</div>
          <h1 className="about-h1">
            Як з&apos;явився <span className="about-h1-accent">Majstr</span>
          </h1>

          <p className="about-lead">
            Мене звуть Константин, я живу в Італії з 2023 року. Я люблю цю країну, але
            кілька разів потрапляв у неприємні ситуації.
          </p>

          <div className="about-body">
            <figure className="about-portrait">
              <div className="about-photo">
                <Image
                  src="/konsta.jpg"
                  alt="Константин, засновник Majstr"
                  width={460}
                  height={460}
                  sizes="(max-width: 880px) 200px, 230px"
                />
              </div>
              <figcaption className="about-cap">
                <span className="about-cap-name">Константин</span>
                <span className="about-cap-role">Засновник Majstr</span>
              </figcaption>
            </figure>

            <p>
              Шукав квартиру у ріелторів, які не хотіли її здавати, переплачував за
              ремонт автомобіля, а одного разу опинився в швидкій через те, що лікарка
              мене не розуміла і призначала таблетки замість обстеження.
            </p>
            <p>
              Вірю, що цього б не сталося, якби я знав контакти лікаря, ріелтора та інших
              фахівців, <strong>з якими ми говоримо однією мовою</strong>.
            </p>
            <p>
              Я зробив сервіс majstr: курований каталог україномовних та російськомовних
              фахівців, заснований на рекомендаціях людей у телеграм-чатах та групах
              соцмереж. Я починав це як каталог особистих рекомендацій, та згодом вирішив
              зробити версію, відкриту для спільноти.
            </p>
            <p>
              Вірю, що комусь це допоможе знайти потрібного спеціаліста, а спеціалістам —{" "}
              <strong>своїх клієнтів</strong>.
            </p>
          </div>

          <div className="about-cta-row">
            <Link href={homePath(lang)} className="about-cta">
              Знайти майстра <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
