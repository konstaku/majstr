import JsonLd from "./JsonLd";
import type { Faq } from "@/lib/content";
import { T, type Lang } from "@/lib/i18n";

// Renders an FAQ section + FAQPage JSON-LD from the same data.
export default function FaqBlock({ items, lang }: { items: Faq[]; lang: Lang }) {
  if (items.length === 0) return null;
  return (
    <section className="faq">
      <h2 className="section">{T[lang].faqTitle}</h2>
      {items.map((f) => (
        <div className="faq-item" key={f.q}>
          <div className="faq-q">{f.q}</div>
          <div className="faq-a">{f.a}</div>
        </div>
      ))}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: items.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }}
      />
    </section>
  );
}
