import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { translations } from "../components/translations";
import LoadingScreen from "../components/LoadingScreen";
import { Zap } from "lucide-react";
import "../Resident.css";

/**
 * Main component for the Advisory Tab.
 * It displays a list of upcoming power outage schedules grouped by date and time.
 * @returns {JSX.Element} The rendered user interface for the advisory screen.
 */
function AdvisoryTab() {
  const [advisories, setAdvisories] = useState([]);
  const [loading, setLoading] = useState(true);

  const currentLang = localStorage.getItem("appLanguage") || "English";
  const t = translations[currentLang];

  useEffect(() => {
    fetchAdvisories();
  }, []);

  /**
   * Retrieves power advisory records from the database.
   * It filters out old schedules so the app only shows current or future power outages.
   * @async
   * @returns {Promise<void>} Updates the state with the list of advisories.
   */
  const fetchAdvisories = async () => {
    try {
      setLoading(true);
      const currentDateTime = new Date().toISOString();

      const { data: advisoryData, error: advisoryError } = await supabase
        .from("power_advisories")
        .select(
          "id, affected_areas, schedule_start, schedule_end, status, municipalities(name)",
        )
        .gte("schedule_end", currentDateTime)
        .order("schedule_start", { ascending: true });

      if (!advisoryError && advisoryData) setAdvisories(advisoryData);
    } catch (error) {
      console.error("Error fetching advisories:", error.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Changes a full date string into a short, readable time format (example: 1:30pm).
   * @param {string} dateString - The raw date and time string from the database.
   * @returns {string} The formatted time in basic English format.
   */
  const formatTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date
      .toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
      .toLowerCase()
      .replace(" ", "");
  };

  /**
   * Groups the list of advisories by their scheduled date, time, AND status.
   * This ensures canceled schedules are grouped separately from active ones.
   */
  const groupedAdvisories = advisories.reduce((acc, current) => {
    const dateStr = new Date(current.schedule_start)
      .toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
      .toUpperCase();
    const timeStr = `${formatTime(current.schedule_start)} - ${formatTime(current.schedule_end)}`;

    const statusStr = current.status || "Scheduled";
    const groupKey = `${dateStr}|${timeStr}|${statusStr}`;

    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(current);
    return acc;
  }, {});

  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        overscrollBehavior: "none",
        backgroundColor: "#f8fafc",
        padding: "0px 16px 120px 16px", // 🌟 FIXED: Removed top padding so the gap disappears
      }}
    >
      {/* STICKY FROSTED HEADER */}
      <div
        style={{
          position: "sticky",
          top: "-1px", // 🌟 FIXED: Ensures it locks completely to the top on mobile
          margin: "0 -16px 20px -16px", // 🌟 FIXED: Removed negative top margin
          padding: "22px 16px 18px 16px",
          background: "rgba(248, 250, 252, 0.92)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          zIndex: 50,
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <Zap size={26} color="#facc15" fill="#facc15" />
        <h2
          style={{
            margin: 0,
            fontSize: "1.3rem",
            fontWeight: "900",
            letterSpacing: "1px",
            textTransform: "uppercase",
            color: "#1b0b8c",
          }}
        >
          {t.powerYellow} {t.advisoryNavy}
        </h2>
      </div>

      {loading ? (
        <LoadingScreen message={t.loadingAdvisories} />
      ) : Object.keys(groupedAdvisories).length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <p style={{ color: "#64748b", fontSize: "1rem", fontWeight: "600" }}>
            {t.noAdvisories}
          </p>
        </div>
      ) : (
        Object.keys(groupedAdvisories).map((groupKey) => {
          const [dateKey, timeKey, statusKey] = groupKey.split("|");
          const isCanceled = statusKey.toUpperCase() === "CANCELED";

          return (
            <div
              key={groupKey}
              style={{ marginBottom: "30px", opacity: isCanceled ? 0.75 : 1 }}
            >
              <div
                style={{
                  backgroundColor: isCanceled ? "#fef2f2" : "#ffffff",
                  border: isCanceled ? "2px dashed #fca5a5" : "none",
                  borderRadius: "15px",
                  padding: "16px",
                  marginBottom: "15px",
                  boxShadow: isCanceled
                    ? "none"
                    : "0 4px 10px rgba(0,0,0,0.03)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  position: "relative",
                }}
              >
                {isCanceled && (
                  <div
                    style={{
                      position: "absolute",
                      top: "-12px",
                      backgroundColor: "#dc2626",
                      color: "#ffffff",
                      padding: "4px 14px",
                      borderRadius: "20px",
                      fontSize: "0.75rem",
                      fontWeight: "900",
                      letterSpacing: "1px",
                      boxShadow: "0 4px 6px rgba(220, 38, 38, 0.2)",
                    }}
                  >
                    CANCELED
                  </div>
                )}
                <h3
                  style={{
                    margin: 0,
                    fontSize: "1.1rem",
                    fontWeight: "900",
                    color: isCanceled ? "#94a3b8" : "#1b0b8c",
                    letterSpacing: "0.5px",
                    textDecoration: isCanceled ? "line-through" : "none",
                  }}
                >
                  {dateKey}
                </h3>
                <p
                  style={{
                    margin: "4px 0 0 0",
                    fontSize: "0.95rem",
                    fontWeight: "700",
                    color: isCanceled ? "#94a3b8" : "#64748b",
                    textDecoration: isCanceled ? "line-through" : "none",
                  }}
                >
                  {timeKey}
                </p>
              </div>

              {groupedAdvisories[groupKey].map((adv) => {
                const barangays = adv.affected_areas
                  ? adv.affected_areas.split(",").map((b) => b.trim())
                  : [];
                const municipalityName =
                  adv.municipalities?.name || "MUNICIPALITY";

                return (
                  <div
                    key={adv.id}
                    style={{
                      backgroundColor: isCanceled ? "#f8fafc" : "#ffffff",
                      borderRadius: "20px",
                      padding: "20px",
                      marginBottom: "12px",
                      boxShadow: isCanceled
                        ? "none"
                        : "0 6px 15px rgba(0,0,0,0.05)",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <h4
                      style={{
                        margin: "0 0 15px 0",
                        fontSize: "1.1rem",
                        fontWeight: "900",
                        textTransform: "uppercase",
                        letterSpacing: "1px",
                        color: isCanceled ? "#94a3b8" : "#1b0b8c",
                        borderBottom: "2px solid #f1f5f9",
                        paddingBottom: "10px",
                        textDecoration: isCanceled ? "line-through" : "none",
                      }}
                    >
                      {municipalityName}
                    </h4>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        rowGap: "10px",
                        columnGap: "15px",
                      }}
                    >
                      {barangays.map((brgy, idx) => (
                        <span
                          key={idx}
                          style={{
                            fontSize: "0.95rem",
                            color: isCanceled ? "#94a3b8" : "#334155",
                            fontWeight: "600",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            textDecoration: isCanceled
                              ? "line-through"
                              : "none",
                          }}
                        >
                          <div
                            style={{
                              width: "6px",
                              height: "6px",
                              backgroundColor: isCanceled
                                ? "#cbd5e1"
                                : "#facc15",
                              borderRadius: "50%",
                            }}
                          ></div>
                          {brgy}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })
      )}
    </div>
  );
}

export default AdvisoryTab;
