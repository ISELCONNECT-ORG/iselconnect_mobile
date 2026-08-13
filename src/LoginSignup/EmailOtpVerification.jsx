import React from "react";
import { Mail } from "lucide-react";

export default function EmailOtpVerification({
  email,
  otp,
  onOtpChange,
  onVerifyOTP,
  loading,
}) {
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

        <div className="auth-input-group" style={{ width: "100%" }}>
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
