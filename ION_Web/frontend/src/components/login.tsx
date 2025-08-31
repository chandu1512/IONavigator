// src/components/AuthPanel.tsx
import React, { useState } from "react";
import { useUser } from "../contexts/UserContext";
import { loginUser, createUser } from "../API/requests";
import IONLOGO from "../assets/IONLOGO.png";

const card = "rounded-2xl shadow-lg border border-[#E6E9F0] bg-white w-full max-w-md";
const label = "text-sm font-medium text-gray-700";
const input = "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-600";
const btn = "w-full rounded-xl px-4 py-2 font-semibold bg-blue-700 hover:bg-blue-800 text-white";
const link = "text-blue-700 hover:underline cursor-pointer";

export default function AuthPanel() {
    const { setAuth } = useUser();

    // login
    const [lemail, setLEmail] = useState("");
    const [lpass, setLPass] = useState("");
    const [lloading, setLLoading] = useState(false);
    const [lerror, setLError] = useState<string | null>(null);

    // create
    const [semail, setSEmail] = useState("");
    const [spass, setSPass] = useState("");
    const [scpass, setSCPass] = useState("");
    const [sloading, setSLoading] = useState(false);
    const [serror, setSError] = useState<string | null>(null);

    const onLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLError(null);
        setLLoading(true);
        try {
            const userId = await loginUser(lemail.trim()); // server returns only user_id
            setAuth(userId, lemail.trim());
        } catch (err: any) {
            setLError(err?.message ?? "Login failed");
        } finally {
            setLLoading(false);
        }
    };

    const onCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSError(null);
        if (spass.length < 6) return setSError("Password must be at least 6 characters.");
        if (spass !== scpass) return setSError("Passwords do not match.");
        setSLoading(true);
        try {
            const userId = await createUser(semail.trim(), spass); // same endpoint for demo
            setAuth(userId, semail.trim());
        } catch (err: any) {
            setSError(err?.message ?? "Create account failed");
        } finally {
            setSLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f7f9fc]">
            <header className="pt-10 pb-6 flex flex-col items-center text-center">
                <img src={IONLOGO} alt="ION Logo" className="h-16 mb-3" />
                <h1 className="text-3xl font-bold text-[#0b4aa2]">HPC I/O Navigator</h1>
                <h2 className="text-base text-gray-700 mt-1">LLM-assisted analysis for Darshan traces</h2>
            </header>

            <main className="mx-auto max-w-6xl px-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Login */}
                    <div className={card}>
                        <div className="px-6 py-4 border-b bg-[#0b4aa2] text-white rounded-t-2xl">Login</div>
                        <form onSubmit={onLogin} className="p-6 space-y-4">
                            <div>
                                <label className={label}>Email</label>
                                <input className={input} type="email" required value={lemail}
                                    onChange={(e) => setLEmail(e.target.value)} placeholder="Enter your email" />
                            </div>
                            <div>
                                <label className={label}>Password</label>
                                <input className={input} type="password" value={lpass}
                                    onChange={(e) => setLPass(e.target.value)} placeholder="Enter your password" />
                            </div>
                            {lerror && <p className="text-red-600 text-sm">{lerror}</p>}
                            <button type="submit" className={btn} disabled={lloading}>
                                {lloading ? "Logging in..." : "Login"}
                            </button>
                            <p className="text-sm text-gray-600">
                                Don’t have an account?{" "}
                                <span className={link}
                                    onClick={() => document.getElementById("create-card")?.scrollIntoView({ behavior: "smooth" })}>
                                    Create Account
                                </span>
                            </p>
                        </form>
                    </div>

                    {/* Create */}
                    <div className={card} id="create-card">
                        <div className="px-6 py-4 border-b bg-[#0b4aa2] text-white rounded-t-2xl">Create Account</div>
                        <form onSubmit={onCreate} className="p-6 space-y-4">
                            <div>
                                <label className={label}>Email</label>
                                <input className={input} type="email" required value={semail}
                                    onChange={(e) => setSEmail(e.target.value)} placeholder="Enter your email" />
                            </div>
                            <div>
                                <label className={label}>Password</label>
                                <input className={input} type="password" required value={spass}
                                    onChange={(e) => setSPass(e.target.value)} placeholder="Create a password (min 6 characters)" />
                            </div>
                            <div>
                                <label className={label}>Confirm Password</label>
                                <input className={input} type="password" required value={scpass}
                                    onChange={(e) => setSCPass(e.target.value)} placeholder="Confirm your password" />
                            </div>
                            {serror && <p className="text-red-600 text-sm">{serror}</p>}
                            <button type="submit" className={btn} disabled={sloading}>
                                {sloading ? "Creating..." : "Create Account"}
                            </button>
                            <p className="text-sm text-gray-600">
                                Already have an account?{" "}
                                <span className={link} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                                    Login
                                </span>
                            </p>
                        </form>
                    </div>
                </div>

                <p className="text-xs text-gray-500 mt-8 text-center px-4">
                    Note: Your email and interactions may be saved for research purposes. We will not share your email.
                </p>
            </main>
        </div>
    );
}
