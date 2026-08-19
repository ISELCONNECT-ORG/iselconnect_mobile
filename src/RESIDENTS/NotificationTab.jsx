import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { Bell, AlertTriangle, XCircle } from "lucide-react";
import { translations } from "../components/translations";
import LoadingScreen from "../components/LoadingScreen";

function NotificationTab() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const currentLang = localStorage.getItem("appLanguage") || "English";
  const t = translations[currentLang];

  useEffect(() => {
    fetchNotifications();

    // 🌟 NEW: Listen to 3 different tables at once for total live sync
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
          upcomingAdvisories = advisoriesData.map((adv) => ({
            id: `adv-${adv.id}`,
            title: adv.title || "UPCOMING POWER OUTAGE",
            message: `Scheduled from ${formatDateTime(adv.schedule_start)} to ${formatDateTime(adv.schedule_end)}. Affected areas: ${adv.affected_areas}`,
            created_at: adv.created_at || new Date().toISOString(),
            is_read: false,
            is_advisory: true,
          }));
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

        rejectedNotifs = rejected.map((rep) => ({
          id: `rej-${rep.id}`,
          title: "REPORT REJECTED",
          message: `Your report at ${rep.landmark || "your location"} was rejected by the admin. ${rep.remarks ? `Reason: ${rep.remarks}` : "Please ensure reports follow guidelines."}`,
          created_at: rep.created_at,
          is_read: false,
          is_rejected: true,
        }));
      }

      const combinedNotifs = [
        ...(standardNotifs || []),
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
    return `${formattedDate}  ${formattedTime}`;
  };

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
          notifications.map((notif) => (
            <div
              key={notif.id}
              style={{
                backgroundColor: notif.is_rejected
                  ? "#fef2f2"
                  : notif.is_read
                    ? "#ffffff"
                    : "#f1f5f9",
                borderRadius: "16px",
                padding: "20px",
                marginBottom: "12px",
                boxShadow: "0 4px 10px rgba(0,0,0,0.04)",
                border: notif.is_rejected
                  ? "2px solid #fca5a5"
                  : notif.is_advisory
                    ? "2px solid #fde047"
                    : notif.is_read
                      ? "1px solid #e2e8f0"
                      : "2px solid #cbd5e1",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "8px",
                }}
              >
                {notif.is_rejected && <XCircle size={18} color="#dc2626" />}
                {notif.is_advisory && (
                  <AlertTriangle size={18} color="#b45309" />
                )}
                {!notif.is_rejected && !notif.is_advisory && (
                  <Bell
                    size={18}
                    color={notif.is_read ? "#94a3b8" : "#1b0b8c"}
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
                  }}
                >
                  {notif.title}
                </h3>
              </div>
              <p
                style={{
                  color: notif.is_rejected ? "#991b1b" : "#475569",
                  fontSize: "0.95rem",
                  margin: "0 0 12px 0",
                  lineHeight: "1.5",
                  fontWeight: "500",
                }}
              >
                {notif.message}
              </p>
              <div style={{ textAlign: "right" }}>
                <span
                  style={{
                    fontSize: "0.8rem",
                    color: notif.is_rejected ? "#f87171" : "#94a3b8",
                    fontWeight: "600",
                  }}
                >
                  {formatDateTime(notif.created_at)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default NotificationTab;
