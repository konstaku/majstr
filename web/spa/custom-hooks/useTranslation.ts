import { useContext } from "react";
import { MasterContext } from "../context";
import { translations } from "../i18n/translations";

export function useTranslation() {
  const { state } = useContext(MasterContext);
  const lang = state.lang || "uk";
  const dict = translations[lang] ?? translations["uk"];

  function t(key: string, params?: Record<string, string>): string {
    const parts = key.split(".");
    let result: unknown = dict;
    for (const part of parts) {
      if (result && typeof result === "object" && part in (result as Record<string, unknown>)) {
        result = (result as Record<string, unknown>)[part];
      } else {
        return key;
      }
    }
    if (typeof result !== "string") return key;
    if (!params) return result;
    return result.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? `{${k}}`);
  }

  return { t, lang };
}
