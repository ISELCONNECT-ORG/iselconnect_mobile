import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Webcam from "react-webcam";
import { Geolocation } from "@capacitor/geolocation";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Camera as CameraIcon,
  ChevronDown,
  ChevronLeft,
  Clock,
  ShieldAlert,
  MapPin,
  CheckCircle,
  AlertCircle,
  XOctagon,
  ArrowRight,
  Trash2,
} from "lucide-react";
import { supabase } from "../supabaseClient";
import { logSystemAction } from "../utils/logger";
import { translations } from "../components/translations";

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

const ISABELA_BOUNDS = {
  minLat: 16.3,
  maxLat: 17.6,
  minLon: 121.25,
  maxLon: 122.5,
};

const MAX_ACCEPTABLE_ACCURACY_METERS = 250;

const REPORT_HEADER_BG = "#1b0b8c";

const isWithinServiceArea = (lat, lon) => {
  const numLat = parseFloat(lat);
  const numLon = parseFloat(lon);
  if (isNaN(numLat) || isNaN(numLon)) return false;
  return (
    numLat >= ISABELA_BOUNDS.minLat &&
    numLat <= ISABELA_BOUNDS.maxLat &&
    numLon >= ISABELA_BOUNDS.minLon &&
    numLon <= ISABELA_BOUNDS.maxLon
  );
};

const FieldError = ({ message, overlap = true }) =>
  message ? (
    <div
      role="alert"
      style={{
        backgroundColor: "#ffb3b3",
        color: "#e00000",
        borderRadius: overlap ? "26px 26px 0 0" : "14px",
        padding: overlap ? "9px 22px 30px" : "10px 16px",
        marginBottom: overlap ? "-20px" : "8px",
        fontSize: "0.78rem",
        fontWeight: "600",
        lineHeight: "1.3",
        textAlign: "left",
      }}
    >
      {message}
    </div>
  ) : null;

