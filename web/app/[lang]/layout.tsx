import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { isLang } from "@/lib/i18n";

// Validate the locale segment once for all [lang] routes.
export default async function LangLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return <>{children}</>;
}
