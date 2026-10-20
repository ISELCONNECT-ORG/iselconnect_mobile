import React, { useState, useEffect } from "react";
import { ChevronLeft, Info, LogOut, Globe, KeyRound } from "lucide-react";
import { supabase } from "../supabaseClient";
import { logSystemAction } from "../utils/logger";
import { translations } from "../components/translations";
import AboutUs from "./AboutUs";
import ChangePassword from "../components/ChangePassword";
import "../Resident.css";

function SettingsTab({ onBack, onLogout }) {
  const savedLanguage = localStorage.getItem("appLanguage") || "English";
  const t = translations[savedLanguage];

  const [language, setLanguage] = useState(savedLanguage);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showAboutUs, setShowAboutUs] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  const [isClosing, setIsClosing] = useState(false);

  // 🌟 NEW: Track if we are returning from a sub-menu to block the entry animation
  const [isReturning, setIsReturning] = useState(false);

  const [showChangePassword, setShowChangePassword] = useState(() => {
    return !!localStorage.getItem("settings_cp_stage");
  });

  // HIDE BOTTOM NAV BAR WHEN SETTINGS IS OPEN
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

  const handleSaveSettings = async () => {
    localStorage.setItem("appLanguage", language);
    await logSystemAction(
      "UPDATE_SETTINGS",
      `Resident updated app settings (Language: ${language}).`,
    );
    setShowSaveSuccess(true);
  };

  const handleSignOut = async () => {
    try {
      await logSystemAction(
        "USER_LOGOUT",
        "Resident logged out of the application.",
      );
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      if (onLogout) onLogout();
    } catch (error) {
      alert("Error logging out: " + error.message);
    }
  };

  const handleBack = () => {
    setIsClosing(true);
    setTimeout(() => {
      onBack();
    }, 250);
  };

  if (showAboutUs) {
    return (
      <AboutUs
        onBack={() => {
          setShowAboutUs(false);
          setIsReturning(true); // 🌟 Prevents the animation from replaying
        }}
      />
    );
  }

  if (showChangePassword) {
    return (
      <ChangePassword
        onBack={() => {
          setShowChangePassword(false);
          setIsReturning(true); // 🌟 Prevents the animation from replaying
        }}
        onSuccess={() => {
          setShowChangePassword(false);
          setIsReturning(true);
          setShowSaveSuccess(true);
        }}
      />
    );
  }

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
          overflowY: "auto",
          overscrollBehavior: "none",
          backgroundColor: "#f8fafc",
          padding: "0px 16px 40px 16px",
          boxSizing: "border-box",
          // 🌟 If closing, slide out. If returning, do nothing. Otherwise, slide in.
          animation: isClosing
            ? "slideOutRight 0.25s ease forwards"
            : isReturning
              ? "none"
              : "slideInRight 0.3s ease-out forwards",
        }}
      >
        {/* SUCCESS MODAL */}
        {showSaveSuccess && (
          <div className="modal-overlay" style={{ zIndex: 999999 }}>
            <div className="modal-box">
              <h3 className="modal-title" style={{ color: "#16a34a" }}>
                {language === "Tagalog" ? "TAGUMPAY" : "SUCCESS"}
              </h3>
              <p className="modal-text">
                {t.saveAlert || "Changes have been saved successfully!"}
              </p>
              <div className="modal-buttons">
                <button
                  className="modal-btn confirm-btn"
                  onClick={() => window.location.reload()}
                  style={{
                    backgroundColor: "#1b0b8c",
                    width: "100%",
                    borderRadius: "50px",
                  }}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

        {/* LOGOUT MODAL */}
        {showLogoutModal && (
          <div className="custom-alert-overlay" style={{ zIndex: 999999 }}>
            <div className="custom-alert-box">
              <div className="custom-alert-header alert-header-danger">
                <h2>{t.signOutTitle}</h2>
              </div>
              <div className="custom-alert-body">
                <p>{t.signOutText}</p>
                <div className="custom-alert-buttons">
                  <button
                    className="alert-btn no-btn"
                    onClick={() => setShowLogoutModal(false)}
                  >
                    {t.cancelBtn}
                  </button>
                  <button
                    className="alert-btn yes-btn"
                    style={{ backgroundColor: "#ef4444" }}
                    onClick={handleSignOut}
                  >
                    {t.confirmSignOutBtn}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STICKY HEADER */}
        <div
          style={{
            position: "sticky",
            top: 0,
            margin: "0 -16px 20px -16px",
            padding:
              "calc(env(safe-area-inset-top, 0px) + 20px) 16px 18px 16px",
            background: "rgba(248, 250, 252, 0.95)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            zIndex: 50,
            borderBottom: "1px solid rgba(0,0,0,0.06)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <button
            onClick={handleBack}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
          >
            <ChevronLeft size={28} color="#1b0b8c" strokeWidth={2.5} />
          </button>
          <h2
            style={{
              margin: 0,
              fontSize: "1.3rem",
              fontWeight: "900",
              letterSpacing: "1px",
              textTransform: "uppercase",
              color: "#1b0b8c",
            }}
          >
            {t.settingsTitle}
          </h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* LANGUAGES CARD */}
          <div>
            <h3
              style={{
                fontSize: "0.85rem",
                fontWeight: "800",
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "1px",
                margin: "0 0 10px 10px",
              }}
            >
              {t.languages}
            </h3>
            <div
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "16px",
                padding: "20px",
                boxShadow: "0 4px 10px rgba(0,0,0,0.04)",
                border: "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "12px",
                }}
              >
                <Globe size={20} color="#1b0b8c" />
                <span
                  style={{
                    fontSize: "0.95rem",
                    fontWeight: "700",
                    color: "#1e293b",
                  }}
                >
                  {t.chooseLanguage}
                </span>
              </div>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: "12px",
                  border: "1px solid #cbd5e1",
                  fontSize: "1rem",
                  color: "#334155",
                  backgroundColor: "#f8fafc",
                  outline: "none",
                  fontWeight: "600",
                }}
              >
                <option value="English">English</option>
                <option value="Tagalog">Tagalog</option>
              </select>
            </div>
          </div>

          {/* SAVE BUTTON */}
          <button
            onClick={handleSaveSettings}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "50px",
              backgroundColor: "#1b0b8c",
              color: "#ffffff",
              fontWeight: "900",
              fontSize: "1rem",
              border: "none",
              cursor: "pointer",
              textTransform: "uppercase",
              boxShadow: "0 8px 20px rgba(27, 11, 140, 0.25)",
              transition: "transform 0.1s ease",
            }}
            onMouseDown={(e) =>
              (e.currentTarget.style.transform = "scale(0.98)")
            }
            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            {t.save}
          </button>

          {/* ACCOUNT CARD */}
          <div>
            <h3
              style={{
                fontSize: "0.85rem",
                fontWeight: "800",
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "1px",
                margin: "0 0 10px 10px",
              }}
            >
              {t.account}
            </h3>
            <div
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "16px",
                padding: "20px",
                boxShadow: "0 4px 10px rgba(0,0,0,0.04)",
                border: "1px solid #e2e8f0",
                display: "flex",
                flexDirection: "column",
                gap: "15px",
              }}
            >
              <button
                onClick={() => setShowChangePassword(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "none",
                  border: "none",
                  padding: "5px 0",
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    color: "#475569",
                  }}
                >
                  <KeyRound size={20} />
                  <span style={{ fontWeight: "700", fontSize: "1rem" }}>
                    Change Password
                  </span>
                </div>
                <ChevronLeft
                  size={20}
                  color="#94a3b8"
                  style={{ transform: "rotate(180deg)" }}
                />
              </button>

              <hr
                style={{
                  border: "none",
                  borderTop: "1px solid #e2e8f0",
                  margin: "0",
                }}
              />

              <button
                onClick={() => setShowAboutUs(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "none",
                  border: "none",
                  padding: "5px 0",
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    color: "#475569",
                  }}
                >
                  <Info size={20} />
                  <span style={{ fontWeight: "700", fontSize: "1rem" }}>
                    {t.aboutUs}
                  </span>
                </div>
                <ChevronLeft
                  size={20}
                  color="#94a3b8"
                  style={{ transform: "rotate(180deg)" }}
                />
              </button>

              <hr
                style={{
                  border: "none",
                  borderTop: "1px solid #e2e8f0",
                  margin: "0",
                }}
              />

              <button
                onClick={() => setShowLogoutModal(true)}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "12px",
                  backgroundColor: "#fef2f2",
                  color: "#dc2626",
                  fontWeight: "800",
                  fontSize: "1rem",
                  border: "1px solid #fca5a5",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <LogOut size={20} /> {t.logoutAccount}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default SettingsTab;
