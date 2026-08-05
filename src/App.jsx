import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import LoadingScreen from "./components/LoadingScreen";
import Auth from "./LoginSignup/Auth";
import ResidentDashboard from "./RESIDENTS/ResidentDashboard";
import LinemanDashboard from "./LINEMAN/LinemanDashboard";
import { useActiveStatus } from "./hooks/useActiveStatus"; // <-- NEW IMPORT

function App() {
  // 🟢 THIS SINGLE LINE ACTIVATES THE GLOBAL BACKGROUND TRACKER
  useActiveStatus();

  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null);

  const [appLoading, setAppLoading] = useState(true);
  const [roleFetching, setRoleFetching] = useState(false);

  const isDevRoute = window.location.pathname === "/dev-lineman-signup";

  useEffect(() => {
    // Helper function to check if we are in the middle of a password reset
    const isRecovering = () =>
      localStorage.getItem("recovery_in_progress") === "true";

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      // Skip fetching role if they are just recovering their password
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

      // 🚀 THE FIX: If they are recovering their password, IGNORE the login event!
      // This stops the Loading Screen from rendering and destroying the Forgot Password form.
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
    return <Auth onBack={() => console.log("Already at root login screen")} />;
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
}

export default App;
