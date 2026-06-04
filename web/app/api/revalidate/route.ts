import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { DATA_TAG } from "@/lib/api";

// On-demand ISR. Call from the Telegram bot when a master is approved so the
// new master (and the city/profession pages they belong to) refresh within
// seconds instead of waiting for the hourly revalidate window.
//
//   POST https://majstr.xyz/api/revalidate?secret=<REVALIDATE_SECRET>
export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!process.env.REVALIDATE_SECRET || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  revalidateTag(DATA_TAG);
  return NextResponse.json({ ok: true, revalidated: DATA_TAG, now: Date.now() });
}
