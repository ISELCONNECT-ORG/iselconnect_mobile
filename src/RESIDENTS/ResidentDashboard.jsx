import React, { useState, useEffect } from "react";
import { Home, Zap, Camera as CameraIcon, Bell, User } from "lucide-react";
import HomeTab from "./HomeTab";
import AdvisoryTab from "./AdvisoryTab";
import ReportTab from "./ReportTab";
import NotificationTab from "./NotificationTab";
import ProfileTab from "./ProfileTab";
import { translations } from "../components/translations";
import AreaAlertPopup from "../components/AreaAlertPopup";

import AccountBlockedGuard from "./AccountBlockedGuard";
import ResidentReportDetail from "./ResidentReportDetail";
import { supabase } from "../supabaseClient";

// 🌟 NEW: Import the memory checker function
import { getPendingNotificationData } from "../utils/pushNotifications";

function ResidentDashboard({ session, onLogout }) {
  const [activeTab, setActiveTab] = useState("home");
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);

  useEffect(() => {
    if (localStorage.getItem("isNewResident") === "true") {
      setShowWelcomeModal(true);
      localStorage.removeItem("isNewResident");
    }
  }, []);

  // 🌟 UPDATED: PUSH NOTIFICATION TAP LISTENER
  useEffect(() => {
    // 1. Function to actually open the report
    const openReportFromData = async (payloadData) => {
      if (payloadData && payloadData.reportId) {
        console.log(
          "Opening report ID from notification:",
          payloadData.reportId,
        );
        const { data, error } = await supabase
          .from("reports")
          .select(
            `
            *,
            report_types ( name, priority_level ),
            report_statuses ( id, name )
          `,
          )
          .eq("id", payloadData.reportId)
          .single();

        if (data && !error) {
          setSelectedReport(data);
        }
      }
    };

    // 2. CHECK FOR COLD START MISSED TAPS FIRST!
    const missedTapData = getPendingNotificationData();
    if (missedTapData) {
      console.log("Found a missed tap from cold start!");
      openReportFromData(missedTapData);
    }

    // 3. Listen for normal taps while the app is already open in the background
    const handleNotificationTap = (event) => {
      openReportFromData(event.detail);
    };

    window.addEventListener("onPushNotificationTap", handleNotificationTap);

    return () => {
      window.removeEventListener(
        "onPushNotificationTap",
        handleNotificationTap,
      );
    };
  }, []);

  if (selectedReport) {
    return (
      <AccountBlockedGuard>
        <ResidentReportDetail
          report={selectedReport}
          onBack={() => setSelectedReport(null)}
          onReportUpdated={() => setSelectedReport(null)}
        />
      </AccountBlockedGuard>
    );
  }

  return (
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
