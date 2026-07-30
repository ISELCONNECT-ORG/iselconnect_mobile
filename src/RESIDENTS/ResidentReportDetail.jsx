import React, { useState, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ChevronLeft,
  Save,
  Edit2,
  X,
  CheckCircle,
  MapPin,
  Navigation,
  Check,
  Users, // <-- Added Users icon
} from "lucide-react";
import { supabase } from "../supabaseClient";
import { logSystemAction } from "../utils/logger";
import { translations } from "../components/translations";

function ResidentReportDetail({ report, onBack, onReportUpdated }) {
  const currentLang = localStorage.getItem("appLanguage") || "English";
  const t = translations[currentLang];

  const [loading, setLoading] = useState(false);
  const [reportTypes, setReportTypes] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const [linemanLocation, setLinemanLocation] = useState(null);
  const [timelineData, setTimelineData] = useState(null);
  const [assignedLinemen, setAssignedLinemen] = useState([]); // <-- NEW: State for assigned personnel

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const linemanMarkerRef = useRef(null);
  const lineRef = useRef(null);

  // Status checks
  const statusName = report.report_statuses?.name?.toUpperCase() || "PENDING";
  const isPending = statusName === "PENDING";
  const isInProgress = statusName === "IN PROGRESS";

  const showMapButton = isPending || isInProgress;

  const [formData, setFormData] = useState({
    report_type_id: report.report_type_id || "",
    landmark: report.landmark || "",
    description: report.description || "",
  });

  // 1. Fetch Timeline Data AND Assigned Personnel from Assignments Table
  useEffect(() => {
    const fetchAssignmentDetails = async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select(
          `
          assigned_at, 
          inprogress_at, 
          completion_at, 
          verified_at,
          users ( first_name, last_name )
        `,
        )
        .eq("report_id", report.id);

      if (data && !error && data.length > 0) {
        // Use the first record for timeline dates
        setTimelineData(data[0]);

        // Extract all assigned linemen names
        const linemenNames = data
          .map((a) =>
            `${a.users?.first_name || ""} ${a.users?.last_name || ""}`.trim(),
          )
          .filter(Boolean);

        // Remove duplicates just in case
        setAssignedLinemen([...new Set(linemenNames)]);
      }
    };
    fetchAssignmentDetails();
  }, [report.id]);

  useEffect(() => {
    if (isPending) {
      const fetchTypes = async () => {
        const { data } = await supabase.from("report_types").select("id, name");
        if (data) setReportTypes(data);
      };
      fetchTypes();
    }
    const navBar = document.querySelector(".bottom-nav-wrapper");
    if (navBar) navBar.style.display = "none";
    return () => {
      if (navBar) navBar.style.display = "";
    };
  }, [isPending]);

  useEffect(() => {
    if (!isInProgress) return;

    let isMounted = true;
    let activeChannel = null;

    const setupTracking = async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("id, current_lat, current_lon")
        .eq("report_id", report.id)
        .not("current_lat", "is", null)
        .limit(1);

      if (error || !data || data.length === 0 || !isMounted) return;

      const assignment = data[0];

      if (assignment.current_lat && assignment.current_lon) {
        setLinemanLocation({
          lat: assignment.current_lat,
          lon: assignment.current_lon,
        });
      }

      const assignmentId = assignment.id;
      const uniqueChannelName = `tracking_${assignmentId}_${Date.now()}`;

      activeChannel = supabase.channel(uniqueChannelName);

      activeChannel
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "assignments",
            filter: `id=eq.${assignmentId}`,
          },
          (payload) => {
            if (payload.new.current_lat && payload.new.current_lon) {
              setLinemanLocation({
                lat: payload.new.current_lat,
                lon: payload.new.current_lon,
              });
            }
          },
        )
        .subscribe();
    };

    setupTracking();

    return () => {
      isMounted = false;
      if (activeChannel) {
        supabase.removeChannel(activeChannel);
      }
    };
  }, [isInProgress, report.id]);

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
        html: `<div style="background-color: #facc15; width: 22px; height: 22px; border-radius: 50%; border: 4px solid #1b0b8c; box-shadow: 0 4px 8px rgba(0,0,0,0.4);"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      if (!mapRef.current) {
        mapRef.current = L.map(mapContainerRef.current, {
          zoomControl: false,
        }).setView([lat, lon], 16);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
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
  }, [showMap, report.latitude, report.longitude]);

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

  const handleEditClick = () => {
    setFormData({
      report_type_id: report.report_type_id || "",
      landmark: report.landmark || "",
      description: report.description || "",
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setFormData({
      report_type_id: report.report_type_id || "",
      landmark: report.landmark || "",
      description: report.description || "",
    });
    setIsEditing(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpdateReport = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("reports")
        .update({
          report_type_id: parseInt(formData.report_type_id, 10),
          landmark: (formData.landmark || "").trim(),
          description: (formData.description || "").trim(),
        })
        .eq("id", report.id)
        .select();
      if (error) throw error;
      if (!data || data.length === 0)
        throw new Error("Update blocked by database security policies.");
      await logSystemAction(
        "UPDATE_REPORT",
        `Resident updated report #${report.id}. New Landmark: ${formData.landmark.trim()}`,
      );
      setShowSuccessModal(true);
    } catch (err) {
      alert("Failed to update report. Please try again.\n" + err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTimelineDate = (isoString) => {
    if (!isoString) return { date: "--", time: "" };
    const d = new Date(isoString);
    return {
      date: d.toLocaleDateString("en-US", { day: "2-digit", month: "short" }),
      time: d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
    };
  };

  let currentStep = 1;
  if (statusName === "IN PROGRESS") currentStep = 2;
  if (statusName === "PENDING VERIFICATION") currentStep = 3;
  if (["RESOLVED", "APPROVED", "ADMIN VERIFIED"].includes(statusName))
    currentStep = 4;

  const timelineSteps = [
    { label: "Pending", ...formatTimelineDate(report.created_at) },
    {
      label: "In Progress",
      ...formatTimelineDate(
        timelineData?.inprogress_at || timelineData?.assigned_at,
      ),
    },
    {
      label: "Pending Verif.",
      ...formatTimelineDate(timelineData?.completion_at),
    },
    {
      label: "Resolved",
      ...formatTimelineDate(
        timelineData?.verified_at ||
          (currentStep === 4 ? report.updated_at : null),
      ),
    },
  ];

  const currentReportTypeName =
    reportTypes.find((type) => type.id === parseInt(formData.report_type_id))
      ?.name || report.report_types?.name;

  let badgeStyle = {};
  if (statusName === "IN PROGRESS") {
    badgeStyle = { backgroundColor: "#bae6fd", color: "#0284c7" };
  } else if (statusName === "ADMIN VERIFIED") {
    badgeStyle = { backgroundColor: "#e0e7ff", color: "#4f46e5" };
  } else if (statusName === "PENDING VERIFICATION") {
    badgeStyle = { backgroundColor: "#ffedd5", color: "#c2410c" };
  } else if (statusName === "REJECTED") {
    badgeStyle = { backgroundColor: "#fee2e2", color: "#dc2626" };
  }

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
            {t.viewLocationMap}
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
                  background: "#facc15",
                  borderRadius: "50%",
                  border: "2px solid #1b0b8c",
                }}
              ></div>
              Issue
            </div>
            {isInProgress && (
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
                Lineman
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

  return (
    <div className="detail-layout">
      {showSuccessModal && (
        <div className="success-modal-overlay">
          <div className="success-modal-box">
            <div className="success-modal-header">
              <h2>UPDATED</h2>
            </div>
            <div className="success-modal-body">
              <p>
                Your report details have
                <br />
                been updated!
              </p>
              <button
                className="success-modal-btn"
                onClick={() => {
                  setShowSuccessModal(false);
                  setIsEditing(false);
                  if (onReportUpdated) onReportUpdated();
                }}
              >
                OK!
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="detail-scrollable-content rrd-scrollable">
        <div className="detail-header">
          <button
            onClick={() => {
              isEditing ? handleCancelEdit() : onBack();
            }}
            className="back-btn"
          >
            <ChevronLeft size={28} strokeWidth={3} />
          </button>
          <h2>{isEditing ? t.editReportTitle : t.reportDetailsTitle}</h2>
        </div>

        <div className="detail-photo-section rrd-mb-20">
          {report.photo_url ? (
            <img
              src={report.photo_url}
              alt="Report issue"
              className="detail-photo"
            />
          ) : (
            <div className="no-photo">{t.noOriginalPhoto}</div>
          )}
        </div>

        {isInProgress && linemanLocation && (
          <div
            style={{
              background: "#ecfdf5",
              border: "2px solid #10b981",
              borderRadius: "15px",
              padding: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              marginBottom: "15px",
              color: "#065f46",
              boxShadow: "0 4px 10px rgba(16, 185, 129, 0.15)",
            }}
          >
            <Navigation
              size={20}
              color="#10b981"
              style={{ animation: "pulse 1.5s infinite" }}
            />
            <span
              style={{
                fontWeight: "900",
                letterSpacing: "0.5px",
                fontSize: "0.9rem",
              }}
            >
              LIVE TRACKING ACTIVE
            </span>
            <style>{`@keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); opacity: 0.7; } 100% { transform: scale(1); opacity: 1; } }`}</style>
          </div>
        )}

        {showMapButton && (
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
              marginBottom: "20px",
            }}
          >
            <MapPin size={22} />
            {t.viewLocationMap}
          </button>
        )}

        {/* NEW: ASSIGNED PERSONNEL UI */}
        {assignedLinemen.length > 0 && (
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              padding: "20px 15px",
              marginBottom: "20px",
              boxShadow: "0 4px 10px rgba(0,0,0,0.04)",
              border: "1px solid #f1f5f9",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "12px",
              }}
            >
              <Users size={20} color="#1b0b8c" />
              <h3
                style={{
                  margin: 0,
                  fontSize: "1rem",
                  color: "#1e293b",
                  fontWeight: "900",
                }}
              >
                Assigned Personnel
              </h3>
            </div>
            <ul
              style={{
                margin: 0,
                paddingLeft: "15px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                listStyleType: "square",
                color: "#1b0b8c",
              }}
            >
              {assignedLinemen.map((name, idx) => (
                <li
                  key={idx}
                  style={{
                    fontSize: "0.9rem",
                    color: "#475569",
                    fontWeight: "700",
                  }}
                >
                  {name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* HORIZONTAL PROGRESS TIMELINE UI */}
        {statusName !== "REJECTED" && (
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              padding: "20px 10px",
              marginBottom: "20px",
              boxShadow: "0 4px 10px rgba(0,0,0,0.04)",
            }}
          >
            <h3
              style={{
                margin: "0 0 20px 15px",
                fontSize: "1rem",
                color: "#1e293b",
                fontWeight: "900",
              }}
            >
              Report Progress
            </h3>

            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                position: "relative",
              }}
            >
              {/* Background Grey Track */}
              <div
                style={{
                  position: "absolute",
                  top: "11px",
                  left: "12.5%",
                  right: "12.5%",
                  height: "4px",
                  backgroundColor: "#ccfbf1",
                  zIndex: 0,
                  borderRadius: "2px",
                }}
              ></div>

              {/* Active Teal Track */}
              <div
                style={{
                  position: "absolute",
                  top: "11px",
                  left: "12.5%",
                  width: `${(Math.max(1, currentStep) - 1) * 25}%`,
                  height: "4px",
                  backgroundColor: "#14b8a6",
                  zIndex: 1,
                  borderRadius: "2px",
                  transition: "width 0.5s ease",
                }}
              ></div>

              {timelineSteps.map((step, index) => {
                const stepNumber = index + 1;
                const isCompleted = currentStep >= stepNumber;
                const isCurrent = currentStep === stepNumber;

                return (
                  <div
                    key={step.label}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      zIndex: 2,
                      flex: 1,
                    }}
                  >
                    <div
                      style={{
                        width: isCurrent ? "26px" : "16px",
                        height: isCurrent ? "26px" : "16px",
                        borderRadius: "50%",
                        backgroundColor: isCompleted ? "#14b8a6" : "#ccfbf1",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: isCurrent ? "6px" : "11px",
                        marginTop: isCurrent ? "0px" : "5px",
                        transition: "all 0.3s ease",
                        boxShadow: isCurrent
                          ? "0 0 0 4px rgba(20, 184, 166, 0.2)"
                          : "none",
                      }}
                    >
                      {isCurrent && (
                        <Check size={16} color="#ffffff" strokeWidth={4} />
                      )}
                    </div>

                    <span
                      style={{
                        fontSize: "0.65rem",
                        fontWeight: isCompleted ? "800" : "600",
                        color: isCompleted ? "#0f766e" : "#94a3b8",
                        textAlign: "center",
                        lineHeight: "1.1",
                        marginBottom: "4px",
                        height: "18px",
                        padding: "0 2px",
                      }}
                    >
                      {step.label}
                    </span>
                    <span
                      style={{
                        fontSize: "0.55rem",
                        color: "#64748b",
                        textAlign: "center",
                        fontWeight: "700",
                      }}
                    >
                      {step.date !== "--" ? step.date : ""}
                    </span>
                    <span
                      style={{
                        fontSize: "0.5rem",
                        color: "#94a3b8",
                        textAlign: "center",
                      }}
                    >
                      {step.time}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="detail-info-section rrd-info-section">
          <div className="rrd-status-row">
            <h3 className="rrd-status-label">{t.statusLabel}</h3>
            <span
              className={`rrd-status-badge ${isPending ? "rrd-status-pending" : "rrd-status-resolved"}`}
              style={badgeStyle}
            >
              {statusName}
            </span>
          </div>

          {isEditing ? (
            <div className="report-inputs rrd-inputs-wrapper">
              <p className="rrd-inputs-desc">{t.updateReportDesc}</p>
              <div className="edit-input-group">
                <label className="rrd-input-label">{t.reportType}</label>
                <select
                  name="report_type_id"
                  value={formData.report_type_id}
                  onChange={handleInputChange}
                  className="edit-input custom-select"
                >
                  <option value="" disabled>
                    Select Report Type
                  </option>
                  {reportTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="edit-input-group">
                <label className="rrd-input-label">Landmark</label>
                <input
                  type="text"
                  name="landmark"
                  value={formData.landmark}
                  onChange={handleInputChange}
                  className="edit-input"
                />
              </div>
              <div className="edit-input-group">
                <label className="rrd-input-label">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="edit-input rrd-textarea"
                />
              </div>
              <div className="rrd-btn-row">
                <button onClick={handleCancelEdit} className="rrd-btn-cancel">
                  <X size={20} /> {t.cancelBtn}
                </button>
                <button
                  onClick={handleUpdateReport}
                  disabled={loading}
                  className="rrd-btn-save"
                >
                  <Save size={20} /> {loading ? t.savingBtn : t.saveBtn}
                </button>
              </div>
            </div>
          ) : (
            <div className="rrd-view-wrapper">
              {!isPending && !isInProgress && statusName !== "REJECTED" && (
                <p
                  className="rrd-processing-msg"
                  style={{
                    fontSize: "0.85rem",
                    color: "#b45309",
                    background: "#fffbeb",
                    padding: "10px",
                    borderRadius: "8px",
                    marginBottom: "15px",
                    fontWeight: "bold",
                  }}
                >
                  {t.processingMsg}
                </p>
              )}
              <div>
                <p className="rrd-field-label">{t.reportType}</p>
                <p className="rrd-field-value">{currentReportTypeName}</p>
              </div>
              <hr className="rrd-hr" />
              <div>
                <p className="rrd-field-label">Landmark</p>
                <p className="rrd-field-value-normal">{formData.landmark}</p>
              </div>
              <hr className="rrd-hr" />
              {report.latitude && report.longitude && (
                <>
                  <div>
                    <p className="rrd-field-label">{t.coordinatesLabel}</p>
                    <p
                      className="rrd-field-value-normal"
                      style={{ fontFamily: "monospace", color: "#64748b" }}
                    >
                      {report.latitude}, {report.longitude}
                    </p>
                  </div>
                  <hr className="rrd-hr" />
                </>
              )}
              <div>
                <p className="rrd-field-label">Description</p>
                <p className="rrd-field-value-normal">
                  {formData.description || t.noDescProvided}
                </p>
              </div>
              {isPending && (
                <button onClick={handleEditClick} className="rrd-edit-btn">
                  <Edit2 size={20} /> {t.editReportTitle}
                </button>
              )}
              {report.resolved_photo_url && (
                <div className="rrd-evidence-box">
                  <div className="rrd-evidence-header">
                    <CheckCircle size={20} color="#16a34a" />
                    <h3 className="rrd-evidence-title">{t.fixedEvidence}</h3>
                  </div>
                  <img
                    src={report.resolved_photo_url}
                    alt="Resolved Issue Evidence"
                    className="rrd-evidence-img"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ResidentReportDetail;
