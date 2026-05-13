import { useEffect, useState } from "react";
import { useLocation, Navigate, Link } from "react-router-dom";
import { useTranslation } from "../custom-hooks/useTranslation";

export default function Login() {
    const location = useLocation();
    const { t } = useTranslation();
    const [loginElement, setLoginElement] = useState<JSX.Element>(
        <h2>{t("login.loading")}</h2>
    );

    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const token = searchParams.get("token");
        const path = searchParams.get("path") || "";

        if (token) {
            localStorage.setItem("token", token);
            setLoginElement(<Navigate to={`/${path}`} />);
        } else {
            setLoginElement(
                <div>
                    <h2>{t("login.error")}</h2>
                    <Link to="/">{t("login.home")}</Link>
                </div>
            );
        }
    }, [location.search]);

    return <>{loginElement}</>;
}
