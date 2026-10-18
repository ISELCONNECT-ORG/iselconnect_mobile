import React, { useState, useEffect } from "react";
import { ChevronLeft, Eye, EyeOff, CheckCircle } from "lucide-react";
import { supabase } from "../supabaseClient";
import { logSystemAction } from "../utils/logger";
import "../Resident.css";

function ChangePassword({ onBack, onSuccess }) {
  // 🌟 INITIALIZE STATES FROM MEMORY
  const [cpStage, setCpStage] = useState(
    () => localStorage.getItem("settings_cp_stage") || "info",
  );
  const [cpNewPassword, setCpNewPassword] = useState(
    () => localStorage.getItem("settings_cp_new") || "",
  );
  const [cpConfirmPassword, setCpConfirmPassword] = useState(
    () => localStorage.getItem("settings_cp_conf") || "",
  );

  const [cpOtp, setCpOtp] = useState("");
  const [cpError, setCpError] = useState("");
  const [cpMessage, setCpMessage] = useState("");
  const [cpIsLoading, setCpIsLoading] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // --- PASSWORD VALIDATION RULES ---
  const reqLength = cpNewPassword.length >= 8;
  const reqLetter = /[a-zA-Z]/.test(cpNewPassword);
  const reqNumber = /\d/.test(cpNewPassword);
  const reqSpecial = /[!@#$%^&*(),.?":{}|<>\-_]/.test(cpNewPassword);
  const isPasswordValid = reqLength && reqLetter && reqNumber && reqSpecial;
  const doPasswordsMatch =
    cpNewPassword === cpConfirmPassword && cpConfirmPassword.length > 0;

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setUserEmail(user.email);
    };
    fetchUser();
  }, []);

  const clearCpData = () => {
    setCpStage("info");
    setCpOtp("");
    setCpNewPassword("");
    setCpConfirmPassword("");
    setCpError("");
    setCpMessage("");
    localStorage.removeItem("settings_cp_stage");
    localStorage.removeItem("settings_cp_new");
    localStorage.removeItem("settings_cp_conf");
  };

  const handleCancel = () => {
    if (cpStage === "otp") {
      setCpStage("info");
      localStorage.setItem("settings_cp_stage", "info");
      setCpMessage("");
      setCpError("");
    } else {
      clearCpData();
      onBack();
    }
  };

  // --- STAGE 1: Request OTP ---
  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setCpError("");
    setCpMessage("");
    setCpIsLoading(true);

    try {
      let currentEmail = userEmail;
      if (!currentEmail) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          currentEmail = user.email;
          setUserEmail(user.email);
        } else {
          throw new Error("Session lost. Please log out and log in again.");
        }
      }

      const { error } = await supabase.auth.resetPasswordForEmail(currentEmail);
      if (error) throw error;

      // 🌟 FORCE SYNCHRONOUS SAVE BEFORE ANY REFRESH
      localStorage.setItem("settings_cp_stage", "otp");
      setCpOtp("");
      setCpStage("otp");
      setCpMessage("A 6-digit OTP has been sent to your email.");
    } catch (err) {
      setCpError(err.message);
    } finally {
      setCpIsLoading(false);
    }
  };

  // --- STAGE 2: Verify OTP ---
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setCpError("");
    setCpMessage("");
    setCpIsLoading(true);

    try {
      let currentEmail = userEmail;
      if (!currentEmail) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          currentEmail = user.email;
          setUserEmail(user.email);
        } else {
          throw new Error("Session lost. Please log out and log in again.");
        }
      }

      const { error } = await supabase.auth.verifyOtp({
        email: currentEmail,
        token: cpOtp,
        type: "recovery",
      });

      if (error) throw error;

      // 🌟 FORCE SYNCHRONOUS SAVE THE MILLISECOND IT VERIFIES TO BEAT GLOBAL AUTH REFRESHES
      localStorage.setItem("settings_cp_stage", "newPassword");
      setCpStage("newPassword");
      setCpMessage("OTP Verified. You may now create a new password.");
    } catch (err) {
      setCpError("Invalid or expired OTP. Please try again.");
    } finally {
      setCpIsLoading(false);
    }
  };

  // --- STAGE 3: Update Password ---
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setCpError("");
    setCpMessage("");

    if (!isPasswordValid) {
      return setCpError("Please ensure all password requirements are met.");
    }
    if (!doPasswordsMatch) {
      return setCpError("Passwords do not match. Please try again.");
    }

    setCpIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: cpNewPassword,
      });

      if (error) throw error;

      await logSystemAction(
        "UPDATE_PASSWORD",
        "User securely updated their account password via OTP verification.",
      );

      clearCpData();
      if (onSuccess) onSuccess();
    } catch (err) {
      setCpError(err.message);
    } finally {
      setCpIsLoading(false);
    }
  };

  return (
    <div
      className="page-transition"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 99999,
        backgroundColor: "#f8fafc",
        overflowY: "auto",
        overscrollBehavior: "none",
        padding: "0px 16px 40px 16px",
        boxSizing: "border-box",
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
        <button
          onClick={handleCancel}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
          }}
        >
          <ChevronLeft size={28} color="#1b0b8c" strokeWidth={2.5} />
        </button>
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
          {cpStage === "info" && "Change Password"}
          {cpStage === "otp" && "Verify Email"}
          {cpStage === "newPassword" && "New Password"}
        </h2>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          maxWidth: "500px",
          margin: "0 auto",
        }}
      >
        {cpError && (
          <div
            style={{
              backgroundColor: "#fee2e2",
              color: "#dc2626",
              padding: "12px",
              borderRadius: "12px",
              fontSize: "0.9rem",
              fontWeight: "bold",
              textAlign: "left",
              border: "1px solid #fca5a5",
            }}
          >
            {cpError}
          </div>
        )}
        {cpMessage && (
          <div
            style={{
              backgroundColor: "#dcfce7",
              color: "#16a34a",
              padding: "12px",
              borderRadius: "12px",
              fontSize: "0.9rem",
              fontWeight: "bold",
              textAlign: "left",
              border: "1px solid #86efac",
            }}
          >
            {cpMessage}
          </div>
        )}

        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            padding: "24px 20px",
            boxShadow: "0 4px 10px rgba(0,0,0,0.04)",
            border: "1px solid #e2e8f0",
          }}
        >
          {/* STAGE 1 FORM: Info & Request */}
          {cpStage === "info" && (
            <form
              onSubmit={handleRequestOTP}
              style={{ display: "flex", flexDirection: "column", gap: "20px" }}
            >
              <p
                style={{
                  color: "#475569",
                  fontSize: "1rem",
                  textAlign: "center",
                  margin: 0,
                  lineHeight: "1.6",
                }}
              >
                To securely change your password, the system will send a
                One-Time Password (OTP) to your registered email address.
              </p>
              <button
                type="submit"
                disabled={cpIsLoading}
                style={{
                  width: "100%",
                  padding: "16px",
                  borderRadius: "50px",
                  backgroundColor: "#1b0b8c",
                  color: "#ffffff",
                  fontWeight: "900",
                  fontSize: "1rem",
                  border: "none",
                  cursor: "pointer",
                  textTransform: "uppercase",
                  boxShadow: "0 8px 20px rgba(27, 11, 140, 0.25)",
                  opacity: cpIsLoading ? 0.7 : 1,
                }}
              >
                {cpIsLoading ? "Sending..." : "Send OTP"}
              </button>
            </form>
          )}

          {/* STAGE 2 FORM: Verify OTP */}
          {cpStage === "otp" && (
            <form
              onSubmit={handleVerifyOTP}
              style={{ display: "flex", flexDirection: "column", gap: "20px" }}
            >
              <p
                style={{
                  color: "#475569",
                  fontSize: "0.95rem",
                  textAlign: "center",
                  margin: 0,
                  lineHeight: "1.5",
                }}
              >
                Please check your email <strong>{userEmail}</strong> for the
                6-digit code.
              </p>
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "0.85rem",
                    fontWeight: "bold",
                    color: "#64748b",
                    textTransform: "uppercase",
                  }}
                >
                  6-Digit Code
                </label>
                <input
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={cpOtp}
                  onChange={(e) =>
                    setCpOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  required
                  style={{
                    width: "100%",
                    padding: "16px",
                    borderRadius: "12px",
                    border: "1px solid #cbd5e1",
                    fontSize: "1.5rem",
                    letterSpacing: "8px",
                    textAlign: "center",
                    fontWeight: "bold",
                    boxSizing: "border-box",
                    outline: "none",
                    backgroundColor: "#f8fafc",
                    color: "#1e293b",
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={cpIsLoading || cpOtp.length < 6}
                style={{
                  width: "100%",
                  padding: "16px",
                  borderRadius: "50px",
                  backgroundColor: "#1b0b8c",
                  color: "#ffffff",
                  fontWeight: "900",
                  fontSize: "1rem",
                  border: "none",
                  cursor: "pointer",
                  textTransform: "uppercase",
                  boxShadow: "0 8px 20px rgba(27, 11, 140, 0.25)",
                  opacity: cpIsLoading || cpOtp.length < 6 ? 0.7 : 1,
                }}
              >
                {cpIsLoading ? "Verifying..." : "Verify Code"}
              </button>
            </form>
          )}

          {/* STAGE 3 FORM: Create New Password */}
          {cpStage === "newPassword" && (
            <form
              onSubmit={handleUpdatePassword}
              style={{ display: "flex", flexDirection: "column", gap: "20px" }}
            >
              <p
                style={{
                  color: "#475569",
                  fontSize: "0.95rem",
                  textAlign: "center",
                  margin: 0,
                }}
              >
                Enter your new secure password below.
              </p>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "0.85rem",
                    fontWeight: "bold",
                    color: "#64748b",
                    textTransform: "uppercase",
                  }}
                >
                  New Password
                </label>
                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={cpNewPassword}
                    onChange={(e) => {
                      setCpNewPassword(e.target.value);
                      localStorage.setItem("settings_cp_new", e.target.value);
                    }}
                    required
                    style={{
                      width: "100%",
                      padding: "14px 45px 14px 16px",
                      borderRadius: "12px",
                      border: "1px solid #cbd5e1",
                      fontSize: "1rem",
                      boxSizing: "border-box",
                      outline: "none",
                      backgroundColor: "#f8fafc",
                      color: "#334155",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute",
                      right: "12px",
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      display: "flex",
                    }}
                  >
                    {showPassword ? (
                      <EyeOff size={20} color="#64748b" />
                    ) : (
                      <Eye size={20} color="#64748b" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "0.85rem",
                    fontWeight: "bold",
                    color: "#64748b",
                    textTransform: "uppercase",
                  }}
                >
                  Confirm Password
                </label>
                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Re-enter new password"
                    value={cpConfirmPassword}
                    onChange={(e) => {
                      setCpConfirmPassword(e.target.value);
                      localStorage.setItem("settings_cp_conf", e.target.value);
                    }}
                    required
                    style={{
                      width: "100%",
                      padding: "14px 45px 14px 16px",
                      borderRadius: "12px",
                      border:
                        cpConfirmPassword.length > 0 && !doPasswordsMatch
                          ? "2px solid #ef4444"
                          : "1px solid #cbd5e1",
                      fontSize: "1rem",
                      boxSizing: "border-box",
                      outline: "none",
                      backgroundColor: "#f8fafc",
                      color: "#334155",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{
                      position: "absolute",
                      right: "12px",
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      display: "flex",
                    }}
                  >
                    {showConfirmPassword ? (
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
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  padding: "10px 5px",
                }}
              >
                {[
                  { valid: reqLength, label: "At least 8 characters" },
                  { valid: reqLetter, label: "At least 1 letter" },
                  { valid: reqNumber, label: "At least 1 number" },
                  { valid: reqSpecial, label: "At least 1 special character" },
                  { valid: doPasswordsMatch, label: "Passwords match" },
                ].map((rule, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      color: rule.valid ? "#16a34a" : "#64748b",
                      fontSize: "0.9rem",
                      fontWeight: "600",
                      transition: "color 0.3s ease",
                    }}
                  >
                    <CheckCircle
                      size={18}
                      color={rule.valid ? "#16a34a" : "#cbd5e1"}
                      strokeWidth={rule.valid ? 2.5 : 2}
                    />
                    <span>{rule.label}</span>
                  </div>
                ))}
              </div>

              <button
                type="submit"
                disabled={cpIsLoading || !isPasswordValid || !doPasswordsMatch}
                style={{
                  width: "100%",
                  padding: "16px",
                  borderRadius: "50px",
                  backgroundColor: "#16a34a",
                  color: "#ffffff",
                  fontWeight: "900",
                  fontSize: "1rem",
                  border: "none",
                  cursor: "pointer",
                  textTransform: "uppercase",
                  boxShadow: "0 8px 20px rgba(22, 163, 74, 0.25)",
                  opacity:
                    cpIsLoading || !isPasswordValid || !doPasswordsMatch
                      ? 0.5
                      : 1,
                }}
              >
                {cpIsLoading ? "Updating..." : "Update Password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChangePassword;