const SearchableDropdown = ({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  name,
  hasError,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);

  const selectedOption = options.find(
    (opt) => opt.id.toString() === value?.toString(),
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter((opt) =>
    opt.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );
  const displayValue = isOpen
    ? searchTerm
    : selectedOption
      ? selectedOption.name
      : "";

  return (
    <div
      ref={dropdownRef}
      style={{ position: "relative", width: "100%", marginBottom: "0px" }}
    >
      <style>{`
        @keyframes dropdownSlide {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <input
        type="text"
        name={name}
        style={{
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? "not-allowed" : "text",
          width: "100%",
          padding: "16px 20px",
          borderRadius: "50px",
          border: hasError ? "2px solid #ef4444" : "1px solid #cbd5e1",
          backgroundColor: "#ffffff",
          fontSize: "1rem",
          fontWeight: "700",
          color: "#1e293b",
          boxSizing: "border-box",
          outline: "none",
          boxShadow: "0 4px 10px rgba(0,0,0,0.03)",
        }}
        placeholder={placeholder}
        value={displayValue}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          if (!isOpen) setIsOpen(true);
        }}
        onClick={() => !disabled && setIsOpen(true)}
        disabled={disabled}
        autoComplete="off"
      />

      <div
        onClick={(e) => {
          if (!disabled) {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }
        }}
        style={{
          position: "absolute",
          right: "20px",
          top: "50%",
          transform: isOpen
            ? "translateY(-50%) rotate(180deg)"
            : "translateY(-50%) rotate(0deg)",
          transition: "transform 0.3s ease",
          cursor: disabled ? "not-allowed" : "pointer",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ChevronDown size={22} color="#64748b" />
      </div>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            backgroundColor: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "15px",
            maxHeight: "220px",
            overflowY: "auto",
            zIndex: 9999,
            boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
            marginTop: "5px",
            padding: "5px",
            animation: "dropdownSlide 0.2s ease-out forwards",
            transformOrigin: "top center",
          }}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => (
              <div
                key={opt.id}
                onClick={() => {
                  onChange({ target: { name, value: opt.id } });
                  setIsOpen(false);
                  setSearchTerm("");
                }}
                style={{
                  padding: "12px 15px",
                  cursor: "pointer",
                  borderRadius: "10px",
                  color: "#1e293b",
                  fontWeight: selectedOption?.id === opt.id ? "bold" : "normal",
                  backgroundColor:
                    selectedOption?.id === opt.id ? "#f1f5f9" : "transparent",
                }}
              >
                {opt.name}
              </div>
            ))
          ) : (
            <div
              style={{
                padding: "12px 15px",
                color: "#94a3b8",
                textAlign: "center",
              }}
            >
              No results found
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function ReportTab({ isActive }) {
  const currentLang = localStorage.getItem("appLanguage") || "English";
  const t = translations[currentLang];

  const [verificationStatus, setVerificationStatus] = useState("loading");
  const [hasPendingReport, setHasPendingReport] = useState(false);
  const [pendingReportDetails, setPendingReportDetails] = useState(null);
  const [isBanned, setIsBanned] = useState(false);

  const [hasAcceptedGuidelines, setHasAcceptedGuidelines] = useState(() => {
    return localStorage.getItem("report_draft_guidelines") === "true";
  });

  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const [imagePreview, setImagePreview] = useState(() => {
    return localStorage.getItem("report_draft_image") || null;
  });

  const [coordinates, setCoordinates] = useState(() => {
    const saved = localStorage.getItem("report_draft_coords");
    return saved ? JSON.parse(saved) : { lat: "", lon: "" };
  });

  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);

  const [reportTypes, setReportTypes] = useState([]);
  const [municipalities, setMunicipalities] = useState([]);
  const [barangays, setBarangays] = useState([]);

  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem("report_draft_form");
    return saved
      ? JSON.parse(saved)
      : {
          report_type_id: "",
          municipality_id: "",
          barangay_id: "",
          purok_sitio: "",
          landmark: "",
          description: "",
        };
  });

  useEffect(() => {
    localStorage.setItem("report_draft_guidelines", hasAcceptedGuidelines);
    if (imagePreview) {
      try {
        localStorage.setItem("report_draft_image", imagePreview);
      } catch (e) {}
    } else {
      localStorage.removeItem("report_draft_image");
    }
    localStorage.setItem("report_draft_coords", JSON.stringify(coordinates));
    localStorage.setItem("report_draft_form", JSON.stringify(formData));
  }, [hasAcceptedGuidelines, imagePreview, coordinates, formData]);

  const webcamRef = useRef(null);
  const formContainerRef = useRef(null);

  const selectedReportTypeObj = reportTypes.find(
    (rt) => rt.id.toString() === formData.report_type_id.toString(),
  );
  const isOtherSelected =
    selectedReportTypeObj?.name?.toLowerCase().includes("other") ||
    selectedReportTypeObj?.name?.toLowerCase().includes("not specified");

  const handleClearForm = () => {
    setImagePreview(null);
    setCoordinates({ lat: "", lon: "" });
    setFormData({
      report_type_id: "",
      municipality_id: "",
      barangay_id: "",
      purok_sitio: "",
      landmark: "",
      description: "",
    });
    setFieldErrors({});
    setError("");

    localStorage.removeItem("report_draft_image");
    localStorage.removeItem("report_draft_coords");
    localStorage.removeItem("report_draft_form");
    setShowClearConfirmModal(false);
  };

  useEffect(() => {
    const checkUserStatus = async () => {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (user && !authError) {
          const { data: userData, error: userDbError } = await supabase
            .from("users")
            .select("ban_status")
            .eq("id", user.id)
            .single();

          if (userData && !userDbError && userData.ban_status === true) {
            setIsBanned(true);
            setVerificationStatus("approved");
            return;
          }

          const { data: verData, error: dbError } = await supabase
            .from("user_verifications")
            .select("verification_status")
            .eq("user_id", user.id)
            .single();

          if (verData && !dbError) {
            setVerificationStatus(verData.verification_status || "pending");
          } else {
            setVerificationStatus("pending");
          }

          const { data: reportsData, error: reportsError } = await supabase
            .from("reports")
            .select(
              "id, landmark, created_at, latitude, longitude, report_type_id, report_statuses(name)",
            )
            .eq("residents_id", user.id);

          if (!reportsError && reportsData) {
            const activeReport = reportsData.find((r) => {
              const statusName = r.report_statuses?.name?.toUpperCase() || "";
              return statusName === "PENDING";
            });

            if (activeReport) {
              setHasPendingReport(true);
              setPendingReportDetails(activeReport);
            } else {
              setHasPendingReport(false);
              setPendingReportDetails(null);
            }
          }
        }
      } catch (err) {
        console.error("Failed to check user status:", err);
        setVerificationStatus("pending");
      }
    };

    if (isActive) {
      checkUserStatus();
    }
  }, [isActive]);

  useEffect(() => {
    if (showSuccessModal || showClearConfirmModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showSuccessModal, showClearConfirmModal]);

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: typesData, error: typesError } = await supabase
        .from("report_types")
        .select("id, name")
        .order("id", { ascending: true });
      if (typesData && !typesError) setReportTypes(typesData);
      const { data: munData, error: munError } = await supabase
        .from("municipalities")
        .select("id, name, branch_id")
        .order("name", { ascending: true });
      if (munData && !munError) setMunicipalities(munData);
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    const fetchBarangays = async () => {
      if (!formData.municipality_id) {
        setBarangays([]);
        return;
      }
      const { data, error } = await supabase
        .from("barangays")
        .select("id, name")
        .eq("municipality_id", formData.municipality_id)
        .order("name", { ascending: true });
      if (data && !error) setBarangays(data);
    };
    fetchBarangays();
  }, [formData.municipality_id]);

  useEffect(() => {
    const autoFillAddress = async () => {
      if (
        !coordinates.lat ||
        !coordinates.lon ||
        coordinates.lat === "Fetching..." ||
        municipalities.length === 0
      )
        return;

      try {
        const LOCATION_IQ_TOKEN = import.meta.env.VITE_LOCATIONIQ_TOKEN;

        const res = await fetch(
          `https://us1.locationiq.com/v1/reverse.php?key=${LOCATION_IQ_TOKEN}&lat=${coordinates.lat}&lon=${coordinates.lon}&format=json`,
        );
        const data = await res.json();

        if (data && data.address) {
          if (
            data.address.country_code &&
            data.address.country_code.toLowerCase() !== "ph"
          ) {
            setImagePreview(null);
            setCoordinates({ lat: "", lon: "" });
            setFieldErrors((prev) => ({
              ...prev,
              coordinates: "Foreign IP Detected.",
            }));
            setError(
              "Foreign location detected. Please disable any active VPN and recapture the photo using your device's physical GPS.",
            );
            return;
          }

          const addressValues = Object.values(data.address).map((v) =>
            typeof v === "string" ? v.toLowerCase() : "",
          );

          let matchedMunId = formData.municipality_id;
          let matchedBrgyId = formData.barangay_id;

          const munMatch = municipalities.find((m) =>
            addressValues.some((val) => val.includes(m.name.toLowerCase())),
          );
          if (munMatch) matchedMunId = munMatch.id.toString();

          if (matchedMunId) {
            const { data: bData } = await supabase
              .from("barangays")
              .select("id, name")
              .eq("municipality_id", matchedMunId);
            if (bData) {
              const brgyMatch = bData.find((b) =>
                addressValues.some((val) => val.includes(b.name.toLowerCase())),
              );
              if (brgyMatch) matchedBrgyId = brgyMatch.id.toString();
            }
          } else {
            const { data: allBrgys } = await supabase
              .from("barangays")
              .select("id, name, municipality_id");
            if (allBrgys) {
              const brgyMatch = allBrgys.find((b) =>
                addressValues.some(
                  (val) =>
                    val === b.name.toLowerCase() ||
                    val.includes(b.name.toLowerCase()),
                ),
              );
              if (brgyMatch) {
                matchedBrgyId = brgyMatch.id.toString();
                matchedMunId = brgyMatch.municipality_id.toString();
              }
            }
          }

          const { road, amenity, neighbourhood, suburb } = data.address;
          const suggestedPurok =
            road || neighbourhood || suburb || amenity || "";

          setFormData((prev) => ({
            ...prev,
            municipality_id: matchedMunId || prev.municipality_id,
            barangay_id: matchedBrgyId || prev.barangay_id,
            purok_sitio: prev.purok_sitio || suggestedPurok,
          }));
        }
      } catch (error) {
        console.error("LocationIQ auto-mapping failed:", error);
      }
    };

    autoFillAddress();
  }, [coordinates.lat, coordinates.lon, municipalities]);

  useEffect(() => {
    setFieldErrors((prev) => {
      if (!prev.municipality_id && !prev.barangay_id) return prev;
      const next = { ...prev };
      if (formData.municipality_id) delete next.municipality_id;
      if (formData.barangay_id) delete next.barangay_id;
      return next;
    });
  }, [formData.municipality_id, formData.barangay_id]);

  useEffect(() => {
    const navBar = document.querySelector(".bottom-nav-wrapper");
    if (isCameraOpen) {
      if (navBar) navBar.style.display = "none";
    } else {
      if (navBar) navBar.style.display = "";
    }
    return () => {
      if (navBar) navBar.style.display = "";
    };
  }, [isCameraOpen]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      if (name === "municipality_id") delete next.barangay_id;
      return next;
    });
    setFormData((prev) => {
      const newData = { ...prev, [name]: value };
      if (name === "municipality_id") newData.barangay_id = "";
      return newData;
    });
  };

  const capture = useCallback(async () => {
    const imageSrc = webcamRef.current.getScreenshot();
    setImagePreview(imageSrc);
    setIsCameraOpen(false);
    setCoordinates({ lat: "Fetching...", lon: "Fetching..." });
    setError("");
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.photo;
      delete next.coordinates;
      return next;
    });

    try {
      let permissions = await Geolocation.checkPermissions();
      if (permissions.location !== "granted") {
        permissions = await Geolocation.requestPermissions();
      }

      if (permissions.location !== "granted") {
        throw new Error("Location permission denied. Cannot fetch GPS.");
      }

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20000,
      });

      const { latitude, longitude, accuracy } = position.coords;

      if (!isWithinServiceArea(latitude, longitude)) {
        setImagePreview(null);
        setCoordinates({ lat: "", lon: "" });
        setFieldErrors((prev) => ({
          ...prev,
          coordinates: "Location blocked.",
        }));
        setError(
          "Detected location is outside the ISELCO-1 service area. Please turn OFF any active VPN and ensure your device GPS is enabled before capturing.",
        );
        return;
      }

      if (accuracy && accuracy > MAX_ACCEPTABLE_ACCURACY_METERS) {
        setImagePreview(null);
        setCoordinates({ lat: "", lon: "" });
        setFieldErrors((prev) => ({
          ...prev,
          coordinates: "Signal too weak.",
        }));
        setError(
          `GPS signal is too inaccurate (±${Math.round(
            accuracy,
          )}m). Please disable any active VPN, enable 'Precise Location', and step outside.`,
        );
        return;
      }

      setCoordinates({
        lat: latitude.toFixed(6),
        lon: longitude.toFixed(6),
      });
    } catch (err) {
      console.error("Location access failed:", err);
      setError(
        "Failed to get precise GPS lock. Please step outside for a clear view of the sky and ensure your device settings allow 'Precise Location'.",
      );
      setCoordinates({ lat: "", lon: "" });
    }
  }, [webcamRef]);

  const base64ToBlob = (base64, mimeType = "image/jpeg") => {
    const byteCharacters = atob(base64.split(",")[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
  };

  const handleSubmitReport = async () => {
    if (verificationStatus !== "approved") {
      return setError("Only verified accounts can submit reports.");
    }

    const errors = {};
    if (!imagePreview) errors.photo = "Please capture a photo of the issue.";

    if (
      !coordinates.lat ||
      !coordinates.lon ||
      coordinates.lat === "Fetching..."
    ) {
      errors.coordinates = "Please wait for location coordinates to load.";
    } else if (!isWithinServiceArea(coordinates.lat, coordinates.lon)) {
      errors.coordinates = "Location must be within Isabela.";
      setError(
        "Invalid location coordinates detected outside the ISELCO-1 service area. Please turn off your VPN and retake the photo.",
      );
    }

    if (!formData.municipality_id)
      errors.municipality_id = "Please select a Municipality.";
    if (!formData.barangay_id) errors.barangay_id = "Please select a Barangay.";
    if (!formData.report_type_id)
      errors.report_type_id = "Please select a Report Type.";
    if (!formData.landmark.trim()) errors.landmark = "Please enter a Landmark.";
    if (isOtherSelected && !formData.description.trim())
      errors.description =
        "Please describe the damage for Other / Not Specified issues.";

    setFieldErrors(errors);
    const firstInvalid = Object.keys(errors)[0];
    if (firstInvalid) {
      if (firstInvalid !== "coordinates" || !error.includes("VPN")) {
        setError("");
      }
      setTimeout(() => {
        const el = formContainerRef.current?.querySelector(
          `[name="${firstInvalid}"], [data-field="${firstInvalid}"]`,
        );
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          if (typeof el.focus === "function") el.focus({ preventScroll: true });
        }
      }, 0);
      return;
    }

    if (
      hasPendingReport &&
      pendingReportDetails?.latitude &&
      pendingReportDetails?.longitude
    ) {
      const dist = calculateDistance(
        parseFloat(coordinates.lat),
        parseFloat(coordinates.lon),
        parseFloat(pendingReportDetails.latitude),
        parseFloat(pendingReportDetails.longitude),
      );

      if (dist <= 50) {
        if (
          parseInt(formData.report_type_id) ===
          parseInt(pendingReportDetails.report_type_id)
        ) {
          return setError(
            `You already have a pending report for this exact issue nearby (${Math.round(dist)}m away). Our dispatch team will inspect and resolve all adjacent infrastructure damage in this immediate area.`,
          );
        }
      }
    }

    setIsSubmitting(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;

      const selectedMunicipality = municipalities.find(
        (m) => m.id.toString() === formData.municipality_id.toString(),
      );

      const now = new Date();
      let phHour = now.getUTCHours() + 8;
      if (phHour >= 24) phHour -= 24;
      const phMinute = now.getUTCMinutes();
      const timeInMinutes = phHour * 60 + phMinute;

      const startWorkingMinutes = 8 * 60;
      const endWorkingMinutes = 17 * 60;
      let automaticBranchId = null;

      if (
        timeInMinutes >= startWorkingMinutes &&
        timeInMinutes <= endWorkingMinutes
      ) {
        automaticBranchId = selectedMunicipality?.branch_id || null;
      } else {
        automaticBranchId = null;
      }

      const fileName = `${user.id}-${Date.now()}.jpg`;
      const imageBlob = base64ToBlob(imagePreview);
      const { error: uploadError } = await supabase.storage
        .from("report_photos")
        .upload(fileName, imageBlob, { contentType: "image/jpeg" });
      if (uploadError) throw new Error("Failed to upload photo to storage.");

      const { data: publicUrlData } = supabase.storage
        .from("report_photos")
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase.from("reports").insert([
        {
          residents_id: user.id,
          report_type_id: parseInt(formData.report_type_id),
          description: formData.description.trim() || null,
          landmark: formData.landmark.trim(),
          latitude: parseFloat(coordinates.lat),
          longitude: parseFloat(coordinates.lon),
          municipality_id: parseInt(formData.municipality_id),
          barangay_id: parseInt(formData.barangay_id),
          purok_sitio: formData.purok_sitio.trim() || null,
          branch_id: automaticBranchId,
          status_id: 1,
          photo_url: publicUrlData.publicUrl,
        },
      ]);

      if (dbError)
        throw new Error(
          "Failed to save report to database: " + dbError.message,
        );

      const typeName = selectedReportTypeObj?.name || "issue";
      await logSystemAction(
        "SUBMIT_REPORT",
        `Resident submitted a new ${typeName} report at ${formData.landmark.trim()}.`,
      );

      const { error: notifError } = await supabase
        .from("notifications")
        .insert([
          {
            residents_id: user.id,
            title: "Report Submitted",
            message: `Your report for a ${typeName} at ${formData.landmark.trim()} has been successfully submitted and is now pending review.`,
            is_read: false,
          },
        ]);

      if (notifError) {
        console.error("Failed to generate notification:", notifError.message);
      }

      setShowSuccessModal(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (verificationStatus === "loading") {
    return (
      <div
        className="page-transition"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          backgroundColor: "#f8fafc",
          color: "#1b0b8c",
          fontWeight: "bold",
        }}
      >
        Checking account status...
      </div>
    );
  }

  if (isBanned) {
    return (
      <div
        className="page-transition"
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          padding: "20px 16px 110px 16px",
          boxSizing: "border-box",
          backgroundColor: "#f8fafc",
        }}
      >
        <div
          style={{
            margin: "auto",
            backgroundColor: "#ffffff",
            borderRadius: "24px",
            padding: "35px 25px",
            width: "100%",
            maxWidth: "400px",
            boxSizing: "border-box",
            textAlign: "center",
            boxShadow: "0 15px 30px rgba(0,0,0,0.05)",
          }}
        >
          <div
            style={{
              backgroundColor: "#fee2e2",
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px auto",
              boxShadow: "0 0 20px rgba(239, 68, 68, 0.2)",
            }}
          >
            <XOctagon size={44} color="#dc2626" />
          </div>

          <h2
            style={{
              color: "#1e293b",
              fontWeight: "900",
              margin: "0 0 12px 0",
              fontSize: "1.45rem",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            ACCOUNT RESTRICTED
          </h2>

          <p
            style={{
              color: "#475569",
              fontSize: "0.9rem",
              lineHeight: "1.6",
              margin: "0 0 20px 0",
              textAlign: "center",
              padding: "0 10px",
            }}
          >
            Your reporting privileges have been disabled by the administrator
            due to policy violations.
          </p>

          <div
            style={{
              backgroundColor: "#fef2f2",
              border: "1px solid #fca5a5",
              borderRadius: "14px",
              padding: "14px 15px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <span
              style={{
                fontSize: "0.85rem",
                color: "#991b1b",
                fontWeight: "900",
                textTransform: "uppercase",
              }}
            >
              Please contact support
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (verificationStatus !== "approved") {
    const isRejected = verificationStatus === "rejected";

    return (
      <div
        className="page-transition"
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          padding: "20px 16px 110px 16px",
          boxSizing: "border-box",
          backgroundColor: "#f8fafc",
        }}
      >
        <div
          style={{
            margin: "auto",
            backgroundColor: "#ffffff",
            borderRadius: "24px",
            padding: "35px 25px",
            width: "100%",
            maxWidth: "400px",
            boxSizing: "border-box",
            textAlign: "center",
            boxShadow: "0 15px 30px rgba(0,0,0,0.05)",
          }}
        >
          <div
            style={{
              backgroundColor: isRejected ? "#fee2e2" : "#fef3c7",
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px auto",
            }}
          >
            {isRejected ? (
              <ShieldAlert size={48} color="#dc2626" />
            ) : (
              <Clock size={48} color="#d97706" />
            )}
          </div>

          <h2
            style={{
              color: "#1e293b",
              fontWeight: "900",
              margin: "0 0 12px 0",
              fontSize: "1.35rem",
            }}
          >
            {isRejected ? "Verification Rejected" : "Account Pending Approval"}
          </h2>

          <p
            style={{
              color: "#475569",
              fontSize: "0.88rem",
              lineHeight: "1.6",
              margin: "0 0 25px 0",
              textAlign: "justify",
            }}
          >
            {isRejected
              ? "Your submitted verification details or eKYC photos were not approved by administrators. Please contact support or update your profile to re-verify."
              : "Your account details and eKYC photos are currently under review by ISELCO-1 administrators. You will be able to report power outages and maintenance issues once your account is verified."}
          </p>

          <div
            style={{
              backgroundColor: isRejected ? "#fef2f2" : "#fffbe1",
              border: `1px solid ${isRejected ? "#fca5a5" : "#fde047"}`,
              borderRadius: "14px",
              padding: "12px 15px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <span
              style={{
                fontSize: "0.82rem",
                color: "#334155",
                fontWeight: "bold",
              }}
            >
              Account Status:{" "}
              <strong
                style={{
                  color: isRejected ? "#dc2626" : "#d97706",
                  textTransform: "uppercase",
                }}
              >
                {verificationStatus}
              </strong>
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="page-transition"
      style={{
        overscrollBehavior: "none",
        backgroundColor: "#f8fafc",
        ...(hasAcceptedGuidelines && !isCameraOpen
          ? { padding: 0, margin: 0, minHeight: "100vh" }
          : {}),
        height: !hasAcceptedGuidelines && !isCameraOpen ? "100vh" : "auto",
        overflow:
          !hasAcceptedGuidelines && !isCameraOpen ? "hidden" : "visible",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {showClearConfirmModal &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              backgroundColor: "rgba(0, 0, 0, 0.65)",
              zIndex: 999999,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <div
              className="modal-box"
              style={{
                margin: "0 20px",
                textAlign: "center",
                padding: "25px 20px",
              }}
            >
              <div
                style={{
                  backgroundColor: "#fee2e2",
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 15px auto",
                }}
              >
                <XOctagon size={32} color="#dc2626" />
              </div>
              <h3
                className="modal-title"
                style={{
                  fontSize: "1.4rem",
                  color: "#1e293b",
                  marginBottom: "10px",
                  marginTop: "10px",
                }}
              >
                Clear Draft?
              </h3>
              <p
                className="modal-text"
                style={{
                  fontSize: "0.95rem",
                  color: "#475569",
                  marginBottom: "25px",
                }}
              >
                Are you sure you want to clear your current report progress?
                This action cannot be undone.
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  style={{
                    flex: 1,
                    padding: "14px",
                    borderRadius: "50px",
                    backgroundColor: "#f1f5f9",
                    color: "#475569",
                    fontWeight: "bold",
                    border: "1px solid #cbd5e1",
                    cursor: "pointer",
                  }}
                  onClick={() => setShowClearConfirmModal(false)}
                >
                  Cancel
                </button>
                <button
                  style={{
                    flex: 1,
                    padding: "14px",
                    borderRadius: "50px",
                    backgroundColor: "#ef4444",
                    color: "#ffffff",
                    fontWeight: "bold",
                    border: "none",
                    cursor: "pointer",
                  }}
                  onClick={handleClearForm}
                >
                  Yes, Clear
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {showSuccessModal &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              backgroundColor: "rgba(0, 0, 0, 0.65)",
              zIndex: 999999,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <div className="modal-box" style={{ margin: "0 20px" }}>
              <h3 className="modal-title" style={{ fontSize: "1.8rem" }}>
                {t.reported}
              </h3>
              <p
                className="modal-text"
                dangerouslySetInnerHTML={{
                  __html: t.reportReview.replace("now", "now<br />"),
                }}
              />
              <button
                className="modal-btn confirm-btn"
                style={{
                  backgroundColor: "#1b0b8c",
                  width: "100%",
                  borderRadius: "25px",
                }}
                onClick={() => {
                  setShowSuccessModal(false);
                  setImagePreview(null);
                  setCoordinates({ lat: "", lon: "" });
                  setHasAcceptedGuidelines(false);
                  setFormData({
                    report_type_id: "",
                    municipality_id: "",
                    barangay_id: "",
                    purok_sitio: "",
                    landmark: "",
                    description: "",
                  });

                  localStorage.removeItem("report_draft_guidelines");
                  localStorage.removeItem("report_draft_image");
                  localStorage.removeItem("report_draft_coords");
                  localStorage.removeItem("report_draft_form");

                  setHasPendingReport(true);
                  setPendingReportDetails({
                    landmark: formData.landmark.trim(),
                    latitude: coordinates.lat,
                    longitude: coordinates.lon,
                    report_type_id: formData.report_type_id,
                  });
                }}
              >
                OK!
              </button>
            </div>
          </div>,
          document.body,
        )}

      {!hasAcceptedGuidelines ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "center",
            padding: "0 16px 100px 16px",
            boxSizing: "border-box",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              margin: "0 auto",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <h1
              className="report-title"
              style={{
                textAlign: "center",
                marginBottom: "0",
                fontSize: "1.5rem",
                color: "#1b0b8c",
              }}
            >
              REPORT GUIDELINES
            </h1>
            <p
              style={{
                color: "#475569",
                textAlign: "center",
                fontSize: "0.85rem",
                marginTop: "-4px",
                marginBottom: "4px",
              }}
            >
              Please read carefully to avoid account restrictions.
            </p>

            <div
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "20px",
                padding: "18px 16px",
                boxShadow: "0 10px 25px rgba(0,0,0,0.05)",
                border: "1px solid #e2e8f0",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    backgroundColor: "#fef3c7",
                    padding: "8px",
                    borderRadius: "50%",
                  }}
                >
                  <MapPin size={20} color="#d97706" />
                </div>
                <div>
                  <h3
                    style={{
                      margin: "0 0 4px 0",
                      color: "#1e293b",
                      fontSize: "0.9rem",
                      fontWeight: "900",
                    }}
                  >
                    Accurate Location
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      color: "#475569",
                      fontSize: "0.75rem",
                      lineHeight: "1.4",
                    }}
                  >
                    Ensure your device GPS is turned on and VPNs are disabled
                    before capturing a photo so linemen can locate the issue
                    precisely.
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    backgroundColor: "#e0e7ff",
                    padding: "8px",
                    borderRadius: "50%",
                  }}
                >
                  <CameraIcon size={20} color="#4f46e5" />
                </div>
                <div>
                  <h3
                    style={{
                      margin: "0 0 4px 0",
                      color: "#1e293b",
                      fontSize: "0.9rem",
                      fontWeight: "900",
                    }}
                  >
                    Clear Evidence
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      color: "#475569",
                      fontSize: "0.75rem",
                      lineHeight: "1.4",
                    }}
                  >
                    Take a clear, real-time photo of the exact problem (e.g.,
                    fallen pole, leaning wire, tree touching line).
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    backgroundColor: "#fee2e2",
                    padding: "8px",
                    borderRadius: "50%",
                  }}
                >
                  <ShieldAlert size={20} color="#dc2626" />
                </div>
                <div>
                  <h3
                    style={{
                      margin: "0 0 4px 0",
                      color: "#1e293b",
                      fontSize: "0.9rem",
                      fontWeight: "900",
                    }}
                  >
                    Anti-Spam Policy
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      color: "#475569",
                      fontSize: "0.75rem",
                      lineHeight: "1.4",
                    }}
                  >
                    Duplicate reports near existing issues will be blocked
                    automatically. Continuous fake reports may result in account
                    restriction.
                  </p>
                </div>
              </div>

              {hasPendingReport && (
                <div
                  style={{
                    marginTop: "5px",
                    backgroundColor: "#fffbe1",
                    border: "1px dashed #fde047",
                    borderRadius: "15px",
                    padding: "15px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <AlertCircle size={20} color="#d97706" />
                    <h3
                      style={{
                        margin: 0,
                        color: "#d97706",
                        fontSize: "0.95rem",
                        fontWeight: "900",
                      }}
                    >
                      Pending Report Active
                    </h3>
                  </div>
                  <p
                    style={{
                      margin: 0,
                      color: "#475569",
                      fontSize: "0.8rem",
                      lineHeight: "1.4",
                    }}
                  >
                    You currently have a report awaiting review at{" "}
                    <strong style={{ color: "#d97706" }}>
                      {pendingReportDetails?.landmark || "your location"}
                    </strong>
                    .
                  </p>
                  <p
                    style={{
                      margin: 0,
                      color: "#1e293b",
                      fontSize: "0.82rem",
                      fontWeight: "700",
                      lineHeight: "1.3",
                    }}
                  >
                    Are you reporting a{" "}
                    <span style={{ color: "#1b0b8c", fontWeight: "900" }}>
                      new and different damage
                    </span>
                    ?
                  </p>
                </div>
              )}

              <button
                onClick={() => setHasAcceptedGuidelines(true)}
                style={{
                  backgroundColor: "#1b0b8c",
                  color: "#ffffff",
                  border: "none",
                  padding: "14px 12px",
                  borderRadius: "50px",
                  fontWeight: "900",
                  fontSize: "0.85rem",
                  marginTop: "4px",
                  cursor: "pointer",
                  boxShadow: "0 8px 20px rgba(27, 11, 140, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  transition: "transform 0.1s ease",
                  textTransform: "uppercase",
                }}
                onMouseDown={(e) =>
                  (e.currentTarget.style.transform = "scale(0.97)")
                }
                onMouseUp={(e) =>
                  (e.currentTarget.style.transform = "scale(1)")
                }
              >
                {hasPendingReport ? (
                  <>
                    YES, NEW REPORT <ArrowRight size={18} />
                  </>
                ) : (
                  <>
                    <CheckCircle size={18} /> I UNDERSTAND & PROCEED
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : !isCameraOpen ? (
        <div
          className="report-form-container"
          ref={formContainerRef}
          style={{
            padding: 0,
            display: "flex",
            flexDirection: "column",
            flex: 1,
          }}
        >
          <div
            style={{
              position: "sticky",
              top: "-1px",
              zIndex: 100,
              backgroundColor: "rgba(27, 11, 140, 0.95)", // Navy blue with blur
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              padding:
                "calc(env(safe-area-inset-top, 0px) + 16px) 16px 10px 16px", // 🌟 Reduced bottom padding for a tighter fit
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderBottom: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <h1
              className="report-title"
              style={{
                margin: 0,
                textAlign: "center",
                fontSize: "2.1rem", // 🌟 EVEN BIGGER FONT
                letterSpacing: "1px",
                color: "#fde047", // Yellow text
                fontWeight: "900",
                textTransform: "uppercase",
              }}
            >
              {t.reportTitle || "Report"}
            </h1>
          </div>

          <div
            style={{
              flex: 1,
              backgroundColor: "#f8fafc",
              padding: "8px 16px 120px 16px", // 🌟 Reduced top padding so the camera box is closer to the header
              boxSizing: "border-box",
            }}
          >
            <div>
              <FieldError message={fieldErrors.photo} overlap={false} />

              <div
                data-field="photo"
                onClick={() => setIsCameraOpen(true)}
                style={{
                  width: "100%",
                  height: "240px",
                  borderRadius: "24px",
                  border: fieldErrors.photo
                    ? "2px dashed #ef4444"
                    : "2px dashed #cbd5e1",
                  backgroundColor: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  cursor: "pointer",
                  boxShadow: "0 4px 10px rgba(0,0,0,0.03)",
                }}
              >
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Captured report"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div style={{ textAlign: "center" }}>
                    <CameraIcon
                      size={48}
                      color="#1b0b8c"
                      style={{ margin: "0 auto 10px auto" }}
                    />
                    <h2
                      style={{
                        fontSize: "1.1rem",
                        margin: 0,
                        fontWeight: "800",
                        color: "#1e293b",
                      }}
                    >
                      {t.capturePhoto}
                    </h2>
                  </div>
                )}
              </div>

              {imagePreview && (
                <>
                  <FieldError
                    message={fieldErrors.coordinates}
                    overlap={false}
                  />

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      backgroundColor: "#ffffff",
                      border: fieldErrors.coordinates
                        ? "2px solid #ff0000"
                        : "1px solid #cbd5e1",
                      borderRadius: "50px",
                      padding: "14px 20px",
                      marginTop: "15px",
                      boxShadow: "0 4px 10px rgba(0,0,0,0.03)",
                      width: "100%",
                      boxSizing: "border-box",
                    }}
                  >
                    <div
                      style={{
                        marginRight: "15px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <MapPin size={26} color="#1b0b8c" strokeWidth={2.5} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span
                        style={{
                          fontSize: "0.85rem",
                          fontWeight: "900",
                          color: "#1e293b",
                          textTransform: "uppercase",
                        }}
                      >
                        Incident Geo-Tag
                      </span>
                      <span
                        style={{
                          fontSize: "0.85rem",
                          fontWeight: "700",
                          marginTop: "2px",
                          color:
                            coordinates.lat && coordinates.lat !== "Fetching..."
                              ? "#16a34a"
                              : "#94a3b8",
                        }}
                      >
                        {coordinates.lat === "Fetching..."
                          ? "Acquiring GPS signal..."
                          : coordinates.lat
                            ? `LAT: ${coordinates.lat}, LON: ${coordinates.lon}`
                            : "No coordinates captured"}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {error && (
              <div
                style={{
                  backgroundColor: "#fee2e2",
                  color: "#ef4444",
                  padding: "12px",
                  borderRadius: "15px",
                  textAlign: "center",
                  fontWeight: "bold",
                  fontSize: "0.85rem",
                  marginTop: "15px",
                  border: "1px solid #fca5a5",
                }}
              >
                {error}
              </div>
            )}

            <div
              className="report-inputs"
              style={{
                marginTop: "15px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div>
                <FieldError
                  message={fieldErrors.municipality_id}
                  overlap={false}
                />
                <SearchableDropdown
                  name="municipality_id"
                  options={municipalities}
                  value={formData.municipality_id}
                  onChange={handleInputChange}
                  placeholder={t.incidentMun}
                  hasError={!!fieldErrors.municipality_id}
                />
              </div>

              <div>
                <FieldError message={fieldErrors.barangay_id} overlap={false} />
                <SearchableDropdown
                  name="barangay_id"
                  options={barangays}
                  value={formData.barangay_id}
                  onChange={handleInputChange}
                  placeholder={
                    !formData.municipality_id
                      ? "Select Municipality first"
                      : t.incidentBrgy
                  }
                  disabled={!formData.municipality_id}
                  hasError={!!fieldErrors.barangay_id}
                />
              </div>

              <div>
                <FieldError message={fieldErrors.purok_sitio} overlap={false} />
                <input
                  type="text"
                  name="purok_sitio"
                  placeholder={t.purokSitio}
                  value={formData.purok_sitio}
                  onChange={handleInputChange}
                  style={{
                    width: "100%",
                    padding: "16px 20px",
                    borderRadius: "50px",
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    fontSize: "1rem",
                    fontWeight: "700",
                    color: "#1e293b",
                    boxSizing: "border-box",
                    outline: "none",
                    boxShadow: "0 4px 10px rgba(0,0,0,0.03)",
                  }}
                />
              </div>

              <div>
                <FieldError
                  message={fieldErrors.report_type_id}
                  overlap={false}
                />
                <SearchableDropdown
                  name="report_type_id"
                  options={reportTypes}
                  value={formData.report_type_id}
                  onChange={handleInputChange}
                  placeholder={t.reportType}
                  hasError={!!fieldErrors.report_type_id}
                />
              </div>

              <div>
                <FieldError message={fieldErrors.landmark} overlap={false} />
                <input
                  type="text"
                  name="landmark"
                  placeholder={t.landmarkPlaceholder || "Landmark"}
                  value={formData.landmark}
                  onChange={handleInputChange}
                  style={{
                    width: "100%",
                    padding: "16px 20px",
                    borderRadius: "50px",
                    border: fieldErrors.landmark
                      ? "2px solid #ef4444"
                      : "1px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    fontSize: "1rem",
                    fontWeight: "700",
                    color: "#1e293b",
                    boxSizing: "border-box",
                    outline: "none",
                    boxShadow: "0 4px 10px rgba(0,0,0,0.03)",
                  }}
                />
              </div>

              <div>
                <FieldError message={fieldErrors.description} overlap={false} />
                <input
                  type="text"
                  name="description"
                  placeholder={
                    isOtherSelected
                      ? "Describe the issue/damage (Required) *"
                      : t.descOptional
                  }
                  value={formData.description}
                  onChange={handleInputChange}
                  style={{
                    width: "100%",
                    padding: "16px 20px",
                    borderRadius: "50px",
                    border: fieldErrors.description
                      ? "2px solid #ef4444"
                      : isOtherSelected && !formData.description.trim()
                        ? "2px solid #f59e0b"
                        : "1px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    fontSize: "1rem",
                    fontWeight: "700",
                    color: "#1e293b",
                    boxSizing: "border-box",
                    outline: "none",
                    boxShadow: "0 4px 10px rgba(0,0,0,0.03)",
                  }}
                />
              </div>
            </div>

            <div
              style={{
                marginTop: "25px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              {(imagePreview ||
                formData.municipality_id ||
                formData.report_type_id ||
                formData.landmark ||
                formData.description ||
                formData.purok_sitio) && (
                <button
                  onClick={() => setShowClearConfirmModal(true)}
                  disabled={isSubmitting}
                  style={{
                    flexShrink: 0,
                    width: "56px",
                    height: "56px",
                    borderRadius: "50%",
                    backgroundColor: "transparent",
                    border: "2px solid #cbd5e1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    opacity: isSubmitting ? 0.5 : 1,
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = "scale(0.95)";
                    e.currentTarget.style.backgroundColor = "#fee2e2";
                    e.currentTarget.style.borderColor = "#fca5a5";
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = "scale(1)";
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.borderColor = "#cbd5e1";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "scale(1)";
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.borderColor = "#cbd5e1";
                  }}
                >
                  <Trash2 size={24} color="#475569" />
                </button>
              )}

              <button
                onClick={handleSubmitReport}
                disabled={isSubmitting || coordinates.lat === "Fetching..."}
                style={{
                  flex: 1,
                  padding: "18px",
                  borderRadius: "50px",
                  backgroundColor: "#1b0b8c",
                  color: "#ffffff",
                  fontWeight: "900",
                  fontSize: "1.1rem",
                  border: "none",
                  cursor: "pointer",
                  textTransform: "uppercase",
                  boxShadow: "0 8px 20px rgba(27, 11, 140, 0.25)",
                  transition: "transform 0.1s ease",
                  opacity:
                    isSubmitting || coordinates.lat === "Fetching..." ? 0.7 : 1,
                }}
                onMouseDown={(e) =>
                  (e.currentTarget.style.transform = "scale(0.98)")
                }
                onMouseUp={(e) =>
                  (e.currentTarget.style.transform = "scale(1)")
                }
              >
                {isSubmitting ? t.submitting : t.submit}
              </button>
            </div>
          </div>
        </div>
      ) : (
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
              onClick={() => setIsCameraOpen(false)}
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
            <span style={{ color: "#fff", fontWeight: "bold" }}>
              {t.evidenceCamera}
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
              {t.capturePhoto}
            </p>
            <button
              onClick={capture}
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
      )}
    </div>
  );
}

export default ReportTab;
