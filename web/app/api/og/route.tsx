import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { API_BASE } from "@/lib/config";
import { DATA_TAG } from "@/lib/api";
import type { Master, Profession, Location } from "@/lib/api";
import { nomName } from "@/lib/i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INK = "#0e0a06";
const PAPER = "#fffaf0";
const CREAM = "#f4ede0";
const TERRA = "#c84b31";

const LANG_LABELS: Record<string, string> = {
  uk: "UA", en: "EN", it: "IT", pt: "PT",
  es: "ES", de: "DE", fr: "FR", pl: "PL", ru: "RU",
};

const CONTACT_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp", telegram: "Telegram", instagram: "Instagram",
  phone: "Phone", email: "Email", facebook: "Facebook",
};

function loadFont(name: string): Buffer {
  return readFileSync(join(process.cwd(), "public/fonts", name));
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return new Response("Missing id", { status: 400 });

  const [mastersRaw, profsRaw, locsRaw] = await Promise.all([
    fetch(`${API_BASE}/?q=masters`, { next: { revalidate: 3600, tags: [DATA_TAG] } }).then(
      (r) => r.json() as Promise<Master[]>
    ),
    fetch(`${API_BASE}/?q=professions`, { next: { revalidate: 3600, tags: [DATA_TAG] } }).then(
      (r) => r.json() as Promise<Profession[]>
    ),
    fetch(`${API_BASE}/?q=locations`, { next: { revalidate: 3600, tags: [DATA_TAG] } }).then(
      (r) => r.json() as Promise<Location[]>
    ),
  ]);

  const master = mastersRaw.find((m) => m._id === id);
  if (!master) return new Response("Not found", { status: 404 });

  const prof = profsRaw.find((p) => p.id === master.professionID);
  const loc = locsRaw.find((l) => l.id === master.locationID);
  const profName = nomName(prof?.name, "uk") || master.professionID;
  const locName = nomName(loc?.name, "uk") || master.locationID;

  const langs =
    master.languages && master.languages.length > 0
      ? master.languages
      : master.countryID === "IT"
      ? ["uk", "it"]
      : ["uk"];

  const tags = master.tags?.ua?.length
    ? master.tags.ua
    : (master.tags?.en ?? []);
  const contacts = (master.contacts ?? []).slice(0, 4);

  const archivoBold = loadFont("ArchivoBlack.ttf");

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: PAPER,
          display: "flex",
          flexDirection: "column",
          fontFamily: "ArchivoBlack",
          border: `2px solid ${INK}`,
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 28px",
            borderBottom: `2px solid ${INK}`,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: "ArchivoBlack",
              fontSize: 20,
              letterSpacing: "-0.06em",
              color: INK,
              textTransform: "uppercase",
            }}
          >
            {"MAJSTR"}
            <span style={{ color: TERRA }}>{"."}</span>
          </span>
          <span style={{ fontSize: 13, color: INK, opacity: 0.45, fontFamily: "ArchivoBlack", letterSpacing: "0.04em" }}>
            majstr.xyz
          </span>
        </div>

        {/* ── Body ── */}
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          {/* Photo / sigil */}
          <div
            style={{
              width: 260,
              flexShrink: 0,
              borderRight: `2px solid ${INK}`,
              background: master.photo ? INK : CREAM,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {master.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={master.photo}
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  filter: "grayscale(100%) contrast(118%) brightness(102%)",
                }}
              />
            ) : (
              <span style={{ fontSize: 80, color: TERRA }}>✦</span>
            )}
          </div>

          {/* Content */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              padding: "32px 40px 28px",
              gap: 16,
              minWidth: 0,
            }}
          >
            {/* Name */}
            <div
              style={{
                fontFamily: "ArchivoBlack",
                fontSize: master.name.length > 18 ? 44 : 56,
                lineHeight: 1,
                color: INK,
                letterSpacing: "-0.03em",
              }}
            >
              {master.name}
              <span style={{ color: TERRA }}>{"."}</span>
            </div>

            {/* Profession · City */}
            <div
              style={{
                display: "flex",
                gap: 14,
                alignItems: "center",
                fontSize: 22,
                color: INK,
              }}
            >
              <span>{profName}</span>
              <span style={{ color: TERRA, fontSize: 20, opacity: 0.7 }}>·</span>
              <span style={{ opacity: 0.65 }}>{locName}</span>
            </div>

            {/* Language badges */}
            <div style={{ display: "flex", gap: 8 }}>
              {langs.slice(0, 6).map((code) => (
                <span
                  key={code}
                  style={{
                    border: `1.5px solid ${INK}`,
                    padding: "4px 10px",
                    fontSize: 13,
                    fontFamily: "ArchivoBlack",
                    letterSpacing: "0.1em",
                    color: INK,
                  }}
                >
                  {LANG_LABELS[code] ?? code.toUpperCase()}
                </span>
              ))}
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div style={{ fontSize: 17, color: INK, opacity: 0.55 }}>
                {tags.slice(0, 5).join(" · ")}
              </div>
            )}

            {/* Contacts — pushed to bottom */}
            {contacts.length > 0 && (
              <div
                style={{
                  display: "flex",
                  gap: 28,
                  marginTop: "auto",
                  flexWrap: "wrap",
                  alignItems: "flex-end",
                }}
              >
                {contacts.map((c, i) => (
                  <div
                    key={i}
                    style={{ display: "flex", flexDirection: "column", gap: 3 }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: INK,
                        opacity: 0.45,
                        letterSpacing: "0.08em",
                        fontFamily: "ArchivoBlack",
                        textTransform: "uppercase",
                      }}
                    >
                      {CONTACT_LABELS[c.contactType.toLowerCase()] ?? c.contactType}
                    </span>
                    <span
                      style={{
                        fontSize: 19,
                        color: INK,
                        fontFamily: "ArchivoBlack",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {c.value.length > 24 ? c.value.slice(0, 24) + "…" : c.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Bio footer ── */}
        {master.about && (
          <div
            style={{
              borderTop: `2px solid ${INK}`,
              padding: "12px 28px",
              fontSize: 16,
              color: INK,
              opacity: 0.6,
              background: CREAM,
              flexShrink: 0,
              overflow: "hidden",
            }}
          >
            {master.about.length > 150
              ? master.about.slice(0, 150) + "…"
              : master.about}
          </div>
        )}
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: "ArchivoBlack",
          data: archivoBold,
          style: "normal",
          weight: 900,
        },
      ],
    }
  );
}
