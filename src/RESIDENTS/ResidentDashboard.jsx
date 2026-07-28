import React, { useState, useEffect } from "react";
import { Home, Zap, Camera as CameraIcon, Bell, User } from "lucide-react";
import HomeTab from "./HomeTab";
import AdvisoryTab from "./AdvisoryTab";
import ReportTab from "./ReportTab";
import NotificationTab from "./NotificationTab";
import ProfileTab from "./ProfileTab";
import { translations } from "../components/translations";
import AreaAlertPopup from "../components/AreaAlertPopup";

// Import our new Guard component
import AccountBlockedGuard from "./AccountBlockedGuard";

function ResidentDashboard({ session, onLogout }) {
  const [activeTab, setActiveTab] = useState("home");
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("isNewResident") === "true") {
      setShowWelcomeModal(true);
      localStorage.removeItem("isNewResident");
    }
  }, []);

  return (
    /* Wrap the entire app layout in the Guard */
    <AccountBlockedGuard>
      <div className="dashboard-layout">
        <AreaAlertPopup />

        <main
          key={activeTab}
          className="dashboard-main-content animate-tab-switch"
        >
          {activeTab === "home" && <HomeTab />}
          {activeTab === "advisory" && <AdvisoryTab />}
          {activeTab === "report" && (
            <ReportTab isActive={activeTab === "report"} />
          )}
          {activeTab === "notification" && <NotificationTab />}
          {activeTab === "profile" && <ProfileTab onLogout={onLogout} />}
        </main>

        <div className="bottom-nav-wrapper">
          <nav className="pill-nav">
            <button
              className={`nav-item ${activeTab === "home" ? "active" : ""}`}
              onClick={() => setActiveTab("home")}
            >
              <Home size={24} strokeWidth={activeTab === "home" ? 2.5 : 2} />
              <span>Home</span>
            </button>

            <button
              className={`nav-item ${activeTab === "advisory" ? "active" : ""}`}
              onClick={() => setActiveTab("advisory")}
            >
              <Zap size={24} strokeWidth={activeTab === "advisory" ? 2.5 : 2} />
              <span>Advisory</span>
            </button>

            <button
              className={`nav-item ${activeTab === "report" ? "active" : ""}`}
              onClick={() => setActiveTab("report")}
            >
              <CameraIcon
                size={24}
                strokeWidth={activeTab === "report" ? 2.5 : 2}
              />
              <span>Report</span>
            </button>
            <button
              className={`nav-item ${activeTab === "notification" ? "active" : ""}`}
              onClick={() => setActiveTab("notification")}
            >
              <Bell
                size={24}
                strokeWidth={activeTab === "notification" ? 2.5 : 2}
              />
              <span>Notification</span>
            </button>
            <button
              className={`nav-item ${activeTab === "profile" ? "active" : ""}`}
              onClick={() => setActiveTab("profile")}
            >
              <User size={24} strokeWidth={activeTab === "profile" ? 2.5 : 2} />
              <span>Profile</span>
            </button>
          </nav>
        </div>

        {showWelcomeModal && (
          <div className="modal-overlay">
            <div className="modal-box">
              <div style={{ fontSize: "50px", marginBottom: "15px" }}>🎉</div>
              <h3 className="modal-title">Registration Successful!</h3>
              <p className="modal-text">
                Welcome to <strong>ISELCONNECT</strong>. Your resident profile
                has been securely created. You can now report real-time power
                interruptions directly to ISELCO-1.
              </p>
              <button
                onClick={() => setShowWelcomeModal(false)}
                className="modal-btn confirm-btn"
                style={{
                  backgroundColor: "#1b0b8c",
                  width: "100%",
                  borderRadius: "25px",
                }}
              >
                Get Started
              </button>
            </div>
          </div>
        )}
      </div>
    </AccountBlockedGuard>
  );
}

export default ResidentDashboard;
