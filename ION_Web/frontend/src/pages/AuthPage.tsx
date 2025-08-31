// src/pages/AuthPage.tsx
import React, { useState } from "react";
import { useUser } from "../contexts/UserContext";
import { loginUser, createUser } from "../API/requests";
import IONLOGO from "../assets/IONLOGO.png";

const s = {
    page: { minHeight: "100vh", background: "#f7f9fc", display: "flex", flexDirection: "column" as const },
    header: { paddingTop: 36, paddingBottom: 18, display: "flex", flexDirection: "column" as const, alignItems: "center", textAlign: "center" as const },
    title: { fontSize: 28, fontWeight: 800 as const, color: "#0b4aa2", marginTop: 8 },
    subtitle: { fontSize: 14, color: "#475569", marginTop: 4 },
    shell: { width: "min(560px, 92vw)", margin: "18px auto 0 auto", padding: 12 },
    card: { background: "#fff", border: "1px solid #E6E9F0", borderRadius: 16, overflow: "hidden", boxShadow: "0 6px 20px rgba(11,74,162,0.08)" },
    head: { background: "#0b4aa2", color: "#fff", fontWeight: 800 as const, padding: "12px 18px" },
    body: { display: "flex", flexDirection: "column" as const, gap: 10, padding: 16 },
    label: { fontSize: 13, color: "#374151", fontWeight: 600 },
    input: { border: "1px solid #D1D5DB", borderRadius: 10, padding: "10px 12px", outline: "none", fontSize: 14 } as React.CSSProperties,
    btn: { marginTop: 6, background: "#0b4aa2", color: "#fff", border: "none", borderRadius: 12, padding: "10px 14px", fontWeight: 800 as const, cursor: "pointer" },
    btnDisabled: { opacity: 0.7, cursor: "not-allowed" },
    error: { marginTop: 2, color: "#b91c1c", fontSize: 13 },
    switch: { marginTop: 6, fontSize: 13, color: "#6b7280" },
    link: { color: "#0b4aa2", fontWeight: 700, cursor: "pointer", textDecoration: "underline" },
    note: { marginTop: 14, fontSize: 12, color: "#6b7280", textAlign: "center" as const },
};

const AuthPage: React.FC = () => {
    const { setAuth } = useUser();

    const [mode, setMode] = useState<"login" | "create">("login");

    // login state
    const [lemail, setLEmail] = useState("");
    const [lpass, setLPass] = useState("");
    const [lloading, setLLoading] = useState(false);
    const [lerror, setLError] = useState("");

    // create state
    const [semail, setSEmail] = useState("");
    const [spass, setSPass] = useState("");
    const [scpass, setSCPass] = useState("");
    const [sloading, setSLoading] = useState(false);
    const [serror, setSError] = useState("");

    const switchToCreate = () => {
        setMode("create");
        setLError("");
    };
    const switchToLogin = () => {
        setMode("login");
        setSError("");
    };

    const onLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLError("");
        setLLoading(true);
        try {
            if (!lemail || !lpass) throw new Error("Email and password are required");
            const id = await loginUser(lemail.trim()); // password ignored by demo backend
            setAuth(id, lemail.trim());
        } catch (err: any) {
            setLError(err?.message ?? "Login failed");
        } finally {
            setLLoading(false);
        }
    };

    const onCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSError("");
        setSLoading(true);
        try {
            if (!semail || !spass) throw new Error("Email and password are required");
            if (spass.length < 6) throw new Error("Password must be at least 6 characters");
            if (spass !== scpass) throw new Error("Passwords do not match");
            const id = await createUser(semail.trim(), spass); // in demo, same as login
            setAuth(id, semail.trim());
        } catch (err: any) {
            setSError(err?.message ?? "Create account failed");
        } finally {
            setSLoading(false);
        }
    };

    return (
        <div style={s.page}>
            <header style={s.header}>
                <img src={IONLOGO} alt="ION Logo" style={{ height: 56 }} />
                <h1 style={s.title}>HPC I/O Navigator</h1>
                <p style={s.subtitle}>LLM-assisted analysis for Darshan traces</p>
            </header>

            <main style={s.shell}>
                <section style={s.card}>
                    <div style={s.head}>{mode === "login" ? "Login" : "Create Account"}</div>

                    {mode === "login" ? (
                        <form style={s.body} onSubmit={onLogin}>
                            <label style={s.label}>Email</label>
                            <input
                                style={s.input}
                                type="email"
                                placeholder="Enter your email"
                                value={lemail}
                                onChange={(e) => setLEmail(e.target.value)}
                                required
                                disabled={lloading}
                            />

                            <label style={s.label}>Password</label>
                            <input
                                style={s.input}
                                type="password"
                                placeholder="Enter your password"
                                value={lpass}
                                onChange={(e) => setLPass(e.target.value)}
                                required
                                disabled={lloading}
                            />

                            {lerror && <div style={s.error}>{lerror}</div>}

                            <button type="submit" style={{ ...s.btn, ...(lloading ? s.btnDisabled : {}) }} disabled={lloading}>
                                {lloading ? "Logging in…" : "Login"}
                            </button>

                            <div style={s.switch}>
                                Don’t have an account?{" "}
                                <span style={s.link} onClick={switchToCreate}>
                                    Create Account
                                </span>
                            </div>
                        </form>
                    ) : (
                        <form style={s.body} onSubmit={onCreate}>
                            <label style={s.label}>Email</label>
                            <input
                                style={s.input}
                                type="email"
                                placeholder="Enter your email"
                                value={semail}
                                onChange={(e) => setSEmail(e.target.value)}
                                required
                                disabled={sloading}
                            />

                            <label style={s.label}>Password</label>
                            <input
                                style={s.input}
                                type="password"
                                placeholder="Create a password (min 6 characters)"
                                value={spass}
                                onChange={(e) => setSPass(e.target.value)}
                                required
                                disabled={sloading}
                            />

                            <label style={s.label}>Confirm Password</label>
                            <input
                                style={s.input}
                                type="password"
                                placeholder="Confirm your password"
                                value={scpass}
                                onChange={(e) => setSCPass(e.target.value)}
                                required
                                disabled={sloading}
                            />

                            {serror && <div style={s.error}>{serror}</div>}

                            <button type="submit" style={{ ...s.btn, ...(sloading ? s.btnDisabled : {}) }} disabled={sloading}>
                                {sloading ? "Creating…" : "Create Account"}
                            </button>

                            <div style={s.switch}>
                                Already have an account?{" "}
                                <span style={s.link} onClick={switchToLogin}>
                                    Login
                                </span>
                            </div>
                        </form>
                    )}
                </section>

                <p style={s.note}>
                    Note: Your email and interactions may be saved for research purposes. We will not share your email.
                </p>
            </main>
        </div>
    );
};

export default AuthPage;
