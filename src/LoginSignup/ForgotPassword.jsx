import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import { ChevronLeft, Eye, EyeOff, CheckCircle } from "lucide-react";
import { translations } from "../components/translations";
import "../Resident.css";

function ForgotPassword({ onBack, onPasswordUpdated }) {
  // Initialize state from local storage to survive React refreshes!
  const [stage, setStage] = useState(
    localStorage.getItem("recovery_stage") || "email",
  );
  const [email, setEmail] = useState(
    localStorage.getItem("recovery_email") || "",
  );

  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const currentLang = localStorage.getItem("appLanguage") || "English";
  const t = translations[currentLang];

  // --- PASSWORD VALIDATION RULES ---
  const reqLength = newPassword.length >= 8;
  const reqLetter = /[a-zA-Z]/.test(newPassword);
  const reqNumber = /\d/.test(newPassword);
  const reqSpecial = /[!@#$%^&*(),.?":{}|<>\-_]/.test(newPassword);

  const isPasswordValid = reqLength && reqLetter && reqNumber && reqSpecial;

  // Helper to completely clear the recovery memory
  const clearRecoveryData = () => {
    localStorage.removeItem("recovery_in_progress");
    localStorage.removeItem("recovery_stage");
    localStorage.removeItem("recovery_email");
  };

  // --- STAGE 1: Request OTP ---
  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;

      // Save our spot!
      localStorage.setItem("recovery_stage", "otp");
      localStorage.setItem("recovery_email", email);

      setStage("otp");
      setMessage("A 6-digit OTP has been sent to your email.");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // --- STAGE 2: Verify OTP ---
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "recovery",
      });

      if (error) throw error;

      // Save our spot so the refresh doesn't kick us out!
      localStorage.setItem("recovery_stage", "newPassword");

      setStage("newPassword");
      setMessage("OTP Verified. You may now create a new password.");
    } catch (err) {
      setError("Invalid or expired OTP. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- STAGE 3: Update Password ---
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    // Double-check validation before submitting
    if (!isPasswordValid) {
      return setError("Please ensure all password requirements are met.");
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setMessage("Success! Your password has been updated.");

      // Cleanup the memory now that we are done
      clearRecoveryData();

      // Destroy the temporary recovery session so they can log in normally!
      await supabase.auth.signOut();

      setTimeout(() => {
        if (onPasswordUpdated) onPasswordUpdated();
        else onBack();
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    if (stage === "newPassword") {
      await supabase.auth.signOut();
    }
    clearRecoveryData();
    onBack();
  };

  return (
    <div className="auth-layout">
      <div className="auth-top-section auth-bg-photo">
        <button
          className="auth-back-btn"
          onClick={async () => {
            if (stage === "otp") {
              setStage("email");
              localStorage.setItem("recovery_stage", "email");
            } else {
              await handleCancel();
            }
          }}
        >
          <ChevronLeft size={24} color="#1b0b8c" strokeWidth={3} />
        </button>
      </div>

      <div className="auth-bottom-section">
        <h1 className="auth-form-title">
          {stage === "email" && "Forgot Password"}
          {stage === "otp" && "Verify Email"}
          {stage === "newPassword" && "New Password"}
        </h1>
        <div className="auth-title-underline"></div>

        {error && <div className="error-alert">{error}</div>}
        {message && <div className="success-alert">{message}</div>}

        {/* STAGE 1 FORM: Email */}
        {stage === "email" && (
          <form onSubmit={handleRequestOTP} className="auth-form-container">
            <p
              style={{
                color: "#cbd5e1",
                fontSize: "0.9rem",
                textAlign: "center",
                marginBottom: "15px",
              }}
            >
              Enter your registered email address to receive a 6-digit recovery
              code.
            </p>
            <div className="auth-input-group">
              <label>Email Address</label>
              <input
                type="email"
                className="auth-input"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="auth-submit-btn"
              disabled={isLoading}
              style={{ opacity: isLoading ? 0.7 : 1 }}
            >
              {isLoading ? "Sending..." : "Send OTP"}
            </button>
          </form>
        )}

        {/* STAGE 2 FORM: Verify OTP */}
        {stage === "otp" && (
          <form onSubmit={handleVerifyOTP} className="auth-form-container">
            <p
              style={{
                color: "#cbd5e1",
                fontSize: "0.9rem",
                textAlign: "center",
                marginBottom: "15px",
              }}
            >
              Please check your email <strong>{email}</strong> for the 6-digit
              code.
            </p>
            <div className="auth-input-group">
              <label>6-Digit Code</label>
              <input
                type="text"
                className="auth-input"
                placeholder="Enter 6-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.trim())}
                maxLength={6}
                required
                style={{
                  textAlign: "center",
                  letterSpacing: "5px",
                  fontSize: "1.2rem",
                }}
              />
            </div>
            <button
              type="submit"
              className="auth-submit-btn"
              disabled={isLoading || otp.length < 6}
              style={{ opacity: isLoading || otp.length < 6 ? 0.7 : 1 }}
            >
              {isLoading ? "Verifying..." : "Verify Code"}
            </button>
          </form>
        )}

        {/* STAGE 3 FORM: Create New Password */}
        {stage === "newPassword" && (
          <form onSubmit={handleUpdatePassword} className="auth-form-container">
            <p
              style={{
                color: "#cbd5e1",
                fontSize: "0.9rem",
                textAlign: "center",
                marginBottom: "15px",
              }}
            >
              Enter your new secure password below.
            </p>
            <div className="auth-input-group">
              <label>New Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  className="auth-input"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff size={20} color="#64748b" />
                  ) : (
                    <Eye size={20} color="#64748b" />
                  )}
                </button>
              </div>
            </div>

            {/* REAL-TIME PASSWORD VALIDATION UI */}
            <div
              style={{
                marginTop: "15px",
                marginBottom: "25px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                paddingLeft: "5px",
              }}
            >
              {[
                { valid: reqLength, label: "At least 8 characters" },
                { valid: reqLetter, label: "At least 1 letter" },
                { valid: reqNumber, label: "At least 1 number" },
                { valid: reqSpecial, label: "At least 1 special character" },
              ].map((rule, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    color: rule.valid ? "#22c55e" : "#64748b", // Turns green when valid
                    fontSize: "0.95rem",
                    fontWeight: "600",
                    transition: "color 0.3s ease",
                  }}
                >
                  <CheckCircle
                    size={20}
                    color={rule.valid ? "#22c55e" : "#64748b"}
                    strokeWidth={rule.valid ? 2.5 : 2}
                  />
                  <span>{rule.label}</span>
                </div>
              ))}
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              // Button is disabled until the password is valid OR if it's loading
              disabled={isLoading || !isPasswordValid}
              style={{ opacity: isLoading || !isPasswordValid ? 0.5 : 1 }}
            >
              {isLoading ? "Updating..." : "Update Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default ForgotPassword;
