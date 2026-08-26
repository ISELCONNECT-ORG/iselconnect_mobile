import React, { useState, useEffect } from "react";
import { Mail, RefreshCw } from "lucide-react";
import { supabase } from "../supabaseClient";

export default function EmailOtpVerification({
  email,
  otp,
  onOtpChange,
  onVerifyOTP,
  loading,
}) {
  // 🌟 NEW: States for the resend timer and status messages
  const [resendTimer, setResendTimer] = useState(60);
  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState("");

  // 🌟 NEW: Countdown timer effect
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [resendTimer]);

  // 🌟 NEW: Handle the resend request to Supabase
  const handleResendCode = async () => {
    if (resendTimer > 0 || isResending) return;

    setIsResending(true);
    setResendStatus("");

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email,
      });

      if (error) throw error;

      setResendStatus("New code sent successfully!");
      setResendTimer(60); // Restart the 60-second cooldown
    } catch (error) {
      setResendStatus(error.message || "Failed to resend code.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        animation: "contentFade 0.3s ease-out",
      }}
    >
      <div
        style={{
          backgroundColor: "#f8fafc",
          padding: "30px 20px",
          borderRadius: "15px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Mail size={50} color="#1b0b8c" style={{ marginBottom: "15px" }} />
        <h3
          style={{
            color: "#1e293b",
            margin: "0 0 10px 0",
            fontWeight: "900",
            textAlign: "center",
          }}
        >
          Verify Your Email
        </h3>
        <p
          style={{
            fontSize: "0.85rem",
            color: "#64748b",
            textAlign: "center",
            marginBottom: "20px",
          }}
        >
          We sent a verification code to <br />
          <strong style={{ color: "#1b0b8c" }}>{email}</strong>
        </p>

        <div
          className="auth-input-group"
          style={{ width: "100%", marginBottom: "15px" }}
        >
          <input
            type="text"
            name="otp"
            value={otp}
            onChange={onOtpChange}
            placeholder="Enter OTP Code"
            maxLength={6}
            className="auth-input"
            style={{
              textAlign: "center",
              fontSize: "1.2rem",
              letterSpacing: "8px",
              fontWeight: "bold",
            }}
          />
        </div>

        {/* 🌟 NEW: Resend Code Section */}
        <div style={{ textAlign: "center", width: "100%" }}>
          {resendStatus && (
            <p
              style={{
                fontSize: "0.8rem",
                fontWeight: "700",
                color: resendStatus.includes("sent") ? "#16a34a" : "#dc2626",
                margin: "0 0 10px 0",
              }}
            >
              {resendStatus}
            </p>
          )}

          <p
            style={{
              fontSize: "0.85rem",
              color: "#64748b",
              margin: 0,
              fontWeight: "600",
            }}
          >
            Didn't receive the code?
          </p>

          <button
            type="button"
            onClick={handleResendCode}
            disabled={resendTimer > 0 || isResending}
            style={{
              background: "none",
              border: "none",
              color: resendTimer > 0 ? "#94a3b8" : "#1b0b8c",
              fontWeight: "900",
              fontSize: "0.85rem",
              marginTop: "5px",
              cursor: resendTimer > 0 ? "not-allowed" : "pointer",
              textDecoration: resendTimer > 0 ? "none" : "underline",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              width: "100%",
            }}
          >
            {isResending ? (
              "Sending..."
            ) : resendTimer > 0 ? (
              `Resend available in ${resendTimer}s`
            ) : (
              <>
                <RefreshCw size={14} /> Resend Code
              </>
            )}
          </button>
        </div>
      </div>

      <div style={{ marginTop: "20px", flexShrink: 0 }}>
        <button
          type="button"
          className="auth-submit-btn"
          onClick={onVerifyOTP}
          disabled={loading || otp.length < 6}
          style={{
            backgroundColor: loading || otp.length < 6 ? "#94a3b8" : "#16a34a",
          }}
        >
          {loading ? "Verifying..." : "Verify & Complete"}
        </button>
      </div>
    </div>
  );
}
