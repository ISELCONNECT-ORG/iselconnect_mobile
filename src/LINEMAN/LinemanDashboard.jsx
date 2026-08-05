import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
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

  // NEW: Track if the admin has actually created an employee row for this user
  const [hasEmployeeRow, setHasEmployeeRow] = useState(true);

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
          // If data is null, they don't have a row in the employees table!
          setDutyStatus("Off Duty");
          setHasEmployeeRow(false);
        }
      }
    };

    fetchDutyStatus();
  }, []);

  const toggleDuty = async () => {
    if (!userId || dutyStatus === "Loading...") return;

    // Safety check: Prevent updating if they don't exist in the employees table
    if (!hasEmployeeRow) {
      alert(
        "System Error: Your account is not linked to an employee profile. Please ask an Admin to set up your Employee record.",
      );
      return;
    }

    const previousStatus = dutyStatus;
    const newStatus = dutyStatus === "On Duty" ? "Off Duty" : "On Duty";

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
      // NEW: Show the exact error to the user and revert the button
      console.error("Error updating duty status:", error);
      alert("Failed to update status: " + error.message);
      setDutyStatus(previousStatus);
    }
  };

  return (
    <div
      className="lineman-dashboard-layout"
      style={{ display: "flex", flexDirection: "column", height: "100vh" }}
    >
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
          onClick={toggleDuty}
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
