import Link from "next/link";
import JsonLd from "./JsonLd";
import { abs } from "@/lib/urls";

export interface Crumb {
  name: string;
  href: string;
}

// Visual breadcrumbs + matching BreadcrumbList JSON-LD (single source of truth).
export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb">
        {items.map((c, i) => (
          <span key={c.href}>
            {i > 0 && <span>/</span>}
            {i < items.length - 1 ? <Link href={c.href}>{c.name}</Link> : <span>{c.name}</span>}
          </span>
        ))}
      </nav>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: items.map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: c.name,
            item: abs(c.href),
          })),
        }}
      />
    </>
  );
}
