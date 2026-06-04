import { permanentRedirect } from "next/navigation";
import { DEFAULT_LANG } from "@/lib/i18n";

// The apex serves the default-language home. Locale-prefixed everywhere keeps
// routing/hreflang uniform. 308 (permanent) so engines consolidate on /uk.
export default function RootIndex() {
  permanentRedirect(`/${DEFAULT_LANG}`);
}
