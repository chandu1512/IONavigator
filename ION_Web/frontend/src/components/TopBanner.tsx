import React from "react";
import IONLOGO from "../assets/IONLOGO.png";

type Props = {
  currentUser?: string;
  isTestUser?: boolean;
  uploading?: boolean;
  onFileSelected?: (file: File) => void;
  onBatchSelected?: (files: FileList) => void;
  onLogout?: () => void;
  showBatch?: boolean;
};

const TopBanner: React.FC<Props> = ({
  currentUser,
  isTestUser,
  uploading,
  onFileSelected,
  onBatchSelected,
  onLogout,
  showBatch = true,
}) => {
  const banner: React.CSSProperties = { background: "#0b4ea2", color: "#fff" };
  const inner: React.CSSProperties = {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "16px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  };
  const brand: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12 };
  const title: React.CSSProperties = { fontWeight: 800, fontSize: 20, letterSpacing: 0.2 };
  const sub: React.CSSProperties = { fontSize: 12, opacity: 0.9 };

  const rightWrap: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12 };

  const userPanel: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 12px",
    borderRadius: 12,
    background: "rgba(255,255,255,.08)",
    border: "1px solid rgba(255,255,255,.18)",
  };
  const userLabel: React.CSSProperties = { fontSize: 12, opacity: 0.9 };
  const userValue: React.CSSProperties = {
    fontWeight: 700,
    maxWidth: 320,
    overflow: "hidden",
    textOverflow: "ellipsis",
  };
  const pill: React.CSSProperties = {
    fontSize: 12,
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,.35)",
    background: "rgba(255,255,255,.12)",
  };

  const goldbar: React.CSSProperties = {
    height: 6,
    width: "100%",
    background: "#f2c94c",
    boxShadow: "0 2px 6px rgba(0,0,0,.12) inset",
  };

  const YellowBtn: React.FC<
    React.PropsWithChildren<{ style?: React.CSSProperties; onClick?: () => void }>
  > = ({ children, style, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "#f2c94c",
        color: "#0f172a",
        fontWeight: 800,
        border: "none",
        borderRadius: 10,
        padding: "10px 14px",
        cursor: uploading ? "default" : "pointer",
        boxShadow: "0 4px 10px rgba(0,0,0,.12)",
        opacity: uploading ? 0.7 : 1,
        ...style,
      }}
      disabled={!!uploading}
    >
      {children}
    </button>
  );

  return (
    <>
      <header style={banner}>
        <div style={inner}>
          {/* left: brand */}
          <div style={brand}>
            <img
              src={IONLOGO}
              alt="HPC I/O Navigator"
              width={44}
              height={44}
              style={{ borderRadius: 999, border: "2px solid #cfe2ff", background: "#e6f0ff" }}
            />
            <div>
              <div style={title}>HPC I/O Navigator</div>
              <div style={sub}>LLM-assisted analysis for Darshan traces</div>
            </div>
          </div>

          {/* right: user info panel + uploads + logout */}
          <div style={rightWrap}>
            <div style={userPanel}>
              <div style={userLabel}>User:</div>
              <div style={userValue} title={currentUser || "Test Account"}>
                {currentUser || "Test Account"}
              </div>
              <span style={pill}>{isTestUser ? "Test Account" : "Account"}</span>
            </div>

            {/* Upload New Trace */}
            <div style={{ position: "relative", display: "inline-block" }}>
              <YellowBtn> Upload New Trace</YellowBtn>
              <input
                type="file"
                accept=".darshan,.darshan.gz,.darshan.bz2,.gz,.bz2,.txt,.log,.json"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && onFileSelected) onFileSelected(f);
                  (e.target as HTMLInputElement).value = "";
                }}
                style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
              />
            </div>

            {/* Batch Upload */}
            {showBatch && (
              <div style={{ position: "relative", display: "inline-block" }}>
                <YellowBtn> Batch Upload</YellowBtn>
                <input
                  type="file"
                  multiple
                  // @ts-ignore
                  webkitdirectory="true"
                  accept=".darshan,.darshan.gz,.darshan.bz2,.gz,.bz2,.txt,.log,.json"
                  onChange={(e) => {
                    const fl = e.target.files;
                    if (fl && fl.length && onBatchSelected) onBatchSelected(fl);
                    (e.target as HTMLInputElement).value = "";
                  }}
                  style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
                />
              </div>
            )}

            {/* Logout as yellow */}
            {onLogout && <YellowBtn onClick={onLogout}>Logout</YellowBtn>}
          </div>
        </div>
      </header>
      <div style={goldbar} />
    </>
  );
};

export default TopBanner;
