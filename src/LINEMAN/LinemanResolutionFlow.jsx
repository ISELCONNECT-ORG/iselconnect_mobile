import React, { useState, useEffect, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import { Geolocation } from "@capacitor/geolocation";
import { ChevronLeft, MapPin } from "lucide-react";
import { supabase } from "../supabaseClient";
import { logSystemAction } from "../utils/logger";

const base64ToBlob = (base64, mimeType = "image/jpeg") => {
  const byteCharacters = atob(base64.split(",")[1]);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++)
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
};

// 🌟 ADDED `className="force-hide-nav"` to this wrapper so the keyboard listener never restores the nav bar here!
const FullScreenWrapper = ({ title, onBack, isDark, children }) => (
  <div
    className="force-hide-nav"
    style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: isDark ? "#000" : "#f8fafc",
      zIndex: 99999,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      overscrollBehavior: "none",
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "20px 15px",
        paddingTop: "calc(20px + env(safe-area-inset-top))",
        background: isDark ? "#000" : "#1b0b8c",
        flexShrink: 0,
      }}
    >
      <button
        onClick={onBack}
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
        }}
      >
        <ChevronLeft size={32} color="#fff" />
      </button>
      <span
        style={{
          color: "#fff",
          fontWeight: "900",
          letterSpacing: "1px",
          textTransform: "uppercase",
          fontSize: "1rem",
        }}
      >
        {title}
      </span>
      <div style={{ width: 32 }}></div>
    </div>
    {children}
  </div>
);

