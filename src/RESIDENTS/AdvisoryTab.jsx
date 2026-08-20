import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { translations } from "../components/translations";
import LoadingScreen from "../components/LoadingScreen";
import { Zap, ChevronDown, ChevronUp } from "lucide-react";
import "../Resident.css";

function AdvisoryTab() {
  const [advisories, setAdvisories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Tracks which individual municipalities are expanded
  const [expandedAdvisories, setExpandedAdvisories] = useState({});

  // 🌟 NEW: Tracks which canceled groups (Date/Time blocks) are expanded
  const [expandedGroups, setExpandedGroups] = useState({});

  const currentLang = localStorage.getItem("appLanguage") || "English";
  const t = translations[currentLang];

  useEffect(() => {
    fetchAdvisories();

    const channel = supabase
      .channel("public:power_advisories")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "power_advisories" },
        () => {
          fetchAdvisories();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAdvisories = async () => {
    try {
      setLoading(true);
      const currentDateTime = new Date().toISOString();

      const { data: advisoryData, error: advisoryError } = await supabase
        .from("power_advisories")
        .select(
          "id, affected_areas, schedule_start, schedule_end, status, title, content, municipalities(name)",
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

  const toggleExpand = (id) => {
    setExpandedAdvisories((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // 🌟 NEW: Toggle function for the entire canceled schedule block
  const toggleGroupExpand = (groupKey) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

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
    const titleStr = current.title || "";
    const contentStr = current.content || "";

    const groupKey = `${dateStr}|${timeStr}|${statusStr}|${titleStr}|${contentStr}`;

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
        padding: "0px 16px 120px 16px",
      }}
    >
      <div
        style={{
          position: "sticky",
          top: "-1px",
          margin: "0 -16px 20px -16px",
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
          const [dateKey, timeKey, statusKey, titleKey, contentKey] =
            groupKey.split("|");
          const isCanceled = statusKey.toUpperCase() === "CANCELLED";

          // Check if this specific canceled group is expanded
          const isGroupExpanded = expandedGroups[groupKey];

          return (
            <div
              key={groupKey}
              style={{
                backgroundColor: isCanceled ? "#fef2f2" : "#ffffff",
                border: isCanceled ? "2px dashed #fca5a5" : "1px solid #e2e8f0",
                borderRadius: "20px",
                padding: "20px",
                marginBottom: "25px",
                boxShadow: isCanceled ? "none" : "0 8px 20px rgba(0,0,0,0.04)",
                opacity: isCanceled ? 0.85 : 1,
                position: "relative",
                display: "flex",
                flexDirection: "column",
                transition: "all 0.3s ease",
              }}
            >
              {/* CANCELED BADGE */}
              {isCanceled && (
                <div
                  style={{
                    position: "absolute",
                    top: "-12px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    backgroundColor: "#dc2626",
                    color: "#ffffff",
                    padding: "4px 14px",
                    borderRadius: "20px",
                    fontSize: "0.75rem",
                    fontWeight: "900",
                    letterSpacing: "1px",
                    boxShadow: "0 4px 6px rgba(220, 38, 38, 0.2)",
                    zIndex: 10,
                  }}
                >
                  CANCELLED
                </div>
              )}

              {/* 🌟 NEW: CLICKABLE SCHEDULE HEADER */}
              <div
                onClick={() => isCanceled && toggleGroupExpand(groupKey)}
                style={{
                  textAlign: "center",
                  paddingBottom:
                    !isCanceled || isGroupExpanded ? "16px" : "0px",
                  borderBottom:
                    !isCanceled || isGroupExpanded
                      ? isCanceled
                        ? "2px dashed #fca5a5"
                        : "2px solid #f1f5f9"
                      : "none",
                  marginBottom: !isCanceled || isGroupExpanded ? "16px" : "0px",
                  cursor: isCanceled ? "pointer" : "default",
                  position: "relative",
                  transition: "all 0.3s ease",
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: "1.15rem",
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

                {/* 🌟 NEW: DROPDOWN CHEVRON FOR CANCELED ITEMS */}
                {isCanceled && (
                  <div
                    style={{
                      position: "absolute",
                      right: "5px",
                      top: "50%",
                      transform: "translateY(-50%)",
                    }}
                  >
                    {isGroupExpanded ? (
                      <ChevronUp size={24} color="#fca5a5" />
                    ) : (
                      <ChevronDown size={24} color="#fca5a5" />
                    )}
                  </div>
                )}
              </div>

              {/* 🌟 NEW: EVERYTHING BELOW IS HIDDEN UNLESS ACTIVE OR EXPANDED */}
              {(!isCanceled || isGroupExpanded) && (
                <div style={{ animation: "contentFade 0.3s ease-in-out" }}>
                  {/* ADVISORY TITLE & CONTEXT BOX */}
                  {(titleKey || contentKey) && (
                    <div
                      style={{
                        marginBottom: "16px",
                        backgroundColor: isCanceled
                          ? "rgba(255,255,255,0.5)"
                          : "#f8fafc",
                        borderRadius: "12px",
                        padding: "12px",
                        textAlign: "center",
                        border: isCanceled
                          ? "1px dashed #fca5a5"
                          : "1px solid #e2e8f0",
                      }}
                    >
                      {titleKey && (
                        <h4
                          style={{
                            margin: "0 0 4px 0",
                            fontSize: "0.85rem",
                            fontWeight: "900",
                            color: isCanceled ? "#94a3b8" : "#b45309",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                            textDecoration: isCanceled
                              ? "line-through"
                              : "none",
                          }}
                        >
                          {titleKey}
                        </h4>
                      )}
                      {contentKey && (
                        <p
                          style={{
                            margin: 0,
                            fontSize: "0.85rem",
                            color: isCanceled ? "#94a3b8" : "#475569",
                            lineHeight: "1.4",
                            textDecoration: isCanceled
                              ? "line-through"
                              : "none",
                          }}
                        >
                          {contentKey}
                        </p>
                      )}
                    </div>
                  )}

                  {/* LIST OF AFFECTED MUNICIPALITIES & BARANGAYS */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    {groupedAdvisories[groupKey].map((adv) => {
                      const barangays = adv.affected_areas
                        ? adv.affected_areas.split(",").map((b) => b.trim())
                        : [];
                      const municipalityName =
                        adv.municipalities?.name || "MUNICIPALITY";

                      const isExpanded = expandedAdvisories[adv.id];

                      return (
                        <div
                          key={adv.id}
                          style={{
                            backgroundColor: isCanceled
                              ? "rgba(255,255,255,0.5)"
                              : "#f8fafc",
                            borderRadius: "14px",
                            padding: "16px",
                            border: "1px solid",
                            borderColor: isCanceled ? "transparent" : "#e2e8f0",
                            transition: "all 0.2s ease",
                          }}
                        >
                          {/* MUNICIPALITY TOGGLE HEADER */}
                          <div
                            onClick={() => toggleExpand(adv.id)}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              cursor: "pointer",
                              borderBottom: isExpanded
                                ? isCanceled
                                  ? "1px solid #fca5a5"
                                  : "1px solid #cbd5e1"
                                : "none",
                              paddingBottom: isExpanded ? "12px" : "0",
                              marginBottom: isExpanded ? "12px" : "0",
                            }}
                          >
                            <h4
                              style={{
                                margin: 0,
                                fontSize: "1.05rem",
                                fontWeight: "900",
                                textTransform: "uppercase",
                                letterSpacing: "1px",
                                color: isCanceled ? "#94a3b8" : "#1b0b8c",
                                textDecoration: isCanceled
                                  ? "line-through"
                                  : "none",
                              }}
                            >
                              {municipalityName}
                            </h4>

                            {isExpanded ? (
                              <ChevronUp
                                size={20}
                                color={isCanceled ? "#94a3b8" : "#1b0b8c"}
                              />
                            ) : (
                              <ChevronDown
                                size={20}
                                color={isCanceled ? "#94a3b8" : "#1b0b8c"}
                              />
                            )}
                          </div>

                          {/* DROPDOWN BARANGAYS LIST */}
                          {isExpanded && (
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                rowGap: "10px",
                                columnGap: "15px",
                                animation: "contentFade 0.2s ease-in-out",
                              }}
                            >
                              {barangays.map((brgy, idx) => (
                                <span
                                  key={idx}
                                  style={{
                                    fontSize: "0.9rem",
                                    color: isCanceled ? "#94a3b8" : "#334155",
                                    fontWeight: "600",
                                    display: "flex",
                                    alignItems: "flex-start",
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
                                      marginTop: "6px",
                                      flexShrink: 0,
                                    }}
                                  ></div>
                                  <span style={{ flex: 1, lineHeight: "1.3" }}>
                                    {brgy}
                                  </span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

export default AdvisoryTab;
