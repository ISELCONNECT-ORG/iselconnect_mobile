import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../supabaseClient";
import { Bell, AlertTriangle, XCircle, X, Truck } from "lucide-react";
import { translations } from "../components/translations";
import LoadingScreen from "../components/LoadingScreen";

// 🌟 STRONGER LOCAL MEMORY (Converts all IDs to strings to prevent mismatch bugs)
const getLocalReadStatus = (id) => {
  const readIds = JSON.parse(
    localStorage.getItem("iselconnect_read_notifs") || "[]",
  );
  return readIds.includes(String(id));
};

const saveLocalReadStatus = (id) => {
  const strId = String(id);
  const readIds = JSON.parse(
    localStorage.getItem("iselconnect_read_notifs") || "[]",
  );
  if (!readIds.includes(strId)) {
    readIds.push(strId);
    localStorage.setItem("iselconnect_read_notifs", JSON.stringify(readIds));
  }
};

function NotificationTab() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotif, setSelectedNotif] = useState(null);

  const currentLang = localStorage.getItem("appLanguage") || "English";
  const t = translations[currentLang];

  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel("public:notifications_all")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => fetchNotifications(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "reports" },
        () => fetchNotifications(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "power_advisories" },
        () => fetchNotifications(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw userError;

      const { data: standardNotifs, error: notifError } = await supabase
        .from("notifications")
        .select("*")
        .eq("residents_id", user.id)
        .order("created_at", { ascending: false });
      if (notifError) throw notifError;

      const { data: userData, error: profileError } = await supabase
        .from("users")
        .select("barangay_id")
        .eq("id", user.id)
        .single();

      let upcomingAdvisories = [];
      if (userData && userData.barangay_id) {
        const today = new Date();
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(today.getDate() + 3);

        const { data: advisoriesData, error: advError } = await supabase
          .from("power_advisories")
          .select(
            "id, title, schedule_start, schedule_end, affected_areas, created_at",
          )
          .contains("affected_barangay_ids", [userData.barangay_id])
          .gte("schedule_start", today.toISOString())
          .lte("schedule_start", threeDaysFromNow.toISOString());

        if (!advError && advisoriesData) {
          upcomingAdvisories = advisoriesData.map((adv) => {
            const notifId = `adv-${adv.id}`;
            return {
              id: notifId,
              title: adv.title || "UPCOMING POWER OUTAGE",
              message: `Scheduled from ${formatDateTime(adv.schedule_start)} to ${formatDateTime(adv.schedule_end)}. Affected areas: ${adv.affected_areas}`,
              created_at: adv.created_at || new Date().toISOString(),
              is_read: getLocalReadStatus(notifId),
              is_advisory: true,
            };
          });
        }
      }

      const { data: reportsData, error: reportsError } = await supabase
        .from("reports")
        .select("id, landmark, remarks, created_at, report_statuses(name)")
        .eq("residents_id", user.id);

      let rejectedNotifs = [];
      if (!reportsError && reportsData) {
        const rejected = reportsData.filter(
          (r) => r.report_statuses?.name?.toUpperCase() === "REJECTED",
        );

        rejectedNotifs = rejected.map((rep) => {
          const notifId = `rej-${rep.id}`;
          return {
            id: notifId,
            title: "REPORT REJECTED",
            message: `Your report at ${rep.landmark || "your location"} was rejected by the admin. ${rep.remarks ? `Reason: ${rep.remarks}` : "Please ensure reports follow guidelines."}`,
            created_at: rep.created_at,
            is_read: getLocalReadStatus(notifId),
            is_rejected: true,
          };
        });
      }

      const processedStandardNotifs = (standardNotifs || [])
        .filter((n) => !n.title.toLowerCase().includes("power advisory"))
        .map((n) => ({
          ...n,
          is_read: n.is_read || getLocalReadStatus(n.id),
        }));

      const combinedNotifs = [
        ...processedStandardNotifs,
        ...upcomingAdvisories,
        ...rejectedNotifs,
      ];
      combinedNotifs.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at),
      );
      setNotifications(combinedNotifs);
    } catch (error) {
      console.error("Error fetching notifications:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notif) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n)),
    );

    saveLocalReadStatus(notif.id);

    if (
      !String(notif.id).startsWith("adv-") &&
      !String(notif.id).startsWith("rej-")
    ) {
      try {
        await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("id", notif.id);
      } catch (error) {
        console.error("Error updating DB:", error.message);
      }
    }
  };

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));

    notifications.forEach((n) => saveLocalReadStatus(n.id));

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("residents_id", user.id)
        .eq("is_read", false);
    } catch (error) {
      console.error("Error updating DB:", error.message);
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const formattedDate = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const formattedTime = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `${formattedDate} ${formattedTime}`;
  };

  const formatRelativeTime = (dateString) => {
    if (!dateString) return "";
    const now = new Date();
    const date = new Date(dateString);

    const diffMs = Math.max(0, now - date);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const notifDate = new Date(date);
    notifDate.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today - notifDate) / 86400000);

    if (diffDays <= 1) {
      if (diffMins < 1) return "now";
      if (diffMins < 60) return `${diffMins}m`;
      return `${diffHrs}h`;
    } else if (diffDays <= 7) {
      return `${diffDays}d`;
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  };

  const groupedNotifications = {
    Today: [],
    Yesterday: [],
    "Last 7 Days": [],
    Older: [],
  };

  notifications.forEach((notif) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const notifDate = new Date(notif.created_at);
    notifDate.setHours(0, 0, 0, 0);

    const diffTime = today - notifDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      groupedNotifications["Today"].push(notif);
    } else if (diffDays === 1) {
      groupedNotifications["Yesterday"].push(notif);
    } else if (diffDays <= 7) {
      groupedNotifications["Last 7 Days"].push(notif);
    } else {
      groupedNotifications["Older"].push(notif);
    }
  });

  const hasUnread = notifications.some((n) => !n.is_read);

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
      {selectedNotif &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              backgroundColor: "rgba(0, 0, 0, 0.65)",
              zIndex: 999999,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "20px",
            }}
            onClick={() => setSelectedNotif(null)}
          >
            <div
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "20px",
                width: "100%",
                maxWidth: "420px",
                maxHeight: "85vh",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
                animation: "slideUpFade 0.3s ease-out",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  padding: "20px",
                  borderBottom: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: selectedNotif.is_rejected
                    ? "#fef2f2"
                    : selectedNotif.is_advisory
                      ? "#fefce8"
                      : "#f8fafc",
                  borderRadius: "20px 20px 0 0",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  {/* 🌟 MODAL ICONS */}
                  {selectedNotif.is_rejected && (
                    <XCircle size={24} color="#dc2626" />
                  )}
                  {selectedNotif.is_advisory && (
                    <AlertTriangle size={24} color="#b45309" />
                  )}
                  {selectedNotif.title === "Report Delay Notice" && (
                    <Truck size={24} color="#1b0b8c" />
                  )}
                  {!selectedNotif.is_rejected &&
                    !selectedNotif.is_advisory &&
                    selectedNotif.title !== "Report Delay Notice" && (
                      <Bell size={24} color="#1b0b8c" />
                    )}

                  <h3
                    style={{
                      margin: 0,
                      fontSize: "1.1rem",
                      fontWeight: "900",
                      color: selectedNotif.is_rejected
                        ? "#dc2626"
                        : selectedNotif.is_advisory
                          ? "#b45309"
                          : "#1e293b",
                    }}
                  >
                    {selectedNotif.title}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedNotif(null)}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "4px",
                  }}
                >
                  <X size={24} color="#64748b" />
                </button>
              </div>

              <div style={{ padding: "20px", overflowY: "auto", flex: 1 }}>
                <p
                  style={{
                    margin: "0 0 15px 0",
                    fontSize: "0.85rem",
                    color: "#64748b",
                    fontWeight: "600",
                  }}
                >
                  {formatDateTime(selectedNotif.created_at)}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: "1rem",
                    color: "#334155",
                    lineHeight: "1.7",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {selectedNotif.message}
                </p>
              </div>

              <div
                style={{ padding: "15px 20px", borderTop: "1px solid #e2e8f0" }}
              >
                <button
                  onClick={() => setSelectedNotif(null)}
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: "50px",
                    backgroundColor: "#1b0b8c",
                    color: "#ffffff",
                    fontWeight: "900",
                    fontSize: "1rem",
                    border: "none",
                    cursor: "pointer",
                    textTransform: "uppercase",
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

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
        <Bell size={26} color="#1b0b8c" />
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
          {t.notificationTitle || "Notifications"}
        </h2>

        {hasUnread && (
          <button
            onClick={markAllAsRead}
            style={{
              marginLeft: "auto",
              background: "transparent",
              border: "none",
              color: "#1b0b8c",
              fontWeight: "800",
              fontSize: "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              cursor: "pointer",
              padding: "4px 8px",
            }}
          >
            Mark all read
          </button>
        )}
      </div>

      <div>
        {loading ? (
          <LoadingScreen message={t.loadingNotifs} />
        ) : notifications.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              color: "#94a3b8",
            }}
          >
            <Bell
              size={48}
              strokeWidth={1.5}
              style={{ margin: "0 auto 15px auto" }}
            />
            <p style={{ fontSize: "1.1rem", fontWeight: "600" }}>
              {t.noNotifs}
            </p>
          </div>
        ) : (
          Object.entries(groupedNotifications).map(([category, notifs]) => {
            if (notifs.length === 0) return null;

            return (
              <div key={category} style={{ marginBottom: "20px" }}>
                <h3
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: "800",
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    margin: "0 0 10px 10px",
                  }}
                >
                  {category}
                </h3>

                {notifs.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => {
                      setSelectedNotif(notif);
                      if (!notif.is_read) markAsRead(notif);
                    }}
                    style={{
                      position: "relative",
                      cursor: "pointer",
                      backgroundColor: notif.is_rejected
                        ? "#fef2f2"
                        : notif.is_read
                          ? "#ffffff"
                          : "#f1f5f9",
                      borderRadius: "16px",
                      padding: "16px 20px 16px 24px",
                      marginBottom: "12px",
                      boxShadow: "0 4px 10px rgba(0,0,0,0.04)",
                      border: notif.is_rejected
                        ? "2px solid #fca5a5"
                        : notif.is_advisory
                          ? "2px solid #fde047"
                          : notif.is_read
                            ? "1px solid #e2e8f0"
                            : "2px solid #cbd5e1",
                      transition: "transform 0.1s ease",
                    }}
                    onMouseDown={(e) =>
                      (e.currentTarget.style.transform = "scale(0.98)")
                    }
                    onMouseUp={(e) =>
                      (e.currentTarget.style.transform = "scale(1)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.transform = "scale(1)")
                    }
                  >
                    {!notif.is_read && (
                      <div
                        style={{
                          position: "absolute",
                          top: "21px",
                          left: "8px",
                          width: "8px",
                          height: "8px",
                          backgroundColor: "#1b0b8c",
                          borderRadius: "50%",
                        }}
                      />
                    )}

                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: "12px",
                        marginBottom: "6px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        {/* 🌟 FEED ICONS */}
                        {notif.is_rejected && (
                          <XCircle
                            size={18}
                            color="#dc2626"
                            style={{ flexShrink: 0 }}
                          />
                        )}
                        {notif.is_advisory && (
                          <AlertTriangle
                            size={18}
                            color="#b45309"
                            style={{ flexShrink: 0 }}
                          />
                        )}
                        {notif.title === "Report Delay Notice" && (
                          <Truck
                            size={18}
                            color={notif.is_read ? "#94a3b8" : "#1b0b8c"}
                            style={{ flexShrink: 0 }}
                          />
                        )}
                        {!notif.is_rejected &&
                          !notif.is_advisory &&
                          notif.title !== "Report Delay Notice" && (
                            <Bell
                              size={18}
                              color={notif.is_read ? "#94a3b8" : "#1b0b8c"}
                              style={{ flexShrink: 0 }}
                            />
                          )}

                        <h3
                          style={{
                            margin: 0,
                            fontSize: "1rem",
                            fontWeight: "900",
                            color: notif.is_rejected
                              ? "#dc2626"
                              : notif.is_advisory
                                ? "#b45309"
                                : "#1e293b",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {notif.title}
                        </h3>
                      </div>
                      <span
                        style={{
                          fontSize: "0.8rem",
                          color: notif.is_rejected ? "#f87171" : "#94a3b8",
                          fontWeight: "700",
                          whiteSpace: "nowrap",
                          marginTop: "2px",
                        }}
                      >
                        {formatRelativeTime(notif.created_at)}
                      </span>
                    </div>

                    <p
                      style={{
                        color: notif.is_rejected ? "#991b1b" : "#475569",
                        fontSize: "0.9rem",
                        margin: 0,
                        lineHeight: "1.4",
                        fontWeight: "500",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {notif.message}
                    </p>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default NotificationTab;
