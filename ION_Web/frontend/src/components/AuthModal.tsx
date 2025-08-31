import React, { useState } from "react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string) => Promise<void>;
}

const s = {
  overlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(15,23,42,0.50)",
    backdropFilter: "blur(2px)",
    display: "grid",
    placeItems: "center",
    zIndex: 9999,
  },
  shell: {
    position: "relative" as const,
    width: "min(100%, 960px)",
    margin: 24,
    background: "#f7f9fc",
    borderRadius: 18,
    boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
    padding: 24,
  },
  close: {
    position: "absolute" as const,
    right: 14,
    top: 10,
    border: 0,
    background: "transparent",
    fontSize: 22,
    lineHeight: 1,
    cursor: "pointer",
    color: "#0b4aa2",
  },
  grid: (twoCols: boolean) => ({
    display: "grid",
    gridTemplateColumns: twoCols ? "1fr 1fr" : "1fr",
    gap: 18,
  }),
  card: {
    background: "#fff",
    border: "1px solid #E6E9F0",
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0 6px 20px rgba(11,74,162,0.08)",
  },
  head: {
    background: "#0b4aa2",
    color: "#fff",
    fontWeight: 700 as const,
    padding: "12px 18px",
  },
  body: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
    padding: 16,
  },
  label: {
    fontSize: 13,
    color: "#374151",
    fontWeight: 600,
  },
  input: {
    border: "1px solid #D1D5DB",
    borderRadius: 10,
    padding: "10px 12px",
    outline: "none",
    fontSize: 14,
  } as React.CSSProperties,
  btn: {
    marginTop: 6,
    background: "#0b4aa2",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "10px 14px",
    fontWeight: 700 as const,
    cursor: "pointer",
  },
  btnDisabled: { opacity: 0.7, cursor: "not-allowed" },
  error: { marginTop: 2, color: "#b91c1c", fontSize: 13 },
  switch: { marginTop: 6, fontSize: 13, color: "#6b7280" },
  link: { color: "#0b4aa2", fontWeight: 600, cursor: "pointer", textDecoration: "underline" },
  note: { marginTop: 14, fontSize: 12, color: "#6b7280", textAlign: "center" as const },
};

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLogin, onRegister }) => {
  const [lemail, setLEmail] = useState("");
  const [lpass, setLPass] = useState("");
  const [lloading, setLLoading] = useState(false);
  const [lerror, setLError] = useState("");

  const [semail, setSEmail] = useState("");
  const [spass, setSPass] = useState("");
  const [scpass, setSCPass] = useState("");
  const [sloading, setSLoading] = useState(false);
  const [serror, setSError] = useState("");

  const twoCols = typeof window !== "undefined" ? window.innerWidth >= 820 : true;

  if (!isOpen) return null;

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLError("");
    setLLoading(true);
    try {
      if (!lemail || !lpass) throw new Error("Email and password are required");
      await onLogin(lemail.trim(), lpass);
      onClose();
    } catch (err: any) {
      setLError(err?.message ?? "Login failed");
    } finally {
      setLLoading(false);
    }
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSError("");
    setSLoading(true);
    try {
      if (!semail || !spass) throw new Error("Email and password are required");
      if (spass.length < 6) throw new Error("Password must be at least 6 characters");
      if (spass !== scpass) throw new Error("Passwords do not match");
      await onRegister(semail.trim(), spass);
      onClose();
    } catch (err: any) {
      setSError(err?.message ?? "Create account failed");
    } finally {
      setSLoading(false);
    }
  };

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.shell} onClick={(e) => e.stopPropagation()}>
        <button style={s.close} onClick={onClose} aria-label="Close">×</button>

        <div style={s.grid(twoCols)}>
          {/* Login */}
          <div style={s.card}>
            <div style={s.head}>Login</div>
            <form style={s.body} onSubmit={submitLogin}>
              <label style={s.label}>Email</label>
              <input style={s.input} type="email" placeholder="Enter your email" value={lemail} onChange={(e) => setLEmail(e.target.value)} required disabled={lloading} />
              <label style={s.label}>Password</label>
              <input style={s.input} type="password" placeholder="Enter your password" value={lpass} onChange={(e) => setLPass(e.target.value)} required disabled={lloading} />
              {lerror && <div style={s.error}>{lerror}</div>}
              <button type="submit" style={{ ...s.btn, ...(lloading ? s.btnDisabled : {}) }} disabled={lloading}>
                {lloading ? "Logging in…" : "Login"}
              </button>
              <div style={s.switch}>
                Don’t have an account?{" "}
                <span style={s.link} onClick={() => document.getElementById("create-card")?.scrollIntoView({ behavior: "smooth", block: "center" })}>
                  Create Account
                </span>
              </div>
            </form>
          </div>

          {/* Create Account */}
          <div style={s.card} id="create-card">
            <div style={s.head}>Create Account</div>
            <form style={s.body} onSubmit={submitCreate}>
              <label style={s.label}>Email</label>
              <input style={s.input} type="email" placeholder="Enter your email" value={semail} onChange={(e) => setSEmail(e.target.value)} required disabled={sloading} />
              <label style={s.label}>Password</label>
              <input style={s.input} type="password" placeholder="Create a password (min 6 characters)" value={spass} onChange={(e) => setSPass(e.target.value)} required disabled={sloading} />
              <label style={s.label}>Confirm Password</label>
              <input style={s.input} type="password" placeholder="Confirm your password" value={scpass} onChange={(e) => setSCPass(e.target.value)} required disabled={sloading} />
              {serror && <div style={s.error}>{serror}</div>}
              <button type="submit" style={{ ...s.btn, ...(sloading ? s.btnDisabled : {}) }} disabled={sloading}>
                {sloading ? "Creating…" : "Create Account"}
              </button>
              <div style={s.switch}>
                Already have an account?{" "}
                <span style={s.link} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Login</span>
              </div>
            </form>
          </div>
        </div>

        <p style={s.note}>
          Note: Your email and interactions may be saved for research purposes. We will not share your email.
        </p>
      </div>
    </div>
  );
};

export default AuthModal;
