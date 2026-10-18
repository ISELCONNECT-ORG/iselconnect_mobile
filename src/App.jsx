import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import LoadingScreen from "./components/LoadingScreen";
import Auth from "./LoginSignup/Auth";
import ResidentDashboard from "./RESIDENTS/ResidentDashboard";
import LinemanDashboard from "./LINEMAN/LinemanDashboard";
import { useActiveStatus } from "./hooks/useActiveStatus";
import { Network } from "@capacitor/network";
import { Keyboard } from "@capacitor/keyboard";
import { WifiOff } from "lucide-react";
import { setupPushNotifications } from "./utils/pushNotifications";

function App() {
  // Global Background Tracker
  useActiveStatus();

  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [appLoading, setAppLoading] = useState(true);
  const [roleFetching, setRoleFetching] = useState(false);

  // Network Status States
  const [isOnline, setIsOnline] = useState(true);
  const [dismissedOffline, setDismissedOffline] = useState(false);
  const [isClosingOffline, setIsClosingOffline] = useState(false); // 🌟 NEW: Tracks the exit animation state

  // 🌟 --- KEYBOARD OVERLAY EFFECT --- 🌟
  useEffect(() => {
    // Hide the navigation bar when the keyboard pops up
    const hideNav = () => {
      const navBar = document.querySelector(".bottom-nav-wrapper");
      if (navBar) navBar.style.display = "none";
    };

    // Show the navigation bar when the keyboard closes
    const showNav = () => {
      // Check if the current full-screen overlay wants to force-hide the nav
      const isOverlayActive = document.querySelector(".force-hide-nav");

      // Only restore the navigation bar if there is NO overlay active
      if (!isOverlayActive) {
        const navBar = document.querySelector(".bottom-nav-wrapper");
        if (navBar) navBar.style.display = "";
      }
    };

    // Listen for Capacitor Keyboard events
    Keyboard.addListener("keyboardWillShow", hideNav);
    Keyboard.addListener("keyboardWillHide", showNav);

    // Cleanup listeners when the component unmounts
    return () => {
      Keyboard.removeAllListeners();
    };
  }, []);

  // --- HEARTBEAT TRACKER EFFECT ---
  useEffect(() => {
    let intervalId;

    const pingActivity = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from("users")
        .update({
          is_active: true,
          last_active_at: new Date().toISOString(),
        })
        .eq("id", user.id);
    };

    pingActivity();
    intervalId = setInterval(pingActivity, 300000);

    return () => clearInterval(intervalId);
  }, []);

  // --- NETWORK TRACKER EFFECT ---
  useEffect(() => {
    const checkNetworkStatus = async () => {
      const status = await Network.getStatus();
      setIsOnline(status.connected);
      if (status.connected) {
        setDismissedOffline(false);
        setIsClosingOffline(false); // Reset states if connection returns
      }
    };
    checkNetworkStatus();

    let networkListener;
    const setupListener = async () => {
      networkListener = await Network.addListener(
        "networkStatusChange",
        (status) => {
          setIsOnline(status.connected);
          if (status.connected) {
            setDismissedOffline(false);
            setIsClosingOffline(false); // Reset states if connection returns
          }
        },
      );
    };
    setupListener();

    return () => {
      if (networkListener) {
        networkListener.remove();
      }
    };
  }, []);

  // 🌟 --- PUSH NOTIFICATIONS EFFECT --- 🌟
  useEffect(() => {
    if (session && session.user) {
      const initializePush = async () => {
        console.log("User is logged in! Registering for Push Notifications...");
        // Passed session.user.id so pushNotifications.js receives the ID
        await setupPushNotifications();
      };

      initializePush();
    }
  }, [session]);

  // --- AUTHENTICATION EFFECT ---
  useEffect(() => {
    const isRecovering = () =>
      localStorage.getItem("recovery_in_progress") === "true";

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session && !isRecovering()) {
        fetchUserRole(session.user.id);
      } else {
        setAppLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);

      if (isRecovering()) {
        return;
      }

      if (session) {
        setRoleFetching(true);
        fetchUserRole(session.user.id);
      } else {
        setUserRole(null);
        setAppLoading(false);
        setRoleFetching(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId) => {
    let attempts = 5;
    const delay = 1000;

    while (attempts > 0) {
      try {
        const { data, error } = await supabase
          .from("users")
          .select("role_id")
          .eq("id", userId)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setUserRole(data.role_id);
          setAppLoading(false);
          setRoleFetching(false);
          return;
        }
        console.log(
          `Profile row pending creation. Retrying... (${attempts - 1} left)`,
        );
      } catch (error) {
        console.error("Error matching profile role:", error.message);
      }

      attempts--;
      if (attempts > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    setAppLoading(false);
    setRoleFetching(false);
  };

  // 🌟 NEW: Handles the exit animation sequence
  const handleDismissOffline = () => {
    setIsClosingOffline(true);
    // Wait for the CSS animation to complete before removing the element from the DOM
    setTimeout(() => {
      setDismissedOffline(true);
      setIsClosingOffline(false); // Reset for future use
    }, 300);
  };

  // --- ROUTING LOGIC ---
  const renderContent = () => {
    if (appLoading || roleFetching) {
      return (
        <div
          style={{
            height: "100vh",
            width: "100vw",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#f8fafc",
          }}
        >
          <LoadingScreen message="LOADING ISELCONNECT..." />
        </div>
      );
    }

    const isRecoveringFlag =
      localStorage.getItem("recovery_in_progress") === "true";

    if (!session || isRecoveringFlag) {
      return (
        <Auth onBack={() => console.log("Already at root login screen")} />
      );
    }

    if (session && userRole && !isRecoveringFlag) {
      if (userRole === 7) return <ResidentDashboard />;
      if (userRole === 9) return <LinemanDashboard />;
    }

    return (
      <div
        className="app-restricted-screen"
        style={{ textAlign: "center", padding: "50px" }}
      >
        <h2>Access Restricted</h2>
        <p>Your account role cannot access this mobile portal.</p>
        <button
          onClick={() => supabase.auth.signOut()}
          className="app-signout-btn"
          style={{
            padding: "10px 20px",
            backgroundColor: "#1b0b8c",
            color: "white",
            borderRadius: "8px",
            border: "none",
            marginTop: "20px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Sign Out
        </button>
      </div>
    );
  };

  return (
    <>
      {/* 🌟 Top Notification Banner for No Internet */}
      {!isOnline && !dismissedOffline && (
        <>
          <style>{`
            @keyframes slideDownAlert {
              from { transform: translateY(-100%); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
            @keyframes slideUpAlert {
              from { transform: translateY(0); opacity: 1; }
              to { transform: translateY(-100%); opacity: 0; }
            }
          `}</style>
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              backgroundColor: "#fef2f2",
              borderBottom: "3px solid #ef4444",
              zIndex: 999999,
              display: "flex",
              flexDirection: "column",
              padding: "15px 20px",
              boxSizing: "border-box",
              boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
              // Dynamically apply animation based on the closing state
              animation: isClosingOffline
                ? "slideUpAlert 0.3s ease-in forwards"
                : "slideDownAlert 0.3s ease-out forwards",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                marginBottom: "12px",
              }}
            >
              <div
                style={{
                  backgroundColor: "#fee2e2",
                  padding: "8px",
                  borderRadius: "50%",
                }}
              >
                <WifiOff size={24} color="#dc2626" />
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  marginTop: "2px",
                }}
              >
                <h3
                  style={{
                    margin: "0 0 2px 0",
                    color: "#991b1b",
                    fontSize: "1rem",
                    fontWeight: "900",
                  }}
                >
                  No Internet Connection
                </h3>
                <p
                  style={{
                    margin: 0,
                    color: "#7f1d1d",
                    fontSize: "0.8rem",
                    lineHeight: "1.4",
                  }}
                >
                  ISELCONNECT requires an active internet connection to
                  synchronize reports. Please check your Wi-Fi or mobile data.
                </p>
              </div>
            </div>
            <button
              onClick={handleDismissOffline}
              style={{
                backgroundColor: "#ef4444",
                color: "#ffffff",
                border: "none",
                padding: "10px",
                borderRadius: "25px",
                fontWeight: "900",
                fontSize: "0.85rem",
                cursor: "pointer",
                textTransform: "uppercase",
                width: "100%",
                boxShadow: "0 4px 10px rgba(239, 68, 68, 0.3)",
                transition: "background-color 0.2s",
              }}
            >
              Understood
            </button>
          </div>
        </>
      )}

      {renderContent()}
    </>
  );
}

export default App;
