import React, { useState, useEffect, useRef, useCallback } from "react";
import { translations } from "../components/translations";
import Webcam from "react-webcam";
import { Geolocation } from "@capacitor/geolocation";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ChevronLeft,
  CheckCircle,
  MapPin,
  Users,
  MessageSquare,
  AlertCircle,
} from "lucide-react";
import { supabase } from "../supabaseClient";
import { logSystemAction } from "../utils/logger";
import "../Lineman.css";

const base64ToBlob = (base64, mimeType = "image/jpeg") => {
  const byteCharacters = atob(base64.split(",")[1]);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
};

function LinemanReportDetail({ report, onBack, onReportUpdated }) {
  const currentLang = localStorage.getItem("appLanguage") || "English";
  const t = translations[currentLang];

  // NEW: Refs for scroll fixing
  const layoutRef = useRef(null);
  const scrollContainerRef = useRef(null);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const watchIdRef = useRef(null);
  const webcamRef = useRef(null);

  const linemanMarkerRef = useRef(null);
  const lineRef = useRef(null);

  const [activeStatus, setActiveStatus] = useState(
    report.report_statuses?.name?.toUpperCase() || "PENDING",
  );

  const [pendingStatusUpdate, setPendingStatusUpdate] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isRemarksOpen, setIsRemarksOpen] = useState(false);
  const [evidencePhoto, setEvidencePhoto] = useState(null);
  const [resolutionRemarks, setResolutionRemarks] = useState("");

  const [showMap, setShowMap] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [companions, setCompanions] = useState([]);
  const [adminRemarks, setAdminRemarks] = useState("");
  const [loadingAssignmentDetails, setLoadingAssignmentDetails] =
    useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);

  const [linemanLocation, setLinemanLocation] = useState(null);

  const isResolved =
    activeStatus === "RESOLVED" || activeStatus === "ADMIN VERIFIED";
  const isPendingVerification = activeStatus === "PENDING VERIFICATION";
  const isLocked = isResolved || isPendingVerification;

  // 🌟 FIX: Force parent containers to instantly snap to the top
  useEffect(() => {
    const resetScroll = () => {
      window.scrollTo(0, 0);

      // Forces the parent container to scroll to the top of this layout
      if (layoutRef.current) {
        layoutRef.current.scrollIntoView({
          behavior: "instant",
          block: "start",
        });
      }

      // Resets the internal scrollable box
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }

      // Explicitly resets the specific CSS classes that act as wrappers
      const parentTab = document.querySelector(".l-rt-tab");
      const appContainer = document.querySelector(".lineman-dashboard-layout");
      if (parentTab) parentTab.scrollTop = 0;
      if (appContainer) appContainer.scrollTop = 0;
    };

    resetScroll();

    // Fallback timer just in case React takes a millisecond to finish rendering
    const timer = setTimeout(resetScroll, 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const fetchAssignmentDetails = async () => {
      if (!report?.id) return;
      try {
        setLoadingAssignmentDetails(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setCurrentUserId(user?.id);

        const { data, error } = await supabase
          .from("assignments")
          .select(`lineman_id, admin_remarks, users ( first_name, last_name )`)
          .eq("report_id", report.id);
        if (error) throw error;
        if (data) {
          const otherLinemen = data
            .filter((a) => a.lineman_id !== user?.id)
            .map((a) =>
              `${a.users?.first_name || ""} ${a.users?.last_name || ""}`.trim(),
            )
            .filter(Boolean);
          setCompanions(otherLinemen);
          const myAssignment =
            data.find((a) => a.lineman_id === user?.id) || data[0];
          if (myAssignment && myAssignment.admin_remarks)
            setAdminRemarks(myAssignment.admin_remarks);
        }
      } catch (err) {
        console.error(err.message);
      } finally {
        setLoadingAssignmentDetails(false);
      }
    };
    fetchAssignmentDetails();
  }, [report.id]);

  useEffect(() => {
    let activeWatchId = null;

    const startNativeTracking = async () => {
      if (activeStatus === "IN PROGRESS" && currentUserId) {
        try {
          // 1. Initial Native GPS Ping
          const position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
          });
          setLinemanLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });

          await supabase
            .from("assignments")
            .update({
              current_lat: position.coords.latitude,
              current_lon: position.coords.longitude,
            })
            .eq("report_id", report.id)
            .eq("lineman_id", currentUserId);

          // 2. Start Native Background Watcher
          activeWatchId = await Geolocation.watchPosition(
            { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
            async (pos, err) => {
              if (pos) {
                setLinemanLocation({
                  lat: pos.coords.latitude,
                  lon: pos.coords.longitude,
                });
                await supabase
                  .from("assignments")
                  .update({
                    current_lat: pos.coords.latitude,
                    current_lon: pos.coords.longitude,
                  })
                  .eq("report_id", report.id)
                  .eq("lineman_id", currentUserId);
              }
            },
          );
          watchIdRef.current = activeWatchId;
        } catch (err) {
          console.warn("Native GPS failed:", err.message);
        }
      }
    };

    startNativeTracking();

    return () => {
      if (watchIdRef.current) {
        Geolocation.clearWatch({ id: watchIdRef.current });
        watchIdRef.current = null;
      }
    };
  }, [activeStatus, currentUserId, report.id]);

  useEffect(() => {
    if (!showMap) {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        linemanMarkerRef.current = null;
        lineRef.current = null;
      }
      return;
    }
    const lat = report.latitude ? parseFloat(report.latitude) : 16.7805;
    const lon = report.longitude ? parseFloat(report.longitude) : 121.6508;
    setTimeout(() => {
      if (!mapContainerRef.current) return;
      const customIcon = L.divIcon({
        className: "custom-leaflet-marker",
        html: `<div style="background-color: #ea4335; width: 22px; height: 22px; border-radius: 50%; border: 4px solid #ffffff; box-shadow: 0 4px 8px rgba(0,0,0,0.4);"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      if (!mapRef.current) {
        mapRef.current = L.map(mapContainerRef.current, {
          zoomControl: false,
        }).setView([lat, lon], 16);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap",
          maxZoom: 19,
        }).addTo(mapRef.current);
      } else {
        mapRef.current.setView([lat, lon], 16);
      }
      if (markerRef.current) markerRef.current.remove();
      markerRef.current = L.marker([lat, lon], { icon: customIcon }).addTo(
        mapRef.current,
      );
    }, 100);
  }, [report, showMap]);

  useEffect(() => {
    if (!showMap || !linemanLocation || !report.latitude || !report.longitude)
      return;

    let isDrawing = true;

    const drawMapElements = async () => {
      if (!isDrawing) return;

      if (!mapRef.current) {
        setTimeout(drawMapElements, 100);
        return;
      }

      const linemanLat = parseFloat(linemanLocation.lat);
      const linemanLon = parseFloat(linemanLocation.lon);
      const reportLat = parseFloat(report.latitude);
      const reportLon = parseFloat(report.longitude);

      const linemanIcon = L.divIcon({
        className: "live-tracker-icon",
        html: `<div style="background-color: #10b981; width: 26px; height: 26px; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 0 15px rgba(16, 185, 129, 0.8); display: flex; align-items: center; justify-content: center; font-size: 14px; animation: pulse-ring 2s infinite;">⚡</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });

      if (!linemanMarkerRef.current) {
        linemanMarkerRef.current = L.marker([linemanLat, linemanLon], {
          icon: linemanIcon,
          zIndexOffset: 1000,
        }).addTo(mapRef.current);
      } else {
        linemanMarkerRef.current.setLatLng([linemanLat, linemanLon]);
      }

      try {
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${linemanLon},${linemanLat};${reportLon},${reportLat}?overview=full&geometries=geojson`,
        );
        const data = await response.json();

        if (!isDrawing) return;

        let routePoints = [];

        if (data.routes && data.routes[0]) {
          routePoints = data.routes[0].geometry.coordinates.map((coord) => [
            coord[1],
            coord[0],
          ]);
        } else {
          routePoints = [
            [linemanLat, linemanLon],
            [reportLat, reportLon],
          ];
        }

        if (!lineRef.current) {
          lineRef.current = L.polyline(routePoints, {
            color: "#1b0b8c",
            weight: 5,
            opacity: 0.8,
          }).addTo(mapRef.current);

          mapRef.current.fitBounds(lineRef.current.getBounds(), {
            padding: [50, 50],
            maxZoom: 18,
          });
        } else {
          lineRef.current.setLatLngs(routePoints);
        }
      } catch (error) {
        console.error("Routing failed, falling back to straight line:", error);
        if (!isDrawing) return;

        const fallbackPoints = [
          [linemanLat, linemanLon],
          [reportLat, reportLon],
        ];
        if (!lineRef.current) {
          lineRef.current = L.polyline(fallbackPoints, {
            color: "#1b0b8c",
            weight: 5,
            dashArray: "10, 10",
            opacity: 0.8,
          }).addTo(mapRef.current);
          mapRef.current.fitBounds(lineRef.current.getBounds(), {
            padding: [50, 50],
            maxZoom: 18,
          });
        } else {
          lineRef.current.setLatLngs(fallbackPoints);
        }
      }
    };

    drawMapElements();

    return () => {
      isDrawing = false;
    };
  }, [showMap, linemanLocation, report.latitude, report.longitude]);

  useEffect(() => {
    const navBar = document.querySelector(".bottom-nav-wrapper");
    if (navBar) navBar.style.display = "none";
    return () => {
      if (navBar) navBar.style.display = "";
    };
  }, []);

  const handleVerifyClick = () => {
    if (isLocked) return;
    setPendingStatusUpdate("PENDING VERIFICATION");
    setIsCameraOpen(true);
  };

  const captureEvidence = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setEvidencePhoto(imageSrc);
        setIsCameraOpen(false);
        setIsRemarksOpen(true);
      }
    }
  }, [webcamRef]);

  const confirmStatusUpdate = async () => {
    setIsSubmitting(true);
    try {
      if (!evidencePhoto) throw new Error("Evidence photo is missing.");
      if (!resolutionRemarks.trim())
        throw new Error("Remarks are required to verify resolution.");

      const fileName = `resolved-${report.id}-${Date.now()}.jpg`;
      const imageBlob = base64ToBlob(evidencePhoto);

      const { error: uploadError } = await supabase.storage
        .from("report_photos")
        .upload(fileName, imageBlob, { contentType: "image/jpeg" });

      if (uploadError) throw new Error("Failed to upload evidence photo.");

      const { data: publicUrlData } = supabase.storage
        .from("report_photos")
        .getPublicUrl(fileName);

      // Status 4 = PENDING VERIFICATION
      const updatePayload = {
        status_id: 4,
        resolved_photo_url: publicUrlData.publicUrl,
        remarks: resolutionRemarks.trim(),
      };

      const { data, error } = await supabase
        .from("reports")
        .update(updatePayload)
        .eq("id", report.id)
        .select();

      if (error) throw error;
      if (!data || data.length === 0)
        throw new Error("Update blocked by Supabase!");

      // Update the completion_at timestamp in assignments
      await supabase
        .from("assignments")
        .update({ completion_at: new Date().toISOString() })
        .eq("report_id", report.id);

      await logSystemAction(
        "UPDATE_REPORT_STATUS",
        `Lineman submitted report #${report.id} for verification.`,
      );

      setActiveStatus("PENDING VERIFICATION");
      setShowSuccessModal(true);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
      setIsRemarksOpen(false);
      setPendingStatusUpdate(null);
    }
  };

  if (showMap) {
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          background: "#f8fafc",
          zIndex: 99999,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <style>{`
          @keyframes pulse-ring {
            0% { transform: scale(0.85); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 12px rgba(16, 185, 129, 0); }
            100% { transform: scale(0.85); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
          }
        `}</style>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "20px 15px",
            background: "#1b0b8c",
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setShowMap(false)}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <ChevronLeft size={32} color="#fff" />
          </button>
          <span
            style={{
              color: "#fff",
              fontWeight: "900",
              marginLeft: "10px",
              letterSpacing: "1px",
              fontSize: "1rem",
            }}
          >
            {t.locationMap}
          </span>
        </div>
        <div style={{ flex: 1, width: "100%", position: "relative" }}>
          <div
            style={{
              position: "absolute",
              bottom: "30px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 1000,
              background: "rgba(255,255,255,0.95)",
              padding: "10px 15px",
              borderRadius: "30px",
              boxShadow: "0 5px 15px rgba(0,0,0,0.1)",
              display: "flex",
              gap: "15px",
              fontWeight: "bold",
              fontSize: "0.8rem",
              color: "#334155",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  background: "#ea4335",
                  borderRadius: "50%",
                  border: "2px solid #ffffff",
                }}
              ></div>
              Issue
            </div>
            {activeStatus === "IN PROGRESS" && (
              <div
                style={{ display: "flex", alignItems: "center", gap: "5px" }}
              >
                <div
                  style={{
                    width: "12px",
                    height: "12px",
                    background: "#10b981",
                    borderRadius: "50%",
                    border: "2px solid #fff",
                    boxShadow: "0 0 5px rgba(16,185,129,0.5)",
                  }}
                ></div>
                You
              </div>
            )}
          </div>

          <div
            ref={mapContainerRef}
            style={{ position: "absolute", top: 0, bottom: 0, width: "100%" }}
          />
        </div>
      </div>
    );
  }

  if (isCameraOpen) {
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          background: "#000",
          zIndex: 99999,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 15px",
            background: "#000",
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => {
              setIsCameraOpen(false);
              setPendingStatusUpdate(null);
            }}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <ChevronLeft size={32} color="#fff" />
          </button>
          <span
            style={{
              color: "#fff",
              fontWeight: "bold",
              textTransform: "uppercase",
            }}
          >
            Proof of Resolution
          </span>
          <div style={{ width: 32 }}></div>
        </div>
        <div
          style={{
            flex: 1,
            position: "relative",
            width: "100%",
            background: "#111",
            overflow: "hidden",
          }}
        >
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={{ facingMode: "environment" }}
            mirrored={false}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        </div>
        <div
          style={{
            background: "#e2e8f0",
            padding: "20px 15px 40px 15px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            flexShrink: 0,
            borderTopLeftRadius: "30px",
            borderTopRightRadius: "30px",
          }}
        >
          <p
            style={{
              margin: "0 0 15px 0",
              color: "#111",
              fontWeight: "900",
              fontSize: "0.9rem",
            }}
          >
            {t.captureTheFix}
          </p>
          <button
            onClick={captureEvidence}
            style={{
              width: "70px",
              height: "70px",
              borderRadius: "50%",
              background: "#cbd5e1",
              border: "5px solid #fff",
              boxShadow: "0 0 0 3px #000",
              cursor: "pointer",
            }}
          ></button>
        </div>
      </div>
    );
  }

  if (isRemarksOpen) {
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          background: "#f8fafc",
          zIndex: 99999,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 15px",
            background: "#1b0b8c",
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => {
              setIsRemarksOpen(false);
              setIsCameraOpen(true);
            }}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <ChevronLeft size={32} color="#fff" />
          </button>
          <span
            style={{
              color: "#fff",
              fontWeight: "900",
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            Resolution Remarks
          </span>
          <div style={{ width: 32 }}></div>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: "20px",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "220px",
              borderRadius: "15px",
              overflow: "hidden",
              marginBottom: "20px",
              boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
              border: "2px solid #cbd5e1",
            }}
          >
            <img
              src={evidencePhoto}
              alt="Resolution Proof"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>

          <label
            style={{
              color: "#1e293b",
              fontWeight: "900",
              marginBottom: "10px",
              fontSize: "0.95rem",
              textTransform: "uppercase",
            }}
          >
            Action Taken / Remarks:
          </label>
          <textarea
            value={resolutionRemarks}
            onChange={(e) => setResolutionRemarks(e.target.value)}
            placeholder="Describe exactly what was fixed..."
            style={{
              width: "100%",
              height: "140px",
              padding: "15px",
              borderRadius: "15px",
              border: "1px solid #cbd5e1",
              fontSize: "1rem",
              resize: "none",
              marginBottom: "20px",
              boxSizing: "border-box",
              fontFamily: "inherit",
            }}
          />

          <button
            onClick={confirmStatusUpdate}
            disabled={isSubmitting || !resolutionRemarks.trim()}
            style={{
              marginTop: "auto",
              backgroundColor: "#1b0b8c",
              color: "#fff",
              padding: "18px",
              borderRadius: "30px",
              fontWeight: "900",
              fontSize: "1rem",
              border: "none",
              cursor:
                isSubmitting || !resolutionRemarks.trim()
                  ? "not-allowed"
                  : "pointer",
              opacity: isSubmitting || !resolutionRemarks.trim() ? 0.6 : 1,
              textTransform: "uppercase",
              letterSpacing: "1px",
              boxShadow: "0 6px 15px rgba(27, 11, 140, 0.2)",
            }}
          >
            {isSubmitting
              ? "Submitting for Verification..."
              : "Submit for Verification"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={layoutRef}
      className="detail-layout page-transition"
      style={{ overscrollBehavior: "none" }}
    >
      {showSuccessModal && (
        <div className="success-modal-overlay">
          <div className="success-modal-box">
            <div className="success-modal-header">
              <h2>{t.updatedTitle}</h2>
            </div>
            <div className="success-modal-body">
              <p>{t.statusUpdatedText} PENDING VERIFICATION!</p>
              <button
                className="success-modal-btn"
                onClick={() => {
                  setShowSuccessModal(false);
                  if (onReportUpdated) onReportUpdated();
                }}
              >
                OK!
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        ref={scrollContainerRef}
        className="detail-scrollable-content"
        style={{ padding: "16px 16px 180px 16px" }}
      >
        <div
          style={{
            position: "sticky",
            top: 0,
            margin: "-16px -16px 20px -16px",
            padding: "calc(20px + env(safe-area-inset-top)) 16px 18px 16px",
            background: "rgba(255, 255, 255, 0.92)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            zIndex: 50,
            borderBottom: "1px solid rgba(0,0,0,0.05)",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <button
            onClick={onBack}
            className="back-btn"
            style={{ flexShrink: 0 }}
          >
            <ChevronLeft size={28} strokeWidth={3} />
          </button>
          <h2
            className="text-navy"
            style={{
              margin: 0,
              fontSize: "1.3rem",
              fontWeight: "900",
              letterSpacing: "1px",
              textTransform: "uppercase",
              lineHeight: 1.2,
            }}
          >
            {report.report_types?.name || t.reportDetailsTitle}
          </h2>
        </div>

        {isLocked && (
          <div
            style={{
              margin: "0 0 15px 0",
              padding: "16px",
              borderRadius: "15px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              background: isResolved ? "#fef2f2" : "#f0fdfa",
              color: isResolved ? "#ef4444" : "#0d9488",
              border: isResolved ? "2px solid #fca5a5" : "2px solid #5eead4",
              boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
            }}
          >
            {isResolved ? (
              <CheckCircle size={22} strokeWidth={2.5} />
            ) : (
              <AlertCircle size={22} strokeWidth={2.5} />
            )}
            <span
              style={{
                fontWeight: "900",
                fontSize: "0.95rem",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                textAlign: "center",
              }}
            >
              {isResolved ? t.reportResolved : "Waiting for Admin Verification"}
            </span>
          </div>
        )}

        <div className="detail-photo-section">
          {report.photo_url ? (
            <img
              src={report.photo_url}
              alt="Report issue"
              className="detail-photo"
            />
          ) : (
            <div className="no-photo">{t.noPhotoProvided}</div>
          )}
        </div>

        <div className="detail-info-section">
          <p>
            <strong>{t.descriptionLabel}</strong>{" "}
            {report.description || t.noDescProvided}
          </p>
          <p>
            <strong>{t.landmarkLabel}</strong> {report.landmark || "N/A"}
          </p>
        </div>

        <div
          className="detail-coords-section"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            marginTop: "15px",
          }}
        >
          {adminRemarks && (
            <div
              style={{
                background: "#fffbeb",
                padding: "16px",
                borderRadius: "12px",
                boxShadow: "0 4px 15px rgba(0,0,0,0.03)",
                marginBottom: "5px",
                border: "1px solid #fde68a",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "8px",
                }}
              >
                <MessageSquare size={20} color="#b45309" />
                <h3
                  style={{
                    margin: 0,
                    fontSize: "0.95rem",
                    fontWeight: "900",
                    color: "#b45309",
                    letterSpacing: "0.5px",
                  }}
                >
                  {t.adminRemarks}
                </h3>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.9rem",
                  color: "#78350f",
                  fontWeight: "600",
                  lineHeight: "1.4",
                }}
              >
                {adminRemarks}
              </p>
            </div>
          )}

          <button
            onClick={() => setShowMap(true)}
            style={{
              width: "100%",
              padding: "16px",
              backgroundColor: "#1b0b8c",
              color: "#ffffff",
              border: "none",
              borderRadius: "50px",
              fontWeight: "900",
              fontSize: "1rem",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "10px",
              cursor: "pointer",
              boxShadow: "0 6px 15px rgba(27, 11, 140, 0.2)",
              transition: "transform 0.1s",
            }}
            onMouseDown={(e) =>
              (e.currentTarget.style.transform = "scale(0.98)")
            }
            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            <MapPin size={22} /> {t.viewLocationMap}
          </button>

          <div className="coords-row" style={{ marginTop: "10px" }}>
            <span>
              <strong>LO:</strong> {report.longitude || "N/A"}
            </span>
            <span>
              <strong>LA:</strong> {report.latitude || "N/A"}
            </span>
          </div>

          <div
            style={{
              background: "#ffffff",
              padding: "16px",
              borderRadius: "12px",
              boxShadow: "0 4px 15px rgba(0,0,0,0.03)",
              marginTop: "10px",
              border: "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "10px",
              }}
            >
              <Users size={20} color="#1b0b8c" />
              <h3
                style={{
                  margin: 0,
                  fontSize: "0.95rem",
                  fontWeight: "900",
                  color: "#1b0b8c",
                  letterSpacing: "0.5px",
                }}
              >
                {t.assignedCompanions}
              </h3>
            </div>
            {loadingAssignmentDetails ? (
              <p
                style={{
                  margin: 0,
                  fontSize: "0.85rem",
                  color: "#64748b",
                  fontStyle: "italic",
                }}
              >
                {t.loadingTeam}
              </p>
            ) : companions.length > 0 ? (
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                {companions.map((comp, idx) => (
                  <li
                    key={idx}
                    style={{
                      fontSize: "0.9rem",
                      color: "#334155",
                      fontWeight: "700",
                    }}
                  >
                    {comp}
                  </li>
                ))}
              </ul>
            ) : (
              <p
                style={{
                  margin: 0,
                  fontSize: "0.85rem",
                  color: "#64748b",
                  fontWeight: "600",
                }}
              >
                {t.onlyLineman}
              </p>
            )}
          </div>
        </div>
      </div>

      <div
        className="status-action-bar"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          touchAction: "none",
          display: "flex",
        }}
      >
        <button
          className={`status-icon-btn btn-resolved ${
            isLocked ? "active active-resolved" : ""
          }`}
          onClick={handleVerifyClick}
          disabled={isLocked}
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "center",
            gap: "8px",
            ...(isLocked ? { opacity: 0.5, cursor: "not-allowed" } : {}),
          }}
        >
          <CheckCircle size={28} className="status-icon" />
          <span style={{ fontSize: "1.05rem" }}>Submit for Verification</span>
        </button>
      </div>
    </div>
  );
}

export default LinemanReportDetail;
