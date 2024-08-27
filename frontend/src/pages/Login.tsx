import { useEffect, useState } from "react";
import { useLocation, Navigate } from "react-router-dom";

export default function Login() {
    const location = useLocation();
    const [loginElement, setLoginElement] = useState<JSX.Element>(
        // eslint-disable-next-line react/no-unescaped-entities
        <h2>'Logging in...'</h2>
    );

    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const token = searchParams.get("token");
        const path = searchParams.get("path") || "";

        if (token) {
            localStorage.setItem("token", token);
            setLoginElement(<Navigate to={`/${path}`} />);
        } else {
            setLoginElement(<h2>Login error: no token</h2>);
        }
    }, [location.search]);

    return <>{loginElement}</>;
}
