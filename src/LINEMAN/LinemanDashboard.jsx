import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { logSystemAction } from "../utils/logger";
import ReportTab from "./LinemanReportTab";
import HistoryTab from "./LinemanHistoryTab";
import NotificationTab from "./LinemanNotificationTab";
import ProfileTab from "./LinemanProfileTab";
import "../Lineman.css";

import { List, Archive, Bell, User, Power } from "lucide-react";

function LinemanDashboard() {
  const [activeTab, setActiveTab] = useState("report");
  const [dutyStatus, setDutyStatus] = useState("Loading...");
  const [userId, setUserId] = useState(null);

  // NEW: State for Timestamps
  const [dutyStartTime, setDutyStartTime] = useState(null);
  const [dutyEndTime, setDutyEndTime] = useState(null);

  const [hasEmployeeRow, setHasEmployeeRow] = useState(true);
  const [showOffDutyConfirm, setShowOffDutyConfirm] = useState(false);

  useEffect(() => {
    const fetchDutyStatus = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setUserId(user.id);

        // UPDATED: Fetching the new timestamp columns
        const { data, error } = await supabase
          .from("employees")
          .select("duty_status, duty_start_time, duty_end_time")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Error fetching employee profile:", error);
        }

        if (data) {
          setDutyStatus(data.duty_status || "Off Duty");
          setDutyStartTime(data.duty_start_time);
          setDutyEndTime(data.duty_end_time);
          setHasEmployeeRow(true);
        } else {
          setDutyStatus("Off Duty");
          setHasEmployeeRow(false);
        }
      }
    };

    fetchDutyStatus();
  }, []);

  const handleDutyClick = () => {
    if (!userId || dutyStatus === "Loading...") return;

    if (!hasEmployeeRow) {
      alert(
        "System Error: Your account is not linked to an employee profile. Please ask an Admin to set up your Employee record.",
      );
      return;
    }

    if (dutyStatus === "On Duty") {
      setShowOffDutyConfirm(true);
    } else {
      executeDutyToggle("On Duty");
    }
  };

  const executeDutyToggle = async (newStatus) => {
    const previousStatus = dutyStatus;
    const previousStart = dutyStartTime;
    const previousEnd = dutyEndTime;

    const now = new Date().toISOString();

    setDutyStatus(newStatus);

    // Prepare the update payload
    const updatePayload = {
      duty_status: newStatus,
      is_available: newStatus === "On Duty" ? true : false,
    };

    // Append the correct timestamp based on the action
    if (newStatus === "On Duty") {
      updatePayload.duty_start_time = now;
      setDutyStartTime(now);
    } else {
      updatePayload.duty_end_time = now;
      setDutyEndTime(now);
    }

    const { error } = await supabase
      .from("employees")
      .update(updatePayload)
      .eq("user_id", userId);

    if (error) {
      console.error("Error updating duty status:", error);
      alert("Failed to update status: " + error.message);
      // Revert optimistic UI on error
      setDutyStatus(previousStatus);
      setDutyStartTime(previousStart);
      setDutyEndTime(previousEnd);
    } else {
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

      {/* Middle Wrapper */}
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
        {/* UPDATED: Pass timestamps to the Report Tab! */}
        {activeTab === "report" && (
          <ReportTab
            dutyStatus={dutyStatus}
            onDutyToggle={handleDutyClick}
            hasEmployeeRow={hasEmployeeRow}
            dutyStartTime={dutyStartTime}
            dutyEndTime={dutyEndTime}
          />
        )}
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
