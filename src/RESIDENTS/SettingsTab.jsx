import React, { useState } from "react";
import { ChevronLeft, Info, LogOut } from "lucide-react";
import { supabase } from "../supabaseClient";
import { logSystemAction } from "../utils/logger";
import { translations } from "../components/translations";
import AboutUs from "./AboutUs";
import "../Resident.css";

function SettingsTab({ onBack, onLogout }) {
  const savedLanguage = localStorage.getItem("appLanguage") || "English";
  const t = translations[savedLanguage];

  const [language, setLanguage] = useState(savedLanguage);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showAboutUs, setShowAboutUs] = useState(false);

  // ADDED: State to control the custom success modal
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

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

  if (showAboutUs) {
    return <AboutUs onBack={() => setShowAboutUs(false)} />;
  }

  return (
    <div
      className="settings-page page-transition"
      style={{
        height: "100%",
        overflowY: "auto",
        paddingBottom: "120px",
        boxSizing: "border-box",
      }}
    >
      {showSaveSuccess && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3 className="modal-title" style={{ color: "#16a34a" }}>
              {language === "Tagalog" ? "TAGUMPAY" : "SUCCESS"}
            </h3>
            <p className="modal-text">{t.saveAlert}</p>
            <div className="modal-buttons">
              <button
                className="modal-btn confirm-btn"
                onClick={() => window.location.reload()}
                style={{ backgroundColor: "#1b0b8c", width: "100%" }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXISTING LOGOUT MODAL */}
      {showLogoutModal && (
        <div className="custom-alert-overlay">
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

      <div className="settings-header-section">
        <button className="back-btn" onClick={onBack}>
          <ChevronLeft size={28} strokeWidth={3} />
        </button>
        <h2>{t.settingsTitle}</h2>
      </div>

      <div className="settings-content-wrapper">
        <div className="settings-card">
          <h2 className="settings-card-title">{t.languages}</h2>
          <h3
            className="section-label"
            style={{
              marginBottom: "10px",
              color: "#64748b",
              fontSize: "0.9rem",
            }}
          >
            {t.chooseLanguage}
          </h3>
          <select
            className="language-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="English">English</option>
            <option value="Tagalog">Tagalog</option>
          </select>
        </div>

        <button className="settings-save-btn" onClick={handleSaveSettings}>
          {t.save}
        </button>

        <div className="settings-card" style={{ marginTop: "15px" }}>
          <h2 className="settings-card-title">{t.account}</h2>
          <button
            className="settings-logout-btn"
            onClick={() => setShowLogoutModal(true)}
          >
            <LogOut size={20} /> {t.logoutAccount}
          </button>

          <button
            onClick={() => setShowAboutUs(true)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              gap: "10px",
              marginTop: "20px",
              color: "#64748b",
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              width: "100%",
              fontFamily: "inherit",
              fontSize: "1rem",
            }}
          >
            <Info size={20} />
            <span style={{ fontWeight: "bold" }}>{t.aboutUs}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsTab;
