import Link from "next/link";

// The root layout is a pass-through (it no longer renders <html>/<body> — those
// live in app/[lang]/layout.tsx so the lang attribute can be per-locale). A
// top-level 404 (an unmatched route outside /[lang]) therefore has no document
// wrapper, so this not-found must render its own <html>/<body>. Global CSS is
// imported by the root layout, so tokens/classes are available here.
export default function NotFound() {
  return (
    <html lang="uk">
      <body>
        <main
          style={{
            minHeight: "100dvh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            textAlign: "center",
            padding: "2rem",
            fontFamily: "var(--font-dm, system-ui, sans-serif)",
          }}
        >
          <h1 style={{ fontSize: "clamp(48px, 12vw, 120px)", margin: 0 }}>404</h1>
          <p style={{ fontSize: "1.125rem", margin: 0, opacity: 0.7 }}>
            Сторінку не знайдено · Страница не найдена · Page not found
          </p>
          <Link
            href="/uk"
            style={{
              marginTop: "0.5rem",
              fontWeight: 600,
              textDecoration: "underline",
            }}
          >
            Majstr →
          </Link>
        </main>
      </body>
    </html>
  );
}
