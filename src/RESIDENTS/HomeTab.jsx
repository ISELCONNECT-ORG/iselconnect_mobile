import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import ResidentReportDetail from "./ResidentReportDetail";
import HotlinesTab from "./HotlinesTab";
import SatisfactionSurveyModal from "./SatisfactionSurveyModal";
import { Clock, Wrench, CheckCircle, XCircle } from "lucide-react";
import "../Resident.css";

function HomeTab() {
  const [userName, setUserName] = useState("");
  const [userReports, setUserReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);

  const [showHotlines, setShowHotlines] = useState(false);
  const [filterStatus, setFilterStatus] = useState("ALL");

  const [reportToRate, setReportToRate] = useState(null);

  useEffect(() => {
    fetchHomeData();
  }, []);

  const fetchHomeData = async () => {
    try {
      setLoading(true);
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw userError;

      const { data: userData } = await supabase
        .from("users")
        .select("first_name, last_name")
        .eq("id", user.id)
        .single();

      if (userData) {
        setUserName(`${userData.first_name} ${userData.last_name}`);
      }

      const { data: reportsData, error: reportsError } = await supabase
        .from("reports")
        .select(
          `id, landmark, description, remarks, photo_url, resolved_photo_url, created_at, report_type_id, latitude, longitude, report_types ( name ), report_statuses ( name ), report_ratings ( id )`,
        )
        .eq("residents_id", user.id)
        .order("created_at", { ascending: false });

      if (!reportsError && reportsData) {
        setUserReports(reportsData);

        const unratedReport = reportsData.find(
          (r) =>
            (r.report_statuses?.name?.toUpperCase() === "RESOLVED" ||
              r.report_statuses?.name?.toUpperCase() === "APPROVED") &&
            (!r.report_ratings || r.report_ratings.length === 0),
        );

        if (unratedReport) {
          setReportToRate(unratedReport);
        }
      }
    } catch (error) {
      console.error("Error fetching home data:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (statusName) => {
    const status = statusName?.toUpperCase() || "PENDING";
    if (status === "RESOLVED" || status === "APPROVED") return "#16a34a";
    if (status === "IN PROGRESS") return "#0ea5e9";
    if (status === "REJECTED") return "#dc2626";
    return "#facc15";
  };

  const getTextColor = (statusName) => {
    const status = statusName?.toUpperCase() || "PENDING";
    if (status === "RESOLVED" || status === "APPROVED") return "#16a34a";
    if (status === "IN PROGRESS") return "#0ea5e9";
    if (status === "REJECTED") return "#dc2626";
    return "#ca8a04";
  };

  const pendingCount = userReports.filter(
    (r) => r.report_statuses?.name?.toUpperCase() === "PENDING",
  ).length;

  const inProgressCount = userReports.filter(
    (r) => r.report_statuses?.name?.toUpperCase() === "IN PROGRESS",
  ).length;

  const resolvedCount = userReports.filter(
    (r) =>
      r.report_statuses?.name?.toUpperCase() === "RESOLVED" ||
      r.report_statuses?.name?.toUpperCase() === "APPROVED",
  ).length;

  const rejectedCount = userReports.filter(
    (r) => r.report_statuses?.name?.toUpperCase() === "REJECTED",
  ).length;

  const filteredReports = userReports.filter((report) => {
    if (filterStatus === "ALL") return true;

    const status = report.report_statuses?.name?.toUpperCase() || "PENDING";
    if (filterStatus === "RESOLVED") {
      return status === "RESOLVED" || status === "APPROVED";
    }
    return status === filterStatus;
  });

  const handleFilterClick = (status) => {
    if (filterStatus === status) {
      setFilterStatus("ALL");
    } else {
      setFilterStatus(status);
    }
  };

  if (showHotlines) {
    return <HotlinesTab onBack={() => setShowHotlines(false)} />;
  }

  if (selectedReport) {
    return (
      <ResidentReportDetail
        report={selectedReport}
        onBack={() => setSelectedReport(null)}
        onReportUpdated={() => {
          setSelectedReport(null);
          fetchHomeData();
        }}
      />
    );
  }

  return (
    <>
      {reportToRate && (
        <SatisfactionSurveyModal
          report={reportToRate}
          onClose={() => setReportToRate(null)}
          onSuccess={() => {
            setReportToRate(null);
            fetchHomeData();
          }}
        />
      )}

      <div
        style={{
          padding: "30px 20px 100px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "30px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ maxWidth: "60%" }}>
            <p
              style={{
                margin: 0,
                fontSize: "1rem",
                color: "#64748b",
                fontWeight: "700",
              }}
            >
              Hello
            </p>
            <h2
              style={{
                margin: 0,
                fontSize: "1.8rem",
                fontWeight: "900",
                color: "#1b0b8c",
                lineHeight: "1.1",
              }}
            >
              {userName || "Resident"}
            </h2>
          </div>
          <button
            onClick={() => setShowHotlines(true)}
            style={{
              border: "1.5px solid #1b0b8c",
              backgroundColor: "transparent",
              color: "#1b0b8c",
              fontWeight: "900",
              fontSize: "0.7rem",
              padding: "10px 16px",
              borderRadius: "50px",
              cursor: "pointer",
              textAlign: "center",
              lineHeight: "1.3",
              transition: "all 0.2s ease",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(27, 11, 140, 0.05)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            EMERGENCY
            <br />
            HOTLINES
          </button>
        </div>

        {/* 2x2 Grid for Status Boxes */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
          }}
        >
          <div
            onClick={() => handleFilterClick("PENDING")}
            style={{
              backgroundColor: "#fffbeb",
              border: "1px solid #fef08a",
              borderRadius: "16px",
              padding: "16px 8px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              opacity:
                filterStatus === "ALL" || filterStatus === "PENDING" ? 1 : 0.4,
              transform:
                filterStatus === "PENDING" ? "scale(1.05)" : "scale(1)",
              transition: "all 0.2s ease",
            }}
          >
            <Clock size={24} color="#ca8a04" style={{ marginBottom: "6px" }} />
            <h3
              style={{
                margin: 0,
                fontSize: "1.8rem",
                color: "#ca8a04",
                fontWeight: "900",
                lineHeight: "1",
              }}
            >
              {pendingCount}
            </h3>
            <p
              style={{
                margin: "4px 0 0 0",
                fontSize: "0.7rem",
                color: "#ca8a04",
                fontWeight: "800",
              }}
            >
              PENDING
            </p>
          </div>

          <div
            onClick={() => handleFilterClick("IN PROGRESS")}
            style={{
              backgroundColor: "#f0f9ff",
              border: "1px solid #bae6fd",
              borderRadius: "16px",
              padding: "16px 8px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              opacity:
                filterStatus === "ALL" || filterStatus === "IN PROGRESS"
                  ? 1
                  : 0.4,
              transform:
                filterStatus === "IN PROGRESS" ? "scale(1.05)" : "scale(1)",
              transition: "all 0.2s ease",
            }}
          >
            <Wrench size={24} color="#0284c7" style={{ marginBottom: "6px" }} />
            <h3
              style={{
                margin: 0,
                fontSize: "1.8rem",
                color: "#0284c7",
                fontWeight: "900",
                lineHeight: "1",
              }}
            >
              {inProgressCount}
            </h3>
            <p
              style={{
                margin: "4px 0 0 0",
                fontSize: "0.7rem",
                color: "#0284c7",
                fontWeight: "800",
              }}
            >
              IN PROGRESS
            </p>
          </div>

          <div
            onClick={() => handleFilterClick("RESOLVED")}
            style={{
              backgroundColor: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: "16px",
              padding: "16px 8px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              opacity:
                filterStatus === "ALL" || filterStatus === "RESOLVED" ? 1 : 0.4,
              transform:
                filterStatus === "RESOLVED" ? "scale(1.05)" : "scale(1)",
              transition: "all 0.2s ease",
            }}
          >
            <CheckCircle
              size={24}
              color="#16a34a"
              style={{ marginBottom: "6px" }}
            />
            <h3
              style={{
                margin: 0,
                fontSize: "1.8rem",
                color: "#16a34a",
                fontWeight: "900",
                lineHeight: "1",
              }}
            >
              {resolvedCount}
            </h3>
            <p
              style={{
                margin: "4px 0 0 0",
                fontSize: "0.7rem",
                color: "#16a34a",
                fontWeight: "800",
              }}
            >
              RESOLVED
            </p>
          </div>

          <div
            onClick={() => handleFilterClick("REJECTED")}
            style={{
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "16px",
              padding: "16px 8px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              opacity:
                filterStatus === "ALL" || filterStatus === "REJECTED" ? 1 : 0.4,
              transform:
                filterStatus === "REJECTED" ? "scale(1.05)" : "scale(1)",
              transition: "all 0.2s ease",
            }}
          >
            <XCircle
              size={24}
              color="#dc2626"
              style={{ marginBottom: "6px" }}
            />
            <h3
              style={{
                margin: 0,
                fontSize: "1.8rem",
                color: "#dc2626",
                fontWeight: "900",
                lineHeight: "1",
              }}
            >
              {rejectedCount}
            </h3>
            <p
              style={{
                margin: "4px 0 0 0",
                fontSize: "0.7rem",
                color: "#dc2626",
                fontWeight: "800",
              }}
            >
              REJECTED
            </p>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "1.6rem",
                fontWeight: "900",
                letterSpacing: "0.5px",
              }}
            >
              <span style={{ color: "#facc15" }}>REPORT</span>{" "}
              <span style={{ color: "#1b0b8c" }}>STATUS</span>
            </h2>

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
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            {loading ? (
              <p
                style={{
                  textAlign: "center",
                  color: "#1b0b8c",
                  fontWeight: "bold",
                }}
              >
                Loading your reports...
              </p>
            ) : filteredReports.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "30px 0",
                  color: "#64748b",
                }}
              >
                <p style={{ fontWeight: "bold", margin: "0 0 5px 0" }}>
                  No {filterStatus !== "ALL" ? filterStatus.toLowerCase() : ""}{" "}
                  reports found.
                </p>
                {filterStatus !== "ALL" && (
                  <p style={{ margin: 0, fontSize: "0.85rem" }}>
                    Try selecting a different category.
                  </p>
                )}
              </div>
            ) : (
              filteredReports.map((report) => (
                <div
                  key={report.id}
                  onClick={() => setSelectedReport(report)}
                  style={{
                    backgroundColor: "#1b0b8c",
                    borderRadius: "20px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "stretch",
                    padding: "8px",
                    cursor: "pointer",
                    boxShadow: "0 8px 15px rgba(27, 11, 140, 0.15)",
                  }}
                >
                  <div
                    style={{
                      padding: "12px 15px 12px 15px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      flex: 1,
                    }}
                  >
                    <h3
                      style={{
                        margin: "0 0 5px 0",
                        color: "#ffffff",
                        fontSize: "1.1rem",
                        fontWeight: "900",
                        letterSpacing: "0.5px",
                      }}
                    >
                      {report.report_types?.name?.toUpperCase() ||
                        "UNKNOWN ISSUE"}
                    </h3>
                    <p
                      style={{
                        margin: 0,
                        color: "#cbd5e1",
                        fontSize: "0.85rem",
                        display: "-webkit-box",
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {report.landmark || "No landmark"}
                    </p>
                  </div>

                  <div
                    style={{
                      backgroundColor: "#ffffff",
                      borderRadius: "15px",
                      padding: "0 20px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: "100px",
                    }}
                  >
                    <span
                      style={{
                        color: getTextColor(report.report_statuses?.name),
                        fontWeight: "900",
                        fontSize: "0.85rem",
                        letterSpacing: "0.5px",
                      }}
                    >
                      {report.report_statuses?.name?.toUpperCase() || "PENDING"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default HomeTab;
