import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import LinemanReportDetail from "./LinemanReportDetail";
import { translations } from "../components/translations";
import { Power, ClipboardList } from "lucide-react";

const priorityWeight = {
  Critical: 4,
  High: 3,
  Normal: 2,
  Low: 1,
};

const getPriorityColor = (level) => {
  switch (level?.toUpperCase()) {
    case "CRITICAL":
      return "#ef4444";
    case "HIGH":
      return "#f97316";
    case "NORMAL":
      return "#3b82f6";
    case "LOW":
      return "#10b981";
    default:
      return "#1b0b8c";
  }
};

function LinemanReportTab({
  dutyStatus,
  onDutyToggle,
  hasEmployeeRow,
  dutyStartTime,
  dutyEndTime,
}) {
  const currentLang = localStorage.getItem("appLanguage") || "English";
  const t = translations[currentLang];

  const [linemanName, setLinemanName] = useState("");
  const [assignedReports, setAssignedReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);

  const [filterStatus, setFilterStatus] = useState("ALL");

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw userError;

      const { data: userData } = await supabase
        .from("users")
        .select("first_name")
        .eq("id", user.id)
        .maybeSingle();

      if (userData) setLinemanName(userData.first_name);

      const { data: assignmentsData, error: assignError } = await supabase
        .from("assignments")
        .select(
          `reports ( id, description, landmark, latitude, longitude, photo_url, purok_sitio, created_at, barangays ( name ), municipalities ( name ), report_types ( name, priority_level ), report_statuses ( id, name ) )`,
        )
        .eq("lineman_id", user.id);

      if (assignmentsData && !assignError) {
        const extractedReports = assignmentsData
          .map((a) => a.reports)
          .filter(Boolean);

        const sortedAssignedReports = extractedReports.sort((a, b) => {
          const weightA = priorityWeight[a.report_types?.priority_level] || 0;
          const weightB = priorityWeight[b.report_types?.priority_level] || 0;
          if (weightB !== weightA) return weightB - weightA;
          return new Date(b.created_at) - new Date(a.created_at);
        });
        setAssignedReports(sortedAssignedReports);
      }
    } catch (error) {
      console.error("Error fetching lineman queue data:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatAddress = (report) => {
    return [
      report.purok_sitio,
      report.barangays?.name,
      report.municipalities?.name,
      "Isabela",
    ]
      .filter(Boolean)
      .join(", ");
  };

  const formatTime = (isoString) => {
    if (!isoString) return "";
    const d = new Date(isoString);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const activeAssignedReports = assignedReports.filter(
    (r) => r.report_statuses?.name?.toUpperCase() !== "RESOLVED",
  );

  const onQueueCount = activeAssignedReports.filter(
    (r) => r.report_statuses?.name?.toUpperCase() === "ON QUEUE",
  ).length;

  const inProgressCount = activeAssignedReports.filter(
    (r) => r.report_statuses?.name?.toUpperCase() === "IN PROGRESS",
  ).length;

  const filteredActiveReports = activeAssignedReports.filter((r) => {
    if (filterStatus === "ALL") return true;
    return r.report_statuses?.name?.toUpperCase() === filterStatus;
  });

  const handleFilterClick = (status) => {
    if (filterStatus === status) {
      setFilterStatus("ALL");
    } else {
      setFilterStatus(status);
    }
  };

  if (selectedReport) {
    return (
      <LinemanReportDetail
        report={selectedReport}
        onBack={() => setSelectedReport(null)}
        onReportUpdated={() => {
          setSelectedReport(null);
          fetchDashboardData();
        }}
      />
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        boxSizing: "border-box",
        padding: "18px 16px",
        background: "linear-gradient(180deg, #ffffff 0%, #f4f6ff 100%)",
        minHeight: "100%",
      }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          margin: "-18px -16px 20px -16px",
          padding: "18px 16px 15px 16px",
          background: "rgba(248, 250, 252, 0.92)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          zIndex: 50,
          borderBottom: "1px solid rgba(0,0,0,0.05)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <p className="l-rt-greeting" style={{ margin: 0 }}>
            {t.hello}
          </p>
          <h2 className="l-rt-name" style={{ margin: 0, lineHeight: 1.1 }}>
            {linemanName || "Lineman"}
          </h2>

          <div
            style={{
              marginTop: "4px",
              fontSize: "0.75rem",
              color: "#64748b",
              fontWeight: "700",
            }}
          >
            {dutyStatus === "On Duty" && dutyStartTime && (
              <span>
                Started:{" "}
                <span style={{ color: "#16a34a" }}>
                  {formatTime(dutyStartTime)}
                </span>
              </span>
            )}
            {dutyStatus === "Off Duty" && dutyEndTime && (
              <span>
                Ended:{" "}
                <span style={{ color: "#ef4444" }}>
                  {formatTime(dutyEndTime)}
                </span>
              </span>
            )}
          </div>
        </div>

        {dutyStatus && (
          <button
            onClick={onDutyToggle}
            disabled={dutyStatus === "Loading..." || !hasEmployeeRow}
            style={{
              backgroundColor:
                dutyStatus === "On Duty"
                  ? "#16a34a"
                  : dutyStatus === "Loading..."
                    ? "#94a3b8"
                    : "#ef4444",
              color: "white",
              border: "none",
              padding: "8px 16px",
              borderRadius: "50px",
              fontWeight: "900",
              fontSize: "0.75rem",
              cursor:
                dutyStatus === "Loading..." || !hasEmployeeRow
                  ? "not-allowed"
                  : "pointer",
              boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "transform 0.1s ease, background-color 0.3s ease",
              opacity: dutyStatus === "Loading..." || !hasEmployeeRow ? 0.7 : 1,
            }}
          >
            <Power size={14} strokeWidth={3} />
            {!hasEmployeeRow
              ? "NO PROFILE"
              : dutyStatus === "On Duty"
                ? "ON DUTY"
                : dutyStatus === "Loading..."
                  ? "LOADING"
                  : "OFF DUTY"}
          </button>
        )}
      </div>

      {/* 🌟 3-Column UI Counter Dashboard (Total Assigned, On Queue, In Progress) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "10px",
          width: "100%",
          boxSizing: "border-box",
          marginBottom: "25px",
        }}
      >
        <div
          onClick={() => setFilterStatus("ALL")}
          style={{
            backgroundColor: "#f1f5f9",
            border: "1px solid #e2e8f0",
            borderRadius: "16px",
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            cursor: "pointer",
            opacity: filterStatus === "ALL" ? 1 : 0.45,
            transform: filterStatus === "ALL" ? "scale(1.03)" : "scale(1)",
            transition: "all 0.2s ease",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "0.65rem",
              fontWeight: "800",
              color: "#475569",
              textTransform: "uppercase",
            }}
          >
            Total
            <br />
            Assigned
          </p>
          <h3
            style={{
              margin: "8px 0 0 0",
              fontSize: "1.3rem",
              fontWeight: "900",
              color: "#1e293b",
            }}
          >
            {activeAssignedReports.length}
          </h3>
        </div>

        <div
          onClick={() => handleFilterClick("ON QUEUE")}
          style={{
            backgroundColor: "#fffbeb",
            border: "1px solid #fde047",
            borderRadius: "16px",
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            cursor: "pointer",
            opacity:
              filterStatus === "ALL" || filterStatus === "ON QUEUE" ? 1 : 0.45,
            transform: filterStatus === "ON QUEUE" ? "scale(1.03)" : "scale(1)",
            transition: "all 0.2s ease",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "0.65rem",
              fontWeight: "900",
              color: "#b45309",
              textTransform: "uppercase",
            }}
          >
            On
            <br />
            Queue
          </p>
          <h3
            style={{
              margin: "8px 0 0 0",
              fontSize: "1.3rem",
              fontWeight: "900",
              color: "#b45309",
            }}
          >
            {onQueueCount}
          </h3>
        </div>

        <div
          onClick={() => handleFilterClick("IN PROGRESS")}
          style={{
            backgroundColor: "#f0fdf4",
            border: "1px solid #86efac",
            borderRadius: "16px",
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            cursor: "pointer",
            opacity:
              filterStatus === "ALL" || filterStatus === "IN PROGRESS"
                ? 1
                : 0.45,
            transform:
              filterStatus === "IN PROGRESS" ? "scale(1.03)" : "scale(1)",
            transition: "all 0.2s ease",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "0.65rem",
              fontWeight: "900",
              color: "#15803d",
              textTransform: "uppercase",
            }}
          >
            In
            <br />
            Progress
          </p>
          <h3
            style={{
              margin: "8px 0 0 0",
              fontSize: "1.3rem",
              fontWeight: "900",
              color: "#15803d",
            }}
          >
            {inProgressCount}
          </h3>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "15px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <ClipboardList size={20} color="#1b0b8c" />
          <h2 className="l-rt-section-title" style={{ margin: 0 }}>
            <span className="text-yellow">TEAM</span>{" "}
            <span className="text-navy">QUEUE</span>
          </h2>
        </div>

        {filterStatus !== "ALL" && (
          <button
            onClick={() => setFilterStatus("ALL")}
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              fontWeight: "bold",
              fontSize: "0.85rem",
              textDecoration: "underline",
              cursor: "pointer",
              padding: 0,
            }}
          >
            View All
          </button>
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {loading ? (
          <p className="l-rt-loading">{t.loadingAssignments}</p>
        ) : filteredActiveReports.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <p
              className="l-rt-loading"
              style={{
                color: "#64748b",
                background: "transparent",
                margin: "0 0 5px 0",
              }}
            >
              {t.noActiveReports}
            </p>
            {filterStatus !== "ALL" && (
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#94a3b8" }}>
                Try selecting a different filter.
              </p>
            )}
          </div>
        ) : (
          filteredActiveReports.map((report) => {
            const statusName =
              report.report_statuses?.name?.toUpperCase() || "UNKNOWN";

            let displayStatusName = statusName;
            let badgeBg = "#f1f5f9",
              badgeColor = "#475569",
              badgeBorder = "#cbd5e1";

            if (statusName === "ON QUEUE") {
              badgeBg = "#fffbeb";
              badgeColor = "#ca8a04";
              badgeBorder = "#fef08a";
            } else if (statusName === "IN PROGRESS") {
              displayStatusName = t.inProgress;
              badgeBg = "#f0f9ff";
              badgeColor = "#0284c7";
              badgeBorder = "#bae6fd";
            }

            return (
              <div
                key={`queue-${report.id}`}
                onClick={() => setSelectedReport(report)}
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "16px",
                  cursor: "pointer",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.05)",
                  position: "relative",
                  overflow: "hidden",
                  border: "1px solid #f1f5f9",
                  width: "100%",
                  boxSizing: "border-box",
                  transition: "transform 0.1s",
                }}
                onMouseDown={(e) =>
                  (e.currentTarget.style.transform = "scale(0.98)")
                }
                onMouseUp={(e) =>
                  (e.currentTarget.style.transform = "scale(1)")
                }
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    flex: 1,
                    paddingRight: "12px",
                  }}
                >
                  <span
                    style={{
                      color: getPriorityColor(
                        report.report_types?.priority_level,
                      ),
                      fontSize: "0.65rem",
                      fontWeight: "900",
                      letterSpacing: "0.5px",
                      textTransform: "uppercase",
                      marginBottom: "4px",
                    }}
                  >
                    {report.report_types?.priority_level || "Normal"} Priority
                  </span>

                  <h3
                    style={{
                      margin: "0 0 4px 0",
                      color: "#1b0b8c",
                      fontSize: "1.05rem",
                      fontWeight: "900",
                      letterSpacing: "0.2px",
                      lineHeight: "1.2",
                    }}
                  >
                    {report.id}. {report.report_types?.name || "UNKNOWN ISSUE"}
                  </h3>

                  <p
                    style={{
                      margin: 0,
                      color: "#64748b",
                      fontSize: "0.8rem",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      lineHeight: "1.4",
                    }}
                  >
                    {formatAddress(report)}
                  </p>
                </div>

                <div
                  style={{
                    backgroundColor: badgeBg,
                    color: badgeColor,
                    border: `1px solid ${badgeBorder}`,
                    padding: "6px 12px",
                    borderRadius: "20px",
                    fontSize: "0.7rem",
                    fontWeight: "900",
                    letterSpacing: "0.5px",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {displayStatusName}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default LinemanReportTab;
