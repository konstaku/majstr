// Server component that emits a JSON-LD <script>. `data` is any schema.org
// object/graph. Rendered into static HTML so crawlers (incl. Yandex) read it
// without executing JS.
export default function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
