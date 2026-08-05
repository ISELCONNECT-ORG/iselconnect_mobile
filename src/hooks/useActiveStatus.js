import { useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import { App as CapacitorApp } from "@capacitor/app";

export function useActiveStatus() {
  const isCurrentlyActive = useRef(null);
  const userIdRef = useRef(null); // Tracks the currently logged-in user dynamically

  useEffect(() => {
    // Helper function to update the database
    const updateDatabase = async (uid, isActiveBool) => {
      const dbValue = isActiveBool ? "TRUE" : "FALSE";
      await supabase
        .from("users")
        .update({ is_active: dbValue })
        .eq("id", uid);
    };

    // Main status toggle function
    const setStatus = async (isActiveBool) => {
      // Prevent duplicate updates or updating if nobody is logged in
      if (isCurrentlyActive.current === isActiveBool) return;
      if (!userIdRef.current) return; 

      isCurrentlyActive.current = isActiveBool;
      await updateDatabase(userIdRef.current, isActiveBool);
    };

    // 1. Listen for logins and logouts continuously
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          // New user logged in, update the memory
          userIdRef.current = session.user.id;
          setStatus(true);
        } else {
          // User logged out. Mark the old user as FALSE, then clear memory.
          if (userIdRef.current) {
            updateDatabase(userIdRef.current, false);
          }
          userIdRef.current = null;
          isCurrentlyActive.current = null;
        }
      }
    );

    // 2. Fetch the initial session just in case they are already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        userIdRef.current = session.user.id;
        setStatus(true);
      }
    });

    // 3. Web Browser Listener: Tab switching
    const handleVisibilityChange = () => {
      setStatus(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // 4. Web Browser Listener: Closing the tab
    const handleBeforeUnload = () => {
      setStatus(false);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    // 5. Mobile App Listener: Backgrounding/Foregrounding the Android app
    let appStateListener;
    const setupCapacitorListener = async () => {
      try {
        appStateListener = await CapacitorApp.addListener(
          "appStateChange",
          ({ isActive }) => {
            setStatus(isActive);
          }
        );
      } catch (error) {
        console.log("Running in web mode, skipping Capacitor native listener.");
      }
    };
    setupCapacitorListener();

    // 6. Cleanup when the app is closed entirely
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      
      if (appStateListener) {
        appStateListener.remove();
      }
      
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }

      // Mark as false upon final unmount
      if (userIdRef.current) {
        updateDatabase(userIdRef.current, false);
      }
    };
  }, []);
}