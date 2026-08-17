import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import LoadingScreen from "./components/LoadingScreen";
import Auth from "./LoginSignup/Auth";
import ResidentDashboard from "./RESIDENTS/ResidentDashboard";
import LinemanDashboard from "./LINEMAN/LinemanDashboard";
import { useActiveStatus } from "./hooks/useActiveStatus";
import { Network } from "@capacitor/network";
import { WifiOff } from "lucide-react";
import { setupPushNotifications } from "./utils/pushNotifications";

function App() {
  // Global Background Tracker
  useActiveStatus();

  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [appLoading, setAppLoading] = useState(true);
  const [roleFetching, setRoleFetching] = useState(false);

  // NEW: Network Status State
  const [isOnline, setIsOnline] = useState(true);

  const isDevRoute = window.location.pathname === "/dev-lineman-signup";

  // --- HEARTBEAT TRACKER EFFECT ---
  // Keeps the user marked as 'Active' in the database while the app is open
  useEffect(() => {
    let intervalId;

    const pingActivity = async () => {
      // 1. Check if there is a logged-in user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // 2. Update their active status and timestamp
      await supabase
        .from("users")
        .update({
          is_active: true,
          last_active_at: new Date().toISOString(),
        })
        .eq("id", user.id);
    };

    // Ping immediately when the component loads
    pingActivity();

    // Set up the heartbeat to ping every 5 minutes (300,000 milliseconds)
    intervalId = setInterval(pingActivity, 300000);

    // Cleanup the interval if the user logs out or the component unmounts
    return () => clearInterval(intervalId);
  }, []);

  // --- NETWORK TRACKER EFFECT ---
  useEffect(() => {
    // Check initial status when app opens
    const checkNetworkStatus = async () => {
      const status = await Network.getStatus();
      setIsOnline(status.connected);
    };
    checkNetworkStatus();

    // Listen for changes (e.g., user turns on Airplane Mode)
    let networkListener;
    const setupListener = async () => {
      networkListener = await Network.addListener(
        "networkStatusChange",
        (status) => {
          setIsOnline(status.connected);
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

  // 🌟 --- PUSH NOTIFICATIONS EFFECT (FIXED) --- 🌟
  useEffect(() => {
    // Only run this IF we have a logged-in user session
    if (session && session.user) {
      const initializePush = async () => {
        console.log("User is logged in! Registering for Push Notifications...");
        await setupPushNotifications();
      };

      initializePush();
    }
  }, [session]); // The dependency array now watches the 'session' state

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

    if (isDevRoute) {
      return <LinemanRegister onBack={() => (window.location.href = "/")} />;
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
      {/* 🔴 OFFLINE OVERLAY - Sits on top of the app when disconnected */}
      {!isOnline && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(5px)",
            WebkitBackdropFilter: "blur(5px)", // Safari support
            zIndex: 999999, // Ensures it covers absolutely everything
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            padding: "20px",
            textAlign: "center",
            animation: "contentFade 0.3s ease-out",
          }}
        >
          <WifiOff size={80} color="#ef4444" style={{ marginBottom: "20px" }} />
          <h2
            style={{
              color: "#1e293b",
              fontWeight: "900",
              marginBottom: "10px",
              fontSize: "1.8rem",
            }}
          >
            No Internet Connection
          </h2>
          <p style={{ color: "#64748b", lineHeight: "1.6", maxWidth: "300px" }}>
            ISELCONNECT requires an active internet connection to synchronize
            reports. Please check your Wi-Fi or mobile data.
          </p>
        </div>
      )}

      {/* Main App Content */}
      {renderContent()}
    </>
  );
}

export default App;
