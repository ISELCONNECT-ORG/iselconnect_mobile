import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import {
  KeyRound,
  Lock,
  ShieldAlert,
  CheckCircle,
  Eye,
  EyeOff,
  Check,
  X,
} from "lucide-react";
import { translations } from "../components/translations";
import "../Lineman.css";

function ForcePasswordChange({ onComplete }) {
  const currentLang = localStorage.getItem("appLanguage") || "English";
  const t = translations[currentLang];

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // 🌟 NEW: States for password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // 🌟 NEW: Strict Password Validation Logic
  const isLengthValid = newPassword.length >= 8;
  const hasUpperCase = /[A-Z]/.test(newPassword);
  const hasLowerCase = /[a-z]/.test(newPassword);
  const hasNumber = /\d/.test(newPassword);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
  const passwordsMatch = newPassword !== "" && newPassword === confirmPassword;

  const isFormValid =
    isLengthValid &&
    hasUpperCase &&
    hasLowerCase &&
    hasNumber &&
    hasSpecialChar &&
    passwordsMatch;

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setError("");

    if (!isFormValid) {
      return setError("Please ensure all password requirements are met.");
    }

    setLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user)
        throw new Error("Authentication error. Please log in again.");

      // 1. Update the password securely in Supabase Auth
      const { error: updateAuthError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateAuthError) throw updateAuthError;

      // 2. Flip the is_first_login flag in the EMPLOYEES table to false
      const { error: updateDbError } = await supabase
        .from("employees")
        .update({ is_first_login: false })
        .eq("user_id", user.id);

      if (updateDbError) throw updateDbError;

      setSuccess(true);

      // Give them a second to see the success message before unlocking the app
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper component for the validation checklist
  const ValidationItem = ({ isValid, text }) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginBottom: "6px",
      }}
    >
      {isValid ? (
        <Check size={14} color="#16a34a" strokeWidth={3} />
      ) : (
        <X size={14} color="#dc2626" strokeWidth={3} />
      )}
      <span
        style={{
          fontSize: "0.8rem",
          color: isValid ? "#16a34a" : "#64748b",
          fontWeight: "700",
        }}
      >
        {text}
      </span>
    </div>
  );

  if (success) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={{ ...styles.iconWrapper, backgroundColor: "#dcfce7" }}>
            <CheckCircle size={48} color="#16a34a" />
          </div>
          <h2 style={{ ...styles.title, color: "#16a34a" }}>Success!</h2>
          <p style={styles.text}>
            Your password has been securely updated. Taking you to your
            dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={{ ...styles.iconWrapper, backgroundColor: "#fef3c7" }}>
          <ShieldAlert size={48} color="#d97706" />
        </div>

        <h2 style={styles.title}>Update Required</h2>
        <p style={styles.text}>
          For your security, please change your temporary password before
          accessing the ISELCONNECT Lineman Dashboard.
        </p>

        {error && <div style={styles.errorBox}>{error}</div>}

        <form onSubmit={handlePasswordChange} style={styles.form}>
          <div style={styles.inputGroup}>
            <KeyRound size={20} color="#64748b" style={styles.inputIcon} />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={styles.input}
              required
            />
            {/* 🌟 NEW: Toggle Password Button */}
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={styles.eyeButton}
            >
              {showPassword ? (
                <EyeOff size={20} color="#64748b" />
              ) : (
                <Eye size={20} color="#64748b" />
              )}
            </button>
          </div>

          <div style={styles.inputGroup}>
            <Lock size={20} color="#64748b" style={styles.inputIcon} />
            <input
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={styles.input}
              required
            />
            {/* 🌟 NEW: Toggle Confirm Password Button */}
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              style={styles.eyeButton}
            >
              {showConfirmPassword ? (
                <EyeOff size={20} color="#64748b" />
              ) : (
                <Eye size={20} color="#64748b" />
              )}
            </button>
          </div>

          {/* 🌟 NEW: Password Validation Checklist */}
          <div style={styles.validationBox}>
            <ValidationItem
              isValid={isLengthValid}
              text="At least 8 characters"
            />
            <ValidationItem
              isValid={hasUpperCase}
              text="One uppercase letter (A-Z)"
            />
            <ValidationItem
              isValid={hasLowerCase}
              text="One lowercase letter (a-z)"
            />
            <ValidationItem isValid={hasNumber} text="One number (0-9)" />
            <ValidationItem
              isValid={hasSpecialChar}
              text="One special character (!@#...)"
            />
            <ValidationItem isValid={passwordsMatch} text="Passwords match" />
          </div>

          <button
            type="submit"
            disabled={loading || !isFormValid}
            style={{
              ...styles.button,
              opacity: loading || !isFormValid ? 0.5 : 1,
              cursor: loading || !isFormValid ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    backgroundColor: "#1b0b8c",
    backgroundImage: "linear-gradient(135deg, #1b0b8c 0%, #1e1b4b 100%)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999999,
    padding: "20px",
    boxSizing: "border-box",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: "24px",
    padding: "40px 25px",
    width: "100%",
    maxWidth: "400px",
    textAlign: "center",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
    animation: "contentFade 0.4s ease-out",
    maxHeight: "90vh",
    overflowY: "auto", // In case screen is very small
  },
  iconWrapper: {
    width: "80px",
    height: "80px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 20px auto",
  },
  title: {
    margin: "0 0 10px 0",
    color: "#1e293b",
    fontSize: "1.4rem",
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: "1px",
  },
  text: {
    color: "#475569",
    fontSize: "0.85rem",
    lineHeight: "1.5",
    margin: "0 0 25px 0",
  },
  errorBox: {
    backgroundColor: "#fee2e2",
    color: "#dc2626",
    padding: "12px",
    borderRadius: "12px",
    fontSize: "0.85rem",
    fontWeight: "700",
    marginBottom: "20px",
  },
  validationBox: {
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "15px",
    textAlign: "left",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    marginTop: "5px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "15px",
  },
  inputGroup: {
    position: "relative",
    width: "100%",
  },
  inputIcon: {
    position: "absolute",
    left: "15px",
    top: "50%",
    transform: "translateY(-50%)",
  },
  eyeButton: {
    position: "absolute",
    right: "15px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    width: "100%",
    padding: "16px 50px 16px 45px", // 🌟 FIXED: Room for left and right icons
    borderRadius: "15px",
    border: "2px solid #e2e8f0",
    fontSize: "1rem",
    backgroundColor: "#ffffff", // Pure white for better contrast
    color: "#000000", // 🌟 FIXED: Enforced solid black text
    boxSizing: "border-box",
    outline: "none",
    fontWeight: "600",
    transition: "border-color 0.2s",
  },
  button: {
    backgroundColor: "#facc15",
    color: "#1b0b8c",
    border: "none",
    padding: "16px",
    borderRadius: "50px",
    fontSize: "1rem",
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: "1px",
    marginTop: "10px",
    boxShadow: "0 4px 14px rgba(250, 204, 21, 0.4)",
    transition: "all 0.2s ease",
  },
};

export default ForcePasswordChange;
