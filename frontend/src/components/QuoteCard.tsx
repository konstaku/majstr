import { useTranslation } from "../custom-hooks/useTranslation";

type QuoteCardVariant = "terra" | "ink";

type QuoteCardProps = {
  variant?: QuoteCardVariant;
  showOnDesktop?: boolean;
};

export default function QuoteCard({ variant = "terra", showOnDesktop = false }: QuoteCardProps) {
  const { t } = useTranslation();
  const cls = [
    "quote-card",
    `quote-card-${variant}`,
    "quote-card--show-mobile",
    showOnDesktop ? "quote-card--show-desktop" : "",
  ].filter(Boolean).join(" ");

  return (
    <article className={cls}>
      <div className="quote-card-header">
        <span className="quote-card-label">{t("hero.testimonialLabel")}</span>
        <span className="quote-card-stars">★★★★★</span>
      </div>
      <div className="quote-card-body">
        <div className="quote-card-mark">&ldquo;</div>
        <div className="quote-card-text">{t("hero.testimonialQuote")}</div>
        <div className="quote-card-attr">— {t("hero.testimonialAttr")}</div>
      </div>
    </article>
  );
}
