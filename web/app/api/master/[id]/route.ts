import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getDataset } from "@/lib/data";
import { DATA_TAG, type Master } from "@/lib/api";
import { API_BASE } from "@/lib/config";

// Single-master detail endpoint. The grid/cards ship a slim master projection
// (see lib/seed.ts); when a card's modal opens, the client fetches the full
// record (about + contacts) from here. Backed by the same ISR-cached dataset as
// the pages, so this adds no extra upstream load — it reads from Next's data
// cache and returns ~1 KB instead of the ~400 KB full dataset.
// (Must be a static literal — keep in sync with REVALIDATE_SECONDS in config.)
export const revalidate = 3600;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { masters } = await getDataset();
  let master = masters.find((m) => m._id === id);

  if (!master) {
    // Self-heal: a freshly published master may not be in the ISR snapshot
    // yet (publish paths that skip the revalidate webhook, or plain cache
    // drift). Ask the upstream API directly; if the master is real, bust the
    // dataset tag so the pages catch up too. Without this, the card modal
    // silently rendered the slim record — no contacts, no description.
    try {
      const fresh = await fetch(`${API_BASE}/?q=masters&country=IT`, {
        cache: "no-store",
      });
      if (fresh.ok) {
        const all = (await fresh.json()) as Master[];
        master = all.find((m) => m._id === id && m.approved);
        if (master) revalidateTag(DATA_TAG);
      }
    } catch {
      /* upstream unreachable — fall through to 404 */
    }
  }

  if (!master) {
    return NextResponse.json(
      { error: "not_found" },
      // Never let a 404 stick in CDN caches — the master may appear seconds later.
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }
  return NextResponse.json(master, {
    headers: {
      "Cache-Control":
        "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
