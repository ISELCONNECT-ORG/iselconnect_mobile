import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { Phone, Search, AlertTriangle, ChevronLeft } from "lucide-react";
import { translations } from "../components/translations";

function HotlinesTab({ onBack }) {
  const currentLang = localStorage.getItem("appLanguage") || "English";
  const t = translations[currentLang];

  const [branches, setBranches] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const navBar = document.querySelector(".bottom-nav-wrapper");
    if (navBar) {
      navBar.style.display = "none";
    }
    return () => {
      if (navBar) {
        navBar.style.display = "";
      }
    };
  }, []);

  useEffect(() => {
    const fetchHotlines = async () => {
      try {
        setLoading(true);
        const { data, error: dbError } = await supabase
          .from("iselco_branch")
          .select("branch_id, branch_name, branch_hotline")
          .order("branch_name", { ascending: true });

        if (dbError) throw dbError;

        if (data) {
          const mainOffice = data.find(
            (branch) => branch.branch_name === "ISELCO-1 Main Office",
          );
          const otherBranches = data.filter(
            (branch) => branch.branch_name !== "ISELCO-1 Main Office",
          );
          const sortedBranches = mainOffice
            ? [mainOffice, ...otherBranches]
            : otherBranches;
          setBranches(sortedBranches);
        }
      } catch (err) {
        setError("Failed to load hotline numbers.");
      } finally {
        setLoading(false);
      }
    };

    fetchHotlines();
  }, []);

  const handleBack = () => {
    setIsClosing(true);
    setTimeout(() => {
      onBack();
    }, 250);
  };

  const filteredBranches = branches.filter((branch) =>
    branch.branch_name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const formatPhoneNumber = (num) => {
    if (!num) return "N/A";
    const numStr = num.toString();
    return numStr.startsWith("9") ? `0${numStr}` : numStr;
  };

  return (
    <>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOutRight {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `}</style>

      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 99999,
          backgroundColor: "#f8fafc",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: isClosing
            ? "slideOutRight 0.25s ease forwards"
            : "slideInRight 0.3s ease-out forwards",
        }}
      >
        <div
          style={{
            padding:
              "calc(env(safe-area-inset-top, 0px) + 20px) 16px 15px 16px",
            flexShrink: 0,
            background: "rgba(248, 250, 252, 0.95)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderBottom: "1px solid rgba(0,0,0,0.06)",
            zIndex: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "15px",
            }}
          >
            <button
              onClick={handleBack}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 0,
                display: "flex",
              }}
            >
              <ChevronLeft size={30} color="#1b0b8c" strokeWidth={2.5} />
            </button>
            <div style={{ flex: 1, textAlign: "center", paddingRight: "30px" }}>
              <h2
                style={{
                  margin: 0,
                  fontWeight: "900",
                  fontSize: "1.3rem",
                  letterSpacing: "1px",
                  color: "#1b0b8c",
                  textTransform: "uppercase",
                }}
              >
                {t.emergencyHotlines || "Emergency Hotlines"}
              </h2>
            </div>
          </div>

          <div style={{ position: "relative" }}>
            <input
              type="text"
              placeholder={t.searchBranch || "Search branch office..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: "14px 20px 14px 50px",
                width: "100%",
                boxSizing: "border-box",
                margin: 0,
                borderRadius: "50px",
                border: "1px solid #cbd5e1",
                outline: "none",
                fontSize: "1rem",
                fontWeight: "600",
                color: "#1e293b",
                backgroundColor: "#ffffff",
                boxShadow: "0 4px 10px rgba(0,0,0,0.03)",
              }}
            />
            <Search
              size={20}
              color="#64748b"
              style={{
                position: "absolute",
                left: "20px",
                top: "50%",
                transform: "translateY(-50%)",
              }}
            />
          </div>
        </div>

        <div
          style={{ flex: 1, overflowY: "auto", padding: "20px 16px 40px 16px" }}
        >
          {error && (
            <div
              style={{
                backgroundColor: "#fee2e2",
                color: "#ef4444",
                padding: "12px",
                borderRadius: "15px",
                textAlign: "center",
                fontWeight: "bold",
                fontSize: "0.85rem",
                marginBottom: "15px",
                border: "1px solid #fca5a5",
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: "12px",
              background: "#fffbeb",
              border: "1px dashed #fde047",
              padding: "16px",
              borderRadius: "20px",
              marginBottom: "20px",
              alignItems: "center",
            }}
          >
            <AlertTriangle
              color="#d97706"
              size={24}
              style={{ flexShrink: 0 }}
            />
            <p
              style={{
                color: "#b45309",
                margin: 0,
                fontSize: "0.85rem",
                fontWeight: "700",
                lineHeight: "1.4",
              }}
            >
              {t.hotlineInstructions}
            </p>
          </div>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "14px" }}
          >
            {loading ? (
              <div style={{ textAlign: "center", padding: "30px 0" }}>
                <p style={{ color: "#1b0b8c", fontWeight: "bold" }}>
                  {t.loadingHotlines || "Loading Hotlines..."}
                </p>
              </div>
            ) : filteredBranches.length === 0 ? (
              <p
                style={{
                  color: "#64748b",
                  textAlign: "center",
                  fontSize: "0.9rem",
                  fontWeight: "600",
                  padding: "20px 0",
                }}
              >
                {t.noBranches || "No branches found."}
              </p>
            ) : (
              filteredBranches.map((branch) => (
                <a
                  key={branch.branch_id}
                  href={`tel:${formatPhoneNumber(branch.branch_hotline)}`}
                  style={{ textDecoration: "none", display: "block" }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "15px",
                      margin: 0,
                      padding: "18px 20px",
                      background: "#ffffff",
                      borderRadius: "20px",
                      boxShadow: "0 4px 10px rgba(0,0,0,0.04)",
                      border: "1px solid #e2e8f0",
                      transition: "transform 0.1s ease",
                    }}
                    onMouseDown={(e) =>
                      (e.currentTarget.style.transform = "scale(0.98)")
                    }
                    onMouseUp={(e) =>
                      (e.currentTarget.style.transform = "scale(1)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.transform = "scale(1)")
                    }
                  >
                    <div style={{ flex: 1 }}>
                      <h3
                        style={{
                          color: "#1b0b8c",
                          margin: "0 0 4px 0",
                          fontSize: "1.05rem",
                          fontWeight: "900",
                        }}
                      >
                        {branch.branch_name}
                      </h3>
                      <p
                        style={{
                          color: "#475569",
                          margin: 0,
                          fontSize: "0.9rem",
                          fontWeight: "700",
                          letterSpacing: "0.5px",
                        }}
                      >
                        {formatPhoneNumber(branch.branch_hotline)}
                      </p>
                    </div>
                    <div
                      style={{
                        backgroundColor: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        width: "45px",
                        height: "45px",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Phone size={20} color="#1b0b8c" fill="#1b0b8c" />
                    </div>
                  </div>
                </a>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default HotlinesTab;
