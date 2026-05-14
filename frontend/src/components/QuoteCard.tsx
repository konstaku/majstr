import { useTranslation } from "../custom-hooks/useTranslation";

type QuoteCardVariant = "terra" | "ink";

type QuoteCardProps = {
  variant?: QuoteCardVariant;
};

export default function QuoteCard({ variant = "terra" }: QuoteCardProps) {
  const { t } = useTranslation();
  return (
    <article className={`quote-card quote-card-${variant}`}>
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
