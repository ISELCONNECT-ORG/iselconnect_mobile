import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import LinemanReportDetail from "./LinemanReportDetail";
import { translations } from "../components/translations";

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

function LinemanReportTab() {
  const currentLang = localStorage.getItem("appLanguage") || "English";
  const t = translations[currentLang];

  const [linemanName, setLinemanName] = useState("");
  const [assignedReports, setAssignedReports] = useState([]);
  const [totalSystemReports, setTotalSystemReports] = useState(0);
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
        .select("first_name, branch_id")
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

      let countQuery = supabase
        .from("reports")
        .select("*", { count: "exact", head: true });
      if (userData?.branch_id)
        countQuery = countQuery.eq("branch_id", userData.branch_id);
      const { count: systemTotalCount } = await countQuery;
      if (systemTotalCount !== null) setTotalSystemReports(systemTotalCount);
    } catch (error) {
      console.error("Error fetching lineman data:", error.message);
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

  const activeAssignedReports = assignedReports.filter(
    (r) => r.report_statuses?.name?.toUpperCase() !== "RESOLVED",
  );

  const filteredActiveReports = activeAssignedReports.filter((r) => {
    if (filterStatus === "ALL") return true;
    return r.report_statuses?.name?.toUpperCase() === filterStatus;
  });

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
      {/* STICKY HEADER */}
      <div
        style={{
          position: "sticky",
          top: 0,
          margin: "-18px -16px 20px -16px",
          padding: "18px 16px 15px 16px",
          background: "rgba(255, 255, 255, 0.92)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          zIndex: 50,
          borderBottom: "1px solid rgba(0,0,0,0.05)",
        }}
      >
        <p className="l-rt-greeting" style={{ margin: 0 }}>
          {t.hello}
        </p>
        <h2 className="l-rt-name" style={{ margin: 0 }}>
          {linemanName || "Lineman"}
        </h2>
      </div>

      <div
        style={{
          display: "flex",
          gap: "15px",
          width: "100%",
          boxSizing: "border-box",
          marginBottom: "25px",
        }}
      >
        <div
          className="l-rt-stat-box-blue"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <p className="l-rt-stat-title-blue">
            {t.totalReports.split(" ")[0]}
            <br />
            {t.totalReports.split(" ")[1]}
          </p>
          <h3 className="l-rt-stat-num-blue">{totalSystemReports}</h3>
        </div>
        <div
          className="l-rt-stat-box-yellow"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <p
            className="l-rt-stat-title-yellow"
            style={{ textTransform: "uppercase" }}
          >
            NUMBER OF
            <br />
            ASSIGNED REPORTS
          </p>
          <h3 className="l-rt-stat-num-yellow">
            {activeAssignedReports.length}
          </h3>
        </div>
      </div>

      <h2 className="l-rt-section-title" style={{ marginBottom: 0 }}>
        <span className="text-yellow">{t.assigned}</span>{" "}
        <span className="text-navy">{t.reports}</span>
      </h2>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          padding: "5px 0",
          marginTop: "10px",
          marginBottom: "15px",
        }}
      >
        {["ALL", "PENDING", "IN PROGRESS"].map((status) => {
          let displayName =
            status === "ALL"
              ? t.all
              : status === "PENDING"
                ? t.pending
                : t.inProgress;
          return (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              style={{
                padding: "10px 18px",
                borderRadius: "50px",
                border: "none",
                fontWeight: "900",
                fontSize: "0.75rem",
                cursor: "pointer",
                whiteSpace: "nowrap",
                backgroundColor:
                  filterStatus === status ? "#1b0b8c" : "#e2e8f0",
                color: filterStatus === status ? "#ffffff" : "#475569",
                boxShadow:
                  filterStatus === status
                    ? "0 4px 10px rgba(27,11,140,0.2)"
                    : "none",
                flexShrink: 0,
              }}
            >
              {displayName}
            </button>
          );
        })}
      </div>

      <div
        className="l-rt-list-wrapper"
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
          <p
            className="l-rt-loading"
            style={{ color: "#64748b", background: "transparent" }}
          >
            {t.noActiveReports}
          </p>
        ) : (
          filteredActiveReports.map((report) => {
            const statusName =
              report.report_statuses?.name?.toUpperCase() || "UNKNOWN";
            let displayStatusName =
              statusName === "PENDING"
                ? t.pending
                : statusName === "IN PROGRESS"
                  ? t.inProgress
                  : statusName;
            let badgeBg = "#f1f5f9",
              badgeColor = "#475569",
              badgeBorder = "#cbd5e1";

            if (statusName === "PENDING") {
              badgeBg = "#fffbeb";
              badgeColor = "#b45309";
              badgeBorder = "#fef3c7";
            } else if (statusName === "IN PROGRESS") {
              badgeBg = "#eff6ff";
              badgeColor = "#1d4ed8";
              badgeBorder = "#bfdbfe";
            }

            return (
              <div
                key={`assigned-${report.id}`}
                className="lineman-report-card cursor-pointer"
                onClick={() => setSelectedReport(report)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "10px",
                  margin: 0,
                  borderLeft: `6px solid ${getPriorityColor(report.report_types?.priority_level)}`,
                }}
              >
                <div style={{ flex: 1 }}>
                  <span
                    style={{
                      fontSize: "0.65rem",
                      fontWeight: "900",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      color: getPriorityColor(
                        report.report_types?.priority_level,
                      ),
                      display: "block",
                      marginBottom: "4px",
                    }}
                  >
                    {report.report_types?.priority_level || "Normal"} Priority
                  </span>

                  {/* NEW: Displaying the Report ID right beside the report type name */}
                  <h3 className="lineman-report-title">
                    {report.id}. {report.report_types?.name || "UNKNOWN ISSUE"}
                  </h3>

                  <p className="lineman-report-address">
                    {formatAddress(report)}
                  </p>
                </div>
                <div
                  style={{
                    backgroundColor: badgeBg,
                    color: badgeColor,
                    border: `1px solid ${badgeBorder}`,
                    padding: "6px 12px",
                    borderRadius: "50px",
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
