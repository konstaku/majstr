import { useEffect, useState } from "react";
import { useLocation, Navigate, Link } from "react-router-dom";

export default function Login() {
    const location = useLocation();
    const [loginElement, setLoginElement] = useState<JSX.Element>(
        <h2>Logging in...</h2>
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
                    <h2>Login error: no token</h2>
                    <Link to="/">На головну</Link>
                </div>
            );
        }
    }, [location.search]);

    return <>{loginElement}</>;
}
