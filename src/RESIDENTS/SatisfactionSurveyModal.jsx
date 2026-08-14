import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Star, X, CheckCircle, MessageSquare } from "lucide-react";
import { supabase } from "../supabaseClient";
import { logSystemAction } from "../utils/logger";

function SatisfactionSurveyModal({ report, onClose, onSuccess }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Lock both the body and HTML to prevent native scrolling
  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, []);

  const handleSubmit = async () => {
    if (rating === 0) return setError("Please select a star rating.");

    setIsSubmitting(true);
    setError("");

    try {
      const { error: dbError } = await supabase.from("report_ratings").insert([
        {
          report_id: report.id,
          rating: rating,
          feedback: feedback.trim() || null,
        },
      ]);

      if (dbError)
        throw new Error("Failed to submit survey. Please try again.");

      await logSystemAction(
        "SURVEY_SUBMITTED",
        `Resident submitted a ${rating}-star rating for report #${report.id}.`,
      );
      onSuccess();
    } catch (err) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  // NEW: Saves the dismissal to sessionStorage so it doesn't reappear this session
  const handleDismiss = () => {
    sessionStorage.setItem(`skip_rating_${report.id}`, "true");
    onClose();
  };

  return createPortal(
    <div
      onTouchMove={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        zIndex: 9999999,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        animation: "fadeIn 0.3s",
        touchAction: "none",
      }}
    >
      <style>{`
        body * {
          overscroll-behavior: none !important;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div
        onTouchMove={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "#f8fafc",
          width: "90%",
          maxWidth: "380px",
          borderRadius: "20px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.3)",
          touchAction: "auto",
        }}
      >
        <div
          style={{
            backgroundColor: "#1b0b8c",
            padding: "16px 20px",
            position: "relative",
            textAlign: "center",
          }}
        >
          <button
            onClick={handleDismiss} // Updated to use handleDismiss
            style={{
              position: "absolute",
              top: "12px",
              right: "12px",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#fff",
              opacity: 0.8,
              transition: "opacity 0.2s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.opacity = 1)}
            onMouseOut={(e) => (e.currentTarget.style.opacity = 0.8)}
          >
            <X size={22} strokeWidth={2.5} />
          </button>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: "8px",
            }}
          >
            <CheckCircle size={36} color="#4ade80" strokeWidth={2.5} />
          </div>
          <h2
            style={{
              color: "#fff",
              margin: 0,
              fontSize: "1.15rem",
              fontWeight: "900",
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            Report Resolved!
          </h2>
        </div>

        <div
          style={{
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            maxHeight: "70vh",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "14px",
              padding: "12px",
              boxShadow: "0 4px 10px rgba(0,0,0,0.03)",
            }}
          >
            <h3
              style={{
                margin: "0 0 8px 0",
                fontSize: "0.85rem",
                color: "#64748b",
                textTransform: "uppercase",
                fontWeight: "900",
                letterSpacing: "0.5px",
              }}
            >
              Lineman's Report:
            </h3>

            {report.resolved_photo_url && (
              <div
                style={{
                  width: "100%",
                  height: "130px",
                  borderRadius: "10px",
                  overflow: "hidden",
                  marginBottom: "8px",
                  backgroundColor: "#f1f5f9",
                }}
              >
                <img
                  src={report.resolved_photo_url}
                  alt="Resolution"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              </div>
            )}

            {report.remarks && (
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  alignItems: "flex-start",
                  backgroundColor: "#f8fafc",
                  border: "1px solid #f1f5f9",
                  padding: "10px",
                  borderRadius: "10px",
                }}
              >
                <MessageSquare
                  size={16}
                  color="#1b0b8c"
                  style={{ flexShrink: 0, marginTop: "2px" }}
                />
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.85rem",
                    color: "#334155",
                    fontStyle: "italic",
                    lineHeight: "1.4",
                    fontWeight: "500",
                  }}
                >
                  "{report.remarks}"
                </p>
              </div>
            )}
          </div>

          {error && (
            <div
              style={{
                backgroundColor: "#fee2e2",
                color: "#dc2626",
                border: "1px solid #fecaca",
                padding: "10px",
                borderRadius: "10px",
                textAlign: "center",
                fontWeight: "700",
                fontSize: "0.8rem",
              }}
            >
              {error}
            </div>
          )}

          <div style={{ textAlign: "center", marginTop: "0px" }}>
            <h3
              style={{
                margin: "0 0 8px 0",
                fontSize: "1rem",
                color: "#1e293b",
                fontWeight: "900",
              }}
            >
              How did we do?
            </h3>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "8px",
                marginBottom: "12px",
              }}
            >
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    transition: "transform 0.1s ease",
                  }}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  onMouseDown={(e) =>
                    (e.currentTarget.style.transform = "scale(0.85)")
                  }
                  onMouseUp={(e) =>
                    (e.currentTarget.style.transform = "scale(1)")
                  }
                >
                  <Star
                    size={36}
                    fill={
                      (hoverRating || rating) >= star
                        ? "#facc15"
                        : "transparent"
                    }
                    color={
                      (hoverRating || rating) >= star ? "#facc15" : "#cbd5e1"
                    }
                    strokeWidth={1.5}
                  />
                </button>
              ))}
            </div>

            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Leave a comment (Optional)"
              style={{
                width: "100%",
                height: "75px",
                padding: "12px",
                borderRadius: "12px",
                border: "2px solid #e2e8f0",
                backgroundColor: "#ffffff",
                color: "#1e293b",
                fontSize: "0.85rem",
                resize: "none",
                boxSizing: "border-box",
                fontFamily: "inherit",
                outline: "none",
                transition: "border-color 0.2s ease, box-shadow 0.2s ease",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#1b0b8c";
                e.target.style.boxShadow = "0 0 0 3px rgba(27, 11, 140, 0.1)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#e2e8f0";
                e.target.style.boxShadow = "none";
              }}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{
              width: "100%",
              backgroundColor: "#1b0b8c",
              color: "#fff",
              padding: "12px",
              borderRadius: "50px",
              fontWeight: "900",
              fontSize: "0.95rem",
              border: "none",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              opacity: isSubmitting ? 0.7 : 1,
              textTransform: "uppercase",
              marginTop: "0px",
              boxShadow: "0 6px 15px rgba(27, 11, 140, 0.2)",
              transition: "transform 0.1s ease",
            }}
            onMouseDown={(e) =>
              !isSubmitting && (e.currentTarget.style.transform = "scale(0.97)")
            }
            onMouseUp={(e) =>
              !isSubmitting && (e.currentTarget.style.transform = "scale(1)")
            }
          >
            {isSubmitting ? "Submitting..." : "Submit Rating"}
          </button>

          {/* NEW: Explicit Skip Button */}
          <button
            onClick={handleDismiss}
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              fontSize: "0.85rem",
              fontWeight: "700",
              marginTop: "4px",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default SatisfactionSurveyModal;
