import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { Eye, EyeOff, ChevronLeft, AlertOctagon } from "lucide-react";
import logo from "../assets/ISELCONNECT.png";
import { logSystemAction } from "../utils/logger";
import SignUp from "./SignUp";
import ForgotPassword from "./ForgotPassword";

function Auth({ onBack }) {
  const [showSignUp, setShowSignUp] = useState(false);

  // Initialize state based on whether a recovery is currently in progress
  const [showForgotPassword, setShowForgotPassword] = useState(
    localStorage.getItem("recovery_in_progress") === "true",
  );

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // 🌟 NEW: Rate Limiting States
  const [failedAttempts, setFailedAttempts] = useState(
    () => parseInt(localStorage.getItem("login_attempts")) || 0,
  );
  const [lockoutTime, setLockoutTime] = useState(0); // Time remaining in seconds

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  // 🌟 NEW: Effect to handle the lockout countdown timer
  useEffect(() => {
    const checkLockout = () => {
      const lockedUntil = localStorage.getItem("lockout_until");
      if (lockedUntil) {
        const remainingTime = Math.ceil(
          (parseInt(lockedUntil) - Date.now()) / 1000,
        );
        if (remainingTime > 0) {
          setLockoutTime(remainingTime);
        } else {
          // Lockout period has ended
          setLockoutTime(0);
          setFailedAttempts(0);
          localStorage.removeItem("lockout_until");
          localStorage.removeItem("login_attempts");
          setErrorMsg(""); // Clear the lockout error
        }
      }
    };

    // Check immediately on mount
    checkLockout();

    // Set up a 1-second interval to update the countdown
    const interval = setInterval(checkLockout, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Prevent submission if currently locked out
    if (lockoutTime > 0) return;

    setLoading(true);
    setErrorMsg("");

    try {
      const { data: preCheckUser } = await supabase
        .from("users")
        .select("role_id")
        .ilike("email", formData.email.trim())
        .maybeSingle();

      if (!preCheckUser) throw new Error("Account not found in the system.");

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email.trim(),
        password: formData.password,
      });
      if (authError) throw authError;

      // 🌟 SUCCESS: Reset rate limit counters immediately!
      localStorage.removeItem("login_attempts");
      localStorage.removeItem("lockout_until");
      setFailedAttempts(0);

      const roleName =
        preCheckUser.role_id === 7 ? "Resident" : "Lineman/Staff";
      await logSystemAction(
        "USER_LOGIN",
        `${roleName} logged into the application successfully.`,
      );
    } catch (error) {
      // 🌟 FAILED LOGIN: Handle Rate Limiting Logic
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      localStorage.setItem("login_attempts", newAttempts.toString());

      if (newAttempts >= 5) {
        // Trigger 60-second lockout
        const lockUntil = Date.now() + 60 * 1000;
        localStorage.setItem("lockout_until", lockUntil.toString());
        setLockoutTime(60);
        setErrorMsg("Too many failed attempts. Account temporarily locked.");
      } else {
        // Show remaining attempts
        const attemptsLeft = 5 - newAttempts;
        setErrorMsg(
          `${error.message} (${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} remaining)`,
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // --- SCREEN ROUTING ---
  if (showSignUp) {
    return <SignUp onBack={() => setShowSignUp(false)} />;
  }

  if (showForgotPassword) {
    return (
      <ForgotPassword
        onBack={() => setShowForgotPassword(false)}
        onPasswordUpdated={() => setShowForgotPassword(false)}
      />
    );
  }

  const isLocked = lockoutTime > 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        backgroundColor: "#ffffff",
        overflow: "hidden",
      }}
    >
      <div
        className="auth-bg-photo"
        style={{
          flex: 1,
          position: "relative",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "40%",
            background: "linear-gradient(to bottom, transparent, #ffffff)",
          }}
        ></div>
        <img
          src={logo}
          alt="ISELCONNECT Logo"
          style={{
            width: "90%",
            maxWidth: "380px",
            zIndex: 1,
            marginTop: "10%",
            marginBottom: "0",
          }}
        />
      </div>

      <div
        style={{
          backgroundColor: "#1b0b8c",
          borderTopLeftRadius: "60px",
          padding: "35px 30px 50px 30px",
          flexShrink: 0,
          boxShadow: "0 -10px 25px rgba(0,0,0,0.15)",
          animation: "slideUpFade 0.4s ease-out",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "25px" }}>
          <h2
            style={{
              margin: 0,
              fontSize: "1.7rem",
              fontWeight: "900",
              letterSpacing: "1px",
            }}
          >
            <span style={{ color: "#ffffff" }}>LOGIN</span>
          </h2>
          <div
            style={{
              height: "1px",
              backgroundColor: "rgba(255, 255, 255, 0.4)",
              width: "85%",
              margin: "8px auto 0 auto",
            }}
          ></div>
        </div>

        {/* Dynamic Error / Lockout Message Box */}
        {errorMsg && (
          <div
            style={{
              backgroundColor: isLocked ? "#fef2f2" : "#fee2e2",
              color: "#ef4444",
              border: isLocked ? "2px solid #fca5a5" : "none",
              padding: "12px",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              textAlign: "center",
              fontWeight: "900",
              fontSize: "0.85rem",
              marginBottom: "15px",
              animation: isLocked ? "pulse 2s infinite" : "none",
            }}
          >
            {isLocked && <AlertOctagon size={18} />}
            {errorMsg}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            opacity: isLocked ? 0.6 : 1,
            transition: "opacity 0.3s ease",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginBottom: "15px",
            }}
          >
            <label
              style={{
                color: "#ffffff",
                fontWeight: "900",
                marginBottom: "8px",
                fontSize: "1rem",
                paddingLeft: "5px",
              }}
            >
              Email
            </label>
            <input
              type="email"
              name="email"
              placeholder="Example@gmail.com"
              value={formData.email}
              onChange={handleInputChange}
              required
              disabled={isLocked || loading}
              style={{
                padding: "15px 20px",
                borderRadius: "30px",
                border: "none",
                fontSize: "1rem",
                outline: "none",
                backgroundColor: isLocked ? "#f1f5f9" : "#ffffff",
                color: "#334155",
                fontFamily: "inherit",
                cursor: isLocked ? "not-allowed" : "text",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginBottom: "10px",
            }}
          >
            <label
              style={{
                color: "#ffffff",
                fontWeight: "900",
                marginBottom: "8px",
                fontSize: "1rem",
                paddingLeft: "5px",
              }}
            >
              Password
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
                name="password"
                placeholder="********"
                value={formData.password}
                onChange={handleInputChange}
                required
                disabled={isLocked || loading}
                style={{
                  width: "100%",
                  padding: "15px 20px",
                  borderRadius: "30px",
                  border: "none",
                  fontSize: "1rem",
                  outline: "none",
                  backgroundColor: isLocked ? "#f1f5f9" : "#ffffff",
                  color: "#334155",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                  cursor: isLocked ? "not-allowed" : "text",
                }}
              />
              <button
                type="button"
                onClick={() => !isLocked && setShowPassword(!showPassword)}
                disabled={isLocked}
                style={{
                  position: "absolute",
                  right: "15px",
                  background: "transparent",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  cursor: isLocked ? "not-allowed" : "pointer",
                  padding: 0,
                  opacity: isLocked ? 0.5 : 1,
                }}
              >
                {showPassword ? (
                  <EyeOff size={22} color="#64748b" />
                ) : (
                  <Eye size={22} color="#1b0b8c" />
                )}
              </button>
            </div>
          </div>

          <div
            style={{
              textAlign: "right",
              marginBottom: "25px",
              paddingRight: "10px",
            }}
          >
            <button
              type="button"
              disabled={isLocked}
              onClick={() => {
                localStorage.setItem("recovery_in_progress", "true");
                setShowForgotPassword(true);
                setErrorMsg("");
              }}
              style={{
                background: "none",
                border: "none",
                color: "#cbd5e1",
                fontWeight: "600",
                cursor: isLocked ? "not-allowed" : "pointer",
                fontSize: "0.85rem",
                padding: 0,
                textDecoration: "underline",
                fontFamily: "inherit",
              }}
            >
              Forgot Password?
            </button>
          </div>

          <div style={{ padding: "0 10px" }}>
            <button
              type="submit"
              disabled={loading || isLocked}
              style={{
                width: "100%",
                backgroundColor: isLocked ? "#cbd5e1" : "#ffffff",
                color: isLocked ? "#475569" : "#1b0b8c",
                padding: "15px",
                borderRadius: "30px",
                fontWeight: "900",
                fontSize: "1.1rem",
                border: "none",
                cursor: loading || isLocked ? "not-allowed" : "pointer",
                boxShadow: isLocked
                  ? "none"
                  : "0 0 0 2px #1b0b8c, 0 0 0 4px #ffffff",
                opacity: loading || isLocked ? 0.8 : 1,
                fontFamily: "inherit",
                transition: "all 0.2s ease",
              }}
            >
              {isLocked
                ? `Try again in ${lockoutTime}s`
                : loading
                  ? "Processing..."
                  : "Login"}
            </button>
          </div>

          <div style={{ textAlign: "center", marginTop: "30px" }}>
            <p
              style={{
                color: "#ffffff",
                fontSize: "0.9rem",
                margin: 0,
                fontWeight: "700",
              }}
            >
              Don't have an account?{" "}
              <button
                type="button"
                disabled={isLocked}
                onClick={() => {
                  setShowSignUp(true);
                  setErrorMsg("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: isLocked ? "#94a3b8" : "#facc15",
                  fontWeight: "900",
                  cursor: isLocked ? "not-allowed" : "pointer",
                  fontSize: "0.9rem",
                  padding: 0,
                  textDecoration: isLocked ? "none" : "underline",
                  fontFamily: "inherit",
                }}
              >
                Create one!
              </button>
            </p>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}

export default Auth;