export default function LinemanResolutionFlow({
  report,
  currentUserId,
  onBack,
  onSuccess,
  t,
}) {
  const [step, setStep] = useState("camera"); // "camera" or "remarks"
  const [evidencePhoto, setEvidencePhoto] = useState(null);
  const [resolutionRemarks, setResolutionRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const webcamRef = useRef(null);

  const [resolvedLocation, setResolvedLocation] = useState({
    lat: null,
    lon: null,
    loading: false,
    error: false,
  });

  // Fetch GPS tag immediately when moving to remarks step
  useEffect(() => {
    if (step === "remarks") {
      const fetchFinalLocation = async () => {
        setResolvedLocation({
          lat: null,
          lon: null,
          loading: true,
          error: false,
        });
        try {
          const pos = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 10000,
          });
          setResolvedLocation({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            loading: false,
            error: false,
          });
        } catch (geoError) {
          console.warn("GPS Fetch Error on Resolve:", geoError);
          setResolvedLocation({
            lat: null,
            lon: null,
            loading: false,
            error: true,
          });
        }
      };
      fetchFinalLocation();
    }
  }, [step]);

  const captureEvidence = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setEvidencePhoto(imageSrc);
        setStep("remarks");
      }
    }
  }, [webcamRef]);

  const confirmStatusUpdate = async () => {
    setIsSubmitting(true);
    try {
      if (!evidencePhoto || !resolutionRemarks.trim())
        throw new Error("Missing photo or remarks.");

      const fileName = `resolved-${report.id}-${Date.now()}.jpg`;
      await supabase.storage
        .from("report_photos")
        .upload(fileName, base64ToBlob(evidencePhoto), {
          contentType: "image/jpeg",
        });
      const {
        data: { publicUrl },
      } = supabase.storage.from("report_photos").getPublicUrl(fileName);

      await supabase
        .from("reports")
        .update({
          status_id: 4, // Pending Verification
          resolved_photo_url: publicUrl,
          remarks: resolutionRemarks.trim(),
        })
        .eq("id", report.id);

      const assignmentPayload = { completion_at: new Date().toISOString() };

      if (resolvedLocation.lat && resolvedLocation.lon) {
        assignmentPayload.resolved_lat = resolvedLocation.lat;
        assignmentPayload.resolved_lon = resolvedLocation.lon;
      }

      await supabase
        .from("assignments")
        .update(assignmentPayload)
        .eq("report_id", report.id)
        .eq("lineman_id", currentUserId);

      await logSystemAction(
        "UPDATE_REPORT_STATUS",
        `Submitted report #${report.id} for verification.`,
      );
      onSuccess(); // Triggers success modal in parent
    } catch (e) {
      alert("Error submitting verification: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === "camera") {
    return (
      <FullScreenWrapper title="Proof of Resolution" onBack={onBack} isDark>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            position: "relative",
            width: "100%",
            background: "#111",
            overflow: "hidden",
          }}
        >
          <Webcam
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={{ facingMode: "environment" }}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
        <div
          style={{
            flexShrink: 0,
            background: "#e2e8f0",
            padding: "20px 15px",
            paddingBottom: "calc(30px + env(safe-area-inset-bottom))",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            borderRadius: "30px 30px 0 0",
          }}
        >
          <p style={{ margin: "0 0 15px 0", fontWeight: "900" }}>
            {t.captureTheFix || "Capture the Fix"}
          </p>
          <button
            onClick={captureEvidence}
            style={{
              width: 70,
              height: 70,
              borderRadius: "50%",
              background: "#cbd5e1",
              border: "5px solid #fff",
              boxShadow: "0 0 0 3px #000",
            }}
          />
        </div>
      </FullScreenWrapper>
    );
  }

  return (
    <FullScreenWrapper
      title="Resolution Remarks"
      onBack={() => setStep("camera")}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          display: "flex",
          flexDirection: "column",
          padding: "20px",
          paddingBottom: "calc(20px + env(safe-area-inset-bottom))",
        }}
      >
        <img
          src={evidencePhoto}
          alt="Proof"
          style={{
            width: "100%",
            height: "220px",
            flexShrink: 0,
            objectFit: "cover",
            borderRadius: "15px",
            marginBottom: "12px",
            border: "2px solid #cbd5e1",
          }}
        />

        <div
          style={{
            background: "#ffffff",
            padding: "12px",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "0.85rem",
            color: "#475569",
            boxShadow: "0 2px 5px rgba(0,0,0,0.02)",
          }}
        >
          <MapPin
            size={22}
            color={resolvedLocation.error ? "#ef4444" : "#1b0b8c"}
            style={{ flexShrink: 0 }}
          />
          <div style={{ flex: 1, overflow: "hidden" }}>
            <span
              style={{
                fontWeight: "900",
                color: "#1e293b",
                display: "block",
                marginBottom: "2px",
              }}
            >
              RESOLUTION GEO-TAG
            </span>
            {resolvedLocation.loading ? (
              <span style={{ fontStyle: "italic", color: "#64748b" }}>
                Fetching precise location...
              </span>
            ) : resolvedLocation.error ? (
              <span style={{ color: "#ef4444", fontWeight: "600" }}>
                GPS connection unavailable
              </span>
            ) : (
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: "0.95rem",
                  fontWeight: "bold",
                  color: "#16a34a",
                }}
              >
                {resolvedLocation.lat?.toFixed(5)},{" "}
                {resolvedLocation.lon?.toFixed(5)}
              </span>
            )}
          </div>
        </div>

        <textarea
          value={resolutionRemarks}
          onChange={(e) => setResolutionRemarks(e.target.value)}
          placeholder="Describe what was fixed..."
          style={{
            width: "100%",
            height: "140px",
            flexShrink: 0,
            padding: "15px",
            borderRadius: "15px",
            border: "1px solid #cbd5e1",
            fontSize: "1rem",
            resize: "none",
            marginBottom: "20px",
            boxSizing: "border-box",
            backgroundColor: "#ffffff",
            color: "#1e293b",
            fontFamily: "inherit",
          }}
        />
        <button
          onClick={confirmStatusUpdate}
          disabled={
            isSubmitting ||
            !resolutionRemarks.trim() ||
            resolvedLocation.loading
          }
          style={{
            marginTop: "auto",
            flexShrink: 0,
            background: "#1b0b8c",
            color: "#fff",
            padding: "18px",
            borderRadius: "30px",
            fontWeight: "900",
            border: "none",
            opacity:
              isSubmitting ||
              !resolutionRemarks.trim() ||
              resolvedLocation.loading
                ? 0.6
                : 1,
            transition: "opacity 0.2s",
          }}
        >
          {resolvedLocation.loading
            ? "Acquiring GPS..."
            : isSubmitting
              ? "Submitting..."
              : "Submit Verification"}
        </button>
      </div>
    </FullScreenWrapper>
  );
}
