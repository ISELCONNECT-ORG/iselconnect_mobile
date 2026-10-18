import React, { useState, useEffect, useCallback } from "react";
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
import { getPendingNotificationData } from "../utils/pushNotifications";

function ResidentDashboard({ session, onLogout }) {
  // 🌟 FIX: REMEMBERS YOUR ACTIVE TAB ON REFRESH
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem("resident_active_tab") || "home";
  });

  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [hasUnreadNotifs, setHasUnreadNotifs] = useState(false);

  // 🌟 FIX: SAVES TAB CHANGES INSTANTLY
  useEffect(() => {
    localStorage.setItem("resident_active_tab", activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (localStorage.getItem("isNewResident") === "true") {
      setShowWelcomeModal(true);
      localStorage.removeItem("isNewResident");
    }
  }, []);

  const checkUnreadStatus = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const readIds = JSON.parse(
        localStorage.getItem("iselconnect_read_notifs") || "[]",
      );

      // 1. Check Standard Notifications
      const { data: standardNotifs } = await supabase
        .from("notifications")
        .select("id, is_read")
        .eq("residents_id", user.id);

      const hasUnreadStandard = standardNotifs?.some(
        (n) => !n.is_read && !readIds.includes(String(n.id)),
      );

      if (hasUnreadStandard) {
        setHasUnreadNotifs(true);
        return;
      }

      // 2. Check Power Advisories & Rejected Reports
      const { data: userData } = await supabase
        .from("users")
        .select("barangay_id")
        .eq("id", user.id)
        .single();

      if (userData && userData.barangay_id) {
        const today = new Date();
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(today.getDate() + 3);

        const { data: advisoriesData } = await supabase
          .from("power_advisories")
          .select("id")
          .contains("affected_barangay_ids", [userData.barangay_id])
          .gte("schedule_start", today.toISOString())
          .lte("schedule_start", threeDaysFromNow.toISOString());

        const hasUnreadAdvisory = advisoriesData?.some(
          (adv) => !readIds.includes(`adv-${adv.id}`),
        );

        if (hasUnreadAdvisory) {
          setHasUnreadNotifs(true);
          return;
        }
      }

      const { data: reportsData } = await supabase
        .from("reports")
        .select("id, report_statuses(name)")
        .eq("residents_id", user.id);

      if (reportsData) {
        const rejected = reportsData.filter(
          (r) => r.report_statuses?.name?.toUpperCase() === "REJECTED",
        );
        const hasUnreadRejected = rejected.some(
          (rep) => !readIds.includes(`rej-${rep.id}`),
        );

        if (hasUnreadRejected) {
          setHasUnreadNotifs(true);
          return;
        }
      }

      setHasUnreadNotifs(false);
    } catch (error) {
      console.error("Error checking dashboard unread status:", error);
    }
  }, []);

  useEffect(() => {
    checkUnreadStatus();

    const channel = supabase
      .channel("public:dashboard_notifications_all")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        checkUnreadStatus,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "reports" },
        checkUnreadStatus,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "power_advisories" },
        checkUnreadStatus,
      )
      .subscribe();

    const memoryPoller = setInterval(checkUnreadStatus, 2000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(memoryPoller);
    };
  }, [checkUnreadStatus]);

  useEffect(() => {
    const openReportFromData = async (payloadData) => {
      if (payloadData && payloadData.reportId) {
        const { data, error } = await supabase
          .from("reports")
          .select(
            `*, report_types ( name, priority_level ), report_statuses ( id, name )`,
          )
          .eq("id", payloadData.reportId)
          .single();

        if (data && !error) {
          setSelectedReport(data);
        }
      }
    };

    const missedTapData = getPendingNotificationData();
    if (missedTapData) {
      openReportFromData(missedTapData);
    }

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
              <div style={{ position: "relative", display: "inline-block" }}>
                <Bell
                  size={24}
                  strokeWidth={activeTab === "notification" ? 2.5 : 2}
                />
                {hasUnreadNotifs && (
                  <div
                    style={{
                      position: "absolute",
                      top: "-2px",
                      right: "0px",
                      width: "12px",
                      height: "12px",
                      backgroundColor: "#1b0b8c",
                      borderRadius: "50%",
                      border: "2px solid #ffffff",
                      zIndex: 10,
                    }}
                  />
                )}
              </div>
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
                has been securely created. Wait for the Admin to activate your
                account.
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
