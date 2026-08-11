import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { logSystemAction } from "../utils/logger"; // Added your logger!
import ReportTab from "./LinemanReportTab";
import HistoryTab from "./LinemanHistoryTab";
import NotificationTab from "./LinemanNotificationTab";
import ProfileTab from "./LinemanProfileTab";
import "../Lineman.css";

import { List, Archive, Bell, User, Power, AlertTriangle } from "lucide-react";

function LinemanDashboard() {
  const [activeTab, setActiveTab] = useState("report");
  const [dutyStatus, setDutyStatus] = useState("Loading...");
  const [userId, setUserId] = useState(null);

  const [hasEmployeeRow, setHasEmployeeRow] = useState(true);
  const [showOffDutyConfirm, setShowOffDutyConfirm] = useState(false); // NEW: Confirmation State

  useEffect(() => {
    const fetchDutyStatus = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setUserId(user.id);

        const { data, error } = await supabase
          .from("employees")
          .select("duty_status")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Error fetching employee profile:", error);
        }

        if (data) {
          setDutyStatus(data.duty_status || "Off Duty");
          setHasEmployeeRow(true);
        } else {
          setDutyStatus("Off Duty");
          setHasEmployeeRow(false);
        }
      }
    };

    fetchDutyStatus();
  }, []);

  // NEW: Intercepts the click before running the database update
  const handleDutyClick = () => {
    if (!userId || dutyStatus === "Loading...") return;

    if (!hasEmployeeRow) {
      alert(
        "System Error: Your account is not linked to an employee profile. Please ask an Admin to set up your Employee record.",
      );
      return;
    }

    if (dutyStatus === "On Duty") {
      setShowOffDutyConfirm(true); // Open Modal
    } else {
      executeDutyToggle("On Duty"); // Start duty immediately without modal
    }
  };

  // The actual database logic moved into a helper function
  const executeDutyToggle = async (newStatus) => {
    const previousStatus = dutyStatus;

    // Optimistic UI update
    setDutyStatus(newStatus);

    const { error } = await supabase
      .from("employees")
      .update({
        duty_status: newStatus,
        is_available: newStatus === "On Duty" ? true : false,
      })
      .eq("user_id", userId);

    if (error) {
      console.error("Error updating duty status:", error);
      alert("Failed to update status: " + error.message);
      setDutyStatus(previousStatus);
    } else {
      // NEW: Log the shift change for Admins to see!
      try {
        const action = newStatus === "On Duty" ? "DUTY_STARTED" : "DUTY_ENDED";
        const details =
          newStatus === "On Duty"
            ? "Lineman clocked IN and went on duty."
            : "Lineman clocked OUT and went off duty.";
        await logSystemAction(action, details);
      } catch (logErr) {
        console.warn("Could not write duty log:", logErr);
      }
    }
  };

  return (
    <div
      className="lineman-dashboard-layout"
      style={{ display: "flex", flexDirection: "column", height: "100vh" }}
    >
      {/* --- CONFIRMATION MODAL --- */}
      {showOffDutyConfirm && (
        <div className="success-modal-overlay" style={{ zIndex: 999999 }}>
          <div
            className="success-modal-box"
            style={{ borderTop: "6px solid #f59e0b" }}
          >
            <div
              className="success-modal-header"
              style={{
                color: "#f59e0b",
                marginBottom: "10px",
                backgroundColor: "#ffffff",
              }}
            >
              <Power
                size={42}
                style={{ margin: "0 auto 10px auto", display: "block" }}
              />
              <h2 style={{ margin: 0, fontSize: "1.4rem" }}>END SHIFT?</h2>
            </div>
            <div className="success-modal-body">
              <p
                style={{
                  margin: "0 0 20px 0",
                  color: "#475569",
                  lineHeight: "1.5",
                  fontWeight: "600",
                }}
              >
                Are you sure you want to go Off Duty? You will no longer receive
                new assignments.
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  className="success-modal-btn"
                  onClick={() => setShowOffDutyConfirm(false)}
                  style={{
                    flex: 1,
                    backgroundColor: "#f1f5f9",
                    color: "#475569",
                    border: "1px solid #cbd5e1",
                  }}
                >
                  Cancel
                </button>
                <button
                  className="success-modal-btn"
                  onClick={() => {
                    setShowOffDutyConfirm(false);
                    executeDutyToggle("Off Duty");
                  }}
                  style={{
                    flex: 1,
                    backgroundColor: "#f59e0b",
                    color: "white",
                  }}
                >
                  Go Off Duty
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- GLOBAL DUTY STATUS BANNER --- */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 20px",
          backgroundColor:
            dutyStatus === "On Duty"
              ? "#16a34a"
              : dutyStatus === "Loading..."
                ? "#94a3b8"
                : "#ef4444",
          color: "white",
          boxShadow: "0 4px 10px rgba(0, 0, 0, 0.15)",
          zIndex: 100,
          flexShrink: 0,
          transition: "background-color 0.3s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Power size={20} />
          <span
            style={{
              fontWeight: "900",
              fontSize: "0.95rem",
              letterSpacing: "0.5px",
            }}
          >
            {!hasEmployeeRow
              ? "NO PROFILE"
              : dutyStatus === "On Duty"
                ? "ON DUTY"
                : dutyStatus === "Loading..."
                  ? "LOADING..."
                  : "OFF DUTY"}
          </span>
        </div>

        <button
          onClick={handleDutyClick} // Changed to the new handler!
          disabled={dutyStatus === "Loading..." || !hasEmployeeRow}
          style={{
            backgroundColor: "white",
            color: dutyStatus === "On Duty" ? "#16a34a" : "#ef4444",
            border: "none",
            padding: "8px 16px",
            borderRadius: "50px",
            fontWeight: "900",
            fontSize: "0.75rem",
            cursor:
              dutyStatus === "Loading..." || !hasEmployeeRow
                ? "not-allowed"
                : "pointer",
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
            textTransform: "uppercase",
            transition: "transform 0.1s ease",
            opacity: dutyStatus === "Loading..." || !hasEmployeeRow ? 0.7 : 1,
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.95)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          {dutyStatus === "On Duty" ? "Go Off Duty" : "Start Duty"}
        </button>
      </div>

      {/* Middle Wrapper (handles the scrolling perfectly) */}
      <div
        key={activeTab}
        className="animate-tab-switch l-rt-tab"
        style={{
          width: "100%",
          flex: 1,
          overflowY: "auto",
          paddingBottom: "80px",
        }}
      >
        {activeTab === "report" && <ReportTab />}
        {activeTab === "history" && <HistoryTab />}
        {activeTab === "notification" && <NotificationTab />}
        {activeTab === "profile" && <ProfileTab />}
      </div>

      {/* 4-Item PERSISTENT BOTTOM NAVIGATION */}
      <div className="bottom-nav-wrapper">
        <div className="pill-nav">
          <button
            className={`nav-item ${activeTab === "report" ? "active" : ""}`}
            onClick={() => setActiveTab("report")}
          >
            <List size={24} strokeWidth={activeTab === "report" ? 2.5 : 2} />
            <span>Assigned</span>
          </button>

          <button
            className={`nav-item ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            <Archive
              size={24}
              strokeWidth={activeTab === "history" ? 2.5 : 2}
            />
            <span>Logs</span>
          </button>

          <button
            className={`nav-item ${activeTab === "notification" ? "active" : ""}`}
            onClick={() => setActiveTab("notification")}
          >
            <Bell
              size={24}
              strokeWidth={activeTab === "notification" ? 2.5 : 2}
            />
            <span>Notifs</span>
          </button>

          <button
            className={`nav-item ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            <User size={24} strokeWidth={activeTab === "profile" ? 2.5 : 2} />
            <span>Profile</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default LinemanDashboard;
