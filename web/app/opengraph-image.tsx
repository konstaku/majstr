import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

// Default site OG image (file convention) — used for the home page and any
// route that doesn't set its own openGraph.images. Master pages use the
// Playwright-rendered card (Master.OGimage); the legacy /api/og generator
// was removed.
export const runtime = "nodejs";
export const alt = "Majstr — каталог майстрів в Італії";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#0e0a06";
const PAPER = "#fffaf0";
const TERRA = "#c84b31";

function loadFont(name: string): Buffer {
  return readFileSync(join(process.cwd(), "public/fonts", name));
}

export default function OpengraphImage() {
  const archivo = loadFont("ArchivoBlack.ttf"); // Latin wordmark
  const golosCyr = loadFont("GolosText-Cyrillic.ttf"); // Cyrillic tagline
  const golosLat = loadFont("GolosText-Latin.ttf"); // Latin/digits in tagline

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: PAPER,
          border: `16px solid ${INK}`,
          padding: "64px 72px",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            fontFamily: "GolosText",
            fontSize: 24,
            letterSpacing: "0.12em",
            color: INK,
            textTransform: "uppercase",
          }}
        >
          EST. 2023 · UA-IT
        </div>

        <div style={{ display: "flex", flexDirection: "column", color: INK }}>
          <div
            style={{
              display: "flex",
              fontFamily: "ArchivoBlack",
              fontSize: 200,
              lineHeight: 0.92,
              letterSpacing: "-0.04em",
            }}
          >
            MAJSTR<span style={{ color: TERRA }}>.</span>
          </div>
          <div
            style={{
              marginTop: 28,
              fontFamily: "GolosText",
              fontSize: 34,
              color: INK,
              maxWidth: 940,
            }}
          >
            Каталог україно- та російськомовних майстрів в Італії
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "GolosText",
            fontSize: 24,
            color: INK,
            opacity: 0.7,
          }}
        >
          <span>majstr.xyz</span>
          <span>Запис у Telegram · безкоштовно</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "ArchivoBlack", data: archivo, style: "normal", weight: 400 },
        { name: "GolosText", data: golosCyr, style: "normal", weight: 800 },
        { name: "GolosText", data: golosLat, style: "normal", weight: 800 },
      ],
    }
  );
}
