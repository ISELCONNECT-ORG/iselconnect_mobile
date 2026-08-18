import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import {
  ShieldAlert,
  MapPin,
  Calendar,
  MessageSquare,
  LogOut,
} from "lucide-react";
import LoadingScreen from "../components/LoadingScreen";

function AccountBlockedGuard({ children }) {
  const [loading, setLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [rejectedReports, setRejectedReports] = useState([]);

  useEffect(() => {
    const checkBlockedStatus = async () => {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError || !user) return;

        // 1. Fetch user's ban_status
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("ban_status, rejected_reports_count")
          .eq("id", user.id)
          .single();

        if (userError) throw userError;

        // 2. Fetch rejected reports to display reasons on screen
        const { data: reportsData } = await supabase
          .from("reports")
          .select("id, landmark, remarks, created_at, report_statuses(name)")
          .eq("residents_id", user.id)
          .order("created_at", { ascending: false });

        const rejected = (reportsData || []).filter(
          (r) => r.report_statuses?.name?.toUpperCase() === "REJECTED",
        );
        setRejectedReports(rejected);

        // 3. Block if ban_status is true
        if (userData?.ban_status === true) {
          setIsBlocked(true);
        } else {
          setIsBlocked(false);
        }
      } catch (err) {
        console.error("Error checking blocked status:", err);
      } finally {
        setLoading(false);
      }
    };

    checkBlockedStatus();
  }, []);

  const formatDateTime = (dateString) => {
    if (!dateString) return "Unknown Date";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  if (loading) {
    return <LoadingScreen message="Checking account status..." />;
  }

  // If blocked, show this screen
  if (isBlocked) {
    return (
      <div
        className="bg-navy-tab"
        style={{
          backgroundColor: "#1b0b8c",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          boxSizing: "border-box",
          overscrollBehavior: "none",
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          margin: 0,
          zIndex: 999999,
        }}
      >
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "24px",
            padding: "30px 20px",
            width: "100%",
            maxWidth: "400px",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            boxShadow: "0 15px 30px rgba(0,0,0,0.3)",
            maxHeight: "90vh",
          }}
        >
          <div
            style={{
              backgroundColor: "#fee2e2",
              width: "70px",
              height: "70px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 15px auto",
              flexShrink: 0,
            }}
          >
            <ShieldAlert size={42} color="#dc2626" />
          </div>

          <h2
            style={{
              color: "#1e293b",
              fontWeight: "900",
              margin: "0 0 10px 0",
              fontSize: "1.35rem",
              textAlign: "center",
            }}
          >
            Account Restricted
          </h2>

          <p
            style={{
              color: "#475569",
              fontSize: "0.85rem",
              lineHeight: "1.5",
              margin: "0 0 16px 0",
              textAlign: "center",
            }}
          >
            Your account has been restricted from submitting reports due to
            multiple invalid submissions or administrative action.
          </p>

          <div
            style={{
              backgroundColor: "#fef2f2",
              border: "1px solid #fca5a5",
              borderRadius: "12px",
              padding: "10px 14px",
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              marginBottom: "16px",
              boxSizing: "border-box",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: "0.82rem",
                color: "#334155",
                fontWeight: "bold",
              }}
            >
              Account Status:{" "}
              <strong style={{ color: "#dc2626" }}>BANNED / RESTRICTED</strong>
            </span>
          </div>

          {rejectedReports.length > 0 && (
            <div
              style={{
                width: "100%",
                overflowY: "auto",
                paddingRight: "5px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                marginBottom: "16px",
                maxHeight: "180px",
              }}
            >
              <h3
                style={{
                  margin: "0 0 4px 0",
                  fontSize: "0.85rem",
                  color: "#1e293b",
                  fontWeight: "bold",
                }}
              >
                Rejected Report History ({rejectedReports.length}):
              </h3>

              {rejectedReports.map((report) => (
                <div
                  key={report.id}
                  style={{
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding: "10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "6px",
                    }}
                  >
                    <MapPin
                      size={13}
                      color="#dc2626"
                      style={{ marginTop: "2px", flexShrink: 0 }}
                    />
                    <span
                      style={{
                        fontSize: "0.8rem",
                        color: "#334155",
                        fontWeight: "700",
                      }}
                    >
                      {report.landmark || "Unknown Location"}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <Calendar
                      size={13}
                      color="#64748b"
                      style={{ flexShrink: 0 }}
                    />
                    <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
                      {formatDateTime(report.created_at)}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "6px",
                    }}
                  >
                    <MessageSquare
                      size={13}
                      color="#b45309"
                      style={{ marginTop: "2px", flexShrink: 0 }}
                    />
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "#92400e",
                        fontStyle: "italic",
                      }}
                    >
                      "{report.remarks || "No reason provided."}"
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleSignOut}
            style={{
              width: "100%",
              padding: "12px",
              backgroundColor: "#1b0b8c",
              color: "#ffffff",
              border: "none",
              borderRadius: "50px",
              fontWeight: "bold",
              fontSize: "0.9rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </div>
    );
  }

  return children;
}

export default AccountBlockedGuard;
