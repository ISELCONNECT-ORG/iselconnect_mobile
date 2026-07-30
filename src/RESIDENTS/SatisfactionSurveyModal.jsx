import React, { useState } from "react";
import { Star, X, CheckCircle, MessageSquare } from "lucide-react";
import { supabase } from "../supabaseClient";
import { logSystemAction } from "../utils/logger";

function SatisfactionSurveyModal({ report, onClose, onSuccess }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

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

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        zIndex: 999999,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        animation: "fadeIn 0.3s",
      }}
    >
      <div
        style={{
          backgroundColor: "#f8fafc",
          width: "90%",
          maxWidth: "400px",
          borderRadius: "25px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow:
            "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        }}
      >
        <div
          style={{
            backgroundColor: "#1b0b8c",
            padding: "20px",
            position: "relative",
            textAlign: "center",
          }}
        >
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: "15px",
              right: "15px",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#fff",
            }}
          >
            <X size={24} />
          </button>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: "10px",
            }}
          >
            <CheckCircle size={40} color="#4ade80" />
          </div>
          <h2
            style={{
              color: "#fff",
              margin: 0,
              fontSize: "1.2rem",
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
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "15px",
            maxHeight: "70vh",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "15px",
              padding: "15px",
              boxShadow: "0 4px 6px rgba(0,0,0,0.02)",
            }}
          >
            <h3
              style={{
                margin: "0 0 10px 0",
                fontSize: "0.9rem",
                color: "#64748b",
                textTransform: "uppercase",
                fontWeight: "900",
              }}
            >
              Lineman's Report:
            </h3>

            {report.resolved_photo_url && (
              <div
                style={{
                  width: "100%",
                  height: "150px",
                  borderRadius: "10px",
                  overflow: "hidden",
                  marginBottom: "10px",
                }}
              >
                <img
                  src={report.resolved_photo_url}
                  alt="Resolution"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            )}

            {report.remarks && (
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  alignItems: "flex-start",
                  backgroundColor: "#f1f5f9",
                  padding: "12px",
                  borderRadius: "10px",
                }}
              >
                <MessageSquare
                  size={18}
                  color="#1b0b8c"
                  style={{ flexShrink: 0, marginTop: "2px" }}
                />
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.85rem",
                    color: "#334155",
                    fontStyle: "italic",
                    lineHeight: "1.5",
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
                color: "#ef4444",
                padding: "10px",
                borderRadius: "10px",
                textAlign: "center",
                fontWeight: "bold",
                fontSize: "0.85rem",
              }}
            >
              {error}
            </div>
          )}

          <div style={{ textAlign: "center", marginTop: "10px" }}>
            <h3
              style={{
                margin: "0 0 10px 0",
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
                marginBottom: "15px",
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
                    transition: "transform 0.1s",
                  }}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                >
                  <Star
                    size={40}
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
              placeholder="Leave a comment or feedback (Optional)"
              style={{
                width: "100%",
                height: "80px",
                padding: "12px",
                borderRadius: "12px",
                border: "1px solid #cbd5e1",
                fontSize: "0.9rem",
                resize: "none",
                boxSizing: "border-box",
                fontFamily: "inherit",
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
              padding: "15px",
              borderRadius: "30px",
              fontWeight: "900",
              fontSize: "1rem",
              border: "none",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              opacity: isSubmitting ? 0.7 : 1,
              textTransform: "uppercase",
              marginTop: "5px",
            }}
          >
            {isSubmitting ? "Submitting..." : "Submit Rating"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

export default SatisfactionSurveyModal;
