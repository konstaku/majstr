import { NextResponse } from "next/server";
import { getDataset } from "@/lib/data";

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
  const master = masters.find((m) => m._id === id);
  if (!master) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(master, {
    headers: {
      "Cache-Control":
        "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
