"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "../custom-hooks/useTranslation";

// Bot login link lands here: /login?token=<jwt>&path=<dest>. Save the token and
// bounce to the destination. Reads the query in an effect (client-only) so it
// never touches window during SSR and avoids the useSearchParams suspense
// requirement.
export default function Login() {
  const router = useRouter();
  const { t } = useTranslation();
  const [content, setContent] = useState<ReactNode>(<h2>{t("login.loading")}</h2>);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const path = params.get("path") || "";

    if (token) {
      localStorage.setItem("token", token);
      router.replace(`/${path}`);
    } else {
      setContent(
        <div>
          <h2>{t("login.error")}</h2>
          <Link href="/">{t("login.home")}</Link>
        </div>
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{content}</>;
}
