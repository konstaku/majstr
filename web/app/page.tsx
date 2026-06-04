import { permanentRedirect, redirect } from "next/navigation";
import { DEFAULT_LANG } from "@/lib/i18n";
import { getDataset, masterSlug } from "@/lib/data";
import { masterPath } from "@/lib/urls";

// The apex serves the default-language home. Two cases:
//  • Legacy share links `majstr.xyz/?card=<id>` — forward to the new canonical
//    master page so old links (and their social previews) keep working.
//  • Otherwise 308 → /uk so engines consolidate on the locale-prefixed home.
export default async function RootIndex({
  searchParams,
}: {
  searchParams: Promise<{ card?: string }>;
}) {
  const { card } = await searchParams;
  if (card) {
    const { masters, profById, locById } = await getDataset();
    const m = masters.find((x) => x._id === card);
    if (m) {
      const slug = masterSlug(
        m,
        profById.get(m.professionID),
        locById.get(m.locationID)
      );
      redirect(masterPath(DEFAULT_LANG, slug));
    }
  }
  permanentRedirect(`/${DEFAULT_LANG}`);
}
