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
  PlayCircle,
  Clock,
  ClipboardList,
} from "lucide-react";
import { supabase } from "../supabaseClient";
import { logSystemAction } from "../utils/logger";
import "../Lineman.css";

const base64ToBlob = (base64, mimeType = "image/jpeg") => {
  const byteCharacters = atob(base64.split(",")[1]);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++)
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
};

// Reusable Full-Screen Wrapper for Map, Camera, and Remarks
const FullScreenWrapper = ({ title, onBack, isDark, children }) => (
  <div
    style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100vw",
      height: "100vh",
      background: isDark ? "#000" : "#f8fafc",
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

function LinemanReportDetail({ report, onBack, onReportUpdated }) {
  const t = translations[localStorage.getItem("appLanguage") || "English"];
  const mapContainerRef = useRef(null),
    mapRef = useRef(null),
    lineRef = useRef(null);
  const markerRef = useRef(null),
    linemanMarkerRef = useRef(null),
    webcamRef = useRef(null),
    watchIdRef = useRef(null);

  const [activeStatus, setActiveStatus] = useState(
    report.report_statuses?.name?.toUpperCase() || "PENDING",
  );
  const [successModal, setSuccessModal] = useState(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isRemarksOpen, setIsRemarksOpen] = useState(false);
  const [evidencePhoto, setEvidencePhoto] = useState(null);
  const [resolutionRemarks, setResolutionRemarks] = useState("");
  const [showMap, setShowMap] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDelayModal, setShowDelayModal] = useState(false);
  const [delayReason, setDelayReason] = useState("");
  const [isSubmittingDelay, setIsSubmittingDelay] = useState(false);

  const [companions, setCompanions] = useState([]);
  const [adminRemarks, setAdminRemarks] = useState("");
  const [assignedTeamName, setAssignedTeamName] = useState("Loading...");
  const [currentUserId, setCurrentUserId] = useState(null);
  const [linemanLocation, setLinemanLocation] = useState(null);
  const [hasOtherInProgress, setHasOtherInProgress] = useState(false);
  const [isCheckingActive, setIsCheckingActive] = useState(true);

  const isResolved =
    activeStatus === "RESOLVED" || activeStatus === "ADMIN VERIFIED";
  const isLocked = isResolved || activeStatus === "PENDING VERIFICATION";

  // Hide the global navigation bar when this detail screen is open
  useEffect(() => {
    const navBar = document.querySelector(".bottom-nav-wrapper");
    if (navBar) navBar.style.display = "none";
    return () => {
      if (navBar) navBar.style.display = "";
    };
  }, []);

  // 1. Real-time Status Sync
  useEffect(() => {
    const channel = supabase
      .channel(`public:lineman_report_${report.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "reports",
          filter: `id=eq.${report.id}`,
        },
        async () => {
          const { data } = await supabase
            .from("reports")
            .select("report_statuses(name)")
            .eq("id", report.id)
            .single();
          if (data)
            setActiveStatus(
              data.report_statuses?.name?.toUpperCase() || "PENDING",
            );
        },
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [report.id]);

  // 2. Initial Data Fetch (Team & Active Lock Check)
  useEffect(() => {
    let isMounted = true;
    const fetchInitData = async () => {
      try {
        setIsCheckingActive(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        setCurrentUserId(user.id);

        const { data: assigns } = await supabase
          .from("assignments")
          .select(`lineman_id, admin_remarks, users(first_name, last_name)`)
          .eq("report_id", report.id);
        if (assigns && assigns.length > 0) {
          setCompanions([
            ...new Set(
              assigns
                .map((a) =>
                  `${a.users?.first_name || ""} ${a.users?.last_name || ""}`.trim(),
                )
                .filter(Boolean),
            ),
          ]);
          setAdminRemarks(
            assigns.find((a) => a.lineman_id === user.id)?.admin_remarks ||
              assigns[0].admin_remarks ||
              "",
          );

          const { data: teams } = await supabase
            .from("lineman_teams")
            .select("*");
          const myTeam = teams?.find(
            (t) =>
              t.team_leader === assigns[0].lineman_id ||
              (Array.isArray(t.team_members)
                ? t.team_members.some(
                    (m) =>
                      m === assigns[0].lineman_id ||
                      m?.id === assigns[0].lineman_id,
                  )
                : t.team_members?.includes(assigns[0].lineman_id)),
          );
          setAssignedTeamName(myTeam ? myTeam.team_name : "Assigned Team");
        }

        if (activeStatus === "ON QUEUE") {
          const { data: activeTasks } = await supabase
            .from("assignments")
            .select("report_id")
            .eq("lineman_id", user.id);
          if (activeTasks?.length > 0) {
            const { data: activeRep } = await supabase
              .from("reports")
              .select("id, report_statuses(name)")
              .in(
                "id",
                activeTasks.map((a) => a.report_id),
              );
            if (isMounted)
              setHasOtherInProgress(
                !!activeRep?.some(
                  (r) =>
                    r.id !== report.id &&
                    r.report_statuses?.name?.toUpperCase() === "IN PROGRESS",
                ),
              );
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setIsCheckingActive(false);
      }
    };
    fetchInitData();
    return () => {
      isMounted = false;
    };
  }, [report.id, activeStatus]);

  // 3. Live Tracking
  useEffect(() => {
    if (activeStatus !== "IN PROGRESS" || !currentUserId) return;
    const track = async () => {
      try {
        const updateLoc = async (pos) => {
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
        };
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
        });
        await updateLoc(pos);
        watchIdRef.current = await Geolocation.watchPosition(
          { enableHighAccuracy: true, maximumAge: 5000 },
          (pos) => pos && updateLoc(pos),
        );
      } catch (e) {
        console.warn("GPS failed", e);
      }
    };
    track();
    return () =>
      watchIdRef.current && Geolocation.clearWatch({ id: watchIdRef.current });
  }, [activeStatus, currentUserId, report.id]);

  // 4. Map & Routing Rendering
  useEffect(() => {
    if (!showMap || !mapContainerRef.current) {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current =
          markerRef.current =
          linemanMarkerRef.current =
          lineRef.current =
            null;
      }
      return;
    }
    const lat = parseFloat(report.latitude || 16.7805),
      lon = parseFloat(report.longitude || 121.6508);
    const targetIcon = L.divIcon({
      className: "marker",
      html: `<div style="background:#ea4335;width:22px;height:22px;border-radius:50%;border:4px solid #fff;box-shadow:0 4px 8px rgba(0,0,0,0.4)"></div>`,
      iconSize: [22, 22],
    });

    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        zoomControl: false,
      }).setView([lat, lon], 16);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(
        mapRef.current,
      );
    }
    if (!markerRef.current)
      markerRef.current = L.marker([lat, lon], { icon: targetIcon }).addTo(
        mapRef.current,
      );

    if (linemanLocation) {
      const lLat = parseFloat(linemanLocation.lat),
        lLon = parseFloat(linemanLocation.lon);
      const lIcon = L.divIcon({
        html: `<div style="background:#10b981;width:26px;height:26px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 15px rgba(16,185,129,0.8);display:flex;align-items:center;justify-content:center;font-size:14px">⚡</div>`,
        iconSize: [26, 26],
      });

      if (!linemanMarkerRef.current)
        linemanMarkerRef.current = L.marker([lLat, lLon], {
          icon: lIcon,
          zIndexOffset: 1000,
        }).addTo(mapRef.current);
      else linemanMarkerRef.current.setLatLng([lLat, lLon]);

      fetch(
        `https://router.project-osrm.org/route/v1/driving/${lLon},${lLat};${lon},${lat}?overview=full&geometries=geojson`,
      )
        .then((r) => r.json())
        .then((data) => {
          const pts = data.routes?.[0]
            ? data.routes[0].geometry.coordinates.map((c) => [c[1], c[0]])
            : [
                [lLat, lLon],
                [lat, lon],
              ];
          if (!lineRef.current) {
            lineRef.current = L.polyline(pts, {
              color: "#1b0b8c",
              weight: 5,
              opacity: 0.8,
            }).addTo(mapRef.current);
            mapRef.current.fitBounds(lineRef.current.getBounds(), {
              padding: [50, 50],
            });
          } else lineRef.current.setLatLngs(pts);
        })
        .catch(() => {
          const fallback = [
            [lLat, lLon],
            [lat, lon],
          ];
          if (!lineRef.current)
            lineRef.current = L.polyline(fallback, {
              color: "#1b0b8c",
              weight: 5,
              dashArray: "10,10",
            }).addTo(mapRef.current);
          else lineRef.current.setLatLngs(fallback);
        });
    }
  }, [showMap, report, linemanLocation]);

  // Handlers
  const handleStartClick = async () => {
    if (hasOtherInProgress || isCheckingActive) return;
    setIsSubmitting(true);
    try {
      const { data: dbCheck } = await supabase
        .from("assignments")
        .select("report_id")
        .eq("lineman_id", currentUserId);
      if (dbCheck?.length > 0) {
        const { data: act } = await supabase
          .from("reports")
          .select("id, report_statuses(name)")
          .in(
            "id",
            dbCheck.map((a) => a.report_id),
          );
        if (
          act?.some(
            (r) =>
              r.id !== report.id &&
              r.report_statuses?.name?.toUpperCase() === "IN PROGRESS",
          )
        ) {
          setHasOtherInProgress(true);
          return alert("Finish your active task first.");
        }
      }
      const { data: st } = await supabase
        .from("report_statuses")
        .select("id")
        .ilike("name", "IN PROGRESS")
        .single();
      await supabase
        .from("reports")
        .update({ status_id: st.id })
        .eq("id", report.id);
      await supabase
        .from("assignments")
        .update({ inprogress_at: new Date().toISOString() })
        .eq("report_id", report.id);
      await logSystemAction("START_REPORT", `Started report #${report.id}.`);
      setActiveStatus("IN PROGRESS");
    } catch (e) {
      alert(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyClick = () => {
    if (isLocked) return;
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
          status_id: 4,
          resolved_photo_url: publicUrl,
          remarks: resolutionRemarks.trim(),
        })
        .eq("id", report.id);
      await supabase
        .from("assignments")
        .update({ completion_at: new Date().toISOString() })
        .eq("report_id", report.id);
      await logSystemAction(
        "UPDATE_REPORT_STATUS",
        `Submitted report #${report.id} for verification.`,
      );

      setActiveStatus("PENDING VERIFICATION");
      setSuccessModal({
        title: t.updatedTitle || "UPDATED",
        msg: `${t.statusUpdatedText || "Status successfully updated to"} PENDING VERIFICATION!`,
      });
    } catch (e) {
      alert(e.message);
    } finally {
      setIsSubmitting(false);
      setIsRemarksOpen(false);
    }
  };

  // 🌟 FIXED: Implemented precise column matching (residents_id) and protected error boundary
  const handleDelaySubmit = async () => {
    if (!delayReason.trim()) return;
    setIsSubmittingDelay(true);
    try {
      // 1. Update the Report table
      const { error: updateError } = await supabase
        .from("reports")
        .update({ delay_reason: delayReason.trim() })
        .eq("id", report.id);

      if (updateError) throw updateError;

      // 2. Safely grab the resident ID
      const { data: repData } = await supabase
        .from("reports")
        .select("residents_id")
        .eq("id", report.id)
        .single();

      // 3. Post to notifications using residents_id (Matches schema exactly)
      if (repData?.residents_id) {
        const { error: notifError } = await supabase
          .from("notifications")
          .insert([
            {
              residents_id: repData.residents_id,
              title: "Report Delay Notice",
              message: `Delay reported for your issue (${report.report_types?.name || "Report #" + report.id}). Reason: ${delayReason.trim()}`,
            },
          ]);

        if (notifError) {
          console.error("Supabase Notification Error:", notifError.message);
        }
      }

      await logSystemAction(
        "REPORT_DELAYED",
        `Delayed report #${report.id}: ${delayReason.trim()}`,
      );

      setShowDelayModal(false);
      setDelayReason("");
      setSuccessModal({
        title: "NOTICE SENT",
        msg: "Delay notice sent successfully!",
      });
    } catch (e) {
      alert("Failed to submit delay: " + e.message);
    } finally {
      setIsSubmittingDelay(false);
    }
  };

  // Render Full Screen Overlays
  if (showMap)
    return (
      <FullScreenWrapper title={t.locationMap} onBack={() => setShowMap(false)}>
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
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <div
                style={{
                  width: 12,
                  height: 12,
                  background: "#ea4335",
                  borderRadius: "50%",
                  border: "2px solid #fff",
                }}
              />{" "}
              Issue
            </div>
            {activeStatus === "IN PROGRESS" && (
              <div
                style={{ display: "flex", alignItems: "center", gap: "5px" }}
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    background: "#10b981",
                    borderRadius: "50%",
                    border: "2px solid #fff",
                  }}
                />{" "}
                You
              </div>
            )}
          </div>
          <div
            ref={mapContainerRef}
            style={{ position: "absolute", top: 0, bottom: 0, width: "100%" }}
          />
        </div>
      </FullScreenWrapper>
    );

  if (isCameraOpen)
    return (
      <FullScreenWrapper
        title="Proof of Resolution"
        onBack={() => setIsCameraOpen(false)}
        isDark
      >
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
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={{ facingMode: "environment" }}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
        <div
          style={{
            background: "#e2e8f0",
            padding: "20px 15px 40px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            borderRadius: "30px 30px 0 0",
          }}
        >
          <p style={{ margin: "0 0 15px 0", fontWeight: "900" }}>
            {t.captureTheFix}
          </p>
          <button
            onClick={() => {
              setEvidencePhoto(webcamRef.current.getScreenshot());
              setIsCameraOpen(false);
              setIsRemarksOpen(true);
            }}
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

  if (isRemarksOpen)
    return (
      <FullScreenWrapper
        title="Resolution Remarks"
        onBack={() => {
          setIsRemarksOpen(false);
          setIsCameraOpen(true);
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: "20px",
          }}
        >
          <img
            src={evidencePhoto}
            alt="Proof"
            style={{
              width: "100%",
              height: "220px",
              objectFit: "cover",
              borderRadius: "15px",
              marginBottom: "20px",
              border: "2px solid #cbd5e1",
            }}
          />
          <textarea
            value={resolutionRemarks}
            onChange={(e) => setResolutionRemarks(e.target.value)}
            placeholder="Describe what was fixed..."
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
              backgroundColor: "#ffffff",
              color: "#1e293b",
              fontFamily: "inherit",
            }}
          />
          <button
            onClick={confirmStatusUpdate}
            disabled={isSubmitting || !resolutionRemarks.trim()}
            style={{
              marginTop: "auto",
              background: "#1b0b8c",
              color: "#fff",
              padding: "18px",
              borderRadius: "30px",
              fontWeight: "900",
              border: "none",
              opacity: isSubmitting || !resolutionRemarks.trim() ? 0.6 : 1,
            }}
          >
            {isSubmitting ? "Submitting..." : "Submit Verification"}
          </button>
        </div>
      </FullScreenWrapper>
    );

  // Main UI
  return (
    <div
      className="detail-layout page-transition"
      style={{
        backgroundColor: "#f8fafc",
        animation: "containerTransformExp 0.4s forwards",
      }}
    >
      {/* Reusable Modals */}
      {successModal && (
        <div
          className="success-modal-overlay"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            className="success-modal-box"
            style={{
              background: "#ffffff",
              width: "85%",
              maxWidth: "340px",
              borderRadius: "24px",
              overflow: "hidden",
              padding: "0",
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            }}
          >
            <div
              style={{
                padding: "24px 20px 10px 20px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <CheckCircle
                size={56}
                color="#10b981"
                style={{ marginBottom: "16px" }}
              />
              <h2
                style={{
                  margin: "0 0 10px 0",
                  color: "#064e3b",
                  fontSize: "1.4rem",
                  fontWeight: "900",
                  textAlign: "center",
                  textTransform: "uppercase",
                }}
              >
                {successModal.title}
              </h2>
            </div>
            <div
              style={{
                padding: "0 24px 24px 24px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <p
                style={{
                  margin: "0 0 24px 0",
                  color: "#475569",
                  fontSize: "0.95rem",
                  textAlign: "center",
                  lineHeight: "1.5",
                  fontWeight: "600",
                }}
              >
                {successModal.msg}
              </p>
              <button
                onClick={() => {
                  setSuccessModal(null);
                  if (onReportUpdated) onReportUpdated();
                }}
                style={{
                  width: "100%",
                  padding: "16px",
                  backgroundColor: "#10b981",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "50px",
                  fontWeight: "900",
                  fontSize: "1.05rem",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  boxShadow: "0 4px 15px rgba(16, 185, 129, 0.3)",
                  transition: "transform 0.1s",
                }}
                onMouseDown={(e) =>
                  (e.currentTarget.style.transform = "scale(0.97)")
                }
                onMouseUp={(e) =>
                  (e.currentTarget.style.transform = "scale(1)")
                }
              >
                OK!
              </button>
            </div>
          </div>
        </div>
      )}

      {showDelayModal && (
        <div className="success-modal-overlay">
          <div
            className="success-modal-box"
            style={{ borderTop: "6px solid #ef4444" }}
          >
            <AlertCircle
              size={42}
              color="#ef4444"
              style={{ margin: "15px auto 5px" }}
            />
            <h2
              style={{
                color: "#ef4444",
                textAlign: "center",
                margin: 0,
                fontSize: "1.3rem",
              }}
            >
              REPORT DELAY
            </h2>
            <div className="success-modal-body" style={{ padding: "15px" }}>
              <p
                style={{
                  margin: "0 0 15px 0",
                  color: "#475569",
                  fontSize: "0.9rem",
                  textAlign: "center",
                  fontWeight: "600",
                }}
              >
                Enter reason for delay to notify admin and resident.
              </p>
              <textarea
                value={delayReason}
                onChange={(e) => setDelayReason(e.target.value)}
                placeholder="e.g., Heavy rain..."
                style={{
                  width: "100%",
                  height: "100px",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#fff",
                  color: "#1e293b",
                  resize: "none",
                  marginBottom: "20px",
                  boxSizing: "border-box",
                }}
              />
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => setShowDelayModal(false)}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    background: "#f1f5f9",
                    fontWeight: "bold",
                    color: "#475569",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelaySubmit}
                  disabled={isSubmittingDelay || !delayReason.trim()}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#ef4444",
                    color: "#fff",
                    fontWeight: "bold",
                  }}
                >
                  {isSubmittingDelay ? "Sending..." : "Submit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          padding: "16px 16px 180px 16px",
          overflowY: "auto",
          height: "100%",
        }}
      >
        {/* Header */}
        <div
          style={{
            position: "sticky",
            top: 0,
            margin: "-16px -16px 20px",
            padding: "calc(20px + env(safe-area-inset-top)) 16px 16px",
            background: "rgba(248, 250, 252, 0.92)",
            backdropFilter: "blur(12px)",
            zIndex: 50,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={onBack}
              className="back-btn"
              style={{ flexShrink: 0 }}
            >
              <ChevronLeft size={28} strokeWidth={3} />
            </button>
            <h2
              style={{
                margin: 0,
                fontSize: "1.3rem",
                fontWeight: "900",
                color: "#1b0b8c",
                textTransform: "uppercase",
              }}
            >
              {report.report_types?.name}
            </h2>
          </div>
          {activeStatus === "IN PROGRESS" && (
            <button
              onClick={() => setShowDelayModal(true)}
              style={{
                background: "#fee2e2",
                border: "none",
                padding: "10px",
                borderRadius: "50%",
                color: "#ef4444",
                flexShrink: 0,
              }}
            >
              <Clock size={22} strokeWidth={3} />
            </button>
          )}
        </div>

        {/* Lock Banner */}
        {isLocked && (
          <div
            style={{
              margin: "0 0 15px",
              padding: "16px",
              borderRadius: "15px",
              display: "flex",
              justifyContent: "center",
              gap: "10px",
              background: isResolved ? "#fef2f2" : "#f0fdfa",
              color: isResolved ? "#ef4444" : "#0d9488",
              border: isResolved ? "2px solid #fca5a5" : "2px solid #5eead4",
            }}
          >
            {isResolved ? <CheckCircle size={22} /> : <AlertCircle size={22} />}
            <span style={{ fontWeight: "900", textTransform: "uppercase" }}>
              {isResolved ? t.reportResolved : "Waiting for Verification"}
            </span>
          </div>
        )}

        {/* Photo Section */}
        <div style={{ marginBottom: "20px" }}>
          {report.photo_url ? (
            <img
              src={report.photo_url}
              alt="Issue"
              style={{
                width: "100%",
                height: "220px",
                objectFit: "cover",
                borderRadius: "16px",
              }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "#f8fafc",
                borderRadius: "16px",
                border: "2px dashed #cbd5e1",
                width: "100%",
                height: "220px",
                boxSizing: "border-box",
                color: "#64748b",
              }}
            >
              <ClipboardList
                size={42}
                style={{ marginBottom: "12px", color: "#94a3b8" }}
              />
              <h3
                style={{
                  margin: "0 0 6px",
                  color: "#475569",
                  fontSize: "1.1rem",
                  fontWeight: "900",
                }}
              >
                WALK-IN REPORT
              </h3>
              <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: "600" }}>
                No visual evidence provided.
              </p>
            </div>
          )}
        </div>

        {/* Info Blocks */}
        <div className="detail-info-section" style={{ marginBottom: "15px" }}>
          <p>
            <strong>ADDRESS:</strong>{" "}
            {[
              report.purok_sitio,
              report.barangays?.name,
              report.municipalities?.name,
              "Isabela",
            ]
              .filter(Boolean)
              .join(", ") || "N/A"}
          </p>
          <p style={{ marginTop: "10px" }}>
            <strong>DESC:</strong> {report.description || "N/A"}
          </p>
          <p style={{ marginTop: "10px" }}>
            <strong>LANDMARK:</strong> {report.landmark || "N/A"}
          </p>
          {report.resolution_time && (
            <p
              style={{
                marginTop: "12px",
                paddingTop: "12px",
                borderTop: "1px dashed #cbd5e1",
              }}
            >
              <strong>RESOLUTION TIME:</strong>{" "}
              <span style={{ color: "#16a34a" }}>{report.resolution_time}</span>
            </p>
          )}
        </div>

        {adminRemarks && (
          <div
            style={{
              background: "#fffbeb",
              padding: "16px",
              borderRadius: "12px",
              border: "1px solid #fde68a",
              marginBottom: "15px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
                color: "#b45309",
                fontWeight: "900",
              }}
            >
              <MessageSquare size={20} /> ADMIN REMARKS
            </div>
            <p style={{ margin: 0, color: "#78350f", fontWeight: "600" }}>
              {adminRemarks}
            </p>
          </div>
        )}

        {report.delay_reason && (
          <div
            style={{
              background: "#fef2f2",
              padding: "16px",
              borderRadius: "12px",
              border: "1px solid #fecaca",
              marginBottom: "15px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
                color: "#dc2626",
                fontWeight: "900",
              }}
            >
              <AlertCircle size={20} /> DELAY NOTICE
            </div>
            <p style={{ margin: 0, color: "#991b1b", fontWeight: "600" }}>
              {report.delay_reason}
            </p>
          </div>
        )}

        <button
          onClick={() => setShowMap(true)}
          style={{
            width: "100%",
            padding: "16px",
            background: "#1b0b8c",
            color: "#fff",
            border: "none",
            borderRadius: "50px",
            fontWeight: "900",
            display: "flex",
            justifyContent: "center",
            gap: "10px",
            marginBottom: "10px",
          }}
        >
          <MapPin size={22} /> VIEW MAP
        </button>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.85rem",
            color: "#64748b",
            padding: "0 10px 15px",
          }}
        >
          <span>
            <strong>LO:</strong> {report.longitude}
          </span>
          <span>
            <strong>LA:</strong> {report.latitude}
          </span>
        </div>

        <div
          style={{
            background: "#fff",
            padding: "16px",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "12px",
              color: "#1b0b8c",
              fontWeight: "900",
            }}
          >
            <Users size={20} /> ASSIGNED TEAM
          </div>
          <p
            style={{
              margin: "0 0 6px",
              color: "#15803d",
              fontWeight: "900",
              fontSize: "1.1rem",
            }}
          >
            {assignedTeamName}
          </p>
          <ul
            style={{
              margin: 0,
              paddingLeft: "20px",
              color: "#334155",
              fontWeight: "700",
            }}
          >
            {companions.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Action Bar */}
      <div
        style={{
          padding: "15px",
          background: "#fff",
          borderTop: "1px solid #e2e8f0",
          position: "fixed",
          bottom: 0,
          left: 0,
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {activeStatus === "ON QUEUE" ? (
          <>
            {hasOtherInProgress && !isCheckingActive && (
              <p
                style={{
                  color: "#ef4444",
                  fontSize: "0.75rem",
                  fontWeight: "900",
                  textAlign: "center",
                  margin: "0 0 10px 0",
                }}
              >
                ⚠️ Finish your "In Progress" task first
              </p>
            )}
            <button
              onClick={handleStartClick}
              disabled={isSubmitting || hasOtherInProgress || isCheckingActive}
              style={{
                width: "100%",
                background:
                  hasOtherInProgress || isCheckingActive
                    ? "#cbd5e1"
                    : "#16a34a",
                color:
                  hasOtherInProgress || isCheckingActive ? "#64748b" : "#fff",
                padding: "16px",
                borderRadius: "50px",
                border: "none",
                fontWeight: "900",
                fontSize: "1.05rem",
                display: "flex",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <PlayCircle size={28} />{" "}
              {isCheckingActive
                ? "Checking..."
                : isSubmitting
                  ? "Starting..."
                  : "Start Work"}
            </button>
          </>
        ) : (
          <button
            onClick={handleVerifyClick}
            disabled={isLocked || activeStatus !== "IN PROGRESS"}
            style={{
              width: "100%",
              background: "#1b0b8c",
              color: "#fff",
              padding: "16px",
              borderRadius: "50px",
              border: "none",
              fontWeight: "900",
              fontSize: "1.05rem",
              display: "flex",
              justifyContent: "center",
              gap: "8px",
              opacity: isLocked || activeStatus !== "IN PROGRESS" ? 0.5 : 1,
            }}
          >
            <CheckCircle size={28} /> Submit for Verification
          </button>
        )}
      </div>
    </div>
  );
}

export default LinemanReportDetail;
