import React, { useState } from "react";
import { ChevronLeft, Info, LogOut, Globe } from "lucide-react";
import { supabase } from "../supabaseClient";
import { logSystemAction } from "../utils/logger";
import { translations } from "../components/translations";
import "../Lineman.css";
import AboutUs from "../RESIDENTS/AboutUs";

function LinemanSettingsTab({ onBack, onLogout }) {
  const savedLanguage = localStorage.getItem("appLanguage") || "English";
  const t = translations[savedLanguage];

  const [language, setLanguage] = useState(savedLanguage);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showAboutUs, setShowAboutUs] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  const handleSaveSettings = async () => {
    localStorage.setItem("appLanguage", language);
    await logSystemAction(
      "UPDATE_SETTINGS",
      `Lineman updated app settings (Language: ${language}).`,
    );
    setShowSaveSuccess(true);
  };

  const handleSignOut = async () => {
    try {
      await logSystemAction(
        "USER_LOGOUT",
        "Lineman logged out of the application.",
      );
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      if (onLogout) onLogout();
    } catch (error) {
      alert("Error logging out: " + error.message);
    }
  };

  if (showAboutUs) {
    return <AboutUs onBack={() => setShowAboutUs(false)} />;
  }

  return (
    <div
      className="page-transition"
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        boxSizing: "border-box",
        padding: "18px 16px 100px 16px",
        background: "linear-gradient(180deg, #ffffff 0%, #f4f6ff 100%)",
        minHeight: "100%",
        overflowY: "auto",
      }}
    >
      {/* SUCCESS MODAL */}
      {showSaveSuccess && (
        <div className="modal-overlay" style={{ zIndex: 999999 }}>
          <div className="modal-box">
            <h3 className="modal-title" style={{ color: "#16a34a" }}>
              {language === "Tagalog" ? "TAGUMPAY" : "SUCCESS"}
            </h3>
            <p className="modal-text">{t.saveAlert}</p>
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

      {/* 🌟 NEW STICKY BLUR HEADER */}
      <div
        style={{
          position: "sticky",
          top: 0,
          margin: "-18px -16px 20px -16px",
          padding: "22px 16px 18px 16px",
          background: "rgba(255, 255, 255, 0.92)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          zIndex: 50,
          borderBottom: "1px solid rgba(0,0,0,0.05)",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <button
          onClick={onBack}
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
            color: "#1b0b8c",
            margin: 0,
            fontSize: "1.5rem",
            fontWeight: "900",
            letterSpacing: "1px",
            textTransform: "uppercase",
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
              boxShadow: "0 4px 15px rgba(0,0,0,0.05)",
              border: "1px solid #f1f5f9",
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
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
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
              boxShadow: "0 4px 15px rgba(0,0,0,0.05)",
              border: "1px solid #f1f5f9",
              display: "flex",
              flexDirection: "column",
              gap: "15px",
            }}
          >
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

            <hr
              style={{
                border: "none",
                borderTop: "1px solid #e2e8f0",
                margin: "5px 0",
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
          </div>
        </div>
      </div>
    </div>
  );
}

export default LinemanSettingsTab;
