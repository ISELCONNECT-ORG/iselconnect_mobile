import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient"; // <-- Changed from "../../" to "../"
import { ShieldAlert, MapPin, Calendar, MessageSquare } from "lucide-react";
import LoadingScreen from "../components/LoadingScreen"; // <-- Fixed this path too just in case!

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

        // Fetch reports with their status (Exactly how HomeTab does it)
        const { data, error } = await supabase
          .from("reports")
          .select("id, landmark, remarks, created_at, report_statuses(name)")
          .eq("residents_id", user.id)
          .order("created_at", { ascending: false });

        if (!error && data) {
          // Filter the rejected reports in JavaScript
          const rejected = data.filter(
            (r) => r.report_statuses?.name?.toUpperCase() === "REJECTED",
          );

          // Trigger the block if they have 1 or more (for testing)
          if (rejected.length >= 5) {
            setIsBlocked(true);
            setRejectedReports(rejected);
          }
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

  if (loading) {
    return <LoadingScreen message="Checking account status..." />;
  }

  // If they hit the threshold, trap them on this screen
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
          // NEW: Fixed position overrides to remove rounded corners completely
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          borderRadius: "0",
          margin: 0,
          zIndex: 999999,
        }}
      >
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "24px",
            padding: "35px 20px",
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
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px auto",
              flexShrink: 0,
            }}
          >
            <ShieldAlert size={48} color="#dc2626" />
          </div>

          <h2
            style={{
              color: "#1e293b",
              fontWeight: "900",
              margin: "0 0 12px 0",
              fontSize: "1.4rem",
              textAlign: "center",
            }}
          >
            Account Blocked
          </h2>

          <p
            style={{
              color: "#475569",
              fontSize: "0.88rem",
              lineHeight: "1.6",
              margin: "0 0 20px 0",
              textAlign: "center",
            }}
          >
            Your account has been temporarily restricted due to submitting{" "}
            <strong>1 or more rejected or false reports</strong>. Please review
            the details of your rejected reports below.
          </p>

          <div
            style={{
              backgroundColor: "#fef2f2",
              border: "1px solid #fca5a5",
              borderRadius: "14px",
              padding: "12px 15px",
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              marginBottom: "25px",
              boxSizing: "border-box",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: "0.85rem",
                color: "#334155",
                fontWeight: "bold",
              }}
            >
              Account Status:{" "}
              <strong style={{ color: "#dc2626" }}>BLOCKED</strong>
            </span>
          </div>

          <div
            style={{
              width: "100%",
              overflowY: "auto",
              paddingRight: "5px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <h3
              style={{
                margin: "0 0 5px 0",
                fontSize: "0.9rem",
                color: "#1e293b",
                fontWeight: "bold",
              }}
            >
              Rejected Report History:
            </h3>

            {rejectedReports.map((report) => (
              <div
                key={report.id}
                style={{
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
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
                    size={14}
                    color="#dc2626"
                    style={{ marginTop: "2px", flexShrink: 0 }}
                  />
                  <span
                    style={{
                      fontSize: "0.85rem",
                      color: "#334155",
                      fontWeight: "700",
                      lineHeight: "1.2",
                    }}
                  >
                    {report.landmark || "Unknown Location"}
                  </span>
                </div>

                <div
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <Calendar
                    size={14}
                    color="#64748b"
                    style={{ flexShrink: 0 }}
                  />
                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                    {formatDateTime(report.created_at)}
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "6px",
                    marginTop: "4px",
                  }}
                >
                  <MessageSquare
                    size={14}
                    color="#b45309"
                    style={{ marginTop: "2px", flexShrink: 0 }}
                  />
                  <span
                    style={{
                      fontSize: "0.8rem",
                      color: "#92400e",
                      fontWeight: "600",
                      fontStyle: "italic",
                      lineHeight: "1.3",
                    }}
                  >
                    "{report.remarks || "No specific reason provided."}"
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return children;
}

export default AccountBlockedGuard;
