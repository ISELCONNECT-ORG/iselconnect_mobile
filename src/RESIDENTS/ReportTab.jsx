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
} from "lucide-react";
import { supabase } from "../supabaseClient";
import { logSystemAction } from "../utils/logger";
import { translations } from "../components/translations";

const SearchableDropdown = ({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  name,
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
      <input
        type="text"
        name={name}
        className="rounded-input"
        style={{
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? "not-allowed" : "text",
          width: "100%",
          boxSizing: "border-box",
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
        style={{
          position: "absolute",
          right: "15px",
          top: "25px",
          transform: "translateY(-50%)",
          pointerEvents: "none",
        }}
      >
        <ChevronDown size={20} color="#64748b" />
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
  const [hasAcceptedGuidelines, setHasAcceptedGuidelines] = useState(false);

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [coordinates, setCoordinates] = useState({ lat: "", lon: "" });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [reportTypes, setReportTypes] = useState([]);
  const [municipalities, setMunicipalities] = useState([]);
  const [barangays, setBarangays] = useState([]);

  const [formData, setFormData] = useState({
    report_type_id: "",
    municipality_id: "",
    barangay_id: "",
    purok_sitio: "",
    landmark: "",
    description: "",
  });

  const webcamRef = useRef(null);

  // Check if selected report type is "Other / Not Specified"
  const selectedReportTypeObj = reportTypes.find(
    (rt) => rt.id.toString() === formData.report_type_id.toString(),
  );
  const isOtherSelected =
    selectedReportTypeObj?.name?.toLowerCase().includes("other") ||
    selectedReportTypeObj?.name?.toLowerCase().includes("not specified");

  useEffect(() => {
    if (!isActive) {
      setHasAcceptedGuidelines(false);
    }
  }, [isActive]);

  useEffect(() => {
    const checkUserStatus = async () => {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (user && !authError) {
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
            .select("id, landmark, created_at, report_statuses(name)")
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
    if (showSuccessModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showSuccessModal]);

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

      setCoordinates({
        lat: position.coords.latitude.toFixed(6),
        lon: position.coords.longitude.toFixed(6),
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

    if (hasPendingReport) {
      return setError(
        "You already have a pending report awaiting review. Please wait for it to be processed.",
      );
    }

    if (!imagePreview) return setError("Please capture a photo of the issue.");
    if (
      !coordinates.lat ||
      !coordinates.lon ||
      coordinates.lat === "Fetching..."
    )
      return setError("Please wait for location coordinates to load.");
    if (!formData.report_type_id)
      return setError("Please select a Report Type.");
    if (!formData.municipality_id)
      return setError("Please select a Municipality.");
    if (!formData.barangay_id) return setError("Please select a Barangay.");
    if (!formData.landmark.trim()) return setError("Please enter a Landmark.");

    // 🌟 REQUIRE DESCRIPTION IF "OTHER / NOT SPECIFIED" IS SELECTED
    if (isOtherSelected && !formData.description.trim()) {
      return setError(
        "Please specify the damage description for Other/Not Specified issues.",
      );
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
        className="bg-navy-tab"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          color: "#ffffff",
          fontWeight: "bold",
          overscrollBehavior: "none",
        }}
      >
        Checking account status...
      </div>
    );
  }

  if (verificationStatus !== "approved") {
    const isRejected = verificationStatus === "rejected";

    return (
      <div
        className="bg-navy-tab"
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          padding: "20px 16px 110px 16px",
          boxSizing: "border-box",
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
            boxShadow: "0 15px 30px rgba(0,0,0,0.2)",
            animation: "contentFade 0.3s ease-out",
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

  if (hasPendingReport) {
    return (
      <div
        className="bg-navy-tab"
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          padding: "20px 16px 110px 16px",
          boxSizing: "border-box",
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
            boxShadow: "0 15px 30px rgba(0,0,0,0.2)",
            animation: "contentFade 0.3s ease-out",
          }}
        >
          <div
            style={{
              backgroundColor: "#fef3c7",
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px auto",
            }}
          >
            <AlertCircle size={48} color="#d97706" />
          </div>

          <h2
            style={{
              color: "#1e293b",
              fontWeight: "900",
              margin: "0 0 12px 0",
              fontSize: "1.35rem",
            }}
          >
            Pending Report Under Review
          </h2>

          <p
            style={{
              color: "#475569",
              fontSize: "0.88rem",
              lineHeight: "1.6",
              margin: "0 0 20px 0",
              textAlign: "center",
            }}
          >
            You currently have a report awaiting initial admin review at{" "}
            <strong>{pendingReportDetails?.landmark || "your location"}</strong>
            . Please wait for an administrator to review and approve your
            submission before filing a new one.
          </p>

          <div
            style={{
              backgroundColor: "#fffbe1",
              border: "1px solid #fde047",
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
              Status:{" "}
              <strong style={{ color: "#d97706" }}>PENDING ADMIN REVIEW</strong>
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-navy-tab" style={{ overscrollBehavior: "none" }}>
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

                  setHasPendingReport(true);
                  setPendingReportDetails({
                    landmark: formData.landmark.trim(),
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
            minHeight: "100vh",
            padding: "20px 16px 110px 16px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              margin: "auto",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <h1
              className="report-title text-yellow"
              style={{
                textAlign: "center",
                marginBottom: "0",
                fontSize: "1.5rem",
              }}
            >
              REPORT GUIDELINES
            </h1>
            <p
              style={{
                color: "#cbd5e1",
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
                boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
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
                    Ensure your device GPS is turned on before capturing a photo
                    so linemen can locate the issue precisely.
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
                    You cannot submit a new report while you have another report
                    pending admin review. Accumulating 5 rejected reports will
                    permanently block your account.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setHasAcceptedGuidelines(true)}
                style={{
                  backgroundColor: "#1b0b8c",
                  color: "#ffffff",
                  border: "none",
                  padding: "12px",
                  borderRadius: "50px",
                  fontWeight: "900",
                  fontSize: "0.9rem",
                  marginTop: "4px",
                  cursor: "pointer",
                  boxShadow: "0 8px 20px rgba(27, 11, 140, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  transition: "transform 0.1s ease",
                }}
                onMouseDown={(e) =>
                  (e.currentTarget.style.transform = "scale(0.97)")
                }
                onMouseUp={(e) =>
                  (e.currentTarget.style.transform = "scale(1)")
                }
              >
                <CheckCircle size={18} />I UNDERSTAND & PROCEED
              </button>
            </div>
          </div>
        </div>
      ) : !isCameraOpen ? (
        <div className="report-form-container">
          <h1 className="report-title text-yellow">{t.reportTitle}</h1>

          <div
            className="photo-capture-box"
            onClick={() => setIsCameraOpen(true)}
          >
            {imagePreview ? (
              <img
                src={imagePreview}
                alt="Captured report"
                className="captured-image-preview"
              />
            ) : (
              <div className="placeholder-content">
                <CameraIcon size={48} strokeWidth={1.5} color="#1b0b8c" />
                <h2>{t.capturePhoto}</h2>
              </div>
            )}
          </div>

          {error && (
            <div
              style={{
                backgroundColor: "#fee2e2",
                color: "#ef4444",
                padding: "12px",
                borderRadius: "30px",
                textAlign: "center",
                fontWeight: "bold",
                fontSize: "0.85rem",
                marginBottom: "15px",
              }}
            >
              {error}
            </div>
          )}

          <div className="report-inputs">
            <input
              type="text"
              className="rounded-input"
              placeholder={t.longitude}
              value={coordinates.lon}
              style={{
                color:
                  coordinates.lon === "Fetching..." ? "#94a3b8" : "inherit",
              }}
              readOnly
            />

            <input
              type="text"
              className="rounded-input"
              placeholder={t.latitude}
              value={coordinates.lat}
              style={{
                color:
                  coordinates.lat === "Fetching..." ? "#94a3b8" : "inherit",
              }}
              readOnly
            />

            <SearchableDropdown
              name="municipality_id"
              options={municipalities}
              value={formData.municipality_id}
              onChange={handleInputChange}
              placeholder={t.incidentMun}
            />

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
            />

            <input
              type="text"
              name="purok_sitio"
              className="rounded-input"
              placeholder={t.purokSitio}
              value={formData.purok_sitio}
              onChange={handleInputChange}
            />

            <SearchableDropdown
              name="report_type_id"
              options={reportTypes}
              value={formData.report_type_id}
              onChange={handleInputChange}
              placeholder={t.reportType}
            />

            <input
              type="text"
              name="landmark"
              className="rounded-input"
              placeholder={t.landmarkPlaceholder || "Landmark"}
              value={formData.landmark}
              onChange={handleInputChange}
            />

            {/* 🌟 DYNAMICALLY HIGHLIGHT DESCRIPTION IF "OTHER" IS SELECTED */}
            <input
              type="text"
              name="description"
              className="rounded-input"
              placeholder={
                isOtherSelected
                  ? "Describe the issue/damage (Required) *"
                  : t.descOptional
              }
              value={formData.description}
              onChange={handleInputChange}
              style={{
                border:
                  isOtherSelected && !formData.description.trim()
                    ? "2px solid #f59e0b"
                    : "none",
              }}
            />
          </div>

          <button
            className="submit-report-btn"
            onClick={handleSubmitReport}
            disabled={isSubmitting || coordinates.lat === "Fetching..."}
          >
            {isSubmitting ? t.submitting : t.submit}
          </button>
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
